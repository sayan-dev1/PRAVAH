def test_get_telemetry(client):
    response = client.get("/api/telemetry")
    assert response.status_code == 200
    data = response.json()
    assert "rainfall_mm_hr" in data
    assert "water_level_cm" in data
    assert "rate_of_rise_cm_min" in data
    assert "soil_moisture_pct" in data
    assert "status" in data


def test_post_valid_telemetry(client):
    payload = {
        "sensor_id": "MANDAKINI_GAUGE_01",
        "rainfall_mm_hr": 14.5,
        "water_level_cm": 110.0,
        "rate_of_rise_cm_min": 0.2,
        "soil_moisture_pct": 65.0,
        "status": "NORMAL"
    }
    response = client.post("/api/telemetry", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["accepted"] is True
    assert data["telemetry"]["water_level_cm"] == 110.0

    # Verify latest telemetry updated
    get_resp = client.get("/api/telemetry")
    assert get_resp.json()["water_level_cm"] == 110.0


def test_post_invalid_telemetry_spike(client):
    # First record baseline
    client.post("/api/telemetry", json={
        "sensor_id": "MANDAKINI_GAUGE_TEST",
        "rainfall_mm_hr": 14.5,
        "water_level_cm": 100.0,
        "rate_of_rise_cm_min": 0.2,
        "soil_moisture_pct": 65.0,
        "status": "NORMAL"
    })

    # Post impossible spike (>50cm jump for same sensor)
    spike_payload = {
        "sensor_id": "MANDAKINI_GAUGE_TEST",
        "rainfall_mm_hr": 14.5,
        "water_level_cm": 180.0,
        "rate_of_rise_cm_min": 5.0,
        "soil_moisture_pct": 65.0,
        "status": "CRITICAL"
    }
    response = client.post("/api/telemetry", json=spike_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["accepted"] is False
    assert data["reason"] == "IMPOSSIBLE_SPIKE"
