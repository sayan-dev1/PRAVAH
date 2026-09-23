import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowRight, Compass, Crosshair, Layers, MapPin, Navigation, Radio, RotateCcw, Shield } from 'lucide-react';
import { BASEMAP_PROVIDERS } from './map/basemap-providers';

export type NationalRegion = {
  region_id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  enabled: boolean;
};

export const INITIAL_REGIONS: NationalRegion[] = [
  {
    region_id: 'mandakini',
    name: 'Mandakini River Basin',
    state: 'Uttarakhand',
    latitude: 30.335,
    longitude: 78.985,
    enabled: true,
  },
  {
    region_id: 'beas_kullu',
    name: 'Upper Beas River Basin',
    state: 'Himachal Pradesh',
    latitude: 31.975,
    longitude: 77.15,
    enabled: true,
  },
  {
    region_id: 'teesta_sikkim',
    name: 'Teesta River Basin',
    state: 'Sikkim',
    latitude: 27.6,
    longitude: 88.55,
    enabled: true,
  },
  {
    region_id: 'siang_arunachal',
    name: 'Siang River Basin',
    state: 'Arunachal Pradesh',
    latitude: 28.25,
    longitude: 95.0,
    enabled: true,
  },
  {
    region_id: 'kerala_western_ghats',
    name: 'Kerala Western Ghats',
    state: 'Kerala',
    latitude: 10.15,
    longitude: 76.95,
    enabled: true,
  },
];

const subcontinentCenter: [number, number] = [22.0, 82.5];
const subcontinentBounds: [[number, number], [number, number]] = [
  [5.0, 60.0],
  [38.5, 100.0],
];

function createTacticalRegionIcon(region: NationalRegion, isSelected: boolean) {
  const shortName = region.name.replace(' River Basin', '').replace(' River Valley', '');
  return L.divIcon({
    className: 'pravah-national-node-marker',
    html: `
      <div class="relative flex items-center group cursor-pointer" style="transform: translate(-16px, -16px);" tabindex="0" role="button" aria-label="${region.name}, ${region.state}">
        <!-- Pulse ring -->
        <span class="absolute -inset-2.5 rounded-full bg-amber-500/20 animate-ping opacity-75"></span>
        <span class="absolute -inset-1 rounded-full border border-amber-400/40 ${isSelected ? 'scale-125 border-orange-400' : ''}"></span>
        
        <!-- Core Node Beacon -->
        <div class="relative flex h-8 w-8 items-center justify-center rounded-full border-2 ${
          isSelected ? 'border-orange-400 bg-orange-950 text-orange-300 shadow-[0_0_18px_rgba(249,115,22,0.9)]' : 'border-amber-400 bg-slate-950 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
        } transition-transform duration-200 group-hover:scale-115">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
          </svg>
        </div>

        <!-- Node Label Tag -->
        <div class="ml-2.5 hidden sm:flex items-center gap-1.5 rounded-md border border-white/15 bg-slate-950/90 px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-200 shadow-xl backdrop-blur-md transition-all group-hover:border-amber-400 group-hover:text-white group-hover:scale-105 whitespace-nowrap">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          <span>${shortName}</span>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function ResetSubcontinentView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  return (
    <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-1.5">
      <button
        onClick={() => map.setView(center, zoom, { animate: true })}
        title="Reset Subcontinent View"
        aria-label="Reset Map to Indian Subcontinent"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-900/90 text-slate-300 shadow-xl backdrop-blur-md transition-all hover:bg-slate-800 hover:text-white hover:border-amber-400 active:scale-95"
      >
        <RotateCcw size={15} />
      </button>
      <button
        onClick={() => map.zoomIn()}
        title="Zoom In"
        aria-label="Zoom In Map"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-900/90 text-slate-300 shadow-xl backdrop-blur-md transition-all hover:bg-slate-800 hover:text-white hover:border-amber-400 active:scale-95 text-lg font-bold"
      >
        +
      </button>
      <button
        onClick={() => map.zoomOut()}
        title="Zoom Out"
        aria-label="Zoom Out Map"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-900/90 text-slate-300 shadow-xl backdrop-blur-md transition-all hover:bg-slate-800 hover:text-white hover:border-amber-400 active:scale-95 text-lg font-bold"
      >
        −
      </button>
    </div>
  );
}

export interface NationalOverviewMapProps {
  regions?: NationalRegion[];
  selectedRegionId?: string;
  onSelectRegion: (regionId: string) => void;
  className?: string;
}

export function NationalOverviewMap({
  regions = INITIAL_REGIONS,
  selectedRegionId,
  onSelectRegion,
  className = '',
}: NationalOverviewMapProps) {
  const tacticalBasemap = BASEMAP_PROVIDERS.tactical;

  return (
    <div
      className={`relative min-h-[500px] sm:min-h-[580px] lg:min-h-[640px] w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070b12] shadow-2xl ${className}`}
      data-testid="national-tactical-map"
    >
      {/* Top-Left Short Tactical Chip */}
      <div className="absolute left-3.5 top-3.5 z-[1000] flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-200 shadow-lg backdrop-blur-md pointer-events-none">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
        <span className="mono text-white">INDIAN SUBCONTINENT</span>
      </div>

      {/* Bottom Tactical Context Strip (Unobtrusive) */}
      <div className="absolute bottom-4 left-4 z-[1000] hidden sm:flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/90 px-3.5 py-1.5 text-[11px] font-medium text-slate-300 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="mono font-bold text-white">{regions.length} ACTIVE BASINS</span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="flex items-center gap-1.5 text-slate-400 mono text-[10px]">
          <Compass size={12} className="text-amber-400" />
          <span>TACTICAL GRID (5°–38.5°N · 60°–100°E)</span>
        </div>
      </div>

      {/* Map Container */}
      <MapContainer
        center={subcontinentCenter}
        zoom={5}
        minZoom={4}
        maxZoom={9}
        maxBounds={subcontinentBounds}
        maxBoundsViscosity={0.92}
        zoomControl={false}
        className="absolute inset-0 h-full w-full"
        attributionControl={false}
      >
        <TileLayer
          key="national-basemap"
          url={tacticalBasemap.url}
          attribution={tacticalBasemap.attribution}
          subdomains={tacticalBasemap.subdomains ?? ['a', 'b', 'c', 'd']}
          maxZoom={9}
          minZoom={4}
          zIndex={100}
        />

        <ResetSubcontinentView center={subcontinentCenter} zoom={5} />

        {/* Regional Monitoring Node Markers */}
        {regions.map((reg) => {
          const isSelected = reg.region_id === selectedRegionId;
          const icon = createTacticalRegionIcon(reg, isSelected);

          return (
            <Marker
              key={reg.region_id}
              position={[reg.latitude, reg.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectRegion(reg.region_id),
                keydown: (e: unknown) => {
                  const event = (e as { originalEvent?: KeyboardEvent })?.originalEvent;
                  if (event && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onSelectRegion(reg.region_id);
                  }
                },
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -14]}
                opacity={1}
                className="tactical-national-tooltip"
              >
                <div className="p-1 text-left min-w-[170px]">
                  <div className="mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    OPERATIONAL NODE
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-white leading-tight">
                    {reg.name}
                  </div>
                  <div className="text-xs text-slate-300 font-medium mt-0.5">
                    {reg.state}
                  </div>
                  <div className="mono text-[10px] text-slate-400 mt-1">
                    {reg.latitude.toFixed(2)}° N, {reg.longitude.toFixed(2)}° E
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-xs font-bold text-amber-300">
                    <span>Open Command Deck</span>
                    <ArrowRight size={13} className="text-amber-400" />
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export function MonitoredRegionsList({
  regions = INITIAL_REGIONS,
  selectedRegionId,
  onSelectRegion,
}: {
  regions?: NationalRegion[];
  selectedRegionId?: string;
  onSelectRegion: (regionId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0c121e]/90 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
        <div className="flex items-center gap-2.5">
          <Shield size={18} className="text-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            MONITORED REGIONS
          </h2>
        </div>
        <span className="mono text-xs text-slate-400">
          {regions.length} Registered Basins
        </span>
      </div>

      <div className="mt-3.5 divide-y divide-white/5">
        {regions.map((reg) => {
          const isSelected = reg.region_id === selectedRegionId;
          return (
            <button
              key={reg.region_id}
              type="button"
              onClick={() => onSelectRegion(reg.region_id)}
              aria-label={`Open Command Deck for ${reg.name}, ${reg.state}`}
              data-testid={`region-list-item-${reg.region_id}`}
              className={`group flex w-full items-center justify-between py-3.5 px-3 rounded-xl text-left transition-all ${
                isSelected
                  ? 'bg-amber-500/15 border border-amber-500/40 text-white'
                  : 'hover:bg-white/5 hover:text-white text-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 group-hover:scale-125 transition-transform shadow-[0_0_8px_#34d399]" />
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    {reg.name}
                  </div>
                  <div className="mono text-xs text-slate-400">
                    {reg.state} · <span className="text-slate-500">{reg.latitude.toFixed(2)}°N, {reg.longitude.toFixed(2)}°E</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block mono text-xs font-semibold text-slate-400 group-hover:text-amber-300 transition-colors">
                  Open Deck
                </span>
                <div className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-slate-900 group-hover:border-amber-400/50 group-hover:bg-amber-500/20 group-hover:text-amber-300 transition-all text-slate-400">
                  <ArrowRight size={14} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
