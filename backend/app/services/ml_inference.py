"""Optional XGBoost inference with a deterministic demo fallback."""

import csv
from pathlib import Path

from app.models.village import DetailedRisk, RiskFactor
from app.services.region_registry import artifact_path


def _terrain_for(village_id: str, region_id: str = "mandakini") -> dict[str, float]:
	path = artifact_path(region_id, "terrain_features.csv")
	try:
		with path.open(newline="", encoding="utf-8") as terrain_file:
			for row in csv.DictReader(terrain_file):
				if row.get("village_id") == village_id or row.get("village") == village_id:
					return {key: float(value) for key, value in row.items() if key not in {"village_id", "village"} and value}
	except (FileNotFoundError, ValueError):
		pass
	return {}


def detailed_risk(village_id: str, rainfall_mm_hr: float = 14, soil_moisture_pct: float = 65,
					  region_id: str = "mandakini") -> DetailedRisk:
	terrain = _terrain_for(village_id, region_id)
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
		primary_driver=primary, factors=[], ml_status="UNAVAILABLE")
