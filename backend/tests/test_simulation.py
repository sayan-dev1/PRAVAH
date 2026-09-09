from app.core.state import state_engine


def test_trigger_cloudburst(client):
    response = client.post("/api/simulate/cloudburst", json={"intensity": "high", "target_basin": "MANDAKINI"})
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Cloudburst surge injected"
    assert data["telemetry"]["rainfall_mm_hr"] == 85
    assert data["telemetry"]["status"] == "CRITICAL"
    assert state_engine.surge_active() is True


def test_reset_simulation(client):
    state_engine.set_surge(True)
    response = client.post("/api/simulate/reset")
    assert response.status_code == 200
    assert response.json() == {"status": "reset"}
    assert state_engine.surge_active() is False


def test_create_tactical_alert(client):
    response = client.post("/api/simulate/alert")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "queued"
    assert "[NDRF ALERT]" in data["message"]
