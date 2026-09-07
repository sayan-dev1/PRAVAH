"""Simulation request and response schemas."""

from pydantic import BaseModel, Field

from .telemetry import TelemetryPayload


class SimulationRequest(BaseModel):
	intensity: str = Field(default="high", description="Demo surge intensity")
	target_basin: str = Field(default="MANDakINI", description="Target river basin")


class SimulationResponse(BaseModel):
	message: str
	telemetry: TelemetryPayload

