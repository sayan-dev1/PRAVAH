"""Weather normalization layer.

Transforms raw provider meteorological payloads into canonical PRAVAH weather objects,
preserving physical units (m³/m³, mm, hPa) and data provenance.
"""

from datetime import datetime, timezone
from typing import Any

from app.services.weather.models import (
	CanonicalWeatherReading,
	CurrentWeather,
	ForecastRecord,
	HourlyWeatherItem,
	RawWeatherPayload,
	SoilMoistureDepthItem,
	SoilMoistureDepths,
)


def _safe_float(val: Any) -> float | None:
	if val is None:
		return None
	try:
		return float(val)
	except (ValueError, TypeError):
		return None


def _safe_int(val: Any) -> int | None:
	if val is None:
		return None
	try:
		return int(val)
	except (ValueError, TypeError):
		return None


def normalize_weather(raw: RawWeatherPayload) -> CanonicalWeatherReading:
	"""Normalize raw provider payload into canonical PRAVAH weather data structure."""
	now_utc = datetime.now(timezone.utc)

	if raw.error or raw.status_code != 200:
		status = "RATE_LIMITED" if raw.status_code == 429 else "ERROR" if raw.status_code >= 500 else "UNAVAILABLE"
		return CanonicalWeatherReading(
			provider=raw.provider,
			provenance="MODEL_WEATHER",
			timestamp=raw.timestamp,
			status=status,
			updated_at=now_utc,
			error=raw.error or f"Provider returned HTTP {raw.status_code}",
		)

	data = raw.raw_data
	if not isinstance(data, dict):
		return CanonicalWeatherReading(
			provider=raw.provider,
			provenance="MODEL_WEATHER",
			timestamp=raw.timestamp,
			status="ERROR",
			updated_at=now_utc,
			error="Malformed raw weather data structure",
		)

	hourly_raw = data.get("hourly")
	if not isinstance(hourly_raw, dict):
		return CanonicalWeatherReading(
			provider=raw.provider,
			provenance="MODEL_WEATHER",
			timestamp=raw.timestamp,
			status="UNAVAILABLE",
			updated_at=now_utc,
			error="Missing 'hourly' meteorological block",
		)

	# 1. Parse Current Weather block if available
	current_obj: CurrentWeather | None = None
	current_raw = data.get("current")
	if isinstance(current_raw, dict):
		current_obj = CurrentWeather(
			timestamp=str(current_raw.get("time")) if current_raw.get("time") else None,
			precipitation=_safe_float(current_raw.get("precipitation")),
			rain=_safe_float(current_raw.get("rain")),
			showers=_safe_float(current_raw.get("showers")),
			temperature_2m=_safe_float(current_raw.get("temperature_2m")),
			relative_humidity_2m=_safe_float(current_raw.get("relative_humidity_2m")),
			cloud_cover=_safe_float(current_raw.get("cloud_cover")),
			wind_speed_10m=_safe_float(current_raw.get("wind_speed_10m")),
			wind_gusts_10m=_safe_float(current_raw.get("wind_gusts_10m")),
			is_day=_safe_int(current_raw.get("is_day")),
			source="weather_api",
			provider=raw.provider,
		)

	# 2. Parse Hourly Series
	times = hourly_raw.get("time", [])
	if not isinstance(times, list):
		times = []

	def _get_series(key: str) -> list[Any]:
		val = hourly_raw.get(key, [])
		return val if isinstance(val, list) else []

	precip_series = [_safe_float(v) for v in _get_series("precipitation")]
	rain_series = [_safe_float(v) for v in _get_series("rain")]
	showers_series = [_safe_float(v) for v in _get_series("showers")]
	prob_series = [_safe_float(v) for v in _get_series("precipitation_probability")]
	temp_series = [_safe_float(v) for v in _get_series("temperature_2m")]
	rh_series = [_safe_float(v) for v in _get_series("relative_humidity_2m")]
	pressure_series = [_safe_float(v) for v in _get_series("surface_pressure")]
	cloud_series = [_safe_float(v) for v in _get_series("cloud_cover")]
	wind_series = [_safe_float(v) for v in _get_series("wind_speed_10m")]
	gust_series = [_safe_float(v) for v in _get_series("wind_gusts_10m")]

	# 5 soil moisture depth horizons
	sm_0_1_series = [_safe_float(v) for v in _get_series("soil_moisture_0_to_1cm")]
	sm_1_3_series = [_safe_float(v) for v in _get_series("soil_moisture_1_to_3cm")]
	sm_3_9_series = [_safe_float(v) for v in _get_series("soil_moisture_3_to_9cm")]
	sm_9_27_series = [_safe_float(v) for v in _get_series("soil_moisture_9_to_27cm")]
	sm_27_81_series = [_safe_float(v) for v in _get_series("soil_moisture_27_to_81cm")]

	# Fallback for 0-7cm if 0-1cm absent
	sm_0_7_series = [_safe_float(v) for v in _get_series("soil_moisture_0_to_7cm")]

	hourly_items: list[HourlyWeatherItem] = []
	forecast_records: list[ForecastRecord] = []

	num_steps = len(times)
	for i in range(num_steps):
		t_str = str(times[i])
		p_val = precip_series[i] if i < len(precip_series) else None
		r_val = rain_series[i] if i < len(rain_series) else None
		s_val = showers_series[i] if i < len(showers_series) else None
		prob_val = prob_series[i] if i < len(prob_series) else None

		sm_item = SoilMoistureDepths(
			depth_0_1cm=SoilMoistureDepthItem(
				value=sm_0_1_series[i] if i < len(sm_0_1_series) else (sm_0_7_series[i] if i < len(sm_0_7_series) else None),
				unit="m³/m³",
			),
			depth_1_3cm=SoilMoistureDepthItem(value=sm_1_3_series[i] if i < len(sm_1_3_series) else None, unit="m³/m³"),
			depth_3_9cm=SoilMoistureDepthItem(value=sm_3_9_series[i] if i < len(sm_3_9_series) else None, unit="m³/m³"),
			depth_9_27cm=SoilMoistureDepthItem(value=sm_9_27_series[i] if i < len(sm_9_27_series) else None, unit="m³/m³"),
			depth_27_81cm=SoilMoistureDepthItem(value=sm_27_81_series[i] if i < len(sm_27_81_series) else None, unit="m³/m³"),
			source="weather_api",
			provider=raw.provider,
		)

		item = HourlyWeatherItem(
			timestamp=t_str,
			precipitation=p_val,
			rain=r_val,
			showers=s_val,
			precipitation_probability=prob_val,
			temperature_2m=temp_series[i] if i < len(temp_series) else None,
			relative_humidity_2m=rh_series[i] if i < len(rh_series) else None,
			surface_pressure=pressure_series[i] if i < len(pressure_series) else None,
			cloud_cover=cloud_series[i] if i < len(cloud_series) else None,
			wind_speed_10m=wind_series[i] if i < len(wind_series) else None,
			wind_gusts_10m=gust_series[i] if i < len(gust_series) else None,
			soil_moisture=sm_item,
			source="weather_api",
			provider=raw.provider,
		)
		hourly_items.append(item)

		# Forecast records (separately preserved for forecast evaluations)
		if i > 0:  # i > 0 are future forecast steps
			forecast_records.append(
				ForecastRecord(
					timestamp=t_str,
					precipitation=p_val,
					rain=r_val,
					showers=s_val,
					precipitation_probability=prob_val,
					source="weather_api",
					provider=raw.provider,
				)
			)

	# 3. Build Canonical Soil Moisture object for top of payload
	current_sm = SoilMoistureDepths(
		depth_0_1cm=SoilMoistureDepthItem(
			value=sm_0_1_series[0] if sm_0_1_series else (sm_0_7_series[0] if sm_0_7_series else None),
			unit="m³/m³",
		),
		depth_1_3cm=SoilMoistureDepthItem(value=sm_1_3_series[0] if sm_1_3_series else None, unit="m³/m³"),
		depth_3_9cm=SoilMoistureDepthItem(value=sm_3_9_series[0] if sm_3_9_series else None, unit="m³/m³"),
		depth_9_27cm=SoilMoistureDepthItem(value=sm_9_27_series[0] if sm_9_27_series else None, unit="m³/m³"),
		depth_27_81cm=SoilMoistureDepthItem(value=sm_27_81_series[0] if sm_27_81_series else None, unit="m³/m³"),
		source="weather_api",
		provider=raw.provider,
	)

	# Primary scalars (current or first hourly step)
	current_p = current_obj.precipitation if current_obj and current_obj.precipitation is not None else (precip_series[0] if precip_series else None)
	current_r = current_obj.rain if current_obj and current_obj.rain is not None else (rain_series[0] if rain_series else None)
	current_rh = current_obj.relative_humidity_2m if current_obj and current_obj.relative_humidity_2m is not None else (rh_series[0] if rh_series else None)

	# Topsoil volumetric fraction
	sm_vdr = current_sm.depth_0_1cm.value
	sm_pct = round(sm_vdr * 100.0, 1) if (sm_vdr is not None and sm_vdr <= 1.0) else sm_vdr

	# Rolling forecast accumulations
	valid_precips = [p for p in precip_series if p is not None]
	forecast_1h = sum(valid_precips[:1]) if len(valid_precips) >= 1 else None
	forecast_3h = sum(valid_precips[:3]) if len(valid_precips) >= 3 else None
	forecast_6h = sum(valid_precips[:6]) if len(valid_precips) >= 6 else None
	forecast_24h = sum(valid_precips[:24]) if len(valid_precips) >= 24 else (sum(valid_precips) if valid_precips else None)

	valid_rains = [r for r in rain_series if r is not None]
	rain_24h = sum(valid_rains[:24]) if len(valid_rains) >= 24 else (sum(valid_rains) if valid_rains else forecast_24h)

	return CanonicalWeatherReading(
		provider=raw.provider,
		provenance="MODEL_WEATHER",
		timestamp=raw.timestamp,
		current=current_obj,
		hourly=hourly_items,
		forecast=forecast_records,
		soil_moisture=current_sm,
		precipitation_rate_mm_hr=current_p,
		rain_rate_mm_hr=current_r,
		rain_24h_mm=round(rain_24h, 1) if rain_24h is not None else None,
		forecast_precipitation_1h_mm=round(forecast_1h, 2) if forecast_1h is not None else None,
		forecast_precipitation_3h_mm=round(forecast_3h, 2) if forecast_3h is not None else None,
		forecast_precipitation_6h_mm=round(forecast_6h, 2) if forecast_6h is not None else None,
		forecast_precipitation_24h_mm=round(forecast_24h, 1) if forecast_24h is not None else None,
		relative_humidity_pct=current_rh,
		soil_moisture_vdr=sm_vdr,
		soil_moisture_pct=sm_pct,
		status="LIVE",
		updated_at=now_utc,
		error=None,
	)
