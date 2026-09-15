import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from fetch_dem import fetch_dem_tile
from fetch_osm import extract_osm_layers
from process_terrain import compute_hydrology


def run_build(config_path: str):
    config_file = Path(config_path)
    with config_file.open("r", encoding="utf-8") as handle:
        cfg = json.load(handle)

    region_id = cfg["region_id"]
    out_dir = Path("gis/outputs") / region_id
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n=======================================================")
    print(f" PROVISIONING REGION: {cfg['name']} ({region_id})")
    print(f"=======================================================\n")

    extract_osm_layers(
        cfg["bbox"],
        cfg["river_query"],
        cfg["target_settlements"],
        cfg.get("shelter_query", "school|college|community_centre"),
        cfg.get("utm_crs", "EPSG:32644"),
        out_dir,
    )

    dem_path = out_dir / "dem.tif"
    fetch_dem_tile(cfg["bbox"], dem_path, cfg.get("utm_crs", "EPSG:32644"))

    compute_hydrology(dem_path, out_dir / "settlements.geojson", out_dir)

    manifest = {
        "region_id": cfg["region_id"],
        "name": cfg["name"],
        "state": cfg["state"],
        "district": cfg["district"],
        "bbox": cfg["bbox"],
        "map_center": [
            (cfg["bbox"]["south"] + cfg["bbox"]["north"]) / 2,
            (cfg["bbox"]["west"] + cfg["bbox"]["east"]) / 2,
        ],
        "weather": cfg.get("weather", {
            "latitude": (cfg["bbox"]["south"] + cfg["bbox"]["north"]) / 2,
            "longitude": (cfg["bbox"]["west"] + cfg["bbox"]["east"]) / 2,
            "provider": "open_meteo",
        }),
        "hydro_calibration": cfg.get("hydro_calibration", {"status": "UNSET_CALIBRATION_REQUIRED"}),
        "assets": {
            "manifest": "manifest.json",
            "rivers": "rivers.geojson",
            "settlements": "settlements.geojson",
            "shelters": "shelters.geojson",
            "roads": "roads.graphml",
            "dem": "dem.tif",
            "slope": "slope.tif",
            "flow_accumulation": "flow_accumulation.tif",
            "twi": "twi.tif",
            "terrain_features": "terrain_features.csv",
        },
    }
    with (out_dir / "manifest.json").open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)

    print(f"\n[DONE] Successfully built bundle under: {out_dir}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PRAVAH Regional GIS Builder")
    parser.add_argument("--config", required=True, help="Path to regional JSON configuration")
    args = parser.parse_args()
    run_build(args.config)
