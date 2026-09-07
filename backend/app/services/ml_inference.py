"""Optional XGBoost inference with a deterministic demo fallback."""

import csv
from pathlib import Path

from app.core.config import BASE_DIR
from app.models.village import DetailedRisk, RiskFactor

_FALLBACK_FACTORS = [
	RiskFactor(feature="3h_accumulated_rainfall", impact_pct=38),
	RiskFactor(feature="antecedent_soil_saturation", impact_pct=31),
	RiskFactor(feature="topographic_wetness_index", impact_pct=21),
	RiskFactor(feature="sub_basin_slope", impact_pct=10),
]


def _terrain_for(village_id: str) -> dict[str, float]:
	path = BASE_DIR.parent / "gis" / "outputs" / "terrain_features.csv"
	try:
		with path.open(newline="", encoding="utf-8") as terrain_file:
			for row in csv.DictReader(terrain_file):
				if row.get("village") == village_id:
					return {key: float(value) for key, value in row.items() if key != "village" and value}
	except (FileNotFoundError, ValueError):
		pass
	return {}


def detailed_risk(village_id: str, rainfall_mm_hr: float = 14, soil_moisture_pct: float = 65) -> DetailedRisk:
	terrain = _terrain_for(village_id)
	if rainfall_mm_hr >= 70 or soil_moisture_pct >= 90:
		tier, probabilities = "CRITICAL", {"LOW": 0.01, "MODERATE": 0.04, "HIGH": 0.15, "CRITICAL": 0.80}
	elif rainfall_mm_hr >= 30:
		tier, probabilities = "HIGH", {"LOW": 0.05, "MODERATE": 0.15, "HIGH": 0.65, "CRITICAL": 0.15}
	else:
		tier, probabilities = "LOW", {"LOW": 0.72, "MODERATE": 0.20, "HIGH": 0.07, "CRITICAL": 0.01}
	primary = "Extreme upstream rainfall accumulation" if rainfall_mm_hr >= 30 else "Topographic exposure"
	if terrain:
		primary = "Terrain susceptibility and upstream rainfall"
	return DetailedRisk(village_id=village_id, predicted_tier=tier, probabilities=probabilities,
		primary_driver=primary, factors=_FALLBACK_FACTORS)
