import { useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import type { Telemetry, Village, RiskStatus } from '@/lib/flashshield-api';

type Props = {
  telemetry: Telemetry;
  villages: Village[];
};

const center: [number, number] = [30.285, 78.965];
const bounds: [[number, number], [number, number]] = [
  [30.205, 78.88],
  [30.355, 79.08],
];

const coordinates: Record<string, [number, number]> = {
  tilwara: [30.245, 78.935],
  sumerpur: [30.282, 78.972],
  rudraprayag: [30.305, 78.992],
};

const river: [number, number][] = [
  [30.338, 79.045],
  [30.322, 79.018],
  [30.305, 78.992],
  [30.282, 78.972],
  [30.26, 78.948],
  [30.225, 78.905],
];

const routeToShelter: [number, number][] = [
  [30.245, 78.935],
  [30.255, 78.925],
  [30.268, 78.922],
  [30.284, 78.916],
];

const statusMeta: Record<RiskStatus, { color: string; icon: string }> = {
  NORMAL: { color: '#4fb0a8', icon: '✓' },
  WATCH: { color: '#f2994a', icon: '△' },
  CRITICAL: { color: '#e5484d', icon: '!' },
};

function markerIcon(status: RiskStatus) {
  const { color, icon } = statusMeta[status];
  return L.divIcon({
    className: 'flashshield-marker',
    html: `<span class="flashshield-marker-dot" style="--marker-color:${color}"><b>${icon}</b></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function HeatLayer({ telemetry }: { telemetry: Telemetry }) {
  const map = useMap();
  const surge = telemetry.status === 'CRITICAL';
  const watch = telemetry.status === 'WATCH';

  const points = useMemo(() => {
    const intensity = surge ? 0.95 : watch ? 0.58 : 0.26;
    return [
      [30.245, 78.935, intensity],
      [30.253, 78.943, intensity * 0.88],
      [30.264, 78.953, intensity * 0.72],
      [30.282, 78.972, intensity * 0.52],
      [30.305, 78.992, intensity * 0.36],
    ] as [number, number, number][];
  }, [surge, watch]);

  useEffect(() => {
    const leafletWithHeat = L as typeof L & {
      heatLayer: (
        latlngs: [number, number, number][],
        options: Record<string, unknown>,
      ) => L.Layer;
    };
    const layer = leafletWithHeat.heatLayer(points, {
      radius: surge ? 34 : 25,
      blur: surge ? 28 : 20,
      maxZoom: 15,
      minOpacity: surge ? 0.58 : 0.22,
      gradient: surge
        ? { 0.25: '#f2994a', 0.55: '#e8874d', 0.8: '#e5484d', 1: '#d83d48' }
        : { 0.2: '#4fb0a8', 0.5: '#f2994a', 1: '#e58b4e' },
    });
    layer.addTo(map);
    return () => {
      layer.removeFrom(map);
    };
  }, [map, points, surge]);

  return null;
}

function FitMandakini() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [16, 16] });
  }, [map]);
  return null;
}

function MapLayerToggle({
  label,
  active,
  onClick,
  color = '#f2994a',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={`toggle-leaflet-${label.toLowerCase().replaceAll(' ', '-')}`}
      className="flex min-h-9 items-center justify-between gap-5 border-b border-[#9bb1c3]/15 px-3 py-2 text-left text-[10px] tracking-[.08em] text-[#b5c4cb] last:border-0 hover:bg-[#162530]"
    >
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5"
          style={{ backgroundColor: active ? color : '#566b78' }}
          aria-hidden="true"
        />
        <span className="mono text-[9px] text-[#687c88]">{active ? 'ON' : 'OFF'}</span>
      </span>
    </button>
  );
}

export function TacticalLeafletMap({ telemetry, villages }: Props) {
  const [heat, setHeat] = useState(true);
  const [routes, setRoutes] = useState(true);
  const [villageLayer, setVillageLayer] = useState(true);
  const surge = telemetry.status === 'CRITICAL';

  return (
    <div
      className="relative min-h-[470px] overflow-hidden border border-[#9bb1c3]/18 bg-[#101b25] md:min-h-[600px]"
      data-testid="map-tactical-mandakini"
    >
      <MapContainer
        center={center}
        zoom={12}
        minZoom={11}
        maxZoom={15}
        maxBounds={bounds}
        maxBoundsViscosity={0.92}
        zoomControl={false}
        className="absolute inset-0 h-full w-full"
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
        />
        <FitMandakini />
        {heat && <HeatLayer telemetry={telemetry} />}
        <Polyline
          positions={river}
          pathOptions={{ color: '#4fb0a8', weight: 6, opacity: 0.18 }}
        />
        <Polyline
          positions={river}
          pathOptions={{
            color: surge ? '#f2994a' : '#65bcb3',
            weight: 2.5,
            opacity: 0.94,
          }}
        >
          <Tooltip sticky direction="top">
            Mandakini river vector · channel flow
          </Tooltip>
        </Polyline>
        {routes && (
          <>
            <Polyline
              positions={routeToShelter}
              pathOptions={{ color: '#f2994a', weight: 3, dashArray: '8 9', opacity: 0.95 }}
            >
              <Tooltip sticky direction="top">
                Uphill evacuation corridor · High School Grounds
              </Tooltip>
            </Polyline>
            <Marker position={routeToShelter[routeToShelter.length - 1]} icon={markerIcon('WATCH')}>
              <Tooltip direction="right" offset={[10, 0]}>
                Muster shelter · High School Grounds
              </Tooltip>
            </Marker>
          </>
        )}
        {villageLayer &&
          villages.map((village) => {
            const position = coordinates[village.id] ?? center;
            return (
              <div key={village.id}>
                <CircleMarker
                  center={position}
                  radius={surge && village.id === 'tilwara' ? 18 : 12}
                  pathOptions={{
                    color: statusMeta[village.status].color,
                    fillColor: statusMeta[village.status].color,
                    fillOpacity: 0.18,
                    weight: 1,
                  }}
                />
                <Marker position={position} icon={markerIcon(village.status)}>
                  <Tooltip direction="top" offset={[0, -14]} opacity={0.96}>
                    <strong>{village.name}</strong>
                    <br />
                    {village.status} · {village.population.toLocaleString('en-IN')} residents
                  </Tooltip>
                </Marker>
              </div>
            );
          })}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[500]">
        <div className="border border-[#9bb1c3]/25 bg-[#111c26]/90 px-3 py-2 backdrop-blur">
          <div className="mono text-[9px] tracking-[.16em] text-[#b7c5cc]">MANDAKINI / TACTICAL MAP</div>
          <div className="mt-1 text-[10px] text-[#758995]">Live pilot · 30.28° N, 78.98° E</div>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-[500] border border-[#9bb1c3]/25 bg-[#111c26]/90 px-3 py-2 backdrop-blur">
        <div className="mb-2 text-[9px] font-semibold tracking-[.15em] text-[#c2cdd3]">LAYER CONTROL</div>
        <MapLayerToggle label="Flood intensity" active={heat} onClick={() => setHeat(!heat)} color={surge ? '#e5484d' : '#f2994a'} />
        <MapLayerToggle label="Evacuation route" active={routes} onClick={() => setRoutes(!routes)} />
        <MapLayerToggle label="Village status" active={villageLayer} onClick={() => setVillageLayer(!villageLayer)} color="#4fb0a8" />
      </div>

      <div className="absolute right-3 top-3 z-[500] border border-[#9bb1c3]/25 bg-[#111c26]/90 px-3 py-2 backdrop-blur">
        <div className="mb-2 text-[9px] font-semibold tracking-[.15em] text-[#c2cdd3]">FIELD LEGEND</div>
        <div className="space-y-1.5 text-[10px] text-[#9badb8]">
          <div className="flex items-center gap-2"><span className="h-2 w-2 bg-[#4fb0a8]" />NORMAL</div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 bg-[#f2994a]" />WATCH</div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 bg-[#e5484d]" />CRITICAL</div>
          <div className="mt-2 border-t border-[#9bb1c3]/15 pt-2 text-[#788d99]">Context: live pilot only</div>
        </div>
      </div>
    </div>
  );
}