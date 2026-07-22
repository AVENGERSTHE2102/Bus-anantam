"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  fetchRoutes, fetchStops, fetchBuses, fetchMe, loginOrRegisterDemoUser,
  startTrip as startTripApi, endTrip as endTripApi, sendRemarkApi,
  confirmConversionApi, addFavoriteApi, removeFavoriteApi, fetchMyFavorites, fetchActiveTrips, updateOccupancy,
  ApiRoute, ApiStop, ApiBus, ApiUser, ApiTrip,
} from '@/lib/api';
import { getNativeAccessToken, isNativeApp } from '@/lib/native';
import { drainLocationPings, enqueueLocationPing } from '@/lib/locationQueue';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const MONGO_ID_RE = /^[a-f0-9]{24}$/i;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Stop {
  id: string;
  routeId: string;
  name: string;
  location: LatLng;
  sequenceOrder: number;
  code: string;
}

export interface Route {
  id: string;
  name: string;
  startLocation: LatLng;
  endLocation: LatLng;
  stops: Stop[];
  polyline: LatLng[];
  durationMinutes: number;
  frequencyMinutes: number;
}

export interface Bus {
  id: string;
  registrationNumber: string;
  status: 'idle' | 'active' | 'maintenance';
  capacity: number;
}

export interface Trip {
  id: string;
  busId: string;
  routeId: string;
  driverId: string;
  conductorId: string;
  status: 'active' | 'arrived' | 'completed' | 'cancelled';
  startedAt: string;
  endedAt?: string;
  passengerCount: number;
  currentLat: number;
  currentLng: number;
  speedKmph: number;
  heading: number;
  currentStopIndex: number;
  stopsLeft: number;
  occupancyBand?: 'low' | 'moderate' | 'full';
  delayMinutes?: number;
  etaConfidence?: 'high' | 'medium' | 'limited';
  gpsFreshness?: 'fresh' | 'aging' | 'stale' | 'unknown';
}

export interface Remark {
  id: string;
  tripId: string;
  source: 'driver' | 'conductor' | 'system';
  tag: 'traffic' | 'accident' | 'roadblock' | 'breakdown';
  message: string;
  location?: LatLng;
  createdAt: string;
  photoUrl?: string;
}

export interface Announcement {
  id: string;
  message: string;
  routeId?: string;
  createdAt: string;
}

export interface LiveEta {
  stopId: string;
  etaMinutes: number;
  source: 'osrm' | 'speed-estimate';
  updatedAt: string;
}

interface AppContextType {
  activeRole: 'passenger' | 'driver' | 'conductor' | 'admin';
  setActiveRole: (role: 'passenger' | 'driver' | 'conductor' | 'admin') => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  routes: Route[];
  buses: Bus[];
  trips: Trip[];
  remarks: Remark[];
  etaByTripId: Record<string, LiveEta>;
  announcements: Announcement[];
  favorites: string[]; // route IDs or stop IDs
  toggleFavorite: (id: string) => void;
  startTrip: (busId: string, routeId: string, conductorId: string, driverId: string) => Trip;
  endTrip: (tripId: string) => void;
  sendRemark: (tripId: string, tag: Remark['tag'], message: string, photoUrl?: string) => void;
  savePassengerCount: (tripId: string, count: number) => void;
  confirmConversion: (tripId: string, toRouteId?: string) => void;
  broadcastAnnouncement: (message: string, routeId?: string) => void;
  addStop: (routeId: string, name: string, location: LatLng) => void;
  manualCheckInStop: (tripId: string, stopIndex: number) => void;
  emitDriverLocation: (tripId: string, lat: number, lng: number, speed: number, heading: number) => void;
  currentUser: ApiUser | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Demo-account bootstrap: one fixed account per role, auto-registered on
// first use, so the existing zero-friction role switcher still works while
// every action underneath now runs through a real authenticated session
// (httpOnly cookie + socket auth) instead of pure local state.
const DEMO_ACCOUNTS: Record<AppContextType['activeRole'], { name: string; phone: string }> = {
  passenger: { name: 'Demo Passenger', phone: 'demo-passenger' },
  driver: { name: 'Demo Driver', phone: 'demo-driver' },
  conductor: { name: 'Demo Conductor', phone: 'demo-conductor' },
  admin: { name: 'Demo Admin', phone: 'demo-admin' },
};
const DEMO_PASSWORD = 'bustracker-demo-local-only';

function toStop(apiStop: ApiStop): Stop {
  const [lng, lat] = apiStop.location.coordinates;
  return {
    id: apiStop._id,
    routeId: apiStop.routeId,
    name: apiStop.name,
    location: { lat, lng },
    sequenceOrder: apiStop.sequenceOrder,
    code: apiStop.name.slice(0, 4).toUpperCase() + apiStop.sequenceOrder,
  };
}

function toRoute(apiRoute: ApiRoute, stops: Stop[]): Route {
  const [startLng, startLat] = apiRoute.startLocation.coordinates;
  const [endLng, endLat] = apiRoute.endLocation.coordinates;
  return {
    id: apiRoute._id,
    name: apiRoute.name,
    startLocation: { lat: startLat, lng: startLng },
    endLocation: { lat: endLat, lng: endLng },
    stops: stops.sort((a, b) => a.sequenceOrder - b.sequenceOrder),
    polyline: (apiRoute.polyline?.coordinates || []).map(([lng, lat]) => ({ lat, lng })),
    durationMinutes: 20,
    frequencyMinutes: 15,
  };
}

function toBus(apiBus: ApiBus): Bus {
  return { id: apiBus._id, registrationNumber: apiBus.registrationNumber, status: apiBus.status, capacity: apiBus.capacity };
}

function toTrip(apiTrip: ApiTrip, routes: Route[]): Trip {
  const route = routes.find((candidate) => candidate.id === apiTrip.routeId);
  const [lng, lat] = apiTrip.lastPosition?.location.coordinates || [route?.startLocation.lng || 0, route?.startLocation.lat || 0];
  const checkpointCount = apiTrip.checkpointHistory?.length || 0;
  return {
    id: apiTrip._id, busId: apiTrip.busId, routeId: apiTrip.routeId, driverId: apiTrip.driverId, conductorId: apiTrip.conductorId || '', status: apiTrip.status,
    startedAt: apiTrip.startedAt, endedAt: apiTrip.endedAt, passengerCount: apiTrip.passengerCount || 0,
    currentLat: lat, currentLng: lng, speedKmph: apiTrip.lastPosition?.speedKmph || 0, heading: apiTrip.lastPosition?.heading || 0,
    currentStopIndex: Math.max(0, checkpointCount - 1), stopsLeft: Math.max(0, (route?.stops.length || 0) - checkpointCount),
    occupancyBand: apiTrip.occupancyBand, delayMinutes: apiTrip.delayMinutes, etaConfidence: apiTrip.etaConfidence, gpsFreshness: apiTrip.gpsFreshness,
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<'passenger' | 'driver' | 'conductor' | 'admin'>('passenger');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoaded, setRoutesLoaded] = useState(false);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [etaByTripId, setEtaByTripId] = useState<Record<string, LiveEta>>({});
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);

  const socketRef = useRef<Socket | null>(null);
  // Trip ids that have received at least one real driver:location GPS ping —
  // the movement-simulation effect skips these so real data always wins.
  const realTrackedTripIds = useRef<Set<string>>(new Set());
  const favoriteBackendIds = useRef<Map<string, string>>(new Map()); // stopId -> Favorite._id

  useEffect(() => {
    setMounted(true);
  }, []);

  // Broadcast helper to sync tabs
  const broadcastSync = (type: string, payload: unknown) => {
    if (typeof window === 'undefined') return;
    try {
      const channel = new BroadcastChannel('bus-tracker-sync');
      channel.postMessage({ type, payload });
      channel.close();
    } catch {
      // BroadcastChannel ignore
    }
  };

  // Listen to cross-tab BroadcastChannel sync events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const channel = new BroadcastChannel('bus-tracker-sync');

    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'SYNC_TRIPS') setTrips(payload);
      if (type === 'SYNC_REMARKS') setRemarks(payload);
      if (type === 'SYNC_FAVORITES') setFavorites(payload);
      if (type === 'SYNC_ANNOUNCEMENTS') setAnnouncements(payload);
      if (type === 'SYNC_BUSES') setBuses(payload);
      if (type === 'SYNC_THEME') setTheme(payload);
    };

    return () => channel.close();
  }, []);

  // Pull real routes/stops/buses from the backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [apiRoutes, apiBuses] = await Promise.all([fetchRoutes(), fetchBuses()]);
        const withStops = await Promise.all(
          apiRoutes.map(async (r) => toRoute(r, (await fetchStops(r._id)).map(toStop))),
        );
        if (!cancelled) {
          setRoutes(withStops);
          setBuses(apiBuses.map(toBus));
          const activeTrips = await fetchActiveTrips();
          if (!cancelled) setTrips(activeTrips.map((trip) => toTrip(trip, withStops)));
        }
      } catch (err) {
        console.error('Failed to load routes/buses from backend:', err);
      } finally {
        if (!cancelled) setRoutesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Establish a real authenticated session for the active role (see
  // DEMO_ACCOUNTS above), restoring an existing cookie session first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = await fetchMe();
      if (cancelled) return;
      if (existing && existing.role === activeRole) {
        setCurrentUser(existing);
        return;
      }
      const demo = DEMO_ACCOUNTS[activeRole];
      try {
        const user = await loginOrRegisterDemoUser(demo.name, demo.phone, activeRole, DEMO_PASSWORD);
        if (!cancelled) setCurrentUser(user);
      } catch (err) {
        console.error('Demo session bootstrap failed:', err);
        if (!cancelled) setCurrentUser(null);
      }
    })();
    return () => { cancelled = true; };
  }, [activeRole]);

  // Load the passenger's real favorites once authenticated as passenger.
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'passenger') return;
    let cancelled = false;
    (async () => {
      try {
        const favs = await fetchMyFavorites();
        if (cancelled) return;
        favoriteBackendIds.current = new Map(favs.map((f) => [f.stopId, f._id]));
        setFavorites(favs.map((f) => f.stopId));
      } catch (err) {
        console.error('Failed to load favorites:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Browsers use the httpOnly cookie. The packaged Android app uses its
  // encrypted WebView preference token because it is cross-origin from the API.
  useEffect(() => {
    if (!currentUser) return;
    let socket: Socket | null = null;
    let cancelled = false;

    (async () => {
      const token = await getNativeAccessToken();
      if (cancelled) return;
      const connectedSocket = io(API_BASE_URL, {
        withCredentials: true,
        ...(isNativeApp() && token ? { auth: { token } } : {}),
      });
      socket = connectedSocket;
      socketRef.current = connectedSocket;

      connectedSocket.on('connect', () => {
        routes.forEach((r) => connectedSocket.emit('subscribe:route', r.id));
        if (currentUser.role === 'admin') connectedSocket.emit('subscribe:admin');
        void drainLocationPings((ping) => connectedSocket.emit('driver:location', ping));
      });

      connectedSocket.on('bus:position', ({ tripId, lat, lng, speed, heading, currentStopIndex, stopsLeft, occupancyBand, delayMinutes, gpsFreshness, etaConfidence }) => {
        realTrackedTripIds.current.add(tripId);
        setTrips((prev) => prev.map((t) => (
          t.id === tripId ? {
            ...t,
            currentLat: lat,
            currentLng: lng,
            speedKmph: speed,
            heading,
            ...(typeof currentStopIndex === 'number' ? { currentStopIndex } : {}),
            ...(typeof stopsLeft === 'number' ? { stopsLeft } : {}),
            ...(occupancyBand ? { occupancyBand } : {}), ...(typeof delayMinutes === 'number' ? { delayMinutes } : {}),
            ...(gpsFreshness ? { gpsFreshness } : {}), ...(etaConfidence ? { etaConfidence } : {}),
          } : t
        )));
      });

      connectedSocket.on('bus:eta-update', ({ tripId, stopId, etaMinutes, source, updatedAt }) => {
        setEtaByTripId((previous) => ({
          ...previous,
          [tripId]: { stopId, etaMinutes, source, updatedAt },
        }));
      });

      connectedSocket.on('trip:occupancy', ({ tripId, passengerCount, occupancyBand }) => setTrips((prev) => prev.map((trip) => trip.id === tripId ? { ...trip, passengerCount, occupancyBand } : trip)));

      connectedSocket.on('trip:conversion-suggested', ({ tripId }) => {
        setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, status: 'arrived' } : t)));
      });

      connectedSocket.on('trip:converted', ({ oldTripId }) => {
        setTrips((prev) => prev.map((t) => (t.id === oldTripId ? { ...t, status: 'completed', endedAt: new Date().toISOString() } : t)));
      });

      connectedSocket.on('remark:new', (r) => {
        setRemarks((prev) => [{
          id: r._id, tripId: r.tripId, source: r.source, tag: r.tag, message: r.message,
          location: r.location ? { lat: r.location.coordinates[1], lng: r.location.coordinates[0] } : undefined,
          createdAt: r.createdAt,
        }, ...prev]);
      });

      connectedSocket.on('admin:broadcast', ({ message, routeId }) => {
        setAnnouncements((prev) => [{ id: `ann-${Date.now()}`, message, routeId, createdAt: new Date().toISOString() }, ...prev]);
      });
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const emitDriverLocation = (tripId: string, lat: number, lng: number, speed: number, heading: number) => {
    const ping = { tripId, lat, lng, speed, heading, capturedAt: new Date().toISOString() };
    if (socketRef.current?.connected) socketRef.current.emit('driver:location', ping);
    else void enqueueLocationPing(ping);
  };

  const toggleFavorite = (id: string) => {
    const wasFavorite = favorites.includes(id);
    setFavorites(prev => {
      const next = wasFavorite ? prev.filter(fId => fId !== id) : [...prev, id];
      broadcastSync('SYNC_FAVORITES', next);
      return next;
    });

    // Only stops have a backend Favorite concept (route-level favorites stay
    // local-only — there's no route-favorite model on the backend).
    const stop = routes.flatMap(r => r.stops).find(s => s.id === id);
    if (!stop) return;

    if (wasFavorite) {
      const backendId = favoriteBackendIds.current.get(id);
      if (backendId) removeFavoriteApi(backendId).catch((err) => console.error('Failed to remove favorite:', err));
    } else {
      addFavoriteApi(stop.id, stop.routeId)
        .then((fav) => favoriteBackendIds.current.set(id, fav._id))
        .catch((err) => console.error('Failed to add favorite:', err));
    }
  };

  const startTrip = (busId: string, routeId: string, conductorId: string, driverId: string) => {
    const route = routes.find(r => r.id === routeId);
    const fallbackTrip: Trip = {
      id: `trip-${Date.now()}`,
      busId,
      routeId,
      driverId,
      conductorId,
      status: 'active',
      startedAt: new Date().toISOString(),
      passengerCount: 0,
      currentLat: route?.startLocation.lat || 19.0896,
      currentLng: route?.startLocation.lng || 72.8656,
      speedKmph: 25,
      heading: 0,
      currentStopIndex: 0,
      stopsLeft: route?.stops.length || 0
    };

    const commit = (trip: Trip) => {
      setTrips(prev => {
        const next = [...prev, trip];
        broadcastSync('SYNC_TRIPS', next);
        return next;
      });
      setBuses(prev => {
        const next = prev.map(b => b.id === busId ? { ...b, status: 'active' as const } : b);
        broadcastSync('SYNC_BUSES', next);
        return next;
      });
    };

    if (MONGO_ID_RE.test(busId) && MONGO_ID_RE.test(routeId)) {
      startTripApi(busId, routeId, conductorId)
        .then((apiTrip) => commit({ ...fallbackTrip, id: apiTrip._id, driverId: apiTrip.driverId }))
        .catch((err) => { console.error('Failed to start trip on backend, using local-only trip:', err); commit(fallbackTrip); });
    } else {
      commit(fallbackTrip);
    }

    return fallbackTrip;
  };

  const endTrip = (tripId: string) => {
    if (MONGO_ID_RE.test(tripId)) {
      endTripApi(tripId).catch((err) => console.error('Failed to end trip on backend:', err));
    }

    setTrips(prev => {
      const next = prev.map(t => t.id === tripId ? { ...t, status: 'completed' as const, endedAt: new Date().toISOString() } : t);
      broadcastSync('SYNC_TRIPS', next);
      return next;
    });
    const trip = trips.find(t => t.id === tripId);
    if (trip) {
      setBuses(prev => {
        const next = prev.map(b => b.id === trip.busId ? { ...b, status: 'idle' as const } : b);
        broadcastSync('SYNC_BUSES', next);
        return next;
      });
    }
  };

  const sendRemark = (tripId: string, tag: Remark['tag'], message: string, photoUrl?: string) => {
    if (MONGO_ID_RE.test(tripId)) {
      // Real remark: let the server's remark:new socket event populate local
      // state, so passenger/admin tabs (and this one) all see the same copy.
      sendRemarkApi(tripId, tag, message).catch((err) => console.error('Failed to send remark to backend:', err));
      return;
    }

    const trip = trips.find(t => t.id === tripId);
    const newRemark: Remark = {
      id: `rem-${Date.now()}`,
      tripId,
      source: activeRole === 'admin' ? 'system' : (activeRole === 'driver' || activeRole === 'conductor' ? activeRole : 'system'),
      tag,
      message,
      location: trip ? { lat: trip.currentLat, lng: trip.currentLng } : undefined,
      createdAt: new Date().toISOString(),
      photoUrl
    };
    setRemarks(prev => {
      const next = [newRemark, ...prev];
      broadcastSync('SYNC_REMARKS', next);
      return next;
    });
  };

  const savePassengerCount = (tripId: string, count: number) => {
    if (MONGO_ID_RE.test(tripId)) updateOccupancy(tripId, count).catch((err) => console.error('Failed to save occupancy:', err));
    setTrips(prev => {
      const next = prev.map(t => t.id === tripId ? { ...t, passengerCount: count } : t);
      broadcastSync('SYNC_TRIPS', next);
      return next;
    });
  };

  const confirmConversion = (tripId: string, toRouteId?: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    if (MONGO_ID_RE.test(tripId)) {
      confirmConversionApi(tripId, toRouteId)
        .then((newApiTrip) => {
          const nextRoute = routes.find(r => r.id === newApiTrip.routeId);
          const newTrip: Trip = {
            id: newApiTrip._id,
            busId: newApiTrip.busId,
            routeId: newApiTrip.routeId,
            driverId: newApiTrip.driverId,
            conductorId: newApiTrip.conductorId || '',
            status: 'active',
            startedAt: newApiTrip.startedAt,
            passengerCount: 0,
            currentLat: nextRoute?.startLocation.lat || trip.currentLat,
            currentLng: nextRoute?.startLocation.lng || trip.currentLng,
            speedKmph: 0,
            heading: 0,
            currentStopIndex: 0,
            stopsLeft: nextRoute?.stops.length || 0,
          };
          setTrips(prev => {
            const next = [...prev.map(t => t.id === tripId ? { ...t, status: 'completed' as const, endedAt: new Date().toISOString() } : t), newTrip];
            broadcastSync('SYNC_TRIPS', next);
            return next;
          });
        })
        .catch((err) => console.error('Failed to confirm conversion on backend:', err));
      return;
    }

    const nextRoute = routes.find(r => r.id === toRouteId) || routes.find(r => r.id === trip.routeId) || routes[0];
    if (!nextRoute) return;

    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      busId: trip.busId,
      routeId: nextRoute.id,
      driverId: trip.driverId,
      conductorId: trip.conductorId,
      status: 'active',
      startedAt: new Date().toISOString(),
      passengerCount: 0,
      currentLat: nextRoute.startLocation.lat,
      currentLng: nextRoute.startLocation.lng,
      speedKmph: 30,
      heading: 0,
      currentStopIndex: 0,
      stopsLeft: nextRoute.stops.length
    };

    setTrips(prev => {
      const next = [...prev.map(t => t.id === tripId ? { ...t, status: 'completed' as const, endedAt: new Date().toISOString() } : t), newTrip];
      broadcastSync('SYNC_TRIPS', next);
      return next;
    });
  };

  const broadcastAnnouncement = (message: string, routeId?: string) => {
    const newAnn: Announcement = {
      id: `ann-${Date.now()}`,
      message,
      routeId,
      createdAt: new Date().toISOString()
    };
    setAnnouncements(prev => {
      const next = [newAnn, ...prev];
      broadcastSync('SYNC_ANNOUNCEMENTS', next);
      return next;
    });
  };

  const addStop = (routeId: string, name: string, location: LatLng) => {
    setRoutes(prev => prev.map(route => {
      if (route.id !== routeId) return route;
      const newStop: Stop = {
        id: `stop-${Date.now()}`,
        routeId,
        name,
        location,
        sequenceOrder: route.stops.length,
        code: name.slice(0, 4).toUpperCase() + route.stops.length
      };
      return {
        ...route,
        stops: [...route.stops, newStop]
      };
    }));
  };

  const updateTheme = (t: 'light' | 'dark') => {
    setTheme(t);
    broadcastSync('SYNC_THEME', t);
  };

  // Fallback movement simulation for trips not (yet) receiving real GPS —
  // real bus:position events always win once a trip is in realTrackedTripIds.
  useEffect(() => {
    const timer = setInterval(() => {
      setTrips(prev => {
        const updated = prev.map(trip => {
          if (trip.status !== 'active') return trip;
          if (realTrackedTripIds.current.has(trip.id)) return trip;

          const route = routes.find(r => r.id === trip.routeId);
          if (!route) return trip;

          const currentStop = route.stops[trip.currentStopIndex];
          const nextStopIndex = (trip.currentStopIndex + 1) % route.stops.length;
          const nextStop = route.stops[nextStopIndex];

          if (!currentStop || !nextStop) return trip;

          // Linear interpolation towards the next stop
          const step = 0.02; // speed factor
          const dLat = nextStop.location.lat - trip.currentLat;
          const dLng = nextStop.location.lng - trip.currentLng;
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);

          if (dist < 0.0003) {
            // Arrived at stop
            const isTerminus = nextStopIndex === route.stops.length - 1;
            const updatedStopIndex = nextStopIndex;
            const updatedStopsLeft = route.stops.length - 1 - updatedStopIndex;

            return {
              ...trip,
              currentStopIndex: updatedStopIndex,
              stopsLeft: updatedStopsLeft >= 0 ? updatedStopsLeft : 0,
              status: (isTerminus ? 'arrived' : 'active') as 'active' | 'arrived' | 'completed' | 'cancelled',
              currentLat: nextStop.location.lat,
              currentLng: nextStop.location.lng,
              speedKmph: 0
            };
          } else {
            // Move closer
            const angle = Math.atan2(dLat, dLng);
            const heading = (90 - (angle * 180) / Math.PI + 360) % 360;
            return {
              ...trip,
              currentLat: trip.currentLat + (dLat / dist) * step * 0.005,
              currentLng: trip.currentLng + (dLng / dist) * step * 0.005,
              speedKmph: 30 + Math.floor(Math.random() * 15),
              heading
            };
          }
        });

        // Broadcast moving positions to other tabs in real-time
        if (updated.some(t => t.status === 'active')) {
          broadcastSync('SYNC_TRIPS', updated);
        }
        return updated;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [routes]);

  if (!mounted) {
    return <div className="min-h-screen bg-white"></div>;
  }

  if (!routesLoaded) {
    return (
      <div className="flex items-center justify-center h-screen w-screen text-sm text-zinc-500 bg-white">
        Loading routes…
      </div>
    );
  }

  const manualCheckInStop = (tripId: string, stopIndex: number) => {
    setTrips(prev => {
      const next = prev.map(t => {
        if (t.id !== tripId) return t;
        const route = routes.find(r => r.id === t.routeId);
        if (!route || !route.stops[stopIndex]) return t;

        const stop = route.stops[stopIndex];
        const isTerminus = stopIndex === route.stops.length - 1;
        const stopsLeft = Math.max(0, route.stops.length - 1 - stopIndex);

        return {
          ...t,
          currentStopIndex: stopIndex,
          stopsLeft,
          currentLat: stop.location.lat,
          currentLng: stop.location.lng,
          status: (isTerminus ? 'arrived' : 'active') as 'active' | 'arrived' | 'completed' | 'cancelled',
        };
      });
      broadcastSync('SYNC_TRIPS', next);
      return next;
    });
  };

  return (
    <AppContext.Provider value={{
      activeRole,
      setActiveRole,
      theme,
      setTheme: updateTheme,
      routes,
      buses,
      trips,
      remarks,
      etaByTripId,
      announcements,
      favorites,
      toggleFavorite,
      startTrip,
      endTrip,
      sendRemark,
      savePassengerCount,
      confirmConversion,
      broadcastAnnouncement,
      addStop,
      manualCheckInStop,
      emitDriverLocation,
      currentUser
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
