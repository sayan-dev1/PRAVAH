"""Provider-isolated Weather Ingestion Service with TTL caching and fallback resilience."""

from datetime import datetime, timezone
from threading import RLock

from app.services.region_registry import get_region
from app.services.weather.base import BaseWeatherProvider
from app.services.weather.models import CanonicalWeatherReading
from app.services.weather.normalizer import normalize_weather
from app.services.weather.open_meteo import OpenMeteoProvider


class WeatherService:
	"""Orchestrates isolated weather provider queries with TTL caching and fault tolerance."""

	def __init__(self, cache_ttl_seconds: int = 300, stale_ttl_seconds: int = 3600) -> None:
		self._cache_ttl_seconds = cache_ttl_seconds
		self._stale_ttl_seconds = stale_ttl_seconds
		self._lock = RLock()
		self._cache: dict[str, CanonicalWeatherReading] = {}
		default_provider = OpenMeteoProvider()
		self._default_provider: BaseWeatherProvider = default_provider
		self._providers: dict[str, BaseWeatherProvider] = {
			"open_meteo": default_provider,
		}

	def register_provider(self, provider: BaseWeatherProvider, set_as_default: bool = False) -> None:
		"""Register an external meteorological provider."""
		with self._lock:
			self._providers[provider.name] = provider
			if set_as_default:
				self._default_provider = provider

	def set_provider(self, name: str, provider: BaseWeatherProvider) -> None:
		"""Set or override a provider by name (e.g. for testing/mocking)."""
		with self._lock:
			self._providers[name] = provider

	def _coordinates(self, region_id: str) -> tuple[float, float]:
		"""Extract geographic coordinates strictly from region configuration without hardcoded fallbacks."""
		region = get_region(region_id)
		if not region:
			raise ValueError(f"Region '{region_id}' not found in registry")

		weather_cfg = region.get("weather") or {}
		lat, lon = weather_cfg.get("latitude"), weather_cfg.get("longitude")
		if lat is not None and lon is not None:
			return float(lat), float(lon)

		map_center = region.get("center")
		if isinstance(map_center, (list, tuple)) and len(map_center) >= 2:
			c_lat, c_lon = map_center[0], map_center[1]
			if c_lat is not None and c_lon is not None:
				return float(c_lat), float(c_lon)

		raise ValueError(f"Region '{region_id}' does not contain valid latitude/longitude coordinates")

	def fetch_weather(self, region_id: str, timeout_seconds: float = 4.0) -> CanonicalWeatherReading:
		"""Fetch fresh meteorological data for the region from its configured provider."""
		now_utc = datetime.now(timezone.utc)
		try:
			region = get_region(region_id)
		except Exception as error:
			return CanonicalWeatherReading(
				region_id=region_id,
				provider="open_meteo",
				status="UNAVAILABLE",
				updated_at=now_utc,
				error=f"Invalid region '{region_id}': {error}",
			)

		provider_name = (region.get("weather") or {}).get("provider", "open_meteo") if region else "open_meteo"
		with self._lock:
			provider = self._providers.get(provider_name, self._default_provider)

		try:
			lat, lon = self._coordinates(region_id)
		except Exception as error:
			return CanonicalWeatherReading(
				region_id=region_id,
				provider=provider.name,
				status="UNAVAILABLE",
				updated_at=now_utc,
				error=f"Coordinate resolution failed for '{region_id}': {error}",
			)

		raw = provider.fetch(lat, lon, timeout_seconds=timeout_seconds)
		normalized = normalize_weather(raw)
		normalized.region_id = region_id

		with self._lock:
			if normalized.status == "LIVE":
				self._cache[region_id] = normalized
				return normalized

			# On error / timeout / rate-limit: check if a prior cached reading exists
			previous = self._cache.get(region_id)
			if previous:
				stale_reading = CanonicalWeatherReading(
					region_id=region_id,
					provider=previous.provider,
					provenance=previous.provenance,
					timestamp=previous.timestamp,
					current=previous.current,
					hourly=previous.hourly,
					forecast=previous.forecast,
					soil_moisture=previous.soil_moisture,
					precipitation_rate_mm_hr=previous.precipitation_rate_mm_hr,
					rain_rate_mm_hr=previous.rain_rate_mm_hr,
					forecast_precipitation_1h_mm=previous.forecast_precipitation_1h_mm,
					forecast_precipitation_3h_mm=previous.forecast_precipitation_3h_mm,
					forecast_precipitation_6h_mm=previous.forecast_precipitation_6h_mm,
					relative_humidity_pct=previous.relative_humidity_pct,
					soil_moisture_vdr=previous.soil_moisture_vdr,
					soil_moisture_pct=previous.soil_moisture_pct,
					status="STALE",
					updated_at=previous.updated_at,
					error=normalized.error,
					cached=True,
				)
				return stale_reading

			return normalized

	def latest_weather(self, region_id: str) -> CanonicalWeatherReading:
		"""Retrieve latest cached weather reading or trigger fetch if cache is absent/expired."""
		with self._lock:
			cached = self._cache.get(region_id)
			if cached is not None:
				age = cached.age_seconds
				if age is not None and age <= self._cache_ttl_seconds:
					return CanonicalWeatherReading(
						region_id=region_id,
						provider=cached.provider,
						provenance=cached.provenance,
						timestamp=cached.timestamp,
						current=cached.current,
						hourly=cached.hourly,
						forecast=cached.forecast,
						soil_moisture=cached.soil_moisture,
						precipitation_rate_mm_hr=cached.precipitation_rate_mm_hr,
						rain_rate_mm_hr=cached.rain_rate_mm_hr,
						forecast_precipitation_1h_mm=cached.forecast_precipitation_1h_mm,
						forecast_precipitation_3h_mm=cached.forecast_precipitation_3h_mm,
						forecast_precipitation_6h_mm=cached.forecast_precipitation_6h_mm,
						relative_humidity_pct=cached.relative_humidity_pct,
						soil_moisture_vdr=cached.soil_moisture_vdr,
						soil_moisture_pct=cached.soil_moisture_pct,
						status="STALE" if age > self._stale_ttl_seconds else cached.status,
						updated_at=cached.updated_at,
						error=cached.error,
						cached=True,
					)

		return self.fetch_weather(region_id)

	def reset(self, region_id: str | None = None) -> None:
		"""Clear weather cache for isolation testing."""
		with self._lock:
			if region_id is None:
				self._cache.clear()
			else:
				self._cache.pop(region_id, None)


weather_service = WeatherService()
