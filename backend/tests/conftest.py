import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend package is in python path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app
from app.core.state import state_engine


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    # Reset state engine before each test for test isolation
    state_engine.set_surge(False)
    state_engine._latest = None
    state_engine._readings.clear()
    with TestClient(app) as test_client:
        yield test_client
