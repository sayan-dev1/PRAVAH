"""Comprehensive tests for Open-Meteo Weather Integration (Task 1 / order.txt).

Verifies:
1. Open-Meteo request construction (hourly, current, timezone=auto).
2. Correct region coordinates.
3. Mandakini request.
4. Beas/Kullu request.
5. Rainfall extraction.
6. Rain/rain-showers extraction.
7. Precipitation probability.
8. All five soil-moisture depths.
9. Correct soil-moisture units (m³/m³).
10. Current weather extraction.
11. Hourly data extraction.
12. Forecast separation.
13. Source/provider metadata.
14. Missing variables handling.
15. Malformed API response handling.
16. API timeout/failure handling.
17. Invalid region handling.
18. No hardcoded coordinate fallback.
19. No fake weather fallback.
20. Region isolation between Mandakini and Beas/Kullu.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
import pytest

from app.services.region_registry import get_region
from app.services.weather import (
	BaseWeatherProvider,
	CanonicalWeatherReading,
	OpenMeteoProvider,
	RawWeatherPayload,
	WeatherService,
	normalize_weather,
)


class MockWeatherProvider(BaseWeatherProvider):
	"""Mock provider simulating deterministic responses for testing."""

	def __init__(self, name: str = "open_meteo", raw_response: RawWeatherPayload | None = None) -> None:
		self._name = name
		self._raw_response = raw_response
		self.last_coordinates: tuple[float, float] | None = None

	@property
	def name(self) -> str:
		return self._name

	def fetch(self, latitude: float, longitude: float, timeout_seconds: float = 4.0) -> RawWeatherPayload:
		self.last_coordinates = (latitude, longitude)
		if self._raw_response:
			return self._raw_response
		return RawWeatherPayload(
			provider=self.name,
			latitude=latitude,
			longitude=longitude,
			timestamp=datetime.now(timezone.utc),
			raw_data={
				"current": {
					"time": "2026-09-16T02:00",
					"precipitation": 18.5,
					"rain": 15.0,
					"showers": 3.5,
					"temperature_2m": 16.2,
					"relative_humidity_2m": 88.0,
					"cloud_cover": 75,
					"wind_speed_10m": 4.5,
					"wind_gusts_10m": 12.0,
					"is_day": 1,
				},
				"hourly": {
					"time": ["2026-09-16T02:00", "2026-09-16T03:00", "2026-09-16T04:00"],
					"precipitation": [18.5, 12.0, 6.0],
					"rain": [15.0, 10.0, 5.0],
					"showers": [3.5, 2.0, 1.0],
					"precipitation_probability": [85.0, 60.0, 40.0],
					"soil_moisture_0_to_1cm": [0.42, 0.40, 0.38],
					"soil_moisture_1_to_3cm": [0.41, 0.39, 0.37],
					"soil_moisture_3_to_9cm": [0.40, 0.38, 0.36],
					"soil_moisture_9_to_27cm": [0.38, 0.37, 0.35],
					"soil_moisture_27_to_81cm": [0.35, 0.34, 0.33],
					"temperature_2m": [16.2, 15.8, 15.0],
					"relative_humidity_2m": [88.0, 85.0, 80.0],
					"surface_pressure": [1012.5, 1012.0, 1011.8],
					"cloud_cover": [75, 80, 85],
					"wind_speed_10m": [4.5, 5.0, 5.5],
					"wind_gusts_10m": [12.0, 14.0, 15.0],
				},
			},
			status_code=200,
		)


def test_1_open_meteo_request_construction():
	"""1. Verify Open-Meteo request params include all requested variables and timezone=auto."""
	provider = OpenMeteoProvider()
	with patch("app.services.weather.open_meteo.urlopen") as mock_urlopen:
		mock_resp = MagicMock()
		mock_resp.getcode.return_value = 200
		mock_resp.read.return_value = b'{"current": {}, "hourly": {}}'
		mock_urlopen.return_value.__enter__.return_value = mock_resp

		provider.fetch(30.548, 79.068, timeout_seconds=2.0)

		# Inspect request URL passed to urlopen
		assert mock_urlopen.called
		request_obj = mock_urlopen.call_args[0][0]
		full_url = request_obj.full_url
		assert "latitude=30.548" in full_url
		assert "longitude=79.068" in full_url
		assert "timezone=auto" in full_url
		assert "soil_moisture_0_to_1cm" in full_url
		assert "soil_moisture_27_to_81cm" in full_url
		assert "precipitation_probability" in full_url
		assert "surface_pressure" in full_url


def test_2_correct_region_coordinates_resolution():
	"""2. Verify coordinates are correctly resolved from region registry without hardcoding."""
	service = WeatherService()
	mandakini_cfg = get_region("mandakini")
	lat, lon = service._coordinates("mandakini")
	assert (lat, lon) == (float(mandakini_cfg["center"][0]), float(mandakini_cfg["center"][1]))


def test_3_mandakini_request():
	"""3. Verify Mandakini weather request uses Mandakini's configured coordinates."""
	service = WeatherService()
	mock = MockWeatherProvider()
	service.register_provider(mock, set_as_default=True)

	reading = service.fetch_weather("mandakini")
	mandakini_cfg = get_region("mandakini")
	expected_coords = (float(mandakini_cfg["center"][0]), float(mandakini_cfg["center"][1]))

	assert mock.last_coordinates == expected_coords
	assert reading.region_id == "mandakini"
	assert reading.status == "LIVE"


def test_4_beas_kullu_request():
	"""4. Verify Beas/Kullu weather request uses Beas/Kullu's configured coordinates."""
	service = WeatherService()
	mock = MockWeatherProvider()
	service.register_provider(mock, set_as_default=True)

	reading = service.fetch_weather("beas_kullu")
	beas_cfg = get_region("beas_kullu")
	expected_coords = (float(beas_cfg["center"][0]), float(beas_cfg["center"][1]))

	assert mock.last_coordinates == expected_coords
	assert reading.region_id == "beas_kullu"
	assert reading.status == "LIVE"


def test_5_rainfall_extraction():
	"""5. Verify rainfall/precipitation rate extraction."""
	raw = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.335,
		longitude=78.985,
		timestamp=datetime.now(timezone.utc),
		raw_data={
			"current": {"precipitation": 24.5, "rain": 20.0, "showers": 4.5},
			"hourly": {
				"time": ["2026-09-16T02:00", "2026-09-16T03:00"],
				"precipitation": [24.5, 15.0],
				"rain": [20.0, 12.0],
				"showers": [4.5, 3.0],
			},
		},
		status_code=200,
	)
	canonical = normalize_weather(raw)
	assert canonical.precipitation_rate_mm_hr == 24.5
	assert canonical.rain_rate_mm_hr == 20.0


def test_6_rain_and_showers_extraction():
	"""6. Verify separate extraction of rain vs showers."""
	raw = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.335,
		longitude=78.985,
		timestamp=datetime.now(timezone.utc),
		raw_data={
			"current": {"precipitation": 10.0, "rain": 7.0, "showers": 3.0},
			"hourly": {"time": ["2026-09-16T02:00"], "precipitation": [10.0], "rain": [7.0], "showers": [3.0]},
		},
		status_code=200,
	)
	canonical = normalize_weather(raw)
	assert canonical.current is not None
	assert canonical.current.precipitation == 10.0
	assert canonical.current.rain == 7.0
	assert canonical.current.showers == 3.0


def test_7_precipitation_probability():
	"""7. Verify precipitation probability extraction in hourly and forecast."""
	raw = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.335,
		longitude=78.985,
		timestamp=datetime.now(timezone.utc),
		raw_data={
			"hourly": {
				"time": ["2026-09-16T02:00", "2026-09-16T03:00"],
				"precipitation": [5.0, 8.0],
				"precipitation_probability": [75.0, 90.0],
			},
		},
		status_code=200,
	)
	canonical = normalize_weather(raw)
	assert len(canonical.hourly) == 2
	assert canonical.hourly[0].precipitation_probability == 75.0
	assert len(canonical.forecast) == 1
	assert canonical.forecast[0].precipitation_probability == 90.0


def test_8_all_five_soil_moisture_depths():
	"""8. Verify all five requested soil-moisture depths are extracted."""
	raw = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.335,
		longitude=78.985,
		timestamp=datetime.now(timezone.utc),
		raw_data={
			"hourly": {
				"time": ["2026-09-16T02:00"],
				"soil_moisture_0_to_1cm": [0.45],
				"soil_moisture_1_to_3cm": [0.43],
				"soil_moisture_3_to_9cm": [0.41],
				"soil_moisture_9_to_27cm": [0.38],
				"soil_moisture_27_to_81cm": [0.34],
			},
		},
		status_code=200,
	)
	canonical = normalize_weather(raw)
	assert canonical.soil_moisture is not None
	assert canonical.soil_moisture.depth_0_1cm.value == 0.45
	assert canonical.soil_moisture.depth_1_3cm.value == 0.43
	assert canonical.soil_moisture.depth_3_9cm.value == 0.41
	assert canonical.soil_moisture.depth_9_27cm.value == 0.38
	assert canonical.soil_moisture.depth_27_81cm.value == 0.34


def test_9_soil_moisture_units_are_m3_m3():
	"""9. Verify soil moisture retains physical m³/m³ units."""
	raw = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.335,
		longitude=78.985,
		timestamp=datetime.now(timezone.utc),
		raw_data={
			"hourly": {
				"time": ["2026-09-16T02:00"],
				"soil_moisture_0_to_1cm": [0.382],
			},
		},
		status_code=200,
	)
	canonical = normalize_weather(raw)
	assert canonical.soil_moisture is not None
	assert canonical.soil_moisture.depth_0_1cm.unit == "m³/m³"
	assert canonical.soil_moisture.depth_0_1cm.value == 0.382
	assert canonical.soil_moisture_vdr == 0.382


def test_10_current_weather_extraction():
	"""10. Verify current weather block extraction."""
	raw = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.335,
		longitude=78.985,
		timestamp=datetime.now(timezone.utc),
		raw_data={
			"current": {
				"time": "2026-09-16T02:30",
				"precipitation": 2.5,
				"rain": 2.0,
				"showers": 0.5,
				"temperature_2m": 18.0,
				"relative_humidity_2m": 85.0,
				"cloud_cover": 90,
				"wind_speed_10m": 6.2,
				"wind_gusts_10m": 18.5,
				"is_day": 0,
			},
			"hourly": {"time": ["2026-09-16T02:00"]},
		},
		status_code=200,
	)
	canonical = normalize_weather(raw)
	assert canonical.current is not None
	assert canonical.current.precipitation == 2.5
	assert canonical.current.temperature_2m == 18.0
	assert canonical.current.relative_humidity_2m == 85.0
	assert canonical.current.is_day == 0


def test_11_hourly_data_extraction():
	"""11. Verify hourly weather array extraction."""
	raw = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.335,
		longitude=78.985,
		timestamp=datetime.now(timezone.utc),
		raw_data={
			"hourly": {
				"time": ["2026-09-16T02:00", "2026-09-16T03:00"],
				"precipitation": [1.0, 2.0],
				"temperature_2m": [15.0, 14.5],
			},
		},
		status_code=200,
	)
	canonical = normalize_weather(raw)
	assert len(canonical.hourly) == 2
	assert canonical.hourly[0].timestamp == "2026-09-16T02:00"
	assert canonical.hourly[0].precipitation == 1.0
	assert canonical.hourly[1].precipitation == 2.0


def test_12_forecast_separation():
	"""12. Verify forecast data is separated from observed/current precipitation."""
	raw = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.335,
		longitude=78.985,
		timestamp=datetime.now(timezone.utc),
		raw_data={
			"current": {"precipitation": 0.0},
			"hourly": {
				"time": ["2026-09-16T02:00", "2026-09-16T03:00", "2026-09-16T04:00"],
				"precipitation": [0.0, 12.0, 25.0],
			},
		},
		status_code=200,
	)
	canonical = normalize_weather(raw)
	# Current observed precipitation is 0.0
	assert canonical.precipitation_rate_mm_hr == 0.0
	# Forecast records contain future steps
	assert len(canonical.forecast) == 2
	assert canonical.forecast[0].precipitation == 12.0
	assert canonical.forecast[1].precipitation == 25.0


def test_13_source_provider_metadata():
	"""13. Verify source='weather_api' and provider='open_meteo' provenance."""
	raw = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.335,
		longitude=78.985,
		timestamp=datetime.now(timezone.utc),
		raw_data={"hourly": {"time": ["2026-09-16T02:00"]}},
		status_code=200,
	)
	canonical = normalize_weather(raw)
	assert canonical.provider == "open_meteo"
	assert canonical.provenance == "MODEL_WEATHER"
	assert canonical.soil_moisture is not None
	assert canonical.soil_moisture.source == "weather_api"


def test_14_missing_variables():
	"""14. Verify missing variables in API response do not cause crashes or fabrication."""
	raw = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.335,
		longitude=78.985,
		timestamp=datetime.now(timezone.utc),
		raw_data={"hourly": {"time": ["2026-09-16T02:00"]}},  # No precipitation, rain, or soil moisture
		status_code=200,
	)
	canonical = normalize_weather(raw)
	assert canonical.status == "LIVE"
	assert canonical.precipitation_rate_mm_hr is None
	assert canonical.rain_rate_mm_hr is None
	assert canonical.soil_moisture is not None
	assert canonical.soil_moisture.depth_0_1cm.value is None


def test_15_malformed_api_response():
	"""15. Verify malformed API payload produces ERROR status without crash."""
	raw = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.335,
		longitude=78.985,
		timestamp=datetime.now(timezone.utc),
		raw_data="not_a_dict",  # type: ignore
		status_code=200,
	)
	canonical = normalize_weather(raw)
	assert canonical.status == "ERROR"
	assert canonical.error == "Malformed raw weather data structure"


def test_16_api_timeout_failure():
	"""16. Verify API failure/timeout produces UNAVAILABLE status without fabricating numbers."""
	raw = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.335,
		longitude=78.985,
		timestamp=datetime.now(timezone.utc),
		raw_data={},
		status_code=503,
		error="Connection timed out",
	)
	canonical = normalize_weather(raw)
	assert canonical.status == "ERROR"
	assert canonical.precipitation_rate_mm_hr is None
	assert canonical.soil_moisture_vdr is None


def test_17_invalid_region():
	"""17. Verify invalid region returns UNAVAILABLE status gracefully."""
	service = WeatherService()
	reading = service.fetch_weather("invalid_nonexistent_region")
	assert reading.status == "UNAVAILABLE"
	assert "Invalid region" in (reading.error or "")


def test_18_no_hardcoded_coordinate_fallback():
	"""18. Verify region without coordinates returns UNAVAILABLE instead of fallback."""
	service = WeatherService()
	with patch("app.services.weather.service.get_region") as mock_get_region:
		mock_get_region.return_value = {"region_id": "no_coords_region"}  # No center or weather coords
		reading = service.fetch_weather("no_coords_region")
		assert reading.status == "UNAVAILABLE"
		assert "Coordinate resolution failed" in (reading.error or "")


def test_19_no_fake_weather_fallback():
	"""19. Verify complete absence of fake numbers when provider fails without cache."""
	service = WeatherService()
	mock = MockWeatherProvider(
		name="open_meteo",
		raw_response=RawWeatherPayload(
			provider="open_meteo",
			latitude=30.0,
			longitude=79.0,
			timestamp=datetime.now(timezone.utc),
			raw_data={},
			status_code=500,
			error="Internal Open-Meteo Server Error",
		),
	)
	service.register_provider(mock, set_as_default=True)
	reading = service.fetch_weather("mandakini")
	assert reading.status in ("ERROR", "UNAVAILABLE")
	assert reading.precipitation_rate_mm_hr is None
	assert reading.soil_moisture_vdr is None


def test_20_region_isolation():
	"""20. Verify Mandakini and Beas/Kullu requests maintain strict state isolation."""
	service = WeatherService()
	mandakini_resp = RawWeatherPayload(
		provider="open_meteo",
		latitude=30.548,
		longitude=79.068,
		timestamp=datetime.now(timezone.utc),
		raw_data={
			"current": {"precipitation": 45.0, "rain": 40.0},
			"hourly": {"time": ["2026-09-16T02:00"], "precipitation": [45.0], "soil_moisture_0_to_1cm": [0.49]},
		},
		status_code=200,
	)
	beas_resp = RawWeatherPayload(
		provider="open_meteo",
		latitude=31.957,
		longitude=77.109,
		timestamp=datetime.now(timezone.utc),
		raw_data={
			"current": {"precipitation": 2.0, "rain": 2.0},
			"hourly": {"time": ["2026-09-16T02:00"], "precipitation": [2.0], "soil_moisture_0_to_1cm": [0.31]},
		},
		status_code=200,
	)

	# Fetch Mandakini
	with patch.object(service._providers["open_meteo"], "fetch", return_value=mandakini_resp):
		m_reading = service.fetch_weather("mandakini")
		assert m_reading.precipitation_rate_mm_hr == 45.0
		assert m_reading.soil_moisture_vdr == 0.49

	# Fetch Beas
	with patch.object(service._providers["open_meteo"], "fetch", return_value=beas_resp):
		b_reading = service.fetch_weather("beas_kullu")
		assert b_reading.precipitation_rate_mm_hr == 2.0
		assert b_reading.soil_moisture_vdr == 0.31

	# Verify Mandakini cache in service remains untouched
	cached_m = service.latest_weather("mandakini")
	assert cached_m.precipitation_rate_mm_hr == 45.0
	assert cached_m.soil_moisture_vdr == 0.49
