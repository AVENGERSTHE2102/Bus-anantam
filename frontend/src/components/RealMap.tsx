"use client";

import React, { useEffect, useRef } from 'react';
import { Stop, Trip, useApp } from './AppContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RealMapProps {
  stops: Stop[];
  polyline?: { lat: number; lng: number }[];
  activeTrip?: Trip;
  userCoords?: { lat: number; lng: number };
  height?: string;
}

export const RealMap: React.FC<RealMapProps> = ({
  stops,
  polyline,
  activeTrip,
  userCoords = { lat: 19.0790, lng: 72.8750 },
  height = "320px"
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const busMarkerRef = useRef<L.Marker | null>(null);
  const busPosRef = useRef<[number, number] | null>(null);
  const busRotationRef = useRef(0); // accumulated (unwrapped) so CSS rotation always animates the short way
  const busAnimFrameRef = useRef<number | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const remainingLineRef = useRef<L.Polyline | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const fixedMarkersRef = useRef<L.Marker[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Consume theme from global context safely
  const appContext = useApp();
  const theme = appContext?.theme || 'light';

  // Initialize Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    if (!leafletMap.current) {
      // Dombivli-only viewport: same bbox the OSRM road data is fenced to,
      // so the map can't be zoomed/panned out to a country/world view.
      const dombivliBounds = L.latLngBounds([19.173479, 73.060905], [19.249640, 73.147452]);

      leafletMap.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        minZoom: 13,
        maxBounds: dombivliBounds,
        maxBoundsViscosity: 1.0
      });
      leafletMap.current.fitBounds(dombivliBounds);

      L.control.zoom({ position: 'bottomright' }).addTo(leafletMap.current);
    }
  }, [userCoords.lat, userCoords.lng]);

  // Ensure Leaflet resizes correctly when container size changes
  useEffect(() => {
    const timer = setTimeout(() => {
      leafletMap.current?.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [height]);

  // Handle dynamic tile layers based on theme
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    // High fidelity premium map tiles
    const tileUrl = theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' // Dark Matter
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'; // Voyager Light

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 19,
    }).addTo(map);
  }, [theme]);

  // Handle stops and path representation
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    // Clear previous stop markers
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];
    fixedMarkersRef.current.forEach(m => m.remove());
    fixedMarkersRef.current = [];

    const userIcon = L.divIcon({
      className: 'custom-user-icon',
      html: `<div style="position: relative;">
              <div style="position: absolute; width: 16px; height: 16px; border-radius: 50%; background-color: #3b82f6; border: 2.5px solid #ffffff; box-shadow: 0 0 6px #3b82f6; z-index: 2;"></div>
              <div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background-color: rgba(59, 130, 246, 0.4); top: -5px; left: -5px; animation: ping 2s infinite; z-index: 1;"></div>
            </div>`,
      iconSize: [16, 16]
    });

    // Add user marker
    fixedMarkersRef.current.push(L.marker([userCoords.lat, userCoords.lng], { icon: userIcon }).addTo(map));

    // Origin landmark: Regency Anantam Build 19
    const originBuildingIcon = L.divIcon({
      className: 'custom-origin-building-icon',
      html: `<div style="width: 18px; height: 18px; border-radius: 4px; background-color: #ffffff; border: 3px solid #f59e0b; box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);"></div>`,
      iconSize: [18, 18]
    });
    const originMarker = L.marker([19.20226827682613, 73.11962915303403], { icon: originBuildingIcon })
      .bindTooltip('Regency Anantam Build 19', {
        permanent: true,
        direction: 'top',
        className: 'bg-white border-zinc-200 text-zinc-800 text-[10px] rounded p-1 shadow-md border'
      })
      .addTo(map);
    fixedMarkersRef.current.push(originMarker);

    // Add stop markers
    stops.forEach((stop, idx) => {
      const isTerminus = idx === 0 || idx === stops.length - 1;
      const isPassed = activeTrip ? idx < activeTrip.currentStopIndex : false;
      const isNext = activeTrip ? idx === Math.min(activeTrip.currentStopIndex + 1, stops.length - 1) : false;
      const checkpointIcon = L.divIcon({
        className: 'custom-checkpoint-icon',
        html: `<div style="width: ${isTerminus ? 16 : 12}px; height: ${isTerminus ? 16 : 12}px; border-radius: 50%; background-color: ${isPassed ? '#a1a1aa' : isNext ? '#22c55e' : theme === 'dark' ? '#0c0a0f' : '#ffffff'}; border: ${isTerminus ? 3 : 2}px solid ${isPassed ? '#71717a' : isNext ? '#16a34a' : theme === 'dark' ? '#c084fc' : '#6366f1'}; box-shadow: ${isNext ? '0 0 10px rgba(34, 197, 94, 0.8)' : '0 0 4px rgba(99, 102, 241, 0.5)'};"></div>`,
        iconSize: isTerminus ? [16, 16] : [12, 12],
      });
      const marker = L.marker([stop.location.lat, stop.location.lng], {
        icon: checkpointIcon
      }).bindTooltip(`${stop.name}${isPassed ? ' · Passed' : isNext ? ' · Next checkpoint' : ''}`, {
        permanent: false,
        direction: 'top',
        className: theme === 'dark' 
          ? 'bg-zinc-900 border-zinc-800 text-zinc-200 text-[10px] rounded p-1 shadow-md border'
          : 'bg-white border-zinc-200 text-zinc-800 text-[10px] rounded p-1 shadow-md border'
      }).addTo(map);
      stopMarkersRef.current.push(marker);
    });

    // Draw route line: real road geometry when available, else fall back to
    // straight stop-to-stop lines (e.g. routes not yet OSRM-processed).
    if (routeLineRef.current) {
      routeLineRef.current.remove();
    }
    const hasRoadGeometry = (polyline?.length ?? 0) > 1;
    const latlngs = hasRoadGeometry
      ? polyline!.map(p => [p.lat, p.lng] as [number, number])
      : stops.map(s => [s.location.lat, s.location.lng] as [number, number]);

    if (latlngs.length > 1) {
      routeLineRef.current = L.polyline(latlngs, {
        // The full route never disappears. It is the quiet reference path;
        // the bright overlay below shrinks as the bus advances.
        color: theme === 'dark' ? '#52525b' : '#d4d4d8',
        weight: 5,
        opacity: 0.95,
        ...(hasRoadGeometry ? {} : { dashArray: '5, 5' })
      }).addTo(map);

      // Fit map bounds to stops
      map.fitBounds(routeLineRef.current.getBounds(), { padding: [40, 40] });
    }
  }, [stops, polyline, theme, userCoords.lat, userCoords.lng, activeTrip?.currentStopIndex]);

  // Handle live active trip updates: glide the bus marker to each new
  // position/heading (Uber/Rapido-style) instead of snapping instantly, and
  // dim the traveled portion of the route behind it.
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !activeTrip) {
      busMarkerRef.current?.remove();
      busMarkerRef.current = null;
      busPosRef.current = null;
      remainingLineRef.current?.remove();
      remainingLineRef.current = null;
      if (busAnimFrameRef.current) cancelAnimationFrame(busAnimFrameRef.current);
      return;
    }

    const toCoords: [number, number] = [activeTrip.currentLat, activeTrip.currentLng];

    // Unwrap heading so the CSS transition always turns the short way
    // (e.g. 350deg -> 10deg animates as +20, not -340).
    const rawHeading = activeTrip.heading || 0;
    const prevRaw = busRotationRef.current % 360;
    const delta = ((rawHeading - prevRaw + 540) % 360) - 180;
    busRotationRef.current += delta;
    const rotation = busRotationRef.current;

    if (!busMarkerRef.current) {
      const busIcon = L.divIcon({
        className: 'custom-bus-icon',
        html: `<div class="bus-rotatable" style="position: relative; transform: rotate(${rotation}deg); transition: transform 0.4s ease;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #6366f1; border: 2.5px solid #ffffff; box-shadow: 0 0 10px rgba(99, 102, 241, 0.6); display: flex; align-items: center; justify-content: center; color: white;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7c0 .6.4 1 1 1h3M16 17H8"/>
                    <circle cx="7.5" cy="17.5" r="2.5"/>
                    <circle cx="16.5" cy="17.5" r="2.5"/>
                  </svg>
                </div>
              </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      busMarkerRef.current = L.marker(toCoords, { icon: busIcon }).addTo(map);
      busPosRef.current = toCoords;
    } else {
      // Rotate in place via direct DOM update so the existing CSS transition
      // eases it, instead of replacing the icon (which would snap instantly).
      const rotatable = busMarkerRef.current.getElement()?.querySelector<HTMLDivElement>('.bus-rotatable');
      if (rotatable) rotatable.style.transform = `rotate(${rotation}deg)`;

      const from = busPosRef.current || toCoords;
      busPosRef.current = toCoords;
      if (busAnimFrameRef.current) cancelAnimationFrame(busAnimFrameRef.current);

      const duration = 900;
      const startTime = performance.now();
      const glide = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const lat = from[0] + (toCoords[0] - from[0]) * t;
        const lng = from[1] + (toCoords[1] - from[1]) * t;
        busMarkerRef.current?.setLatLng([lat, lng]);
        if (t < 1) busAnimFrameRef.current = requestAnimationFrame(glide);
      };
      busAnimFrameRef.current = requestAnimationFrame(glide);
    }

    // Keep the complete route visible in gray, then draw only the remaining
    // bus-to-terminus segment in the brand color. That visible segment gets
    // shorter naturally as the bus progresses, like Uber/Rapido tracking.
    const routeCoords: [number, number][] = (polyline && polyline.length > 1)
      ? polyline.map(p => [p.lat, p.lng])
      : stops.map(s => [s.location.lat, s.location.lng]);

    if (routeCoords.length > 1) {
      let nearestIdx = 0;
      let nearestDistSq = Infinity;
      for (let i = 0; i < routeCoords.length; i++) {
        const dLat = routeCoords[i][0] - toCoords[0];
        const dLng = routeCoords[i][1] - toCoords[1];
        const distSq = dLat * dLat + dLng * dLng;
        if (distSq < nearestDistSq) { nearestDistSq = distSq; nearestIdx = i; }
      }

      remainingLineRef.current?.remove();
      const remainingCoords: [number, number][] = [toCoords, ...routeCoords.slice(nearestIdx + 1)];
      if (remainingCoords.length > 1) {
        remainingLineRef.current = L.polyline(remainingCoords, {
          color: theme === 'dark' ? '#c084fc' : '#4f46e5',
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }
    }

    return () => {
      if (busAnimFrameRef.current) cancelAnimationFrame(busAnimFrameRef.current);
    };
  }, [activeTrip?.currentLat, activeTrip?.currentLng, activeTrip?.heading, polyline, stops, theme]);

  // CSS injection for keyframes ping
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const styleId = 'map-ping-animation';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div className={`relative w-full h-full overflow-hidden ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`} style={{ height }}>
      <div ref={mapRef} className="w-full h-full z-10" />
    </div>
  );
};
export default RealMap;
