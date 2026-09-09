def test_telemetry_websocket(client):
    # Set a known state reading before connecting
    payload = {
        "sensor_id": "MANDAKINI_GAUGE_WS",
        "rainfall_mm_hr": 14.5,
        "water_level_cm": 110.0,
        "rate_of_rise_cm_min": 0.2,
        "soil_moisture_pct": 65.0,
        "status": "NORMAL"
    }
    client.post("/api/telemetry", json=payload)

    with client.websocket_connect("/ws/telemetry") as websocket:
        data = websocket.receive_json()
        assert data["sensor_id"] == "MANDAKINI_GAUGE_WS"
        assert data["water_level_cm"] == 110.0
