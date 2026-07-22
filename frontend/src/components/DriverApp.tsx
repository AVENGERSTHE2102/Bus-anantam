"use client";

import React, { useState, useEffect } from 'react';
import { Play, Square, AlertCircle, History, Map, ArrowRightLeft, MessageSquare, Compass } from 'lucide-react';
import { useApp } from './AppContext';
import { startDriverLocationTracking } from '@/lib/native';
import dynamic from 'next/dynamic';
const RealMap = dynamic(() => import('./RealMap'), { ssr: false });

export const DriverApp: React.FC = () => {
  const { routes, buses, trips, startTrip, endTrip, sendRemark, confirmConversion, theme, currentUser, emitDriverLocation, etaByTripId } = useApp();
  const [activeTab, setActiveTab] = useState<'shift' | 'remarks' | 'map' | 'history'>('shift');
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [etaFrom, setEtaFrom] = useState('My Location');
  const [etaTo, setEtaTo] = useState('Phoenix Mall Stop');
  const [showEtaResult, setShowEtaResult] = useState(false);

  // Find active driver trip
  const activeTrip = trips.find(t => t.driverId === currentUser?.id && (t.status === 'active' || t.status === 'arrived'));
  const liveEta = activeTrip ? etaByTripId[activeTrip.id] : undefined;

  const handleStartTrip = () => {
    const bus = buses[0];
    const route = routes[0];
    if (!bus || !route) return;
    startTrip(bus.id, route.id, '', currentUser?.id || 'demo-driver');
    setActiveTab('remarks');
  };

  // Android uses a foreground service with a persistent notification and a
  // native upload path; PWA browsers retain their normal foreground watcher.
  useEffect(() => {
    if (!activeTrip || activeTrip.status !== 'active') return;
    let cancelled = false;
    let stopWatching: () => void = () => {};

    void startDriverLocationTracking(
      activeTrip.id,
      ({ latitude, longitude, speed, heading }) => {
        const speedKmph = speed != null ? speed * 3.6 : 0;
        emitDriverLocation(activeTrip.id, latitude, longitude, speedKmph, heading || 0);
      },
      (message) => console.error('Geolocation error:', message),
    ).then((stop) => {
      if (cancelled) stop();
      else stopWatching = stop;
    });

    return () => {
      cancelled = true;
      stopWatching();
    };
  }, [activeTrip?.id, activeTrip?.status, emitDriverLocation]);

  const handleEndTrip = () => {
    if (activeTrip) {
      setShowConversionModal(true);
    }
  };

  const handleConfirmConversion = () => {
    if (activeTrip) {
      confirmConversion(activeTrip.id);
      setShowConversionModal(false);
      setActiveTab('remarks');
    }
  };

  const handleOverrideEndTrip = () => {
    if (activeTrip) {
      endTrip(activeTrip.id);
      setShowConversionModal(false);
      setActiveTab('shift');
    }
  };

  const quickRemarks: { tag: 'traffic' | 'accident' | 'roadblock' | 'breakdown'; label: string; bg: string; border: string; text: string }[] = [
    { tag: 'traffic', label: 'Heavy Traffic', bg: theme === 'dark' ? 'bg-orange-950/20' : 'bg-orange-50', border: theme === 'dark' ? 'border-orange-900/35' : 'border-orange-200', text: 'text-orange-500' },
    { tag: 'accident', label: 'Accident Ahead', bg: theme === 'dark' ? 'bg-red-950/20' : 'bg-red-50', border: theme === 'dark' ? 'border-red-900/35' : 'border-red-200', text: 'text-red-500' },
    { tag: 'roadblock', label: 'Road Blocked', bg: theme === 'dark' ? 'bg-amber-950/20' : 'bg-amber-50', border: theme === 'dark' ? 'border-amber-900/35' : 'border-amber-200', text: 'text-amber-500' },
    { tag: 'breakdown', label: 'Bus Breakdown', bg: theme === 'dark' ? 'bg-rose-950/20' : 'bg-rose-50', border: theme === 'dark' ? 'border-rose-900/35' : 'border-rose-200', text: 'text-rose-500' },
  ];

  // Premium Theme classes
  const bgClass = theme === 'dark' ? 'bg-[#090514]' : 'bg-white';
  const cardClass = theme === 'dark' ? 'bg-[#130f22] border-zinc-800/80' : 'bg-zinc-50 border-zinc-200';
  const textClass = theme === 'dark' ? 'text-zinc-200' : 'text-zinc-900';
  const textMutedClass = theme === 'dark' ? 'text-zinc-450' : 'text-zinc-500';
  const borderClass = theme === 'dark' ? 'border-zinc-800/60' : 'border-zinc-200';
  const highlightText = theme === 'dark' ? 'text-purple-400' : 'text-indigo-650';

  return (
    <div className={`flex flex-col h-full overflow-hidden relative transition-colors duration-300 ${bgClass} ${textClass}`}>

      {/* Scrollable Main Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-5 pb-24 space-y-6">
        
        {/* TAB 1: SHIFT / START TRIP & ETA CALCULATOR */}
        {activeTab === 'shift' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Driver Portal</h1>
                <p className={`text-xs ${textMutedClass}`}>Shift Management & ETA Calculator</p>
              </div>
              {activeTrip && (
                <span className="flex items-center gap-1.5 text-xs text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full border border-green-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  LIVE TRIP
                </span>
              )}
            </div>

            {/* Offline/Idle or Active Shift Prompt */}
            {!activeTrip ? (
              <div className={`rounded-2xl p-6 text-center space-y-4 shadow-sm border ${cardClass}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                  theme === 'dark' ? 'bg-purple-950/40 text-purple-400 border border-purple-900/40' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                }`}>
                  <Play size={24} />
                </div>
                <div>
                  <h3 className={`font-bold text-base ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Ready for your shift?</h3>
                  <p className={`text-xs max-w-xs mx-auto mt-1 ${textMutedClass}`}>Select Route 221 to start live location sharing and updates for passengers.</p>
                </div>
                <button 
                  onClick={handleStartTrip}
                  className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs tracking-wider transition shadow-sm"
                >
                  START TRIP
                </button>
              </div>
            ) : (
              <div className={`rounded-2xl p-5 space-y-4 shadow-sm border ${cardClass}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${textMutedClass}`}>Current Active Trip</p>
                    <h3 className={`text-lg font-extrabold mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Route 221</h3>
                  </div>
                  <button 
                    onClick={handleEndTrip}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs tracking-wider shadow-sm"
                  >
                    END TRIP
                  </button>
                </div>
              </div>
            )}
            
            {/* ETA Calculator Card */}
            <div className={`rounded-2xl p-5 space-y-4 shadow-sm border ${cardClass}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wider ${textMutedClass}`}>Calculate Next Stop ETA</h2>
              
              <div className="space-y-3">
                <div>
                  <label className={`text-[10px] font-semibold uppercase block mb-1 ${textMutedClass}`}>From</label>
                  <input 
                    type="text" 
                    value={etaFrom} 
                    onChange={e => setEtaFrom(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none transition ${
                      theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800 text-white focus:border-purple-500' : 'bg-white border-zinc-200 text-zinc-900 focus:border-indigo-500'
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-[10px] font-semibold uppercase block mb-1 ${textMutedClass}`}>To</label>
                  <input 
                    type="text" 
                    value={etaTo} 
                    onChange={e => setEtaTo(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none transition ${
                      theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800 text-white focus:border-purple-500' : 'bg-white border-zinc-200 text-zinc-900 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>

              <button 
                onClick={() => setShowEtaResult(true)}
                className={`w-full py-3 rounded-xl font-bold text-xs tracking-wider transition shadow-sm text-white ${
                  theme === 'dark' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                CALCULATE ETA
              </button>
            </div>

            {showEtaResult && (
              <div className={`rounded-2xl p-5 space-y-4 animate-fadeIn shadow-sm border ${
                theme === 'dark' ? 'bg-purple-950/20 border-purple-900/50' : 'bg-indigo-50 border-indigo-150'
              }`}>
                <div className="text-center">
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${highlightText}`}>Estimated Arrival</p>
                  <h3 className={`text-4xl font-black mt-1 ${theme === 'dark' ? 'text-purple-400' : 'text-indigo-700'}`}>07:31</h3>
                  <p className={`text-xs mt-1 ${textMutedClass}`}>at Phoenix Mall Stop</p>
                </div>
                <div className={`flex items-center justify-between px-4 pt-3 border-t ${borderClass}`}>
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
                  <div className="flex-1 h-[2px] bg-zinc-200 mx-2 relative">
                    <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-zinc-400"></div>
                    <div className="absolute top-1/2 left-2/3 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-zinc-400"></div>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-400"></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REMARKS & REPORTING */}
        {activeTab === 'remarks' && (
          <div className="space-y-6 animate-fadeIn">
            {activeTrip ? (
              <>
                {/* Live Indicator */}
                <div className={`flex justify-between items-center p-3.5 rounded-xl shadow-sm border ${cardClass}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-[10px] font-black text-white">221</div>
                    <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Bus 221</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-green-600 font-bold bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    LIVE
                  </span>
                </div>

                {/* Main Route Card */}
                <div className={`rounded-3xl p-6 text-white space-y-2 shadow-lg ${
                  theme === 'dark' ? 'bg-purple-950/40 border border-purple-900/40 shadow-purple-950/10' : 'bg-indigo-600 shadow-indigo-100/80'
                }`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Route</p>
                  <h2 className="text-3xl font-extrabold tracking-tight">221</h2>
                  <p className="text-sm text-indigo-100">Regency Anatam ➔ Kalyan</p>
                </div>

                {/* Next Stop Card */}
                <div className={`rounded-2xl p-5 space-y-4 shadow-sm border ${cardClass}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${textMutedClass}`}>Next Stop</p>
                      <h3 className={`text-xl font-bold mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                        {routes[0]?.stops.find((stop) => stop.id === liveEta?.stopId)?.name || routes[0]?.stops[activeTrip.currentStopIndex + 1]?.name || 'Terminus'}
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${textMutedClass}`}>ETA</p>
                      <h3 className={`text-xl font-extrabold mt-0.5 ${highlightText}`}>
                        {liveEta ? `${liveEta.etaMinutes} min` : activeTrip.stopsLeft > 0 ? `${activeTrip.stopsLeft * 3} min` : 'Arrived'}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Quick Remarks */}
                <div className="space-y-3">
                  <h3 className={`text-xs font-semibold uppercase tracking-wider ${textMutedClass}`}>Tap to Report remarks</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {quickRemarks.map(item => (
                      <button
                        key={item.tag}
                        onClick={() => sendRemark(activeTrip.id, item.tag, `${item.label} reported by Driver`)}
                        className={`${item.bg} ${item.border} border rounded-xl p-4 flex flex-col justify-between items-start h-20 text-left hover:scale-[1.02] transition shadow-sm`}
                      >
                        <AlertCircle size={18} className={item.text} />
                        <span className={`text-xs font-bold ${item.text}`}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* End Trip Action */}
                <button
                  onClick={handleEndTrip}
                  className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs tracking-wider flex items-center justify-center gap-2 shadow-md shadow-red-200/50"
                >
                  <Square size={16} fill="white" />
                  END TRIP
                </button>
              </>
            ) : (
              <div className={`rounded-2xl p-8 text-center space-y-4 border ${cardClass}`}>
                <p className={`text-xs ${textMutedClass}`}>No active trip right now. Start a trip from the Shift tab to report remarks.</p>
                <button 
                  onClick={() => setActiveTab('shift')}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  Go to Shift Tab
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LIVE MAP VIEW */}
        {activeTab === 'map' && (
          <div className="space-y-4 animate-fadeIn">
            <h1 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-950'}`}>Route 221 Live Map</h1>
            <RealMap
              stops={routes[0]?.stops || []}
              polyline={routes[0]?.polyline}
              activeTrip={activeTrip}
              height="360px"
            />
          </div>
        )}

        {/* TAB 4: TRIP HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h1 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Trip History</h1>
              <span className={`text-xs ${textMutedClass}`}>Today</span>
            </div>

            <div className="space-y-3">
              <div className={`rounded-2xl p-4 flex justify-between items-center shadow-sm border ${cardClass}`}>
                <div>
                  <h4 className={`font-bold text-base ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>221</h4>
                  <p className={`text-xs ${textMutedClass}`}>Regency Anatam ➔ Kalyan</p>
                  <p className={`text-[10px] mt-1 ${textMutedClass}`}>08:10 AM - 09:15 AM</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>32 km</p>
                  <p className={`text-[10px] ${textMutedClass}`}>1h 05m</p>
                </div>
              </div>

              <div className={`rounded-2xl p-4 flex justify-between items-center shadow-sm border ${cardClass}`}>
                <div>
                  <h4 className={`font-bold text-base ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>221R</h4>
                  <p className={`text-xs ${textMutedClass}`}>Kalyan ➔ Regency Anatam</p>
                  <p className={`text-[10px] mt-1 ${textMutedClass}`}>07:45 AM - 08:50 AM</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>33 km</p>
                  <p className={`text-[10px] ${textMutedClass}`}>1h 05m</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Confirmation Modal */}
      {showConversionModal && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className={`border rounded-3xl p-6 w-full max-w-sm space-y-6 text-center shadow-2xl animate-scaleUp ${
            theme === 'dark' ? 'bg-[#130f22] border-zinc-800' : 'bg-white border-zinc-200'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
              theme === 'dark' ? 'bg-purple-950/40 text-purple-400 border border-purple-900/40' : 'bg-indigo-50 text-indigo-650 border border-indigo-100'
            }`}>
              <ArrowRightLeft size={28} />
            </div>
            <div className="space-y-2">
              <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Trip Complete</h3>
              <p className={`text-xs ${textMutedClass}`}>Start next trip as Route 221R?</p>
            </div>
            <div className="space-y-3">
              <button 
                onClick={handleConfirmConversion}
                className={`w-full py-3.5 rounded-xl text-white font-extrabold text-xs tracking-wider transition ${
                  theme === 'dark' ? 'bg-purple-600 hover:bg-purple-750' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                YES, START 221R
              </button>
              <button 
                onClick={handleOverrideEndTrip}
                className={`w-full py-3.5 rounded-xl font-extrabold text-xs tracking-wider transition border ${
                  theme === 'dark' ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300' : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-600'
                }`}
              >
                OVERRIDE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver View Navigation Bar (Always Visible) */}
      <div className={`fixed bottom-0 left-0 right-0 border-t py-3 px-6 flex justify-around items-center z-30 backdrop-blur-md shadow-lg transition-colors duration-300 ${
        theme === 'dark' ? 'bg-[#090514]/95 border-zinc-800/80 text-zinc-300' : 'bg-white/95 border-zinc-200 text-zinc-800'
      }`}>
        <button 
          onClick={() => setActiveTab('shift')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'shift' ? highlightText : 'text-zinc-500'}`}
        >
          <Compass size={20} />
          <span className="text-[9px] font-medium">Shift</span>
        </button>
        <button 
          onClick={() => setActiveTab('remarks')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'remarks' ? highlightText : 'text-zinc-500'}`}
        >
          <MessageSquare size={20} />
          <span className="text-[9px] font-medium">Remarks</span>
        </button>
        <button 
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'map' ? highlightText : 'text-zinc-500'}`}
        >
          <Map size={20} />
          <span className="text-[9px] font-medium">Map</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'history' ? highlightText : 'text-zinc-500'}`}
        >
          <History size={20} />
          <span className="text-[9px] font-medium">History</span>
        </button>
      </div>

    </div>
  );
};
export default DriverApp;
