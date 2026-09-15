"""Telemetry and sensor status schemas."""

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class TelemetryPayload(BaseModel):
	timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	region_id: str = "mandakini"
	sensor_id: str = "SIM_GAUGE_01"
	rainfall_mm_hr: float
	rainfall_source: str = "simulation"
	water_level_cm: float
	water_level_source: str = "simulation"
	rate_of_rise_cm_min: float
	rate_of_rise_source: str = "simulation"
	soil_moisture_pct: float
	soil_moisture_source: str = "simulation"
	status: str
	data_status: str = "SIMULATED_HYDROLOGY"
	weather_status: str = "UNKNOWN"
	weather_observation_age_seconds: int | None = None


class TelemetryIngestResponse(BaseModel):
	accepted: bool
	reason: str | None = None
	telemetry: TelemetryPayload | None = None

