"use client";

import React, { useState } from 'react';
import { Filter, Map, FileText, Send, Plus, GripVertical } from 'lucide-react';
import { useApp } from './AppContext';
import dynamic from 'next/dynamic';
const RealMap = dynamic(() => import('./RealMap'), { ssr: false });

export const AdminApp: React.FC = () => {
  const { routes, trips, remarks, broadcastAnnouncement, addStop, theme } = useApp();
  const [activeTab, setActiveTab] = useState<'fleet' | 'routes' | 'broadcast'>('fleet');
  
  // Routes manager states
  const [selectedRouteId, setSelectedRouteId] = useState('route-221');
  const [newStopName, setNewStopName] = useState('');
  const [showAddStopForm, setShowAddStopForm] = useState(false);

  // Broadcast announcement states
  const [audience, setAudience] = useState('all');
  const [broadcastMsg, setBroadcastMsg] = useState('Due to heavy rain, buses may experience delays. Please plan your travel accordingly.');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const selectedRoute = routes.find(r => r.id === selectedRouteId) || routes[0];

  const handleBroadcast = () => {
    broadcastAnnouncement(broadcastMsg, audience === 'all' ? undefined : audience);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const handleAddStopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStopName.trim() || !selectedRoute) return;
    
    // Add simulated coordinates offset slightly from the last stop
    const lastStop = selectedRoute.stops[selectedRoute.stops.length - 1];
    const newLat = lastStop ? lastStop.location.lat + 0.005 : 19.2022;
    const newLng = lastStop ? lastStop.location.lng - 0.005 : 73.1196;

    addStop(selectedRouteId, newStopName, { lat: newLat, lng: newLng });
    setNewStopName('');
    setShowAddStopForm(false);
  };

  // Premium Theme classes
  const bgClass = theme === 'dark' ? 'bg-[#090514]' : 'bg-white';
  const cardClass = theme === 'dark' ? 'bg-[#130f22] border-zinc-800/80' : 'bg-zinc-50 border-zinc-200';
  const textClass = theme === 'dark' ? 'text-zinc-200' : 'text-zinc-900';
  const textMutedClass = theme === 'dark' ? 'text-zinc-450' : 'text-zinc-500';
  const borderClass = theme === 'dark' ? 'border-zinc-800/60' : 'border-zinc-200';
  const highlightText = theme === 'dark' ? 'text-purple-400' : 'text-indigo-650';

  // A network/CORS failure must not crash the entire admin role while route
  // data is unavailable.
  if (!selectedRoute) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-6 text-center ${bgClass} ${textClass}`}>
        <div className={`max-w-sm rounded-2xl border p-5 ${cardClass}`}>
          <h1 className="text-lg font-bold">Fleet data is unavailable</h1>
          <p className={`mt-2 text-sm ${textMutedClass}`}>Check the backend connection and CORS configuration, then reload this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full overflow-hidden relative transition-colors duration-300 ${bgClass} ${textClass}`}>

      {/* Scrollable Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-5 pb-24 space-y-6">
        
        {/* SCREEN 1: DASHBOARD / FLEET MAP */}
        {activeTab === 'fleet' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-zinc-950'}`}>Live Fleet</h1>
                <p className={`text-xs ${textMutedClass}`}>All Buses</p>
              </div>
              <button className={`w-10 h-10 rounded-xl flex items-center justify-center transition shadow-sm border ${
                theme === 'dark' ? 'bg-[#130f22] border-zinc-850 text-zinc-400 hover:text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:text-zinc-900'
              }`}>
                <Filter size={18} />
              </button>
            </div>

            {/* Live Map */}
            <RealMap
              stops={selectedRoute.stops}
              polyline={selectedRoute.polyline}
              activeTrip={trips[0]}
              height="300px"
            />

            {/* Bottom Stats Grid */}
            <div className={`rounded-2xl p-4 shadow-sm border ${cardClass}`}>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className={`text-xl font-extrabold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>127</p>
                  <p className={`text-[9px] font-bold mt-1 ${textMutedClass}`}>Active Buses</p>
                </div>
                <div className={`border-l ${borderClass}`}>
                  <p className="text-xl font-extrabold text-red-650">12</p>
                  <p className={`text-[9px] font-bold mt-1 ${textMutedClass}`}>Delayed</p>
                </div>
                <div className={`border-l ${borderClass}`}>
                  <p className="text-xl font-extrabold text-amber-600">5</p>
                  <p className={`text-[9px] font-bold mt-1 ${textMutedClass}`}>Off Route</p>
                </div>
                <div className={`border-l ${borderClass}`}>
                  <p className="text-xl font-extrabold text-red-700">3</p>
                  <p className={`text-[9px] font-bold mt-1 ${textMutedClass}`}>Breakdown</p>
                </div>
              </div>
            </div>

            {/* Remarks Log */}
            <div className="space-y-3">
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${textMutedClass}`}>Remarks Log</h3>
              <div className="space-y-2">
                {remarks.slice(0, 3).map(rem => (
                  <div key={rem.id} className={`p-3 rounded-xl flex items-center justify-between shadow-sm border animate-fadeIn ${cardClass}`}>
                    <div>
                      <p className={`text-xs font-bold capitalize ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{rem.tag}</p>
                      <p className={`text-[10px] ${textMutedClass}`}>{rem.message}</p>
                    </div>
                    <span className={`text-[9px] font-medium ${textMutedClass}`}>
                      {new Date(rem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 2: MANAGER */}
        {activeTab === 'routes' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Dropdown Selector */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-zinc-950'}`}>Route {selectedRoute.id.split('-')[1]}</h1>
                <p className={`text-xs ${textMutedClass}`}>{selectedRoute.name}</p>
              </div>
              <select 
                value={selectedRouteId}
                onChange={e => setSelectedRouteId(e.target.value)}
                className={`border rounded-xl px-3 py-1.5 text-xs focus:outline-none transition ${
                  theme === 'dark' ? 'bg-[#130f22] border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                }`}
              >
                {routes.map(r => (
                  <option key={r.id} value={r.id}>Route {r.id.split('-')[1]}</option>
                ))}
              </select>
            </div>

            {/* Segment control tabs */}
            <div className={`p-1 rounded-xl shadow-sm border flex ${cardClass}`}>
              <button className={`flex-1 py-2 text-xs font-bold text-center rounded-lg text-white shadow-sm ${
                theme === 'dark' ? 'bg-purple-650' : 'bg-indigo-650'
              }`}>
                Stops
              </button>
              <button 
                onClick={() => setActiveTab('fleet')}
                className={`flex-1 py-2 text-xs font-medium text-center rounded-lg ${textMutedClass} hover:text-zinc-900`}
              >
                Map View
              </button>
            </div>

            {/* Reorderable list */}
            <div className={`rounded-2xl divide-y border shadow-sm ${
              theme === 'dark' ? 'bg-[#130f22] border-zinc-800 divide-zinc-800' : 'bg-zinc-50 border-zinc-200 divide-zinc-200'
            }`}>
              {selectedRoute.stops.map((stop, idx) => (
                <div key={stop.id} className={`p-4 flex items-center justify-between transition ${
                  theme === 'dark' ? 'hover:bg-zinc-905/30' : 'hover:bg-zinc-100/30'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center border ${
                      theme === 'dark' ? 'bg-purple-950/40 text-purple-400 border-purple-900/40' : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{stop.name}</p>
                      <p className={`text-[10px] ${textMutedClass}`}>Stop Code: {stop.code}</p>
                    </div>
                  </div>
                  <button className="text-zinc-400 hover:text-zinc-650 cursor-grab active:cursor-grabbing">
                    <GripVertical size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Stop Button & Form */}
            {showAddStopForm ? (
              <form onSubmit={handleAddStopSubmit} className={`rounded-2xl p-4 space-y-3 border ${cardClass}`}>
                <input
                  type="text"
                  placeholder="Enter stop name"
                  value={newStopName}
                  onChange={e => setNewStopName(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-2 text-xs focus:outline-none transition ${
                    theme === 'dark' ? 'bg-zinc-900 border-zinc-805 text-white placeholder-zinc-500 focus:border-purple-500' : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-indigo-505'
                  }`}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddStopForm(false)}
                    className={`flex-1 py-2 rounded-lg text-xs border ${
                      theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm"
                  >
                    Save Stop
                  </button>
                </div>
              </form>
            ) : (
              <button 
                onClick={() => setShowAddStopForm(true)}
                className={`w-full py-3.5 rounded-2xl border font-extrabold text-xs tracking-wider flex items-center justify-center gap-1.5 transition shadow-sm ${
                  theme === 'dark' ? 'bg-purple-950/20 hover:bg-purple-900/10 border-purple-900/40 text-purple-400' : 'bg-indigo-50 hover:bg-indigo-100/80 border-indigo-100 text-indigo-650'
                }`}
              >
                <Plus size={14} />
                ADD STOP
              </button>
            )}
          </div>
        )}

        {/* SCREEN 3: BROADCAST */}
        {activeTab === 'broadcast' && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Broadcast</h1>
              <p className={`text-xs ${textMutedClass}`}>Send announcement to users</p>
            </div>

            <div className={`rounded-2xl p-5 space-y-4 border ${cardClass}`}>
              <div>
                <label className={`text-[10px] font-bold uppercase block mb-1 ${textMutedClass}`}>Audience</label>
                <select
                  value={audience}
                  onChange={e => setAudience(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500/50 transition ${
                    theme === 'dark' ? 'bg-[#130f22] border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                  }`}
                >
                  <option value="all">All Users</option>
                  <option value="route-221">Route 221 Subscribers</option>
                  <option value="route-118">Route 118 Subscribers</option>
                </select>
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase block mb-1 ${textMutedClass}`}>Message</label>
                <textarea
                  value={broadcastMsg}
                  onChange={e => setBroadcastMsg(e.target.value)}
                  rows={4}
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500/50 leading-relaxed transition ${
                    theme === 'dark' ? 'bg-[#130f22] border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                  }`}
                />
              </div>
            </div>

            <button 
              onClick={handleBroadcast}
              className={`w-full py-4 rounded-2xl font-extrabold text-xs tracking-wider flex items-center justify-center gap-2 shadow-sm transition text-white ${
                theme === 'dark' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              <Send size={14} />
              BROADCAST NOW
            </button>

            {showSuccessToast && (
              <div className="bg-green-50 border border-green-150 text-green-600 p-3 rounded-xl text-center text-xs font-semibold animate-fadeIn">
                Announcement broadcasted successfully!
              </div>
            )}
          </div>
        )}

      </div>

      {/* Navigation bar */}
      <div className={`fixed bottom-0 left-0 right-0 border-t py-3 px-6 flex justify-around items-center z-30 backdrop-blur-md shadow-lg transition-colors duration-300 ${
        theme === 'dark' ? 'bg-[#090514]/95 border-zinc-800/80 text-zinc-300' : 'bg-white/95 border-zinc-200 text-zinc-800'
      }`}>
        <button 
          onClick={() => setActiveTab('fleet')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'fleet' ? highlightText : 'text-zinc-500'}`}
        >
          <Map size={20} />
          <span className="text-[9px] font-medium">Dashboard</span>
        </button>
        <button 
          onClick={() => setActiveTab('routes')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'routes' ? highlightText : 'text-zinc-500'}`}
        >
          <FileText size={20} />
          <span className="text-[9px] font-medium">Manager</span>
        </button>
        <button 
          onClick={() => setActiveTab('broadcast')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'broadcast' ? highlightText : 'text-zinc-500'}`}
        >
          <Send size={20} />
          <span className="text-[9px] font-medium">Broadcast</span>
        </button>
      </div>

    </div>
  );
};
export default AdminApp;
