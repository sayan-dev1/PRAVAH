"""Background telemetry tick generator and WebSocket connection manager."""

import asyncio
from datetime import datetime, timezone

from fastapi import WebSocket

from app.core.config import TICK_SECONDS
from app.core.state import state_engine
from app.models.telemetry import TelemetryPayload
from app.services.hydro_rules import risk_level
from app.services.region_registry import get_region
from app.services.weather_service import latest_weather


class TelemetryStream:
	def __init__(self) -> None:
		self._clients: dict[WebSocket, str] = {}
		self._lock = asyncio.Lock()

	async def connect(self, websocket: WebSocket, region_id: str = "mandakini") -> None:
		await websocket.accept()
		async with self._lock:
			self._clients[websocket] = region_id

	async def disconnect(self, websocket: WebSocket) -> None:
		async with self._lock:
			self._clients.pop(websocket, None)

	async def broadcast(self, reading: TelemetryPayload, region_id: str = "mandakini") -> None:
		payload = reading.model_dump(mode="json")
		async with self._lock:
			clients = [(client, region_id) for client, region_id in self._clients.items()]
		disconnected: list[WebSocket] = []
		for client, client_region_id in clients:
			if client_region_id != region_id:
				continue
			try:
				await client.send_json(payload)
			except Exception:
				disconnected.append(client)
		for client in disconnected:
			await self.disconnect(client)

	async def active_regions(self) -> set[str]:
		async with self._lock:
			return set(self._clients.values())

	def baseline_reading(self, region_id: str = "mandakini") -> TelemetryPayload:
		calibration = get_region(region_id).get("hydro_calibration")
		weather = latest_weather(region_id)
		rainfall = weather.rain_mm if weather.rain_mm is not None else 12.0
		soil_moisture = weather.soil_moisture if weather.soil_moisture is not None else 65.0
		rise = 0.2
		return TelemetryPayload(
			region_id=region_id,
			sensor_id=f"{region_id.upper()}_GAUGE_01",
			rainfall_mm_hr=round(float(rainfall), 1),
			rainfall_source="open_meteo" if weather.status == "LIVE" else "unknown",
			water_level_cm=110.0,
			water_level_source="simulation",
			rate_of_rise_cm_min=rise,
			rate_of_rise_source="simulation",
			soil_moisture_pct=round(float(soil_moisture), 1),
			soil_moisture_source="open_meteo" if weather.status == "LIVE" else "unknown",
			status=risk_level(rise, calibration),
			data_status="SIMULATED_HYDROLOGY",
			weather_status=weather.status,
			weather_observation_age_seconds=weather.age_seconds,
		)

	async def run(self) -> None:
		while True:
			await asyncio.sleep(TICK_SECONDS)
			for region_id in await self.active_regions():
				if state_engine.surge_active(region_id):
					continue
				reading = state_engine.record(self.baseline_reading(region_id), region_id)
				await self.broadcast(reading, region_id)


stream = TelemetryStream()
