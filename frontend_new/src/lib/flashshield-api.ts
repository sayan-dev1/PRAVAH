import { useEffect, useMemo, useRef, useState } from 'react';

export type RiskStatus = 'NORMAL' | 'WATCH' | 'CRITICAL';
export type Telemetry = {
  rainfall: number;
  riverLevel: number;
  rateOfRise: number;
  status: RiskStatus;
  observedAt: string;
  station: string;
};
export type Village = {
  id: string;
  name: string;
  population: number;
  status: RiskStatus;
  distance: string;
  eta: string;
  rainfall: number;
  recommendation: string;
};
export type Factor = { label: string; value: number; detail: string };
export type EvacuationPlan = {
  shelter: string;
  route: string;
  leadTime: string;
  capacity: number;
  actions: string[];
};

const baselineTelemetry: Telemetry = {
  rainfall: 14,
  riverLevel: 110,
  rateOfRise: 0.1,
  status: 'NORMAL',
  observedAt: '14:32:08 IST',
  station: 'MNDK-04 / Tilwara bridge',
};

const baselineVillages: Village[] = [
  { id: 'tilwara', name: 'Tilwara', population: 1280, status: 'NORMAL', distance: '0.8 km', eta: '—', rainfall: 14, recommendation: 'Maintain watch. Verify siren battery and ward roster.' },
  { id: 'sumerpur', name: 'Sumerpur', population: 740, status: 'WATCH', distance: '3.4 km', eta: '18 min', rainfall: 19, recommendation: 'Stage volunteers at upper road junction; keep lower lane clear.' },
  { id: 'rudraprayag', name: 'Rudraprayag Town', population: 6120, status: 'WATCH', distance: '6.1 km', eta: '31 min', rainfall: 16, recommendation: 'Check bridge access and prepare public address message.' },
];

const baselineFactors: Factor[] = [
  { label: 'Antecedent soil saturation', value: 34, detail: 'Moderate / 48 hr wetness' },
  { label: 'Rainfall intensity', value: 27, detail: '14 mm/hr at MNDK-04' },
  { label: 'Channel confinement', value: 21, detail: 'Narrow reach at bridge' },
  { label: 'Upstream gauge response', value: 11, detail: 'Stable signal' },
  { label: 'Slope / exposure', value: 7, detail: 'Local terrain model' },
];

const surgeFactors: Factor[] = [
  { label: 'Rainfall intensity', value: 46, detail: '68 mm/hr cloudburst cell' },
  { label: 'Upstream gauge response', value: 24, detail: '+3.8 cm/min trend' },
  { label: 'Antecedent soil saturation', value: 16, detail: 'High / 48 hr wetness' },
  { label: 'Channel confinement', value: 9, detail: 'Narrow reach at bridge' },
  { label: 'Slope / exposure', value: 5, detail: 'Local terrain model' },
];

type BackendTelemetry = {
  timestamp: string;
  sensor_id: string;
  rainfall_mm_hr: number;
  water_level_cm: number;
  rate_of_rise_cm_min: number;
  soil_moisture_pct: number;
  status: string;
};

type BackendVillage = {
  id: string;
  name: string;
  risk_level: string;
  risk_score: number;
  lead_time_minutes: number;
  population_at_risk: number;
  primary_driver: string;
};

type BackendRisk = {
  factors: Array<{ feature: string; impact_pct: number }>;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`PRAVAH API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function toRiskStatus(value: string): RiskStatus {
  return value.toUpperCase() === 'CRITICAL' ? 'CRITICAL' : value.toUpperCase() === 'WATCH' ? 'WATCH' : 'NORMAL';
}

function mapTelemetry(reading: BackendTelemetry): Telemetry {
  return {
    rainfall: reading.rainfall_mm_hr,
    riverLevel: reading.water_level_cm,
    rateOfRise: reading.rate_of_rise_cm_min,
    status: toRiskStatus(reading.status),
    observedAt: new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    station: reading.sensor_id,
  };
}

function backendVillageId(id: string): string {
  return id.startsWith('VIL_') ? id : `VIL_${id.toUpperCase()}`;
}

function mapVillage(village: BackendVillage): Village {
  return {
    id: village.id.replace(/^VIL_/, '').toLowerCase(),
    name: village.name,
    population: village.population_at_risk,
    status: toRiskStatus(village.risk_level),
    distance: `${village.lead_time_minutes} min lead`,
    eta: village.lead_time_minutes > 0 ? `${village.lead_time_minutes} min` : '—',
    rainfall: 0,
    recommendation: village.primary_driver,
  };
}

export async function getTelemetry(): Promise<Telemetry> {
  return mapTelemetry(await requestJson<BackendTelemetry>('/api/telemetry'));
}
export async function getVillages(): Promise<Village[]> {
  return (await requestJson<BackendVillage[]>('/api/villages')).map(mapVillage);
}
export async function getVillageDetail(id: string): Promise<Village | undefined> {
  try {
    return mapVillage(await requestJson<BackendVillage>(`/api/villages/${backendVillageId(id)}`));
  } catch {
    return undefined;
  }
}
export async function getEvacuation(id = 'tilwara'): Promise<EvacuationPlan> {
  const route = await requestJson<{ features: unknown[] }>(`/api/evacuation/${backendVillageId(id)}`);
  return {
    shelter: 'Designated GIS shelter',
    route: `${route.features.length} mapped evacuation route segment${route.features.length === 1 ? '' : 's'}`,
    leadTime: 'See village risk estimate',
    capacity: 0,
    actions: ['Sound village alarm horn', 'Deploy field unit 03', 'Clear lower footbridge'],
  };
}
export async function getFactors(id = 'tilwara'): Promise<Factor[]> {
  const risk = await requestJson<BackendRisk>(`/api/risk/detailed/${backendVillageId(id)}`);
  return risk.factors.map((factor) => ({ label: factor.feature.replaceAll('_', ' '), value: factor.impact_pct, detail: 'Backend risk model contribution' }));
}
export async function postSimulateCloudburst(): Promise<{ accepted: boolean; telemetry: Telemetry }> {
  const response = await requestJson<{ telemetry: BackendTelemetry }>('/api/simulate/cloudburst', { method: 'POST', body: JSON.stringify({ intensity: 'high', target_basin: 'MANDakINI' }) });
  return { accepted: true, telemetry: mapTelemetry(response.telemetry) };
}
export async function postReset(): Promise<{ accepted: boolean }> {
  await requestJson<{ status: string }>('/api/simulate/reset', { method: 'POST' });
  return { accepted: true };
}

export function useWebSocket() {
  const [mode, setMode] = useState<'connecting' | 'live' | 'mock'>('connecting');
  const [latestTelemetry, setLatestTelemetry] = useState<Telemetry | undefined>();
  const tickRef = useRef(0);
  useEffect(() => {
    const configuredEndpoint = import.meta.env.VITE_FLASHSHIELD_WS_URL as string | undefined;
    const endpoint = configuredEndpoint ?? (apiBaseUrl ? apiBaseUrl.replace(/^http/, 'ws') + '/ws/telemetry' : undefined);
    if (!endpoint || typeof window === 'undefined' || !('WebSocket' in window)) {
      const timer = window.setTimeout(() => setMode('mock'), 420);
      return () => window.clearTimeout(timer);
    }
    const socket = new window.WebSocket(endpoint);
    const fallback = window.setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        socket.close();
        setMode('mock');
      }
    }, 900);
    socket.onopen = () => {
      window.clearTimeout(fallback);
      setMode('live');
    };
    socket.onmessage = (event) => {
      try {
        setLatestTelemetry(mapTelemetry(JSON.parse(event.data) as BackendTelemetry));
      } catch {
        setMode('mock');
      }
    };
    socket.onerror = () => setMode('mock');
    return () => {
      window.clearTimeout(fallback);
      socket.close();
    };
  }, []);
  useEffect(() => {
    const ticker = window.setInterval(() => { tickRef.current += 1; }, 15000);
    return () => window.clearInterval(ticker);
  }, []);
  return { mode, isMock: mode === 'mock', lastTick: tickRef.current, latestTelemetry };
}

export function useFlashShieldData() {
  const [telemetry, setTelemetry] = useState<Telemetry>(baselineTelemetry);
  const [villages, setVillages] = useState<Village[]>(baselineVillages);
  const [factors, setFactors] = useState<Factor[]>(baselineFactors);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedVillage, setSelectedVillage] = useState('tilwara');
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentAcknowledged, setIncidentAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ws = useWebSocket();

  useEffect(() => {
    let active = true;
    Promise.all([getTelemetry(), getVillages(), getFactors()]).then(([nextTelemetry, nextVillages, nextFactors]) => {
      if (!active) return;
      setTelemetry(nextTelemetry);
      setVillages(nextVillages);
      setFactors(nextFactors);
      setError(null);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Backend unavailable');
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (ws.latestTelemetry) setTelemetry(ws.latestTelemetry);
  }, [ws.latestTelemetry]);

  const simulateCloudburst = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    try {
      const result = await postSimulateCloudburst();
      setTelemetry(result.telemetry);
      const [nextVillages, nextFactors] = await Promise.all([getVillages(), getFactors(selectedVillage)]);
      setVillages(nextVillages);
      setFactors(nextFactors);
      setIncidentOpen(result.telemetry.status === 'CRITICAL');
      setError(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Simulation request failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const reset = async () => {
    try {
      await postReset();
      const [nextTelemetry, nextVillages, nextFactors] = await Promise.all([getTelemetry(), getVillages(), getFactors(selectedVillage)]);
      setTelemetry(nextTelemetry);
      setVillages(nextVillages);
      setFactors(nextFactors);
      setError(null);
      setIncidentOpen(false);
      setIncidentAcknowledged(false);
      setIsSimulating(false);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Reset request failed');
      setIsSimulating(false);
    }
  };

  const selected = useMemo(() => villages.find((village) => village.id === selectedVillage) ?? villages[0], [selectedVillage, villages]);
  return {
    telemetry, villages, factors, selected, selectedVillage, setSelectedVillage, isLoading, error,
    isSimulating, incidentOpen, setIncidentOpen, incidentAcknowledged, setIncidentAcknowledged,
    simulateCloudburst, reset, ws,
  };
}