"""Rate-of-rise calculations and lead-time rules."""

from app.core.config import (
	CRITICAL_THRESHOLD,
	PROPAGATION_SPEED_KM_H,
	UPSTREAM_DISTANCE_KM,
	WATCH_THRESHOLD,
)


def risk_level(rate_of_rise_cm_min: float) -> str:
	if rate_of_rise_cm_min >= CRITICAL_THRESHOLD:
		return "CRITICAL"
	if rate_of_rise_cm_min >= WATCH_THRESHOLD:
		return "WATCH"
	return "NORMAL"


def rate_of_rise(previous_level_cm: float, current_level_cm: float, elapsed_seconds: float) -> float:
	if elapsed_seconds <= 0:
		raise ValueError("elapsed_seconds must be positive")
	return (current_level_cm - previous_level_cm) / (elapsed_seconds / 60)


def lead_time_minutes() -> int:
	return round(UPSTREAM_DISTANCE_KM / PROPAGATION_SPEED_KM_H * 60)
