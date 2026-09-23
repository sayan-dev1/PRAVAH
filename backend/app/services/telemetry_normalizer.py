"""Telemetry normalization layer.

Transforms heterogeneous raw telemetry data from diverse provider formats and units
into canonical PRAVAH TelemetryPayload objects.
"""

from datetime import datetime, timezone
import math
from typing import Any, Mapping

from app.models.telemetry import TelemetryPayload


# Alias mappings for flexible provider ingestion
SENSOR_ID_ALIASES = ("sensor_id", "sensorId", "device_id", "deviceId", "station_id", "stationId", "id", "sensor", "station")
REGION_ID_ALIASES = ("region_id", "regionId", "basin", "basin_id", "basinId", "region")

WATER_LEVEL_ALIASES = ("water_level_cm", "water_level", "waterLevel", "stage", "gauge_height", "gaugeHeight", "water_depth", "waterDepth", "level", "wl", "gauge_cm", "depth")
WATER_LEVEL_UNIT_ALIASES = ("water_level_unit", "waterLevelUnit", "stage_unit", "level_unit", "wl_unit", "unit_wl", "unit")

RAINFALL_ALIASES = ("rainfall_mm_hr", "rainfall", "rainfall_rate", "rainfallRate", "precip_mm_hr", "precipitation", "precip", "rain", "rain_rate", "rainRate")
RAINFALL_UNIT_ALIASES = ("rainfall_unit", "rain_unit", "precip_unit", "rainUnit")

RATE_OF_RISE_ALIASES = ("rate_of_rise_cm_min", "rate_of_rise", "rateOfRise", "ror", "dh_dt", "rise_rate", "riseRate")
RATE_OF_RISE_UNIT_ALIASES = ("rate_of_rise_unit", "ror_unit", "rise_unit")

SOIL_MOISTURE_ALIASES = ("soil_moisture_pct", "soil_moisture", "soilMoisture", "sm", "vdr", "volumetric_moisture")
SOIL_MOISTURE_UNIT_ALIASES = ("soil_moisture_unit", "sm_unit")

TIMESTAMP_ALIASES = ("timestamp", "time", "datetime", "dt", "ts", "recorded_at", "observed_at")
SOURCE_ALIASES = ("source", "data_source", "dataSource", "provider", "provenance", "source_type")


def _get_first_match(data: Mapping[str, Any], aliases: tuple[str, ...]) -> Any:
	for key in aliases:
		if key in data and data[key] is not None:
			return data[key]
	return None


def parse_timestamp(value: Any) -> datetime:
	"""Parse heterogeneous timestamp inputs into timezone-aware UTC datetime."""
	if value is None:
		return datetime.now(timezone.utc)
	if isinstance(value, datetime):
		if value.tzinfo is None:
			return value.replace(tzinfo=timezone.utc)
		return value.astimezone(timezone.utc)
	if isinstance(value, (int, float)):
		# Handle epoch seconds vs milliseconds
		if math.isnan(value) or math.isinf(value):
			raise ValueError("Timestamp cannot be NaN or infinite")
		if value > 1e11:  # Epoch milliseconds
			return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc)
		return datetime.fromtimestamp(value, tz=timezone.utc)
	if isinstance(value, str):
		text = value.strip()
		if not text:
			return datetime.now(timezone.utc)
		# Replace standard ISO 'Z' or space
		text = text.replace("Z", "+00:00")
		try:
			dt = datetime.fromisoformat(text)
			if dt.tzinfo is None:
				return dt.replace(tzinfo=timezone.utc)
			return dt.astimezone(timezone.utc)
		except ValueError:
			# Fallback for unix timestamp string
			try:
				num = float(text)
				return parse_timestamp(num)
			except ValueError as error:
				raise ValueError(f"Malformed timestamp string: '{value}'") from error
	raise ValueError(f"Unsupported timestamp type: {type(value)}")


def normalize_water_level(value: Any, unit: str | None = None) -> float | None:
	"""Convert water level measurements to canonical centimeters (cm)."""
	if value is None:
		return None
	try:
		numeric = float(value)
	except (TypeError, ValueError) as error:
		raise ValueError(f"Invalid non-numeric water level value: {value}") from error
	if math.isnan(numeric) or math.isinf(numeric):
		raise ValueError("Water level cannot be NaN or infinite")

	unit_str = (unit or "cm").lower().strip()
	if unit_str in ("m", "meter", "meters"):
		return numeric * 100.0
	if unit_str in ("mm", "millimeter", "millimeters"):
		return numeric / 10.0
	if unit_str in ("in", "inch", "inches"):
		return numeric * 2.54
	if unit_str in ("ft", "feet"):
		return numeric * 30.48
	# Default assumes cm
	return numeric


def normalize_rainfall(value: Any, unit: str | None = None) -> float | None:
	"""Convert rainfall intensity to canonical millimeters per hour (mm/hr)."""
	if value is None:
		return None
	try:
		numeric = float(value)
	except (TypeError, ValueError) as error:
		raise ValueError(f"Invalid non-numeric rainfall value: {value}") from error
	if math.isnan(numeric) or math.isinf(numeric):
		raise ValueError("Rainfall cannot be NaN or infinite")

	unit_str = (unit or "mm/hr").lower().strip()
	if unit_str in ("in/hr", "in_hr", "inch/hr", "inches/hr"):
		return numeric * 25.4
	if unit_str in ("mm/min", "mm_min"):
		return numeric * 60.0
	if unit_str in ("m/hr", "m_hr"):
		return numeric * 1000.0
	# Default assumes mm/hr
	return numeric


def normalize_rate_of_rise(value: Any, unit: str | None = None) -> float | None:
	"""Convert water level rate of rise to canonical centimeters per minute (cm/min)."""
	if value is None:
		return None
	try:
		numeric = float(value)
	except (TypeError, ValueError) as error:
		raise ValueError(f"Invalid non-numeric rate of rise value: {value}") from error
	if math.isnan(numeric) or math.isinf(numeric):
		raise ValueError("Rate of rise cannot be NaN or infinite")

	unit_str = (unit or "cm/min").lower().strip()
	if unit_str in ("m/s", "m_s"):
		return numeric * 6000.0  # 1 m/s = 100 cm / (1/60 min) = 6000 cm/min
	if unit_str in ("cm/s", "cm_s"):
		return numeric * 60.0
	if unit_str in ("m/min", "m_min"):
		return numeric * 100.0
	if unit_str in ("m/hr", "m_hr"):
		return (numeric * 100.0) / 60.0
	if unit_str in ("cm/hr", "cm_hr"):
		return numeric / 60.0
	# Default assumes cm/min
	return numeric


def normalize_soil_moisture(value: Any, unit: str | None = None) -> float | None:
	"""Convert soil moisture to canonical percentage (0.0 - 100.0%)."""
	if value is None:
		return None
	try:
		numeric = float(value)
	except (TypeError, ValueError) as error:
		raise ValueError(f"Invalid non-numeric soil moisture value: {value}") from error
	if math.isnan(numeric) or math.isinf(numeric):
		raise ValueError("Soil moisture cannot be NaN or infinite")

	unit_str = (unit or "").lower().strip()
	# If fractional (0.0 to 1.0) and specified as fraction/decimal or value <= 1.0 without percent unit
	if unit_str in ("fraction", "decimal", "ratio", "vdr") or (0.0 <= numeric <= 1.0 and unit_str not in ("%", "pct", "percent")):
		return numeric * 100.0
	return numeric


def normalize_telemetry(raw: Mapping[str, Any] | TelemetryPayload, default_region_id: str = "mandakini") -> TelemetryPayload:
	"""Normalize arbitrary provider raw telemetry into canonical TelemetryPayload."""
	if isinstance(raw, TelemetryPayload):
		return raw

	if not isinstance(raw, Mapping):
		raise ValueError(f"Expected mapping/dict for telemetry normalization, got {type(raw)}")

	# 1. Device and Region Identifiers
	sensor_id_raw = _get_first_match(raw, SENSOR_ID_ALIASES)
	sensor_id = str(sensor_id_raw).strip() if sensor_id_raw is not None and str(sensor_id_raw).strip() else "UNKNOWN_SENSOR"

	region_id_raw = _get_first_match(raw, REGION_ID_ALIASES)
	region_id = str(region_id_raw).lower().strip() if region_id_raw is not None and str(region_id_raw).strip() else default_region_id.lower()

	# 2. Timestamp
	timestamp_raw = _get_first_match(raw, TIMESTAMP_ALIASES)
	timestamp = parse_timestamp(timestamp_raw)

	# 3. Source Metadata & Provenance
	source_raw = _get_first_match(raw, SOURCE_ALIASES)
	default_source = "sensor" if str(raw.get("data_status")) == "SENSOR_TELEMETRY" or source_raw is not None else "simulation"
	source = str(source_raw).strip() if source_raw is not None else default_source

	# 4. Units & Numerical Measurements
	wl_val = _get_first_match(raw, WATER_LEVEL_ALIASES)
	wl_unit = _get_first_match(raw, WATER_LEVEL_UNIT_ALIASES)
	water_level_cm = normalize_water_level(wl_val, wl_unit)
	water_level_source = str(raw.get("water_level_source") or source)

	rf_val = _get_first_match(raw, RAINFALL_ALIASES)
	rf_unit = _get_first_match(raw, RAINFALL_UNIT_ALIASES)
	rainfall_mm_hr = normalize_rainfall(rf_val, rf_unit)
	rainfall_source = str(raw.get("rainfall_source") or source)

	ror_val = _get_first_match(raw, RATE_OF_RISE_ALIASES)
	ror_unit = _get_first_match(raw, RATE_OF_RISE_UNIT_ALIASES)
	rate_of_rise_cm_min = normalize_rate_of_rise(ror_val, ror_unit)
	rate_of_rise_source = str(raw.get("rate_of_rise_source") or source)

	sm_val = _get_first_match(raw, SOIL_MOISTURE_ALIASES)
	sm_unit = _get_first_match(raw, SOIL_MOISTURE_UNIT_ALIASES)
	soil_moisture_pct = normalize_soil_moisture(sm_val, sm_unit)
	soil_moisture_source = str(raw.get("soil_moisture_source") or source)

	# 5. Status / Ingest state
	status = str(raw.get("status") or "UNKNOWN").upper()
	if status not in ("NORMAL", "WATCH", "CRITICAL", "FAULTY_STUCK", "DATA_UNAVAILABLE"):
		status = "UNKNOWN"

	data_status = str(raw.get("data_status") or ("SENSOR_TELEMETRY" if source != "simulation" else "SIMULATED_HYDROLOGY"))
	weather_status = str(raw.get("weather_status") or "UNKNOWN")
	weather_age = raw.get("weather_observation_age_seconds")
	if weather_age is not None:
		try:
			weather_age = int(weather_age)
		except (ValueError, TypeError):
			weather_age = None

	return TelemetryPayload(
		timestamp=timestamp,
		region_id=region_id,
		sensor_id=sensor_id,
		rainfall_mm_hr=rainfall_mm_hr if rainfall_mm_hr is not None else 0.0,
		rainfall_source=rainfall_source,
		water_level_cm=water_level_cm if water_level_cm is not None else 0.0,
		water_level_source=water_level_source,
		rate_of_rise_cm_min=rate_of_rise_cm_min if rate_of_rise_cm_min is not None else 0.0,
		rate_of_rise_source=rate_of_rise_source,
		soil_moisture_pct=soil_moisture_pct if soil_moisture_pct is not None else 0.0,
		soil_moisture_source=soil_moisture_source,
		status=status,
		data_status=data_status,
		weather_status=weather_status,
		weather_observation_age_seconds=weather_age,
	)
