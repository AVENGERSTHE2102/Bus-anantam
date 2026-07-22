import { getNativeAccessToken, isNativeApp, saveNativeAccessToken } from './native';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ApiStop {
  _id: string;
  routeId: string;
  name: string;
  location: { type: 'Point'; coordinates: [number, number] };
  sequenceOrder: number;
}

export interface ApiRoute {
  _id: string;
  name: string;
  startLocation: { type: 'Point'; coordinates: [number, number] };
  endLocation: { type: 'Point'; coordinates: [number, number] };
  polyline?: { type: 'LineString'; coordinates: [number, number][] };
  active: boolean;
}

export interface ApiBus {
  _id: string;
  registrationNumber: string;
  capacity: number;
  status: 'idle' | 'active' | 'maintenance';
}

export interface ApiUser {
  id: string;
  name: string;
  role: 'admin' | 'driver' | 'conductor' | 'passenger';
}

export interface ApiTrip {
  _id: string;
  busId: string;
  routeId: string;
  driverId: string;
  conductorId?: string;
  status: 'active' | 'arrived' | 'completed' | 'cancelled';
  startedAt: string;
  endedAt?: string;
  lastPosition?: {
    location: { type: 'Point'; coordinates: [number, number] };
    speedKmph: number;
    heading: number;
    recordedAt: string;
  };
  passengerCount?: number;
  occupancyBand?: 'low' | 'moderate' | 'full';
  delayMinutes?: number;
  etaConfidence?: 'high' | 'medium' | 'limited';
  gpsFreshness?: 'fresh' | 'aging' | 'stale' | 'unknown';
  checkpointHistory?: { stopId: string; arrivedAt: string }[];
}

export interface StopArrivalResponse {
  live: { tripId: string; busId: string; etaMinutes: number; occupancyBand: 'low' | 'moderate' | 'full'; delayMinutes: number; confidence: 'high' | 'medium' | 'limited' }[];
  timetable: { scheduledTripId: string; status: string; plannedAt: string; cancellationReason?: string }[];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const nativeToken = await getNativeAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(isNativeApp() ? { 'X-BusTracker-Client': 'capacitor' } : {}),
      ...(nativeToken ? { Authorization: `Bearer ${nativeToken}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function fetchRoutes(): Promise<ApiRoute[]> {
  return request('/routes');
}

export async function fetchStops(routeId: string): Promise<ApiStop[]> {
  return request(`/routes/${routeId}/stops`);
}

export async function fetchBuses(): Promise<ApiBus[]> {
  return request('/buses');
}

export async function fetchActiveTrips(): Promise<ApiTrip[]> { return request('/trips/active'); }
export async function fetchStopArrivals(stopId: string): Promise<StopArrivalResponse> { return request(`/public/stops/${stopId}/arrivals`); }
export async function updateOccupancy(tripId: string, passengerCount: number): Promise<ApiTrip> {
  return request(`/trips/${tripId}/occupancy`, { method: 'PATCH', body: JSON.stringify({ passengerCount }) });
}

export async function fetchMe(): Promise<ApiUser | null> {
  try {
    const { user } = await request<{ user: ApiUser }>('/auth/me');
    return user;
  } catch {
    return null;
  }
}

export async function login(phone: string, password: string): Promise<ApiUser> {
  const { user, accessToken } = await request<{ user: ApiUser; accessToken?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
  if (accessToken) await saveNativeAccessToken(accessToken);
  return user;
}

export async function register(name: string, phone: string, role: ApiUser['role'], password: string): Promise<void> {
  await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, phone, role, password }),
  });
}

// Demo-account bootstrap: log in if the account exists, register it on the
// fly otherwise. Used to get a real authenticated session per role without
// building a full login form for this local/demo app.
export async function loginOrRegisterDemoUser(name: string, phone: string, role: ApiUser['role'], password: string): Promise<ApiUser> {
  try {
    return await login(phone, password);
  } catch {
    await register(name, phone, role, password);
    return login(phone, password);
  }
}

export async function startTrip(busId: string, routeId: string, conductorId?: string): Promise<ApiTrip> {
  return request('/trips/start', { method: 'POST', body: JSON.stringify({ busId, routeId, conductorId }) });
}

export async function endTrip(tripId: string): Promise<ApiTrip> {
  return request(`/trips/${tripId}/end`, { method: 'POST' });
}

export async function sendRemarkApi(tripId: string, tag: string, message: string): Promise<void> {
  await request(`/trips/${tripId}/remarks`, { method: 'POST', body: JSON.stringify({ tag, message }) });
}

export async function confirmConversionApi(tripId: string, toRouteId?: string): Promise<ApiTrip> {
  return request(`/trips/${tripId}/confirm-conversion`, { method: 'POST', body: JSON.stringify({ toRouteId }) });
}

export async function fetchMyFavorites(): Promise<{ _id: string; stopId: string; routeId: string }[]> {
  return request('/favorites/me');
}

export async function addFavoriteApi(stopId: string, routeId: string): Promise<{ _id: string }> {
  return request('/favorites', { method: 'POST', body: JSON.stringify({ stopId, routeId }) });
}

export async function removeFavoriteApi(id: string): Promise<void> {
  await request(`/favorites/${id}`, { method: 'DELETE' });
}
