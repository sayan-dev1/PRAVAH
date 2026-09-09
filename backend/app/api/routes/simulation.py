"""Cloudburst simulation and reset routes."""

from fastapi import APIRouter

from app.core.state import state_engine
from app.models.simulation import SimulationRequest, SimulationResponse
from app.models.telemetry import TelemetryPayload
from app.services.hydro_rules import risk_level
from app.services.alert_dispatcher import dispatch_sms, tactical_message
from app.services.stream_worker import stream

router = APIRouter(prefix="/simulate")


@router.post("/cloudburst", response_model=SimulationResponse)
async def trigger_cloudburst(request: SimulationRequest | None = None) -> SimulationResponse:
	state_engine.set_surge(True)
	rise = 3.8
	reading = state_engine.record(TelemetryPayload(rainfall_mm_hr=85, water_level_cm=164,
		rate_of_rise_cm_min=rise, soil_moisture_pct=94, status=risk_level(rise)))
	await stream.broadcast(reading)
	return SimulationResponse(message="Cloudburst surge injected", telemetry=reading)


@router.post("/reset")
def reset_simulation() -> dict[str, str]:
	state_engine.reset()
	return {"status": "reset"}


@router.post("/alert")
def create_tactical_alert() -> dict[str, str | None]:
	reading = state_engine.latest()
	rate = reading.rate_of_rise_cm_min if reading else 3.8
	return dispatch_sms(tactical_message(rate))
