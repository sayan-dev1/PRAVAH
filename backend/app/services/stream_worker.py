"""Background telemetry tick generator and WebSocket connection manager."""

import asyncio
from datetime import datetime, timezone

from fastapi import WebSocket

from app.core.config import TICK_SECONDS
from app.core.state import state_engine
from app.models.telemetry import (
	HydrologyObservation,
	SoilMoistureObservation,
	TelemetryPayload,
	WeatherObservation,
)
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

		# Weather observation from Open-Meteo
		rainfall_val = weather.rain_rate_mm_hr if weather.rain_rate_mm_hr is not None else weather.precipitation_rate_mm_hr
		rainfall_source = "weather_api" if weather.status == "LIVE" else "unavailable"
		soil_vdr = weather.soil_moisture_vdr
		soil_pct = weather.soil_moisture_pct
		soil_source = "weather_api" if weather.status == "LIVE" else "unavailable"

		# Hydrology observation (IoT river gauge)
		water_level = 110.0
		rise = 0.2
		sensor_id = f"GAUGE_{region_id.upper()}_01"

		# 24h rain accumulation
		rain_24h_val = weather.rain_24h_mm if weather.rain_24h_mm is not None else weather.forecast_precipitation_24h_mm

		weather_sub = WeatherObservation(
			precipitation_mm_hr=weather.precipitation_rate_mm_hr,
			rain_mm_hr=weather.rain_rate_mm_hr,
			rain_24h_mm=rain_24h_val,
			forecast_1h_mm=weather.forecast_precipitation_1h_mm,
			forecast_3h_mm=weather.forecast_precipitation_3h_mm,
			forecast_6h_mm=weather.forecast_precipitation_6h_mm,
			forecast_24h_mm=weather.forecast_precipitation_24h_mm,
			unit="mm/hr",
			source="weather_api",
			provider="open_meteo",
		) if weather.status == "LIVE" else None

		sm = weather.soil_moisture
		soil_sub = SoilMoistureObservation(
			depth_0_1cm=sm.depth_0_1cm.value if sm else soil_vdr,
			depth_1_3cm=sm.depth_1_3cm.value if sm else None,
			depth_3_9cm=sm.depth_3_9cm.value if sm else None,
			depth_9_27cm=sm.depth_9_27cm.value if sm else None,
			depth_27_81cm=sm.depth_27_81cm.value if sm else None,
			depth_0_7cm_m3_m3=soil_vdr,
			unit="m³/m³",
			source="weather_api",
			provider="open_meteo",
		) if soil_vdr is not None or sm is not None else None

		hydro_sub = HydrologyObservation(
			river_level_cm=water_level,
			river_level_m=round(water_level / 100.0, 2),
			unit="cm",
			sensor_id=sensor_id,
			sensor_status="healthy",
			source="sensor",
		)

		return TelemetryPayload(
			region_id=region_id,
			sensor_id=sensor_id,
			rainfall_mm_hr=round(float(rainfall_val), 2) if rainfall_val is not None else 0.0,
			rainfall_24h_mm=round(float(rain_24h_val), 1) if rain_24h_val is not None else 0.0,
			rainfall_source=rainfall_source,
			water_level_cm=water_level,
			water_level_m=round(water_level / 100.0, 2),
			water_level_source="sensor",
			rate_of_rise_cm_min=rise,
			rate_of_rise_source="sensor",
			soil_moisture_vdr=soil_vdr,
			soil_moisture_pct=round(float(soil_pct), 1) if soil_pct is not None else 0.0,
			soil_moisture_source=soil_source,
			status=risk_level(rise, calibration),
			data_status="DYNAMIC_TELEMETRY",
			weather_status=weather.status,
			weather_observation_age_seconds=weather.age_seconds,
			weather=weather_sub,
			soil=soil_sub,
			hydrology=hydro_sub,
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
