"""Low-bandwidth tactical alert formatting and dispatch boundary."""

from app.services.hydro_rules import lead_time_minutes


def tactical_message(rate_of_rise_cm_min: float, village: str = "Tilwara") -> str:
	message = (
		f"[NDRF ALERT] MANDAKINI BASIN: Flash surge detected (+{rate_of_rise_cm_min:.1f}cm/m). "
		f"{village} sector at risk in {lead_time_minutes()}m. Evacuate via High Road."
	)
	return message[:140]


def dispatch_sms(message: str, recipient: str | None = None) -> dict[str, str | None]:
	"""Return a provider-ready envelope; Twilio/Fast2SMS can be wired here later."""
	return {"status": "queued", "recipient": recipient, "message": message[:140]}