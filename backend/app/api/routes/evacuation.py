"""Evacuation route endpoint."""

import json

from fastapi import APIRouter, HTTPException, Query

from app.services.routing_engine import route_geojson
from app.services.region_registry import get_region

router = APIRouter()


@router.get("/evacuation/{village_id}")
def get_evacuation_route(village_id: str, region_id: str = Query(default="mandakini")):
	region = get_region(region_id)
	if not any(row.get("id") == village_id for row in region.get("villages", [])):
		raise HTTPException(status_code=404, detail="Evacuation route not found")
	return route_geojson(village_id, region_id=region_id)


@router.get("/geojson/{layer_name}")
def get_geojson(layer_name: str, region_id: str = Query(default="mandakini")):
	allowed = {"villages", "settlements", "rivers", "river", "shelters"}
	if layer_name not in allowed:
		raise HTTPException(status_code=404, detail="GeoJSON layer not found")
	from app.services.region_registry import artifact_path, get_region
	get_region(region_id)
	filename = {"villages": "settlements", "river": "rivers"}.get(layer_name, layer_name)
	path = artifact_path(region_id, f"{filename}.geojson")
	with path.open(encoding="utf-8") as layer_file:
		return json.load(layer_file)
