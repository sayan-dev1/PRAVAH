"""Village risk and incident schemas."""

from pydantic import BaseModel


class VillageStatus(BaseModel):
	id: str
	name: str
	risk_level: str
	risk_score: float
	lead_time_minutes: int
	population_at_risk: int
	primary_driver: str

