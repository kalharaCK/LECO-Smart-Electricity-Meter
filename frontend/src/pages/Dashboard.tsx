import React, { useEffect, useState } from 'react';
import { StatCard } from '../components/StatCard';
import { LiveChart } from '../components/LiveChart';
import { Zap, DollarSign, Activity } from 'lucide-react';
import { mockAppliances } from '../utils/mockData';
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/usage/metrics', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const formatLKR = (amount: number) => {
    return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(amount).replace('LKR', 'Rs. ');
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Current Power"
          value={<>{metrics?.currentPower || 2.42} <span className="text-sm text-slate-500 font-normal">kW</span></>}
          icon={Zap}
          trend={{ value: 12, label: "vs last hr" }}
        />
        <StatCard
          title="Projected Cost (LKR)"
          value={metrics ? formatLKR(metrics.projectedCost) : "Rs. 0"}
          icon={DollarSign}
          trend={{ value: -4.2, label: "vs avg" }}
        />
        <StatCard
          title="Daily Peak"
          value={<>{metrics?.dailyPeak || 4.80} <span className="text-sm text-slate-500 font-normal">kW</span></>}
          icon={Zap}
          description="Peak: 18:42"
        />
        <StatCard
          title="Grid Status (CEB)"
          value={<span className="text-emerald-500">Optimal</span>}
          icon={Activity}
          description={<span className="text-emerald-500 flex items-center mt-1"><Activity className="w-3 h-3 mr-1" /> {metrics?.gridVoltage || 230.1}V / {metrics?.gridFrequency || 50.02}Hz</span>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-6 relative flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-200">Real-Time Consumption</h2>
              <span className="text-xs text-slate-500">Live Telemetry from Smart Meter</span>
            </div>
            <div className="text-xs bg-slate-800 text-emerald-500 font-bold px-3 py-1.5 rounded-lg flex items-center">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              LIVE SYNC
            </div>
          </div>
          <div className="flex-1 min-h-[300px] -ml-5">
            <LiveChart height="100%" showDetails={false} />
          </div>
        </div>

        <div className="bg-gray-900 border border-[#1f1f1f] rounded-2xl p-5 flex flex-col gap-5">
           <h3 className="text-base font-semibold text-slate-200 m-0">Billing Summary</h3>
           <div className="bg-[#0a0a0a] p-5 rounded-xl border border-[#1f1f1f]">
             <div className="text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">Current Balance</div>
             <div className="text-3xl font-bold text-slate-50">Rs. 25,350</div>
             <div className="text-[11px] text-slate-500 mt-2 font-medium">Due Date: Oct 12, 2023</div>
           </div>
           
           <button className="bg-emerald-500 hover:bg-emerald-400 transition-colors text-[#050505] font-bold py-3.5 rounded-xl w-full text-sm uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.2)]">
             Pay Now via CEB Portal
           </button>
           
           <div className="mt-auto border-t border-slate-800 pt-4">
             <div className="text-[11px] font-semibold text-slate-500 mb-3 uppercase tracking-wider">Auto-Pay Status</div>
             <div className="flex justify-between items-center bg-slate-800 px-4 py-2.5 rounded-lg border border-slate-700">
               <span className="text-[13px] text-slate-200 font-medium">Visa •••• 4242</span>
               <span className="text-[11px] font-bold text-emerald-500">ENABLED</span>
             </div>
           </div>
        </div>
      </div>
      
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-5">
        <h3 className="text-[14px] text-slate-400 font-bold mb-4 uppercase tracking-wider">Appliance Analytics (Top Consumers)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[2px] bg-[#1f1f1f] overflow-hidden rounded-xl border border-[#1f1f1f]">
          {mockAppliances.slice(0,4).map((appliance) => (
             <div key={appliance.id} className="bg-[#0a0a0a] p-4 flex justify-between items-center relative overflow-hidden transition-colors hover:bg-gray-900 border-b border-[#1f1f1f] lg:border-none">
               {appliance.status === 'On' && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-sm"></div>
               )}
               <span className="text-sm font-medium text-slate-200 pl-2">{appliance.name}</span>
               <span className="text-sm text-emerald-500 font-mono font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md">{appliance.powerKw.toFixed(2)} kW</span>
             </div>
          ))}
        </div>
      </div>
    </>
  );
}
