import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Activity, CreditCard, Settings, LogOut } from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Usage Analytics', href: '/realtime', icon: Activity },
  { name: 'Payment Hub', href: '/billing', icon: CreditCard },
  { name: 'Smart Alerts', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col w-[220px] h-screen bg-[#0a0a0a] border-r border-[#1f1f1f] text-slate-200">
      <div className="flex items-center h-[72px] px-6 shrink-0 select-none">
        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] mr-3 shrink-0" />
        <span className="font-bold text-[20px] tracking-tight text-emerald-500 flex-1 truncate">LUMINA 2.0</span>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors",
                isActive 
                  ? "bg-gray-900 text-emerald-500 font-semibold" 
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              )
            }
          >
            <item.icon className="w-[18px] h-[18px] mr-3 shrink-0" />
            {item.name}
          </NavLink>
        ))}
      </div>
      
      <div className="p-4 mt-auto">
        <div className="rounded-xl p-4 bg-gray-900 border border-slate-800 space-y-3">
          <div>
            <div className="text-[10px] text-slate-500 mb-1 font-bold tracking-wider uppercase">User / Meter ID</div>
            <div className="text-sm font-semibold text-slate-200 truncate">{user?.name || 'Admin'}</div>
            <div className="font-mono text-xs text-emerald-500 truncate mt-0.5">{user?.meterId || '#LM-9920-X1'}</div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center text-xs font-semibold text-slate-500 hover:text-rose-500 transition-colors w-full uppercase tracking-wider mt-2 group"
          >
            <LogOut className="w-3.5 h-3.5 mr-2 group-hover:-translate-x-1 transition-transform" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
