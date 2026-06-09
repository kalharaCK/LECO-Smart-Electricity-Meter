import React, { useState } from 'react';
import { Bell, Shield, User, Zap, Mail, Smartphone, Settings as SettingsIcon, MapPin, Hash, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Settings() {
  const [activeTab, setActiveTab] = useState<'alerts' | 'meter' | 'profile'>('alerts');
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-50 tracking-tight">System Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account and smart meter configurations.</p>
      </div>

      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl overflow-hidden">
        <div className="flex border-b border-[#1f1f1f] overflow-x-auto">
          <button 
            onClick={() => setActiveTab('alerts')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'alerts' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-slate-900/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Alerts & Notifications
          </button>
          <button 
            onClick={() => setActiveTab('meter')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'meter' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-slate-900/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Meter Configuration
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'profile' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-slate-900/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Account Profile
          </button>
        </div>

        <div className="p-6 space-y-8">
          {activeTab === 'alerts' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-5 uppercase tracking-wider">Usage Alerts</h3>
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="flex space-x-4">
                      <div className="p-2 bg-slate-900 rounded-lg shrink-0">
                        <Bell className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">High Usage Warning</p>
                        <p className="text-sm text-slate-500 mt-0.5">Get notified when real-time usage exceeds 5.0 kW.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  <div className="flex items-start justify-between">
                    <div className="flex space-x-4">
                      <div className="p-2 bg-slate-900 rounded-lg shrink-0">
                        <Zap className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">Peak Tariff Alert</p>
                        <p className="text-sm text-slate-500 mt-0.5">Receive an alert when transitioning to high-cost peak hours.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              <hr className="border-[#1f1f1f]" />

              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-5 uppercase tracking-wider">Notification Methods</h3>
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="flex space-x-4">
                      <div className="p-2 bg-slate-900 rounded-lg shrink-0">
                        <Mail className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">Email Notifications</p>
                        <p className="text-sm text-slate-500 mt-0.5">{user?.name}@example.lanka.com</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  <div className="flex items-start justify-between">
                    <div className="flex space-x-4">
                      <div className="p-2 bg-slate-900 rounded-lg shrink-0">
                        <Smartphone className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">Push & SMS</p>
                        <p className="text-sm text-slate-500 mt-0.5">+94 77 123 4567</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'meter' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-5 uppercase tracking-wider">Device Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-800 rounded-xl bg-slate-900/30">
                    <div className="flex items-center mb-3 text-slate-400">
                      <Hash className="w-4 h-4 mr-2" />
                      <span className="text-xs uppercase tracking-wider font-semibold">Meter ID</span>
                    </div>
                    <div className="font-mono text-lg text-slate-200">{user?.meterId || '#LM-9920-X1'}</div>
                  </div>
                  
                  <div className="p-4 border border-slate-800 rounded-xl bg-slate-900/30">
                    <div className="flex items-center mb-3 text-slate-400">
                      <SettingsIcon className="w-4 h-4 mr-2" />
                      <span className="text-xs uppercase tracking-wider font-semibold">Firmware Version</span>
                    </div>
                    <div className="font-mono text-lg text-emerald-500">v2.4.1-stable</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-semibold text-slate-400">Telemetry Sync Interval</label>
                  <select className="bg-[#050505] border border-slate-800 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-3">
                    <option>Real-time (1s)</option>
                    <option defaultValue="true">Standard (5s)</option>
                    <option>Economy (30s)</option>
                    <option>Batch (1m)</option>
                  </select>
                  <p className="text-xs text-slate-500">Faster sync uses more bandwidth but provides smoother real-time graphs.</p>
                </div>
              </div>
              
              <div className="p-5 border border-amber-500/20 bg-amber-500/5 rounded-xl flex space-x-4 items-start">
                 <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                 <div>
                   <h4 className="text-sm font-bold text-amber-500">Remote Disconnect Protocol</h4>
                   <p className="text-xs text-slate-400 mt-1">Your meter supports remote main-breaker disconnect for emergency situations. This feature is currently disabled by CEB administrator policy.</p>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
               <div className="flex items-center p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
                 <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xl font-bold uppercase shrink-0 border border-emerald-500/30">
                   {user?.name?.[0] || 'U'}
                 </div>
                 <div className="ml-5">
                   <h2 className="text-xl font-bold text-slate-50">{user?.name || 'Admin User'}</h2>
                   <p className="text-slate-500 text-sm flex items-center mt-1">
                     <MapPin className="w-3.5 h-3.5 mr-1" /> Colombo, Sri Lanka
                   </p>
                 </div>
               </div>

               <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Full Name</label>
                     <input type="text" className="w-full bg-[#050505] border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors" defaultValue={user?.name || 'Admin User'} />
                   </div>
                   <div>
                     <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Email Address</label>
                     <input type="email" className="w-full bg-[#050505] border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors" defaultValue={`${user?.name || 'admin'}@example.lanka.com`} />
                   </div>
                 </div>
                 
                 <div>
                   <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Service Address</label>
                   <textarea rows={3} className="w-full bg-[#050505] border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors resize-none" defaultValue="42/A Galle Road, Kollupitiya&#10;Colombo 03&#10;Sri Lanka 00300" />
                 </div>

                 <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                   <button className="flex items-center text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors">
                     <Key className="w-4 h-4 mr-2" /> Change Password
                   </button>
                   <button className="text-sm font-semibold text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-lg hover:bg-emerald-500/20 transition-colors">
                     Update Profile
                   </button>
                 </div>
               </form>
            </div>
          )}
        </div>
        <div className="bg-slate-900/50 p-6 border-t border-[#1f1f1f] flex justify-end">
          <button className="px-6 py-2 bg-emerald-500 text-neutral-950 font-bold uppercase tracking-wider text-sm rounded-lg hover:bg-emerald-400 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
