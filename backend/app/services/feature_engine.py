"""Feature and signal calculation layer for PRAVAH.

Calculates hydrometeorological signals, rate of change (dh/dt), accumulations,
and regional terrain features supported by available observations without data fabrication.
"""

import csv
from datetime import datetime, timezone
import math
from typing import Sequence

from app.models.features import SignalContext
from app.models.telemetry import TelemetryPayload
from app.services.region_registry import artifact_path, get_region
from app.services.weather.models import CanonicalWeatherReading


def calculate_dh_dt(observations: Sequence[tuple[datetime, float]]) -> tuple[float | None, float | None]:
	"""Calculate water level rate of rise (dh/dt) and acceleration (d2h/dt2) from sequential observations.

	Args:
		observations: Sequence of (timestamp, water_level_cm) pairs.

	Returns:
		(dh_dt_cm_min, acceleration_cm_min2) or (None, None) if insufficient observations exist.
	"""
	if len(observations) < 2:
		# Do not fabricate previous readings when data is insufficient
		return None, None

	# Sort sequentially by timestamp
	sorted_obs = sorted(observations, key=lambda x: x[0])
	t_prev, h_prev = sorted_obs[-2]
	t_curr, h_curr = sorted_obs[-1]

	elapsed_seconds = (t_curr - t_prev).total_seconds()
	if elapsed_seconds <= 0:
		raise ValueError(f"Elapsed time between observations must be positive, got {elapsed_seconds}s")

	# First derivative: rate of change in cm/min
	dh_dt = (h_curr - h_prev) / (elapsed_seconds / 60.0)

	# Second derivative: acceleration if 3 or more observations exist
	acceleration = None
	if len(sorted_obs) >= 3:
		t_0, h_0 = sorted_obs[-3]
		elapsed_01 = (t_prev - t_0).total_seconds()
		if elapsed_01 > 0:
			rate_01 = (h_prev - h_0) / (elapsed_01 / 60.0)
			# Acceleration rate change over intermediate time step
			mid_dt_min = (elapsed_01 + elapsed_seconds) / 120.0
			if mid_dt_min > 0:
				acceleration = (dh_dt - rate_01) / mid_dt_min

	return round(dh_dt, 4), round(acceleration, 4) if acceleration is not None else None


def load_terrain_features(region_id: str, village_id: str) -> dict[str, float | None]:
	"""Extract terrain features (slope, TWI, elevation) from the region's GIS artifacts."""
	try:
		path = artifact_path(region_id, "terrain_features.csv")
	except Exception:
		return {}

	try:
		with path.open(newline="", encoding="utf-8") as csv_file:
			reader = csv.DictReader(csv_file)
			for row in reader:
				v_id = row.get("village_id") or row.get("village")
				if v_id == village_id:
					def _float_or_none(key: str) -> float | None:
						val = row.get(key)
						try:
							return float(val) if val is not None and val != "" else None
						except ValueError:
							return None

					return {
						"mean_twi": _float_or_none("mean_twi"),
						"max_twi": _float_or_none("max_twi"),
						"mean_slope_deg": _float_or_none("mean_slope_deg"),
						"max_slope_deg": _float_or_none("max_slope_deg"),
					}
	except (OSError, ValueError):
		pass
	return {}


def calculate_rainfall_metrics(
	weather: CanonicalWeatherReading | None = None,
	telemetry_history: Sequence[TelemetryPayload] | None = None,
) -> dict[str, float | None]:
	"""Extract rainfall intensity and multi-horizon accumulations from weather or telemetry."""
	intensity = weather.precipitation_rate_mm_hr if weather else None
	rain_1h = weather.forecast_precipitation_1h_mm if weather else None
	rain_3h = weather.forecast_precipitation_3h_mm if weather else None
	rain_6h = weather.forecast_precipitation_6h_mm if weather else None

	# If telemetry history exists and intensity was not provided by weather, calculate from telemetry
	if intensity is None and telemetry_history:
		latest = telemetry_history[-1]
		intensity = latest.rainfall_mm_hr

	return {
		"rainfall_intensity_mm_hr": intensity,
		"rainfall_1h_mm": rain_1h,
		"rainfall_3h_mm": rain_3h,
		"rainfall_6h_mm": rain_6h,
		"rainfall_24h_mm": None,  # Not supported by current weather forecast horizon
	}


def extract_features(
	region_id: str,
	village_id: str | None = None,
	telemetry: TelemetryPayload | None = None,
	history: Sequence[TelemetryPayload] | None = None,
	weather: CanonicalWeatherReading | None = None,
) -> SignalContext:
	"""Build canonical SignalContext feature vector for a region and optional settlement sector."""
	now_utc = datetime.now(timezone.utc)
	provenance: dict[str, str] = {}
	is_synthetic = False

	# 1. Hydrological River & dh/dt Calculation
	river_level = None
	dh_dt = None
	acceleration = None
	dh_dt_source = "unavailable"

	if history and len(history) >= 2:
		obs = [(reading.timestamp, reading.water_level_cm) for reading in history if reading.water_level_cm is not None]
		if len(obs) >= 2:
			dh_dt, acceleration = calculate_dh_dt(obs)
			dh_dt_source = "observed"
			provenance["dh_dt"] = "DERIVED"

	if telemetry:
		river_level = telemetry.water_level_cm
		is_synthetic = (telemetry.data_status == "SIMULATED_HYDROLOGY")
		if dh_dt is None and telemetry.rate_of_rise_cm_min is not None:
			dh_dt = telemetry.rate_of_rise_cm_min
			dh_dt_source = telemetry.rate_of_rise_source
			provenance["dh_dt"] = "LIVE_OBSERVED" if telemetry.rate_of_rise_source == "sensor" else "DERIVED"
		provenance["river_level"] = "SIMULATION" if is_synthetic else "LIVE_OBSERVED" if telemetry.water_level_source == "sensor" else "DERIVED"

	# 2. Meteorological Rainfall Signals
	rainfall_metrics = calculate_rainfall_metrics(weather=weather, telemetry_history=history)
	rainfall_source = weather.provider if weather and weather.status == "LIVE" else telemetry.rainfall_source if telemetry else "unavailable"
	if rainfall_metrics["rainfall_intensity_mm_hr"] is not None:
		provenance["rainfall"] = "MODEL_WEATHER" if weather and weather.status == "LIVE" else "LIVE_OBSERVED" if telemetry and telemetry.rainfall_source == "sensor" else "SIMULATION"

	# 3. Soil Moisture Signals
	soil_pct = weather.soil_moisture_pct if weather and weather.soil_moisture_pct is not None else telemetry.soil_moisture_pct if telemetry else None
	soil_vdr = weather.soil_moisture_vdr if weather else None
	soil_source = weather.provider if weather and weather.status == "LIVE" else telemetry.soil_moisture_source if telemetry else "unavailable"
	if soil_pct is not None:
		provenance["soil_moisture"] = "MODEL_WEATHER" if weather and weather.status == "LIVE" else "GIS"

	# 4. Terrain Features from Regional GIS Artifacts
	terrain = load_terrain_features(region_id, village_id) if village_id else {}
	if terrain:
		provenance["terrain"] = "GIS"

	return SignalContext(
		region_id=region_id,
		sensor_id=telemetry.sensor_id if telemetry else None,
		village_id=village_id,
		timestamp=telemetry.timestamp if telemetry else now_utc,
		river_level_cm=river_level,
		dh_dt_cm_min=dh_dt,
		dh_dt_acceleration_cm_min2=acceleration,
		dh_dt_source=dh_dt_source,
		rainfall_intensity_mm_hr=rainfall_metrics["rainfall_intensity_mm_hr"],
		rainfall_1h_mm=rainfall_metrics["rainfall_1h_mm"],
		rainfall_3h_mm=rainfall_metrics["rainfall_3h_mm"],
		rainfall_6h_mm=rainfall_metrics["rainfall_6h_mm"],
		rainfall_24h_mm=rainfall_metrics["rainfall_24h_mm"],
		rainfall_source=rainfall_source,
		soil_moisture_pct=soil_pct,
		soil_moisture_vdr=soil_vdr,
		soil_moisture_source=soil_source,
		mean_twi=terrain.get("mean_twi"),
		max_twi=terrain.get("max_twi"),
		mean_slope_deg=terrain.get("mean_slope_deg"),
		max_slope_deg=terrain.get("max_slope_deg"),
		elevation_m=None,
		distance_to_river_m=None,
		historical_event_proximity_km=None,
		provenance=provenance,
		is_synthetic=is_synthetic,
	)
