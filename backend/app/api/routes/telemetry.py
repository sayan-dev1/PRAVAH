"""Telemetry WebSocket and REST routes."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.state import state_engine
from app.services.stream_worker import stream

router = APIRouter()
ws_router = APIRouter()


@router.get("/telemetry")
def get_telemetry():
	return state_engine.latest() or stream.baseline_reading()


@ws_router.websocket("/ws/telemetry")
async def telemetry_socket(websocket: WebSocket) -> None:
	await stream.connect(websocket)
	try:
		latest = state_engine.latest()
		if latest:
			await websocket.send_json(latest.model_dump(mode="json"))
		while True:
			await websocket.receive_text()
	except WebSocketDisconnect:
		await stream.disconnect(websocket)
	except Exception:
		await stream.disconnect(websocket)
