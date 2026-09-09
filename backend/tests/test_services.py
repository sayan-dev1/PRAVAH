from datetime import datetime, timedelta, timezone
import pytest

from app.core.state import StateEngine
from app.models.telemetry import TelemetryPayload
from app.services.alert_dispatcher import dispatch_sms, tactical_message
from app.services.anomaly_filter import TelemetryAnomalyFilter
from app.services.hydro_rules import lead_time_minutes, rate_of_rise, risk_level
from app.services.ml_inference import detailed_risk
from app.services.routing_engine import route_geojson


def test_hydro_rules():
    assert risk_level(0.5) == "NORMAL"
    assert risk_level(1.0) == "WATCH"
    assert risk_level(1.5) == "WATCH"
    assert risk_level(2.0) == "CRITICAL"
    assert risk_level(3.5) == "CRITICAL"

    # Rate of rise: rise of 2cm over 1 minute (60s) = 2.0 cm/min
    assert rate_of_rise(100.0, 102.0, 60.0) == 2.0
    with pytest.raises(ValueError):
        rate_of_rise(100.0, 102.0, 0)
    with pytest.raises(ValueError):
        rate_of_rise(100.0, 102.0, -10)

    # Lead time minutes: round(8.4 / 4.0 * 60) = 126
    assert lead_time_minutes() == 126


def test_anomaly_filter():
    filter_inst = TelemetryAnomalyFilter()

    # Normal reading
    t1 = TelemetryPayload(
        rainfall_mm_hr=10.0,
        water_level_cm=100.0,
        rate_of_rise_cm_min=0.2,
        soil_moisture_pct=50.0,
        status="NORMAL"
    )
    accepted, reason, payload = filter_inst.validate(t1)
    assert accepted is True
    assert reason is None
    assert payload.status == "NORMAL"

    # Impossible spike (>50cm jump)
    t2 = TelemetryPayload(
        rainfall_mm_hr=10.0,
        water_level_cm=160.0,  # 60cm jump from 100cm
        rate_of_rise_cm_min=2.0,
        soil_moisture_pct=50.0,
        status="CRITICAL"
    )
    accepted, reason, payload = filter_inst.validate(t2)
    assert accepted is False
    assert reason == "IMPOSSIBLE_SPIKE"

    # Timeout status check
    now = datetime.now(timezone.utc)
    assert filter_inst.timeout_status(None, now) == "DATA_OFFLINE"
    assert filter_inst.timeout_status(now - timedelta(seconds=10), now) == "ONLINE"
    assert filter_inst.timeout_status(now - timedelta(seconds=20), now) == "DATA_OFFLINE"


def test_anomaly_filter_faulty_stuck():
    filter_inst = TelemetryAnomalyFilter()
    sensor_id = "STUCK_SENSOR"

    # Fill history with 19 identical high-rainfall readings
    for _ in range(19):
        reading = TelemetryPayload(
            sensor_id=sensor_id,
            rainfall_mm_hr=65.0,
            water_level_cm=120.0,
            rate_of_rise_cm_min=0.0,
            soil_moisture_pct=80.0,
            status="NORMAL"
        )
        accepted, reason, payload = filter_inst.validate(reading)
        assert accepted is True
        assert payload.status == "NORMAL"

    # 20th reading with frozen water level
    stuck_reading = TelemetryPayload(
        sensor_id=sensor_id,
        rainfall_mm_hr=65.0,
        water_level_cm=120.0,
        rate_of_rise_cm_min=0.0,
        soil_moisture_pct=80.0,
        status="NORMAL"
    )
    accepted, reason, payload = filter_inst.validate(stuck_reading)
    assert accepted is True
    assert payload.status == "FAULTY_STUCK"



def test_alert_dispatcher():
    msg = tactical_message(rate_of_rise_cm_min=3.8, village="Tilwara")
    assert "[NDRF ALERT]" in msg
    assert "Tilwara" in msg
    assert len(msg) <= 140

    envelope = dispatch_sms(msg, recipient="+919876543210")
    assert envelope["status"] == "queued"
    assert envelope["recipient"] == "+919876543210"
    assert envelope["message"] == msg[:140]


def test_ml_inference():
    # Critical risk scenario
    risk_crit = detailed_risk("VIL_TILWARA", rainfall_mm_hr=75.0, soil_moisture_pct=95.0)
    assert risk_crit.village_id == "VIL_TILWARA"
    assert risk_crit.predicted_tier == "CRITICAL"
    assert risk_crit.probabilities["CRITICAL"] == 0.80
    assert len(risk_crit.factors) > 0

    # High risk scenario
    risk_high = detailed_risk("VIL_TILWARA", rainfall_mm_hr=40.0, soil_moisture_pct=60.0)
    assert risk_high.predicted_tier == "HIGH"

    # Low risk scenario
    risk_low = detailed_risk("VIL_TILWARA", rainfall_mm_hr=10.0, soil_moisture_pct=50.0)
    assert risk_low.predicted_tier == "LOW"


def test_routing_engine():
    # Valid village
    route = route_geojson("VIL_TILWARA")
    assert route.get("type") == "FeatureCollection"
    assert "features" in route

    # Invalid village
    invalid_route = route_geojson("INVALID_VILLAGE")
    assert invalid_route == {"type": "FeatureCollection", "features": []}


def test_state_engine():
    engine = StateEngine()
    assert engine.latest() is None
    assert engine.readings() == []
    assert engine.surge_active() is False

    t = TelemetryPayload(
        rainfall_mm_hr=15.0,
        water_level_cm=110.0,
        rate_of_rise_cm_min=0.2,
        soil_moisture_pct=65.0,
        status="NORMAL"
    )
    rec = engine.record(t)
    assert rec == t
    assert engine.latest() == t
    assert len(engine.readings()) == 1

    engine.set_surge(True)
    assert engine.surge_active() is True
