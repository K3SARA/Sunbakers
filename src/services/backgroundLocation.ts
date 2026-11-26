import { registerPlugin } from '@capacitor/core';
import { API_BASE_URL, LocationService } from './api';

interface BackgroundLocationPluginInterface {
  start(options: { userId: string; lorryId?: string; apiUrl: string }): Promise<{ started: boolean }>;
  stop(): Promise<{ stopped: boolean }>;
  isRunning(): Promise<{ running: boolean }>;
}

const BackgroundLocationNative = registerPlugin<BackgroundLocationPluginInterface>('BackgroundLocation');

let webWatchId: number | null = null;
let lastWebSent = 0;

export async function startRepBackgroundTracking(params: {
  userId: string;
  lorryId?: string | null;
}): Promise<void> {
  const { userId, lorryId } = params;
  if (!userId) return;

  const isNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
  if (isNative) {
    try {
      await BackgroundLocationNative.start({
        userId,
        lorryId: lorryId || '',
        apiUrl: API_BASE_URL
      });
      return;
    } catch (err) {
      console.warn('[BackgroundLocation] Native start failed, falling back to web geolocation:', err);
    }
  }

  // Web / Browser fallback
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    if (webWatchId !== null) {
      navigator.geolocation.clearWatch(webWatchId);
    }
    webWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastWebSent < 15000) return;
        lastWebSent = now;
        LocationService.reportLocation({
          userId,
          lorryId: lorryId || undefined,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          recordedAt: new Date(pos.timestamp).toISOString()
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
    );
  }
}

export async function stopRepBackgroundTracking(): Promise<void> {
  const isNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
  if (isNative) {
    try {
      await BackgroundLocationNative.stop();
    } catch {
      // ignore
    }
  }
  if (webWatchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(webWatchId);
    webWatchId = null;
  }
}

