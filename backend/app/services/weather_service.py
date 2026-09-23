"""Weather ingestion service facade.

Maintains backward-compatibility while routing all requests through the isolated
WeatherService and normalization architecture.
"""

from app.services.weather import (
	BaseWeatherProvider,
	CanonicalWeatherReading,
	OpenMeteoProvider,
	RawWeatherPayload,
	WeatherReading,
	WeatherService,
	normalize_weather,
	weather_service,
)


def fetch_weather(region_id: str, timeout_seconds: float = 4.0) -> CanonicalWeatherReading:
	"""Fetch fresh meteorological data for a region."""
	return weather_service.fetch_weather(region_id, timeout_seconds=timeout_seconds)


def latest_weather(region_id: str) -> CanonicalWeatherReading:
	"""Retrieve latest cached weather reading or fetch if needed."""
	return weather_service.latest_weather(region_id)


__all__ = [
	"BaseWeatherProvider",
	"CanonicalWeatherReading",
	"OpenMeteoProvider",
	"RawWeatherPayload",
	"WeatherReading",
	"WeatherService",
	"fetch_weather",
	"latest_weather",
	"normalize_weather",
	"weather_service",
]