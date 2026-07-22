"use client";

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from '../components/AppContext';
import { PassengerApp } from '../components/PassengerApp';
import { DriverApp } from '../components/DriverApp';
import { ConductorApp } from '../components/ConductorApp';
import { AdminApp } from '../components/AdminApp';
import { Compass, Shield, ArrowRightLeft, Cpu, Settings, Sun, Moon } from 'lucide-react';

function HomeContent() {
  const { activeRole, setActiveRole, theme, setTheme } = useApp();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-white"></div>;
  }

  return (
    <div className={`min-h-screen flex flex-col relative transition-colors duration-300 ${
      theme === 'dark' ? 'bg-[#090514] text-zinc-100' : 'bg-white text-zinc-900'
    }`}>
      
      {/* Active App Viewport Container (Fills the entire screen) */}
      <div className="flex-1 w-full h-screen relative overflow-hidden">
        {activeRole === 'passenger' && <PassengerApp />}
        {activeRole === 'driver' && <DriverApp />}
        {activeRole === 'conductor' && <ConductorApp />}
        {activeRole === 'admin' && <AdminApp />}
      </div>

      {/* Floating Theme Toggle (Subtle sun/moon icon) */}
      <button 
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className={`fixed bottom-20 right-16 z-[9999] w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition ${
          theme === 'dark' ? 'bg-zinc-800 text-yellow-400 border border-zinc-700' : 'bg-zinc-900 text-white'
        }`}
        title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      {/* Floating Role Switcher Trigger (Subtle button in corner) */}
      <button 
        onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
        className="fixed bottom-20 right-4 z-[9999] w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition"
        title="Switch User Role"
      >
        <Settings size={18} className={showRoleSwitcher ? "rotate-45 transition" : ""} />
      </button>

      {/* Role Switcher Menu Popup */}
      {showRoleSwitcher && (
        <div className={`fixed bottom-32 right-4 z-[9999] border p-3 rounded-2xl shadow-xl flex flex-col gap-2 animate-fadeIn w-48 ${
          theme === 'dark' ? 'bg-[#130f22] border-zinc-800 text-zinc-150 shadow-indigo-950/20' : 'bg-white border-zinc-200 text-zinc-800'
        }`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider px-2 mb-1 ${
            theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
          }`}>Switch Viewport Role</p>
          <button 
            onClick={() => { setActiveRole('passenger'); setShowRoleSwitcher(false); }}
            className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition ${
              activeRole === 'passenger' 
                ? (theme === 'dark' ? 'bg-indigo-950/70 text-indigo-400' : 'bg-indigo-50 text-indigo-600') 
                : (theme === 'dark' ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-50')
            }`}
          >
            <Compass size={14} /> Passenger
          </button>
          <button 
            onClick={() => { setActiveRole('driver'); setShowRoleSwitcher(false); }}
            className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition ${
              activeRole === 'driver' 
                ? (theme === 'dark' ? 'bg-indigo-950/70 text-indigo-400' : 'bg-indigo-50 text-indigo-600') 
                : (theme === 'dark' ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-50')
            }`}
          >
            <Cpu size={14} /> Driver
          </button>
          <button 
            onClick={() => { setActiveRole('conductor'); setShowRoleSwitcher(false); }}
            className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition ${
              activeRole === 'conductor' 
                ? (theme === 'dark' ? 'bg-indigo-950/70 text-indigo-400' : 'bg-indigo-50 text-indigo-600') 
                : (theme === 'dark' ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-50')
            }`}
          >
            <ArrowRightLeft size={14} /> Conductor
          </button>
          <button 
            onClick={() => { setActiveRole('admin'); setShowRoleSwitcher(false); }}
            className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition ${
              activeRole === 'admin' 
                ? (theme === 'dark' ? 'bg-indigo-950/70 text-indigo-400' : 'bg-indigo-50 text-indigo-600') 
                : (theme === 'dark' ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-50')
            }`}
          >
            <Shield size={14} /> Admin
          </button>
        </div>
      )}

    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <HomeContent />
    </AppProvider>
  );
}
