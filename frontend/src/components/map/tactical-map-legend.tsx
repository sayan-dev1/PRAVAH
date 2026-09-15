import { Info, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { DataProvenance } from './types';

export function TacticalMapLegend({
  provenance,
  hasEvacuation,
  hasShelters,
  hasRadar,
}: {
  provenance: DataProvenance;
  hasEvacuation: boolean;
  hasShelters: boolean;
  hasRadar: boolean;
}) {
  const provenanceBadges: Record<DataProvenance, { label: string; color: string; bg: string }> = {
    LIVE_OBSERVED: { label: 'LIVE OBSERVED', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    MODEL_WEATHER: { label: 'WEATHER MODEL', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
    DERIVED: { label: 'HYDRO DERIVED', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
    GIS: { label: 'REGIONAL GIS', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)' },
    ML_MODEL: { label: 'ML PREDICTED', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    SIMULATION: { label: 'SIMULATED DRILL', color: '#f97316', bg: 'rgba(249, 115, 22, 0.2)' },
    UNAVAILABLE: { label: 'DATA UNAVAILABLE', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
  };

  const prov = provenanceBadges[provenance] ?? provenanceBadges.UNAVAILABLE;

  return (
    <div className="absolute bottom-4 left-4 z-[500] max-w-sm rounded-2xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between border-b border-white/[0.08] pb-1.5 text-xs font-bold text-white">
        <span className="tracking-wider flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span>TACTICAL MAP KEY</span>
        </span>
        <span
          className="mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10"
          style={{ color: prov.color, backgroundColor: prov.bg }}
        >
          {prov.label}
        </span>
      </div>

      {/* Risk Tiers */}
      <div className="grid grid-cols-3 gap-2 text-xs text-slate-300 font-medium mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
          <span>Watch</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500 pulse-soft shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
          <span>Critical</span>
        </div>
      </div>

      {/* Operational Features */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] text-slate-400 font-medium pt-1.5 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-3 rounded-full bg-cyan-400" />
          <span>River Reach</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm border border-cyan-400 bg-cyan-400/30" />
          <span>Gauge</span>
        </div>
        {hasEvacuation && (
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 border-t-2 border-dashed border-amber-400" />
            <span className="text-amber-300 font-medium">Evac Route</span>
          </div>
        )}
        {hasShelters && (
          <div className="flex items-center gap-1 text-amber-300 font-bold">
            <span>⚑</span>
            <span>Shelter</span>
          </div>
        )}
        {hasRadar && (
          <div className="flex items-center gap-1 text-purple-300 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            <span>Radar Context</span>
          </div>
        )}
      </div>
    </div>
  );
}
