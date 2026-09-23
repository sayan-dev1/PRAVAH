"""Unit tests for Task 7: Feature / Signal Engine."""

from datetime import datetime, timedelta, timezone
import pytest

from app.models.telemetry import TelemetryPayload
from app.services.feature_engine import (
	calculate_dh_dt,
	calculate_rainfall_metrics,
	extract_features,
	load_terrain_features,
)
from app.services.weather.models import CanonicalWeatherReading


def test_dh_dt_two_sequential_readings():
	t0 = datetime(2026, 9, 15, 12, 0, 0, tzinfo=timezone.utc)
	t1 = t0 + timedelta(seconds=60)  # Exactly 1 minute later
	obs = [(t0, 100.0), (t1, 102.0)]  # Rises 2 cm in 1 min

	dh_dt, acceleration = calculate_dh_dt(obs)
	assert dh_dt == 2.0  # 2.0 cm/min
	assert acceleration is None  # Only 2 points, no 2nd derivative


def test_dh_dt_variable_interval_and_fall():
	t0 = datetime(2026, 9, 15, 12, 0, 0, tzinfo=timezone.utc)
	t1 = t0 + timedelta(seconds=120)  # 2 minutes later
	obs = [(t0, 100.0), (t1, 105.0)]  # Rises 5 cm in 2 min -> 2.5 cm/min

	dh_dt, _ = calculate_dh_dt(obs)
	assert dh_dt == 2.5

	# Falling water level
	t2 = t1 + timedelta(seconds=60)
	obs_fall = [(t1, 105.0), (t2, 103.0)]  # Drops 2 cm in 1 min
	dh_dt_fall, _ = calculate_dh_dt(obs_fall)
	assert dh_dt_fall == -2.0


def test_dh_dt_three_points_with_acceleration():
	t0 = datetime(2026, 9, 15, 12, 0, 0, tzinfo=timezone.utc)
	t1 = t0 + timedelta(seconds=60)
	t2 = t1 + timedelta(seconds=60)
	# t0->t1: 100 -> 101 (rate = 1.0 cm/min)
	# t1->t2: 101 -> 104 (rate = 3.0 cm/min)
	# Rate surge = +2.0 cm/min over 1 min interval -> acceleration = +2.0 cm/min^2
	obs = [(t0, 100.0), (t1, 101.0), (t2, 104.0)]

	dh_dt, acceleration = calculate_dh_dt(obs)
	assert dh_dt == 3.0
	assert acceleration == 2.0


def test_dh_dt_insufficient_data_non_fabrication():
	# Single observation should return None without fabricating historical points
	obs_single = [(datetime.now(timezone.utc), 110.0)]
	dh_dt, acc = calculate_dh_dt(obs_single)
	assert dh_dt is None
	assert acc is None

	# Empty sequence
	dh_dt_empty, acc_empty = calculate_dh_dt([])
	assert dh_dt_empty is None
	assert acc_empty is None


def test_dh_dt_invalid_elapsed_time():
	t0 = datetime(2026, 9, 15, 12, 0, 0, tzinfo=timezone.utc)
	# Same timestamp
	obs = [(t0, 100.0), (t0, 105.0)]
	with pytest.raises(ValueError, match="Elapsed time"):
		calculate_dh_dt(obs)


def test_load_terrain_features_from_gis():
	# Mandakini: VIL_TILWARA
	terrain_tilwara = load_terrain_features("mandakini", "VIL_TILWARA")
	assert terrain_tilwara["mean_twi"] == 8.68
	assert terrain_tilwara["max_twi"] == 8.97
	assert terrain_tilwara["mean_slope_deg"] == 0.88
	assert terrain_tilwara["max_slope_deg"] == 1.11

	# Beas Kullu: VIL_KULLU
	terrain_kullu = load_terrain_features("beas_kullu", "VIL_KULLU")
	assert terrain_kullu["mean_twi"] == 12.44
	assert terrain_kullu["mean_slope_deg"] == 1.02

	# Unknown village returns empty dict
	terrain_unknown = load_terrain_features("mandakini", "VIL_NON_EXISTENT")
	assert terrain_unknown == {}


def test_calculate_rainfall_metrics_from_weather():
	weather = CanonicalWeatherReading(
		provider="open_meteo",
		status="LIVE",
		precipitation_rate_mm_hr=22.4,
		forecast_precipitation_1h_mm=22.4,
		forecast_precipitation_3h_mm=45.0,
		forecast_precipitation_6h_mm=62.0,
	)
	metrics = calculate_rainfall_metrics(weather=weather)
	assert metrics["rainfall_intensity_mm_hr"] == 22.4
	assert metrics["rainfall_1h_mm"] == 22.4
	assert metrics["rainfall_3h_mm"] == 45.0
	assert metrics["rainfall_6h_mm"] == 62.0
	assert metrics["rainfall_24h_mm"] is None


def test_extract_features_vector_synthesis():
	t0 = datetime(2026, 9, 15, 12, 0, 0, tzinfo=timezone.utc)
	t1 = t0 + timedelta(seconds=60)

	reading0 = TelemetryPayload(
		timestamp=t0,
		region_id="mandakini",
		sensor_id="GAUGE_01",
		rainfall_mm_hr=10.0,
		water_level_cm=100.0,
		rate_of_rise_cm_min=0.0,
		soil_moisture_pct=60.0,
		status="NORMAL",
		water_level_source="sensor",
	)
	reading1 = TelemetryPayload(
		timestamp=t1,
		region_id="mandakini",
		sensor_id="GAUGE_01",
		rainfall_mm_hr=15.0,
		water_level_cm=103.0,
		rate_of_rise_cm_min=3.0,
		soil_moisture_pct=65.0,
		status="CRITICAL",
		water_level_source="sensor",
	)

	weather = CanonicalWeatherReading(
		provider="open_meteo",
		status="LIVE",
		precipitation_rate_mm_hr=15.0,
		forecast_precipitation_1h_mm=15.0,
		forecast_precipitation_3h_mm=35.0,
		soil_moisture_pct=65.0,
		soil_moisture_vdr=0.65,
	)

	context = extract_features(
		region_id="mandakini",
		village_id="VIL_TILWARA",
		telemetry=reading1,
		history=[reading0, reading1],
		weather=weather,
	)

	assert context.region_id == "mandakini"
	assert context.village_id == "VIL_TILWARA"
	assert context.river_level_cm == 103.0
	assert context.dh_dt_cm_min == 3.0  # (103 - 100) / 1 min = 3.0 cm/min
	assert context.dh_dt_source == "observed"
	assert context.rainfall_intensity_mm_hr == 15.0
	assert context.rainfall_3h_mm == 35.0
	assert context.soil_moisture_pct == 65.0
	assert context.mean_twi == 8.68
	assert context.mean_slope_deg == 0.88
	assert context.provenance["dh_dt"] == "DERIVED"
	assert context.provenance["terrain"] == "GIS"
