def test_get_evacuation_route_success(client):
    response = client.get("/api/evacuation/VIL_TILWARA")
    assert response.status_code == 200
    data = response.json()
    assert data.get("type") == "FeatureCollection"


def test_get_evacuation_route_not_found(client):
    response = client.get("/api/evacuation/UNKNOWN_VILLAGE")
    assert response.status_code == 404
    assert response.json()["detail"] == "Evacuation route not found"


def test_get_geojson_layers_success(client):
    allowed_layers = ["villages", "river_mandakini", "evac_route_tilwara", "shelters"]
    for layer in allowed_layers:
        response = client.get(f"/api/geojson/{layer}")
        assert response.status_code == 200, f"Failed for layer {layer}"
        data = response.json()
        assert "type" in data


def test_get_geojson_layer_invalid(client):
    response = client.get("/api/geojson/secret_map")
    assert response.status_code == 404
    assert response.json()["detail"] == "GeoJSON layer not found"
