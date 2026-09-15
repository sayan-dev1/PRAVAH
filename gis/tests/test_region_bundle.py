import json
from pathlib import Path


def test_mandakini_config_has_required_region_contract():
    cfg_path = Path(__file__).resolve().parents[1] / "configs" / "mandakini.json"
    data = json.loads(cfg_path.read_text(encoding="utf-8"))

    assert data["region_id"] == "mandakini"
    assert data["bbox"]["south"] < data["bbox"]["north"]
    assert data["target_settlements"]
    assert data["utm_crs"]
    assert data["hydro_calibration"]["status"]


def test_script_contract_files_are_defined():
    scripts_dir = Path(__file__).resolve().parents[1] / "scripts"
    for name in [
        "build_region.py",
        "fetch_dem.py",
        "fetch_osm.py",
        "process_terrain.py",
        "verify_env.py",
    ]:
        assert (scripts_dir / name).exists(), f"Missing required GIS script: {name}"
