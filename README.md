# PRAVAH - Predictive River & Valley Alert Hub

Real-time flash-flood monitoring, risk assessment, and evacuation coordination for the Mandakini watershed.

## Project layout

- `backend/` FastAPI core engine
- `frontend_new/` tactical command deck (replacement for `frontend_old/`)
- `gis/` geospatial data pipeline
- `ml/` vulnerability modeling work
- `docs/` project contracts and task guides
- `presentation/` pitch and submission materials

## Getting started

See `docs/project-context.md`, `docs/FRONTEND_TASK.md`, and `frontend-migration-context.txt` for the current scope and demo workflow.

## Local development

Use two PowerShell terminals from the repository root.

### Install dependencies

```powershell
corepack pnpm install --ignore-scripts
```

### Start the backend

In terminal 1:

```powershell
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

The backend is available at `http://localhost:8000`. Health check:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

### Start the frontend

In terminal 2:

```powershell
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

Open `http://localhost:4173/` in a browser. The frontend connects to the
backend REST API through `VITE_API_BASE_URL` and derives the websocket endpoint
as `ws://localhost:8000/ws/telemetry`. Set `VITE_FLASHSHIELD_WS_URL` explicitly
only when the websocket is hosted elsewhere.

### Validate the frontend

```powershell
$env:PORT='4173'
$env:BASE_PATH='/'
corepack pnpm --dir frontend_new typecheck
corepack pnpm --dir frontend_new build
```
