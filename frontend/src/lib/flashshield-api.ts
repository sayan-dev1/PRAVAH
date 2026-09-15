import { useEffect, useMemo, useRef, useState } from 'react';

export type RiskStatus = 'NORMAL' | 'WATCH' | 'CRITICAL' | 'FAULTY_STUCK' | 'DATA_UNAVAILABLE' | 'UNKNOWN';

export type TelemetryViewModel = {
  regionId: string;
  sensorId: string;
  rainfallMmHr: number | null;
  rainfallSource: string;
  waterLevelCm: number | null;
  waterLevelSource: string;
  rateOfRiseCmMin: number | null;
  rateOfRiseSource: string;
  soilMoisturePct: number | null;
  soilMoistureSource: string;
  status: RiskStatus;
  dataStatus: string;
  weatherStatus: string;
  weatherObservationAgeSeconds: number | null;
  timestamp: string | null;
  isSynthetic: boolean;
};

export type VillageViewModel = {
  id: string;
  name: string;
  population: number;
  status: RiskStatus;
  riskScore: number;
  leadTimeMinutes: number | null;
  primaryDriver: string;
  regionalHazardStatus: string;
  settlementRiskStatus: string;
};

export type RiskFactorViewModel = {
  feature: string;
  impactPct: number;
  detail?: string;
};

export type DetailedRiskViewModel = {
  villageId: string;
  predictedTier: string;
  probabilities: Record<string, number>;
  primaryDriver: string;
  factors: RiskFactorViewModel[];
  mlStatus: string;
};

export type EvacuationPlanViewModel = {
  villageId: string;
  shelterId: string | null;
  hazardWeighted: boolean;
  segmentCount: number;
  geojson: GeoJsonFeatureCollection | null;
  isAvailable: boolean;
};

export type Region = {
  region_id: string;
  name: string;
  state: string;
  district: string;
  center?: [number, number];
  bounds?: [[number, number], [number, number]];
  hydro_calibration?: Record<string, unknown>;
  status?: string;
  villages?: Array<{ id: string; name: string; population_at_risk: number; primary_driver: string }>;
};

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  name?: string;
  features: Array<{
    type: 'Feature';
    properties?: Record<string, unknown>;
    geometry: { type: string; coordinates: unknown };
  }>;
};

export type RegionLayers = {
  river: GeoJsonFeatureCollection | null;
  villages: GeoJsonFeatureCollection | null;
  shelters: GeoJsonFeatureCollection | null;
  evacuation: GeoJsonFeatureCollection | null;
  layerStatus: {
    river: boolean;
    villages: boolean;
    shelters: boolean;
    evacuation: boolean;
  };
};

type BackendTelemetry = {
  timestamp: string;
  region_id?: string;
  sensor_id: string;
  rainfall_mm_hr: number;
  rainfall_source?: string;
  water_level_cm: number;
  water_level_source?: string;
  rate_of_rise_cm_min: number;
  rate_of_rise_source?: string;
  soil_moisture_pct: number;
  soil_moisture_source?: string;
  status: string;
  data_status?: string;
  weather_status?: string;
  weather_observation_age_seconds?: number | null;
};

type BackendVillage = {
  id: string;
  name: string;
  risk_level: string;
  risk_score: number;
  lead_time_minutes: number;
  population_at_risk: number;
  primary_driver: string;
  regional_hazard_status?: string;
  settlement_risk_status?: string;
};

type BackendRisk = {
  village_id: string;
  predicted_tier: string;
  probabilities: Record<string, number>;
  primary_driver: string;
  factors: Array<{ feature: string; impact_pct: number }>;
  ml_status: string;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const regionQuery = (regionId: string) => `?region_id=${encodeURIComponent(regionId)}`;

async function requestJson<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    ...init,
    signal: signal ?? init?.signal,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`PRAVAH API request failed (${response.status}) for ${path}`);
  }
  return response.json() as Promise<T>;
}

export function toRiskStatus(value?: string | null): RiskStatus {
  if (!value) return 'UNKNOWN';
  const upper = value.toUpperCase();
  if (upper === 'CRITICAL') return 'CRITICAL';
  if (upper === 'WATCH') return 'WATCH';
  if (upper === 'NORMAL') return 'NORMAL';
  if (upper === 'FAULTY_STUCK') return 'FAULTY_STUCK';
  if (upper === 'DATA_UNAVAILABLE') return 'DATA_UNAVAILABLE';
  return 'UNKNOWN';
}

export function mapTelemetry(reading: BackendTelemetry): TelemetryViewModel {
  const isSynthetic =
    reading.data_status === 'SIMULATED_HYDROLOGY' ||
    reading.rainfall_source === 'simulation' ||
    reading.water_level_source === 'simulation' ||
    reading.rate_of_rise_source === 'simulation';

  return {
    regionId: reading.region_id ?? '',
    sensorId: reading.sensor_id ?? 'UNKNOWN_SENSOR',
    rainfallMmHr: typeof reading.rainfall_mm_hr === 'number' ? reading.rainfall_mm_hr : null,
    rainfallSource: reading.rainfall_source ?? 'unknown',
    waterLevelCm: typeof reading.water_level_cm === 'number' ? reading.water_level_cm : null,
    waterLevelSource: reading.water_level_source ?? 'unknown',
    rateOfRiseCmMin: typeof reading.rate_of_rise_cm_min === 'number' ? reading.rate_of_rise_cm_min : null,
    rateOfRiseSource: reading.rate_of_rise_source ?? 'unknown',
    soilMoisturePct: typeof reading.soil_moisture_pct === 'number' ? reading.soil_moisture_pct : null,
    soilMoistureSource: reading.soil_moisture_source ?? 'unknown',
    status: toRiskStatus(reading.status),
    dataStatus: reading.data_status ?? (isSynthetic ? 'SIMULATED_HYDROLOGY' : 'SENSOR_TELEMETRY'),
    weatherStatus: reading.weather_status ?? 'UNKNOWN',
    weatherObservationAgeSeconds: reading.weather_observation_age_seconds ?? null,
    timestamp: reading.timestamp ?? null,
    isSynthetic,
  };
}

export function mapVillage(village: BackendVillage): VillageViewModel {
  return {
    id: village.id,
    name: village.name,
    population: village.population_at_risk,
    status: toRiskStatus(village.risk_level),
    riskScore: village.risk_score,
    leadTimeMinutes: typeof village.lead_time_minutes === 'number' && village.lead_time_minutes > 0 ? village.lead_time_minutes : null,
    primaryDriver: village.primary_driver || 'Topographic exposure',
    regionalHazardStatus: village.regional_hazard_status || 'NORMAL',
    settlementRiskStatus: village.settlement_risk_status || 'DATA_UNAVAILABLE',
  };
}

export async function getRegions(signal?: AbortSignal): Promise<Region[]> {
  return requestJson<Region[]>('/api/regions', undefined, signal);
}

export async function getRegionMetadata(regionId: string, signal?: AbortSignal): Promise<Region> {
  return requestJson<Region>(`/api/regions/${encodeURIComponent(regionId)}`, undefined, signal);
}

export async function getRegionLayers(regionId: string, villageId?: string, signal?: AbortSignal): Promise<RegionLayers> {
  const fetchLayer = (layerName: string) =>
    requestJson<GeoJsonFeatureCollection>(`/api/regions/${encodeURIComponent(regionId)}/geojson/${encodeURIComponent(layerName)}`, undefined, signal);

  let river: GeoJsonFeatureCollection | null = null;
  let riverOk = false;
  try {
    river = await fetchLayer('rivers');
    riverOk = true;
  } catch {
    river = null;
  }

  let settlements: GeoJsonFeatureCollection | null = null;
  let settlementsOk = false;
  try {
    settlements = await fetchLayer('settlements');
    settlementsOk = true;
  } catch {
    settlements = null;
  }

  let shelters: GeoJsonFeatureCollection | null = null;
  let sheltersOk = false;
  try {
    shelters = await fetchLayer('shelters');
    sheltersOk = true;
  } catch {
    shelters = null;
  }

  let evacuation: GeoJsonFeatureCollection | null = null;
  let evacuationOk = false;
  if (villageId) {
    try {
      const plan = await getEvacuation(villageId, regionId, signal);
      evacuation = plan.geojson;
      evacuationOk = plan.isAvailable;
    } catch {
      evacuation = null;
    }
  }

  return {
    river,
    villages: settlements,
    shelters,
    evacuation,
    layerStatus: {
      river: riverOk,
      villages: settlementsOk,
      shelters: sheltersOk,
      evacuation: evacuationOk,
    },
  };
}

export async function getTelemetry(regionId: string, signal?: AbortSignal): Promise<TelemetryViewModel> {
  const payload = await requestJson<BackendTelemetry>(`/api/telemetry${regionQuery(regionId)}`, undefined, signal);
  return mapTelemetry(payload);
}

export async function getVillages(regionId: string, signal?: AbortSignal): Promise<VillageViewModel[]> {
  const payload = await requestJson<BackendVillage[]>(`/api/villages${regionQuery(regionId)}`, undefined, signal);
  return payload.map(mapVillage);
}

export async function getVillageDetail(id: string, regionId: string, signal?: AbortSignal): Promise<VillageViewModel | null> {
  try {
    const payload = await requestJson<BackendVillage>(`/api/villages/${encodeURIComponent(id)}${regionQuery(regionId)}`, undefined, signal);
    return mapVillage(payload);
  } catch {
    return null;
  }
}

export async function getEvacuation(id: string, regionId: string, signal?: AbortSignal): Promise<EvacuationPlanViewModel> {
  const route = await requestJson<GeoJsonFeatureCollection>(`/api/evacuation/${encodeURIComponent(id)}${regionQuery(regionId)}`, undefined, signal);
  const feature = route.features[0];
  const shelterId = (feature?.properties?.shelter_id as string | undefined) ?? null;
  const hazardWeighted = Boolean(feature?.properties?.hazard_weighted);
  const segmentCount = route.features.length;

  return {
    villageId: id,
    shelterId,
    hazardWeighted,
    segmentCount,
    geojson: route,
    isAvailable: segmentCount > 0,
  };
}

export async function getFactors(id: string, regionId: string, signal?: AbortSignal): Promise<DetailedRiskViewModel | null> {
  try {
    const risk = await requestJson<BackendRisk>(`/api/risk/detailed/${encodeURIComponent(id)}${regionQuery(regionId)}`, undefined, signal);
    return {
      villageId: risk.village_id,
      predictedTier: risk.predicted_tier,
      probabilities: risk.probabilities ?? {},
      primaryDriver: risk.primary_driver,
      factors: (risk.factors ?? []).map((factor) => ({
        feature: factor.feature.replaceAll('_', ' '),
        impactPct: factor.impact_pct,
        detail: 'Model feature contribution',
      })),
      mlStatus: risk.ml_status ?? 'UNAVAILABLE',
    };
  } catch {
    return null;
  }
}

export async function postSimulateCloudburst(regionId: string): Promise<{ accepted: boolean; telemetry: TelemetryViewModel }> {
  const response = await requestJson<{ telemetry: BackendTelemetry; message?: string }>('/api/simulate/cloudburst', {
    method: 'POST',
    body: JSON.stringify({
      intensity: 'high',
      target_basin: regionId.toUpperCase(),
      region_id: regionId,
    }),
  });
  return { accepted: true, telemetry: mapTelemetry(response.telemetry) };
}

export async function postReset(regionId: string): Promise<{ accepted: boolean }> {
  await requestJson<{ status: string }>(`/api/simulate/reset${regionQuery(regionId)}`, {
    method: 'POST',
  });
  return { accepted: true };
}

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useWebSocket(regionId: string) {
  const [status, setStatus] = useState<WebSocketStatus>('connecting');
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryViewModel | null>(null);
  const activeRegionRef = useRef(regionId);
  activeRegionRef.current = regionId;

  useEffect(() => {
    if (!regionId) return;
    setStatus('connecting');
    setLatestTelemetry(null);

    const configuredEndpoint = import.meta.env.VITE_FLASHSHIELD_WS_URL as string | undefined;
    const localEndpoint = typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/telemetry${regionQuery(regionId)}`
      : undefined;
    const endpoint = configuredEndpoint
      ? `${configuredEndpoint.replace(/\/$/, '')}${regionQuery(regionId)}`
      : apiBaseUrl
        ? `${apiBaseUrl.replace(/^http/, 'ws')}/ws/telemetry${regionQuery(regionId)}`
        : localEndpoint;

    if (!endpoint || typeof window === 'undefined' || !('WebSocket' in window)) {
      setStatus('error');
      return;
    }

    let socket: WebSocket | null = null;
    let isDisposed = false;

    try {
      socket = new window.WebSocket(endpoint);
    } catch {
      setStatus('error');
      return;
    }

    socket.onopen = () => {
      if (isDisposed) {
        socket?.close();
        return;
      }
      setStatus('connected');
    };

    socket.onmessage = (event) => {
      if (isDisposed) return;
      try {
        const payload = JSON.parse(event.data) as BackendTelemetry;
        // Strict region isolation: accept only messages matching the currently active region
        if (payload.region_id && payload.region_id !== activeRegionRef.current) {
          return;
        }
        setLatestTelemetry(mapTelemetry(payload));
      } catch (err) {
        console.error('Failed to parse telemetry websocket message', err);
      }
    };

    socket.onerror = () => {
      if (!isDisposed) setStatus('error');
    };

    socket.onclose = () => {
      if (!isDisposed) setStatus('disconnected');
    };

    return () => {
      isDisposed = true;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      }
    };
  }, [regionId]);

  return {
    status,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    isError: status === 'error',
    latestTelemetry,
  };
}

export type FeedEvent = {
  id: string;
  time: string;
  source: string;
  message: string;
  state: 'normal' | 'watch' | 'critical';
};

export function useFlashShieldData(regionId: string) {
  const [telemetry, setTelemetry] = useState<TelemetryViewModel | null>(null);
  const [villages, setVillages] = useState<VillageViewModel[]>([]);
  const [detailedRisk, setDetailedRisk] = useState<DetailedRiskViewModel | null>(null);
  const [evacuationPlan, setEvacuationPlan] = useState<EvacuationPlanViewModel | null>(null);
  const [layers, setLayers] = useState<RegionLayers | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentAcknowledged, setIncidentAcknowledged] = useState(false);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);

  const ws = useWebSocket(regionId);
  const reqIdRef = useRef(0);

  // Region isolation & state reset on region change
  useEffect(() => {
    if (!regionId) return;
    const currentReqId = ++reqIdRef.current;
    const abortController = new AbortController();

    // 1. Immediately clear old region-specific state to prevent leakage
    setIsLoading(true);
    setError(null);
    setTelemetry(null);
    setVillages([]);
    setDetailedRisk(null);
    setEvacuationPlan(null);
    setLayers(null);
    setSelectedVillage(null);
    setIncidentOpen(false);
    setIncidentAcknowledged(false);

    async function loadRegionData() {
      try {
        const [nextTelemetry, nextVillages] = await Promise.all([
          getTelemetry(regionId, abortController.signal),
          getVillages(regionId, abortController.signal),
        ]);

        if (currentReqId !== reqIdRef.current) return;

        const firstVillageId = nextVillages[0]?.id ?? null;

        const [nextRisk, nextPlan, nextLayers] = await Promise.all([
          firstVillageId ? getFactors(firstVillageId, regionId, abortController.signal) : Promise.resolve(null),
          firstVillageId ? getEvacuation(firstVillageId, regionId, abortController.signal) : Promise.resolve(null),
          getRegionLayers(regionId, firstVillageId ?? undefined, abortController.signal),
        ]);

        if (currentReqId !== reqIdRef.current) return;

        setTelemetry(nextTelemetry);
        setVillages(nextVillages);
        setSelectedVillage(firstVillageId);
        setDetailedRisk(nextRisk);
        setEvacuationPlan(nextPlan);
        setLayers(nextLayers);
        setError(null);

        const timeStr = nextTelemetry.timestamp
          ? new Date(nextTelemetry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : '—';

        setFeedEvents([
          {
            id: `init-1-${Date.now()}`,
            time: timeStr,
            source: nextTelemetry.sensorId,
            message: `Telemetry received (${nextTelemetry.dataStatus})`,
            state: nextTelemetry.status === 'CRITICAL' ? 'critical' : nextTelemetry.status === 'WATCH' ? 'watch' : 'normal',
          },
          {
            id: `init-2-${Date.now()}`,
            time: timeStr,
            source: 'HYDRO-RULES',
            message: `Rate of rise ${nextTelemetry.rateOfRiseCmMin !== null ? nextTelemetry.rateOfRiseCmMin.toFixed(2) + ' cm/min' : '—'}`,
            state: nextTelemetry.status === 'CRITICAL' ? 'critical' : 'normal',
          },
          {
            id: `init-3-${Date.now()}`,
            time: timeStr,
            source: 'GIS',
            message: `Regional bundle ready: ${nextVillages.length} settlements mapped`,
            state: 'normal',
          },
        ]);
      } catch (reason: unknown) {
        if (currentReqId !== reqIdRef.current) return;
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Backend unavailable');
      } finally {
        if (currentReqId === reqIdRef.current) {
          setIsLoading(false);
        }
      }
    }

    loadRegionData();

    return () => {
      abortController.abort();
    };
  }, [regionId]);

  // Handle incoming live telemetry over WebSocket
  useEffect(() => {
    if (ws.latestTelemetry && ws.latestTelemetry.regionId === regionId) {
      setTelemetry(ws.latestTelemetry);
      if (ws.latestTelemetry.timestamp) {
        const timeStr = new Date(ws.latestTelemetry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setFeedEvents((prev) => [
          {
            id: `ws-${Date.now()}-${Math.random()}`,
            time: timeStr,
            source: ws.latestTelemetry?.sensorId ?? 'STREAM',
            message: `Stream update: RoR ${ws.latestTelemetry?.rateOfRiseCmMin !== null ? ws.latestTelemetry?.rateOfRiseCmMin.toFixed(2) : '—'} cm/min (${ws.latestTelemetry?.status})`,
            state: ws.latestTelemetry?.status === 'CRITICAL' ? 'critical' : ws.latestTelemetry?.status === 'WATCH' ? 'watch' : 'normal',
          },
          ...prev.slice(0, 19),
        ]);
      }
    }
  }, [ws.latestTelemetry, regionId]);

  // When selectedVillage changes within active region
  useEffect(() => {
    if (!selectedVillage || !regionId) return;
    const villageId = selectedVillage;
    let active = true;
    const abortController = new AbortController();

    async function loadVillageContext() {
      try {
        const [nextRisk, nextPlan] = await Promise.all([
          getFactors(villageId, regionId, abortController.signal),
          getEvacuation(villageId, regionId, abortController.signal),
        ]);
        if (!active) return;
        setDetailedRisk(nextRisk);
        setEvacuationPlan(nextPlan);

        setLayers((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            evacuation: nextPlan.geojson,
            layerStatus: { ...prev.layerStatus, evacuation: nextPlan.isAvailable },
          };
        });
      } catch {
        if (!active) return;
        setDetailedRisk(null);
        setEvacuationPlan(null);
      }
    }

    loadVillageContext();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [selectedVillage, regionId]);

  const simulateCloudburst = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    try {
      const result = await postSimulateCloudburst(regionId);
      setTelemetry(result.telemetry);
      const [nextVillages, nextRisk] = await Promise.all([
        getVillages(regionId),
        selectedVillage ? getFactors(selectedVillage, regionId) : Promise.resolve(null),
      ]);
      setVillages(nextVillages);
      if (nextRisk) setDetailedRisk(nextRisk);
      if (result.telemetry.status === 'CRITICAL') {
        setIncidentOpen(true);
      }
      setError(null);
      const timeStr = result.telemetry.timestamp
        ? new Date(result.telemetry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'SIM';
      setFeedEvents((prev) => [
        {
          id: `sim-${Date.now()}`,
          time: timeStr,
          source: 'SIMULATE',
          message: `Cloudburst surge triggered for ${regionId}`,
          state: 'critical',
        },
        ...prev.slice(0, 19),
      ]);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Simulation request failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const reset = async () => {
    try {
      await postReset(regionId);
      const [nextTelemetry, nextVillages, nextRisk] = await Promise.all([
        getTelemetry(regionId),
        getVillages(regionId),
        selectedVillage ? getFactors(selectedVillage, regionId) : Promise.resolve(null),
      ]);
      setTelemetry(nextTelemetry);
      setVillages(nextVillages);
      if (nextRisk) setDetailedRisk(nextRisk);
      setError(null);
      setIncidentOpen(false);
      setIncidentAcknowledged(false);
      setIsSimulating(false);
      const timeStr = nextTelemetry?.timestamp
        ? new Date(nextTelemetry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'RESET';
      setFeedEvents((prev) => [
        {
          id: `reset-${Date.now()}`,
          time: timeStr,
          source: 'SYSTEM',
          message: `Baseline state restored for ${regionId}`,
          state: 'normal',
        },
        ...prev.slice(0, 19),
      ]);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Reset request failed');
      setIsSimulating(false);
    }
  };

  const selected = useMemo(() => {
    return villages.find((village) => village.id === selectedVillage) ?? (villages.length ? villages[0] : null);
  }, [selectedVillage, villages]);

  return {
    telemetry,
    villages,
    detailedRisk,
    evacuationPlan,
    layers,
    selected,
    selectedVillage: selected?.id ?? '',
    setSelectedVillage: (id: string) => setSelectedVillage(id),
    isLoading,
    error,
    isSimulating,
    incidentOpen,
    setIncidentOpen,
    incidentAcknowledged,
    setIncidentAcknowledged,
    feedEvents,
    simulateCloudburst,
    reset,
    ws,
  };
}