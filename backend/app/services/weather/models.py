"""Data models for weather provider responses and normalized weather readings."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class RawWeatherPayload:
	"""Raw unnormalized response directly from a weather provider."""
	provider: str
	latitude: float
	longitude: float
	timestamp: datetime
	raw_data: dict[str, Any]
	status_code: int = 200
	error: str | None = None


@dataclass
class SoilMoistureDepthItem:
	"""Soil moisture volumetric fraction at a specific depth layer."""
	value: float | None = None
	unit: str = "m³/m³"


@dataclass
class SoilMoistureDepths:
	"""All 5 canonical Open-Meteo soil moisture depth horizons in physical m³/m³."""
	depth_0_1cm: SoilMoistureDepthItem = field(default_factory=lambda: SoilMoistureDepthItem())
	depth_1_3cm: SoilMoistureDepthItem = field(default_factory=lambda: SoilMoistureDepthItem())
	depth_3_9cm: SoilMoistureDepthItem = field(default_factory=lambda: SoilMoistureDepthItem())
	depth_9_27cm: SoilMoistureDepthItem = field(default_factory=lambda: SoilMoistureDepthItem())
	depth_27_81cm: SoilMoistureDepthItem = field(default_factory=lambda: SoilMoistureDepthItem())
	source: str = "weather_api"
	provider: str = "open_meteo"

	def to_dict(self) -> dict[str, Any]:
		return {
			"depth_0_1cm": {"value": self.depth_0_1cm.value, "unit": self.depth_0_1cm.unit},
			"depth_1_3cm": {"value": self.depth_1_3cm.value, "unit": self.depth_1_3cm.unit},
			"depth_3_9cm": {"value": self.depth_3_9cm.value, "unit": self.depth_3_9cm.unit},
			"depth_9_27cm": {"value": self.depth_9_27cm.value, "unit": self.depth_9_27cm.unit},
			"depth_27_81cm": {"value": self.depth_27_81cm.value, "unit": self.depth_27_81cm.unit},
			"source": self.source,
			"provider": self.provider,
		}


@dataclass
class CurrentWeather:
	"""Observed/current meteorological parameters from weather API."""
	timestamp: str | None = None
	precipitation: float | None = None
	rain: float | None = None
	showers: float | None = None
	temperature_2m: float | None = None
	relative_humidity_2m: float | None = None
	cloud_cover: float | None = None
	wind_speed_10m: float | None = None
	wind_gusts_10m: float | None = None
	is_day: int | None = None
	source: str = "weather_api"
	provider: str = "open_meteo"


@dataclass
class HourlyWeatherItem:
	"""Single timestamped hourly weather record."""
	timestamp: str
	precipitation: float | None = None
	rain: float | None = None
	showers: float | None = None
	precipitation_probability: float | None = None
	temperature_2m: float | None = None
	relative_humidity_2m: float | None = None
	surface_pressure: float | None = None
	cloud_cover: float | None = None
	wind_speed_10m: float | None = None
	wind_gusts_10m: float | None = None
	soil_moisture: SoilMoistureDepths | None = None
	source: str = "weather_api"
	provider: str = "open_meteo"


@dataclass
class ForecastRecord:
	"""Forecast record distinguishing forecast from current observation."""
	timestamp: str
	precipitation: float | None = None
	rain: float | None = None
	showers: float | None = None
	precipitation_probability: float | None = None
	source: str = "weather_api"
	provider: str = "open_meteo"


@dataclass
class CanonicalWeatherReading:
	"""Normalized canonical PRAVAH weather data structure."""
	provider: str = "open_meteo"
	provenance: str = "MODEL_WEATHER"
	timestamp: datetime | None = None
	region_id: str = ""
	current: CurrentWeather | None = None
	hourly: list[HourlyWeatherItem] = field(default_factory=list)
	forecast: list[ForecastRecord] = field(default_factory=list)
	soil_moisture: SoilMoistureDepths | None = None
	precipitation_rate_mm_hr: float | None = None
	rain_rate_mm_hr: float | None = None
	rain_24h_mm: float | None = None
	forecast_precipitation_1h_mm: float | None = None
	forecast_precipitation_3h_mm: float | None = None
	forecast_precipitation_6h_mm: float | None = None
	forecast_precipitation_24h_mm: float | None = None
	relative_humidity_pct: float | None = None
	soil_moisture_vdr: float | None = None  # Volumetric fraction m3/m3
	soil_moisture_pct: float | None = None
	status: str = "UNAVAILABLE"  # LIVE | STALE | UNAVAILABLE | RATE_LIMITED | ERROR
	updated_at: datetime | None = None
	error: str | None = None
	cached: bool = False

	@property
	def age_seconds(self) -> int | None:
		if self.updated_at is None:
			return None
		return max(0, round((datetime.now(timezone.utc) - self.updated_at).total_seconds()))

	# Compatibility properties with legacy WeatherReading
	@property
	def precipitation_mm(self) -> float | None:
		return self.precipitation_rate_mm_hr

	@property
	def rain_mm(self) -> float | None:
		return self.rain_rate_mm_hr

	@property
	def soil_moisture_legacy(self) -> float | None:
		return self.soil_moisture_pct


# Alias for backward compatibility
WeatherReading = CanonicalWeatherReading
