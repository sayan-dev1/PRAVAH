import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import {
  CloudRain,
  Eye,
  Gauge,
  Layers,
  Map as MapIcon,
  Maximize2,
  Minus,
  Mountain,
  Plus,
  Radio,
  RotateCcw,
  Route,
  Satellite,
  Sliders,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { BASEMAP_PROVIDERS } from './basemap-providers';
import type { BasemapMode } from './types';
import type { Region } from '@/lib/flashshield-api';

export function MapControls({
  region,
  basemap,
  onBasemapChange,
  riverVisible,
  onToggleRiver,
  settlementsVisible,
  onToggleSettlements,
  sheltersVisible,
  onToggleShelters,
  gaugesVisible,
  onToggleGauges,
  evacVisible,
  onToggleEvac,
  radarVisible,
  onToggleRadar,
  radarOpacity,
  onRadarOpacityChange,
  radarAvailable,
  hasRivers,
  hasSettlements,
  hasShelters,
  hasEvacuation,
  hasTelemetry,
}: {
  region?: Region;
  basemap: BasemapMode;
  onBasemapChange: (mode: BasemapMode) => void;
  riverVisible: boolean;
  onToggleRiver: () => void;
  settlementsVisible: boolean;
  onToggleSettlements: () => void;
  sheltersVisible: boolean;
  onToggleShelters: () => void;
  gaugesVisible: boolean;
  onToggleGauges: () => void;
  evacVisible: boolean;
  onToggleEvac: () => void;
  radarVisible: boolean;
  onToggleRadar: () => void;
  radarOpacity: number;
  onRadarOpacityChange: (value: number) => void;
  radarAvailable: boolean;
  hasRivers: boolean;
  hasSettlements: boolean;
  hasShelters: boolean;
  hasEvacuation: boolean;
  hasTelemetry: boolean;
}) {
  const map = useMap();
  const [activeTab, setActiveTab] = useState<'basemap' | 'overlays'>('overlays');
  const [isExpanded, setIsExpanded] = useState(true);

  // Basin re-center action
  const handleRecenter = () => {
    if (region?.bounds) {
      map.fitBounds(region.bounds, { padding: [35, 35], maxZoom: 14 });
    } else if (region?.center) {
      map.setView(region.center, 12);
    }
  };

  const basemapOptions: Array<{ id: BasemapMode; label: string; icon: typeof MapIcon; desc: string }> = [
    { id: 'tactical', label: 'Tactical Dark', icon: MapIcon, desc: 'CARTO Dark (Default)' },
    { id: 'terrain', label: 'Topographic', icon: Mountain, desc: 'OpenTopoMap / Contours' },
    { id: 'satellite', label: 'Satellite', icon: Satellite, desc: 'Esri World Imagery' },
    { id: 'offline', label: 'Offline Mode', icon: WifiOff, desc: 'Local MBTiles Cache' },
  ];

  return (
    <>
      {/* Top Right: Professional Command Deck Layer & Basemap Control */}
      <div className="absolute right-4 top-4 z-[500] w-64 rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur-xl">
        {/* Header Tabs */}
        <div className="flex items-center justify-between border-b border-white/[0.08] p-2">
          <div className="flex items-center gap-1 rounded-xl bg-slate-900/80 p-1 border border-white/5 w-full">
            <button
              type="button"
              onClick={() => setActiveTab('overlays')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
                activeTab === 'overlays'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={13} />
              <span>OVERLAYS</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('basemap')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
                activeTab === 'basemap'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapIcon size={13} />
              <span>BASEMAP</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3 space-y-1.5 max-h-[380px] overflow-y-auto tactical-scroll">
          {activeTab === 'basemap' ? (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 mb-1 px-1">
                BASEMAP PROVIDER
              </div>
              {basemapOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = basemap === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onBasemapChange(opt.id)}
                    className={`flex w-full items-center justify-between rounded-xl p-2.5 text-left transition-all ${
                      isSelected
                        ? 'border border-amber-500/40 bg-amber-500/15 text-white shadow-sm'
                        : 'border border-white/5 bg-slate-900/40 text-slate-300 hover:border-white/20 hover:bg-slate-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`grid h-7 w-7 place-items-center rounded-lg ${
                          isSelected ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Icon size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[130px]">{opt.desc}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="mono text-[10px] text-amber-400 font-extrabold bg-amber-500/20 px-1.5 py-0.5 rounded">
                        ACTIVE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 mb-1 px-1 flex justify-between items-center">
                <span>PRAVAH GIS OVERLAYS</span>
                <span className="mono text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  REGIONAL
                </span>
              </div>

              {/* 1. Rivers */}
              <LayerItem
                label="River Network"
                active={riverVisible}
                available={hasRivers}
                onClick={onToggleRiver}
                color="#06b6d4"
              />

              {/* 2. Settlements */}
              <LayerItem
                label="Settlement Zones"
                active={settlementsVisible}
                available={hasSettlements}
                onClick={onToggleSettlements}
                color="#10b981"
              />

              {/* 3. Shelters */}
              <LayerItem
                label="Shelters"
                active={sheltersVisible}
                available={hasShelters}
                onClick={onToggleShelters}
                color="#fbbf24"
              />

              {/* 4. Gauge Station */}
              <LayerItem
                label="River Gauges"
                active={gaugesVisible}
                available={hasTelemetry}
                onClick={onToggleGauges}
                color="#38bdf8"
              />

              {/* 5. Evacuation Route */}
              <LayerItem
                label="Evac Corridor"
                active={evacVisible}
                available={hasEvacuation}
                onClick={onToggleEvac}
                color="#f59e0b"
              />

              {/* 6. Precipitation Radar */}
              <div className="rounded-xl border border-white/5 bg-slate-900/40 p-2 space-y-2 mt-1">
                <LayerItem
                  label="Precipitation Radar"
                  active={radarVisible}
                  available={radarAvailable}
                  onClick={onToggleRadar}
                  color="#a855f7"
                  subLabel="RainViewer Context"
                />
                {radarVisible && radarAvailable && (
                  <div className="px-1.5 pt-1 border-t border-white/5">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                      <span>Radar Opacity</span>
                      <span className="mono font-bold text-slate-200">
                        {(radarOpacity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={radarOpacity}
                      onChange={(e) => onRadarOpacityChange(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>
                )}
              </div>

              {/* 7. Analytical GIS Layers (Section 11) */}
              <div className="rounded-xl border border-white/5 bg-slate-900/40 p-2 space-y-1.5 mt-1.5">
                <div className="text-[10px] font-bold tracking-wider text-slate-400 flex justify-between items-center px-1">
                  <span>ANALYTICAL GIS LAYERS</span>
                  <span className="mono text-[8px] text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded">
                    COG / TIF
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div className="rounded-lg bg-slate-950/60 p-1.5 border border-white/5">
                    <span className="text-slate-400 block font-bold">ELEVATION</span>
                    <span className="mono text-[9px] text-teal-300">dem.tif</span>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 p-1.5 border border-white/5">
                    <span className="text-slate-400 block font-bold">SLOPE</span>
                    <span className="mono text-[9px] text-teal-300">slope.tif</span>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 p-1.5 border border-white/5">
                    <span className="text-slate-400 block font-bold">TWI</span>
                    <span className="mono text-[9px] text-teal-300">twi.tif</span>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 p-1.5 border border-white/5">
                    <span className="text-slate-400 block font-bold">FLOW ACCUM</span>
                    <span className="mono text-[9px] text-teal-300">flow_accum.tif</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Right: Tactical Map Navigation / Zoom / Recenter Buttons */}
      <div className="absolute right-4 bottom-4 z-[500] flex flex-col gap-2">
        <button
          type="button"
          title="Zoom In"
          onClick={() => map.zoomIn()}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-slate-950/85 text-slate-200 shadow-2xl backdrop-blur-md transition-all hover:scale-105 hover:border-amber-500/50 hover:bg-slate-900 hover:text-amber-400 active:scale-95"
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          title="Zoom Out"
          onClick={() => map.zoomOut()}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-slate-950/85 text-slate-200 shadow-2xl backdrop-blur-md transition-all hover:scale-105 hover:border-amber-500/50 hover:bg-slate-900 hover:text-amber-400 active:scale-95"
        >
          <Minus size={18} />
        </button>
        <button
          type="button"
          title="Reset Basin Extent"
          onClick={handleRecenter}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-slate-950/85 text-slate-200 shadow-2xl backdrop-blur-md transition-all hover:scale-105 hover:border-amber-500/50 hover:bg-slate-900 hover:text-amber-400 active:scale-95"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </>
  );
}

function LayerItem({
  label,
  subLabel,
  active,
  available,
  onClick,
  color,
}: {
  label: string;
  subLabel?: string;
  active: boolean;
  available: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={available ? onClick : undefined}
      disabled={!available}
      className={`group flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-all ${
        available
          ? active
            ? 'bg-white/[0.07] text-white'
            : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
          : 'opacity-40 cursor-not-allowed text-slate-600'
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0 transition-transform group-hover:scale-110"
          style={{
            backgroundColor: !available ? '#475569' : active ? color : '#334155',
            boxShadow: active && available ? `0 0 8px ${color}` : 'none',
          }}
        />
        <span className="truncate">{label}</span>
      </span>
      <span
        className="mono text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{
          color: !available ? '#64748b' : active ? color : '#64748b',
          backgroundColor: active && available ? `${color}18` : 'transparent',
        }}
      >
        {!available ? 'N/A' : active ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}
