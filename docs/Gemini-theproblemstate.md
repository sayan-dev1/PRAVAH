# you asked

message time: 2026-09-09 22:43:24

No — **the problem statement itself is not limited to the Mandakini River.** Mandakini/Rudraprayag is **our chosen pilot study area**, not the geographic scope of the solution.

The official PS 26192 says the system should address **hilly states in India** and generate **hyper-local village/ward-level forecasts** using rainfall, soil moisture, slope stability, historical disaster data, and real-time IoT inputs. It does not specify Mandakini as the only target river. ([SIH 2026 Problem Statements][1])

### So think of PRAVAH as:

```text
                 PRAVAH
                    │
          ┌─────────┴─────────┐
          │                   │
     GENERAL SYSTEM       PILOT IMPLEMENTATION
          │                   │
   Hilly regions of India    Mandakini Valley
          │                   │
          │              Rudraprayag
          │                   │
          │          Tilwara / Sumerpur /
          │             Rudraprayag
          │
          ▼
   Can be adapted to:
   Uttarakhand
   Himachal Pradesh
   Sikkim
   Northeast hill regions
   other vulnerable
   mountainous areas
```

The problem statement specifically frames the challenge around **hilly states in India**, rather than one particular river. ([SIH 2026 Problem Statements][1])

### Why did we choose Mandakini?

Because you need a **specific geographic area to actually demonstrate the system**.

You can't realistically say:

> "Here's our flood prediction system for every mountain in India."

and then have no actual GIS layers, villages, river network, roads, terrain, or evacuation routes.

Instead:

> **PRAVAH is designed as a scalable framework for hilly regions, demonstrated initially on the Mandakini River Basin in Rudraprayag.**

That's a much stronger position.

### Think of Google Maps as an analogy

Google Maps isn't "only for Kolkata" because you demonstrate it in Kolkata.

Similarly:

**PRAVAH ≠ Mandakini-only system.**

Rather:

**PRAVAH = general architecture**

and

**Mandakini = first deployment/pilot area.**

---

## This actually gives you a strong presentation story

You can say:

> **"For the prototype, we selected the Mandakini River Valley in Rudraprayag as a representative Himalayan pilot region. The architecture is geography-agnostic: the same pipeline can be deployed to another hilly watershed by replacing the study-area GIS layers, sensor feeds, historical data and locally calibrated thresholds."**

That last part is important.

You shouldn't claim that you can simply upload any river and everything magically works. Different watersheds require **local calibration**.

For example:

```text
Mandakini
   ↓
local terrain
local river behaviour
local thresholds
local historical events
local roads
local shelters

        ↓

PRAVAH configuration
```

Then another region:

```text
Himachal watershed
   ↓
new DEM
new river
new villages
new historical data
new calibration

        ↓

same PRAVAH architecture
```

### In fact, this is why your specification says:

> **"Threshold boundaries ... are configurable engineering values for the valley prototype, requiring calibration against historical hydrographs for alternate river systems."**

That's exactly the right idea.

So **don't pitch PRAVAH as "a Mandakini flood system."**

Pitch it as:

> **"A scalable hyper-local flash-flood early-warning and evacuation platform for India's hilly regions, demonstrated through a Mandakini River Basin pilot."**

That's much closer to what **PS 26192 is actually asking for.** ([SIH 2026 Problem Statements][1])

[1]: https://sih2026.vuce.in/ps/SIH26192?utm_source=chatgpt.com "SIH26192 · Flash Flood Prediction System for Hilly Regions using Multi-Source Data Theme | SIH 2026 Problem Statements"


Keeping this in mind update.

---

# gemini response

# PRAVAH System Specification & Technical Documentation
**Predictive River & Valley Hazard Alert System**  
*Problem Statement ID:* 26192 | *Theme:* Disaster Management (NDRF / Ministry of Home Affairs)  
*System Scope:* Scalable, Hyper-Local Early Warning Architecture for Hilly States across India  
*Validation Anchor:* Pilot Implementation on the Mandakini River Basin (Rudraprayag District, Uttarakhand)

---

## 1. Executive Summary & Problem Scope

### The Pan-India Operational Problem
Mountainous catchments across India’s hilly states (e.g., Uttarakhand, Himachal Pradesh, Sikkim, and the Northeastern states) suffer from sudden, destructive flash floods and landslides with warning times frequently under an hour. Traditional regional forecasts rely on district-level meteorological radar that fails to capture localized hydrological funnels:
* **Spatial Blindness:** Coarse alerts covering entire administrative districts provide zero visibility into which specific micro-catchments or tributaries are experiencing surge runoff.
* **Hydrological Funneling:** Extreme precipitation strikes high-gradient headwaters, rapidly channeling downstream through narrow river valleys and striking settlements with minimal warning.
* **Action Deficit:** Conventional systems forecast hazards without calculating tactical evacuation measures, leaving local emergency units without safe, non-submerged transit corridors.

### The PRAVAH Solution
PRAVAH is a scalable, geography-agnostic early warning and tactical evacuation architecture designed for the National Disaster Response Force (NDRF) and District Emergency Operation Centres (DEOCs). It standardizes ingestion across heterogeneous multi-source feeds into a closed operational loop:

$$\text{Multi-Source Sensing} \longrightarrow \text{Validation Filtering} \longrightarrow \text{Rate-of-Rise Kinematics} \longrightarrow \text{Hyper-Local Risk Tiering} \longrightarrow \text{Tactical Evacuation Dispatch}$$

```
                PRAVAH GENERAL ARCHITECTURE
                             │
     ┌───────────────────────┴───────────────────────┐
     ▼                                               ▼
[ DATA INGESTION ENGINE ]               [ RUNTIME INTELLIGENCE ]
 • Regional DEM (30m GLO-30)             • Anomaly / Sanity Watchdogs
 • Multi-Model Precipitation             • Hydrodynamic dh/dt Engine
 • IoT Stream / Virtual Telemetry        • Regional Calibrated ML (XGBoost)
 • OSM Road & Shelter Graph              • Risk-Weighted Safe Dijkstra
     │                                               │
     └───────────────────────┬───────────────────────┘
                             ▼
               PILOT DEPLOYMENT: MANDAKINI BASIN
          (Rudraprayag District: Tilwara, Sumerpur)
                             │
                             ▼
         ADAPTABLE TO ANY HILLY WATERSHED VIA RE-CONFIG:
    (e.g., Beas Basin - HP, Teesta Basin - Sikkim, Barak - NE)
```

---

## 2. Technical System Architecture

PRAVAH decouples stream processing, hydrological rules, geospatial analysis, and tactical alerting into an extensible framework.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              MODULAR INGESTION FRAMEWORK                               │
│  Weather APIs (Open-Meteo)    Copernicus 30m DEM    Virtual IoT Feeds    OSM Networks  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  FASTAPI CORE ENGINE                                   │
│  ┌──────────────────────┐   ┌───────────────────────────┐   ┌────────────────────────┐ │
│  │   Telemetry Stream   │──►│   Anomaly / Sanity Filter │──►│   Hydro Rules Engine   │ │
│  │   (WebSocket / MQTT) │   │   (Stuck, Spike, Timeout) │   │   (dh/dt Acceleration) │ │
│  └──────────────────────┘   └───────────────────────────┘   └───────────┬────────────┘ │
│                                                                         ▼              │
│  ┌──────────────────────┐   ┌───────────────────────────┐   ┌────────────────────────┐ │
│  │ Explainability (XAI) │◄──│     Risk Fusion Core      │◄──│ Catchment GIS Features │ │
│  │ (SHAP Attribution)   │   │ (State Machine / XGBoost) │   │ (Slope, TWI via Zonal) │ │
│  └──────────────────────┘   └─────────────┬─────────────┘   └────────────────────────┘ │
└───────────────────────────────────────────┼────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              TACTICAL PRESENTATION LAYER                               │
│     Leaflet/Mapbox Command Deck      Risk-Aware Dijkstra Path     Low-Bandwidth SMS    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Ingestion & Stream Processing
* **Async Ingestion Loop:** Built with FastAPI and WebSockets, streaming sliding-window telemetry buffers every 2 seconds without blocking analytical workers.
* **Sensor Anomaly & Sanity Watchdogs:** Incoming gauge readings pass through `anomaly_filter.py` before triggering alert state machines to prevent false alarms:
  * *Stuck-Value Rejection:* Flags sensors as `FAULTY_STUCK` if variance $\sigma^2 < 0.1\text{ cm}$ over 20 consecutive cycles during rainfall.
  * *Transducer Spike Filter:* Discards transient errors where $|\Delta h| > 50\text{ cm}$ within a 2-second cycle.
  * *Heartbeat Watchdog:* Transitions sector state to `DATA_OFFLINE` if sensor packets cease for $> 15\text{ seconds}$.

---

## 3. Hydrological & Geospatial Principles

PRAVAH treats topography as the universal boundary condition governing run-off velocity and spatial convergence.

### Topography & Wetness Formulation
Raw 30-meter elevation models (Copernicus GLO-30 / SRTM) are pre-processed offline via sink-filling and drainage algorithms to calculate basin parameters:
1. **Slope Angle ($\beta$):** Measures terrain incline to identify fast overland run-off headwaters.
2. **D8 Flow Accumulation ($a$):** Calculates upstream catchment drainage area converging into valley bottoms.
3. **Topographic Wetness Index (TWI):** Quantifies steady-state topographic wetness:
   $$\text{TWI} = \ln\left(\frac{a}{\tan \beta}\right)$$
   *Scientific Clarification:* High TWI and low slope indicate run-off accumulation zones; they are morphological susceptibility indices, not standalone deterministic flood indicators.

### Rate-of-Rise ($\frac{dh}{dt}$) Kinematics
While water level indicates static depth, rate-of-rise acceleration identifies fast-developing flash waves. The hydrodynamic rules engine samples sliding-window river levels ($h$) to compute instantaneous surge velocity:

$$\frac{dh}{dt} = \frac{h_t - h_{t-1}}{\Delta t}$$

*Configurable Pilot Operational Thresholds:*
* $\frac{dh}{dt} < 1.0\text{ cm/min} \implies$ **NORMAL (Green)**
* $1.0 \le \frac{dh}{dt} < 2.0\text{ cm/min} \implies$ **WATCH (Yellow)**
* $\frac{dh}{dt} \ge 2.0\text{ cm/min} \implies$ **CRITICAL (Red)**

*Portability Note:* These thresholds are pilot-calibrated engineering values for the Mandakini demo. When deploying PRAVAH to another river basin, these values must be configured against local historical hydrographs.

### Surge Travel-Time Estimation
Estimated arrival time is derived from upstream gauge distance and flow velocity across calibrated channel reaches:

$$T_{\text{est}} = \frac{D_{\text{upstream}}}{V_{\text{wave}}}$$

For the Mandakini pilot ($D = 8.4\text{ km}$, estimated wave velocity $V \approx 3.5 - 4.5\text{ km/h}$), the calculated operational warning window spans **42 to 48 minutes** before peak crest reaches Tilwara.

---

## 4. Risk-Aware Evacuation Routing Engine

Standard shortest-path routing (pure road length) fails during flash surges because valley-floor paths often cross low-lying bridges or run adjacent to rising riverbeds.

```
       [ Submerged Riverbank Road ] (Distance: 1.2 km, Hazard: CRITICAL, Cost: ∞) ──► BLOCKED
      /
[ Village ]
      \
       [ Higher-Elevation Ridge Road ] (Distance: 1.8 km, Hazard: LOW, Cost: 1.8 km) ──► SELECTED
```

### Dynamic Hazard Cost Weighting
The road network extracted via OSMnx is modeled as a directed graph $G = (V, E)$. Each road segment receives a dynamic routing cost based on physical length and spatial hazard exposure:

$$\text{Cost}_e = \text{Length}_e \times \text{Hazard Multiplier}_e$$

* **Low-Risk Edge (Upland / Low TWI):** Multiplier $= 1.0$
* **Watch Buffer Edge (Medium TWI / Floodplain Margin):** Multiplier $= 5.0$
* **Critical Edge (Submerged / River Proximity $< 50\text{ m}$):** Multiplier $= \infty$ (Edge Severed)

Dijkstra’s algorithm traverses graph $G$ using $\text{Cost}_e$, returning the shortest viable route that steers around high-hazard choke points to designated high-ground shelters.

---

## 5. Machine Learning & Explainability (Post-Shortlist Target)

### Dual-Horizon Model Framework
* **0–3 Hour Tactical Nowcasting:** Driven by the deterministic hydrodynamic rate-of-rise rules engine.
* **6–24 Hour Regional Vulnerability:** Powered by an XGBoost classification model (`xgboost_watershed_risk.json`).
  * *Training Target:* Binary flood probability $P(\text{Flood Event} \mid X) \in [0, 1]$, mapped into operational risk tiers via isotonic calibration.
  * *Feature Vector ($X$):* Rolling 3h/6h/24h precipitation, antecedent soil moisture, mean sub-basin TWI, mean catchment slope, and historical disaster inventory markers.

### Model Transparency with SHAP
To ensure incident commanders understand why an automated alert was raised, PRAVAH incorporates TreeSHAP to extract localized feature contributions:

$$\sum_{i=1}^M \phi_i = f(x) - E[f(x)]$$

```json
{
  "village_id": "VIL_TILWARA",
  "risk_tier": "CRITICAL",
  "calibrated_probability": 0.91,
  "shap_factors": [
    { "feature": "rate_of_rise_cm_min", "impact_weight": "+0.34", "reading": "3.8 cm/min" },
    { "feature": "antecedent_soil_moisture", "impact_weight": "+0.28", "reading": "88%" },
    { "feature": "3h_accumulated_rainfall", "impact_weight": "+0.21", "reading": "75 mm/hr" },
    { "feature": "topographic_wetness_index", "impact_weight": "+0.17", "reading": "14.2 (High Convergence)" }
  ]
}
```

---

## 6. Watershed Adaptability & Multi-Region Onboarding

PRAVAH is designed to be location-agnostic. Deploying the platform to a new watershed (e.g., Beas River in Himachal Pradesh or Teesta River in Sikkim) requires re-configuring data assets without altering the core codebase:

| Step | Asset / Pipeline | Configuration Action |
| :--- | :--- | :--- |
| **1. Boundary Ingestion** | Bounding Box & Administrative Layers | Ingest localized village/ward boundary polygons and river traces into `gis/outputs/`. |
| **2. Terrain Physics** | Regional DEM GeoTIFF | Process Copernicus 30m raster for the new coordinates to extract local Slope and TWI tables. |
| **3. Road Network** | OSMnx Road Graph | Download the bounding box road graph (`.graphml`) and map local high-ground shelter points. |
| **4. Threshold Tuning** | `hydro_rules.py` | Calibrate $\frac{dh}{dt}$ limits, river sensor reaches, and flow propagation velocity based on local historical hydrographs. |
| **5. Model Retraining** | `ml/training_data/` | Fine-tune XGBoost weights using regional landslide/flood inventories and local historical rain records. |

---

## 7. Implementation & Phased Roadmap

| Functional Module | Milestone 1: College Demo (Sept 10, 2026) | Milestone 2: SIH Final Deck (Sept 17–20, 2026) |
| :--- | :--- | :--- |
| **Telemetry Pipeline** | WebSocket broadcasting simulated gauge data every 2s | External weather API feeds + telemetry anomaly filters |
| **Risk Engine** | Deterministic $\frac{dh}{dt}$ hydrodynamic rules engine | Calibrated XGBoost risk classifier + SHAP factor API |
| **Geospatial Scope** | Mandakini Valley GeoJSON layers (3 villages, river trace) | Copernicus 30m DEM TWI processing via `richdem` |
| **Evacuation Routing** | Verified static uphill path (`evac_route_tilwara.geojson`) | Dynamic risk-weighted Dijkstra on OSM road graphs |
| **Incident Interface** | Incident order modal with calculated lead-time clock | Low-bandwidth SMS alert format for 2G networks |

---

## 8. Operational Incident Workflow (The 90-Second Pitch)

1. **Phase 1: General Concept & Pilot Scope ($0:00 - 0:25$)**
   * Introduce PRAVAH as a scalable early warning architecture for India's hilly states, demonstrated via the Mandakini River Basin pilot.
   * The live map displays baseline readings: Rainfall $14\text{ mm/hr}$, water depth $110\text{ cm}$, $\frac{dh}{dt} = +0.2\text{ cm/min}$. All monitored settlements show **NORMAL (Green)**.
2. **Phase 2: Injected Surge Event ($0:25 - 0:45$)**
   * Trigger `POST /api/simulate/cloudburst`.
   * The upstream gauge accelerates over the WebSocket: rainfall spikes to $75\text{ mm/hr}$, river depth spikes $(110 \rightarrow 135 \rightarrow 164\text{ cm})$, and $\frac{dh}{dt}$ jumps to $+3.8\text{ cm/min}$.
3. **Phase 3: Automated Escalation & Tactical Dispatch ($0:45 - 1:15$)**
   * The hydro rules engine trips the threshold ($\frac{dh}{dt} \ge 2.0\text{ cm/min}$).
   * Settlement `VIL_TILWARA` transitions automatically: **NORMAL $\rightarrow$ WATCH $\rightarrow$ CRITICAL (Red)**.
   * The **NDRF Tactical Incident Order Modal** pops up with actionable directives:
     * *Severity:* CRITICAL FLASH SURGE DETECTED
     * *Population at Risk:* 1,840 residents
     * *Estimated Lead Time:* ~42 Minutes
     * *Evacuation Directive:* Evacuate via High Road corridor to Government Inter College Grounds (Shelter 01).
   * The safe, non-submerged evacuation corridor renders directly on the map.
4. **Phase 4: Scalability & Defense ($1:15 - 1:30$)**
   * Conclude by reiterating system scalability: the identical software pipeline can be deployed to any mountain catchment across Himachal Pradesh, Sikkim, or Jammu & Kashmir by updating the regional terrain rasters and local sensor calibrations.