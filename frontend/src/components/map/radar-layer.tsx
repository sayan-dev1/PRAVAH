import { useEffect, useState } from 'react';
import { TileLayer } from 'react-leaflet';

type RainViewerResponse = {
  version: string;
  generated: number;
  host: string;
  radar: {
    past?: Array<{ time: number; path: string }>;
    nowcast?: Array<{ time: number; path: string }>;
  };
};

type RadarLayerProps = {
  enabled: boolean;
  opacity: number;
  onStatusChange?: (available: boolean, timestamp?: number) => void;
};

export function RadarLayer({ enabled, opacity, onStatusChange }: RadarLayerProps) {
  const [radarTileUrl, setRadarTileUrl] = useState<string | null>(null);
  const [radarTimestamp, setRadarTimestamp] = useState<number | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const abortController = new AbortController();

    async function fetchRadarMetadata() {
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`RainViewer API returned status ${response.status}`);
        }
        const data: RainViewerResponse = await response.json();
        if (!active) return;

        const host = data.host || 'https://tilecache.rainviewer.com';
        const pastFrames = data.radar?.past ?? [];
        const latestFrame = pastFrames.length > 0 ? pastFrames[pastFrames.length - 1] : null;

        if (latestFrame && latestFrame.path) {
          // Construct RainViewer 256px tile URL
          const tilePath = `${host}${latestFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;
          setRadarTileUrl(tilePath);
          setRadarTimestamp(latestFrame.time);
          setIsAvailable(true);
          onStatusChange?.(true, latestFrame.time);
        } else {
          setIsAvailable(false);
          onStatusChange?.(false);
        }
      } catch (error) {
        if (!active) return;
        // Gracefully fail without breaking map
        setIsAvailable(false);
        setRadarTileUrl(null);
        onStatusChange?.(false);
      }
    }

    if (enabled) {
      fetchRadarMetadata();
    }

    return () => {
      active = false;
      abortController.abort();
    };
  }, [enabled, onStatusChange]);

  if (!enabled || !radarTileUrl || !isAvailable) {
    return null;
  }

  return (
    <TileLayer
      key={`rainviewer-${radarTimestamp}`}
      url={radarTileUrl}
      opacity={Math.min(Math.max(opacity, 0.1), 1.0)}
      zIndex={200}
      attribution="Precipitation Radar: &copy; <a href='https://www.rainviewer.com' target='_blank' rel='noreferrer'>RainViewer</a>"
    />
  );
}
