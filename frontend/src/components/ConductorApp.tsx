"use client";

import React, { useState } from 'react';
import { Bus, Map, List, Info, Plus, Minus, ArrowRightLeft } from 'lucide-react';
import { useApp } from './AppContext';
import dynamic from 'next/dynamic';
const RealMap = dynamic(() => import('./RealMap'), { ssr: false });

export const ConductorApp: React.FC = () => {
  const { routes, buses, trips, sendRemark, savePassengerCount, confirmConversion, endTrip, manualCheckInStop, theme } = useApp();
  const [activeTab, setActiveTab] = useState<'map' | 'stops' | 'info' | 'remarks' | 'count'>('map');
  const [selectedBusId, setSelectedBusId] = useState('');
  const busId = selectedBusId || buses[0]?.id || '';
  const [isJoined, setIsJoined] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);
  
  // Remarks state
  const [remarkType, setRemarkType] = useState<'traffic' | 'accident' | 'roadblock' | 'breakdown'>('traffic');
  const [remarkDetails, setRemarkDetails] = useState('Heavy traffic due to construction work.');

  // Find current active trip
  const activeTrip = trips.find(t => t.busId === busId && (t.status === 'active' || t.status === 'arrived'));

  const handleJoinTrip = () => {
    setIsJoined(true);
  };

  const handleSendRemark = () => {
    if (activeTrip) {
      sendRemark(activeTrip.id, remarkType, remarkDetails);
      setActiveTab('map');
    }
  };

  const handleIncrementCount = () => {
    if (activeTrip) {
      savePassengerCount(activeTrip.id, activeTrip.passengerCount + 1);
    }
  };

  const handleDecrementCount = () => {
    if (activeTrip && activeTrip.passengerCount > 0) {
      savePassengerCount(activeTrip.id, activeTrip.passengerCount - 1);
    }
  };

  const handleEndTrip = () => {
    if (activeTrip) {
      setShowConversionModal(true);
    }
  };

  const handleConfirmConversion = () => {
    if (activeTrip) {
      confirmConversion(activeTrip.id);
      setShowConversionModal(false);
    }
  };

  const handleOverrideEndTrip = () => {
    if (activeTrip) {
      endTrip(activeTrip.id);
      setShowConversionModal(false);
    }
  };

  // Premium Theme classes
  const bgClass = theme === 'dark' ? 'bg-[#090514]' : 'bg-white';
  const cardClass = theme === 'dark' ? 'bg-[#130f22] border-zinc-800/80' : 'bg-zinc-50 border-zinc-200';
  const textClass = theme === 'dark' ? 'text-zinc-200' : 'text-zinc-900';
  const textMutedClass = theme === 'dark' ? 'text-zinc-450' : 'text-zinc-500';
  const borderClass = theme === 'dark' ? 'border-zinc-800/60' : 'border-zinc-200';
  const highlightText = theme === 'dark' ? 'text-purple-400' : 'text-indigo-650';

  return (
    <div className={`flex flex-col h-full overflow-hidden relative transition-colors duration-300 ${bgClass} ${textClass}`}>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-5 pb-24 space-y-6">
        
        {/* SCREEN 1: JOIN TRIP */}
        {(!isJoined || !activeTrip) && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Join Active Trip</h1>
              <p className={`text-xs ${textMutedClass}`}>Select bus to join</p>
            </div>

            <div className="space-y-3">
              <div 
                onClick={() => setSelectedBusId(busId)}
                className={`p-4 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                  selectedBusId === busId
                    ? (theme === 'dark' ? 'bg-purple-950/20 border-purple-500' : 'bg-indigo-50/50 border-indigo-500') 
                    : cardClass
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                    theme === 'dark' ? 'bg-purple-950/40 text-purple-400 border-purple-900/50' : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                  }`}>
                    <Bus size={20} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Bus 221</h4>
                    <p className={`text-[10px] ${textMutedClass}`}>Regency Anatam ➔ Kalyan</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      <span className={`text-[9px] ${textMutedClass}`}>Driver: Ramesh</span>
                    </div>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedBusId === busId ? (theme === 'dark' ? 'border-purple-450' : 'border-indigo-500') : 'border-zinc-300'
                }`}>
                  {selectedBusId === busId && <div className={`w-2.5 h-2.5 rounded-full ${theme === 'dark' ? 'bg-purple-450' : 'bg-indigo-500'}`} />}
                </div>
              </div>
            </div>

            <button 
              onClick={handleJoinTrip}
              className={`w-full py-4 rounded-2xl font-extrabold text-sm tracking-wider transition shadow-sm text-white ${
                theme === 'dark' ? 'bg-purple-600 hover:bg-purple-750' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {activeTrip ? 'JOIN TRIP' : 'WAITING FOR DRIVER TO START TRIP'}
            </button>
            {!activeTrip && (
              <p className={`text-center text-xs ${textMutedClass}`}>
                No active trip is assigned to this bus yet. The live shift will open automatically after the driver starts it.
              </p>
            )}
          </div>
        )}

        {/* SCREEN 2: ACTIVE LIVE TRIP VIEW */}
        {isJoined && activeTrip && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header info */}
            <div className={`flex justify-between items-center p-3 rounded-xl shadow-sm border ${cardClass}`}>
              <div className="flex items-center gap-2">
                <Bus size={16} className={highlightText} />
                <span className={`text-xs font-bold ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-900'}`}>Bus 221 (Conductor)</span>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2.5 py-0.5 rounded-full border border-green-105">
                <span className="w-1 h-1 rounded-full bg-green-505 animate-pulse"></span> Active
              </span>
            </div>

            {/* TAB VIEWS */}

            {/* Sub-tab 1: Map */}
            {activeTab === 'map' && (
              <div className="space-y-5">
                <div className={`rounded-3xl p-5 text-white space-y-2 shadow-sm ${
                  theme === 'dark' ? 'bg-purple-950/40 border border-purple-900/50' : 'bg-indigo-650'
                }`}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-200">Route</p>
                  <h2 className="text-2xl font-extrabold">221</h2>
                  <p className="text-xs text-indigo-100">Regency Anatam ➔ Kalyan</p>
                </div>

                <div className={`rounded-2xl p-4 space-y-4 shadow-sm border ${cardClass}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-[9px] font-bold uppercase ${textMutedClass}`}>Next Stop</p>
                      <h3 className={`text-lg font-bold mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Manpada Junction</h3>
                    </div>
                    <div className="text-right">
                      <p className={`text-[9px] font-bold ${textMutedClass}`}>ETA</p>
                      <h3 className={`text-lg font-bold mt-0.5 ${highlightText}`}>2 min</h3>
                    </div>
                  </div>
                  <div className={`pt-2 border-t ${borderClass} flex items-center`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <div className="flex-1 h-[2.5px] bg-indigo-105 mx-1.5 relative">
                      <span className="absolute top-1/2 left-1/4 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      <span className="absolute top-1/2 left-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      <span className="absolute top-1/2 left-3/4 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-zinc-300"></span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-300"></span>
                  </div>
                </div>

                <RealMap
                  stops={routes[0].stops}
                  polyline={routes[0].polyline}
                  activeTrip={activeTrip}
                  height="220px"
                />

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setActiveTab('remarks')}
                    className={`py-3 rounded-xl text-xs font-semibold shadow-sm border ${
                      theme === 'dark' ? 'bg-[#130f22] border-zinc-800 text-zinc-300 hover:text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-zinc-900'
                    }`}
                  >
                    Add Remark
                  </button>
                  <button 
                    onClick={() => setActiveTab('count')}
                    className={`py-3 rounded-xl text-xs font-semibold shadow-sm border ${
                      theme === 'dark' ? 'bg-[#130f22] border-zinc-800 text-zinc-300 hover:text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-zinc-900'
                    }`}
                  >
                    Passenger Count
                  </button>
                </div>

                <button 
                  onClick={handleEndTrip}
                  className="w-full py-3 rounded-xl bg-red-650 hover:bg-red-700 text-white font-extrabold text-xs tracking-wider shadow-sm"
                >
                  END TRIP
                </button>
              </div>
            )}

            {/* Sub-tab 2: Remarks */}
            {activeTab === 'remarks' && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Add Remark</h2>
                  <p className={`text-xs ${textMutedClass}`}>Send update to control center</p>
                </div>

                <div className={`rounded-2xl p-5 space-y-4 shadow-sm border ${cardClass}`}>
                  <div>
                    <label className={`text-[10px] font-bold uppercase block mb-1 ${textMutedClass}`}>Select Type</label>
                    <select 
                      value={remarkType}
                      onChange={e => setRemarkType(e.target.value as 'traffic' | 'accident' | 'roadblock' | 'breakdown')}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none transition ${
                        theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                      }`}
                    >
                      <option value="traffic">Traffic</option>
                      <option value="accident">Accident</option>
                      <option value="roadblock">Roadblock</option>
                      <option value="breakdown">Breakdown</option>
                    </select>
                  </div>

                  <div>
                    <label className={`text-[10px] font-bold uppercase block mb-1 ${textMutedClass}`}>Details (optional)</label>
                    <textarea 
                      value={remarkDetails}
                      onChange={e => setRemarkDetails(e.target.value)}
                      rows={3}
                      className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none leading-relaxed transition ${
                        theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white focus:border-purple-500' : 'bg-white border-zinc-200 text-zinc-900 focus:border-indigo-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`text-[10px] font-bold uppercase block mb-2 ${textMutedClass}`}>Add Photo</label>
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-xl border border-zinc-200 overflow-hidden relative">
                        <img 
                          src="https://images.unsplash.com/photo-1547841243-eacb14453cd9?auto=format&fit=crop&w=150&q=80" 
                          alt="Traffic preview" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className={`w-16 h-16 rounded-xl border border-dashed flex items-center justify-center text-zinc-400 cursor-pointer ${
                        theme === 'dark' ? 'border-zinc-850 hover:border-zinc-700' : 'border-zinc-200 hover:border-zinc-400'
                      }`}>
                        <Plus size={20} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setActiveTab('map')}
                    className={`py-3 rounded-xl text-xs font-bold border ${
                      theme === 'dark' ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400' : 'bg-zinc-50 border border-zinc-200 text-zinc-500'
                    }`}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSendRemark}
                    className={`py-3 rounded-xl text-white font-bold text-xs ${
                      theme === 'dark' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    SEND REMARK
                  </button>
                </div>
              </div>
            )}

            {/* Sub-tab 3: Count */}
            {activeTab === 'count' && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Passenger Count</h2>
                  <p className={`text-xs ${textMutedClass}`}>Update current count</p>
                </div>

                <div className={`rounded-3xl p-8 flex flex-col items-center justify-center space-y-6 border ${cardClass}`}>
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={handleDecrementCount}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shadow-sm border ${
                        theme === 'dark' ? 'bg-purple-950/40 text-purple-400 border-purple-900/50 hover:bg-purple-900/30' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100'
                      }`}
                    >
                      <Minus size={20} />
                    </button>
                    
                    <span className={`text-5xl font-black w-24 text-center tracking-tight ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                      {activeTrip.passengerCount}
                    </span>

                    <button 
                      onClick={handleIncrementCount}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition shadow-sm border ${
                        theme === 'dark' ? 'bg-purple-950/40 text-purple-400 border-purple-900/50 hover:bg-purple-900/30' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100'
                      }`}
                    >
                      <Plus size={20} />
                    </button>
                  </div>

                  <p className={`text-xs uppercase tracking-widest font-semibold ${textMutedClass}`}>Total Onboard</p>
                </div>

                <button 
                  onClick={() => setActiveTab('map')}
                  className={`w-full py-4 rounded-2xl font-extrabold text-sm tracking-wider transition shadow-sm text-white ${
                    theme === 'dark' ? 'bg-purple-600 hover:bg-purple-750' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  SAVE COUNT
                </button>
              </div>
            )}

            {/* Sub-tab 4: Stops timeline & Manual Check-in */}
            {activeTab === 'stops' && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Stops Timeline & Manual Check-in</h2>
                  <p className={`text-xs mt-0.5 ${textMutedClass}`}>If GPS location tracking fails, tap any stop to manually set the bus checkpoint.</p>
                </div>

                <div className={`rounded-2xl p-5 space-y-5 border ${cardClass}`}>
                  {routes[0].stops.map((stop, index) => {
                    const isPassed = index < activeTrip.currentStopIndex;
                    const isCurrent = index === activeTrip.currentStopIndex;
                    return (
                      <div key={stop.id} className="flex gap-4 items-center justify-between relative pb-5 last:pb-0">
                        {index < routes[0].stops.length - 1 && (
                          <div className={`absolute left-2.5 top-3.5 -bottom-6 w-[2px] ${
                            isPassed ? (theme === 'dark' ? 'bg-purple-500' : 'bg-indigo-500') : (theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200')
                          }`} />
                        )}
                        <div className="flex gap-3 items-start z-10">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 z-10 ${
                            isPassed 
                              ? (theme === 'dark' ? 'bg-purple-600 border-purple-500' : 'bg-indigo-600 border-indigo-500') 
                              : isCurrent 
                              ? (theme === 'dark' ? 'bg-[#130f22] border-indigo-400 animate-pulse' : 'bg-white border-indigo-400 animate-pulse') 
                              : (theme === 'dark' ? 'bg-[#130f22] border-zinc-700' : 'bg-white border-zinc-350')
                          }`}>
                            {isPassed && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            {isCurrent && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                          </div>
                          <div>
                            <h4 className={`text-sm font-semibold ${isPassed ? 'text-zinc-450' : (theme === 'dark' ? 'text-white' : 'text-zinc-900')}`}>{stop.name}</h4>
                            <p className={`text-[10px] ${textMutedClass}`}>Stop Code: {stop.code}</p>
                          </div>
                        </div>

                        {/* Manual Check-in Action Button */}
                        <div className="z-10">
                          {isCurrent ? (
                            <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-green-50 text-green-600 border border-green-200 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                              Current
                            </span>
                          ) : (
                            <button
                              onClick={() => manualCheckInStop(activeTrip.id, index)}
                              className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition shadow-sm ${
                                theme === 'dark' 
                                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-purple-400' 
                                  : 'bg-white hover:bg-indigo-50 border-zinc-200 text-indigo-600'
                              }`}
                            >
                              Check-in Here
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                  theme === 'dark' ? 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-300' : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-650'
                }`}
              >
                OVERRIDE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      {isJoined && activeTrip && (
        <div className={`fixed bottom-0 left-0 right-0 border-t py-3 px-6 flex justify-around items-center z-30 backdrop-blur-md shadow-lg transition-colors duration-300 ${
          theme === 'dark' ? 'bg-[#090514]/95 border-zinc-800/80 text-zinc-300' : 'bg-white/95 border-zinc-200 text-zinc-800'
        }`}>
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'map' ? highlightText : 'text-zinc-500'}`}
          >
            <Map size={20} />
            <span className="text-[9px] font-medium">Map</span>
          </button>
          <button 
            onClick={() => setActiveTab('stops')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'stops' ? highlightText : 'text-zinc-500'}`}
          >
            <List size={20} />
            <span className="text-[9px] font-medium">Stops</span>
          </button>
          <button 
            onClick={() => setActiveTab('info')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'info' ? highlightText : 'text-zinc-500'}`}
          >
            <Info size={20} />
            <span className="text-[9px] font-medium">Info</span>
          </button>
        </div>
      )}

    </div>
  );
};
export default ConductorApp;
