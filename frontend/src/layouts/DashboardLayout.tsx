import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

export function DashboardLayout() {
  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden font-sans text-slate-200 selection:bg-emerald-500/30">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-[#050505]">
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
