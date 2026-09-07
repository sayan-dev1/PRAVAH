"""Sensor health and frozen-value checks."""

from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from app.models.telemetry import TelemetryPayload


class TelemetryAnomalyFilter:
	def __init__(self) -> None:
		self._history: dict[str, deque[TelemetryPayload]] = defaultdict(lambda: deque(maxlen=20))

	def validate(self, reading: TelemetryPayload) -> tuple[bool, str | None, TelemetryPayload]:
		history = self._history[reading.sensor_id]
		previous = history[-1] if history else None
		if previous and abs(reading.water_level_cm - previous.water_level_cm) > 50:
			return False, "IMPOSSIBLE_SPIKE", reading
		history.append(reading)
		if (len(history) == 20 and reading.rainfall_mm_hr >= 50
				and max(item.water_level_cm for item in history) - min(item.water_level_cm for item in history) < 0.1):
			reading = reading.model_copy(update={"status": "FAULTY_STUCK"})
		return True, None, reading

	def timeout_status(self, last_seen: datetime | None, now: datetime | None = None) -> str:
		if last_seen is None:
			return "DATA_OFFLINE"
		current = now or datetime.now(timezone.utc)
		return "DATA_OFFLINE" if current - last_seen > timedelta(seconds=15) else "ONLINE"


anomaly_filter = TelemetryAnomalyFilter()
