"""Telemetry quality filter and anomaly detection layer.

Detects impossible spikes, unphysical values, stuck sensors, duplicate packets,
and timestamp anomalies before hazard evaluation while preserving provenance and failure reasons.
"""

from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from app.models.telemetry import TelemetryPayload


class TelemetryAnomalyFilter:
	def __init__(self, max_history: int = 20) -> None:
		self._max_history = max_history
		# Keyed by (region_id, sensor_id) for strict regional isolation
		self._history: dict[tuple[str, str], deque[TelemetryPayload]] = defaultdict(lambda: deque(maxlen=self._max_history))

	def validate(self, reading: TelemetryPayload) -> tuple[bool, str | None, TelemetryPayload]:
		"""Validate incoming canonical reading against physical constraints and sensor history.

		Returns:
			(accepted, rejection_reason, processed_reading)
		"""
		# 1. Range Checks: Physical limits
		if reading.water_level_cm is not None:
			if reading.water_level_cm < 0.0:
				return False, "OUT_OF_RANGE_WATER_LEVEL", reading
			if reading.water_level_cm > 10000.0:  # > 100 meters
				return False, "OUT_OF_RANGE_WATER_LEVEL", reading

		if reading.rainfall_mm_hr is not None:
			if reading.rainfall_mm_hr < 0.0:
				return False, "OUT_OF_RANGE_RAINFALL", reading
			if reading.rainfall_mm_hr > 500.0:  # > 500 mm/hr exceeds physical cloudburst ceiling
				return False, "IMPOSSIBLE_RAINFALL", reading

		if reading.soil_moisture_pct is not None:
			if reading.soil_moisture_pct < 0.0 or reading.soil_moisture_pct > 100.0:
				return False, "OUT_OF_RANGE_SOIL_MOISTURE", reading

		# 2. Timestamp Quality: Future time check
		now_utc = datetime.now(timezone.utc)
		if reading.timestamp > now_utc + timedelta(hours=24):
			return False, "FUTURE_TIMESTAMP", reading

		# 3. Sensor History and Temporal Anomaly Checks
		key = (reading.region_id.lower(), reading.sensor_id)
		history = self._history[key]
		previous = history[-1] if history else None

		if previous is not None:
			# Duplicate Packet Detection
			if (previous.timestamp == reading.timestamp and
				abs(previous.water_level_cm - reading.water_level_cm) < 1e-6 and
				abs(previous.rainfall_mm_hr - reading.rainfall_mm_hr) < 1e-6):
				return False, "DUPLICATE_READING", reading

			# Retrograde / Backwards Timestamp Check
			elapsed_seconds = (reading.timestamp - previous.timestamp).total_seconds()
			if elapsed_seconds < 0:
				return False, "RETROGRADE_TIMESTAMP", reading

			# Impossible Water Level Jump (> 50cm sudden change between successive ticks)
			if abs(reading.water_level_cm - previous.water_level_cm) > 50.0:
				return False, "IMPOSSIBLE_SPIKE", reading

		# Record reading to history buffer
		history.append(reading)

		# 4. Stuck Sensor / Frozen Values Check
		# If rainfall is heavy (>= 50 mm/hr) but water level remains completely flat over window
		if (len(history) >= self._max_history and
			reading.rainfall_mm_hr >= 50.0 and
			max(item.water_level_cm for item in history) - min(item.water_level_cm for item in history) < 0.1):
			reading = reading.model_copy(update={"status": "FAULTY_STUCK"})

		return True, None, reading

	def timeout_status(self, last_seen: datetime | None, now: datetime | None = None) -> str:
		"""Evaluate sensor liveness timeout."""
		if last_seen is None:
			return "DATA_OFFLINE"
		current = now or datetime.now(timezone.utc)
		return "DATA_OFFLINE" if current - last_seen > timedelta(seconds=15) else "ONLINE"

	def reset(self, region_id: str | None = None) -> None:
		"""Clear filter history for region isolation or drill resets."""
		if region_id is None:
			self._history.clear()
		else:
			reg_lower = region_id.lower()
			keys_to_remove = [k for k in self._history if k[0] == reg_lower]
			for k in keys_to_remove:
				self._history.pop(k, None)


anomaly_filter = TelemetryAnomalyFilter()
