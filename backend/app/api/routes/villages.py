"""Village risk routes."""

from fastapi import APIRouter, HTTPException, Query

from app.core.state import state_engine
from app.models.village import VillageStatus
from app.models.village import DetailedRisk
from app.services.hydro_rules import lead_time_minutes
from app.services.ml_inference import detailed_risk
from app.services.region_registry import get_region

router = APIRouter(prefix="/villages")
risk_router = APIRouter(prefix="/risk")

def _villages(region_id: str):
	return [(row["id"], row["name"], row["population_at_risk"], row["primary_driver"])
			for row in get_region(region_id).get("villages", [])]


def village_status(village_id: str, region_id: str = "mandakini") -> VillageStatus:
	region = get_region(region_id)
	row = next((item for item in _villages(region_id) if item[0] == village_id), None)
	if row is None:
		raise HTTPException(status_code=404, detail="Village not found")
	reading = state_engine.latest(region_id)
	level = reading.status if reading else "NORMAL"
	score = {"NORMAL": 0.2, "WATCH": 0.6, "CRITICAL": 0.95}.get(level, 0.2)
	return VillageStatus(id=row[0], name=row[1], risk_level=level, risk_score=score,
						 lead_time_minutes=lead_time_minutes(region.get("hydro_calibration")), population_at_risk=row[2],
						 primary_driver=row[3], regional_hazard_status=level,
						 settlement_risk_status=level if row[0] else "DATA_UNAVAILABLE")


@router.get("", response_model=list[VillageStatus])
def get_villages(region_id: str = Query(default="mandakini")) -> list[VillageStatus]:
	return [village_status(row[0], region_id) for row in _villages(region_id)]


@router.get("/{village_id}", response_model=VillageStatus)
def get_village(village_id: str, region_id: str = Query(default="mandakini")) -> VillageStatus:
	return village_status(village_id, region_id)


@risk_router.get("/detailed/{village_id}", response_model=DetailedRisk)
def get_detailed_risk(village_id: str, region_id: str = Query(default="mandakini")) -> DetailedRisk:
	if not any(row[0] == village_id for row in _villages(region_id)):
		raise HTTPException(status_code=404, detail="Village not found")
	reading = state_engine.latest(region_id)
	return detailed_risk(village_id, reading.rainfall_mm_hr if reading else 14,
		reading.soil_moisture_pct if reading else 65, region_id=region_id)
