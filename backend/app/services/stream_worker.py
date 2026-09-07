"""Background telemetry tick generator and WebSocket connection manager."""

import asyncio
import random
from datetime import datetime, timezone

from fastapi import WebSocket

from app.core.config import TICK_SECONDS
from app.core.state import state_engine
from app.models.telemetry import TelemetryPayload
from app.services.hydro_rules import risk_level


class TelemetryStream:
	def __init__(self) -> None:
		self._clients: set[WebSocket] = set()
		self._lock = asyncio.Lock()

	async def connect(self, websocket: WebSocket) -> None:
		await websocket.accept()
		async with self._lock:
			self._clients.add(websocket)

	async def disconnect(self, websocket: WebSocket) -> None:
		async with self._lock:
			self._clients.discard(websocket)

	async def broadcast(self, reading: TelemetryPayload) -> None:
		payload = reading.model_dump(mode="json")
		async with self._lock:
			clients = list(self._clients)
		disconnected: list[WebSocket] = []
		for client in clients:
			try:
				await client.send_json(payload)
			except Exception:
				disconnected.append(client)
		for client in disconnected:
			await self.disconnect(client)

	def baseline_reading(self) -> TelemetryPayload:
		rise = round(random.uniform(0.1, 0.3), 2)
		return TelemetryPayload(
			rainfall_mm_hr=round(random.uniform(12, 15), 1),
			water_level_cm=round(random.uniform(108, 112), 1),
			rate_of_rise_cm_min=rise,
			soil_moisture_pct=round(random.uniform(62, 70), 1),
			status=risk_level(rise),
		)

	async def run(self) -> None:
		while True:
			await asyncio.sleep(TICK_SECONDS)
			if state_engine.surge_active():
				continue
			await self.broadcast(state_engine.record(self.baseline_reading()))


stream = TelemetryStream()
