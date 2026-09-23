import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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
  Cloud,
  CloudRain,
  Compass,
  Crosshair,
  Droplets,
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
  Thermometer,
  TriangleAlert,
  Users,
  Volume2,
  VolumeX,
  Wind,
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
  type WeatherData,
} from '@/lib/flashshield-api';
import { TacticalLeafletMap } from '@/components/tactical-leaflet-map';
import { RainfallRiverPlot } from '@/components/rainfall-river-plot';
import {
  NationalOverviewMap,
  MonitoredRegionsList,
  INITIAL_REGIONS,
  type NationalRegion,
} from '@/components/national-overview-map';
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

function Overview({
  onSelectRegion,
  regions,
  selectedRegionId,
}: {
  onSelectRegion: (regionId: string) => void;
  regions: Region[];
  selectedRegionId: string;
}) {
  const nationalRegions: NationalRegion[] = useMemo(() => {
    return INITIAL_REGIONS.map((initReg) => {
      const backendMatch = regions.find((r) => r.region_id === initReg.region_id);
      if (backendMatch && backendMatch.center && backendMatch.center.length >= 2) {
        return {
          region_id: backendMatch.region_id,
          name: backendMatch.name || initReg.name,
          state: backendMatch.state || initReg.state,
          latitude: backendMatch.center[0],
          longitude: backendMatch.center[1],
          enabled: true,
        };
      }
      return initReg;
    });
  }, [regions]);

  return (
    <main className="mx-auto max-w-[1640px] px-4 pb-12 pt-4 md:px-8 md:pt-5">
      {/* Level 1 & 2 & 3: PRAVAH Identity & Purpose Section */}
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          {/* 1. Large, Prominent Product Name */}
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-none">
              PRA<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">VAH</span>
            </h1>
            <span className="mono rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-500/30">
              v2.5
            </span>
          </div>

          {/* 2. Formal System Name / Tagline */}
          <h2 className="mt-2 mono text-xs md:text-sm font-bold tracking-wider text-amber-400 uppercase leading-snug">
            Predictive River & Valley Hazard Alert System
          </h2>

          {/* 3. Product Description */}
          <p className="mt-2 text-xs md:text-sm text-slate-300 font-normal leading-relaxed">
            A multi-basin early-warning and operational intelligence platform for flash floods,
            extreme rainfall, landslides, and rapid-onset hazards across India's vulnerable hilly regions.
          </p>
        </div>

        {/* System & Status Badges */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <div className="rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2 backdrop-blur-md shadow-lg">
            <div className="mono text-[10px] font-bold text-slate-400">MONITORED BASINS</div>
            <div className="mono text-sm md:text-base font-extrabold text-white">
              {nationalRegions.length} <span className="text-xs text-emerald-400 font-semibold">Active Nodes</span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2 backdrop-blur-md shadow-lg">
            <div className="mono text-[10px] font-bold text-slate-400">GEOGRAPHIC SCOPE</div>
            <div className="mono text-sm md:text-base font-extrabold text-white">
              INDIAN SUBCONTINENT <span className="text-xs text-amber-400 font-semibold">Tactical</span>
            </div>
          </div>
        </div>
      </section>

      {/* Subtle Separation */}
      <div className="border-t border-white/[0.08] my-3.5" />

      {/* National Overview Operational Introduction */}
      <section className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base md:text-lg font-bold tracking-tight text-white uppercase">
            NATIONAL OVERVIEW
          </h3>
          <p className="text-xs text-slate-400 font-medium">
            Multi-basin operational surveillance across India's major hilly and riverine hazard regions.
          </p>
        </div>
        <div className="mono text-[11px] text-slate-400 font-medium hidden sm:block">
          Select a monitored region to enter its tactical Command Deck
        </div>
      </section>

      {/* Main Map & Selector Section */}
      <div className="grid gap-5 lg:grid-cols-[1.58fr_1fr] items-start">
        {/* Dominant Tactical Leaflet Map */}
        <div className="space-y-1.5">
          <NationalOverviewMap
            regions={nationalRegions}
            selectedRegionId={selectedRegionId}
            onSelectRegion={onSelectRegion}
          />
          <div className="flex flex-wrap items-center justify-between px-2 text-[11px] text-slate-400 font-medium">
            <span>● Click any regional node marker above or list item to enter Command Deck</span>
            <span className="mono text-slate-500">CartoDB Dark Matter · Subcontinent Extent</span>
          </div>
        </div>

        {/* Accessible Monitored Region Selector List */}
        <div className="space-y-3.5">
          <MonitoredRegionsList
            regions={nationalRegions}
            selectedRegionId={selectedRegionId}
            onSelectRegion={onSelectRegion}
          />

          {/* Tactical Context Information Card */}
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-950 p-4 backdrop-blur-xl shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Zap size={14} />
              <span>CONFIGURATION-DRIVEN MULTI-BASIN DEPLOYMENT</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300 font-normal">
              River geometries, telemetry feeds, IoT gauges, settlement graphs, and ML hazard classifiers
              are loaded dynamically per basin on demand from the backend registry.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function CurrentWeatherSection({ weatherData }: { weatherData?: WeatherData | null }) {
  const current = weatherData?.current;
  const isAvailable = Boolean(weatherData && weatherData.status !== 'UNAVAILABLE' && current);

  const formatVal = (val: number | null | undefined, digits = 1) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return digits === 0 ? Math.round(val).toString() : val.toFixed(digits);
  };

  const updatedTime = useMemo(() => {
    const raw = current?.timestamp ?? weatherData?.timestamp;
    if (!raw) return 'Awaiting observation';
    try {
      const dt = new Date(raw);
      if (isNaN(dt.getTime())) return raw;
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recent';
    }
  }, [current?.timestamp, weatherData?.timestamp]);

  const precipVal = current?.precipitation ?? current?.rain ?? weatherData?.precipitation_rate_mm_hr;

  const weatherMetrics = [
    {
      id: 'temp',
      label: 'TEMPERATURE',
      val: formatVal(current?.temperature_2m, 1),
      unit: '°C',
      desc: '2m Ambient Air',
      icon: Thermometer,
      accent: 'text-amber-400',
      borderAccent: 'hover:border-amber-500/30',
    },
    {
      id: 'precip',
      label: 'PRECIPITATION',
      val: formatVal(precipVal, 1),
      unit: 'mm/hr',
      desc: 'Current Rate',
      icon: CloudRain,
      accent: 'text-cyan-400',
      borderAccent: 'hover:border-cyan-500/30',
    },
    {
      id: 'wind_speed',
      label: 'WIND SPEED',
      val: formatVal(current?.wind_speed_10m, 1),
      unit: 'km/h',
      desc: '10m Surface Velocity',
      icon: Wind,
      accent: 'text-sky-400',
      borderAccent: 'hover:border-sky-500/30',
    },
    {
      id: 'cloud_cover',
      label: 'CLOUD COVER',
      val: formatVal(current?.cloud_cover, 0),
      unit: '%',
      desc: 'Sky Coverage',
      icon: Cloud,
      accent: 'text-indigo-300',
      borderAccent: 'hover:border-indigo-500/30',
    },
    {
      id: 'wind_gusts',
      label: 'WIND GUST',
      val: formatVal(current?.wind_gusts_10m, 1),
      unit: 'km/h',
      desc: 'Peak Surface Gusts',
      icon: Compass,
      accent: 'text-teal-400',
      borderAccent: 'hover:border-teal-500/30',
    },
  ];

  return (
    <section
      className="glass-panel rounded-2xl p-4.5 shadow-2xl space-y-3.5"
      data-testid="current-weather-section"
      aria-label="Current Atmospheric Conditions"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <Cloud size={15} aria-hidden="true" />
          </div>
          <div>
            <h3 className="mono text-xs font-bold tracking-widest text-white">CURRENT WEATHER</h3>
            <div className="text-[11px] text-slate-400">
              Atmospheric conditions · Updated {updatedTime}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10">
            Source: weather_api · Open-Meteo
          </span>
          <span
            className={`mono text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isAvailable
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-700 text-slate-400 border border-white/10'
            }`}
          >
            {weatherData?.status ?? (isAvailable ? 'LIVE' : 'UNAVAILABLE')}
          </span>
        </div>
      </div>

      {/* 5 Operational Weather Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {weatherMetrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.id}
              className={`glass-card rounded-xl p-3 border border-white/10 transition-all ${m.borderAccent}`}
              data-testid={`weather-metric-${m.id}`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-slate-300">
                <span>{m.label}</span>
                <Icon size={14} className={m.accent} aria-hidden="true" />
              </div>
              <div className="mono mt-1.5 flex items-baseline gap-1 text-xl sm:text-2xl font-extrabold text-white">
                {m.val}
                <span className="text-[11px] font-medium text-slate-400">{m.unit}</span>
              </div>
              <div className="mt-1.5 text-[10px] font-medium text-slate-400 truncate border-t border-white/5 pt-1">
                {m.desc}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HydrologicalStatusSection({
  telemetry,
  weatherData,
  regionName,
}: {
  telemetry: TelemetryViewModel | null;
  weatherData?: WeatherData | null;
  regionName?: string;
}) {
  if (!telemetry) {
    return (
      <section className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-white">
            <Activity size={16} className="text-teal-400" />
            <span>HYDROLOGICAL STATUS</span>
          </div>
          <span className="mono rounded-full px-2.5 py-0.5 text-xs font-bold bg-slate-800 text-slate-400">
            AWAITING TELEMETRY
          </span>
        </div>
        <div className="grid gap-3.5 grid-cols-2 sm:grid-cols-4">
          {['Rainfall', 'Rain 24h', 'River', 'Rate of Rise'].map((label) => (
            <div key={label} className="glass-card rounded-xl p-4 text-slate-400">
              <div className="text-xs font-bold">{label}</div>
              <div className="mono mt-2 text-2xl font-extrabold text-slate-500">—</div>
              <div className="mono text-[10px] text-slate-500 mt-1">LOADING</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const isCritical = telemetry.status === 'CRITICAL';
  const isWatch = telemetry.status === 'WATCH';
  const rainfallDanger = isCritical || (telemetry.rainfallMmHr !== null && telemetry.rainfallMmHr >= 50);
  const riverDanger = isCritical || isWatch;
  const rateDanger = isCritical || (telemetry.rateOfRiseCmMin !== null && telemetry.rateOfRiseCmMin >= 2.0);

  // 1. Top KPI Card Values
  const rainfallNow = telemetry.rainfallMmHr !== null ? Math.round(telemetry.rainfallMmHr) : null;
  const rain24h = weatherData?.rain_24h_mm ?? weatherData?.forecast_precipitation_24h_mm ?? telemetry.rainfall24hMm;
  const riverLevelM = telemetry.waterLevelM !== null
    ? telemetry.waterLevelM
    : (telemetry.waterLevelCm !== null ? Number((telemetry.waterLevelCm / 100).toFixed(2)) : 1.10);
  const rateOfRise = telemetry.rateOfRiseCmMin !== null ? telemetry.rateOfRiseCmMin : 0.0;
  const rateOfRiseStr = `${rateOfRise >= 0 ? '+' : ''}${rateOfRise.toFixed(1)} cm/min`;
  const rateLabel = rateDanger ? '↑ RAPID' : (rateOfRise > 1.0 ? '↑ ELEVATED' : '→ STABLE');

  // 2. 5 Soil Moisture Depths (m³/m³)
  const smDepths = weatherData?.soil_moisture ?? telemetry.soilMoistureDepths ?? {};
  const baseVdr = telemetry.soilMoistureVdr;
  const readDepth = (raw: number | { value: number | null } | null | undefined) =>
    typeof raw === 'number' ? raw : raw?.value ?? null;
  const depth0_1 = readDepth(smDepths.depth_0_1cm) ?? baseVdr;
  const depth1_3 = readDepth(smDepths.depth_1_3cm) ?? (baseVdr !== null ? baseVdr * 1.05 : null);
  const depth3_9 = readDepth(smDepths.depth_3_9cm) ?? (baseVdr !== null ? baseVdr * 1.10 : null);
  const depth9_27 = readDepth(smDepths.depth_9_27cm) ?? (baseVdr !== null ? baseVdr * 1.18 : null);
  const depth27_81 = readDepth(smDepths.depth_27_81cm) ?? (baseVdr !== null ? baseVdr * 1.25 : null);

  const soilHorizons = [
    { depth: '0-1 cm', val: depth0_1, desc: 'Topsoil Horizon', fill: depth0_1 !== null ? Math.min(100, (depth0_1 / 0.55) * 100) : 0 },
    { depth: '1-3 cm', val: depth1_3, desc: 'Upper Infiltration Layer', fill: depth1_3 !== null ? Math.min(100, (depth1_3 / 0.55) * 100) : 0 },
    { depth: '3-9 cm', val: depth3_9, desc: 'Root Zone Horizon', fill: depth3_9 !== null ? Math.min(100, (depth3_9 / 0.55) * 100) : 0 },
    { depth: '9-27 cm', val: depth9_27, desc: 'Subsoil Strata', fill: depth9_27 !== null ? Math.min(100, (depth9_27 / 0.55) * 100) : 0 },
    { depth: '27-81 cm', val: depth27_81, desc: 'Deep Vadose Layer', fill: depth27_81 !== null ? Math.min(100, (depth27_81 / 0.55) * 100) : 0 },
  ];

  const hourlyRows = weatherData?.hourly?.slice(0, 24) ?? [];
  const value = (item: number | null | undefined, digits = 1) => item == null ? '-' : item.toFixed(digits);

  return (
    <section className="glass-panel rounded-2xl p-5 shadow-2xl space-y-4.5" data-testid="hydrological-status-section">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Activity size={15} />
          </div>
          <div>
            <h3 className="mono text-xs font-bold tracking-widest text-white">HYDROLOGICAL STATUS</h3>
            <div className="text-[11px] text-slate-400">
              Open-Meteo NWP Stream · {telemetry?.isSynthetic ? 'Synthetic Cloudburst Surge' : 'Live Sensor Telemetry'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
            WEATHER: OPEN-METEO
          </span>
          <span className={`mono text-[10px] font-bold px-2 py-0.5 rounded-full ${
            telemetry?.isSynthetic
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
          }`}>
            GAUGE: {telemetry?.isSynthetic ? 'SIMULATED SURGE' : 'LIVE TELEMETRY'}
          </span>
        </div>
      </div>

      {/* TOP ROW: 4 Primary KPI Status Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* 1. Rainfall */}
        <div
          className={`glass-card rounded-xl p-4 transition-all glass-card-hover border ${
            rainfallDanger ? 'border-rose-500/50 bg-rose-950/20' : 'border-white/10'
          }`}
          data-testid="hydro-card-rainfall"
        >
          <div className="flex items-center justify-between text-xs font-bold tracking-wider text-slate-300">
            <span>Rainfall</span>
            <CloudRain size={15} className={rainfallDanger ? 'text-rose-400 animate-bounce' : 'text-teal-400'} />
          </div>
          <div className="mono mt-2 flex items-baseline gap-1.5 text-2xl sm:text-3xl font-extrabold text-white">
            {rainfallNow ?? '-'}
            <span className="text-xs font-medium text-slate-400">mm/hr</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold border-t border-white/5 pt-1.5">
            <span className={`mono rounded px-1.5 py-0.2 ${rainfallDanger ? 'bg-rose-500/20 text-rose-300' : 'bg-teal-500/20 text-teal-300'}`}>
              NOW
            </span>
            <span className="mono text-slate-400 text-[10px]">Open-Meteo</span>
          </div>
        </div>

        {/* 2. Rain 24h */}
        <div
          className="glass-card rounded-xl p-4 transition-all glass-card-hover border border-white/10"
          data-testid="hydro-card-rain24h"
        >
          <div className="flex items-center justify-between text-xs font-bold tracking-wider text-slate-300">
            <span>Rain 24h</span>
            <Clock size={15} className="text-teal-400" />
          </div>
          <div className="mono mt-2 flex items-baseline gap-1.5 text-2xl sm:text-3xl font-extrabold text-white">
            {rain24h !== null && rain24h !== undefined ? Math.round(rain24h) : '-'}
            <span className="text-xs font-medium text-slate-400">mm</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold border-t border-white/5 pt-1.5">
            <span className="mono rounded px-1.5 py-0.2 bg-teal-500/20 text-teal-300">
              ACCUMULATED
            </span>
            <span className="mono text-slate-400 text-[10px]">Rolling NWP</span>
          </div>
        </div>

        {/* 3. River */}
        <div
          className={`glass-card rounded-xl p-4 transition-all glass-card-hover border ${
            riverDanger ? 'border-amber-500/50 bg-amber-950/20' : 'border-white/10'
          }`}
          data-testid="hydro-card-river"
        >
          <div className="flex items-center justify-between text-xs font-bold tracking-wider text-slate-300">
            <span>River</span>
            <Gauge size={15} className={riverDanger ? 'text-amber-400' : 'text-teal-400'} />
          </div>
          <div className="mono mt-2 flex items-baseline gap-1.5 text-2xl sm:text-3xl font-extrabold text-white">
            {riverLevelM.toFixed(2)}
            <span className="text-xs font-medium text-slate-400">m</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold border-t border-white/5 pt-1.5">
            <span className={`mono rounded px-1.5 py-0.2 ${riverDanger ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
              NOW
            </span>
            <span className="mono text-slate-400 text-[10px]">Gauge {telemetry.sensorId}</span>
          </div>
        </div>

        {/* 4. Rate of Rise */}
        <div
          className={`glass-card rounded-xl p-4 transition-all glass-card-hover border ${
            rateDanger ? 'border-rose-500/50 bg-rose-950/20' : 'border-white/10'
          }`}
          data-testid="hydro-card-rate-of-rise"
        >
          <div className="flex items-center justify-between text-xs font-bold tracking-wider text-slate-300">
            <span>Rate of Rise</span>
            <Activity size={15} className={rateDanger ? 'text-rose-400 animate-pulse' : 'text-amber-400'} />
          </div>
          <div className="mono mt-2 flex items-baseline gap-1.5 text-2xl sm:text-3xl font-extrabold text-white">
            {rateOfRiseStr}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold border-t border-white/5 pt-1.5">
            <span
              className={`mono rounded px-1.5 py-0.2 font-bold ${
                rateDanger
                  ? 'bg-rose-500/25 text-rose-300 animate-pulse'
                  : rateOfRise > 1.0
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {rateLabel}
            </span>
            <span className="mono text-slate-400 text-[10px]">dh/dt rules</span>
          </div>
        </div>
      </div>

      {/* DYNAMIC HOURLY STATISTICAL RAINFALL & RIVER HYDROGRAPH PLOT */}
      <RainfallRiverPlot
        weatherData={weatherData}
        telemetry={telemetry}
        regionName={regionName}
      />

      {/* SOIL / CATCHMENT CONDITION PANEL */}
      <div className="glass-card rounded-xl p-4.5 border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-white">
            <Droplets size={14} className="text-teal-400" />
            <span>SOIL / CATCHMENT CONDITION</span>
          </div>
          <span className="mono text-[10px] text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
            m³/m³ VWC
          </span>
        </div>

        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Soil moisture horizons
        </div>

        {/* 5 Soil Moisture Depth Horizons Stack */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {soilHorizons.map((layer) => (
            <div key={layer.depth} className="rounded-lg bg-slate-900/60 p-2.5 border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="mono font-bold text-slate-200">{layer.depth}</span>
                <span className="mono font-extrabold text-teal-300">{layer.val !== null ? layer.val.toFixed(2) : '-'}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    Number(layer.val) > 0.45 ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                  }`}
                  style={{ width: `${layer.fill}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 truncate">{layer.desc}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-2">
          <span>Provider: <strong className="text-slate-300 mono">Open-Meteo</strong></span>
          <span>Unit: <strong className="text-teal-300 mono">m³/m³ (Volumetric Water Content)</strong></span>
        </div>
      </div>

      <div className="glass-card rounded-xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-white">
            <Clock size={14} className="text-teal-400" />
            <span>REGIONAL HOURLY WEATHER</span>
          </div>
          <span className="mono text-[10px] text-slate-400">{hourlyRows.length} forecast hours · Open-Meteo</span>
        </div>
        {hourlyRows.length === 0 ? (
          <div className="py-5 text-center text-xs text-slate-500">Hourly weather unavailable for this region.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1320px] w-full text-left text-[11px]">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                <tr className="border-b border-white/10">
                  <th className="sticky left-0 bg-slate-950/95 px-2 py-2">Time</th>
                  <th className="px-2 py-2">Precip</th><th className="px-2 py-2">Rain</th><th className="px-2 py-2">Showers</th>
                  <th className="px-2 py-2">0-1 cm</th><th className="px-2 py-2">1-3 cm</th><th className="px-2 py-2">3-9 cm</th><th className="px-2 py-2">9-27 cm</th><th className="px-2 py-2">27-81 cm</th>
                  <th className="px-2 py-2">Temp</th><th className="px-2 py-2">RH</th><th className="px-2 py-2">Pressure</th><th className="px-2 py-2">Cloud</th><th className="px-2 py-2">Wind</th><th className="px-2 py-2">Gust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {hourlyRows.map((row) => (
                  <tr key={row.timestamp}>
                    <td className="sticky left-0 whitespace-nowrap bg-slate-950/95 px-2 py-2 font-semibold text-white">{new Date(row.timestamp).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-2 py-2">{value(row.precipitation)} mm</td><td className="px-2 py-2">{value(row.rain)} mm</td><td className="px-2 py-2">{value(row.showers)} mm</td>
                    <td className="px-2 py-2">{value(row.soil_moisture?.depth_0_1cm?.value, 2)}</td><td className="px-2 py-2">{value(row.soil_moisture?.depth_1_3cm?.value, 2)}</td><td className="px-2 py-2">{value(row.soil_moisture?.depth_3_9cm?.value, 2)}</td><td className="px-2 py-2">{value(row.soil_moisture?.depth_9_27cm?.value, 2)}</td><td className="px-2 py-2">{value(row.soil_moisture?.depth_27_81cm?.value, 2)}</td>
                    <td className="px-2 py-2">{value(row.temperature_2m)} C</td><td className="px-2 py-2">{value(row.relative_humidity_2m)}%</td><td className="px-2 py-2">{value(row.surface_pressure)} hPa</td><td className="px-2 py-2">{value(row.cloud_cover)}%</td><td className="px-2 py-2">{value(row.wind_speed_10m)} km/h</td><td className="px-2 py-2">{value(row.wind_gusts_10m)} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

const COMMAND_DECK_SECTIONS = [
  { id: 'situation', label: 'Situation', icon: Activity, num: '01' },
  { id: 'map', label: 'Map', icon: MapPinned, num: '02' },
  { id: 'hydrology', label: 'Hydrology', icon: Droplets, num: '03' },
  { id: 'prediction', label: 'Prediction', icon: GitBranch, num: '04' },
  { id: 'impact', label: 'Impact', icon: Users, num: '05' },
  { id: 'response', label: 'Response', icon: Navigation, num: '06' },
  { id: 'data', label: 'Data', icon: Radio, num: '07' },
] as const;

type CommandDeckSectionId = (typeof COMMAND_DECK_SECTIONS)[number]['id'];

function CommandDeckNav({
  activeSection,
  onNavigate,
}: {
  activeSection: CommandDeckSectionId;
  onNavigate: (id: CommandDeckSectionId) => void;
}) {
  return (
    <nav
      aria-label="Command Deck Section Navigation"
      data-testid="command-deck-nav"
      className="sticky top-[68px] z-20 mb-5 -mx-4 border-b border-white/[0.08] bg-[#070b12]/90 px-4 py-2.5 backdrop-blur-xl md:-mx-8 md:px-8"
    >
      <div className="mx-auto flex max-w-[1640px] items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5 tactical-scroll no-scrollbar w-full">
          {COMMAND_DECK_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                data-testid={`nav-section-${sec.id}`}
                onClick={() => onNavigate(sec.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold tracking-wider transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-white/[0.05]'
                }`}
              >
                <span className="mono text-[10px] text-amber-400/80 font-semibold">{sec.num}</span>
                <Icon size={14} className={isActive ? 'text-amber-400' : 'text-slate-400'} />
                <span className="mono uppercase">{sec.label}</span>
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
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
  const [activeSection, setActiveSection] = useState<CommandDeckSectionId>('situation');
  const isManualScrolling = useRef(false);

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

  const scrollToSection = (id: CommandDeckSectionId) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      isManualScrolling.current = true;
      const navOffset = 135;
      const elementPosition = el.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = Math.max(0, elementPosition - navOffset);

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      window.history.replaceState(null, '', `#${id}`);

      setTimeout(() => {
        isManualScrolling.current = false;
      }, 700);
    }
  };

  // Scroll spy to dynamically track the active section
  useEffect(() => {
    const handleScroll = () => {
      if (isManualScrolling.current) return;
      const navOffset = 145;
      const scrollPosition = window.scrollY + navOffset;

      let current: CommandDeckSectionId = COMMAND_DECK_SECTIONS[0].id;
      for (const sec of COMMAND_DECK_SECTIONS) {
        const el = document.getElementById(sec.id);
        if (el) {
          const top = el.getBoundingClientRect().top + window.pageYOffset;
          if (top <= scrollPosition) {
            current = sec.id;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync hash on initial load if present
  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as CommandDeckSectionId;
    if (hash && COMMAND_DECK_SECTIONS.some((s) => s.id === hash)) {
      setTimeout(() => {
        scrollToSection(hash);
      }, 150);
    }
  }, []);

  return (
    <main className="mx-auto max-w-[1640px] px-4 pb-16 pt-2 md:px-8">
      {/* In-page Command Deck Section Navigation */}
      <CommandDeckNav activeSection={activeSection} onNavigate={scrollToSection} />

      <div className="space-y-6">
        {/* 1. SITUATION SECTION (#situation) */}
        <section id="situation" className="scroll-mt-32 space-y-4" data-testid="section-situation">
          {/* Top Mission Control Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-slate-900/70 p-4 shadow-xl backdrop-blur-xl">
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
            <div className="flex items-center justify-between rounded-2xl border border-amber-500/40 bg-amber-500/15 p-4 text-amber-200 shadow-xl backdrop-blur-md">
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
              className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2"
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
              className="rounded-2xl border border-rose-500/50 bg-rose-500/15 px-5 py-3.5 text-sm text-rose-200 font-medium flex items-center justify-between backdrop-blur-md"
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
        </section>

        {/* 2. MAP SECTION (#map) */}
        <section id="map" className="scroll-mt-32 space-y-4" data-testid="section-map">
          <TacticalLeafletMap
            telemetry={data.telemetry}
            villages={data.villages}
            region={region}
            layers={data.layers}
            selectedVillage={data.selectedVillage}
            onSelectVillage={data.setSelectedVillage}
          />
        </section>

        {/* 3. HYDROLOGY SECTION (#hydrology) */}
        <section id="hydrology" className="scroll-mt-32 space-y-5" data-testid="section-hydrology">
          <CurrentWeatherSection weatherData={data.weatherData} />
          <HydrologicalStatusSection
            telemetry={data.telemetry}
            weatherData={data.weatherData}
            regionName={region?.name}
          />
        </section>

        {/* 4. PREDICTION & 5. IMPACT SECTIONS */}
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          {/* 4. PREDICTION SECTION (#prediction) */}
          <section id="prediction" className="scroll-mt-32" data-testid="section-prediction">
            <Factors detailedRisk={data.detailedRisk} village={selected} />
          </section>

          {/* 5. IMPACT SECTION (#impact) */}
          <section id="impact" className="scroll-mt-32" data-testid="section-impact">
            <VillageLedger
              villages={data.villages}
              selectedId={data.selectedVillage}
              onSelect={data.setSelectedVillage}
            />
          </section>
        </div>

        {/* 6. RESPONSE & 7. DATA SECTIONS */}
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          {/* 6. RESPONSE SECTION (#response) */}
          <section id="response" className="scroll-mt-32 space-y-4" data-testid="section-response">
            <Recommendations village={selected} regionName={region?.name ?? 'Selected Basin'} />
            {/* Bottom Emergency Status Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-slate-900/70 px-5 py-4 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
                <CircleDot size={16} className="text-emerald-400 shrink-0" />
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
          </section>

          {/* 7. DATA SECTION (#data) */}
          <section id="data" className="scroll-mt-32 space-y-4" data-testid="section-data">
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

            {/* Telemetry Packet Feed */}
            <Feed feedEvents={data.feedEvents} />
          </section>
        </div>
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
  const [location, setLocation] = useLocation();
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionId, setRegionId] = useState<string>('');
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);

  // Sync routing state: /command-deck/:regionId or /
  const isDeckRoute = location.startsWith('/command-deck');
  const pathRegionId = isDeckRoute ? location.replace(/^\/command-deck\/?/, '').split('/')[0] : '';
  const view: 'overview' | 'deck' = isDeckRoute ? 'deck' : 'overview';

  useEffect(() => {
    getRegions()
      .then((items) => {
        // Merge backend items with INITIAL_REGIONS
        const combined: Region[] = INITIAL_REGIONS.map((init) => {
          const found = items.find((i) => i.region_id === init.region_id);
          if (found) return found;
          return {
            region_id: init.region_id,
            name: init.name,
            state: init.state,
            district: init.state,
            center: [init.latitude, init.longitude],
            status: 'READY',
          };
        });
        const extra = items.filter((i) => !INITIAL_REGIONS.some((init) => init.region_id === i.region_id));
        const finalRegions = [...combined, ...extra];
        setRegions(finalRegions);
        if (finalRegions.length > 0) {
          setRegionId((prev) => {
            if (pathRegionId && finalRegions.some((item) => item.region_id === pathRegionId)) {
              return pathRegionId;
            }
            return prev && finalRegions.some((item) => item.region_id === prev) ? prev : finalRegions[0].region_id;
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load regions list', err);
        const fallback: Region[] = INITIAL_REGIONS.map((init) => ({
          region_id: init.region_id,
          name: init.name,
          state: init.state,
          district: init.state,
          center: [init.latitude, init.longitude],
          status: 'READY',
        }));
        setRegions(fallback);
        if (fallback.length > 0) {
          setRegionId(pathRegionId || fallback[0].region_id);
        }
      });
  }, [pathRegionId]);

  const handleSelectRegion = (id: string) => {
    setRegionId(id);
    setLocation(`/command-deck/${id}`);
  };

  const handleGoOverview = () => {
    setLocation('/');
  };

  const handleGoDeck = () => {
    const target = regionId || (regions[0]?.region_id ?? 'mandakini');
    setLocation(`/command-deck/${target}`);
  };

  // Keyboard Shortcuts (1 = Overview, 2 = Deck, Esc = Close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') handleGoOverview();
      if (e.key === '2') handleGoDeck();
      if (e.key === 'Escape') setManualOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [regionId, regions]);

  const region = useMemo(() => {
    return regions.find((item) => item.region_id === regionId) ?? regions[0];
  }, [regions, regionId]);

  return (
    <div className="min-h-[100dvh] bg-[#06090e] text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
      <TopBar
        view={view}
        onOverview={handleGoOverview}
        onDeck={handleGoDeck}
        isAudioOn={isAudioOn}
        onToggleAudio={() => setIsAudioOn(!isAudioOn)}
        onOpenManual={() => setManualOpen(true)}
        wsConnected={true}
      />

      {view === 'overview' ? (
        <Overview
          onSelectRegion={handleSelectRegion}
          regions={regions}
          selectedRegionId={regionId}
        />
      ) : (
        <CommandDeck
          onOverview={handleGoOverview}
          region={region}
          regions={regions}
          onRegionChange={handleSelectRegion}
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
        <Route path="/overview" component={Home} />
        <Route path="/command-deck" component={Home} />
        <Route path="/command-deck/:regionId" component={Home} />
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