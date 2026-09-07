"""Village risk routes."""

from fastapi import APIRouter, HTTPException

from app.core.state import state_engine
from app.models.village import VillageStatus
from app.services.hydro_rules import lead_time_minutes

router = APIRouter(prefix="/villages")

_VILLAGES = [
	("VIL_TILWARA", "Tilwara", 1840, "Extreme upstream rainfall accumulation"),
	("VIL_SUMERPUR", "Sumerpur", 920, "River rate of rise"),
	("VIL_RUDRAPRAYAG", "Rudraprayag Town", 5400, "River confluence exposure"),
]


def village_status(village_id: str) -> VillageStatus:
	row = next((item for item in _VILLAGES if item[0] == village_id), None)
	if row is None:
		raise HTTPException(status_code=404, detail="Village not found")
	reading = state_engine.latest()
	level = reading.status if reading else "NORMAL"
	score = {"NORMAL": 0.2, "WATCH": 0.6, "CRITICAL": 0.95}.get(level, 0.2)
	return VillageStatus(id=row[0], name=row[1], risk_level=level, risk_score=score,
						 lead_time_minutes=lead_time_minutes(), population_at_risk=row[2],
						 primary_driver=row[3])


@router.get("", response_model=list[VillageStatus])
def get_villages() -> list[VillageStatus]:
	return [village_status(row[0]) for row in _VILLAGES]


@router.get("/{village_id}", response_model=VillageStatus)
def get_village(village_id: str) -> VillageStatus:
	return village_status(village_id)
