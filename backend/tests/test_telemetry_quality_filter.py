"""Unit tests for Task 5: Telemetry Quality & Anomaly Filter."""

from datetime import datetime, timedelta, timezone
import pytest

from app.models.telemetry import TelemetryPayload
from app.services.anomaly_filter import TelemetryAnomalyFilter


@pytest.fixture
def filter_instance():
	return TelemetryAnomalyFilter(max_history=10)


def test_quality_filter_accepts_valid_reading(filter_instance):
	reading = TelemetryPayload(
		timestamp=datetime.now(timezone.utc),
		region_id="mandakini",
		sensor_id="GAUGE_01",
		rainfall_mm_hr=15.0,
		water_level_cm=100.0,
		rate_of_rise_cm_min=0.2,
		soil_moisture_pct=65.0,
		status="NORMAL",
	)
	accepted, reason, result = filter_instance.validate(reading)
	assert accepted is True
	assert reason is None
	assert result.status == "NORMAL"


def test_quality_filter_rejects_negative_water_level(filter_instance):
	reading = TelemetryPayload(
		timestamp=datetime.now(timezone.utc),
		region_id="mandakini",
		sensor_id="GAUGE_01",
		rainfall_mm_hr=10.0,
		water_level_cm=-5.0,
		rate_of_rise_cm_min=0.0,
		soil_moisture_pct=50.0,
		status="NORMAL",
	)
	accepted, reason, _ = filter_instance.validate(reading)
	assert accepted is False
	assert reason == "OUT_OF_RANGE_WATER_LEVEL"


def test_quality_filter_rejects_negative_rainfall(filter_instance):
	reading = TelemetryPayload(
		timestamp=datetime.now(timezone.utc),
		region_id="mandakini",
		sensor_id="GAUGE_01",
		rainfall_mm_hr=-12.0,
		water_level_cm=100.0,
		rate_of_rise_cm_min=0.0,
		soil_moisture_pct=50.0,
		status="NORMAL",
	)
	accepted, reason, _ = filter_instance.validate(reading)
	assert accepted is False
	assert reason == "OUT_OF_RANGE_RAINFALL"


def test_quality_filter_rejects_impossible_extreme_rainfall(filter_instance):
	reading = TelemetryPayload(
		timestamp=datetime.now(timezone.utc),
		region_id="mandakini",
		sensor_id="GAUGE_01",
		rainfall_mm_hr=850.0,  # Physical ceiling breached (>500 mm/hr)
		water_level_cm=100.0,
		rate_of_rise_cm_min=0.0,
		soil_moisture_pct=50.0,
		status="NORMAL",
	)
	accepted, reason, _ = filter_instance.validate(reading)
	assert accepted is False
	assert reason == "IMPOSSIBLE_RAINFALL"


def test_quality_filter_rejects_future_timestamp(filter_instance):
	future_time = datetime.now(timezone.utc) + timedelta(days=2)
	reading = TelemetryPayload(
		timestamp=future_time,
		region_id="mandakini",
		sensor_id="GAUGE_01",
		rainfall_mm_hr=15.0,
		water_level_cm=100.0,
		rate_of_rise_cm_min=0.0,
		soil_moisture_pct=50.0,
		status="NORMAL",
	)
	accepted, reason, _ = filter_instance.validate(reading)
	assert accepted is False
	assert reason == "FUTURE_TIMESTAMP"


def test_quality_filter_rejects_duplicate_packet(filter_instance):
	now = datetime.now(timezone.utc)
	reading1 = TelemetryPayload(
		timestamp=now,
		region_id="mandakini",
		sensor_id="GAUGE_DUP",
		rainfall_mm_hr=20.0,
		water_level_cm=110.0,
		rate_of_rise_cm_min=0.2,
		soil_moisture_pct=60.0,
		status="NORMAL",
	)
	accepted1, _, _ = filter_instance.validate(reading1)
	assert accepted1 is True

	# Replay exact same packet
	accepted2, reason2, _ = filter_instance.validate(reading1)
	assert accepted2 is False
	assert reason2 == "DUPLICATE_READING"


def test_quality_filter_rejects_retrograde_timestamp(filter_instance):
	now = datetime.now(timezone.utc)
	reading1 = TelemetryPayload(
		timestamp=now,
		region_id="mandakini",
		sensor_id="GAUGE_TIME",
		rainfall_mm_hr=10.0,
		water_level_cm=100.0,
		rate_of_rise_cm_min=0.0,
		soil_moisture_pct=50.0,
		status="NORMAL",
	)
	accepted1, _, _ = filter_instance.validate(reading1)
	assert accepted1 is True

	# Packet with timestamp in past relative to previous
	past_reading = TelemetryPayload(
		timestamp=now - timedelta(minutes=5),
		region_id="mandakini",
		sensor_id="GAUGE_TIME",
		rainfall_mm_hr=10.0,
		water_level_cm=102.0,
		rate_of_rise_cm_min=0.0,
		soil_moisture_pct=50.0,
		status="NORMAL",
	)
	accepted2, reason2, _ = filter_instance.validate(past_reading)
	assert accepted2 is False
	assert reason2 == "RETROGRADE_TIMESTAMP"


def test_quality_filter_rejects_impossible_water_level_spike(filter_instance):
	now = datetime.now(timezone.utc)
	reading1 = TelemetryPayload(
		timestamp=now,
		region_id="mandakini",
		sensor_id="GAUGE_SPIKE",
		rainfall_mm_hr=10.0,
		water_level_cm=100.0,
		rate_of_rise_cm_min=0.0,
		soil_moisture_pct=50.0,
		status="NORMAL",
	)
	filter_instance.validate(reading1)

	# Sudden jump from 100cm to 180cm (>50cm delta)
	reading2 = TelemetryPayload(
		timestamp=now + timedelta(seconds=10),
		region_id="mandakini",
		sensor_id="GAUGE_SPIKE",
		rainfall_mm_hr=10.0,
		water_level_cm=180.0,
		rate_of_rise_cm_min=8.0,
		soil_moisture_pct=50.0,
		status="CRITICAL",
	)
	accepted, reason, _ = filter_instance.validate(reading2)
	assert accepted is False
	assert reason == "IMPOSSIBLE_SPIKE"


def test_quality_filter_detects_stuck_sensor(filter_instance):
	start_time = datetime.now(timezone.utc)
	# Feed 10 readings with intense rain (60 mm/hr) but identical frozen water level
	for i in range(10):
		reading = TelemetryPayload(
			timestamp=start_time + timedelta(seconds=i * 10),
			region_id="mandakini",
			sensor_id="GAUGE_STUCK",
			rainfall_mm_hr=60.0,
			water_level_cm=105.0,  # Completely frozen
			rate_of_rise_cm_min=0.0,
			soil_moisture_pct=80.0,
			status="NORMAL",
		)
		accepted, _, result = filter_instance.validate(reading)
		assert accepted is True
		if i == 9:
			# 10th reading over buffer should trigger FAULTY_STUCK
			assert result.status == "FAULTY_STUCK"


def test_region_isolation_in_quality_filter():
	filt = TelemetryAnomalyFilter()
	now = datetime.now(timezone.utc)

	# Sensor in Mandakini
	reading_mandakini = TelemetryPayload(
		timestamp=now,
		region_id="mandakini",
		sensor_id="GAUGE_01",
		rainfall_mm_hr=10.0,
		water_level_cm=100.0,
		rate_of_rise_cm_min=0.0,
		soil_moisture_pct=50.0,
		status="NORMAL",
	)
	filt.validate(reading_mandakini)

	# Sensor with same ID in Beas Kullu with valid different level
	reading_beas = TelemetryPayload(
		timestamp=now,
		region_id="beas_kullu",
		sensor_id="GAUGE_01",
		rainfall_mm_hr=10.0,
		water_level_cm=200.0,
		rate_of_rise_cm_min=0.0,
		soil_moisture_pct=50.0,
		status="NORMAL",
	)
	accepted, reason, _ = filt.validate(reading_beas)
	assert accepted is True
	assert reason is None
