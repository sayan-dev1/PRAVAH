"""Application settings and operational thresholds."""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
TICK_SECONDS = 2
WATCH_THRESHOLD = 1.0
CRITICAL_THRESHOLD = 2.0
UPSTREAM_DISTANCE_KM = 8.4
PROPAGATION_SPEED_KM_H = 4.0
ALLOWED_ORIGINS = ["http://localhost:4173", "http://localhost:5173", "http://localhost:3000"]

