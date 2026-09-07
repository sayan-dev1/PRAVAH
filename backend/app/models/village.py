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


class RiskFactor(BaseModel):
	feature: str
	impact_pct: int


class DetailedRisk(BaseModel):
	village_id: str
	predicted_tier: str
	probabilities: dict[str, float]
	primary_driver: str
	factors: list[RiskFactor]

