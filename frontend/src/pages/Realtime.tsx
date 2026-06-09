import React, { useState } from 'react';
import { LiveChart } from '../components/LiveChart';
import { Download, RefreshCw, BarChart2 } from 'lucide-react';

export function Realtime() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metric, setMetric] = useState<'power' | 'voltage' | 'current'>('power');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-50 tracking-tight">Live Energy Monitor</h1>
          <p className="text-slate-500 mt-1">High-frequency data direct from your smart meter.</p>
        </div>
        
        <div className="flex space-x-3">
          <button 
            onClick={handleRefresh}
            className="flex items-center px-4 py-2 border border-[#1f1f1f] bg-[#0a0a0a] hover:bg-[#111] text-slate-300 text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync
          </button>
          <button className="flex items-center px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-medium rounded-lg transition-colors shadow-sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-6 flex flex-col">
        <div className="flex items-center justify-between border-b border-[#1f1f1f] pb-4 mb-6">
          <div className="flex items-center space-x-2 text-emerald-500 font-medium">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] mr-2" />
            Recording live updates (every 2s)
          </div>
          
          <div className="flex items-center bg-gray-900 rounded-lg p-1 border border-[#1f1f1f]">
            <button 
              onClick={() => setMetric('power')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${metric === 'power' ? 'bg-slate-800 text-slate-50 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Power (kW)
            </button>
            <button 
              onClick={() => setMetric('voltage')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${metric === 'voltage' ? 'bg-slate-800 text-slate-50 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Voltage (V)
            </button>
            <button 
              onClick={() => setMetric('current')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${metric === 'current' ? 'bg-slate-800 text-slate-50 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Current (A)
            </button>
          </div>
        </div>
        
        <div className="flex-1 min-h-[400px]">
          <LiveChart height="100%" showDetails={true} metric={metric} />
        </div>
        
        <div className="mt-6 grid grid-cols-3 gap-6 pt-6 border-t border-[#1f1f1f]">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Peak Demand</p>
            <p className="text-xl font-semibold text-slate-100 flex items-baseline gap-1">4.2 <span className="text-sm font-normal text-slate-500">kW</span></p>
          </div>
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Average Load</p>
            <p className="text-xl font-semibold text-slate-100 flex items-baseline gap-1">1.8 <span className="text-sm font-normal text-slate-500">kW</span></p>
          </div>
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Power Factor</p>
            <p className="text-xl font-semibold text-slate-100 flex items-baseline gap-1">0.96</p>
          </div>
        </div>
      </div>
    </div>
  );
}
