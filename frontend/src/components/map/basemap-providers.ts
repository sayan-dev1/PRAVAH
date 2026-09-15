import type { BasemapMode, BasemapProviderConfig } from './types';

export const BASEMAP_PROVIDERS: Record<BasemapMode, BasemapProviderConfig> = {
  tactical: {
    id: 'tactical',
    label: 'Tactical Dark',
    url: 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=cb1_3m4q_1_a1ff34e5f7f9d20acea22559',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
    minZoom: 4,
    description: 'High-contrast subdued tactical dark canvas optimized for operational command visibility.',
  },
  terrain: {
    id: 'terrain',
    label: 'Topographic / Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org" target="_blank" rel="noreferrer">SRTM</a> | Style: &copy; <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a>',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 17,
    minZoom: 4,
    description: 'Topographic elevation contour basemap for steep mountain valley analysis.',
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
    minZoom: 4,
    description: 'High-resolution optical satellite surface context for ground terrain verification.',
  },
  offline: {
    id: 'offline',
    label: 'Offline MBTiles',
    url: (import.meta.env.VITE_OFFLINE_TILES_URL as string | undefined) || 'http://localhost:8080/styles/tactical/{z}/{x}/{y}.png',
    attribution: 'PRAVAH Offline Tile Cache (MBTiles / Local TileServer)',
    isOffline: true,
    maxZoom: 16,
    minZoom: 6,
    description: 'Local TileServer GL / MBTiles offline basemap instance for zero-connectivity deployment.',
  },
};

export const DEFAULT_BASEMAP: BasemapMode = 'tactical';
