"use client";

import React, { useEffect, useState } from 'react';
import { Search, MapPin, Star, ShieldAlert, User, ChevronRight, ArrowLeft, Signal, Compass } from 'lucide-react';
import { useApp, Stop } from './AppContext';
import dynamic from 'next/dynamic';
import { fetchStopArrivals, StopArrivalResponse } from '@/lib/api';
const RealMap = dynamic(() => import('./RealMap'), { ssr: false });

export const PassengerApp: React.FC = () => {
  const { routes, trips, favorites, toggleFavorite, announcements, theme, etaByTripId } = useApp();
  const [activeTab, setActiveTab] = useState<'home' | 'routes' | 'alerts' | 'profile'>('home');
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [stopArrivals, setStopArrivals] = useState<StopArrivalResponse | null>(null);

  const selectedRoute = routes.find((route) => route.id === (selectedStop?.routeId || selectedRouteId)) || routes[0];

  // Find any active trip (only one route exists in the DB right now)
  const activeTrip = trips.find(t => t.routeId === selectedRoute?.id && (t.status === 'active' || t.status === 'arrived'));
  const liveEta = activeTrip ? etaByTripId[activeTrip.id] : undefined;

  const handleRouteClick = (routeId?: string) => {
    if (routeId) setSelectedRouteId(routeId);
    setActiveTab('routes');
  };

  const handleStopClick = (stop: Stop) => {
    setSelectedRouteId(stop.routeId);
    setSelectedStop(stop);
  };

  useEffect(() => {
    if (!selectedStop) { setStopArrivals(null); return; }
    let cancelled = false;
    const load = async () => {
      try { const arrivals = await fetchStopArrivals(selectedStop.id); if (!cancelled) setStopArrivals(arrivals); }
      catch (error) { console.error('Failed to load stop arrivals:', error); if (!cancelled) setStopArrivals(null); }
    };
    void load();
    const refresh = window.setInterval(load, 30_000);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, [selectedStop?.id]);

  // Filter routes based on search
  const filteredRoutes = routes.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.stops.some(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Premium Theme styling helpers
  const bgClass = theme === 'dark' ? 'bg-[#090514]' : 'bg-white';
  const cardClass = theme === 'dark' ? 'bg-[#130f22] border-zinc-800/80' : 'bg-zinc-50 border-zinc-200';
  const textClass = theme === 'dark' ? 'text-zinc-200' : 'text-zinc-900';
  const textMutedClass = theme === 'dark' ? 'text-zinc-450' : 'text-zinc-500';
  const borderClass = theme === 'dark' ? 'border-zinc-800/60' : 'border-zinc-200';
  const highlightText = theme === 'dark' ? 'text-purple-400' : 'text-indigo-650';
  const highlightBg = theme === 'dark' ? 'bg-purple-950/40 text-purple-400 border border-purple-900/50' : 'bg-indigo-50 border border-indigo-100 text-indigo-650';

  return (
    <div className={`flex flex-col h-screen w-full overflow-hidden relative transition-colors duration-300 ${bgClass} ${textClass}`}>

      {activeTab === 'home' && !selectedStop ? (
        <div className="relative flex-1 w-full h-full overflow-hidden">
          {/* Map Viewport (Fills entire background) */}
          <div className="absolute inset-0 w-full h-full z-0">
            <RealMap
              stops={selectedRoute?.stops || []}
              polyline={selectedRoute?.polyline}
              activeTrip={activeTrip}
              height="100%"
            />
          </div>

          {/* Sliding Bottom Sheet */}
          <div 
            className={`absolute left-0 right-0 bottom-0 z-20 border-t rounded-t-[32px] shadow-2xl transition-all duration-500 ease-out flex flex-col ${
              sheetExpanded ? 'h-[78vh]' : 'h-[36vh]'
            } ${
              theme === 'dark' ? 'bg-[#130f22]/95 border-zinc-800/80 backdrop-blur-md' : 'bg-white/95 border-zinc-200 backdrop-blur-md'
            }`}
          >
            {/* Drag Handle Indicator / Toggle Button */}
            <button 
              onClick={() => setSheetExpanded(!sheetExpanded)}
              className="w-full py-3 flex flex-col items-center justify-center cursor-pointer focus:outline-none"
            >
              <div className={`w-12 h-1 rounded-full mb-1 ${theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300'}`}></div>
              <span className={`text-[9px] font-bold tracking-widest uppercase ${textMutedClass}`}>
                {sheetExpanded ? 'Tap to view map' : 'Tap to view checkpoints'}
              </span>
            </button>

            {/* Bottom Sheet Inner Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-24 space-y-5">
              
              {/* Route Summary Bar */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="bg-indigo-600 text-white font-extrabold text-xs px-2.5 py-1.5 rounded-xl">221</span>
                  <div>
                    <h3 className={`text-sm font-extrabold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Route 221</h3>
                    <p className={`text-[10px] font-medium ${textMutedClass}`}>Regency Anatam ➔ Kalyan</p>
                  </div>
                </div>
                {activeTrip ? (
                  <span className="flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2.5 py-0.5 rounded-full border border-green-105">
                    <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
                    Live tracking
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-450 font-bold bg-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-200">
                    Idle
                  </span>
                )}
              </div>

              {/* Quick ETA / Status Card (Shows in Collapsed View) */}
              {!sheetExpanded && activeTrip && (
                <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-fadeIn ${cardClass}`}>
                  <div>
                    <p className={`text-[9px] font-bold uppercase tracking-wider ${textMutedClass}`}>Next stop</p>
                    <h4 className={`text-sm font-extrabold mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                      {selectedRoute?.stops.find((stop) => stop.id === liveEta?.stopId)?.name || selectedRoute?.stops[activeTrip.currentStopIndex + 1]?.name || 'Terminus'}
                    </h4>
                  </div>
                  <div className="text-right">
                    <p className={`text-[9px] font-bold uppercase tracking-wider ${textMutedClass}`}>ETA</p>
                    <h4 className={`text-lg font-black ${highlightText}`}>
                      {liveEta ? `${liveEta.etaMinutes} min` : activeTrip.stopsLeft > 0 ? `${activeTrip.stopsLeft * 3} min` : 'Arrived'}
                    </h4>
                  </div>
                </div>
              )}

              {/* Timeline Checkpoints */}
              <div className="space-y-3">
                <h3 className={`text-[10px] font-extrabold uppercase tracking-widest ${textMutedClass}`}>
                  Checkpoint Timeline
                </h3>
                
                {selectedRoute ? (
                  <div className="space-y-4 relative pl-2">
                    {selectedRoute.stops.map((stop, index) => {
                      const isPassed = activeTrip ? index < activeTrip.currentStopIndex : false;
                      const isCurrent = activeTrip ? index === activeTrip.currentStopIndex : index === 0;
                      const isUpcoming = activeTrip ? index > activeTrip.currentStopIndex : index > 0;
                      
                      // Calculate individual ETA
                      let stopEta = '';
                      if (activeTrip && isUpcoming) {
                        const diff = index - activeTrip.currentStopIndex;
                        stopEta = liveEta?.stopId === stop.id ? `in ${liveEta.etaMinutes} min` : `in ${diff * 3} min`;
                      } else if (isPassed) {
                        stopEta = 'Passed';
                      } else if (isCurrent) {
                        stopEta = 'Arriving';
                      }

                      return (
                        <div key={stop.id} className="flex items-start gap-4 relative pb-5 last:pb-0">
                          {/* Timeline vertical line */}
                          {index < selectedRoute.stops.length - 1 && (
                            <div className={`absolute left-[9px] top-3.5 -bottom-6 w-[2px] ${
                              isPassed ? 'bg-indigo-500' : (theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200')
                            }`} />
                          )}
                          
                          {/* Checkpoint Dot */}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 z-10 transition-all duration-300 ${
                            isPassed 
                              ? 'bg-indigo-650 border-indigo-600' 
                              : isCurrent 
                              ? (theme === 'dark' ? 'bg-[#130f22] border-green-500' : 'bg-white border-green-500') 
                              : (theme === 'dark' ? 'bg-[#130f22] border-zinc-700' : 'bg-white border-zinc-300')
                          }`}>
                            {isPassed && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            {isCurrent && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                          </div>

                          {/* Stop Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-xs font-bold transition-colors ${
                              isPassed 
                                ? 'text-zinc-400 line-through decoration-zinc-300' 
                                : isCurrent 
                                ? (theme === 'dark' ? 'text-white' : 'text-zinc-950')
                                : (theme === 'dark' ? 'text-zinc-300' : 'text-zinc-800')
                            }`}>
                              {stop.name}
                            </h4>
                            <p className={`text-[9px] ${textMutedClass}`}>Code: {stop.code}</p>
                          </div>

                          {/* Stop ETA Tag */}
                          {stopEta && (
                            <span className={`text-[10px] font-bold ${
                              isCurrent ? 'text-green-600' : isPassed ? 'text-zinc-400' : highlightText
                            }`}>
                              {stopEta}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`text-xs ${textMutedClass}`}>No stops configured</p>
                )}
              </div>

            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 pb-24">
          
          {/* SCREEN 1: ROUTE SEARCH & SELECT */}
          {activeTab === 'routes' && !selectedStop && (
            <div className="space-y-5 animate-fadeIn">
              {/* Search Bar */}
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-zinc-450">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  placeholder="Search routes or stops"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full border rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none transition shadow-sm ${
                    theme === 'dark' ? 'bg-[#130f22] border-zinc-800 text-white placeholder-zinc-500 focus:border-purple-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500'
                  }`}
                />
              </div>

              {/* Favorite Routes */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className={`text-sm font-semibold ${textMutedClass}`}>Favorite Routes</h2>
                  <button className={`text-xs font-semibold hover:underline ${highlightText}`}>See All</button>
                </div>

                <div className="space-y-3">
                  {filteredRoutes.map(route => {
                    const isFav = favorites.includes(route.id);
                    return (
                      <div 
                        key={route.id}
                        onClick={() => handleRouteClick(route.id)}
                        className={`rounded-2xl p-4 flex justify-between items-center cursor-pointer transition shadow-sm border ${
                          theme === 'dark' ? 'bg-[#130f22] border-zinc-800 hover:border-purple-500/30' : 'bg-zinc-50 border-zinc-200 hover:border-indigo-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-indigo-600 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg">
                            {route.id.split('-')[1]}
                          </div>
                          <div>
                            <h4 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{route.name}</h4>
                            <p className={`text-[10px] ${textMutedClass}`}>Every {route.frequencyMinutes} mins</p>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(route.id);
                          }}
                          className={`p-1.5 rounded-full ${isFav ? 'text-yellow-500' : 'text-zinc-400 hover:text-zinc-550'}`}
                        >
                          <Star size={16} fill={isFav ? "currentColor" : "none"} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stops list search results */}
              <div className="space-y-3">
                <h2 className={`text-sm font-semibold ${textMutedClass}`}>Stops</h2>
                <div className={`rounded-2xl divide-y border shadow-sm ${
                  theme === 'dark' ? 'bg-[#130f22] border-zinc-800 divide-zinc-800' : 'bg-zinc-50 border-zinc-200 divide-zinc-250/60'
                }`}>
                  {routes.flatMap(r => r.stops).filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5).map(stop => (
                    <div 
                      key={stop.id}
                      onClick={() => handleStopClick(stop)}
                      className={`p-4 flex justify-between items-center cursor-pointer transition ${
                        theme === 'dark' ? 'hover:bg-zinc-900/40' : 'hover:bg-zinc-100/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin size={16} className={textMutedClass} />
                        <div>
                          <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{stop.name}</p>
                          <p className={`text-[10px] ${textMutedClass}`}>Code: {stop.code}</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className={textMutedClass} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 2: STOP DETAILS */}
          {selectedStop && (
            <div className="space-y-6 animate-fadeIn">
              {/* Back header */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedStop(null)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                    theme === 'dark' ? 'bg-[#130f22] border border-zinc-800 text-zinc-350 hover:text-white' : 'bg-zinc-50 border border-zinc-200 text-zinc-650 hover:text-zinc-900'
                  }`}
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h1 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{selectedStop.name}</h1>
                  <p className={`text-[10px] ${textMutedClass}`}>Stop Code: {selectedStop.code}</p>
                </div>
                <button 
                  onClick={() => toggleFavorite(selectedStop.id)}
                  className={`ml-auto p-1.5 rounded-full ${favorites.includes(selectedStop.id) ? 'text-yellow-500' : 'text-zinc-400 hover:text-zinc-550'}`}
                >
                  <Star size={18} fill={favorites.includes(selectedStop.id) ? "currentColor" : "none"} />
                </button>
              </div>

              {/* Upcoming buses */}
              <div className="space-y-3">
                <h2 className={`text-xs font-semibold uppercase tracking-wider ${textMutedClass}`}>Upcoming Buses</h2>
                <div className="space-y-3">
                  {(stopArrivals?.live || []).map((arrival) => {
                    const route = routes.find((candidate) => candidate.id === selectedStop.routeId);
                    if (!route) return null;
                    return (
                      <div key={arrival.tripId} className={`rounded-2xl p-4 flex justify-between items-center shadow-sm border ${cardClass}`}>
                        <div className="flex items-center gap-3">
                          <div className="bg-indigo-600 text-white font-black text-xs px-2.5 py-1.5 rounded-lg">
                            {route.id.split('-')[1]}
                          </div>
                          <div>
                            <h4 className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{route.name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Signal size={10} className="text-green-500" />
                              <span className={`text-[9px] ${textMutedClass}`}>{arrival.confidence} confidence · {arrival.occupancyBand}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{arrival.etaMinutes} min</div>
                          <div className={`text-[9px] ${textMutedClass}`}>{arrival.delayMinutes > 0 ? `${arrival.delayMinutes} min late` : 'Approaching'}</div>
                        </div>
                      </div>
                    );
                  })}
                  {stopArrivals && stopArrivals.live.length === 0 && <p className={`text-xs ${textMutedClass}`}>No live bus is currently approaching this stop. Check the timetable below.</p>}
                  {stopArrivals?.timetable.filter((item) => item.status === 'scheduled').slice(0, 2).map((item) => <p key={item.scheduledTripId} className={`text-xs ${textMutedClass}`}>Scheduled {new Date(item.plannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>)}
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 3: ALERTS & ANNOUNCEMENTS */}
          {activeTab === 'alerts' && (
            <div className="space-y-4 animate-fadeIn">
              <h1 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Service Announcements</h1>
              {announcements.map(ann => (
                <div key={ann.id} className={`rounded-2xl p-4 space-y-3 shadow-sm border ${cardClass}`}>
                  <div className="flex items-center gap-2 text-indigo-600">
                    <ShieldAlert size={18} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Official Broadcast</span>
                  </div>
                  <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>{ann.message}</p>
                  <div className={`text-[9px] pt-1 border-t ${borderClass} ${textMutedClass}`}>
                    Posted on {new Date(ann.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SCREEN 4: USER PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col items-center py-6 space-y-3">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500 shadow-sm">
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80" alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Aditya (GrowSphere)</h2>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${highlightBg}`}>Passenger Account</span>
              </div>

              <div className={`rounded-2xl p-4 divide-y shadow-sm border ${
                theme === 'dark' ? 'bg-[#130f22] border-zinc-800 divide-zinc-800' : 'bg-zinc-50 border-zinc-200 divide-zinc-200'
              }`}>
                <div className="py-3 flex justify-between items-center cursor-pointer">
                  <span className={`text-sm ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>My Favorites</span>
                  <span className={`text-xs ${textMutedClass}`}>{favorites.length} saved</span>
                </div>
                <div className="py-3 flex justify-between items-center cursor-pointer">
                  <span className={`text-sm ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>Notification Settings</span>
                  <span className="text-xs text-green-600 font-semibold">Enabled</span>
                </div>
                <div className="py-3 flex justify-between items-center cursor-pointer">
                  <span className={`text-sm ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>Help & Support</span>
                  <ChevronRight size={14} className={textMutedClass} />
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Navigation Bar */}
      <div className={`fixed bottom-0 left-0 right-0 border-t py-3 px-6 flex justify-around items-center z-30 backdrop-blur-md shadow-lg transition-colors duration-300 ${
        theme === 'dark' ? 'bg-[#090514]/95 border-zinc-800/80 text-zinc-300' : 'bg-white/95 border-zinc-200 text-zinc-800'
      }`}>
        <button 
          onClick={() => { setActiveTab('home'); setSelectedStop(null); }}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'home' ? highlightText : 'text-zinc-450 hover:text-zinc-650'
          }`}
        >
          <Compass size={20} />
          <span className="text-[9px] font-medium">Home</span>
        </button>

        <button 
          onClick={() => { setActiveTab('routes'); setSelectedStop(null); }}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'routes' ? highlightText : 'text-zinc-450 hover:text-zinc-650'
          }`}
        >
          <Search size={20} />
          <span className="text-[9px] font-medium">Routes</span>
        </button>

        <button 
          onClick={() => { setActiveTab('alerts'); setSelectedStop(null); }}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'alerts' ? highlightText : 'text-zinc-450 hover:text-zinc-650'
          }`}
        >
          <ShieldAlert size={20} />
          <span className="text-[9px] font-medium">Alerts</span>
        </button>

        <button 
          onClick={() => { setActiveTab('profile'); setSelectedStop(null); }}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'profile' ? highlightText : 'text-zinc-450 hover:text-zinc-650'
          }`}
        >
          <User size={20} />
          <span className="text-[9px] font-medium">Profile</span>
        </button>
      </div>

    </div>
  );
};
export default PassengerApp;
