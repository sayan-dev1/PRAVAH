"""Unit tests for Task 4: Telemetry Normalization Layer."""

from datetime import datetime, timezone
import pytest

from app.services.telemetry_normalizer import (
	normalize_rainfall,
	normalize_rate_of_rise,
	normalize_soil_moisture,
	normalize_telemetry,
	normalize_water_level,
	parse_timestamp,
)


def test_normalize_valid_standard_payload():
	raw = {
		"sensor_id": "MANDAKINI_GAUGE_01",
		"region_id": "mandakini",
		"water_level_cm": 120.5,
		"rainfall_mm_hr": 25.0,
		"rate_of_rise_cm_min": 0.4,
		"soil_moisture_pct": 72.0,
		"status": "NORMAL",
		"timestamp": "2026-09-15T12:00:00Z",
	}
	canonical = normalize_telemetry(raw)
	assert canonical.sensor_id == "MANDAKINI_GAUGE_01"
	assert canonical.region_id == "mandakini"
	assert canonical.water_level_cm == 120.5
	assert canonical.rainfall_mm_hr == 25.0
	assert canonical.rate_of_rise_cm_min == 0.4
	assert canonical.soil_moisture_pct == 72.0
	assert canonical.status == "NORMAL"
	assert canonical.timestamp.year == 2026


def test_normalize_heterogeneous_aliases():
	raw = {
		"deviceId": "STATION_KULLU_NORTH",
		"basin": "beas_kullu",
		"stage": 1.45,
		"stage_unit": "m",
		"precip": 1.2,
		"precip_unit": "in/hr",
		"ror": 0.05,
		"ror_unit": "m/min",
		"sm": 0.85,
		"source": "cwc_telemetry",
		"time": 1789488000,
	}
	canonical = normalize_telemetry(raw, default_region_id="beas_kullu")
	assert canonical.sensor_id == "STATION_KULLU_NORTH"
	assert canonical.region_id == "beas_kullu"
	# 1.45 meters -> 145.0 cm
	assert canonical.water_level_cm == 145.0
	# 1.2 in/hr -> 1.2 * 25.4 = 30.48 mm/hr
	assert pytest.approx(canonical.rainfall_mm_hr, 0.01) == 30.48
	# 0.05 m/min -> 5.0 cm/min
	assert pytest.approx(canonical.rate_of_rise_cm_min, 0.01) == 5.0
	# 0.85 ratio -> 85.0%
	assert canonical.soil_moisture_pct == 85.0
	assert canonical.water_level_source == "cwc_telemetry"


def test_water_level_unit_conversions():
	assert normalize_water_level(2.5, "m") == 250.0
	assert normalize_water_level(1500, "mm") == 150.0
	assert pytest.approx(normalize_water_level(10, "in"), 0.01) == 25.4
	assert normalize_water_level(110.0, "cm") == 110.0
	assert normalize_water_level(None) is None


def test_rainfall_unit_conversions():
	assert pytest.approx(normalize_rainfall(2.0, "in/hr"), 0.01) == 50.8
	assert normalize_rainfall(0.5, "mm/min") == 30.0
	assert normalize_rainfall(0.04, "m/hr") == 40.0
	assert normalize_rainfall(15.0, "mm/hr") == 15.0
	assert normalize_rainfall(None) is None


def test_rate_of_rise_unit_conversions():
	# 0.01 m/s = 60 cm/min
	assert normalize_rate_of_rise(0.01, "m/s") == 60.0
	# 0.5 cm/s = 30 cm/min
	assert normalize_rate_of_rise(0.5, "cm/s") == 30.0
	# 0.02 m/min = 2.0 cm/min
	assert normalize_rate_of_rise(0.02, "m/min") == 2.0
	assert normalize_rate_of_rise(1.5, "cm/min") == 1.5
	assert normalize_rate_of_rise(None) is None


def test_soil_moisture_unit_conversions():
	assert normalize_soil_moisture(0.68, "fraction") == 68.0
	assert normalize_soil_moisture(0.75) == 75.0
	assert normalize_soil_moisture(82.0, "%") == 82.0
	assert normalize_soil_moisture(None) is None


def test_timestamp_parsing_variants():
	# ISO UTC
	dt1 = parse_timestamp("2026-09-15T14:30:00Z")
	assert dt1.tzinfo == timezone.utc
	assert dt1.hour == 14

	# ISO with +05:30 offset -> converts to UTC
	dt2 = parse_timestamp("2026-09-15T20:00:00+05:30")
	assert dt2.tzinfo == timezone.utc
	assert dt2.hour == 14
	assert dt2.minute == 30

	# Epoch seconds
	dt3 = parse_timestamp(1789488000)
	assert dt3.tzinfo == timezone.utc

	# Epoch milliseconds
	dt4 = parse_timestamp(1789488000000)
	assert dt4.tzinfo == timezone.utc
	assert dt4 == dt3

	# None returns current UTC
	dt5 = parse_timestamp(None)
	assert dt5.tzinfo == timezone.utc


def test_timestamp_parsing_malformed():
	with pytest.raises(ValueError, match="Malformed timestamp"):
		parse_timestamp("invalid-date-string-abc")


def test_non_numeric_malformed_values():
	with pytest.raises(ValueError, match="Invalid non-numeric water level"):
		normalize_water_level("not-a-number")

	with pytest.raises(ValueError, match="Invalid non-numeric rainfall"):
		normalize_rainfall("twenty-mm")


def test_non_fabrication_of_missing_measurements():
	# When water level and rainfall are not provided, values must remain 0.0 or None, not fabricated random values
	raw = {
		"sensor_id": "TEST_SENSOR",
		"region_id": "mandakini",
	}
	canonical = normalize_telemetry(raw)
	assert canonical.sensor_id == "TEST_SENSOR"
	assert canonical.water_level_cm == 0.0
	assert canonical.rainfall_mm_hr == 0.0
	assert canonical.rate_of_rise_cm_min == 0.0
