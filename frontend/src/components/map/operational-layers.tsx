import { useMemo } from 'react';
import { CircleMarker, GeoJSON, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import {
  Activity,
  AlertTriangle,
  Compass,
  Gauge,
  Info,
  MapPin,
  Navigation,
  Radio,
  Route as RouteIcon,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';
import type {
  GeoJsonFeatureCollection,
  Region,
  RegionLayers,
  RiskStatus,
  TelemetryViewModel,
  VillageViewModel,
} from '@/lib/flashshield-api';

const statusMeta: Record<RiskStatus, { color: string; label: string; text: string }> = {
  NORMAL: { color: '#10b981', label: '✓', text: 'NORMAL' },
  WATCH: { color: '#f59e0b', label: '△', text: 'WATCH' },
  CRITICAL: { color: '#f43f5e', label: '!', text: 'CRITICAL' },
  FAULTY_STUCK: { color: '#94a3b8', label: '?', text: 'FAULTY_STUCK' },
  DATA_UNAVAILABLE: { color: '#64748b', label: '—', text: 'UNAVAILABLE' },
  UNKNOWN: { color: '#64748b', label: '—', text: 'UNKNOWN' },
};

function createSettlementIcon(status: RiskStatus, isSelected: boolean) {
  const meta = statusMeta[status] ?? statusMeta.UNKNOWN;
  const ring = isSelected
    ? 'box-shadow: 0 0 0 3px #f97316, 0 0 24px rgba(249, 115, 22, 0.9); transform: scale(1.18);'
    : '';
  const pulseClass = status === 'CRITICAL' || isSelected ? 'pulse-fast' : '';

  return L.divIcon({
    className: 'pravah-settlement-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <span class="flashshield-marker-dot ${pulseClass}" style="--marker-color:${meta.color}; ${ring}">
          <span>${meta.label}</span>
        </span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function createGaugeIcon(status: RiskStatus, isSynthetic: boolean) {
  const isCritical = status === 'CRITICAL';
  const isWatch = status === 'WATCH';
  const color = isCritical ? '#f43f5e' : isWatch ? '#f59e0b' : '#06b6d4';

  return L.divIcon({
    className: 'pravah-gauge-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <div style="background: #090e17; border: 2px solid ${color}; color: ${color}; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px ${color}80;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 14 4-4"/>
            <path d="M3.34 19a10 10 0 1 1 17.32 0"/>
          </svg>
        </div>
        ${isCritical ? `<span class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-500 pulse-fast shadow-[0_0_8px_#f43f5e]" />` : ''}
        ${isSynthetic ? `<span class="absolute -bottom-1 -right-1 mono text-[8px] font-bold bg-amber-500 text-slate-950 px-1 rounded">SIM</span>` : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function createShelterIcon() {
  return L.divIcon({
    className: 'pravah-shelter-marker',
    html: `
      <div style="background: #1e1b18; border: 2px solid #fbbf24; color: #fbbf24; width: 28px; height: 28px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(251, 191, 36, 0.6); font-weight: bold; font-size: 13px;">
        ⚑
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function coordinatePairs(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    return [[value[0], value[1]]];
  }
  return value.flatMap(coordinatePairs);
}

export function representativePosition(geometry?: { coordinates: unknown } | null): [number, number] | undefined {
  if (!geometry) return undefined;
  const pairs = coordinatePairs(geometry.coordinates);
  if (!pairs.length) return undefined;
  const [longitude, latitude] = pairs.reduce(
    ([sumLongitude, sumLatitude], [nextLongitude, nextLatitude]) => [sumLongitude + nextLongitude, sumLatitude + nextLatitude],
    [0, 0],
  );
  return [latitude / pairs.length, longitude / pairs.length];
}

export function villagePosition(
  layers: RegionLayers | null | undefined,
  village: VillageViewModel,
  region?: Region,
): [number, number] {
  const feature = layers?.villages?.features.find(
    (candidate) => candidate.properties?.village_id === village.id,
  );
  const position = feature ? representativePosition(feature.geometry) : undefined;
  return position ?? region?.center ?? [20.5937, 78.9629];
}

// 1. River Network Layer
export function RiverLayer({
  riverData,
  status,
  regionId,
}: {
  riverData: GeoJsonFeatureCollection;
  status: RiskStatus;
  regionId?: string;
}) {
  const isCritical = status === 'CRITICAL';
  const isWatch = status === 'WATCH';
  const riverColor = isCritical ? '#f43f5e' : isWatch ? '#f59e0b' : '#06b6d4';

  return (
    <GeoJSON
      key={`river-${regionId}-${status}`}
      data={riverData as never}
      style={{
        color: riverColor,
        weight: isCritical ? 5 : 4,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }}
    >
      <Tooltip direction="center" sticky opacity={0.92}>
        <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: riverColor }} />
          <span>Regional Monitored River Channel</span>
        </div>
      </Tooltip>
    </GeoJSON>
  );
}

// 2. Telemetry Gauge Station Layer
export function GaugeLayer({
  telemetry,
  region,
  layers,
}: {
  telemetry: TelemetryViewModel | null;
  region?: Region;
  layers?: RegionLayers | null;
}) {
  const position = useMemo((): [number, number] | null => {
    // Dynamic gauge placement: first river node or region centroid
    if (layers?.river && layers.river.features.length > 0) {
      const riverPos = representativePosition(layers.river.features[0].geometry);
      if (riverPos) return riverPos;
    }
    if (region?.center) return region.center;
    return null;
  }, [layers, region]);

  if (!position || !telemetry) return null;

  const currentStatus = telemetry.status ?? 'UNKNOWN';
  const meta = statusMeta[currentStatus] ?? statusMeta.UNKNOWN;
  const provenance = telemetry.isSynthetic
    ? 'SIMULATION'
    : telemetry.waterLevelSource === 'live' || telemetry.waterLevelSource === 'sensor' || telemetry.waterLevelSource === 'iot'
    ? 'LIVE_OBSERVED'
    : telemetry.waterLevelSource
    ? 'DERIVED'
    : 'UNAVAILABLE';

  return (
    <Marker
      position={position}
      icon={createGaugeIcon(currentStatus, telemetry.isSynthetic)}
      zIndexOffset={800}
    >
      <Popup className="pravah-tactical-popup" offset={[0, -14]}>
        <div className="min-w-[240px] space-y-3 p-1 text-slate-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-cyan-400" />
              <strong className="text-white text-xs font-bold font-mono">
                {telemetry.sensorId}
              </strong>
            </div>
            <span
              className="mono text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ color: meta.color, backgroundColor: `${meta.color}20` }}
            >
              {meta.text}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Water Level:</span>
              <span className="mono font-bold text-white">
                {telemetry.waterLevelCm !== null ? `${telemetry.waterLevelCm} cm` : 'UNAVAILABLE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Rate of Rise:</span>
              <span className="mono font-bold text-amber-400">
                {telemetry.rateOfRiseCmMin !== null ? `${telemetry.rateOfRiseCmMin.toFixed(2)} cm/min` : 'UNAVAILABLE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Rainfall:</span>
              <span className="mono font-bold text-teal-300">
                {telemetry.rainfallMmHr !== null ? `${telemetry.rainfallMmHr} mm/hr` : 'UNAVAILABLE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Provenance:</span>
              <span className="mono text-[11px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                {provenance}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-1 text-[11px] text-slate-400">
              <span>Updated:</span>
              <span className="mono">
                {telemetry.timestamp ? new Date(telemetry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// 3. Settlements Layer with Strict Risk Mapping & Detail Popups
export function SettlementsLayer({
  villages,
  layers,
  region,
  selectedVillageId,
  onSelectVillage,
}: {
  villages: VillageViewModel[];
  layers?: RegionLayers | null;
  region?: Region;
  selectedVillageId?: string;
  onSelectVillage?: (id: string) => void;
}) {
  return (
    <>
      {villages.map((village) => {
        const position = villagePosition(layers, village, region);
        const isSelected = selectedVillageId === village.id;
        const currentStatus = village.status ?? 'UNKNOWN';
        const meta = statusMeta[currentStatus] ?? statusMeta.UNKNOWN;
        const isCritical = currentStatus === 'CRITICAL';
        const popDisplay = village.population > 0 ? village.population.toLocaleString('en-IN') : 'N/A';
        const leadDisplay = village.leadTimeMinutes !== null && village.leadTimeMinutes !== undefined
          ? `${village.leadTimeMinutes} min`
          : 'N/A';

        return (
          <div key={`settlement-${village.id}`}>
            {/* Visual Halo ring */}
            <CircleMarker
              center={position}
              radius={isCritical && isSelected ? 26 : isSelected ? 20 : isCritical ? 16 : 11}
              pathOptions={{
                color: meta.color,
                fillColor: meta.color,
                fillOpacity: isSelected ? 0.35 : 0.15,
                weight: isSelected ? 2.5 : 1.5,
              }}
              eventHandlers={{
                click: () => onSelectVillage?.(village.id),
              }}
            />

            {/* Tactical Marker */}
            <Marker
              position={position}
              icon={createSettlementIcon(currentStatus, isSelected)}
              zIndexOffset={isSelected ? 1000 : 500}
              eventHandlers={{
                click: () => onSelectVillage?.(village.id),
              }}
            >
              <Popup className="pravah-tactical-popup" offset={[0, -16]}>
                <div className="min-w-[240px] space-y-2.5 p-1 text-slate-200">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div>
                      <strong className="text-white text-sm font-bold block">{village.name}</strong>
                      <span className="mono text-[10px] text-slate-400">ID: {village.id}</span>
                    </div>
                    <span
                      className="mono text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ color: meta.color, backgroundColor: `${meta.color}20` }}
                    >
                      {meta.text}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Population at Risk:</span>
                      <span className="mono font-bold text-white">{popDisplay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Est. Lead Time:</span>
                      <span className="mono font-bold text-amber-400">{leadDisplay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hazard Driver:</span>
                      <span className="text-slate-200 font-medium truncate max-w-[140px]">{village.primaryDriver || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Regional Status:</span>
                      <span className="mono text-slate-200">{village.regionalHazardStatus || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Data Source:</span>
                      <span className="mono text-[10px] text-teal-300 font-bold bg-teal-500/10 px-1.5 py-0.2 rounded border border-teal-500/20">
                        GIS / BACKEND
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 text-[11px] text-center text-slate-400">
                    Click to inspect sector & routing
                  </div>
                </div>
              </Popup>

              <Tooltip direction="top" offset={[0, -18]} opacity={0.96}>
                <div className="space-y-1 text-xs min-w-[140px]">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-white">{village.name}</strong>
                    <span className="mono font-bold" style={{ color: meta.color }}>
                      {meta.text}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 flex justify-between">
                    <span>Pop:</span>
                    <span className="mono font-bold">{popDisplay}</span>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          </div>
        );
      })}
    </>
  );
}

// 4. Shelters Layer
export function SheltersLayer({ layers }: { layers?: RegionLayers | null }) {
  const shelters = useMemo(() => {
    return (layers?.shelters?.features ?? [])
      .map((feature) => ({
        feature,
        position: representativePosition(feature.geometry),
      }))
      .filter((item): item is { feature: GeoJsonFeatureCollection['features'][number]; position: [number, number] } =>
        Boolean(item.position),
      );
  }, [layers]);

  return (
    <>
      {shelters.map(({ feature, position }, index) => {
        const name = String(feature.properties?.name ?? feature.properties?.shelter_id ?? 'Designated Shelter');
        const capacity = feature.properties?.capacity ? String(feature.properties.capacity) : 'N/A';
        const amenity = String(feature.properties?.amenity ?? 'Emergency Shelter');

        return (
          <Marker
            key={`shelter-${index}`}
            position={position}
            icon={createShelterIcon()}
            zIndexOffset={600}
          >
            <Popup className="pravah-tactical-popup" offset={[0, -14]}>
              <div className="min-w-[200px] space-y-2 p-1 text-slate-200">
                <div className="flex items-center gap-2 border-b border-white/10 pb-1.5">
                  <span className="text-amber-400 font-bold text-sm">⚑</span>
                  <strong className="text-white text-xs font-bold">{name}</strong>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Type:</span>
                    <span className="text-slate-200 font-medium">{amenity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Capacity:</span>
                    <span className="mono font-bold text-amber-300">{capacity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Data Source:</span>
                    <span className="mono text-[10px] text-slate-300 bg-white/5 px-1.5 py-0.2 rounded">
                      GIS BUNDLE
                    </span>
                  </div>
                </div>
              </div>
            </Popup>
            <Tooltip direction="bottom" offset={[0, 10]} opacity={0.95}>
              <span className="text-xs font-bold text-amber-400">⚑ {name}</span>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

// 5. Evacuation Corridor Route Layer
export function EvacuationRouteLayer({
  evacuationData,
  selectedVillageName,
}: {
  evacuationData: GeoJsonFeatureCollection | null;
  selectedVillageName?: string;
}) {
  if (!evacuationData || evacuationData.features.length === 0) {
    return null;
  }

  const feature = evacuationData.features[0];
  const shelterId = (feature?.properties?.shelter_id as string | undefined) ?? 'Designated Shelter';
  const isHazardWeighted = Boolean(feature?.properties?.hazard_weighted);
  const segmentCount = evacuationData.features.length;

  return (
    <GeoJSON
      key={`evac-corridor-${selectedVillageName}-${segmentCount}`}
      data={evacuationData as never}
      style={{
        color: '#fbbf24',
        weight: 4,
        dashArray: '10 8',
        opacity: 0.95,
        lineCap: 'round',
      }}
    >
      <Popup className="pravah-tactical-popup">
        <div className="min-w-[220px] space-y-2 p-1 text-slate-200">
          <div className="flex items-center gap-2 border-b border-amber-500/30 pb-1.5 text-amber-400">
            <RouteIcon size={16} />
            <strong className="text-xs font-bold">ACTIVE EVACUATION CORRIDOR</strong>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Origin:</span>
              <span className="font-bold text-white">{selectedVillageName ?? 'Selected Sector'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Destination:</span>
              <span className="font-bold text-amber-300">{shelterId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Road Graph Segments:</span>
              <span className="mono font-bold text-white">{segmentCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Routing Mode:</span>
              <span className="mono text-[10px] text-amber-300 bg-amber-500/10 px-1 rounded">
                {isHazardWeighted ? 'HAZARD-WEIGHTED' : 'LEAST-COST ROAD GRAPH'}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-1">
              <span className="text-slate-400">Provenance:</span>
              <span className="mono text-[10px] text-teal-300 font-bold">
                BACKEND ROUTING ENGINE
              </span>
            </div>
          </div>
        </div>
      </Popup>
    </GeoJSON>
  );
}

// 6. Incident Target Reticle Layer
export function IncidentReticleLayer({
  position,
  status,
  label,
}: {
  position: [number, number];
  status: RiskStatus;
  label?: string;
}) {
  if (status !== 'CRITICAL' && status !== 'WATCH') return null;

  const color = status === 'CRITICAL' ? '#f43f5e' : '#f59e0b';

  return (
    <CircleMarker
      center={position}
      radius={42}
      pathOptions={{
        color: color,
        fillColor: 'transparent',
        weight: 1.5,
        dashArray: '6 6',
        opacity: 0.8,
      }}
    >
      <Tooltip permanent direction="bottom" offset={[0, 40]} opacity={0.95}>
        <div className="flex items-center gap-1.5 font-bold mono text-[11px]" style={{ color }}>
          <AlertTriangle size={13} className="animate-pulse" />
          <span>SURGE SECTOR · {label ?? 'ACTIVE INCIDENT'}</span>
        </div>
      </Tooltip>
    </CircleMarker>
  );
}
