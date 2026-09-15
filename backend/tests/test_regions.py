def test_regions_list_and_bundle_geojson(client):
    regions = client.get("/api/regions")
    assert regions.status_code == 200
    ids = {item["region_id"] for item in regions.json()}
    assert "mandakini" in ids
    assert "beas_kullu" in ids

    metadata = client.get("/api/regions/mandakini")
    assert metadata.status_code == 200
    assert metadata.json()["region_id"] == "mandakini"

    rivers = client.get("/api/regions/mandakini/geojson/rivers")
    assert rivers.status_code == 200
    assert rivers.json()["type"] == "FeatureCollection"
    assert len(rivers.json()["features"]) > 0

    settlements = client.get("/api/regions/beas_kullu/settlements")
    assert settlements.status_code == 200
    assert settlements.json()["type"] == "FeatureCollection"

    layers = client.get("/api/regions/beas_kullu/layers/shelters")
    assert layers.status_code == 200


def test_health_reports_validated_regions(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["gis_status"] == "ok"
    assert set(response.json()["regions_loaded"]) >= {"mandakini", "beas_kullu"}

    region_health = client.get("/api/health/regions/beas_kullu")
    assert region_health.status_code == 200
    assert region_health.json()["status"] == "READY"
