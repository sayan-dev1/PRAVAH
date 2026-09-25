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

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Why PRAVAH](#why-pravah)
- [Key Capabilities](#key-capabilities)
- [System Architecture](#system-architecture)
- [Core Pipeline](#core-pipeline)
- [Dual-Horizon Prediction](#dual-horizon-prediction)
- [GIS & Terrain Intelligence](#gis--terrain-intelligence)
- [Flood Hazard Modelling](#flood-hazard-modelling)
- [Dynamic Evacuation Routing](#dynamic-evacuation-routing)
- [Machine Learning](#machine-learning)
- [Explainable AI](#explainable-ai)
- [Real-Time Telemetry](#real-time-telemetry)
- [Sensor & Data Quality](#sensor--data-quality)
- [Region Registry](#region-registry)
- [Data Provenance](#data-provenance)
- [Dashboard](#dashboard)
- [Supported Regions](#supported-regions)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the System](#running-the-system)
- [API Overview](#api-overview)
- [Data Requirements](#data-requirements)
- [Routing Pipeline](#routing-pipeline)
- [Model Inputs](#model-inputs)
- [Risk States](#risk-states)
- [Lead-Time Estimation](#lead-time-estimation)
- [Design Principles](#design-principles)
- [Limitations](#limitations)
- [Future Scope](#future-scope)
- [Team](#team)
- [Disclaimer](#disclaimer)
- [License](#license)

---

# Problem Statement

### Smart India Hackathon 2026 — Problem Statement 26192

**Flash Flood Prediction System for Hilly Regions using Multi-Source Data**

Flash floods in mountainous regions can develop rapidly due to intense rainfall, steep terrain, rapid runoff, river-level rise, landslides, debris flows, and drainage constraints.

Traditional warnings may indicate hazardous weather conditions, but an operational response system needs more than a rainfall forecast.

Emergency responders need spatially actionable information such as:

- current river conditions,
- rate of river-level rise,
- rainfall accumulation,
- terrain susceptibility,
- potentially inundated areas,
- exposed settlements,
- estimated warning/lead time,
- road hazards,
- reachable shelters,
- and evacuation routes.

PRAVAH integrates these components into a single command-oriented system.

---

# Why PRAVAH?

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

The system therefore connects:

Observation → Analysis → Prediction → Impact → Response


---

Key Capabilities

🌊 Hydrological Monitoring

Real-time river-stage telemetry

Rate of rise (dh/dt)

Hydrological state classification

Rainfall accumulation

Hydrograph visualization

Short-term river-rise nowcasting


🌧 Weather Intelligence

Current precipitation

Hourly precipitation

3-hour accumulation

6-hour accumulation

24-hour accumulation

Soil moisture

Weather-model data integration


🗺 GIS Intelligence

River networks

Settlements

Shelters

Roads

Digital Elevation Model

Slope

Flow direction

Flow accumulation

Topographic Wetness Index

HAND-based flood analysis


🤖 Machine Learning

XGBoost-based 6–24 hour risk prediction

Region-specific GIS/weather features

Model validation before inference

TreeSHAP explanations


🚨 Flood Impact Assessment

Potential inundation

Flood depth

Flood hazard

Estimated arrival time

Affected settlements

Hazardous roads


🚗 Dynamic Evacuation Routing

Real road-network graph

Settlement-to-shelter routing

Dijkstra/A* pathfinding

Hazard-aware edge costs

Hazardous/blocked road handling

Multiple reachable shelter candidates

GeoJSON route output


📡 Real-Time System

FastAPI backend

WebSocket telemetry

Live dashboard updates

Sensor health monitoring

Data provenance

Region-aware processing



---

System Architecture

┌─────────────────────┐
                         │     DATA SOURCES    │
                         └──────────┬──────────┘
                                    │
          ┌─────────────────────────┼────────────────────────┐
          │                         │                        │
          ▼                         ▼                        ▼
   River Telemetry             Weather Data             GIS Data
   Water Level                 Rainfall                  DEM
   Gauge Data                  Soil Moisture             Rivers
                                                          Roads
                                                          Settlements
                                                          Shelters
          │                         │                        │
          └─────────────────────────┼────────────────────────┘
                                    ▼
                         ┌─────────────────────┐
                         │ DATA INGESTION      │
                         │ & VALIDATION        │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ SPATIAL-HYDROLOGY   │
                         │ ENGINE              │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
                    ▼                                ▼
          ┌──────────────────┐             ┌──────────────────┐
          │ 0–3h NOWCAST     │             │ 6–24h ML MODEL   │
          │                  │             │                  │
          │ River Stage      │             │ XGBoost          │
          │ dh/dt            │             │ Weather          │
          │ d²h/dt²*         │             │ Terrain          │
          │ Inundation       │             │ Catchment        │
          └────────┬─────────┘             └────────┬─────────┘
                   │                                │
                   │                         ┌──────▼───────┐
                   │                         │ SHAP         │
                   │                         │ Explanation  │
                   │                         └──────┬───────┘
                   │                                │
                   └──────────────┬─────────────────┘
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

* Used only when sufficient temporal data is available.


---

Core Pipeline

PRAVAH consists of several interconnected processing stages.

Stage 1 — GIS Foundation

The system prepares:

DEM

river network

settlements

shelters

road network

gauges


Terrain derivatives are generated where available:

DEM
 │
 ├── Elevation
 ├── Slope
 ├── Flow Direction
 ├── Flow Accumulation
 └── TWI


---

Stage 2 — Flood Hazard Modelling

Terrain and hydrological information are combined to estimate:

potential inundation

flood depth

flood hazard

estimated arrival time


The system is designed around spatial flood impact, rather than treating the river as an isolated time series.


---

Stage 3 — Hazard-Aware Routing

The road network is converted into a graph.

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


---

Stage 4 — Dual-Horizon Prediction

PRAVAH separates immediate hydrological behaviour from longer-horizon ML prediction.

0–3 HOURS
────────────
Current river state
      +
Rate of rise
      +
Hydrological response
      ↓
Deterministic / physics-informed nowcast


6–24 HOURS
────────────
Rainfall accumulation
      +
Soil moisture
      +
Terrain susceptibility
      ↓
XGBoost risk prediction
      +
SHAP explanation

This separation prevents a machine-learning classifier from being treated as a replacement for immediate sensor-driven hydrological monitoring.


---

Stage 5 — Tactical Response

The final output is not just a risk number.

The system provides:

Risk
 ↓
Affected Area
 ↓
Affected Settlements
 ↓
Available Shelters
 ↓
Road Hazards
 ↓
Safe/Available Route
 ↓
Estimated Travel Time
 ↓
Operational Response


---

Dual-Horizon Prediction

0–3 Hour Hydrological Nowcast

The immediate horizon primarily uses observed river behaviour.

The rate of river-level rise is calculated as:

\[
\frac{dh}{dt} =
\frac{h_t-h_{t-\Delta t}}{\Delta t}
\]

where:

h_t = current river stage

h_(t-Δt) = previous river stage

Δt = observation interval


The resulting rate is used to characterize how quickly the river is changing.

The system can also use second-order change where sufficient observations exist:

\[
\frac{d^2h}{dt^2}
\]

This provides information about acceleration/deceleration of river-level change.


---

GIS & Terrain Intelligence

PRAVAH uses GIS to transform raw geographical information into operational features.

Digital Elevation Model

The DEM acts as the foundation for terrain analysis.

From the DEM, the system can derive:

Elevation

Represents terrain height above the reference surface.

Slope

Represents terrain steepness and contributes to spatial susceptibility analysis.

Flow Direction

Represents the modeled direction of surface-water movement.

Flow Accumulation

Represents the modeled concentration of drainage across the terrain.

Topographic Wetness Index

TWI is used as a terrain-based indicator of potential water accumulation.

A common formulation is:

\[
TWI = \ln\left(\frac{a}{\tan\beta}\right)
\]

where:

a = specific catchment area

β = local slope angle



---

Flood Hazard Modelling

PRAVAH uses terrain and hydrological information to estimate spatial flood impact.

The intended conceptual pipeline is:

DEM
 │
 ├── Terrain derivatives
 │
 └── HAND / relative elevation
          │
          ▼
     Water-level input
          │
          ▼
     Estimated flood depth
          │
          ▼
     Flood extent
          │
          ▼
     Hazard classification
          │
          ├── Settlements
          ├── Roads
          └── Infrastructure

Flood outputs are treated as model-derived estimates, not direct observations.


---

Dynamic Evacuation Routing

One of PRAVAH's key features is that evacuation routes are calculated from an actual road network.

Road Graph

Each road segment becomes a graph edge containing information such as:

edge_id
from_node
to_node
geometry
length
road_type
speed
travel_time
hazard_status
flood_depth
routing_cost

The graph preserves road topology and, where available, one-way restrictions.


---

Settlement and Shelter Snapping

A settlement and shelter are not connected with a straight line.

Instead:

Settlement
    │
    ▼
Nearest valid road node/edge
    │
    ▼
Road Graph
    │
    ▼
Shelter road node/edge

Unreasonable snapping distances are rejected.


---

Hazard-Aware Routing

Roads may be classified as:

Status	Meaning

OPEN	Usable under current available information
HAZARDOUS	Usable but affected by a modeled hazard
BLOCKED	Explicitly unavailable
UNKNOWN	Insufficient information


The routing engine can increase the cost of hazardous edges and exclude explicitly blocked edges.

Conceptually:

\[
Cost = TravelTime + HazardPenalty
\]

Blocked roads are excluded from routing.

Unknown road conditions are explicitly represented rather than silently treated as safe.


---

Route Output

The backend returns the calculated route as GeoJSON.

The frontend then renders the backend-generated geometry.

This maintains a single authoritative route source:

Backend
   ↓
Route Calculation
   ↓
GeoJSON
   ↓
React / Leaflet

The frontend does not generate independent evacuation routes.


---

Machine Learning

PRAVAH uses XGBoost for its longer-horizon risk prediction component.

The model is designed around weather, terrain and catchment-related features.

Current Feature Set

acc_3h_mm
acc_6h_mm
acc_24h_mm
soil_moisture_pct
mean_twi
mean_slope_deg

Feature Categories

Category	Features

Rainfall	3h / 6h / 24h accumulation
Soil	Soil moisture
Terrain	Mean TWI
Terrain	Mean slope


The model output is intended for the 6–24 hour prediction horizon and should not be interpreted as a direct deterministic prediction of river stage.


---

Explainable AI

PRAVAH integrates SHAP / TreeSHAP to explain the XGBoost prediction.

Instead of presenting only:

Risk = HIGH

the system can expose contributing features such as:

Rainfall accumulation     ↑ contribution
Soil moisture             ↑ contribution
TWI                       ↑ contribution
Slope                     ↓ contribution

The purpose is to provide model transparency and help an operator understand which input features contributed to the prediction.

SHAP explanations describe model behaviour; they should not be interpreted as proof of physical causation.


---

Real-Time Telemetry

The backend supports telemetry updates through WebSockets.

Conceptually:

River Gauge / Telemetry
          │
          ▼
     FastAPI API
          │
          ▼
Validation / Sanity Filter
          │
          ▼
Hydrological Processing
          │
          ▼
Risk / State Update
          │
          ▼
      WebSocket
          │
          ▼
 React Command Deck

This allows the dashboard to update as new telemetry arrives instead of relying entirely on page refreshes.


---

Sensor & Data Quality

Real-time systems must account for faulty or delayed sensor data.

PRAVAH therefore separates:

Stuck-Value Detection

Detects sensors that continuously report the same value when variation is expected.

Impossible-Jump Detection

Flags physically implausible sudden changes.

Heartbeat / Watchdog

Detects telemetry streams that have stopped communicating.

These checks are kept separate from packet ingestion so that a delayed or recovered packet can still be processed appropriately.


---

Region Registry

PRAVAH is designed as a region-agnostic platform.

Instead of writing separate application logic for every river basin, each region is represented by a registered data package.

REGION REGISTRY
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
    Region A        Region B        Region C
       │               │               │
       ▼               ▼               ▼
   GIS Package     GIS Package     GIS Package
       │               │               │
       └───────────────┼───────────────┘
                       ▼
                Common PRAVAH Engine

The same backend can therefore provision:

maps

hydrology

flood modelling

ML inputs

routing


from the selected region package.


---

Region Package

A region can contain a manifest describing its available assets.

Example:

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

Required and optional assets are validated during region loading.

Missing datasets are represented as:

UNAVAILABLE

rather than fabricated values.


---

Data Provenance

PRAVAH distinguishes different types of information.

Provenance	Meaning

LIVE_OBSERVED	Direct telemetry/observation
MODEL_WEATHER	Weather model / forecast data
DERIVED	Calculated from available data
GIS	Static geographical dataset
ML_MODEL	Machine-learning output
SIMULATION	Synthetic/demo data
UNAVAILABLE	Required information is unavailable


This distinction is particularly important in disaster-management software because a modeled estimate must not be presented as a physical observation.


---

Dashboard

PRAVAH uses a command-oriented dashboard rather than a conventional analytics page.

The dashboard is organized into operational sections.

Situation

Displays:

selected region

current risk state

data status

latest update

reason for current alert/state



---

Map

Provides:

tactical basemap

river network

gauges

settlements

shelters

roads

flood layers

terrain layers

evacuation routes



---

Hydrology

Displays:

current weather

river stage

rate of rise

hydrograph

rainfall accumulation

soil/catchment indicators

hourly weather



---

Prediction

Displays:

0–3 hour hydrological nowcast

6–24 hour XGBoost p