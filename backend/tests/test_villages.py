def test_get_all_villages(client):
    response = client.get("/api/villages")
    assert response.status_code == 200
    villages = response.json()
    assert len(villages) == 3
    ids = [v["id"] for v in villages]
    assert "VIL_TILWARA" in ids
    assert "VIL_SUMERPUR" in ids
    assert "VIL_RUDRAPRAYAG" in ids


def test_get_single_village_success(client):
    response = client.get("/api/villages/VIL_TILWARA")
    assert response.status_code == 200
    village = response.json()
    assert village["id"] == "VIL_TILWARA"
    assert village["name"] == "Tilwara"
    assert "risk_level" in village
    assert "risk_score" in village
    assert "lead_time_minutes" in village


def test_get_single_village_not_found(client):
    response = client.get("/api/villages/INVALID_VILLAGE")
    assert response.status_code == 404
    assert response.json()["detail"] == "Village not found"


def test_get_detailed_risk_success(client):
    response = client.get("/api/risk/detailed/VIL_TILWARA")
    assert response.status_code == 200
    data = response.json()
    assert data["village_id"] == "VIL_TILWARA"
    assert "predicted_tier" in data
    assert "probabilities" in data
    assert "factors" in data


def test_get_detailed_risk_not_found(client):
    response = client.get("/api/risk/detailed/INVALID_VILLAGE")
    assert response.status_code == 404
    assert response.json()["detail"] == "Village not found"
