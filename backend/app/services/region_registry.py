"""Load pre-built regional deployment bundles for runtime APIs."""

import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.core.config import BASE_DIR


REGIONS_DIR = BASE_DIR.parent / "gis" / "outputs"
DEFAULT_REGION_ID = "mandakini"

REQUIRED_ASSETS = {
	"rivers", "settlements", "shelters", "roads", "dem", "slope",
	"flow_accumulation", "twi", "terrain_features",
}


def _region_path(region_id: str) -> Path:
	if not region_id.replace("_", "").replace("-", "").isalnum():
		raise HTTPException(status_code=404, detail="Region not found")
	return REGIONS_DIR / region_id / "manifest.json"


def _invalid_bundle(region_id: str, detail: str) -> HTTPException:
	return HTTPException(status_code=503, detail=f"Region bundle '{region_id}' is not ready: {detail}")


def _validate_manifest(region_id: str, manifest: dict[str, Any], bundle_dir: Path) -> None:
	if manifest.get("region_id") != region_id:
		raise _invalid_bundle(region_id, "manifest region_id does not match requested region")
	if not manifest.get("name") or not manifest.get("bbox") or not manifest.get("map_center"):
		raise _invalid_bundle(region_id, "manifest metadata is incomplete")
	assets = manifest.get("assets") or manifest.get("artifacts")
	if not isinstance(assets, dict):
		raise _invalid_bundle(region_id, "manifest assets are missing")
	missing = [name for name in REQUIRED_ASSETS if not assets.get(name) or not (bundle_dir / assets[name]).is_file()]
	if missing:
		raise _invalid_bundle(region_id, f"missing assets: {', '.join(sorted(missing))}")
	calibration = manifest.get("hydro_calibration")
	if not isinstance(calibration, dict):
		raise _invalid_bundle(region_id, "hydro_calibration is missing")
	for asset_name in ("rivers", "settlements", "shelters"):
		try:
			payload = json.loads((bundle_dir / assets[asset_name]).read_text(encoding="utf-8"))
		except (OSError, json.JSONDecodeError) as error:
			raise _invalid_bundle(region_id, f"{asset_name} GeoJSON is unreadable") from error
		if payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
			raise _invalid_bundle(region_id, f"{asset_name} is not a FeatureCollection")
	try:
		with (bundle_dir / assets["terrain_features"]).open(encoding="utf-8") as terrain_file:
			if not terrain_file.readline().strip():
				raise _invalid_bundle(region_id, "terrain_features.csv is empty")
	except OSError as error:
		raise _invalid_bundle(region_id, "terrain_features.csv is unreadable") from error


def _load_region(region_id: str) -> dict[str, Any] | None:
	path = _region_path(region_id)
	if not path.is_file():
		return None
	try:
		region = json.loads(path.read_text(encoding="utf-8"))
		_validate_manifest(region_id, region, path.parent)
		bbox = region.get("bbox", {})
		metadata = {key: value for key, value in region.items() if key not in {"bbox", "map_center", "villages"}}
		if bbox:
			metadata["bounds"] = [[bbox["south"], bbox["west"]], [bbox["north"], bbox["east"]]]
		if region.get("map_center"):
			metadata["center"] = region["map_center"]
		villages = region.get("villages") or _load_villages(region_id)
		if villages:
			metadata["villages"] = villages
		return {**metadata, "region_id": region_id}
	except json.JSONDecodeError as error:
		raise _invalid_bundle(region_id, "manifest.json is invalid JSON") from error
	except OSError as error:
		raise _invalid_bundle(region_id, "manifest.json is unreadable") from error


def _load_villages(region_id: str) -> list[dict[str, Any]]:
	path = artifact_path(region_id, "settlements.geojson")
	try:
		payload = json.loads(path.read_text(encoding="utf-8"))
		return [
			{
				"id": feature.get("properties", {}).get("village_id", "VIL_UNKNOWN"),
				"name": feature.get("properties", {}).get("name", "Unnamed settlement"),
				"population_at_risk": feature.get("properties", {}).get("population_at_risk", 0),
				"primary_driver": feature.get("properties", {}).get("primary_driver", "Regional terrain exposure"),
			}
			for feature in payload.get("features", [])
		]
	except (OSError, json.JSONDecodeError):
		return []


def list_regions() -> list[dict[str, Any]]:
	regions: dict[str, dict[str, Any]] = {}
	if REGIONS_DIR.is_dir():
		for manifest_path in REGIONS_DIR.glob("*/manifest.json"):
			try:
				region = _load_region(manifest_path.parent.name)
			except HTTPException:
				continue
			if region:
				regions[region["region_id"]] = region
	return [{**{key: value for key, value in region.items() if key != "villages"}, "status": "READY"} for region in regions.values()]


def get_region(region_id: str = DEFAULT_REGION_ID) -> dict[str, Any]:
	region = _load_region(region_id)
	if region is None:
		raise HTTPException(status_code=404, detail="Region not found")
	return region


def artifact_path(region_id: str, filename: str) -> Path:
	if Path(filename).name != filename:
		raise HTTPException(status_code=404, detail="Regional layer not found")
	if not region_id.replace("_", "").replace("-", "").isalnum():
		raise HTTPException(status_code=404, detail="Region not found")
	bundle_dir = REGIONS_DIR / region_id
	manifest_path = bundle_dir / "manifest.json"
	if not manifest_path.is_file():
		raise HTTPException(status_code=404, detail="Region not found")
	manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
	_validate_manifest(region_id, manifest, bundle_dir)
	assets = manifest.get("assets") or manifest.get("artifacts") or {}
	if filename not in assets.values():
		raise HTTPException(status_code=404, detail="Regional asset is not declared in manifest")
	path = bundle_dir / filename
	if not path.is_file():
		raise _invalid_bundle(region_id, f"missing asset: {filename}")
	return path


def get_settlements(region_id: str = DEFAULT_REGION_ID) -> list[dict[str, Any]]:
	return get_region(region_id).get("villages", [])


def get_calibration(region_id: str = DEFAULT_REGION_ID) -> dict[str, Any]:
	return get_region(region_id).get("hydro_calibration", {})