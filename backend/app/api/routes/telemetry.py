"""Telemetry WebSocket and REST routes."""

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.core.state import state_engine
from app.models.telemetry import TelemetryIngestResponse, TelemetryPayload
from app.services.anomaly_filter import anomaly_filter
from app.services.stream_worker import stream
from app.services.region_registry import get_region

router = APIRouter()
ws_router = APIRouter()


@router.get("/telemetry")
def get_telemetry(region_id: str = Query(default="mandakini")):
	get_region(region_id)
	return state_engine.latest(region_id) or stream.baseline_reading(region_id)


@router.post("/telemetry", response_model=TelemetryIngestResponse)
def ingest_telemetry(reading: TelemetryPayload, region_id: str = Query(default="mandakini")) -> TelemetryIngestResponse:
	region = get_region(region_id)
	accepted, reason, filtered = anomaly_filter.validate(reading)
	if not accepted:
		return TelemetryIngestResponse(accepted=False, reason=reason)
	previous = state_engine.latest(region_id)
	if previous:
		from app.services.hydro_rules import rate_of_rise
		elapsed_seconds = (filtered.timestamp - previous.timestamp).total_seconds()
		if elapsed_seconds <= 0:
			raise HTTPException(status_code=400, detail="Telemetry timestamp must advance")
		filtered = filtered.model_copy(update={
			"rate_of_rise_cm_min": rate_of_rise(previous.water_level_cm, filtered.water_level_cm, elapsed_seconds),
			"rate_of_rise_source": "sensor",
		})
	calibration = region.get("hydro_calibration")
	if filtered.status != "FAULTY_STUCK":
		from app.services.hydro_rules import risk_level
		filtered = filtered.model_copy(update={"status": risk_level(filtered.rate_of_rise_cm_min, calibration)})
	filtered = filtered.model_copy(update={"region_id": region_id, "data_status": "SENSOR_TELEMETRY"})
	return TelemetryIngestResponse(accepted=True, telemetry=state_engine.record(filtered, region_id))


@ws_router.websocket("/ws/telemetry")
async def telemetry_socket(websocket: WebSocket) -> None:
	region_id = websocket.query_params.get("region_id", "mandakini")
	get_region(region_id)
	await stream.connect(websocket, region_id)
	try:
		latest = state_engine.latest(region_id)
		if latest:
			await websocket.send_json(latest.model_dump(mode="json"))
		while True:
			await websocket.receive_text()
	except WebSocketDisconnect:
		await stream.disconnect(websocket)
	except Exception:
		await stream.disconnect(websocket)
