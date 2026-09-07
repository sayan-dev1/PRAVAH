"""Telemetry and sensor status schemas."""

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class TelemetryPayload(BaseModel):
	timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
	sensor_id: str = "MANDakINI_GAUGE_01"
	rainfall_mm_hr: float
	water_level_cm: float
	rate_of_rise_cm_min: float
	soil_moisture_pct: float
	status: str


class TelemetryIngestResponse(BaseModel):
	accepted: bool
	reason: str | None = None
	telemetry: TelemetryPayload | None = None

