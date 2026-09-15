import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  CircleDot,
  Clock,
  CloudRain,
  Compass,
  Crosshair,
  Gauge,
  GitBranch,
  HelpCircle,
  Info,
  Layers,
  MapPinned,
  Menu,
  Mountain,
  Navigation,
  Radio,
  RefreshCcw,
  Route as RouteIcon,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  TriangleAlert,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  getRegions,
  useFlashShieldData,
  type DetailedRiskViewModel,
  type Region,
  type RiskStatus,
  type TelemetryViewModel,
  type VillageViewModel,
} from '@/lib/flashshield-api';
import { TacticalLeafletMap } from '@/components/tactical-leaflet-map';
import NotFound from '@/pages/not-found';
import { Route, Router as WouterRouter, Switch, useLocation } from 'wouter';

const queryClient = new QueryClient();

const statusMeta: Record<RiskStatus, { label: string; color: string; icon: typeof Check; bg: string }> = {
  NORMAL: { label: 'NORMAL', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', icon: ShieldCheck },
  WATCH: { label: 'WATCH', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', icon: TriangleAlert },
  CRITICAL: { label: 'CRITICAL', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', icon: ShieldAlert },
  FAULTY_STUCK: { label: 'FAULTY SENSOR', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', icon: AlertTriangle },
  DATA_UNAVAILABLE: { label: 'UNAVAILABLE', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', icon: CircleDot },
  UNKNOWN: { label: 'UNKNOWN', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', icon: CircleDot },
};

function playAudioChime(type: 'critical' | 'alert' | 'nominal') {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'critical') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'alert') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.setValueAtTime(680, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Audio context may be restricted by autoplay policy
  }
}

function StatusBadge({ status, compact = false }: { status?: RiskStatus | null; compact?: boolean }) {
  const currentStatus = status ?? 'UNKNOWN';
  const meta = statusMeta[currentStatus] ?? statusMeta.UNKNOWN;
  const Icon = meta.icon;
  const isCritical = currentStatus === 'CRITICAL';
  
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold tracking-wide transition-all ${
        compact ? 'px-2.5 py-0.5 text-[11px]' : 'px-3.5 py-1 text-xs'
      } ${isCritical ? 'animate-pulse shadow-[0_0_16px_rgba(244,63,94,0.4)] ring-1 ring-rose-500/50' : 'ring-1 ring-white/10'}`}
      style={{
        color: meta.color,
        backgroundColor: meta.bg,
      }}
    >
      <Icon size={compact ? 12 : 14} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3.5" data-testid="brand-pravah">
      <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 shadow-lg shadow-orange-500/25 border border-amber-400/30">
        <Mountain size={20} className="text-slate-950" aria-hidden="true" />
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
      </div>
      <div>
        <div className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white">
          <span>PRA<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">VAH</span></span>
          <span className="mono rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
            v2.5
          </span>
        </div>
        <div className="mono text-[11px] tracking-wider text-slate-400 font-medium">
          NDRF · EARLY WARNING SYSTEM
        </div>
      </div>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const istString = time.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateString = time
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();

  return (
    <div className="hidden items-center gap-3 rounded-xl border border-white/[0.08] bg-slate-900/60 px-3.5 py-1.5 sm:flex backdrop-blur-md">
      <Clock size={15} className="text-slate-400" />
      <div className="text-right leading-tight">
        <div className="mono text-xs font-bold text-slate-100">
          {istString} <span className="text-amber-400 font-extrabold">IST</span>
        </div>
        <div className="mono text-[10px] text-slate-400 font-medium">{dateString}</div>
      </div>
    </div>
  );
}

function TopBar({
  view,
  onOverview,
  onDeck,
  status,
  wsConnected,
  isAudioOn,
  onToggleAudio,
  onOpenManual,
}: {
  view: 'overview' | 'deck';
  onOverview: () => void;
  onDeck: () => void;
  status?: RiskStatus | null;
  wsConnected: boolean;
  isAudioOn: boolean;
  onToggleAudio: () => void;
  onOpenManual: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex min-h-[68px] items-center justify-between border-b border-white/[0.08] bg-[#070b12]/85 px-4 backdrop-blur-xl md:px-8">
      <BrandMark />

      {/* Segmented Navigation Tab Pill */}
      <nav className="hidden items-center rounded-full border border-white/[0.08] bg-slate-900/80 p-1 backdrop-blur-md md:flex" aria-label="Primary navigation">
        <button
          data-testid="nav-national-overview"
          onClick={onOverview}
          className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold tracking-wider transition-all ${
            view === 'overview'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Compass size={15} />
          <span>NATIONAL OVERVIEW</span>
        </button>

        <button
          data-testid="nav-mandakini-deck"
          onClick={onDeck}
          className={`relative flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold tracking-wider transition-all ${
            view === 'deck'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Crosshair size={15} />
          <span>COMMAND DECK</span>
          {status === 'CRITICAL' && (
            <span className="h-2 w-2 rounded-full bg-rose-500 pulse-fast shadow-[0_0_8px_#f43f5e]" />
          )}
        </button>
      </nav>

      <div className="flex items-center gap-3">
        {/* Audio Alert Toggle */}
        <button
          type="button"
          onClick={onToggleAudio}
          title={isAudioOn ? 'Audio alarms active (Click to mute)' : 'Audio alarms muted (Click to enable)'}
          className={`grid h-10 w-10 place-items-center rounded-xl border transition-all ${
            isAudioOn
              ? 'border-amber-500/40 bg-amber-500/15 text-amber-400 shadow-sm shadow-amber-500/10'
              : 'border-white/10 bg-slate-900/70 text-slate-400 hover:text-white hover:border-white/20'
          }`}
        >
          {isAudioOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>

        {/* Operator Manual */}
        <button
          type="button"
          onClick={onOpenManual}
          title="Tactical Guide & System Architecture"
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-slate-900/70 text-slate-300 hover:border-amber-500/50 hover:text-amber-400 transition-all"
        >
          <HelpCircle size={17} />
        </button>

        {/* Live Status indicator */}
        <div className="hidden items-center gap-3 rounded-xl border border-white/[0.08] bg-slate-900/70 px-3.5 py-1.5 sm:flex backdrop-blur-md">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              !wsConnected
                ? 'bg-slate-500'
                : status === 'CRITICAL'
                ? 'bg-rose-500 pulse-fast shadow-[0_0_10px_#f43f5e]'
                : 'bg-emerald-400 pulse-soft shadow-[0_0_10px_#34d399]'
            }`}
            aria-hidden="true"
          />
          <div>
            <div className="text-xs font-bold tracking-wider text-slate-100">
              {!wsConnected
                ? 'OFFLINE'
                : status === 'CRITICAL'
                ? 'SURGE ALERT'
                : status === 'WATCH'
                ? 'WATCH STAGE'
                : 'NOMINAL'}
            </div>
            <div className="mono text-[10px] text-slate-400 font-medium">
              {wsConnected ? 'LIVE SOCKET' : 'DISCONNECTED'}
            </div>
          </div>
        </div>

        <LiveClock />

        <button
          aria-label="Toggle navigation"
          data-testid="button-open-navigation"
          onClick={view === 'overview' ? onDeck : onOverview}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-slate-900 text-slate-200 md:hidden"
        >
          <Menu size={18} />
        </button>
      </div>
    </header>
  );
}

function NationalMap({ onEnterPilot, region }: { onEnterPilot: () => void; region?: Region }) {
  const regionName = region?.name ?? 'Selected Region';
  const regionDistrict = region?.district ?? 'Monitored District';

  return (
    <div className="relative min-h-[500px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#090e16] shadow-2xl contour-bg md:min-h-[620px]">
      {/* Top Left Watermark */}
      <div className="absolute left-6 top-6 z-10 space-y-1 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 pulse-soft" />
          <div className="mono text-xs font-bold tracking-wider text-slate-100">
            INDIA / WATERSHED RISK OBSERVATORY
          </div>
        </div>
        <div className="text-xs text-slate-400 font-normal">
          Multi-Basin Runtime Early-Warning Overview
        </div>
      </div>

      {/* Bottom Left Context Warning */}
      <div className="absolute bottom-6 left-6 z-10 rounded-xl border border-amber-500/30 bg-slate-950/85 px-4 py-3 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-amber-400">
          <Zap size={14} />
          <span>OPERATIONAL DEPLOYMENTS</span>
        </div>
        <div className="mt-0.5 text-xs text-slate-300 font-medium">
          Configuration-Driven GIS Bundles loaded dynamically from backend registry.
        </div>
      </div>

      {/* SVG Map of India with Tactical Markers */}
      <svg
        viewBox="0 0 720 620"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="India regional risk context map"
      >
        <defs>
          <filter id="soft">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="glowRadar">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="indiaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#131e2e" />
            <stop offset="100%" stopColor="#0a101a" />
          </linearGradient>
        </defs>

        {/* Outline boundary of India subcontinent */}
        <path
          d="M353 47 405 71 428 111 464 133 451 167 488 197 503 241 477 264 501 305 477 339 450 353 436 401 405 432 383 494 352 545 323 519 306 470 286 425 269 381 247 355 229 321 207 297 220 263 207 230 237 212 243 180 276 166 292 126 317 111 326 74Z"
          fill="url(#indiaGrad)"
          stroke="#475569"
          strokeOpacity=".6"
          strokeWidth="1.5"
        />

        {/* Major Watershed Risk Heat Halos */}
        <path
          d="M240 155 C302 132 370 127 457 183"
          fill="none"
          stroke="#f97316"
          strokeOpacity=".3"
          strokeWidth="48"
          filter="url(#soft)"
        />
        <path
          d="M260 327 C301 304 369 311 442 348"
          fill="none"
          stroke="#10b981"
          strokeOpacity=".25"
          strokeWidth="48"
          filter="url(#soft)"
        />

        {/* Watershed flow vectors */}
        <path
          d="M304 105 C362 116 422 131 464 172"
          fill="none"
          stroke="#f97316"
          strokeOpacity=".7"
          strokeDasharray="4 6"
        />
        <path
          d="M262 329 C324 300 397 314 454 345"
          fill="none"
          stroke="#10b981"
          strokeOpacity=".6"
          strokeDasharray="4 6"
        />

        {/* Western Ghats Points */}
        <g fill="#10b981" fillOpacity=".9">
          <circle cx="303" cy="323" r="4.5" />
          <circle cx="333" cy="315" r="4.5" />
          <circle cx="370" cy="326" r="4.5" />
        </g>

        {/* Brahmaputra Points */}
        <g fill="#f59e0b" fillOpacity=".9">
          <circle cx="488" cy="197" r="4.5" />
          <circle cx="464" cy="180" r="4.5" />
        </g>

        {/* Active deployment focus reticle & pulse rings */}
        <g transform="translate(346 142)">
          <circle r="36" fill="none" stroke="#f97316" strokeOpacity=".3" strokeWidth="1.5" strokeDasharray="4 4" className="radar-spin" />
          <circle r="22" fill="#f97316" fillOpacity=".2" stroke="#f97316" strokeWidth="2" className="pulse-soft" />
          <circle r="7" fill="#f97316" filter="url(#glowRadar)" />
          <path d="M0-34v16M-34 0h16M34 0H18M0 18v16" stroke="#f97316" strokeWidth="2" />
        </g>

        {/* Callout Card for active deployment */}
        <g transform="translate(362 108)" className="cursor-pointer group" onClick={onEnterPilot}>
          <rect
            x="12"
            y="-26"
            width="210"
            height="48"
            fill="#090e17"
            stroke="#f97316"
            strokeWidth="1.5"
            rx="8"
          />
          <text x="24" y="-8" fill="#fbbf24" fontSize="12" fontFamily="JetBrains Mono" fontWeight="bold">
            {regionName.toUpperCase()}
          </text>
          <text x="24" y="10" fill="#94a3b8" fontSize="11" fontFamily="Plus Jakarta Sans" fontWeight="500">
            {regionDistrict} · Open Deck →
          </text>
        </g>

        {/* Geographical Labels */}
        <g fill="#64748b" fontSize="11" fontFamily="Plus Jakarta Sans" fontWeight="700" letterSpacing="0.08em">
          <text x="220" y="145">HIMALAYAN WATERSHED</text>
          <text x="240" y="375">WESTERN GHATS</text>
          <text x="440" y="210">BRAHMAPUTRA BASIN</text>
        </g>
      </svg>

      {/* Floating Modern Key */}
      <div className="absolute right-6 top-6 hidden rounded-xl border border-white/10 bg-slate-950/85 p-4 text-xs text-slate-300 shadow-2xl backdrop-blur-md md:block">
        <div className="mb-3 font-bold tracking-wider text-white">OPERATIONAL KEY</div>
        <div className="mb-2 flex items-center gap-2.5 font-medium">
          <span className="h-2.5 w-6 rounded-full bg-amber-500/90 shadow-[0_0_8px_rgba(245,158,11,0.5)]" /> Cloudburst recurrence
        </div>
        <div className="mb-2 flex items-center gap-2.5 font-medium">
          <span className="h-2.5 w-6 rounded-full bg-emerald-500/90 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Monsoon watch
        </div>
        <div className="flex items-center gap-2.5 font-medium">
          <span className="h-3 w-6 rounded-full border border-orange-500 bg-orange-500/30" /> Active pilot
        </div>
      </div>
    </div>
  );
}

function Overview({ onEnter, region }: { onEnter: () => void; region?: Region }) {
  const currentRegion = region ?? {
    region_id: 'loading',
    name: 'Loading Region…',
    state: 'National Observatory',
    district: 'Multi-Basin',
  };

  return (
    <main className="mx-auto max-w-[1560px] px-4 pb-16 pt-8 md:px-8 md:pt-12">
      {/* Hero Section */}
      <section className="mb-10 grid gap-8 md:grid-cols-[1.15fr_.85fr] md:items-end">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold tracking-wider text-amber-300">
            <Sparkles size={14} className="text-amber-400" />
            <span>RAPID-ONSET FLOOD EARLY WARNING</span>
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-white md:text-5xl lg:text-6xl">
            Predictive intelligence.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400">
              Before the surge crests.
            </span>
          </h1>
          <p className="mt-5 max-w-[660px] text-base leading-relaxed text-slate-300 font-normal">
            PRAVAH equips NDRF commanders, district magistrates, and ward officers with a unified
            operational picture for flash-flood and cloudburst hazard management — translating raw
            upstream rainfall and water-level telemetry into actionable village evacuation corridors.
          </p>

          {/* Operational Metrics Row */}
          <div className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {[
              { label: 'ACTIVE DEPLOYMENT', value: currentRegion.name, sub: currentRegion.state },
              { label: 'MONITORED REGION', value: currentRegion.district, sub: `${currentRegion.state}` },
              { label: 'REGIONAL RISK', value: 'RUNTIME', sub: 'Backend-computed' },
              { label: 'DECISION ENGINE', value: 'ACTIVE', sub: 'Hydro rules / ML' },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-2xl p-4 shadow-xl glass-card-hover">
                <div className="mono text-[11px] font-bold tracking-wider text-slate-400">{stat.label}</div>
                <div className="mono mt-2 text-lg font-extrabold text-white truncate">{stat.value}</div>
                <div className="text-xs text-slate-400 font-medium truncate mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Deployment Card */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-amber-950/20 p-7 shadow-2xl backdrop-blur-xl md:mb-1">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <span className="mono text-xs font-bold tracking-widest text-amber-400">
              ACTIVE DEPLOYMENT BUNDLE
            </span>
            <span className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-soft" /> BACKEND GIS
            </span>
          </div>

          <div className="mt-5">
            <h2 className="text-2xl font-extrabold text-white">{currentRegion.name}</h2>
            <div className="mt-1 text-sm text-slate-300 font-semibold">
              {currentRegion.district} District · {currentRegion.state}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300 font-normal">
              Region metadata, hydrology layers, telemetry, and evacuation assets are loaded dynamically
              from the backend GIS bundle.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              onClick={onEnter}
              data-testid="button-enter-command-deck"
              className="inline-flex min-h-12 items-center gap-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 text-sm font-bold tracking-wider text-slate-950 shadow-lg shadow-orange-500/25 transition-all hover:from-amber-400 hover:to-orange-400 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Crosshair size={18} />
              <span>ENTER COMMAND DECK</span>
              <ArrowUpRight size={17} />
            </button>
          </div>
        </div>
      </section>

      {/* Interactive Map Visual */}
      <NationalMap onEnterPilot={onEnter} region={region} />

      {/* Regional Context Grid */}
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          {
            name: 'HIMALAYAN WATERSHEDS',
            desc: 'Extreme slope gradients, glaciated moraines, and high cloudburst vulnerability across steep Himalayan valleys.',
            label: 'CONFIGURED RUNTIME BASINS',
            color: '#f97316',
            active: true,
          },
          {
            name: 'WESTERN GHATS',
            desc: 'Orographic monsoonal deluge and rapid tributary swelling in Konkan and Malabar high-slope valleys.',
            label: 'CALIBRATION ARCHIVE',
            color: '#10b981',
            active: false,
          },
          {
            name: 'BRAHMAPUTRA BASIN',
            desc: 'Massive channel braiding, high siltation, and extensive embankment breach risks during peak discharge.',
            label: 'CALIBRATION ARCHIVE',
            color: '#f59e0b',
            active: false,
          },
        ].map((item) => (
          <div
            key={item.name}
            className="group relative glass-card rounded-2xl p-6 transition-all glass-card-hover"
            data-testid={`context-region-${item.name.toLowerCase().replaceAll(' ', '-')}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold tracking-wider text-white">
                {item.name}
              </span>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}` }}
              />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300 font-normal">{item.desc}</p>
            <div className="mono mt-6 flex items-center justify-between text-xs font-bold tracking-wider">
              <span style={{ color: item.color }}>{item.label}</span>
              {item.active && (
                <button
                  onClick={onEnter}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold"
                >
                  DECK <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function TelemetryStrip({
  telemetry,
}: {
  telemetry: TelemetryViewModel | null;
}) {
  if (!telemetry) {
    return (
      <section className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((idx) => (
          <div key={idx} className="glass-card rounded-2xl p-5 text-slate-400">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider">TELEMETRY</span>
              <span className="mono rounded-full px-2.5 py-0.5 text-xs font-bold bg-slate-800 text-slate-400">
                UNAVAILABLE
              </span>
            </div>
            <div className="mono mt-3 text-3xl font-extrabold text-slate-500">—</div>
            <div className="mt-3 text-xs text-slate-500 font-medium">Awaiting telemetry reading from backend…</div>
          </div>
        ))}
      </section>
    );
  }

  const rainfallDanger = telemetry.rainfallMmHr !== null && telemetry.rainfallMmHr > 50;
  const riverDanger = telemetry.waterLevelCm !== null && telemetry.waterLevelCm > 114;
  const rateDanger = telemetry.rateOfRiseCmMin !== null && telemetry.rateOfRiseCmMin >= 2.0;

  return (
    <section className="space-y-3">
      {telemetry.isSynthetic && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-300 backdrop-blur-md">
          <span className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-400 animate-pulse" />
            <span>SIMULATION / SYNTHETIC HYDROLOGY MODE</span>
          </span>
          <span className="mono text-xs text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded-full">{telemetry.dataStatus}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {/* 1. Rainfall Intensity */}
        <div
          className="glass-card rounded-2xl p-5 transition-all glass-card-hover"
          data-testid="telemetry-rainfall-intensity"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`grid h-8 w-8 place-items-center rounded-lg ${rainfallDanger ? 'bg-rose-500/20 text-rose-400' : 'bg-teal-500/15 text-teal-400'}`}>
                <CloudRain size={17} className={rainfallDanger ? 'animate-bounce' : ''} />
              </div>
              <span className="text-xs font-bold tracking-wider text-slate-200">
                RAINFALL INTENSITY
              </span>
            </div>
            <span
              className="mono rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{
                color: rainfallDanger ? '#f43f5e' : '#10b981',
                backgroundColor: rainfallDanger ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              }}
            >
              {telemetry.rainfallMmHr === null
                ? 'UNAVAILABLE'
                : rainfallDanger
                ? 'SURGE CELL'
                : 'NOMINAL'}
            </span>
          </div>

          <div className="mono mt-3.5 flex items-baseline gap-2 text-4xl font-extrabold text-white">
            {telemetry.rainfallMmHr !== null ? telemetry.rainfallMmHr : '—'}
            <span className="text-sm font-semibold text-slate-400">mm/hr</span>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span>Source: {telemetry.rainfallSource}</span>
              <span className="mono font-semibold text-slate-300">Threshold: 50 mm/hr</span>
            </div>
            <div className="mt-2 h-2 w-full bg-slate-800/80 overflow-hidden rounded-full">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  rainfallDanger ? 'bg-gradient-to-r from-orange-500 to-rose-500' : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                }`}
                style={{
                  width: `${Math.min(100, ((telemetry.rainfallMmHr ?? 0) / 80) * 100)}%`,
                }}
              />
            </div>
          </div>

          <div
            className="mt-3.5 flex items-center gap-2 text-xs font-medium"
            style={{ color: rainfallDanger ? '#f43f5e' : '#10b981' }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: rainfallDanger ? '#f43f5e' : '#10b981' }}
            />
            <span>
              {telemetry.rainfallMmHr === null
                ? 'No reading reported'
                : rainfallDanger
                ? 'Cloudburst threshold breached'
                : 'Precipitation within safe bounds'}
            </span>
          </div>
        </div>

        {/* 2. River Level Gauge */}
        <div
          className="glass-card rounded-2xl p-5 transition-all glass-card-hover"
          data-testid="telemetry-river-level"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`grid h-8 w-8 place-items-center rounded-lg ${riverDanger ? 'bg-rose-500/20 text-rose-400' : 'bg-teal-500/15 text-teal-400'}`}>
                <Gauge size={17} />
              </div>
              <span className="text-xs font-bold tracking-wider text-slate-200">
                RIVER LEVEL GAUGE
              </span>
            </div>
            <span
              className="mono rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{
                color: riverDanger ? '#f43f5e' : '#10b981',
                backgroundColor: riverDanger ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              }}
            >
              {telemetry.waterLevelCm === null
                ? 'UNAVAILABLE'
                : riverDanger
                ? 'ABOVE DANGER'
                : 'CLEAR CHANNEL'}
            </span>
          </div>

          <div className="mono mt-3.5 flex items-baseline gap-2 text-4xl font-extrabold text-white">
            {telemetry.waterLevelCm !== null ? telemetry.waterLevelCm : '—'}
            <span className="text-sm font-semibold text-slate-400">cm</span>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span className="truncate">{telemetry.sensorId}</span>
              <span className="mono font-semibold text-slate-300">Gauge level</span>
            </div>
            <div className="mt-2 h-2 w-full bg-slate-800/80 overflow-hidden rounded-full">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  riverDanger ? 'bg-gradient-to-r from-orange-500 to-rose-500' : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                }`}
                style={{
                  width: `${Math.min(100, ((telemetry.waterLevelCm ?? 0) / 160) * 100)}%`,
                }}
              />
            </div>
          </div>

          <div
            className="mt-3.5 flex items-center gap-2 text-xs font-medium"
            style={{ color: riverDanger ? '#f43f5e' : '#10b981' }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: riverDanger ? '#f43f5e' : '#10b981' }}
            />
            <span>
              {telemetry.waterLevelCm === null
                ? 'Gauge level unavailable'
                : riverDanger
                ? 'Flood stage threshold elevated'
                : 'Operating within channel capacity'}
            </span>
          </div>
        </div>

        {/* 3. Rate of Rise */}
        <div
          className="glass-card rounded-2xl p-5 transition-all glass-card-hover"
          data-testid="telemetry-rate-of-rise"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`grid h-8 w-8 place-items-center rounded-lg ${rateDanger ? 'bg-rose-500/20 text-rose-400' : 'bg-teal-500/15 text-teal-400'}`}>
                <Activity size={17} />
              </div>
              <span className="text-xs font-bold tracking-wider text-slate-200">
                RATE OF RISE
              </span>
            </div>
            <span
              className="mono rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{
                color: rateDanger ? '#f43f5e' : (telemetry.rateOfRiseCmMin ?? 0) > 1 ? '#f59e0b' : '#10b981',
                backgroundColor: rateDanger
                  ? 'rgba(244, 63, 94, 0.15)'
                  : (telemetry.rateOfRiseCmMin ?? 0) > 1
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(16, 185, 129, 0.15)',
              }}
            >
              {telemetry.rateOfRiseCmMin === null
                ? 'UNAVAILABLE'
                : rateDanger
                ? 'SURGE EXPONENTIAL'
                : (telemetry.rateOfRiseCmMin ?? 0) > 1
                ? 'MODERATE'
                : 'STABLE'}
            </span>
          </div>

          <div className="mono mt-3.5 flex items-baseline gap-2 text-4xl font-extrabold text-white">
            {telemetry.rateOfRiseCmMin !== null ? telemetry.rateOfRiseCmMin.toFixed(2) : '—'}
            <span className="text-sm font-semibold text-slate-400">cm/min</span>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span>Status: {telemetry.status}</span>
              <span className="mono font-semibold text-slate-300">Hydro rules</span>
            </div>
            <div className="mt-2 h-2 w-full bg-slate-800/80 overflow-hidden rounded-full">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  rateDanger ? 'bg-gradient-to-r from-orange-500 to-rose-500' : (telemetry.rateOfRiseCmMin ?? 0) > 1 ? 'bg-amber-400' : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                }`}
                style={{
                  width: `${Math.min(100, ((telemetry.rateOfRiseCmMin ?? 0) / 5) * 100)}%`,
                }}
              />
            </div>
          </div>

          <div
            className="mt-3.5 flex items-center gap-2 text-xs font-medium"
            style={{
              color: rateDanger ? '#f43f5e' : (telemetry.rateOfRiseCmMin ?? 0) > 1 ? '#f59e0b' : '#10b981',
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: rateDanger
                  ? '#f43f5e'
                  : (telemetry.rateOfRiseCmMin ?? 0) > 1
                  ? '#f59e0b'
                  : '#10b981',
              }}
            />
            <span>
              {telemetry.rateOfRiseCmMin === null
                ? 'Rate of rise unknown'
                : rateDanger
                ? 'Immediate action required — flash surge'
                : (telemetry.rateOfRiseCmMin ?? 0) > 1
                ? 'Gradual accumulation detected'
                : 'Normal hydro-balance'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function VillageLedger({
  villages,
  selectedId,
  onSelect,
}: {
  villages: VillageViewModel[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'elevated'>('all');

  const filteredVillages = useMemo(() => {
    if (filter === 'elevated') {
      return villages.filter((v) => v.status === 'CRITICAL' || v.status === 'WATCH');
    }
    return villages;
  }, [villages, filter]);

  return (
    <section className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5 bg-slate-900/60">
        <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-white">
          <MapPinned size={16} className="text-amber-400" />
          <span>SETTLEMENT RISK LEDGER</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-950/70 p-1 border border-white/5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
              filter === 'all'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ALL ({villages.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('elevated')}
            className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
              filter === 'elevated'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ALERTS
          </button>
        </div>
      </div>

      <div className="divide-y divide-white/[0.05] max-h-[380px] overflow-y-auto tactical-scroll">
        {filteredVillages.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            {villages.length === 0 ? 'Loading regional settlements…' : 'No elevated risk settlements.'}
          </div>
        ) : (
          filteredVillages.map((village, idx) => {
            const isSelected = selectedId === village.id;
            const isCritical = village.status === 'CRITICAL';
            return (
              <button
                key={village.id}
                onClick={() => onSelect(village.id)}
                data-testid={`button-village-${village.id}`}
                className={`relative grid w-full grid-cols-[1fr_auto] items-center gap-4 px-4 py-3.5 text-left transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-500/15 via-slate-800/60 to-transparent border-l-4 border-l-amber-400'
                    : 'hover:bg-white/[0.03] border-l-4 border-l-transparent'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                    <span className="mono text-[11px] font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                      SEC-0{idx + 1}
                    </span>
                    <span>{village.name}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Users size={13} className="text-slate-400" />
                      <span className="mono font-bold text-slate-200">
                        {village.population.toLocaleString('en-IN')}
                      </span>{' '}
                      residents
                    </span>
                    <span>·</span>
                    <span className="truncate max-w-[160px] text-slate-400">{village.primaryDriver}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={village.status} compact />
                  <span
                    className={`mono text-[11px] font-bold ${
                      isCritical ? 'text-rose-400' : 'text-slate-400'
                    }`}
                  >
                    {village.leadTimeMinutes !== null ? `${village.leadTimeMinutes}m lead` : 'NO LEAD CALC'}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function Feed({
  feedEvents,
}: {
  feedEvents: ReturnType<typeof useFlashShieldData>['feedEvents'];
}) {
  const [filter, setFilter] = useState<'all' | 'alert'>('all');

  const entries = filter === 'alert' ? feedEvents.filter((e) => e.state !== 'normal') : feedEvents;

  return (
    <section className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5 bg-slate-900/60">
        <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-white">
          <Radio size={16} className="text-teal-400" />
          <span>TELEMETRY PACKET FEED</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-950/70 p-1 border border-white/5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
              filter === 'all' ? 'text-teal-300 bg-teal-500/20' : 'text-slate-400'
            }`}
          >
            ALL
          </button>
          <button
            type="button"
            onClick={() => setFilter('alert')}
            className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
              filter === 'alert' ? 'text-amber-300 bg-amber-500/20' : 'text-slate-400'
            }`}
          >
            ALERTS
          </button>
        </div>
      </div>

      <div className="divide-y divide-white/[0.05] max-h-[260px] overflow-y-auto tactical-scroll">
        {entries.length === 0 ? (
          <div className="p-4 text-xs text-slate-400 text-center">No telemetry packets received yet.</div>
        ) : (
          entries.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[68px_95px_1fr] items-center gap-2.5 px-4 py-3 text-xs hover:bg-white/[0.02] transition-colors"
            >
              <span className="mono text-slate-400 font-medium">{item.time}</span>
              <span
                className={`mono font-bold truncate rounded-md px-1.5 py-0.5 text-[11px] text-center ${
                  item.state === 'watch'
                    ? 'text-amber-400 bg-amber-500/10'
                    : item.state === 'critical'
                    ? 'text-rose-400 bg-rose-500/10'
                    : 'text-teal-400 bg-teal-500/10'
                }`}
              >
                {item.source}
              </span>
              <span className="truncate text-slate-300 font-medium">{item.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Factors({
  detailedRisk,
  village,
}: {
  detailedRisk: DetailedRiskViewModel | null;
  village?: VillageViewModel | null;
}) {
  const isMlPredicted = detailedRisk?.mlStatus === 'ML_PREDICTED';
  const factors = detailedRisk?.factors ?? [];
  const probabilities = detailedRisk?.probabilities ?? {};
  const primaryDriver = detailedRisk?.primaryDriver || village?.primaryDriver || 'Topographic exposure';

  return (
    <section className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5 bg-slate-900/60">
        <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-white">
          <GitBranch size={16} className="text-amber-400" />
          <span>RISK ATTRIBUTION & NOWCAST</span>
        </div>
        <span
          className={`mono text-xs font-bold rounded-full px-2.5 py-0.5 ${
            isMlPredicted ? 'text-emerald-400 bg-emerald-500/15' : 'text-amber-400 bg-amber-500/15'
          }`}
        >
          {isMlPredicted ? 'ML RISK PREDICTION' : 'HYDRO NOWCAST'}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Probabilities or Tier summary */}
        {detailedRisk && (
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span>PREDICTED RISK TIER</span>
              <span className="mono text-amber-400 font-extrabold">{detailedRisk.predictedTier}</span>
            </div>
            {Object.keys(probabilities).length > 0 && (
              <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
                {Object.entries(probabilities).map(([tier, prob]) => (
                  <div key={tier} className="bg-slate-950/70 p-2 rounded-lg border border-white/5">
                    <div className="mono text-[10px] text-slate-400 font-bold">{tier}</div>
                    <div className="mono text-xs font-bold text-white mt-0.5">
                      {(prob * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Primary Driver */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-slate-200">
          <span className="font-bold text-amber-300">Primary Hazard Driver: </span>
          <span className="font-medium text-white">{primaryDriver}</span>
        </div>

        {/* Factor Bars if present */}
        {factors.length > 0 ? (
          <div className="space-y-3">
            <div className="text-xs font-bold tracking-wider text-slate-400">
              FEATURE CONTRIBUTIONS
            </div>
            {factors.map((factor, index) => {
              const isTop = index === 0;
              return (
                <div key={factor.feature}>
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-200">
                    <span className="flex items-center gap-1.5">
                      {isTop && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.2 mono text-[10px] font-bold text-amber-300 border border-amber-500/40">
                          TOP
                        </span>
                      )}
                      <span className="capitalize">{factor.feature}</span>
                    </span>
                    <span className="mono font-bold text-amber-400">{factor.impactPct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 overflow-hidden rounded-full">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500"
                      style={{ width: `${factor.impactPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-2 text-center text-xs text-slate-400 font-medium">
            Hydrological nowcast active · Rule-based classification
          </div>
        )}
      </div>
    </section>
  );
}

function Recommendations({
  village,
  regionName,
}: {
  village?: VillageViewModel | null;
  regionName: string;
}) {
  const [actions, setActions] = useState<Record<string, boolean>>({});

  const toggleAction = (item: string) => {
    setActions((prev) => {
      const next = !prev[item];
      if (next) {
        toast.success(`Action confirmed: ${item}`);
        playAudioChime('nominal');
      }
      return { ...prev, [item]: next };
    });
  };

  const settlementName = village?.name ?? 'Selected settlement';

  const checklist = [
    `Sound the settlement warning horn for ${settlementName}`,
    `Mobilize field emergency units in ${regionName}`,
    `Open the mapped GIS evacuation corridor for ${settlementName}`,
    `Broadcast SMS warning to registered residents of ${settlementName}`,
  ];

  return (
    <section className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5 bg-slate-900/60">
        <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-white truncate">
          <Navigation size={16} className="text-amber-400 shrink-0" />
          <span className="truncate">ACTIONABLE DISPATCH / {settlementName.toUpperCase()}</span>
        </div>
        <span className="mono text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
          NDRF PROTOCOL
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Core recommendation text */}
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3.5 text-sm leading-relaxed text-slate-200">
          <div className="flex items-start gap-2.5">
            <Info size={18} className="mt-0.5 shrink-0 text-amber-400" />
            <div>
              <div className="font-bold text-white text-xs tracking-wide">TACTICAL OPERATIONAL DIRECTIVE</div>
              <div className="mt-1 text-slate-300 font-normal text-xs leading-relaxed">
                {village?.primaryDriver
                  ? `Hazard trigger: ${village.primaryDriver}. Execute rapid valley evacuation protocol.`
                  : 'Settlement telemetry evaluated from runtime GIS bundle.'}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive action checklist */}
        <div className="space-y-2.5">
          <div className="text-xs font-bold tracking-wider text-slate-400">
            OPERATOR ACTION CHECKLIST
          </div>
          <div className="space-y-2">
            {checklist.map((item) => {
              const checked = !!actions[item];
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleAction(item)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left text-xs font-medium transition-all ${
                    checked
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 line-through'
                      : 'border-white/10 bg-slate-900/50 text-slate-200 hover:border-amber-500/50 hover:bg-slate-850'
                  }`}
                >
                  <div
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-lg border transition-colors ${
                      checked ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-slate-500 bg-slate-800'
                    }`}
                  >
                    {checked && <Check size={13} strokeWidth={3} />}
                  </div>
                  <span className="truncate">{item}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function IncidentModal({
  onClose,
  acknowledged,
  onAcknowledge,
  region,
  village,
  telemetry,
  evacuationPlan,
}: {
  onClose: () => void;
  acknowledged: boolean;
  onAcknowledge: () => void;
  region?: Region;
  village?: VillageViewModel | null;
  telemetry: TelemetryViewModel | null;
  evacuationPlan: ReturnType<typeof useFlashShieldData>['evacuationPlan'];
}) {
  const settlementName = village?.name ?? 'Selected Settlement';
  const regionName = region?.name ?? 'Monitored Basin';
  const shelterName = evacuationPlan?.shelterId ?? 'Designated Regional Shelter';
  const leadTimeDisplay =
    village?.leadTimeMinutes !== null && village?.leadTimeMinutes !== undefined && village.leadTimeMinutes > 0
      ? `${village.leadTimeMinutes} min`
      : 'Immediate';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-title"
      data-testid="modal-incident-order"
    >
      <div className="w-full max-w-xl rounded-2xl border border-rose-500/50 bg-[#0c121e] shadow-[0_0_50px_rgba(244,63,94,0.35)] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-rose-500/30 bg-rose-500/10 p-6">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-rose-500/60 bg-rose-500/20 text-rose-400">
              <Siren size={24} className="pulse-fast" />
            </div>
            <div>
              <div className="mono text-xs font-bold tracking-widest text-rose-400">
                TACTICAL INCIDENT DIRECTIVE / SURGE WARNING
              </div>
              <h2 id="incident-title" className="mt-1 text-2xl font-extrabold text-white">
                {settlementName} — Rapid Flood Warning
              </h2>
              <div className="mt-1 text-sm text-rose-200 font-medium">
                Rate-of-rise threshold crossed at {telemetry?.sensorId ?? 'regional sensor'}
              </div>
            </div>
          </div>
          <button
            aria-label="Dismiss incident modal"
            data-testid="button-dismiss-incident"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-6 p-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
              <div className="mono text-xs font-bold tracking-wider text-slate-400">
                ESTIMATED LEAD TIME
              </div>
              <div className="mono mt-1.5 text-3xl font-extrabold text-amber-400">
                {leadTimeDisplay}
              </div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">Calculated crest interval</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
              <div className="mono text-xs font-bold tracking-wider text-slate-400">
                PRIMARY SHELTER
              </div>
              <div className="mt-1.5 text-base font-bold text-white truncate">
                {shelterName}
              </div>
              <div className="text-xs text-slate-400 font-medium truncate mt-0.5">GIS shelter for {regionName}</div>
            </div>
          </div>

          {/* Ordered Actions List */}
          <div>
            <div className="mb-2.5 text-xs font-bold tracking-wider text-slate-300">
              MANDATORY IMMEDIATE DISPATCH
            </div>
            <div className="space-y-2.5">
              {[
                `Trigger siren and alert for ${settlementName}`,
                `Mobilize NDRF quick-response teams for ${regionName}`,
                `Clear designated evacuation corridor to ${shelterName}`,
              ].map((action, i) => (
                <div
                  key={action}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-slate-900/40 p-3 text-sm text-slate-200 font-medium"
                >
                  <span className="mono rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-400 border border-rose-500/30">
                    0{i + 1}
                  </span>
                  <span className="truncate">{action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Evacuation Corridor Route */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-sm leading-relaxed text-amber-200 font-medium">
            <RouteIcon size={18} className="mt-0.5 shrink-0 text-amber-400" />
            <div>
              <strong className="text-white">Active Corridor: </strong>
              {evacuationPlan?.isAvailable
                ? `${evacuationPlan.segmentCount} road-graph corridor segment(s) mapped to shelter destination.`
                : 'Routing computed dynamically from road graph to nearest GIS shelter.'}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-slate-950 p-5">
          <button
            onClick={onClose}
            data-testid="button-dismiss-incident-secondary"
            className="min-h-11 rounded-xl border border-white/10 px-5 text-sm font-bold text-slate-300 hover:bg-slate-900 transition-all"
          >
            DISMISS
          </button>
          <button
            onClick={() => {
              onAcknowledge();
              toast.success('Incident directive transmitted to all field units.');
              playAudioChime('nominal');
            }}
            data-testid="button-acknowledge-incident"
            className={`min-h-11 rounded-xl px-6 text-sm font-bold tracking-wider transition-all ${
              acknowledged
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 hover:bg-rose-400'
            }`}
          >
            {acknowledged ? 'ORDER ACKNOWLEDGED ✓' : 'ACKNOWLEDGE & DISPATCH TEAMS'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function OperatorManualModal({ onClose }: { onClose: () => void }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0c121e] p-7 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <HelpCircle size={22} className="text-amber-400" />
            <h3 className="text-xl font-bold text-white">PRAVAH Operator Manual</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm text-slate-300 leading-relaxed max-h-[70vh] overflow-y-auto tactical-scroll pr-2 font-normal">
          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
            <h4 className="font-bold text-white text-base">1. Multi-Basin Configuration Architecture</h4>
            <p className="mt-1.5 text-slate-400">
              PRAVAH (Predictive River & Valley Alert Hub) operates across regional GIS deployment bundles
              configured in the backend. Select any registered river basin to load regional river channels,
              settlements, shelters, and telemetry.
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
            <h4 className="font-bold text-white text-base">2. Cloudburst Simulation Drill</h4>
            <p className="mt-1.5 text-slate-400">
              Click <span className="text-amber-400 font-bold">TRIGGER CLOUDBURST</span> on the
              command deck to inject a synthetic surge scenario into the selected region. The system will
              broadcast telemetry updates, update risk classifications, and compute evacuation routes.
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
            <h4 className="font-bold text-white text-base">3. Settlement Focus & Evacuation</h4>
            <p className="mt-1.5 text-slate-400">
              Selecting a settlement from the ledger or map focuses that sector, requests tailored
              evacuation corridors from the road graph, and loads explainable hazard contributions.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200 font-medium">
            <strong className="text-white">Backend Source of Truth: </strong>
            All GIS geometries, telemetry readings, and risk calculations are supplied directly by the
            FastAPI backend.
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-sm font-bold text-slate-950 hover:from-amber-400 hover:to-orange-400 transition-all shadow-md shadow-orange-500/20"
          >
            CLOSE MANUAL
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CommandDeck({
  onOverview,
  region,
  regions,
  onRegionChange,
  isAudioOn,
}: {
  onOverview: () => void;
  region?: Region;
  regions: Region[];
  onRegionChange: (regionId: string) => void;
  isAudioOn: boolean;
}) {
  const currentRegionId = region?.region_id ?? (regions[0]?.region_id || 'mandakini');
  const data = useFlashShieldData(currentRegionId);
  const [showActions, setShowActions] = useState(false);
  const selected = data.selected;
  const overall = data.telemetry?.status ?? 'NORMAL';
  const actionLabel = data.incidentAcknowledged ? 'ORDER ACKNOWLEDGED' : 'REVIEW INCIDENT DIRECTIVE';

  const handleSimulate = async () => {
    if (isAudioOn) playAudioChime('critical');
    toast.warning(`Initiating cloudburst simulation for ${region?.name ?? currentRegionId}…`);
    await data.simulateCloudburst();
  };

  const handleReset = async () => {
    if (isAudioOn) playAudioChime('nominal');
    toast.info(`System baseline restored for ${region?.name ?? currentRegionId}.`);
    await data.reset();
  };

  return (
    <main className="mx-auto max-w-[1640px] px-4 pb-16 pt-5 md:px-8">
      {/* Top Mission Control Toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-slate-900/70 p-4 shadow-xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400">
            <button
              onClick={onOverview}
              data-testid="button-breadcrumb-overview"
              className="hover:text-amber-400 transition-colors"
            >
              NATIONAL OVERVIEW
            </button>
            <span>/</span>
            <span className="text-white font-bold">{region?.name.toUpperCase() ?? 'DEPLOYMENT'}</span>
          </div>

          <div className="mt-1.5 flex items-center gap-3.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              {region?.name ?? 'Loading Region…'}
            </h1>
            <StatusBadge status={overall} />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* Region Dropdown */}
          <label className="sr-only" htmlFor="region-select">
            Deployment region
          </label>
          <select
            id="region-select"
            value={currentRegionId}
            onChange={(event) => onRegionChange(event.target.value)}
            data-testid="select-deployment-region"
            className="min-h-11 rounded-xl border border-white/10 bg-slate-950/80 px-4 text-xs font-bold tracking-wider text-slate-100 outline-none transition-all hover:border-amber-500/50 focus:border-amber-500"
          >
            {regions.map((item) => (
              <option key={item.region_id} value={item.region_id}>
                {item.name} ({item.state})
              </option>
            ))}
          </select>

          {/* Action List Toggle */}
          <button
            onClick={() => setShowActions(!showActions)}
            data-testid="button-action-list"
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 text-xs font-bold tracking-wider transition-all ${
              showActions
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                : 'border-white/10 bg-slate-950/80 text-slate-200 hover:border-amber-500/40'
            }`}
          >
            <Bell size={15} className={showActions ? 'text-amber-400' : 'text-slate-400'} />
            <span>ACTIONS</span>
            <ChevronDown size={15} className={`transition-transform ${showActions ? 'rotate-180' : ''}`} />
          </button>

          {/* Reset Baseline */}
          <button
            onClick={handleReset}
            disabled={data.isSimulating || data.isLoading}
            data-testid="button-reset-demo"
            className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-4 text-xs font-bold tracking-wider text-slate-200 transition-all hover:border-amber-500/40 disabled:opacity-50"
          >
            <RefreshCcw size={15} className={data.isSimulating ? 'animate-spin' : ''} />
            <span>RESET</span>
          </button>

          {/* Trigger Cloudburst Simulation */}
          <button
            onClick={handleSimulate}
            disabled={data.isLoading || data.isSimulating || data.incidentAcknowledged}
            data-testid="button-trigger-cloudburst"
            className={`flex min-h-11 items-center gap-2.5 rounded-xl px-5 text-xs font-extrabold tracking-wider transition-all disabled:cursor-wait disabled:opacity-50 ${
              overall === 'CRITICAL'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-orange-500/25 hover:from-amber-400 hover:to-orange-400 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <CloudRain size={18} />
            <span>{data.isSimulating ? 'RUNNING SURGE…' : 'TRIGGER CLOUDBURST'}</span>
          </button>
        </div>
      </div>

      {/* Simulation Banner */}
      {data.telemetry?.isSynthetic && (
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-amber-500/40 bg-amber-500/15 p-4 text-amber-200 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-400 animate-pulse shrink-0" />
            <div>
              <div className="font-extrabold tracking-wider text-white text-sm">
                SIMULATION MODE ACTIVE
              </div>
              <div className="text-xs text-amber-300 font-medium">
                Synthetic cloudburst scenario running for {region?.name ?? currentRegionId}. Telemetry reflects simulation injection, not live sensors.
              </div>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="rounded-xl bg-amber-500/30 px-3.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/50 border border-amber-400/40 transition-colors"
          >
            RESTORE BASELINE
          </button>
        </div>
      )}

      {/* Slide-down Action List Banner */}
      {showActions && (
        <div
          className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2"
          data-testid="panel-action-list"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-amber-400">
              <Siren size={16} />
              <span>FIELD ACTION PROTOCOL / {selected?.name ?? region?.name}</span>
            </div>
            <button
              onClick={() => setShowActions(false)}
              aria-label="Close action list"
              data-testid="button-close-action-list"
              className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-slate-200 font-medium sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-slate-900/60 p-3">
              <Siren size={16} className="text-amber-400" />
              <span>1. Sound settlement alarm</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-slate-900/60 p-3">
              <Users size={16} className="text-amber-400" />
              <span>2. Deploy NDRF field team</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-slate-900/60 p-3">
              <RouteIcon size={16} className="text-amber-400" />
              <span>3. Open the designated evacuation corridor</span>
            </div>
          </div>
        </div>
      )}

      {/* Backend Error Banner if any */}
      {data.error && (
        <div
          className="mb-5 rounded-2xl border border-rose-500/50 bg-rose-500/15 px-5 py-3.5 text-sm text-rose-200 font-medium flex items-center justify-between backdrop-blur-md"
          role="alert"
        >
          <span className="flex items-center gap-2.5">
            <AlertOctagon size={18} />
            <span>BACKEND ERROR · {data.error}</span>
          </span>
          <button onClick={data.reset} className="underline text-sm font-bold text-white hover:text-rose-200">
            Retry
          </button>
        </div>
      )}

      {/* Primary Workspace Layout */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left / Center: Tactical Map & Telemetry Strip */}
        <div className="space-y-5">
          <TacticalLeafletMap
            telemetry={data.telemetry}
            villages={data.villages}
            region={region}
            layers={data.layers}
            selectedVillage={data.selectedVillage}
            onSelectVillage={data.setSelectedVillage}
          />
          <TelemetryStrip telemetry={data.telemetry} />
        </div>

        {/* Right Sidebar: Ingestion Status & Village Ledger */}
        <aside className="space-y-5">
          {/* Telemetry Socket Station Card */}
          <div className="glass-panel rounded-2xl p-4.5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-white">
                <Radio size={16} className="text-teal-400" />
                <span>DATA INGESTION</span>
              </div>
              <span className="flex items-center gap-2 text-xs font-bold text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-full border border-teal-500/20">
                <span
                  className={`h-2 w-2 rounded-full ${
                    data.ws.isConnected ? 'bg-teal-400 pulse-soft' : 'bg-slate-500'
                  }`}
                />
                <span>
                  {data.isLoading
                    ? 'CONNECTING'
                    : data.ws.isConnected
                    ? data.telemetry?.isSynthetic
                      ? 'SIMULATION'
                      : 'LIVE SOCKET'
                    : 'OFFLINE'}
                </span>
              </span>
            </div>

            <div className="mono mt-3 text-xs text-slate-300 font-semibold flex items-center justify-between border-t border-white/10 pt-3">
              <span className="truncate">{data.telemetry?.sensorId ?? 'Awaiting sensor'}</span>
              <span className="text-teal-400">
                {data.ws.isConnected ? '1.0 Hz stream' : 'Reconnecting…'}
              </span>
            </div>
          </div>

          {/* Village Ledger */}
          <VillageLedger
            villages={data.villages}
            selectedId={data.selectedVillage}
            onSelect={data.setSelectedVillage}
          />
        </aside>
      </div>

      {/* Bottom 3-Column Tactical Insights */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
        <Feed feedEvents={data.feedEvents} />
        <Factors detailedRisk={data.detailedRisk} village={selected} />
        <Recommendations village={selected} regionName={region?.name ?? 'Selected Basin'} />
      </div>

      {/* Bottom Emergency Status Banner */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-slate-900/70 px-5 py-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
          <CircleDot size={16} className="text-emerald-400" />
          <span>
            Hydrological monitoring active for {region?.name ?? currentRegionId}. Broadcast channel operational.
          </span>
        </div>

        {overall === 'CRITICAL' && (
          <button
            onClick={() => data.setIncidentOpen(true)}
            data-testid="button-open-incident-order"
            className="flex min-h-10 items-center gap-2 rounded-xl border border-rose-500 bg-rose-500/20 px-5 text-xs font-bold tracking-wider text-rose-300 pulse-soft hover:bg-rose-500/30 transition-all shadow-lg shadow-rose-500/20"
          >
            <AlertTriangle size={16} />
            <span>{actionLabel}</span>
          </button>
        )}
      </div>

      {/* Incident Modal */}
      {data.incidentOpen && (
        <IncidentModal
          onClose={() => data.setIncidentOpen(false)}
          acknowledged={data.incidentAcknowledged}
          onAcknowledge={() => data.setIncidentAcknowledged(true)}
          region={region}
          village={selected}
          telemetry={data.telemetry}
          evacuationPlan={data.evacuationPlan}
        />
      )}
    </main>
  );
}

function Home() {
  const [view, setView] = useState<'overview' | 'deck'>('overview');
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionId, setRegionId] = useState<string>('');
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    getRegions()
      .then((items) => {
        setRegions(items);
        if (items.length > 0) {
          setRegionId((prev) => (prev && items.some((item) => item.region_id === prev) ? prev : items[0].region_id));
        }
      })
      .catch((err) => {
        console.error('Failed to load regions list', err);
        setRegions([]);
      });
  }, []);

  // Keyboard Shortcuts (1 = Overview, 2 = Deck, Esc = Close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') setView('overview');
      if (e.key === '2') setView('deck');
      if (e.key === 'Escape') setManualOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const region = useMemo(() => {
    return regions.find((item) => item.region_id === regionId) ?? regions[0];
  }, [regions, regionId]);

  return (
    <div className="min-h-[100dvh] bg-[#06090e] text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
      <TopBar
        view={view}
        onOverview={() => setView('overview')}
        onDeck={() => setView('deck')}
        isAudioOn={isAudioOn}
        onToggleAudio={() => setIsAudioOn(!isAudioOn)}
        onOpenManual={() => setManualOpen(true)}
        wsConnected={true}
      />

      {view === 'overview' ? (
        <Overview onEnter={() => setView('deck')} region={region} />
      ) : (
        <CommandDeck
          onOverview={() => setView('overview')}
          region={region}
          regions={regions}
          onRegionChange={setRegionId}
          isAudioOn={isAudioOn}
        />
      )}

      {manualOpen && <OperatorManualModal onClose={() => setManualOpen(false)} />}
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster richColors theme="dark" position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;