"""Abstract base class for isolated weather data providers."""

from abc import ABC, abstractmethod

from app.services.weather.models import RawWeatherPayload


class BaseWeatherProvider(ABC):
	"""Abstract interface for all external weather data providers."""

	@property
	@abstractmethod
	def name(self) -> str:
		"""Unique identifier for this provider."""
		pass

	@abstractmethod
	def fetch(self, latitude: float, longitude: float, timeout_seconds: float = 4.0) -> RawWeatherPayload:
		"""Fetch raw meteorological readings for geographic coordinates.

		Must never throw unhandled network exceptions; errors must be captured
		in RawWeatherPayload.error.
		"""
		pass
