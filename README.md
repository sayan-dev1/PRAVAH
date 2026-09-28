```markdown
# PRAVAH — Predictive River & Valley Hazard Alert System

> **GIS-enabled flash-flood early warning and tactical evacuation platform for hilly regions**

PRAVAH is an integrated disaster-management platform designed to support **flash-flood monitoring, short-term hydrological nowcasting, flood-risk prediction, spatial impact assessment, and hazard-aware evacuation routing** in mountainous regions.

The system combines **real-time river telemetry, weather data, terrain-derived GIS features, machine learning, explainable AI, flood-hazard modelling, and dynamic road-network routing** into a unified operational dashboard.

Instead of stopping at *"a flood may happen"*, PRAVAH is designed to answer:

- Is the river condition changing rapidly?
- How severe is the current hydrological situation?
- What is the short-term flood risk?
- Which settlements may be affected?
- How much warning time may be available?
- Which roads are hazardous or blocked?
- Which shelters are reachable?
- What route should an operator consider for evacuation?
- Why did the ML model assign the current risk?
- Is the underlying data live, modelled, derived, GIS-based, or unavailable?

```

---

## Table of Contents

* [Problem Statement](#problem-statement)
* [Why PRAVAH](#why-pravah)
* [Key Capabilities](#key-capabilities)
* [System Architecture](#system-architecture)
* [Core Pipeline](#core-pipeline)
* [Dual-Horizon Prediction](#dual-horizon-prediction)
* [GIS & Terrain Intelligence](#gis--terrain-intelligence)
* [Flood Hazard Modelling](#flood-hazard-modelling)
* [Dynamic Evacuation Routing](#dynamic-evacuation-routing)
* [Machine Learning](#machine-learning)
* [Explainable AI](#explainable-ai)
* [Real-Time Telemetry](#real-time-telemetry)
* [Sensor & Data Quality](#sensor--data-quality)
* [Region Registry](#region-registry)
* [Data Provenance](#data-provenance)
* [Dashboard](#dashboard)
* [Supported Regions](#supported-regions)
* [Technology Stack](#technology-stack)
* [Project Structure](#project-structure)
* [Installation](#installation)
* [Configuration](#configuration)
* [Running the System](#running-the-system)
* [API Overview](#api-overview)
* [Data Requirements](#data-requirements)
* [Routing Pipeline](#routing-pipeline)
* [Model Inputs](#model-inputs)
* [Risk States](#risk-states)
* [Lead-Time Estimation](#lead-time-estimation)
* [Design Principles](#design-principles)
* [Limitations](#limitations)
* [Future Scope](#future-scope)
* [Team](#team)
* [Disclaimer](#disclaimer)
* [License](#license)

---

## Problem Statement

### Smart India Hackathon 2026 — Problem Statement 26192

**Flash Flood Prediction System for Hilly Regions using Multi-Source Data**

Flash floods in mountainous regions can develop rapidly due to intense rainfall, steep terrain, rapid runoff, river-level rise, landslides, debris flows, and drainage constraints.

Traditional warnings may indicate hazardous weather conditions, but an operational response system needs more than a rainfall forecast.

Emergency responders need spatially actionable information such as:

* current river conditions,
* rate of river-level rise,
* rainfall accumulation,
* terrain susceptibility,
* potentially inundated areas,
* exposed settlements,
* estimated warning/lead time,
* road hazards,
* reachable shelters,
* and evacuation routes.

PRAVAH integrates these components into a single command-oriented system.

---

## Why PRAVAH?

PRAVAH follows an **end-to-end decision-support pipeline**:

```text
DATA
 │
 ├── River Telemetry
 ├── Weather
 ├── DEM / Terrain
 ├── River Network
 └── Road Network
         │
         ▼
┌─────────────────────────┐
│ Data Validation &       │
│ Provenance              │
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│ Spatial & Hydrological  │
│ Processing              │
└────────────┬────────────┘
             ▼
      ┌──────┴──────┐
      ▼             ▼
┌────────────┐ ┌───────────────┐
│ 0–3h       │ │ 6–24h         │
│ Nowcast    │ │ ML Prediction │
└─────┬──────┘ └───────┬───────┘
      │                │
      └────────┬───────┘
               ▼
      ┌─────────────────┐
      │ Flood / Impact  │
      │ Assessment      │
      └────────┬────────┘
               ▼
      ┌─────────────────┐
      │ Hazard-Aware    │
      │ Routing         │
      └────────┬────────┘
               ▼
      ┌─────────────────┐
      │ Command Deck    │
      │ & Alerts        │
      └─────────────────┘

```

The system therefore connects:

> **Observation → Analysis → Prediction → Impact → Response**

---

## Key Capabilities

### 🌊 Hydrological Monitoring

* Real-time river-stage telemetry
* Rate of rise ($dh/dt$)
* Hydrological state classification
* Rainfall accumulation
* Hydrograph visualization
* Short-term river-rise nowcasting

### 🌧 Weather Intelligence

* Current precipitation
* Hourly precipitation
* 3-hour accumulation
* 6-hour accumulation
* 24-hour accumulation
* Soil moisture
* Weather-model data integration

### 🗺 GIS Intelligence

* River networks
* Settlements
* Shelters
* Roads
* Digital Elevation Model
* Slope
* Flow direction
* Flow accumulation
* Topographic Wetness Index (TWI)
* HAND-based flood analysis

### 🤖 Machine Learning

* XGBoost-based 6–24 hour risk prediction
* Region-specific GIS/weather features
* Model validation before inference
* TreeSHAP explanations

### 🚨 Flood Impact Assessment

* Potential inundation
* Flood depth
* Flood hazard
* Estimated arrival time
* Affected settlements
* Hazardous roads

### 🚗 Dynamic Evacuation Routing

* Real road-network graph
* Settlement-to-shelter routing
* Dijkstra / A* pathfinding
* Hazard-aware edge costs
* Hazardous/blocked road handling
* Multiple reachable shelter candidates
* GeoJSON route output

### 📡 Real-Time System

* FastAPI backend
* WebSocket telemetry
* Live dashboard updates
* Sensor health monitoring
* Data provenance
* Region-aware processing

---

## System Architecture

```text
                     ┌─────────────────────┐
                     │     DATA SOURCES    │
                     └──────────┬──────────┘
                                │
         ┌──────────────────────┼────────────────────────┐
         │                      │                        │
         ▼                      ▼                        ▼
    River Telemetry        Weather Data             GIS Data
    Water Level            Rainfall                 DEM
    Gauge Data             Soil Moisture            Rivers
                                                    Roads
                                                    Settlements
                                                    Shelters
         │                      │                        │
         └──────────────────────┼────────────────────────┘
                                ▼
                     ┌─────────────────────┐
                     │  DATA INGESTION     │
                     │  & VALIDATION       │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │ SPATIAL-HYDROLOGY   │
                     │ ENGINE              │
                     └──────────┬──────────┘
                                │
                    ┌───────────┴────────────────┐
                    │                            │
                    ▼                            ▼
             ┌──────────────────┐         ┌──────────────────┐
             │ 0–3h NOWCAST     │         │ 6–24h ML MODEL   │
             │                  │         │                  │
             │ River Stage      │         │ XGBoost          │
             │ dh/dt            │         │ Weather          │
             │ d²h/dt²*         │         │ Terrain          │
             │ Inundation       │         │ Catchment        │
             └────────┬─────────┘         └────────┬─────────┘
                      │                            │
                      │                     ┌──────┴───────┐
                      │                     │ SHAP         │
                      │                     │ Explanation  │
                      │                     └──────┬───────┘
                      │                            │
                      └──────────────┬─────────────┘
                                     ▼
                     ┌─────────────────────┐
                     │ RISK / IMPACT       │
                     │ FUSION              │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │ ROAD HAZARD ENGINE  │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │ DIJKSTRA / A*       │
                     │ EVACUATION ROUTER   │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │ REACT COMMAND DECK  │
                     │                     │
                     │ Map • Hydrology     │
                     │ Prediction • Impact │
                     │ Response • Data     │
                     └─────────────────────┘

```

** Used only when sufficient temporal data is available.*

---

## Core Pipeline

PRAVAH consists of several interconnected processing stages.

### Stage 1 — GIS Foundation

The system prepares:

* DEM
* River network
* Settlements
* Shelters
* Road network
* Gauges

Terrain derivatives are generated where available:

```text
DEM
 │
 ├── Elevation
 ├── Slope
 ├── Flow Direction
 ├── Flow Accumulation
 └── TWI

```

### Stage 2 — Flood Hazard Modelling

Terrain and hydrological information are combined to estimate:

* Potential inundation
* Flood depth
* Flood hazard
* Estimated arrival time

The system is designed around spatial flood impact, rather than treating the river as an isolated time series.

### Stage 3 — Hazard-Aware Routing

The road network is converted into a graph.

```text
OSM Road Network
       │
       ▼
Road Graph
       │
       ▼
Settlement / Shelter Snapping
       │
       ▼
Flood Hazard on Road Edges
       │
       ▼
Weighted Dijkstra / A*
       │
       ▼
Ordered Road Edges
       │
       ▼
GeoJSON Route
       │
       ▼
Leaflet Map

```

### Stage 4 — Dual-Horizon Prediction

PRAVAH separates immediate hydrological behaviour from longer-horizon ML prediction.

| 0–3 Hours | 6–24 Hours |
| --- | --- |
| Current river stage + Rate of rise + Hydrological response | Rainfall accumulation + Soil moisture + Terrain susceptibility |
| **Deterministic / physics-informed nowcast** | **XGBoost risk prediction + SHAP explanation** |

This separation prevents a machine-learning classifier from being treated as a replacement for immediate sensor-driven hydrological monitoring.

### Stage 5 — Tactical Response

The final output is not just a risk number. The system provides:

> Risk → Affected Area → Affected Settlements → Available Shelters → Road Hazards → Safe/Available Route → Estimated Travel Time → Operational Response

---

## Dual-Horizon Prediction

### 0–3 Hour Hydrological Nowcast

The immediate horizon primarily uses observed river behaviour.

The rate of river-level rise is calculated as:

$$\frac{dh}{dt} = \frac{h_t - h_{t-\Delta t}}{\Delta t}$$

where:

* $h_t$ = current river stage
* $h_{t-\Delta t}$ = previous river stage
* $\Delta t$ = observation interval

The resulting rate is used to characterize how quickly the river is changing.

The system can also use second-order change where sufficient observations exist:

$$\frac{d^2h}{dt^2}$$

This provides information about acceleration/deceleration of river-level change.

---

## GIS & Terrain Intelligence

PRAVAH uses GIS to transform raw geographical information into operational features.

### Digital Elevation Model (DEM)

The DEM acts as the foundation for terrain analysis. From the DEM, the system can derive:

* **Elevation**: Terrain height above reference surface.
* **Slope**: Terrain steepness contributing to spatial susceptibility.
* **Flow Direction**: Modeled direction of surface-water movement.
* **Flow Accumulation**: Modeled concentration of drainage across terrain.

### Topographic Wetness Index (TWI)

TWI is used as a terrain-based indicator of potential water accumulation:

$$TWI = \ln\left(\frac{a}{\tan\beta}\right)$$

where:

* $a$ = specific catchment area
* $\beta$ = local slope angle

---

## Flood Hazard Modelling

PRAVAH uses terrain and hydrological information to estimate spatial flood impact via the conceptual pipeline:

> DEM → Terrain derivatives / HAND → Water-level input → Estimated flood depth → Flood extent → Hazard classification → (Settlements, Roads, Infrastructure)

Flood outputs are treated as model-derived estimates, not direct observations.

---

## Dynamic Evacuation Routing

One of PRAVAH's key features is that evacuation routes are calculated from an actual road network.

### Road Graph

Each road segment becomes a graph edge containing:
`edge_id`, `from_node`, `to_node`, `geometry`, `length`, `road_type`, `speed`, `travel_time`, `hazard_status`, `flood_depth`, `routing_cost`.
The graph preserves road topology and one-way restrictions where available.

### Settlement and Shelter Snapping

A settlement and shelter are connected via network topology rather than straight lines:

> Settlement → Nearest valid road node/edge → Road Graph → Shelter road node/edge
> *Unreasonable snapping distances are rejected.*

### Hazard-Aware Routing

Roads are classified as:

* **OPEN**: Usable under current available information
* **HAZARDOUS**: Usable but affected by a modeled hazard
* **BLOCKED**: Explicitly unavailable
* **UNKNOWN**: Insufficient information

The routing engine increases the cost of hazardous edges and excludes explicitly blocked edges:

$$Cost = TravelTime + HazardPenalty$$

### Route Output

The backend returns the calculated route as GeoJSON, which the frontend renders on a Leaflet map. This maintains a single authoritative route source (**Backend → Calculation → GeoJSON → React/Leaflet**).

---

## Machine Learning

PRAVAH uses **XGBoost** for its longer-horizon risk prediction component, designed around weather, terrain, and catchment features.

### Current Feature Set

* `acc_3h_mm` (3-hour rainfall accumulation)
* `acc_6h_mm` (6-hour rainfall accumulation)
* `acc_24h_mm` (24-hour rainfall accumulation)
* `soil_moisture_pct` (Soil moisture percentage)
* `mean_twi` (Mean topographic wetness index)
* `mean_slope_deg` (Mean slope degrees)

---

## Explainable AI

PRAVAH integrates **SHAP / TreeSHAP** to explain XGBoost predictions. Instead of presenting only `Risk = HIGH`, the system exposes contributing features:

* Rainfall accumulation ↑ contribution
* Soil moisture ↑ contribution
* TWI ↑ contribution
* Slope ↓ contribution

---

## Real-Time Telemetry

The backend supports telemetry updates through WebSockets:

> River Gauge / Telemetry → FastAPI API → Validation / Sanity Filter → Hydrological Processing → Risk / State Update → WebSocket → React Command Deck

---

## Sensor & Data Quality

Real-time systems must account for faulty or delayed sensor data:

* **Stuck-Value Detection**: Detects sensors continuously reporting identical values when variation is expected.
* **Impossible-Jump Detection**: Flags physically implausible sudden changes.
* **Heartbeat / Watchdog**: Detects telemetry streams that have stopped communicating.

---

## Region Registry

PRAVAH is designed as a region-agnostic platform using registered data packages:

```text
REGION REGISTRY
        │
        ├── Region A ── GIS Package ┐
        ├── Region B ── GIS Package ┼──> Common PRAVAH Engine
        └── Region C ── GIS Package ┘

```

### Region Package Example

```json
{
  "region_id": "example_region",
  "name": "Example Mountain Basin",
  "state": "Example State",
  "district": "Example District",

  "layers": {
    "rivers": "rivers.geojson",
    "settlements": "settlements.geojson",
    "shelters": "shelters.geojson",
    "roads": "roads.geojson",
    "gauges": "gauges.geojson",

    "elevation": "elevation.tif",
    "slope": "slope.tif",
    "twi": "twi.tif",
    "flow_direction": "flow_direction.geojson",
    "hand": "hand.tif"
  },

  "hydro_calibration": {
    "watch_dh_dt_cm_min": null,
    "critical_dh_dt_cm_min": null,
    "wave_velocity_kmh": null,
    "upstream_gauge_distance_km": null
  },

  "status": "PARTIAL"
}

```

---

## Data Provenance

| Provenance | Meaning |
| --- | --- |
| **LIVE_OBSERVED** | Direct telemetry/observation |
| **MODEL_WEATHER** | Weather model / forecast data |
| **DERIVED** | Calculated from available data |
| **GIS** | Static geographical dataset |
| **ML_MODEL** | Machine-learning output |
| **SIMULATION** | Synthetic/demo data |
| **UNAVAILABLE** | Required information is unavailable |

---

## Dashboard

PRAVAH uses a command-oriented dashboard organized into operational sections:

* **Situation**: Region, risk state, data status, latest updates.
* **Map**: Basemap, river network, gauges, settlements, shelters, roads, flood layers, evacuation routes.
* **Hydrology**: Weather, river stage, rate of rise, hydrograph, rainfall accumulation.
* **Prediction**: 0–3 hour hydrological nowcast and 6–24 hour XGBoost predictions.

---

## Technology Stack

* **Backend**: Python, FastAPI, WebSockets, XGBoost, SHAP, GeoPandas, Rasterio, NetworkX.
* **Frontend**: React, Tailwind CSS, Leaflet / React-Leaflet.
* **Deployment & Ops**: Docker, Docker Compose, Nginx, AWS EC2.

---

## Project Structure

```text
pravah/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers and WebSockets
│   │   ├── core/         # Configuration and settings
│   │   ├── models/       # XGBoost & ML inference logic
│   │   ├── routing/      # Dijkstra / A* network router
│   │   ├── services/     # Hydrological & GIS processing
│   │   └── main.py       # Application entry point
│   ├── data/             # Region registries and geospatial assets
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # Dashboard and map UI
│   │   ├── services/     # API clients
│   │   └── App.jsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md

```

---

## Installation

Clone the repository and spin up the services using Docker Compose:

```bash
git clone [https://github.com/need-for-codes/pravah.git](https://github.com/need-for-codes/pravah.git)
cd pravah
docker-compose up --build

```

---

## Configuration

Environment variables can be configured via a `.env` file in the root directory:

```env
API_HOST=0.0.0.0
API_PORT=8000
DEFAULT_REGION=example_region
LOG_LEVEL=INFO

```

---

## Running the System

1. Start backend: `uvicorn backend.app.main:app --reload`
2. Start frontend: `npm run dev` (inside the frontend directory)
3. Access the Command Deck at `http://localhost:3000`

---

## API Overview

* `GET /api/v1/regions` — List all registered basin regions.
* `GET /api/v1/regions/{region_id}/status` — Fetch live telemetry and risk status.
* `POST /api/v1/routing/evacuate` — Compute hazard-aware evacuation routes.
* `WS /api/v1/ws/telemetry` — Live telemetry WebSocket feed.

---

## Design Principles

* **Transparency over Black-Boxes**: Explicit data provenance and explainable AI (SHAP) for every alert.
* **Operational First**: Built for emergency responders with focus on actionable evacuation paths over generic analytics.
* **Region-Agnostic**: Modular architecture adaptable to any mountainous river basin via standard GIS packages.

---

## Limitations

* Relies on continuous sensor telemetry uptime; missing upstream gauges default to fallback estimations.
* Flood extent models are DEM-resolution dependent.

---

## Future Scope

* Integration of real-time drone reconnaissance feeds.
* Automated multi-agency SMS/WhatsApp alert dispatching.

---

## Team

Developed by team **Need For Codes** for Smart India Hackathon 2026.

---

## Disclaimer

PRAVAH is a decision-support platform designed to assist emergency response planning. Final evacuation and tactical decisions remain the responsibility of authorized disaster management authorities.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

```

```
