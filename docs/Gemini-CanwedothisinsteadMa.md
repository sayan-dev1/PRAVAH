

Yes, this is the correct engineering shift. Moving from hardcoded geometry scripts to an **automated, configuration-driven GIS ingestion pipeline** completely changes how evaluators score your architecture. It turns GIS from a tedious manual task into a repeatable software system.

Here is the complete architectural specification and step-by-step implementation guide to build the **PRAVAH Region Factory**.

---

### Core Architecture: The "Build-Time Factory" Pattern

To keep the system reliable during emergency operations, keep runtime and ingestion strictly decoupled:

*   **Ingestion Time (One-time CLI job):** Runs `build_region.py --config configs/<region>.json`. It calls open APIs (OpenTopography / OpenStreetMap Overpass / OSMnx) to download raw data, executes raster/vector processing, and compiles a standardized deployment bundle.
*   **Run Time (FastAPI + React):** The server loads the pre-compiled, validated bundle from disk. It never makes live external GIS API calls during emergency operations, preventing latency, rate limits, or network failures.

```
                           CONFIG FILE (e.g. mandakini.json)
                                         │
                                         ▼
                             [ gis/build_region.py ]
                                         │
               ┌─────────────────────────┼─────────────────────────┐
               ▼                         ▼                         ▼
      [ fetch_dem.py ]           [ fetch_osm.py ]          [ process_terrain.py ]
       OpenTopography API         Overpass API / OSMnx      richdem / rasterstats
               │                         │                         │
               └─────────────────────────┼─────────────────────────┘
                                         ▼
                        STANDARDIZED REGIONAL ARTIFACTS
                          (data/regions/<region_id>/)
                        ├── config.json
                        ├── river.geojson
                        ├── villages.geojson
                        ├── shelters.geojson
                        ├── roads.graphml
                        ├── dem.tif / twi.tif
                        └── terrain_features.csv
                                         │
                                         ▼
                               [ FastAPI Backend ]
                                         │
                                         ▼
                            [ React Command Deck ]
```

---

### Directory Organization

Update your `gis/` tree to separate generic pipeline tools from region-specific declarations:

```text
gis/
├── configs/
│   ├── mandakini.json         # Pilot: Rudraprayag, Uttarakhand
│   └── beas_kullu.json        # Test: Upper Beas, Himachal Pradesh
├── scripts/
│   ├── fetch_dem.py           # Programmatic DEM download & clipping
│   ├── fetch_osm.py           # Overpass API parser for rivers & settlements
│   ├── extract_roads.py       # OSMnx road network graph builder
│   └── process_terrain.py     # Depression filling, Slope, Accumulation, TWI
├── build_region.py            # Master CLI orchestrator
└── outputs/                   # Standardized builds ready for backend
```

---

### Step 1: The Declarative Region Config (`gis/configs/mandakini.json`)

Each region declares its geographic boundaries, bounding box, administrative context, and locally calibrated risk thresholds:

```json
{
  "region_id": "mandakini",
  "name": "Mandakini River Valley",
  "state": "Uttarakhand",
  "district": "Rudraprayag",
  "bbox": {
    "south": 30.25,
    "west": 78.92,
    "north": 30.42,
    "east": 79.05
  },
  "river_query_names": ["Mandakini River", "मन्दाकिनी"],
  "target_settlements": ["Tilwara", "Sumerpur", "Rudraprayag"],
  "shelter_query": "school|college|community_centre",
  "hydro_calibration": {
    "watch_dh_dt_cm_min": 1.0,
    "critical_dh_dt_cm_min": 2.0,
    "wave_velocity_kmh": 4.0,
    "upstream_gauge_distance_km": 8.4
  }
}
```

---

### Step 2: Programmatic DEM Ingestion (`gis/scripts/fetch_dem.py`)

Using the public OpenTopography API, fetch the exact Copernicus 30m GLO-30 tile for any declared bounding box and save it directly as a GeoTIFF:

```python
import os
import requests

def download_dem(bbox: dict, output_path: str):
    """
    Downloads Copernicus GLO-30 30m DEM GeoTIFF from OpenTopography API.
    API documentation: https://portal.opentopography.org/apidocs/
    """
    print(f"[*] Fetching DEM for bounds: {bbox}")
    url = "https://portal.opentopography.org/API/globaldem"
    params = {
        "demtype": "COP30",
        "south": bbox["south"],
        "north": bbox["north"],
        "west": bbox["west"],
        "east": bbox["east"],
        "outputFormat": "GTiff"
    }
    
    # Optional: pass your API key if set in environment
    api_key = os.getenv("OPENTOPO_API_KEY")
    if api_key:
        params["API_Key"] = api_key

    response = requests.get(url, params=params, stream=True)
    if response.status_code == 200:
        with open(output_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"[+] Downloaded DEM: {output_path}")
    else:
        raise RuntimeError(f"DEM Download failed (HTTP {response.status_code}): {response.text}")
```

---

### Step 3: Automated OSM Vector Extractor (`gis/scripts/fetch_osm.py`)

Query OpenStreetMap Overpass API to dynamically extract the river network, target settlements, and emergency shelter nodes:

```python
import requests
import geopandas as gpd
from shapely.geometry import Point, LineString, MultiLineString

OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"

def fetch_river_network(bbox: dict, river_names: list, output_path: str):
    """Queries OSM for river waterways and clips them to the bounding box."""
    name_regex = "|".join(river_names)
    query = f"""
    [out:json][timeout:30];
    (
      relation["waterway"="river"]["name"~"{name_regex}"]({bbox['south']}, {bbox['west']}, {bbox['north']}, {bbox['east']});
      way["waterway"="river"]["name"~"{name_regex}"]({bbox['south']}, {bbox['west']}, {bbox['north']}, {bbox['east']});
    );
    out geom;
    """
    res = requests.post(OVERPASS_ENDPOINT, data={"data": query})
    elements = res.json().get("elements", [])
    
    lines = []
    for el in elements:
        if el.get("type") == "way" and "geometry" in el:
            pts = [[pt["lon"], pt["lat"]] for pt in el["geometry"]]
            if len(pts) >= 2:
                lines.append(LineString(pts))

    if lines:
        gdf = gpd.GeoDataFrame(
            [{"name": river_names[0], "river_id": f"RIV_{river_names[0].upper()[:6]}"}],
            geometry=[MultiLineString(lines)],
            crs="EPSG:4326"
        )
        gdf.to_file(output_path, driver="GeoJSON")
        print(f"[+] Exported River: {output_path}")

def fetch_settlements_and_shelters(bbox: dict, target_names: list, shelter_query: str, out_villages: str, out_shelters: str):
    """Queries OSM for settlement points (with 500m buffers) and shelter points."""
    name_regex = "|".join(target_names)
    query = f"""
    [out:json][timeout:30];
    (
      node["place"~"village|town"]["name"~"{name_regex}"]({bbox['south']}, {bbox['west']}, {bbox['north']}, {bbox['east']});
      node["amenity"~"{shelter_query}"]({bbox['south']}, {bbox['west']}, {bbox['north']}, {bbox['east']});
      way["amenity"~"{shelter_query}"]({bbox['south']}, {bbox['west']}, {bbox['north']}, {bbox['east']});
    );
    out center;
    """
    res = requests.post(OVERPASS_ENDPOINT, data={"data": query})
    elements = res.json().get("elements", [])
    
    villages, shelters = [], []
    for el in elements:
        tags = el.get("tags", {})
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        name = tags.get("name", "Unnamed Location")

        if tags.get("place") in ["village", "town"] and any(target.lower() in name.lower() for target in target_names):
            # Create a 500m approximate settlement boundary buffer
            pt_geom = Point(lon, lat)
            villages.append({
                "village_id": f"VIL_{name.upper().replace(' ', '_')}",
                "name": name,
                "center_lat": lat,
                "center_lon": lon,
                "geometry": pt_geom.buffer(0.005) # ~500m approximate degree buffer
            })
        elif tags.get("amenity"):
            shelters.append({
                "shelter_id": f"SHELTER_{len(shelters)+1:02d}",
                "name": name,
                "amenity": tags.get("amenity"),
                "geometry": Point(lon, lat)
            })

    if villages:
        gpd.GeoDataFrame(villages, crs="EPSG:4326").to_file(out_villages, driver="GeoJSON")
        print(f"[+] Exported Villages: {out_villages}")
    if shelters:
        gpd.GeoDataFrame(shelters, crs="EPSG:4326").to_file(out_shelters, driver="GeoJSON")
        print(f"[+] Exported Shelters: {out_shelters}")
```

---

### Step 4: Terrain Processing Pipeline (`gis/scripts/process_terrain.py`)

Takes the downloaded DEM and produces the terrain physical features: Slope, Flow Accumulation, TWI, and the summary table:

```python
import numpy as np
import rasterio
import richdem as rd
import geopandas as gpd
import pandas as pd
from rasterstats import zonal_stats

def compute_terrain_physics(dem_path: str, villages_geojson: str, out_twi: str, out_csv: str):
    print("[*] Running hydrological terrain modeling...")
    dem = rd.LoadGDAL(dem_path)
    dem_filled = rd.FillDepressions(dem, epsilon=True, in_place=False)

    # 1. Slope Calculation
    slope_deg = rd.TerrainAttribute(dem_filled, attrib="slope_degrees")
    slope_rad = np.radians(np.array(slope_deg))
    slope_rad = np.where(slope_rad <= 0.001, 0.001, slope_rad)

    # 2. D8 Flow Accumulation
    flow_acc = rd.FlowAccumulation(dem_filled, method="D8")
    flow_acc_arr = np.array(flow_acc)

    # 3. Topographic Wetness Index (TWI)
    cell_size = 30.0
    sca = (flow_acc_arr + 1) * cell_size
    twi = np.clip(np.log(sca / np.tan(slope_rad)), 0, 30)

    # Save TWI GeoTIFF
    with rasterio.open(dem_path) as src:
        prof = src.profile.copy()
        prof.update(dtype=rasterio.float32, count=1, nodata=-9999)
        with rasterio.open(out_twi, "w", **prof) as dst:
            dst.write(twi.astype(rasterio.float32), 1)

    # 4. Zonal Stats for ML Features
    villages = gpd.read_file(villages_geojson)
    stats_twi = zonal_stats(villages, out_twi, stats=["mean", "max"])

    df = pd.DataFrame({
        "village_id": villages["village_id"],
        "mean_twi": [round(s["mean"], 2) if s["mean"] is not None else 0.0 for s in stats_twi],
        "max_twi": [round(s["max"], 2) if s["max"] is not None else 0.0 for s in stats_twi],
        "mean_slope_deg": [round(float(np.nanmean(slope_deg)), 2)] * len(villages)
    })
    df.to_csv(out_csv, index=False)
    print(f"[+] Exported Terrain Features Table: {out_csv}")
```

---

### Step 5: The Master Orchestrator (`gis/build_region.py`)

This is the single CLI entry point that reads the config, invokes each pipeline worker sequentially, and moves the final bundle to the backend regional registry:

```python
import argparse
import json
import shutil
from pathlib import Path
import osmnx as ox

from scripts.fetch_dem import download_dem
from scripts.fetch_osm import fetch_river_network, fetch_settlements_and_shelters
from scripts.process_terrain import compute_terrain_physics

def build_region(config_path: str):
    with open(config_path) as f:
        cfg = json.load(f)

    region_id = cfg["region_id"]
    print(f"\n==========================================")
    print(f" BUILDING REGION: {cfg['name']} ({region_id})")
    print(f"==========================================\n")

    out_dir = Path(f"gis/outputs/{region_id}")
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Fetch DEM
    dem_file = str(out_dir / "dem.tif")
    download_dem(cfg["bbox"], dem_file)

    # 2. Fetch River Network
    river_file = str(out_dir / "river.geojson")
    fetch_river_network(cfg["bbox"], cfg["river_query_names"], river_file)

    # 3. Fetch Settlements and Shelters
    villages_file = str(out_dir / "villages.geojson")
    shelters_file = str(out_dir / "shelters.geojson")
    fetch_settlements_and_shelters(
        cfg["bbox"], cfg["target_settlements"], cfg["shelter_query"], villages_file, shelters_file
    )

    # 4. Extract OSM Road Network
    print("[*] Downloading road network graph via OSMnx...")
    G = ox.graph_from_bbox(
        bbox=(cfg["bbox"]["north"], cfg["bbox"]["south"], cfg["bbox"]["east"], cfg["bbox"]["west"]),
        network_type="all"
    )
    roads_file = str(out_dir / "roads.graphml")
    ox.save_graphml(G, roads_file)
    print(f"[+] Saved Road Graph: {roads_file}")

    # 5. Process Terrain Physics (Slope, TWI)
    twi_file = str(out_dir / "twi.tif")
    csv_file = str(out_dir / "terrain_features.csv")
    compute_terrain_physics(dem_file, villages_file, twi_file, csv_file)

    # 6. Save Region Metadata Manifest
    with open(out_dir / "config.json", "w") as f:
        json.dump(cfg, f, indent=2)

    # 7. Publish to Backend Regional Data Store
    backend_target = Path(f"backend/data/regions/{region_id}")
    backend_target.mkdir(parents=True, exist_ok=True)
    for item in out_dir.iterdir():
        if item.is_file():
            shutil.copy(item, backend_target / item.name)

    print(f"\n[SUCCESS] Region '{region_id}' compiled and deployed to backend/data/regions/{region_id}/\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PRAVAH Regional Build Pipeline")
    parser.add_argument("--config", required=True, help="Path to regional JSON configuration")
    args = parser.parse_args()
    build_region(args.config)
```

---

### Execution Workflow

Compile your pilot and test regions with one command each:

```bash
conda activate expenv

# 1. Compile primary pilot: Mandakini Basin (Uttarakhand)
python gis/build_region.py --config gis/configs/mandakini.json

# 2. Compile secondary pilot: Beas Valley (Himachal Pradesh)
python gis/build_region.py --config gis/configs/beas_kullu.json
```

---

### What to Tell Judges During the Presentation

*   **Engineering Honesty:** Emphasize that you did not manually trace map layers. All geographic assets were ingested programmatically from satellite DEMs and OpenStreetMap APIs.
*   **True Scalability:** Open your terminal and show the evaluator:
    > *"To onboard a new vulnerable watershed in Sikkim or Himachal Pradesh, we don't rewrite code. We pass a new 20-line JSON configuration containing bounding coordinates and river tags into our automated pipeline, generating the complete hydrological model and routing graph in minutes."*