"""Telemetry and sensor status schemas for PRAVAH."""

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class WeatherObservation(BaseModel):
	"""Canonical weather observation and forecast structure from weather APIs."""
	precipitation_mm_hr: float | None = None
	rain_mm_hr: float | None = None
	rain_24h_mm: float | None = None
	forecast_1h_mm: float | None = None
	forecast_3h_mm: float | None = None
	forecast_6h_mm: float | None = None
	forecast_24h_mm: float | None = None
	unit: str = "mm/hr"
	source: str = "weather_api"
	provider: str = "open_meteo"


class SoilMoistureObservation(BaseModel):
	"""Canonical soil moisture volumetric water content across 5 depth horizons."""
	depth_0_1cm: float | None = None
	depth_1_3cm: float | None = None
	depth_3_9cm: float | None = None
	depth_9_27cm: float | None = None
	depth_27_81cm: float | None = None
	depth_0_7cm_m3_m3: float | None = None
	unit: str = "m³/m³"
	source: str = "weather_api"
	provider: str = "open_meteo"


class HydrologyObservation(BaseModel):
	"""Simulated/IoT river gauge observation structure."""
	river_level_cm: float | None = None
	river_level_m: float | None = None
	unit: str = "cm"
	sensor_id: str = "GAUGE_01"
	sensor_status: str = "healthy"
	source: str = "sensor"


class TelemetryPayload(BaseModel):
	timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	region_id: str = "mandakini"
	sensor_id: str = "GAUGE_01"
	rainfall_mm_hr: float | None = 0.0
	rainfall_24h_mm: float | None = 0.0
	rainfall_source: str = "weather_api"
	water_level_cm: float | None = 110.0
	water_level_m: float | None = 1.10
	water_level_source: str = "sensor"
	rate_of_rise_cm_min: float | None = 0.0
	rate_of_rise_source: str = "sensor"
	soil_moisture_vdr: float | None = None
	soil_moisture_pct: float | None = None
	soil_moisture_source: str = "weather_api"
	status: str = "NORMAL"
	data_status: str = "DYNAMIC_TELEMETRY"
	weather_status: str = "UNKNOWN"
	weather_observation_age_seconds: int | None = None
	weather: WeatherObservation | None = None
	soil: SoilMoistureObservation | None = None
	hydrology: HydrologyObservation | None = None


class TelemetryIngestResponse(BaseModel):
	accepted: bool
	reason: str | None = None
	telemetry: TelemetryPayload | None = None
