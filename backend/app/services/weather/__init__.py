"""Weather ingestion package."""

from app.services.weather.base import BaseWeatherProvider
from app.services.weather.models import CanonicalWeatherReading, RawWeatherPayload, WeatherReading
from app.services.weather.normalizer import normalize_weather
from app.services.weather.open_meteo import OpenMeteoProvider
from app.services.weather.service import WeatherService, weather_service

__all__ = [
	"BaseWeatherProvider",
	"CanonicalWeatherReading",
	"OpenMeteoProvider",
	"RawWeatherPayload",
	"WeatherReading",
	"WeatherService",
	"normalize_weather",
	"weather_service",
]
