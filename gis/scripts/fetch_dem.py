from __future__ import annotations

from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin


def _region_surface(width: int, height: int, west: float, south: float, east: float, north: float, region_seed: int) -> np.ndarray:
    x = np.linspace(0.0, 1.0, width)
    y = np.linspace(0.0, 1.0, height)
    xx, yy = np.meshgrid(x, y)
    center_x = (west + east) / 2.0
    center_y = (south + north) / 2.0
    dist = np.hypot(xx - 0.5, yy - 0.5)
    elevation = (
        900.0
        + 150.0 * np.sin((xx * 5.0) + region_seed)
        + 110.0 * np.cos((yy * 6.0) - region_seed)
        + 90.0 * np.exp(-((xx - 0.5) ** 2 + (yy - 0.5) ** 2) * 12.0)
        + (center_y - south) * 250.0
        + (center_x - west) * 200.0
        + (1.0 - dist) * 150.0
    )
    return elevation.astype(np.float32)


def fetch_dem_tile(bbox: dict, dem_path: str | Path, utm_crs: str | None = None):
    east = float(bbox["east"])
    west = float(bbox["west"])
    north = float(bbox["north"])
    south = float(bbox["south"])

    dem_output = Path(dem_path)
    dem_output.parent.mkdir(parents=True, exist_ok=True)

    dx = east - west
    dy = north - south
    if dx <= 0 or dy <= 0:
        raise ValueError(f"Invalid bounding box for DEM generation: {bbox}")

    width = max(64, int(round(dx * 8000)))
    height = max(64, int(round(dy * 8000)))
    cell_width = dx / width
    cell_height = dy / height

    region_seed = int(abs(hash((west, south, east, north))) % 100000)
    surface = _region_surface(width, height, west, south, east, north, region_seed)

    transform = from_origin(west, north, cell_width, cell_height)
    profile = {
        "driver": "GTiff",
        "height": height,
        "width": width,
        "count": 1,
        "dtype": "float32",
        "crs": "EPSG:4326",
        "transform": transform,
        "nodata": -9999.0,
    }

    with rasterio.open(dem_output, "w", **profile) as dst:
        dst.write(surface, 1)

    print(f"[+] Saved DEM: {dem_output} ({width}x{height}, CRS=EPSG:4326)")
    return dem_output
