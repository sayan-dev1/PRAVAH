# GIS Task

Prepare the Mandakini study-area vector layers and publish clean artifacts under `gis/outputs/` for backend and frontend consumption.




---

### Task Specification: GIS, Hydrology & Geospatial Pipeline Lead 

**Role:** GIS, Hydrology & Geospatial Data Engineer

**Objective:** Deliver clean, geographically accurate geospatial layers and terrain attributes for the **Mandakini River Basin (Rudraprayag District, Uttarakhand)** to power both the tactical frontend map and backend risk engine.

---

#### Milestone 1: College Demo Deliverables 

*Focus: Clean vector datasets that B (Frontend) and You (Backend) can immediately consume without waiting for heavy raster calculations.*

* **Task 1.1: Study Bounding Box & Administrative Polygons**
* **Area of Interest (AOI):** Mandakini River Valley, centered around coordinates `30.28° N, 78.98° E`.
* Create `gis/outputs/villages.geojson` containing **3 distinct village/settlement polygons**:
* `VIL_TILWARA` (Tilwara)
* `VIL_SUMERPUR` (Sumerpur)
* `VIL_RUDRAPRAYAG` (Rudraprayag Town)


* **Required GeoJSON Property Schema:**
```json
{
  "type": "Feature",
  "properties": {
    "village_id": "VIL_TILWARA",
    "name": "Tilwara",
    "population": 1840,
    "center_lat": 30.3522,
    "center_lon": 78.9634
  },
  "geometry": { "type": "Polygon", "coordinates": [...] }
}

```




* **Task 1.2: River Centerline & Safe Shelter Points**
* Extract/trace the Mandakini river path into `gis/outputs/river_mandakini.geojson` (LineString geometry).
* Mark 2–3 high-ground evacuation shelters in `gis/outputs/shelters.geojson` (Point geometries):
* `SHELTER_01`: "Government Inter College Grounds, Tilwara" (located well above the riverbed contour).
* `SHELTER_02`: "Rudraprayag Stadium Ground".




* **Task 1.3: Static Route Stub for Demo**
* Generate `gis/outputs/evac_route_tilwara.geojson` representing a clear, realistic road path from Tilwara village center uphill to `SHELTER_01`.
* *Action:* Push all GeoJSON files directly to `gis/outputs/` and notify Frontend builder so they can render them on Leaflet/Mapbox.



---

#### Milestone 2: Post-Demo System Expansion 

*Focus: Deep topographic physics, DEM processing, and dynamic road graph networks for the final SIH submission.*

* **Task 2.1: DEM Acquisition & Topographic Indices**
* Download the **Copernicus 30m GLO-30 DEM** GeoTIFF covering the Rudraprayag catchment tile from OpenTopography or USGS EarthExplorer.
* Store raw rasters under `gis/raw/dem_rudraprayag_30m.tif`.
* Write a Python pipeline using `rasterio` and `richdem` (`gis/src/process_terrain.py`) to compute:
1. **Slope Gradient Matrix ($\beta$):** Identifies steep runoff inclines.
2. **Flow Direction & Flow Accumulation Matrix ($a$):** Identifies natural drainage pathways.
3. **Topographic Wetness Index (TWI):**

$$\text{TWI} = \ln\left(\frac{a}{\tan\beta}\right)$$




* Export a normalized summary table `gis/outputs/village_terrain_features.csv` with mean slope and average TWI per village polygon to supply features to the backend ML model.


* **Task 2.2: Road Network Graph Extraction**
* Use `osmnx` to download the drivable/walkable road network for the bounding box:
```python
import osmnx as ox
G = ox.graph_from_bbox(north=30.42, south=30.25, east=79.05, west=78.92, network_type="all")
ox.save_graphml(G, "gis/outputs/rudraprayag_roads.graphml")

```


* Map which road segments fall within the high-TWI or flood-prone buffer zone (within 50 meters of the river centerline).
* Deliver `rudraprayag_roads.graphml` to the backend lead for risk-weighted Dijkstra edge cost calculations.



---

#### Verification & Quality Checklist

* [ ] All coordinates must use standard **WGS84 (`EPSG:4326`)** projection.
* [ ] GeoJSON files validated on [geojson.io](https://geojson.io) before committing.
* [ ] File sizes for vector files must be compact ($<2\text{ MB}$) for smooth frontend rendering.
* [ ] Python scripts must include a `requirements.txt` (`geopandas`, `rasterio`, `shapely`, `osmnx`, `richdem`).