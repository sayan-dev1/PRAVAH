"""Evacuation route endpoint."""

import json

from fastapi import APIRouter, HTTPException

from app.core.config import DATA_DIR
from app.services.routing_engine import route_geojson

router = APIRouter()


@router.get("/evacuation/{village_id}")
def get_evacuation_route(village_id: str):
	if village_id != "VIL_TILWARA":
		raise HTTPException(status_code=404, detail="Evacuation route not found")
	return route_geojson(village_id)


@router.get("/geojson/{layer_name}")
def get_geojson(layer_name: str):
	allowed = {"villages", "river_mandakini", "evac_route_tilwara", "shelters"}
	if layer_name not in allowed:
		raise HTTPException(status_code=404, detail="GeoJSON layer not found")
	path = DATA_DIR / f"{layer_name}.geojson"
	with path.open(encoding="utf-8") as layer_file:
		return json.load(layer_file)
