

# Project Context: FlashShield (SIH 2026)

## 1. Problem Statement & Background

* **Problem Statement ID:** 26192


* **Title:** Flash Flood Prediction System for Hilly Regions using Multi-Source Data Theme


* **Organization:** Ministry of Home Affairs (MHA)


* **Department:** National Disaster Response Force (NDRF), Disaster Management Division


* **Category & Theme:** Software | Disaster Management



### The Ground Reality

Hilly Himalayan catchments are prone to cloudbursts and sudden flash floods with warning times often under an hour. Traditional weather forecasting relies on broad, district-level radar and satellite models that fail to predict localized, high-velocity surges funneling down narrow river valleys. Upstream flash floods frequently submerge settlements and wash out roads before local disaster authorities can react.

**FlashShield** bridges this gap by merging digital elevation terrain physics, real-time river telemetry rates of rise, and automated tactical evacuation routing for field response units.

---

## 2. Study Area Anchor: Mandakini River Valley

To make the system realistic, concrete, and scientifically defensible, the prototype is strictly bounded to the **Mandakini River Basin (Rudraprayag District, Uttarakhand)** around coordinates `30.28° N, 78.98° E`.

### Target Settlements Monitored

1. **Tilwara (`VIL_TILWARA`)**: High-vulnerability settlement situated at a low river-bend contour (Population: ~1,840).
2. **Sumerpur (`VIL_SUMERPUR`)**: Intermediate valley settlement (Population: ~920).
3. **Rudraprayag Town (`VIL_RUDRAPRAYAG`)**: Downstream junction confluence (Population: ~5,400).

---

## 3. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              PRAVAH                                    │
│                                                                        │
│   [ Satellite / Weather ]       [ Copernicus 30m DEM ]      [ IoT ]    │
│      Precipitation mm/hr           Slope, TWI, Basins       Telemetry  │
│               │                             │                   │      │
│               └──────────────────────┬──────┴───────────────────┘      │
│                                      ▼                                 │
│                         ┌────────────────────────┐                     │
│                         │  CENTRAL FASTAPI CORE  │                     │
│                         │  • Rate-of-Rise (dh/dt)│                     │
│                         │  • Threshold Engine    │                     │
│                         │  • State Machine       │                     │
│                         └────────────┬───────────┘                     │
│                                      ▼                                 │
│                   ┌──────────────────┴──────────────────┐              │
│                   ▼                                     ▼              │
│       ┌───────────────────────┐             ┌───────────────────────┐  │
│       │  REACT COMMAND DECK   │             │   TACTICAL DISPATCH   │  │
│       │  • Mapbox / Leaflet   │             │  • Lead-Time Clock    │  │
│       │  • Choropleth Status  │             │  • Dynamic Safe Route │  │
│       │  • Live Gauge Streams │             │  • 2G / SMS Orders    │  │
│       └───────────────────────┘             └───────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘

```

---

## 4. The Two-Stage Roadmap

### Stage 1: Prototype Demo (Deadline: September 10, 2026)

* **Goal:** Clear the internal college shortlisting round with a working end-to-end prototype.
* **Scope:**
* Interactive dark-mode GIS map loaded with real Mandakini village polygons and river vectors.
* Simulated IoT telemetry streaming live via WebSockets.
* On-demand cloudburst surge injection triggering hydrodynamic rate-of-rise ($dh/dt$) thresholds.
* Instant state transition of Tilwara from `NORMAL` (Green) to `CRITICAL` (Red).
* Automated pop-up of the **NDRF Incident Order Modal** displaying a calculated 42-minute lead window and an uphill evacuation route to the designated shelter.



### Stage 2: Full System Expansion (Deadline: September 17–20, 2026)

* **Goal:** Finalize the production codebase and submit the official 6-slide PDF deck to the SIH portal.


* **Scope:**
* Topographic Wetness Index (TWI) and drainage matrix generated from raw 30m DEM rasters.
* Pre-trained XGBoost 6–24h macro-vulnerability classifier.
* SHAP explainability factor breakdown ("Why this risk?").
* Dynamic, risk-weighted Dijkstra evacuation routing using OpenStreetMap road network graphs.
* Hardware telemetry anomaly/sanity filters (stuck-value, impossible jumps, heartbeat watchdogs).



---

## 5. Team Structure & Work Distribution

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│       TECHNICAL ENGINE (BUILD)       │       │     OPERATIONS & RESEARCH (SHIP)     │
│                                      │       │                                      │
│ • System Architect & Backend Lead    │ ◄───► │ • Presentation & Deck Lead (M4)      │
│ • GIS & Hydrology Lead (T)           │       │ • Research & Benchmark Lead (M5)     │
│ • Frontend & Tactical UI Lead        │       │ • Pitch & Timekeeper Lead (M6)       │
└──────────────────────────────────────┘       └──────────────────────────────────────┘

```

* **System Architect & Backend Lead:** Owns FastAPI core, WebSocket feeds, threshold logic, API contract enforcement, and module integration.
* **GIS & Hydrology Lead (T):** Owns study area polygons, river geometries, shelter points, DEM topographic calculations, and road graphs.
* **Frontend & UI Lead:** Owns the React/Tailwind Command Deck, Mapbox/Leaflet rendering, real-time metric cards, and Incident Modal.
* **Presentation & Compliance Lead (Member 4):** Owns formatting, strict alignment to the official SIH 6-slide template, and PDF conversion.


* **Research & Domain Lead (Member 5):** Gathers real geographic elevation numbers, historical 2013 flood telemetry reference marks, and incident text.
* **Pitch & Rehearsal Lead (Member 6):** Scripts the 90-second live demonstration, times pitch runs, and coordinates panel defense.

---

## 6. Standardized Development Principle: Mock $\rightarrow$ Replace

No team member waits for another to finish their component before starting:

1. **Frontend** designs against `src/mockData.js` and dummy GeoJSON vectors from Day 1.
2. **GIS Lead** draws study polygons and exports standard GeoJSON files (`gis/outputs/`) directly consumable by Frontend and Backend.
3. **Backend Lead** provides mock JSON endpoints matching `docs/API.md` before wiring real business logic.
4. All three technical layers continuously integrate and replace mock layers without breaking interfaces.

---

## 7. The 90-Second Demo Script (September 10 Presentation)

1. **0:00 – 0:20 (The Problem):** Present the core limitation of existing systems—valley settlements have zero warning when cloudbursts happen miles upstream.
2. **0:20 – 0:40 (Baseline Operation):** Showcase the live Command Deck. Gauges show normal rainfall ($14\text{ mm/hr}$), river level ($110\text{ cm}$), and green village polygons.
3. **0:40 – 1:00 (The Surge Event):** Trigger `POST /api/simulate/cloudburst`. Upstream gauge rate of rise accelerates ($+0.4 \rightarrow +1.2 \rightarrow +3.8\text{ cm/min}$).
4. **1:00 – 1:20 (Actionable Response):** Threshold engine trips $dh/dt > 2.0\text{ cm/min}$. Tilwara instantly turns **RED**. The Incident Modal pops up displaying:
* *Lead Time:* $\sim 42\text{ minutes}$ to peak crest.
* *Muster Shelter:* High School Grounds via uphill corridor.
* *Action:* Sound valley alarm horn, deploy field unit.


5. **1:20 – 1:30 (Roadmap Defense):** Conclude by showing the post-shortlist expansion plan (integrating DEM physics, SHAP values, and risk-weighted graph routing) for the final SIH submission.