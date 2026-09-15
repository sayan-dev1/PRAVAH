"""Low-bandwidth tactical alert formatting and dispatch boundary."""

from app.services.hydro_rules import lead_time_minutes


def tactical_message(rate_of_rise_cm_min: float, village: str = "regional settlements",
					 calibration: dict | None = None, region_name: str = "PRAVAH basin") -> str:
	message = (
		f"[NDRF ALERT] {region_name}: Flash surge detected (+{rate_of_rise_cm_min:.1f}cm/m). "
		f"{village} sector at risk in {lead_time_minutes(calibration)}m. Evacuate via regional route."
	)
	return message[:140]


def dispatch_sms(message: str, recipient: str | None = None) -> dict[str, str | None]:
	"""Return a provider-ready envelope; Twilio/Fast2SMS can be wired here later."""
	return {"status": "queued", "recipient": recipient, "message": message[:140]}