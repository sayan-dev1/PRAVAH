from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.features import geometry_mask
from shapely.geometry import mapping


def _compute_slope_and_twi(dem: np.ndarray, resolution_m: float = 30.0):
    dem = np.asarray(dem, dtype=np.float32)
    valid = dem[np.isfinite(dem)]
    if valid.size:
        dem = np.where(np.isfinite(dem), dem, float(valid.mean()))
    else:
        dem = np.zeros_like(dem, dtype=np.float32)

    grad_y, grad_x = np.gradient(dem, resolution_m, axis=(0, 1))
    slope_rad = np.arctan(np.hypot(grad_x, grad_y))
    slope_deg = np.degrees(slope_rad)
    slope_rad = np.where(slope_rad < 1e-6, 1e-6, slope_rad)

    relief = dem - np.nanmin(dem)
    flow_acc = 1.0 + (relief / max(float(np.nanmax(relief) or 1.0), 1.0)) * 200.0
    flow_acc = np.clip(flow_acc.astype(np.float32), 1.0, None)

    twi = np.clip(np.log(((flow_acc + 1.0) * resolution_m) / np.tan(slope_rad)), 0.0, 30.0)
    return slope_deg, flow_acc, twi


def _zonal_stats_for_geometry(gdf: gpd.GeoDataFrame, raster_path: Path):
    stats = []
    with rasterio.open(raster_path) as src:
        raster = src.read(1)
        transform = src.transform
        for geometry in gdf.geometry:
            if geometry is None or geometry.is_empty:
                stats.append((0.0, 0.0))
                continue
            mask = geometry_mask([mapping(geometry)], out_shape=raster.shape, transform=transform, invert=True)
            values = raster[mask]
            if values.size == 0:
                stats.append((0.0, 0.0))
            else:
                stats.append((float(values.mean()), float(values.max())))
    return stats


def compute_hydrology(dem_path: Path, settlements_path: Path, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    print("[*] Ingesting DEM and running terrain processing...")

    with rasterio.open(dem_path) as src:
        dem = src.read(1).astype(np.float32)
        transform = src.transform
        profile = src.profile.copy()
        profile.update(dtype=rasterio.float32, count=1, nodata=-9999)

    slope_deg, flow_acc, twi = _compute_slope_and_twi(dem, resolution_m=30.0)

    with rasterio.open(out_dir / "slope.tif", "w", **profile) as dst:
        dst.write(slope_deg.astype(np.float32), 1)
    with rasterio.open(out_dir / "flow_accumulation.tif", "w", **profile) as dst:
        dst.write(flow_acc.astype(np.float32), 1)
    with rasterio.open(out_dir / "twi.tif", "w", **profile) as dst:
        dst.write(twi.astype(np.float32), 1)

    print("[+] Generated: slope.tif, flow_accumulation.tif, twi.tif")

    settlements = gpd.read_file(settlements_path)
    if settlements.empty:
        raise ValueError(f"No settlement polygons available in {settlements_path}")

    twi_stats = _zonal_stats_for_geometry(settlements, out_dir / "twi.tif")
    slope_stats = _zonal_stats_for_geometry(settlements, out_dir / "slope.tif")

    df = pd.DataFrame({
        "village_id": settlements["village_id"],
        "mean_twi": [round(mean, 2) for mean, _ in twi_stats],
        "max_twi": [round(max_value, 2) for _, max_value in twi_stats],
        "mean_slope_deg": [round(mean, 2) for mean, _ in slope_stats],
        "max_slope_deg": [round(max_value, 2) for _, max_value in slope_stats],
    })

    csv_path = out_dir / "terrain_features.csv"
    df.to_csv(csv_path, index=False)
    print(f"[+] Exported terrain features: {csv_path}")
    return df
