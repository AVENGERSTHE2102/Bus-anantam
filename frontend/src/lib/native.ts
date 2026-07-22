import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { BackgroundGeolocation } from '@capgo/background-geolocation';

const ACCESS_TOKEN_KEY = 'bus-tracker-access-token';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export async function getNativeAccessToken(): Promise<string | null> {
  if (!isNativeApp()) return null;
  const { value } = await Preferences.get({ key: ACCESS_TOKEN_KEY });
  return value;
}

export async function saveNativeAccessToken(token: string): Promise<void> {
  if (isNativeApp()) await Preferences.set({ key: ACCESS_TOKEN_KEY, value: token });
}

export type LocationSample = {
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
};

/** Start foreground GPS updates on Android, with the browser API as the PWA fallback. */
export async function startDriverLocationTracking(
  tripId: string,
  onLocation: (sample: LocationSample) => void,
  onError: (message: string) => void,
): Promise<() => void> {
  if (isNativeApp()) {
    const token = await getNativeAccessToken();
    if (!token) {
      onError('Your session expired. Please sign in again before starting a trip.');
      return () => undefined;
    }
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const locationTokenResponse = await fetch(`${apiBaseUrl}/trips/${tripId}/location-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-BusTracker-Client': 'capacitor' },
    });
    const { locationToken } = await locationTokenResponse.json().catch(() => ({}));
    if (!locationTokenResponse.ok || !locationToken) {
      onError('Unable to start background location tracking');
      return () => undefined;
    }
    const nativeUploadUrl = `${apiBaseUrl}/trips/${tripId}/location/native?locationToken=${encodeURIComponent(locationToken)}`;
    const permissions = await BackgroundGeolocation.requestPermissions({
      permissions: ['location', 'backgroundLocation', 'notification'],
    });
    if (permissions.location !== 'granted') {
      onError('Location permission was not granted');
      return () => undefined;
    }
    await BackgroundGeolocation.start({
      backgroundTitle: 'BusTracker is sharing your location',
      backgroundMessage: 'Live bus tracking is active for this trip.',
      requestPermissions: false,
      stale: false,
      distanceFilter: 20,
      url: nativeUploadUrl,
    }, (position, error) => {
      if (error) onError(error.message || 'Background location tracking failed');
      if (position) onLocation({
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        heading: position.bearing,
      });
    });
    return () => { void BackgroundGeolocation.stop(); };
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError('Geolocation is not available on this device');
    return () => undefined;
  }
  const watchId = navigator.geolocation.watchPosition(
    (position) => onLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      speed: position.coords.speed,
      heading: position.coords.heading,
    }),
    (error) => onError(error.message),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
  );
  return () => navigator.geolocation.clearWatch(watchId);
}
