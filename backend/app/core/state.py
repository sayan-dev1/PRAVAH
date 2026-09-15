"""Thread-safe in-memory state and sliding-window buffers."""

from collections import deque
from threading import RLock

from app.models.telemetry import TelemetryPayload


class StateEngine:
	def __init__(self) -> None:
		self._lock = RLock()
		self._readings: dict[str, deque[TelemetryPayload]] = {}
		self._latest: dict[str, TelemetryPayload | None] = {}
		self._surge_active: dict[str, bool] = {}
		self._weather: dict[str, object] = {}

	def record(self, reading: TelemetryPayload, region_id: str = "mandakini") -> TelemetryPayload:
		with self._lock:
			self._latest[region_id] = reading
			self._readings.setdefault(region_id, deque(maxlen=10)).append(reading)
			return reading

	def latest(self, region_id: str = "mandakini") -> TelemetryPayload | None:
		with self._lock:
			return self._latest.get(region_id)

	def readings(self, region_id: str = "mandakini") -> list[TelemetryPayload]:
		with self._lock:
			return list(self._readings.get(region_id, ()))

	def set_surge(self, active: bool, region_id: str = "mandakini") -> None:
		with self._lock:
			self._surge_active[region_id] = active

	def reset(self, region_id: str | None = None) -> None:
		with self._lock:
			if region_id is None:
				self._surge_active.clear()
				self._latest.clear()
				self._readings.clear()
				self._weather.clear()
			else:
				self._surge_active.pop(region_id, None)
				self._latest.pop(region_id, None)
				self._readings.pop(region_id, None)
				self._weather.pop(region_id, None)

	def surge_active(self, region_id: str = "mandakini") -> bool:
		with self._lock:
			return self._surge_active.get(region_id, False)

	def set_weather(self, region_id: str, weather: object) -> None:
		with self._lock:
			self._weather[region_id] = weather

	def weather(self, region_id: str) -> object | None:
		with self._lock:
			return self._weather.get(region_id)


state_engine = StateEngine()

