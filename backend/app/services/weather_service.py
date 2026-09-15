"""Open-Meteo weather context with a last-known-value cache."""

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import urlopen

from app.services.region_registry import get_region


@dataclass
class WeatherReading:
	precipitation_mm: float | None = None
	rain_mm: float | None = None
	relative_humidity_pct: float | None = None
	soil_moisture: float | None = None
	provider: str = "open_meteo"
	status: str = "UNAVAILABLE"
	updated_at: datetime | None = None
	error: str | None = None

	@property
	def age_seconds(self) -> int | None:
		if self.updated_at is None:
			return None
		return max(0, round((datetime.now(timezone.utc) - self.updated_at).total_seconds()))


_cache: dict[str, WeatherReading] = {}


def _coordinates(region_id: str) -> tuple[float, float]:
	region = get_region(region_id)
	weather = region.get("weather") or {}
	center = weather.get("latitude"), weather.get("longitude")
	if center[0] is None or center[1] is None:
		map_center = region["center"]
		return float(map_center[0]), float(map_center[1])
	return float(center[0]), float(center[1])


def fetch_weather(region_id: str, timeout_seconds: float = 4) -> WeatherReading:
	latitude, longitude = _coordinates(region_id)
	query = urlencode({
		"latitude": latitude,
		"longitude": longitude,
		"hourly": "precipitation,rain,relative_humidity_2m,soil_moisture_0_to_7cm",
		"forecast_days": 1,
		"timezone": "UTC",
	})
	try:
		with urlopen(f"https://api.open-meteo.com/v1/forecast?{query}", timeout=timeout_seconds) as response:
			payload = json.loads(response.read().decode("utf-8"))
		hourly = payload["hourly"]
		index = 0
		reading = WeatherReading(
			precipitation_mm=hourly["precipitation"][index],
			rain_mm=hourly["rain"][index],
			relative_humidity_pct=hourly["relative_humidity_2m"][index],
			soil_moisture=hourly["soil_moisture_0_to_7cm"][index],
			status="LIVE",
			updated_at=datetime.now(timezone.utc),
		)
		_cache[region_id] = reading
		return reading
	except (KeyError, IndexError, OSError, ValueError, json.JSONDecodeError) as error:
		previous = _cache.get(region_id)
		if previous:
			return WeatherReading(**{**previous.__dict__, "status": "STALE", "error": str(error)})
		return WeatherReading(status="UNAVAILABLE", error=str(error))


def latest_weather(region_id: str) -> WeatherReading:
	reading = _cache.get(region_id)
	if reading:
		if reading.age_seconds is not None and reading.age_seconds > 3600:
			return WeatherReading(**{**reading.__dict__, "status": "STALE"})
		return reading
	return fetch_weather(region_id)