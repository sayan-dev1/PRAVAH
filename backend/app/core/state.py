"""Thread-safe in-memory state and sliding-window buffers."""

from collections import deque
from threading import RLock

from app.models.telemetry import TelemetryPayload


class StateEngine:
	def __init__(self) -> None:
		self._lock = RLock()
		self._readings: deque[TelemetryPayload] = deque(maxlen=10)
		self._surge_active = False
		self._latest: TelemetryPayload | None = None

	def record(self, reading: TelemetryPayload) -> TelemetryPayload:
		with self._lock:
			self._latest = reading
			self._readings.append(reading)
			return reading

	def latest(self) -> TelemetryPayload | None:
		with self._lock:
			return self._latest

	def readings(self) -> list[TelemetryPayload]:
		with self._lock:
			return list(self._readings)

	def set_surge(self, active: bool) -> None:
		with self._lock:
			self._surge_active = active

	def reset(self) -> None:
		with self._lock:
			self._surge_active = False
			self._latest = None
			self._readings.clear()

	def surge_active(self) -> bool:
		with self._lock:
			return self._surge_active


state_engine = StateEngine()

