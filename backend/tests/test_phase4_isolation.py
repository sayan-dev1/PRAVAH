def test_region_telemetry_and_simulation_are_isolated(client):
    beas = client.get("/api/telemetry?region_id=beas_kullu")
    mandakini = client.get("/api/telemetry?region_id=mandakini")
    assert beas.status_code == 200
    assert mandakini.status_code == 200
    assert beas.json()["region_id"] == "beas_kullu"
    assert mandakini.json()["region_id"] == "mandakini"

    response = client.post("/api/simulate/cloudburst", json={"region_id": "beas_kullu"})
    assert response.status_code == 200
    assert response.json()["telemetry"]["region_id"] == "beas_kullu"
    assert response.json()["telemetry"]["data_status"] == "SIMULATED_HYDROLOGY"

    assert client.get("/api/telemetry?region_id=beas_kullu").json()["status"] == "CRITICAL"
    assert client.get("/api/telemetry?region_id=mandakini").json()["status"] != "CRITICAL"


def test_beas_route_contains_regional_metadata(client):
    response = client.get("/api/evacuation/VIL_KULLU?region_id=beas_kullu")
    assert response.status_code == 200
    properties = response.json()["features"][0]["properties"]
    assert properties["region_id"] == "beas_kullu"
    assert properties["settlement_id"] == "VIL_KULLU"
    assert properties["shelter_id"]