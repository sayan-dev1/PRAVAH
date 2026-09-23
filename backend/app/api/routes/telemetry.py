"""Telemetry WebSocket and REST routes."""

from typing import Any
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.core.state import state_engine
from app.models.telemetry import TelemetryIngestResponse, TelemetryPayload
from app.services.anomaly_filter import anomaly_filter
from app.services.region_registry import get_region
from app.services.stream_worker import stream
from app.services.telemetry_normalizer import normalize_telemetry

router = APIRouter()
ws_router = APIRouter()


@router.get("/telemetry")
def get_telemetry(region_id: str = Query(default="mandakini")):
	get_region(region_id)
	return state_engine.latest(region_id) or stream.baseline_reading(region_id)


@router.get("/weather")
def get_regional_weather(region_id: str = Query(default="mandakini")):
	get_region(region_id)
	from app.services.weather_service import latest_weather
	return latest_weather(region_id)


@router.post("/telemetry", response_model=TelemetryIngestResponse)
def ingest_telemetry(raw_data: dict[str, Any], region_id: str = Query(default="mandakini")) -> TelemetryIngestResponse:
	region = get_region(region_id)

	# 1. Telemetry Normalization Layer (Task 4)
	try:
		reading = normalize_telemetry(raw_data, default_region_id=region_id)
	except (ValueError, TypeError) as error:
		return TelemetryIngestResponse(accepted=False, reason=f"MALFORMED_TELEMETRY: {error}")

	# 2. Telemetry Quality & Anomaly Filter (Task 5)
	accepted, reason, filtered = anomaly_filter.validate(reading)
	if not accepted:
		return TelemetryIngestResponse(accepted=False, reason=reason)

	# 3. Hazard Evaluation & Dynamic Hydro Rules
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
