import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BASEMAP_PROVIDERS,
  DEFAULT_BASEMAP,
} from './map/basemap-providers';
import { MapControls } from './map/map-controls';
import {
  EvacuationRouteLayer,
  GaugeLayer,
  IncidentReticleLayer,
  RiverLayer,
  SettlementsLayer,
  SheltersLayer,
  villagePosition,
} from './map/operational-layers';
import { RadarLayer } from './map/radar-layer';
import { TacticalMapLegend } from './map/tactical-map-legend';
import type { BasemapMode, DataProvenance, TacticalMapProps } from './map/types';

const defaultIndiaCenter: [number, number] = [20.5937, 78.9629];
const defaultIndiaBounds: [[number, number], [number, number]] = [
  [8.0, 68.0],
  [37.0, 97.0],
];

function FitRegionExtent({ region }: { region?: TacticalMapProps['region'] }) {
  const map = useMap();

  useEffect(() => {
    if (!region) return;
    if (region.bounds) {
      map.fitBounds(region.bounds, { padding: [40, 40], maxZoom: 14, animate: true });
    } else if (region.center) {
      map.setView(region.center, 12, { animate: true });
    }
  }, [map, region?.region_id, region?.bounds, region?.center]);

  return null;
}

export function TacticalLeafletMap({
  telemetry,
  villages,
  region,
  layers,
  selectedVillage,
  onSelectVillage,
  className = '',
}: TacticalMapProps) {
  // Basemap State
  const [basemap, setBasemap] = useState<BasemapMode>(DEFAULT_BASEMAP);

  // Overlay Visibility Toggles
  const [riverVisible, setRiverVisible] = useState(true);
  const [settlementsVisible, setSettlementsVisible] = useState(true);
  const [sheltersVisible, setSheltersVisible] = useState(true);
  const [gaugesVisible, setGaugesVisible] = useState(true);
  const [evacVisible, setEvacVisible] = useState(true);

  // Radar Overlay State
  const [radarVisible, setRadarVisible] = useState(false);
  const [radarOpacity, setRadarOpacity] = useState(0.5);
  const [radarAvailable, setRadarAvailable] = useState(true);

  // Active Basemap Configuration
  const currentBasemap = BASEMAP_PROVIDERS[basemap] ?? BASEMAP_PROVIDERS.tactical;

  // Layer Availability Check
  const hasRivers = Boolean(layers?.river && layers.river.features.length > 0);
  const hasSettlements = Boolean(villages.length > 0 || (layers?.villages && layers.villages.features.length > 0));
  const hasShelters = Boolean(layers?.shelters && layers.shelters.features.length > 0);
  const hasEvacuation = Boolean(layers?.evacuation && layers.evacuation.features.length > 0);
  const hasTelemetry = Boolean(telemetry !== null);

  const status = telemetry?.status ?? 'NORMAL';

  const mapCenter = region?.center ?? defaultIndiaCenter;
  const mapBounds = region?.bounds ?? defaultIndiaBounds;

  // Selected Village Information for Focus
  const selectedVillageObj = useMemo(() => {
    return villages.find((v) => v.id === selectedVillage) ?? null;
  }, [villages, selectedVillage]);

  // Determine incident position for reticle
  const incidentPosition = useMemo((): [number, number] | null => {
    if (selectedVillageObj) {
      return villagePosition(layers, selectedVillageObj, region);
    }
    const criticalVillage = villages.find((v) => v.status === 'CRITICAL') ?? villages.find((v) => v.status === 'WATCH');
    if (criticalVillage) {
      return villagePosition(layers, criticalVillage, region);
    }
    return null;
  }, [selectedVillageObj, villages, layers, region]);

  // Provenance determination
  const activeProvenance: DataProvenance = useMemo(() => {
    if (telemetry?.isSynthetic) return 'SIMULATION';
    if (telemetry?.waterLevelSource === 'live' || telemetry?.waterLevelSource === 'iot') return 'LIVE_OBSERVED';
    if (telemetry?.rainfallSource === 'open_meteo') return 'MODEL_WEATHER';
    if (telemetry?.rateOfRiseSource) return 'DERIVED';
    if (layers?.villages) return 'GIS';
    return 'UNAVAILABLE';
  }, [telemetry, layers]);

  return (
    <div
      className={`relative min-h-[520px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070b12] shadow-2xl md:min-h-[640px] ${className}`}
      data-testid="map-tactical-region"
    >
      <MapContainer
        key={region?.region_id ?? 'default-map'}
        center={mapCenter}
        zoom={12}
        minZoom={4}
        maxZoom={18}
        maxBounds={mapBounds}
        maxBoundsViscosity={0.92}
        zoomControl={false}
        className="absolute inset-0 h-full w-full"
        attributionControl={false}
      >
        {/* Layer 1: Modular Basemap */}
        <TileLayer
          key={`basemap-${currentBasemap.id}`}
          url={currentBasemap.url}
          attribution={currentBasemap.attribution}
          subdomains={currentBasemap.subdomains ?? ['a', 'b', 'c']}
          maxZoom={currentBasemap.maxZoom ?? 19}
          minZoom={currentBasemap.minZoom ?? 4}
          zIndex={100}
        />

        {/* Dynamic Bounds Fitting on Region Switch */}
        <FitRegionExtent region={region} />

        {/* Layer 2: Precipitation Radar Overlay (Resilient RainViewer context) */}
        <RadarLayer
          enabled={radarVisible}
          opacity={radarOpacity}
          onStatusChange={(available) => setRadarAvailable(available)}
        />

        {/* Layer 3: Authoritative River Network */}
        {riverVisible && hasRivers && layers?.river && (
          <RiverLayer
            riverData={layers.river}
            status={status}
            regionId={region?.region_id}
          />
        )}

        {/* Layer 4: Evacuation Corridor */}
        {evacVisible && hasEvacuation && (
          <EvacuationRouteLayer
            evacuationData={layers?.evacuation ?? null}
            selectedVillageName={selectedVillageObj?.name}
          />
        )}

        {/* Layer 5: Settlement Boundaries & Markers */}
        {settlementsVisible && hasSettlements && (
          <SettlementsLayer
            villages={villages}
            layers={layers}
            region={region}
            selectedVillageId={selectedVillage}
            onSelectVillage={onSelectVillage}
          />
        )}

        {/* Layer 6: Shelters */}
        {sheltersVisible && hasShelters && <SheltersLayer layers={layers} />}

        {/* Layer 7: Monitored River Gauge Station */}
        {gaugesVisible && (
          <GaugeLayer
            telemetry={telemetry}
            region={region}
            layers={layers}
          />
        )}

        {/* Layer 8: Incident Reticle & Sector Alert Marker */}
        {incidentPosition && (status === 'CRITICAL' || status === 'WATCH') && (
          <IncidentReticleLayer
            position={incidentPosition}
            status={status}
            label={selectedVillageObj?.name}
          />
        )}

        {/* Command Deck Map Controls */}
        <MapControls
          region={region}
          basemap={basemap}
          onBasemapChange={setBasemap}
          riverVisible={riverVisible}
          onToggleRiver={() => setRiverVisible(!riverVisible)}
          settlementsVisible={settlementsVisible}
          onToggleSettlements={() => setSettlementsVisible(!settlementsVisible)}
          sheltersVisible={sheltersVisible}
          onToggleShelters={() => setSheltersVisible(!sheltersVisible)}
          gaugesVisible={gaugesVisible}
          onToggleGauges={() => setGaugesVisible(!gaugesVisible)}
          evacVisible={evacVisible}
          onToggleEvac={() => setEvacVisible(!evacVisible)}
          radarVisible={radarVisible}
          onToggleRadar={() => setRadarVisible(!radarVisible)}
          radarOpacity={radarOpacity}
          onRadarOpacityChange={setRadarOpacity}
          radarAvailable={radarAvailable}
          hasRivers={hasRivers}
          hasSettlements={hasSettlements}
          hasShelters={hasShelters}
          hasEvacuation={hasEvacuation}
          hasTelemetry={hasTelemetry}
        />
      </MapContainer>

      {/* Top Left: Regional Metadata Header & Coordinates */}
      <div className="pointer-events-none absolute left-4 top-4 z-[500]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                status === 'CRITICAL'
                  ? 'bg-rose-500 pulse-fast shadow-[0_0_8px_#f43f5e]'
                  : status === 'WATCH'
                  ? 'bg-amber-400 pulse-soft shadow-[0_0_8px_#fbbf24]'
                  : 'bg-emerald-400 pulse-soft shadow-[0_0_8px_#34d399]'
              }`}
            />
            <span className="font-extrabold tracking-wider text-white text-xs">
              {region?.name.toUpperCase() ?? 'SELECTING REGION…'}
            </span>
          </div>
          <div className="mono mt-1 text-[11px] text-slate-400 font-medium">
            {region?.district ? `${region.district} · ${region.state}` : 'MONITORED BASIN'}
          </div>
          <div className="mono mt-0.5 text-[10px] text-slate-400">
            {region?.center
              ? `${region.center[0].toFixed(3)}° N · ${region.center[1].toFixed(3)}° E`
              : 'COORDINATES PENDING'}
          </div>
        </div>
      </div>

      {/* Bottom Left: Tactical Map Legend & Provenance Inspector */}
      <TacticalMapLegend
        provenance={activeProvenance}
        hasEvacuation={hasEvacuation}
        hasShelters={hasShelters}
        hasRadar={radarVisible && radarAvailable}
      />
    </div>
  );
}