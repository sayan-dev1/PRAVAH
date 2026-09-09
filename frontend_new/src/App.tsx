import { type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity, AlertTriangle, ArrowUpRight, Bell, Check, ChevronDown,
  CircleDot, CloudRain, Crosshair, Gauge, GitBranch, Info, Layers3, LocateFixed,
  MapPinned, Menu, Mountain, Navigation, Radio, RefreshCcw, Route as RouteIcon,
  ShieldAlert, Siren, TriangleAlert, Users, X, Zap,
} from 'lucide-react';
import { useFlashShieldData, type Factor, type RiskStatus, type Village } from '@/lib/flashshield-api';
import { TacticalLeafletMap } from '@/components/tactical-leaflet-map';
import NotFound from '@/pages/not-found';
import { Route, Router as WouterRouter, Switch, useLocation } from 'wouter';

const queryClient = new QueryClient();

const statusMeta: Record<RiskStatus, { label: string; color: string; icon: typeof Check }> = {
  NORMAL: { label: 'NORMAL', color: '#4fb0a8', icon: Check },
  WATCH: { label: 'WATCH', color: '#f2994a', icon: TriangleAlert },
  CRITICAL: { label: 'CRITICAL', color: '#e5484d', icon: ShieldAlert },
};

function StatusBadge({ status, compact = false }: { status: RiskStatus; compact?: boolean }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-semibold tracking-[.12em] ${compact ? 'py-0.5' : ''}`}
      style={{ borderColor: `${meta.color}66`, color: meta.color, backgroundColor: `${meta.color}12` }}>
      <Icon size={compact ? 11 : 12} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3" data-testid="brand-pravah">
      <div className="relative grid h-9 w-9 place-items-center border border-[#f2994a]/70 bg-[#f2994a]/10">
        <Mountain size={18} className="text-[#f2994a]" aria-hidden="true" />
        <span className="absolute -right-1 -top-1 h-2 w-2 bg-[#f2994a]" />
      </div>
      <div>
        <div className="text-[15px] font-semibold tracking-[.18em] text-[#dce7ed]">PRA<span className="text-[#f2994a]">VAH</span></div>
        <div className="mono mt-0.5 text-[9px] tracking-[.2em] text-[#718493]">NDRF / EARLY-WARNING INSTRUMENT</div>
      </div>
    </div>
  );
}

function TopBar({ view, onOverview, onDeck }: { view: 'overview' | 'deck'; onOverview: () => void; onDeck: () => void }) {
  return (
    <header className="flex min-h-[64px] items-center justify-between border-b border-[#9bb1c3]/15 bg-[#0d151e] px-4 md:px-7">
      <BrandMark />
      <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
        <button data-testid="nav-national-overview" onClick={onOverview} className={`border-b-2 px-4 py-5 text-xs tracking-[.12em] transition-colors ${view === 'overview' ? 'border-[#f2994a] text-[#f2994a]' : 'border-transparent text-[#8395a3] hover:text-[#dce7ed]'}`}>NATIONAL OVERVIEW</button>
        <button data-testid="nav-mandakini-deck" onClick={onDeck} className={`border-b-2 px-4 py-5 text-xs tracking-[.12em] transition-colors ${view === 'deck' ? 'border-[#f2994a] text-[#f2994a]' : 'border-transparent text-[#8395a3] hover:text-[#dce7ed]'}`}>MANDAKINI DECK</button>
      </nav>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 text-right sm:flex">
          <span className="h-1.5 w-1.5 bg-[#4fb0a8]" aria-hidden="true" />
          <div><div className="text-[10px] font-semibold tracking-[.16em] text-[#aab9c3]">SYSTEM NOMINAL</div><div className="mono text-[9px] text-[#647887]">18 JUN 2025 · 14:32 IST</div></div>
        </div>
        <button aria-label="Open navigation" data-testid="button-open-navigation" className="grid h-9 w-9 place-items-center border border-[#9bb1c3]/20 text-[#aab9c3] md:hidden"><Menu size={17} /></button>
      </div>
    </header>
  );
}

function NationalMap() {
  return (
    <div className="relative min-h-[420px] overflow-hidden border border-[#9bb1c3]/18 bg-[#111c27] contour-bg md:min-h-[570px]">
      <div className="absolute left-5 top-5 z-10">
        <div className="mono text-[10px] tracking-[.16em] text-[#90a5b3]">INDIA / TERRAIN MODEL 01</div>
        <div className="mt-1 text-xs text-[#647887]">Regional context layer · 2012–2024 archive</div>
      </div>
      <div className="absolute bottom-4 left-5 z-10 border-l border-[#f2994a] pl-3">
        <div className="text-[10px] font-semibold tracking-[.14em] text-[#f2994a]">REGIONAL RISK CONTEXT</div>
        <div className="mt-1 text-[11px] text-[#8da0ad]">NOT LIVE TELEMETRY</div>
      </div>
      <svg viewBox="0 0 720 620" className="absolute inset-0 h-full w-full" role="img" aria-label="India regional risk context map">
        <defs><filter id="soft"><feGaussianBlur stdDeviation="13" /></filter></defs>
        <path d="M353 47 405 71 428 111 464 133 451 167 488 197 503 241 477 264 501 305 477 339 450 353 436 401 405 432 383 494 352 545 323 519 306 470 286 425 269 381 247 355 229 321 207 297 220 263 207 230 237 212 243 180 276 166 292 126 317 111 326 74Z" fill="#162632" stroke="#8ca7af" strokeOpacity=".4" strokeWidth="1.5" />
        <path d="M240 155 C302 132 370 127 457 183" fill="none" stroke="#d5824b" strokeOpacity=".16" strokeWidth="34" filter="url(#soft)" />
        <path d="M260 327 C301 304 369 311 442 348" fill="none" stroke="#4fb0a8" strokeOpacity=".16" strokeWidth="39" filter="url(#soft)" />
        <path d="M304 105 C362 116 422 131 464 172" fill="none" stroke="#f2994a" strokeOpacity=".5" strokeDasharray="3 6" />
        <path d="M262 329 C324 300 397 314 454 345" fill="none" stroke="#4fb0a8" strokeOpacity=".46" strokeDasharray="3 6" />
        <path d="M400 210 C432 237 459 270 473 308" fill="none" stroke="#e8bf72" strokeOpacity=".35" strokeDasharray="2 8" />
        <g fill="#f2994a" fillOpacity=".8"><circle cx="349" cy="136" r="4" /><circle cx="376" cy="151" r="3" /><circle cx="408" cy="171" r="3" /></g>
        <g fill="#4fb0a8" fillOpacity=".8"><circle cx="303" cy="323" r="3" /><circle cx="333" cy="315" r="3" /><circle cx="370" cy="326" r="3" /></g>
        <g transform="translate(346 142)"><circle r="13" fill="#f2994a" fillOpacity=".16" stroke="#f2994a" strokeWidth="1" /><circle r="4.5" fill="#f2994a" /><path d="M0-25v12M-25 0h12M25 0H13M0 13v12" stroke="#f2994a" strokeWidth="1" /></g>
        <g transform="translate(359 113)"><rect x="12" y="-20" width="145" height="30" fill="#101a24" stroke="#f2994a" strokeOpacity=".5" /><text x="22" y="-7" fill="#f5bf8b" fontSize="11" fontFamily="IBM Plex Mono">MANDAKINI / PILOT</text><text x="22" y="5" fill="#869ba9" fontSize="8" fontFamily="IBM Plex Sans">Rudraprayag district</text></g>
        <g fill="#8096a4" fontSize="10" fontFamily="IBM Plex Sans"><text x="235" y="145">HIMALAYAN BELT</text><text x="254" y="365">WESTERN GHATS</text><text x="454" y="207">BRAHMAPUTRA BASIN</text></g>
        <g fill="none" stroke="#6c8793" strokeOpacity=".2" strokeWidth="1"><path d="M187 93c74-52 190-58 297 15" /><path d="M169 111c82-56 215-63 332 14" /><path d="M190 420c89 48 191 58 303 1" /><path d="M177 440c97 56 216 62 322 1" /></g>
      </svg>
      <div className="absolute right-4 top-4 hidden border border-[#9bb1c3]/18 bg-[#0e1822]/85 p-3 text-[10px] text-[#8296a4] md:block">
        <div className="mb-2 font-semibold tracking-[.14em] text-[#b2c1c9]">ARCHIVE KEY</div>
        <div className="mb-1 flex items-center gap-2"><span className="h-2 w-5 bg-[#f2994a]/70" /> high recurrence</div>
        <div className="mb-1 flex items-center gap-2"><span className="h-2 w-5 bg-[#4fb0a8]/70" /> seasonal watch</div>
        <div className="flex items-center gap-2"><span className="h-2 w-5 border border-[#f2994a]" /> instrumented pilot</div>
      </div>
    </div>
  );
}

function Overview({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="mx-auto max-w-[1500px] px-4 pb-12 pt-7 md:px-7 md:pt-10">
      <section className="mb-7 grid gap-7 md:grid-cols-[1.05fr_.95fr] md:items-end">
        <div>
          <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold tracking-[.22em] text-[#f2994a]"><span className="h-px w-8 bg-[#f2994a]" /> NATIONAL FLOOD INTELLIGENCE</div>
          <h1 className="max-w-[700px] text-4xl font-semibold leading-[1.02] tracking-[-.04em] text-[#e3ebef] md:text-6xl">One country.<br /><span className="text-[#8aa3b0]">Many watersheds.</span></h1>
          <p className="mt-5 max-w-[600px] text-sm leading-6 text-[#8194a1]">Pravah gives NDRF and ward officers a single operational picture for fast-onset flood risk — from regional context to a live, instrumented river valley.</p>
        </div>
        <div className="border-l border-[#9bb1c3]/20 pl-5 md:mb-1">
          <div className="mono text-[10px] tracking-[.16em] text-[#6f8593]">ACTIVE COVERAGE / 01 VALLEY</div>
          <div className="mt-3 text-2xl font-semibold text-[#dce7ed]">Mandakini River</div>
          <div className="mt-1 text-sm text-[#8295a2]">Rudraprayag district, Uttarakhand</div>
          <button onClick={onEnter} data-testid="button-enter-command-deck" className="mt-5 inline-flex min-h-11 items-center gap-3 bg-[#f2994a] px-5 text-xs font-semibold tracking-[.1em] text-[#101820] transition-transform hover:-translate-y-0.5"><Crosshair size={16} /> ENTER COMMAND DECK <ArrowUpRight size={15} /></button>
        </div>
      </section>
      <NationalMap />
      <section className="mt-6 grid gap-px border border-[#9bb1c3]/15 bg-[#9bb1c3]/15 md:grid-cols-3">
        {[
          ['HIMALAYAN BELT', 'Slope, soil, and cloudburst recurrence', 'WATCH ARCHIVE', 'f2994a'],
          ['WESTERN GHATS', 'Monsoon intensity and urban drainage', 'SEASONAL CONTEXT', '4fb0a8'],
          ['BRAHMAPUTRA BASIN', 'Channel spread and floodplain exposure', 'SEASONAL CONTEXT', '4fb0a8'],
        ].map(([name, desc, label, color]) => (
          <div key={name} className="bg-[#131e29] p-5" data-testid={`context-region-${name.toLowerCase().replaceAll(' ', '-')}`}>
            <div className="flex items-center justify-between"><span className="text-[11px] font-semibold tracking-[.14em] text-[#c2ced4]">{name}</span><span className="h-2 w-2" style={{ backgroundColor: `#${color}` }} /></div>
            <p className="mt-3 text-xs leading-5 text-[#80939f]">{desc}</p>
            <div className="mono mt-5 text-[9px] tracking-[.15em] text-[#647986]">{label} / NOT TELEMETRY</div>
          </div>
        ))}
      </section>
    </main>
  );
}

function LayerToggle({ icon: Icon, label, on, setOn }: { icon: typeof Layers3; label: string; on: boolean; setOn: (value: boolean) => void }) {
  return (
    <button onClick={() => setOn(!on)} data-testid={`toggle-layer-${label.toLowerCase().replaceAll(' ', '-')}`} aria-pressed={on} className="flex min-h-9 items-center justify-between gap-3 border-b border-[#9bb1c3]/12 px-3 py-2 text-left text-[11px] text-[#9aacb8] last:border-0 hover:bg-white/[.03]">
      <span className="flex items-center gap-2"><Icon size={14} className={on ? 'text-[#f2994a]' : 'text-[#586f7e]'} />{label}</span><span className={`h-3 w-6 border ${on ? 'border-[#f2994a] bg-[#f2994a]/20' : 'border-[#657987]'}`}><span className={`block h-2 w-2 translate-y-0.5 bg-current transition-transform ${on ? 'translate-x-3 text-[#f2994a]' : 'translate-x-0.5 text-[#657987]'}`} /></span>
    </button>
  );
}

function TacticalMap({ telemetry, villages }: { telemetry: ReturnType<typeof useFlashShieldData>['telemetry']; villages: Village[] }) {
  return <TacticalLeafletMap telemetry={telemetry} villages={villages} />;
}

function TacticalMapSvg({ telemetry, villages }: { telemetry: ReturnType<typeof useFlashShieldData>['telemetry']; villages: Village[] }) {
  const [heat, setHeat] = useState(true);
  const [routes, setRoutes] = useState(true);
  const [villageLayer, setVillageLayer] = useState(true);
  const surge = telemetry.status === 'CRITICAL';
  return (
    <div className="relative min-h-[470px] overflow-hidden border border-[#9bb1c3]/18 bg-[#101b25] md:min-h-[600px]" data-testid="map-tactical-mandakini">
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(rgba(137,164,177,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(137,164,177,.1) 1px, transparent 1px)', backgroundSize: '38px 38px' }} />
      <svg viewBox="0 0 760 580" className="absolute inset-0 h-full w-full" aria-label="Mandakini tactical map" role="img">
        <defs>
          <filter id="blurHeat"><feGaussianBlur stdDeviation={surge ? 22 : 17} /></filter>
          <linearGradient id="river" x1="0" x2="1"><stop stopColor="#4fb0a8" /><stop offset=".55" stopColor="#78c8c0" /><stop offset="1" stopColor="#f2994a" /></linearGradient>
        </defs>
        <g fill="none" stroke="#7d98a5" strokeOpacity=".18" strokeWidth="1">
          <path d="M-30 76 C110 28 208 121 318 74 S565 12 800 95" /><path d="M-30 100 C110 52 208 145 318 98 S565 36 800 119" />
          <path d="M-30 452 C105 392 219 506 326 442 S578 396 800 465" /><path d="M-30 478 C105 418 219 532 326 468 S578 422 800 491" />
          <path d="M83 0 C145 112 89 197 174 280 S140 456 212 600" /><path d="M604 0 C548 124 628 176 552 282 S591 467 518 600" />
        </g>
        <g stroke="#314f5f" strokeWidth="18" fill="none" opacity=".55"><path d="M40 528 C138 453 190 426 229 359 S277 285 350 286 S415 315 478 246 S595 144 726 72" /></g>
        <path d="M40 528 C138 453 190 426 229 359 S277 285 350 286 S415 315 478 246 S595 144 726 72" stroke="url(#river)" strokeWidth="5" fill="none" />
        {heat && <g filter="url(#blurHeat)" opacity={surge ? 0.7 : 0.28} fill={surge ? '#e5484d' : '#f2994a'}><ellipse cx="229" cy="359" rx={surge ? 100 : 66} ry={surge ? 80 : 52} /><ellipse cx="273" cy="322" rx={surge ? 67 : 45} ry={surge ? 58 : 38} /></g>}
        {routes && <><path d="M209 397 L260 354 L302 317 L351 289" stroke="#e3bb77" strokeWidth="2" strokeDasharray="7 5" fill="none" /><path d="M211 397 L198 337 L182 291" stroke="#e3bb77" strokeWidth="2" strokeDasharray="7 5" fill="none" /></>}
        {villageLayer && villages.map((village) => {
          const pos = village.id === 'tilwara' ? { x: 229, y: 359 } : village.id === 'sumerpur' ? { x: 350, y: 286 } : { x: 478, y: 246 };
          const c = statusMeta[village.status].color;
          return <g key={village.id} transform={`translate(${pos.x} ${pos.y})`}><circle r={village.status === 'CRITICAL' ? 18 : 12} fill={c} fillOpacity=".16" stroke={c} strokeWidth="1" /><circle r="4.5" fill={c} /><text x="12" y="4" fill="#d8e2e7" fontSize="11" fontFamily="IBM Plex Sans">{village.name}</text></g>;
        })}
        {routes && <g transform="translate(176 268)"><path d="M0 9 9 0l9 9-9 9Z" fill="#e3bb77" /><text x="23" y="5" fill="#d5b673" fontSize="10" fontFamily="IBM Plex Sans">HIGH SCHOOL GROUNDS</text></g>}
      </svg>
      <div className="absolute left-4 top-4 border border-[#9bb1c3]/18 bg-[#0d1720]/90 px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[.15em] text-[#b6c6cf]"><LocateFixed size={13} className="text-[#f2994a]" /> MANDAKINI VALLEY</div>
        <div className="mono mt-1 text-[9px] text-[#647b8a]">30.284° N / 78.981° E · ZONE 04</div>
      </div>
      <div className="absolute right-4 top-4 w-44 border border-[#9bb1c3]/18 bg-[#0d1720]/95">
        <div className="border-b border-[#9bb1c3]/15 px-3 py-2 text-[10px] font-semibold tracking-[.14em] text-[#b6c6cf]"><Layers3 size={13} className="mr-2 inline text-[#f2994a]" />LAYERS</div>
        <LayerToggle icon={Zap} label="Flood intensity" on={heat} setOn={setHeat} />
        <LayerToggle icon={Users} label="Village status" on={villageLayer} setOn={setVillageLayer} />
        <LayerToggle icon={RouteIcon} label="Evacuation route" on={routes} setOn={setRoutes} />
      </div>
      <div className="absolute bottom-4 left-4 border border-[#9bb1c3]/18 bg-[#0d1720]/95 p-3">
        <div className="mb-2 text-[9px] font-semibold tracking-[.15em] text-[#8296a4]">MAP LEGEND</div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-[#9aacb8]"><span className="flex items-center gap-1.5"><i className="h-2 w-2 bg-[#4fb0a8]" /> normal</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 bg-[#f2994a]" /> watch</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 bg-[#e5484d]" /> critical</span><span className="flex items-center gap-1.5"><i className="h-2 w-5 border-t border-dashed border-[#e3bb77]" /> route</span></div>
      </div>
      <div className="absolute bottom-4 right-4 border border-[#9bb1c3]/18 bg-[#0d1720]/95 px-3 py-2 text-[10px] text-[#718695]"><span className="mono mr-3">N</span><span className="inline-block h-4 border-l border-[#f2994a] align-middle" /></div>
    </div>
  );
}

function TelemetryStrip({ telemetry }: { telemetry: ReturnType<typeof useFlashShieldData>['telemetry'] }) {
  return (
    <section className="grid border border-[#9bb1c3]/18 bg-[#131e29] sm:grid-cols-3">
      {[
        { label: 'RAINFALL INTENSITY', value: telemetry.rainfall, unit: 'mm/hr', note: telemetry.rainfall > 50 ? 'Cloudburst cell detected' : 'At station threshold', icon: CloudRain, color: telemetry.rainfall > 50 ? '#e5484d' : '#4fb0a8' },
        { label: 'RIVER LEVEL', value: telemetry.riverLevel, unit: 'cm', note: telemetry.riverLevel > 114 ? 'Rising at bridge gauge' : 'Within channel range', icon: Gauge, color: telemetry.riverLevel > 114 ? '#e5484d' : '#4fb0a8' },
        { label: 'RATE OF RISE', value: telemetry.rateOfRise.toFixed(1), unit: 'cm/min', note: telemetry.rateOfRise > 3 ? 'Rapid rise — act now' : telemetry.rateOfRise > 1 ? 'Acceleration observed' : 'Stable movement', icon: Activity, color: telemetry.rateOfRise > 3 ? '#e5484d' : telemetry.rateOfRise > 1 ? '#f2994a' : '#4fb0a8' },
      ].map((metric) => {
        const Icon = metric.icon;
        return <div key={metric.label} className="border-b border-[#9bb1c3]/15 p-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-0" data-testid={`telemetry-${metric.label.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-center justify-between"><span className="text-[10px] font-semibold tracking-[.13em] text-[#8195a2]">{metric.label}</span><Icon size={15} style={{ color: metric.color }} /></div><div className="mono mt-3 text-3xl text-[#e0e9ed]">{metric.value}<span className="ml-2 text-xs text-[#8498a5]">{metric.unit}</span></div><div className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ color: metric.color }}><span className="h-1.5 w-1.5" style={{ backgroundColor: metric.color }} />{metric.note}</div></div>;
      })}
    </section>
  );
}

function VillageLedger({ villages, selectedId, onSelect }: { villages: Village[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <section className="border border-[#9bb1c3]/18 bg-[#131e29]">
      <div className="flex items-center justify-between border-b border-[#9bb1c3]/15 px-4 py-3"><div className="flex items-center gap-2 text-[10px] font-semibold tracking-[.15em] text-[#b7c5cc]"><MapPinned size={14} className="text-[#f2994a]" /> VILLAGE LEDGER</div><span className="mono text-[9px] text-[#647a88]">3 SITES / ORDERED BY EXPOSURE</span></div>
      <div className="divide-y divide-[#9bb1c3]/10">
        {villages.map((village) => (
          <button key={village.id} onClick={() => onSelect(village.id)} data-testid={`button-village-${village.id}`} className={`grid min-h-[70px] w-full grid-cols-[1fr_auto] items-center gap-3 px-4 text-left transition-colors hover:bg-white/[.025] ${selectedId === village.id ? 'bg-[#f2994a]/[.06]' : ''}`}>
            <div><div className="flex items-center gap-2 text-sm text-[#d5e0e5]"><span className="mono text-[10px] text-[#607785]">{village.id === 'tilwara' ? '01' : village.id === 'sumerpur' ? '02' : '03'}</span>{village.name}</div><div className="mt-2 flex gap-4 text-[10px] text-[#718795]"><span>{village.population.toLocaleString('en-IN')} exposed</span><span>{village.distance} from gauge</span></div></div>
            <div className="flex flex-col items-end gap-2"><StatusBadge status={village.status} compact /><span className="mono text-[10px] text-[#738997]">{village.eta === '—' ? 'NO ETA' : `${village.eta} lead`}</span></div>
          </button>
        ))}
      </div>
    </section>
  );
}

function Feed() {
  const entries = [
    ['14:32:08', 'MNDK-04', 'River gauge heartbeat received', 'normal'],
    ['14:31:54', 'RAIN-02', 'Precipitation packet reconciled', 'normal'],
    ['14:30:22', 'WARD-RDP', 'Volunteer roster sync complete', 'watch'],
    ['14:28:06', 'MNDK-03', 'Upstream camera frame indexed', 'normal'],
  ];
  return <section className="border border-[#9bb1c3]/18 bg-[#131e29]"><div className="border-b border-[#9bb1c3]/15 px-4 py-3 text-[10px] font-semibold tracking-[.15em] text-[#b7c5cc]"><Radio size={14} className="mr-2 inline text-[#4fb0a8]" /> TELEMETRY FEED</div><div className="divide-y divide-[#9bb1c3]/10">{entries.map(([time, source, message, state]) => <div key={time} className="grid grid-cols-[58px_62px_1fr] gap-2 px-4 py-3 text-[10px]"><span className="mono text-[#647b89]">{time}</span><span className={state === 'watch' ? 'text-[#f2994a]' : 'text-[#4fb0a8]'}>{source}</span><span className="text-[#91a4ae]">{message}</span></div>)}</div></section>;
}

function Factors({ factors }: { factors: Factor[] }) {
  return <section className="border border-[#9bb1c3]/18 bg-[#131e29]"><div className="border-b border-[#9bb1c3]/15 px-4 py-3 text-[10px] font-semibold tracking-[.15em] text-[#b7c5cc]"><GitBranch size={14} className="mr-2 inline text-[#f2994a]" /> CONTRIBUTING FACTORS <span className="ml-2 font-normal tracking-normal text-[#657b88]">/ SHAP RANKING</span></div><div className="p-4">{factors.map((factor) => <div key={factor.label} className="mb-4 last:mb-0"><div className="mb-1.5 flex justify-between text-[11px]"><span className="text-[#b9c7cd]">{factor.label}</span><span className="mono text-[#f2994a]">{factor.value}%</span></div><div className="h-1 bg-[#263743]"><div className="h-1 bg-[#f2994a]" style={{ width: `${factor.value}%` }} /></div><div className="mt-1 text-[9px] text-[#687f8d]">{factor.detail}</div></div>)}</div></section>;
}

function Recommendations({ village }: { village: Village }) {
  return <section className="border border-[#9bb1c3]/18 bg-[#131e29]"><div className="border-b border-[#9bb1c3]/15 px-4 py-3 text-[10px] font-semibold tracking-[.15em] text-[#b7c5cc]"><Navigation size={14} className="mr-2 inline text-[#f2994a]" /> RECOMMENDATION / {village.name.toUpperCase()}</div><div className="p-4"><div className="mb-3 flex gap-3 border-l-2 border-[#f2994a] pl-3 text-sm leading-5 text-[#d5e0e5]"><Info size={15} className="mt-0.5 shrink-0 text-[#f2994a]" />{village.recommendation}</div><div className="flex gap-2 text-[10px] text-[#708795]"><Check size={13} className="text-[#4fb0a8]" /> Rule set R-04 · reviewed 18 Jun 2025</div></div></section>;
}

function IncidentModal({ onClose, acknowledged, onAcknowledge }: { onClose: () => void; acknowledged: boolean; onAcknowledge: () => void }) {
  return <div className="fixed inset-0 z-40 grid place-items-center bg-[#071018]/80 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="incident-title" data-testid="modal-incident-order"><div className="w-full max-w-lg border border-[#e5484d]/70 bg-[#121c26]"><div className="flex items-start justify-between border-b border-[#e5484d]/30 bg-[#e5484d]/[.08] p-5"><div className="flex gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center border border-[#e5484d]/60 text-[#e5484d]"><Siren size={18} className="pulse-soft" /></div><div><div className="mono text-[9px] tracking-[.2em] text-[#e5484d]">INCIDENT ORDER / SIM-2025-0618-01</div><h2 id="incident-title" className="mt-1 text-xl font-semibold text-[#f0d9da]">Tilwara — rapid rise</h2><div className="mt-1 text-xs text-[#bf9396]">Critical action threshold crossed at 14:33:01 IST</div></div></div><button aria-label="Dismiss incident modal" data-testid="button-dismiss-incident" onClick={onClose} className="text-[#a5797c] hover:text-[#f0d9da]"><X size={19} /></button></div><div className="space-y-5 p-5"><div className="grid grid-cols-2 gap-px border border-[#9bb1c3]/15 bg-[#9bb1c3]/15"><div className="bg-[#151f29] p-4"><div className="text-[10px] tracking-[.12em] text-[#8295a2]">LEAD TIME</div><div className="mono mt-2 text-2xl text-[#e3eaed]">42 <span className="text-xs text-[#8b9da7]">min</span></div></div><div className="bg-[#151f29] p-4"><div className="text-[10px] tracking-[.12em] text-[#8295a2]">SHELTER</div><div className="mt-2 text-sm text-[#e3eaed]">High School Grounds</div></div></div><div><div className="mb-2 text-[10px] font-semibold tracking-[.14em] text-[#8497a3]">ORDERED ACTIONS</div><div className="space-y-2">{['Sound village alarm horn', 'Deploy field unit 03', 'Move residents via uphill corridor'].map((action, i) => <div key={action} className="flex items-center gap-3 border-b border-[#9bb1c3]/10 pb-2 text-sm text-[#ccd8dd]"><span className="mono text-[10px] text-[#e5484d]">0{i + 1}</span>{action}</div>)}</div></div><div className="flex gap-2 text-[11px] leading-5 text-[#9aacb8]"><RouteIcon size={15} className="mt-0.5 shrink-0 text-[#e3bb77]" /> Uphill corridor via NH-7 service lane. Keep the lower footbridge clear for response vehicles.</div></div><div className="flex justify-end gap-2 border-t border-[#9bb1c3]/15 p-4"><button onClick={onClose} data-testid="button-dismiss-incident-secondary" className="min-h-10 border border-[#9bb1c3]/25 px-4 text-xs text-[#9aacb8] hover:bg-white/[.04]">DISMISS</button><button onClick={onAcknowledge} data-testid="button-acknowledge-incident" className="min-h-10 bg-[#e5484d] px-4 text-xs font-semibold tracking-[.08em] text-[#170d10]">{acknowledged ? 'ACKNOWLEDGED' : 'ACKNOWLEDGE ORDER'}</button></div></div></div>;
}

function CommandDeck({ onOverview }: { onOverview: () => void }) {
  const data = useFlashShieldData();
  const [showActions, setShowActions] = useState(false);
  const selected = data.selected ?? data.villages[0];
  const overall = data.telemetry.status;
  const actionLabel = data.incidentAcknowledged ? 'ORDER ACKNOWLEDGED' : 'REVIEW INCIDENT ORDER';
  return (
    <main className="mx-auto max-w-[1600px] px-3 pb-12 pt-4 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#9bb1c3]/15 pb-4">
        <div><div className="flex items-center gap-2 text-[10px] tracking-[.17em] text-[#8297a4]"><button onClick={onOverview} data-testid="button-breadcrumb-overview" className="hover:text-[#f2994a]">NATIONAL OVERVIEW</button><span>/</span><span className="text-[#d2dce1]">MANDAKINI COMMAND DECK</span></div><div className="mt-2 flex items-center gap-3"><h1 className="text-xl font-semibold tracking-[-.02em] text-[#e0e9ed]">Mandakini River Valley</h1><StatusBadge status={overall} /></div></div>
        <div className="flex items-center gap-2"><button onClick={() => setShowActions(!showActions)} data-testid="button-action-list" className="flex min-h-10 items-center gap-2 border border-[#9bb1c3]/25 px-3 text-[10px] tracking-[.1em] text-[#b5c4cb] hover:border-[#f2994a]/60"><Bell size={14} className="text-[#f2994a]" /> ACTION LIST <ChevronDown size={14} /></button><button onClick={data.reset} disabled={data.isSimulating} data-testid="button-reset-demo" className="flex min-h-10 items-center gap-2 border border-[#9bb1c3]/25 px-3 text-[10px] tracking-[.1em] text-[#b5c4cb] hover:border-[#f2994a]/60 disabled:opacity-50"><RefreshCcw size={14} /> RESET</button><button onClick={data.simulateCloudburst} disabled={data.isSimulating || data.incidentAcknowledged} data-testid="button-trigger-cloudburst" className="flex min-h-10 items-center gap-2 bg-[#f2994a] px-4 text-[10px] font-semibold tracking-[.1em] text-[#121a20] disabled:cursor-wait disabled:opacity-50"><CloudRain size={15} /> {data.isSimulating ? 'RUNNING SURGE…' : 'TRIGGER CLOUDBURST'}</button></div>
      </div>
      {showActions && <div className="mb-4 border border-[#f2994a]/40 bg-[#f2994a]/[.06] p-4" data-testid="panel-action-list"><div className="flex items-center justify-between"><div className="text-[10px] font-semibold tracking-[.16em] text-[#f2994a]">FIELD ACTION LIST / TILWARA</div><button onClick={() => setShowActions(false)} aria-label="Close action list" data-testid="button-close-action-list"><X size={15} className="text-[#9e8069]" /></button></div><div className="mt-3 grid gap-2 text-sm text-[#c6d2d8] sm:grid-cols-3"><div className="flex items-center gap-2"><Siren size={14} className="text-[#f2994a]" /> Sound village alarm horn</div><div className="flex items-center gap-2"><Users size={14} className="text-[#f2994a]" /> Deploy field unit 03</div><div className="flex items-center gap-2"><RouteIcon size={14} className="text-[#f2994a]" /> Open uphill corridor</div></div></div>}
      {data.error && <div className="mb-4 border border-[#e5484d]/50 bg-[#e5484d]/[.08] px-4 py-3 text-xs text-[#f0b5b7]" role="alert">BACKEND UNAVAILABLE · {data.error}</div>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4"><TacticalMap telemetry={data.telemetry} villages={data.villages} /><TelemetryStrip telemetry={data.telemetry} /></div>
        <aside className="space-y-4"><div className="border border-[#9bb1c3]/18 bg-[#131e29] p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] font-semibold tracking-[.15em] text-[#b7c5cc]"><Radio size={14} className="text-[#4fb0a8]" /> INGESTION</div><span className="flex items-center gap-1.5 text-[9px] text-[#4fb0a8]"><span className="h-1.5 w-1.5 bg-[#4fb0a8]" /> {data.isLoading ? 'CONNECTING' : data.ws.isMock ? 'MOCK TICKER' : 'LIVE SOCKET'}</span></div><div className="mono mt-3 text-[10px] text-[#6f8592]">{data.telemetry.station} · 1.0 Hz · 5/5 packets</div></div><VillageLedger villages={data.villages} selectedId={data.selectedVillage} onSelect={data.setSelectedVillage} /></aside>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]"><Feed /><Factors factors={data.factors} /><Recommendations village={selected} /></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[#9bb1c3]/15 bg-[#111c26] px-4 py-3"><div className="flex items-center gap-2 text-[11px] text-[#8799a4]"><CircleDot size={14} className="text-[#4fb0a8]" /> Data is simulated for operator training. Live pilot telemetry is isolated to the Mandakini valley.</div>{overall === 'CRITICAL' && <button onClick={() => data.setIncidentOpen(true)} data-testid="button-open-incident-order" className="flex min-h-9 items-center gap-2 border border-[#e5484d]/50 px-3 text-[10px] font-semibold tracking-[.1em] text-[#e5484d]"><AlertTriangle size={14} /> {actionLabel}</button>}</div>
      {data.incidentOpen && <IncidentModal onClose={() => data.setIncidentOpen(false)} acknowledged={data.incidentAcknowledged} onAcknowledge={() => data.setIncidentAcknowledged(true)} />}
    </main>
  );
}

function Home() {
  const [view, setView] = useState<'overview' | 'deck'>('overview');
  return <div className="screen-noise min-h-[100dvh] bg-[#0f1720] text-[#d7e0e8]"><TopBar view={view} onOverview={() => setView('overview')} onDeck={() => setView('deck')} />{view === 'overview' ? <Overview onEnter={() => setView('deck')} /> : <CommandDeck onOverview={() => setView('overview')} />}</div>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;