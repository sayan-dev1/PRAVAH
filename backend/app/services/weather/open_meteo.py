"""Open-Meteo API isolated weather provider."""

from datetime import datetime, timezone
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.services.weather.base import BaseWeatherProvider
from app.services.weather.models import RawWeatherPayload


class OpenMeteoProvider(BaseWeatherProvider):
	"""Fetches NWP meteorological forecast and moisture data from Open-Meteo API."""

	def __init__(self, base_url: str = "https://api.open-meteo.com/v1/forecast", api_key: str | None = None) -> None:
		self._base_url = base_url
		self._api_key = api_key

	@property
	def name(self) -> str:
		return "open_meteo"

	def fetch(self, latitude: float, longitude: float, timeout_seconds: float = 4.0) -> RawWeatherPayload:
		now_utc = datetime.now(timezone.utc)
		hourly_vars = [
			"precipitation",
			"rain",
			"showers",
			"precipitation_probability",
			"soil_moisture_0_to_1cm",
			"soil_moisture_1_to_3cm",
			"soil_moisture_3_to_9cm",
			"soil_moisture_9_to_27cm",
			"soil_moisture_27_to_81cm",
			"temperature_2m",
			"relative_humidity_2m",
			"surface_pressure",
			"cloud_cover",
			"wind_speed_10m",
			"wind_gusts_10m",
		]
		current_vars = [
			"precipitation",
			"rain",
			"showers",
			"temperature_2m",
			"relative_humidity_2m",
			"cloud_cover",
			"wind_speed_10m",
			"wind_gusts_10m",
			"is_day",
		]

		params = {
			"latitude": round(latitude, 4),
			"longitude": round(longitude, 4),
			"hourly": ",".join(hourly_vars),
			"current": ",".join(current_vars),
			"forecast_days": 2,
			"timezone": "auto",
		}
		if self._api_key:
			params["apikey"] = self._api_key

		url = f"{self._base_url}?{urlencode(params)}"
		request = Request(url, headers={"User-Agent": "PRAVAH-Disaster-Command-Deck/2.5 (National Disaster Response)"})

		try:
			with urlopen(request, timeout=timeout_seconds) as response:
				status_code = response.getcode()
				raw_bytes = response.read()
				data = json.loads(raw_bytes.decode("utf-8"))
				return RawWeatherPayload(
					provider=self.name,
					latitude=latitude,
					longitude=longitude,
					timestamp=now_utc,
					raw_data=data,
					status_code=status_code,
				)
		except HTTPError as error:
			error_msg = f"HTTP {error.code}: {error.reason}"
			if error.code == 429:
				error_msg = "Open-Meteo API rate limit reached (HTTP 429)"
			return RawWeatherPayload(
				provider=self.name,
				latitude=latitude,
				longitude=longitude,
				timestamp=now_utc,
				raw_data={},
				status_code=error.code,
				error=error_msg,
			)
		except (URLError, TimeoutError, OSError) as error:
			return RawWeatherPayload(
				provider=self.name,
				latitude=latitude,
				longitude=longitude,
				timestamp=now_utc,
				raw_data={},
				status_code=503,
				error=f"Network error connecting to Open-Meteo: {error}",
			)
		except json.JSONDecodeError as error:
			return RawWeatherPayload(
				provider=self.name,
				latitude=latitude,
				longitude=longitude,
				timestamp=now_utc,
				raw_data={},
				status_code=502,
				error=f"Invalid JSON from Open-Meteo: {error}",
			)
