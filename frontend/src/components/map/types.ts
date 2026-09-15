import type { GeoJsonFeatureCollection, Region, RegionLayers, RiskStatus, TelemetryViewModel, VillageViewModel } from '@/lib/flashshield-api';

export type BasemapMode = 'tactical' | 'terrain' | 'satellite' | 'offline';

export type BasemapProviderConfig = {
  id: BasemapMode;
  label: string;
  url: string;
  attribution: string;
  subdomains?: string[];
  maxZoom?: number;
  minZoom?: number;
  isOffline?: boolean;
  description: string;
};

export type DataProvenance =
  | 'LIVE_OBSERVED'
  | 'MODEL_WEATHER'
  | 'DERIVED'
  | 'GIS'
  | 'ML_MODEL'
  | 'SIMULATION'
  | 'UNAVAILABLE';

export type TacticalMapProps = {
  telemetry: TelemetryViewModel | null;
  villages: VillageViewModel[];
  region?: Region;
  layers?: RegionLayers | null;
  selectedVillage?: string;
  onSelectVillage?: (id: string) => void;
  className?: string;
};
