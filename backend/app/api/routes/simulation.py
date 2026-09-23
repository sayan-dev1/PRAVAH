"""Cloudburst simulation and reset routes."""

from fastapi import APIRouter

from app.core.state import state_engine
from app.models.simulation import SimulationRequest, SimulationResponse
from app.models.telemetry import TelemetryPayload
from app.services.hydro_rules import risk_level
from app.services.alert_dispatcher import dispatch_sms, tactical_message
from app.services.stream_worker import stream
from app.services.region_registry import get_region
from app.services.routing_engine import route_geojson

router = APIRouter(prefix="/simulate")


@router.post("/cloudburst", response_model=SimulationResponse)
async def trigger_cloudburst(request: SimulationRequest | None = None) -> SimulationResponse:
	region_id = request.region_id if request else "mandakini"
	region = get_region(region_id)
	state_engine.set_surge(True, region_id)
	rise = 3.8
	reading = state_engine.record(TelemetryPayload(region_id=region_id, sensor_id=f"SIM_{region_id.upper()}_01",
		rainfall_mm_hr=85, rainfall_source="simulation", water_level_cm=164,
		water_level_source="simulation",
		rate_of_rise_cm_min=rise, soil_moisture_pct=94,
		soil_moisture_source="simulation", rate_of_rise_source="simulation",
		data_status="SIMULATED_HYDROLOGY",
		status=risk_level(rise, region.get("hydro_calibration"))), region_id)
	await stream.broadcast(reading, region_id)
	settlement = (region.get("villages") or [None])[0]
	incident = None
	if settlement:
		route = route_geojson(settlement["id"], hazard_multiplier=2.0, region_id=region_id)
		incident = {
			"region_id": region_id,
			"settlement_id": settlement["id"],
			"route": route,
			"severity": reading.status,
		}
	return SimulationResponse(message="Cloudburst surge injected", telemetry=reading, incident=incident)


@router.post("/reset")
def reset_simulation(region_id: str = "mandakini") -> dict[str, str]:
	from app.services.anomaly_filter import anomaly_filter
	state_engine.reset(region_id)
	anomaly_filter.reset(region_id)
	return {"status": "reset"}


@router.post("/alert")
def create_tactical_alert(region_id: str = "mandakini") -> dict[str, str | None]:
	region = get_region(region_id)
	reading = state_engine.latest(region_id)
	rate = reading.rate_of_rise_cm_min if reading else 3.8
	village = (region.get("villages") or [{"name": "regional settlements"}])[0]["name"]
	return dispatch_sms(tactical_message(rate, village=village,
		calibration=region.get("hydro_calibration"), region_name=region.get("name", region_id)))
