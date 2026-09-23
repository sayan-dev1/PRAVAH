"""Feature vector and signal context data models for PRAVAH Feature Engine."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class SignalContext:
	"""Canonical feature vector representing current hydrometeorological and terrain state."""
	region_id: str
	sensor_id: str | None = None
	village_id: str | None = None
	timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

	# Hydrological River Signals
	river_level_cm: float | None = None
	dh_dt_cm_min: float | None = None  # First derivative: rate of rise (cm/min)
	dh_dt_acceleration_cm_min2: float | None = None  # Second derivative: acceleration (cm/min^2)
	dh_dt_source: str = "unavailable"  # observed | sensor | simulation | unavailable

	# Meteorological Precipitation Signals
	rainfall_intensity_mm_hr: float | None = None
	rainfall_1h_mm: float | None = None
	rainfall_3h_mm: float | None = None
	rainfall_6h_mm: float | None = None
	rainfall_24h_mm: float | None = None
	rainfall_source: str = "unavailable"

	# Soil Moisture Signals
	soil_moisture_pct: float | None = None
	soil_moisture_vdr: float | None = None  # Volumetric fraction m3/m3
	soil_moisture_source: str = "unavailable"

	# Terrain Signals (from Regional GIS bundle)
	mean_twi: float | None = None
	max_twi: float | None = None
	mean_slope_deg: float | None = None
	max_slope_deg: float | None = None
	elevation_m: float | None = None

	# Spatial & Event Proximity
	distance_to_river_m: float | None = None
	historical_event_proximity_km: float | None = None

	# Feature Status & Provenance Metadata
	provenance: dict[str, str] = field(default_factory=dict)
	is_synthetic: bool = False

	def to_dict(self) -> dict[str, Any]:
		"""Serialize feature vector to dictionary."""
		return {
			"region_id": self.region_id,
			"sensor_id": self.sensor_id,
			"village_id": self.village_id,
			"timestamp": self.timestamp.isoformat(),
			"river_level_cm": self.river_level_cm,
			"dh_dt_cm_min": self.dh_dt_cm_min,
			"dh_dt_acceleration_cm_min2": self.dh_dt_acceleration_cm_min2,
			"dh_dt_source": self.dh_dt_source,
			"rainfall_intensity_mm_hr": self.rainfall_intensity_mm_hr,
			"rainfall_1h_mm": self.rainfall_1h_mm,
			"rainfall_3h_mm": self.rainfall_3h_mm,
			"rainfall_6h_mm": self.rainfall_6h_mm,
			"rainfall_24h_mm": self.rainfall_24h_mm,
			"rainfall_source": self.rainfall_source,
			"soil_moisture_pct": self.soil_moisture_pct,
			"soil_moisture_vdr": self.soil_moisture_vdr,
			"soil_moisture_source": self.soil_moisture_source,
			"mean_twi": self.mean_twi,
			"max_twi": self.max_twi,
			"mean_slope_deg": self.mean_slope_deg,
			"max_slope_deg": self.max_slope_deg,
			"elevation_m": self.elevation_m,
			"distance_to_river_m": self.distance_to_river_m,
			"historical_event_proximity_km": self.historical_event_proximity_km,
			"provenance": self.provenance,
			"is_synthetic": self.is_synthetic,
		}
