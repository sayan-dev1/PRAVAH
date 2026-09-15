"""Rate-of-rise calculations and lead-time rules."""

from app.core.config import (
	CRITICAL_THRESHOLD,
	PROPAGATION_SPEED_KM_H,
	UPSTREAM_DISTANCE_KM,
	WATCH_THRESHOLD,
)


def risk_level(rate_of_rise_cm_min: float, calibration: dict | None = None) -> str:
	calibration = calibration or {}
	critical_threshold = calibration.get("critical_dh_dt_cm_min")
	watch_threshold = calibration.get("watch_dh_dt_cm_min")
	critical_threshold = critical_threshold if critical_threshold is not None else CRITICAL_THRESHOLD
	watch_threshold = watch_threshold if watch_threshold is not None else WATCH_THRESHOLD
	if rate_of_rise_cm_min >= critical_threshold:
		return "CRITICAL"
	if rate_of_rise_cm_min >= watch_threshold:
		return "WATCH"
	return "NORMAL"


def rate_of_rise(previous_level_cm: float, current_level_cm: float, elapsed_seconds: float) -> float:
	if elapsed_seconds <= 0:
		raise ValueError("elapsed_seconds must be positive")
	return (current_level_cm - previous_level_cm) / (elapsed_seconds / 60)


def lead_time_minutes(calibration: dict | None = None) -> int:
	calibration = calibration or {}
	distance = calibration.get("upstream_gauge_distance_km")
	velocity = calibration.get("wave_velocity_kmh")
	distance = distance if distance is not None else UPSTREAM_DISTANCE_KM
	velocity = velocity if velocity is not None else PROPAGATION_SPEED_KM_H
	return round(distance / velocity * 60)
