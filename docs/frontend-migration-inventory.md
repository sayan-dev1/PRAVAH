# Frontend Migration Inventory

| Source | Destination | Purpose | Disposition | Dependencies / validation |
| --- | --- | --- | --- | --- |
| `frontend_old/src/App.tsx` | `frontend_new/src/App.tsx` | Command deck layout, routes, interactions | Compared; destination UI retained and updated for backend error/loading state | `flashshield-api.ts`, Leaflet; frontend typecheck/build |
| `frontend_old/src/lib/flashshield-api.ts` | `frontend_new/src/lib/flashshield-api.ts` | Frontend data and websocket boundary | Replaced mock implementations with REST/websocket mappings | FastAPI routes below; typecheck, live API smoke check |
| `frontend_old/src/components/` | `frontend_new/src/components/` | Reusable UI and map components | Destination component set retained; no unrelated overwrite | React, Radix, Leaflet; build and responsive smoke check |
| `frontend_old/package.json` | `frontend_new/package.json` | Frontend package metadata | Excluded; destination package already contains required React, Vite, Tailwind, Leaflet, and shared-client dependencies | `pnpm install`, typecheck, build |
| `frontend_old/` | `frontend_old/` | Original frontend source for comparison/rollback | Retained; no runtime workspace ownership | Not included in `pnpm-workspace.yaml` |
| `backend/app/api/routes/*.py` | `backend/app/api/routes/*.py` | Target REST and websocket API | Retained; inspected, not duplicated into frontend | Backend tests, `/health`, route smoke checks |
| `backend/app/models/*.py` | `backend/app/models/*.py` | Pydantic response contracts | Retained; frontend adapter maps snake_case contracts | Backend tests and frontend typecheck |
| `backend/app/services/*.py` | `backend/app/services/*.py` | Stream, risk, and GIS routing logic | Retained; no frontend copy | Backend tests and startup check |
| `backend/data/*.geojson` | `backend/data/*.geojson` | Runtime GIS layers and evacuation data | Retained under backend ownership; frontend requests API endpoints | `/api/geojson/{layer_name}` and evacuation route checks |
| `gis/outputs/*` | `gis/outputs/*` | Terrain, road graph, and generated study outputs | Retained; backend services consume them; not copied to frontend | Routing/inference tests |
| `shared/api-client-react/*` | `shared/api-client-react/*` | Existing generated API client | Inspected; not used because its generated contract does not cover the PRAVAH routes | Revisit when OpenAPI is regenerated |
| `shared/api-zod/*`, `shared/api-spec/*` | Same paths | Shared schemas/OpenAPI | Retained; no duplicate frontend types added | Shared package typecheck |
| `pnpm-workspace.yaml` | Same path | Workspace ownership | Updated from obsolete `frontend` to `frontend_new` | Lockfile regeneration and install |
| `pnpm-lock.yaml` | Same path | Dependency resolution | Regenerated, not hand-copied | `pnpm install --ignore-scripts` |
| `README.md` | Same path | Setup and runtime documentation | Updated for `frontend_new`, backend port, API and websocket variables | Documentation review |

## Runtime contract

- REST base: `VITE_API_BASE_URL` (for example `http://localhost:8000`). Empty means same-origin.
- Websocket: `VITE_FLASHSHIELD_WS_URL`; when absent, the frontend derives `/ws/telemetry` from the REST base URL.
- REST endpoints used: `GET /api/telemetry`, `GET /api/villages`, `GET /api/villages/{VIL_ID}`, `GET /api/risk/detailed/{VIL_ID}`, `GET /api/evacuation/{VIL_ID}`, `POST /api/simulate/cloudburst`, and `POST /api/simulate/reset`.
- GIS layers remain backend-owned and are exposed through `GET /api/geojson/{layer_name}`.
- No secrets, local environment files, caches, `node_modules`, or build output are migrated.

## Known assumptions and risks

- The backend's current evacuation and shelter GeoJSON do not carry shelter capacity/name metadata, so the adapter reports a generic GIS shelter and zero capacity until that contract is enriched.
- Backend village responses do not include rainfall or physical distance; the UI displays zero rainfall until telemetry is joined and uses lead time as the available proximity label.
- The existing generated shared client/OpenAPI package does not describe these FastAPI routes, so the frontend uses a small local typed adapter rather than duplicating generated schemas.
