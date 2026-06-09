import React from 'react';
import { LayoutDashboard, Settings, Activity, FileText } from 'lucide-react';

const SidebarLayout = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-50">
          <h1 className="text-2xl font-bold tracking-tight text-emerald-600">LECO<span className="text-gray-800 text-sm ml-1 font-medium">SmartHub</span></h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active />
          <NavItem icon={<Activity size={20}/>} label="Live Usage" />
          <NavItem icon={<FileText size={20}/>} label="Reports" />
          <NavItem icon={<Settings size={20}/>} label="Settings" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, active }) => (
  <button className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${active ? 'bg-emerald-50 text-emerald-600 font-medium' : 'hover:bg-gray-50 text-gray-500 hover:text-gray-900'}`}>
    {icon}
    <span>{label}</span>
  </button>
);

export default SidebarLayout;