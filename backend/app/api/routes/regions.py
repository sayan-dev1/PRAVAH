"""Regional deployment and pre-built GIS layer routes."""

import json

from fastapi import APIRouter, Query

from app.services.region_registry import artifact_path, get_region, list_regions

router = APIRouter(prefix="/regions", tags=["regions"])


@router.get("")
def get_regions() -> list[dict]:
	return list_regions()


@router.get("/{region_id}")
def get_region_metadata(region_id: str) -> dict:
	return get_region(region_id)


@router.get("/{region_id}/geojson/{layer_name}")
def get_regional_geojson(region_id: str, layer_name: str) -> dict:
	aliases = {
		"river.geojson": "rivers.geojson",
		"villages.geojson": "settlements.geojson",
	}
	filename = layer_name if layer_name.endswith(".geojson") else f"{layer_name}.geojson"
	filename = aliases.get(filename, filename)
	if filename not in {"rivers.geojson", "settlements.geojson", "shelters.geojson"}:
		from fastapi import HTTPException
		raise HTTPException(status_code=404, detail="Regional layer not found")
	get_region(region_id)
	path = artifact_path(region_id, filename)
	try:
		payload = json.loads(path.read_text(encoding="utf-8"))
		return payload
	except (OSError, json.JSONDecodeError):
		from fastapi import HTTPException
		raise HTTPException(status_code=404, detail="Regional layer not found")


@router.get("/{region_id}/settlements")
def get_regional_settlements(region_id: str) -> dict:
	return get_regional_geojson(region_id, "settlements")


@router.get("/{region_id}/layers/{layer_name}")
def get_regional_layer(region_id: str, layer_name: str) -> dict:
	return get_regional_geojson(region_id, layer_name)


@router.get("/active/geojson/{layer_name}")
def get_active_geojson(layer_name: str, region_id: str = Query(default="mandakini")) -> dict:
	return get_regional_geojson(region_id, layer_name)