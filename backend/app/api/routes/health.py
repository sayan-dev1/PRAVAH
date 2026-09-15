"""Operational health and regional bundle checks."""

from fastapi import APIRouter, HTTPException

from app.services.region_registry import REQUIRED_ASSETS, REGIONS_DIR, artifact_path, get_region, list_regions
from app.services.weather_service import latest_weather

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health() -> dict:
	return {
		"status": "ok",
		"regions_loaded": [region["region_id"] for region in list_regions()],
		"weather_provider": "open_meteo",
		"gis_status": "ok" if list_regions() else "unavailable",
	}


@router.get("/weather")
def weather_status(region_id: str = "mandakini") -> dict:
	weather = latest_weather(region_id)
	return {
		"region_id": region_id,
		"provider": weather.provider,
		"status": weather.status,
		"precipitation_mm": weather.precipitation_mm,
		"rain_mm": weather.rain_mm,
		"relative_humidity_pct": weather.relative_humidity_pct,
		"soil_moisture": weather.soil_moisture,
		"updated_at": weather.updated_at,
		"observation_age_seconds": weather.age_seconds,
		"error": weather.error,
	}


@router.get("/regions/{region_id}")
def region_health(region_id: str) -> dict:
	try:
		region = get_region(region_id)
		assets = region.get("assets") or region.get("artifacts") or {}
		for asset_name in REQUIRED_ASSETS:
			artifact_path(region_id, assets[asset_name])
		weather = latest_weather(region_id)
		return {
			"region_id": region_id,
			"status": "READY",
			"gis_status": "ok",
			"weather_status": weather.status,
			"weather_provider": weather.provider,
			"weather_observation_age_seconds": weather.age_seconds,
		}
	except HTTPException:
		raise