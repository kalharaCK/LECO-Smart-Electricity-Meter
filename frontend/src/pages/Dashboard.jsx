import React from 'react';
import { useMeterData } from '../hooks/useMeterData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap, Activity, Plug } from 'lucide-react';

const Dashboard = () => {
  const { currentData, dataHistory } = useMeterData();

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <header>
        <h2 className="text-3xl font-semibold text-gray-800">Overview</h2>
        <p className="text-gray-500 mt-1">Real-time consumption from your LECO smart meter.</p>
      </header>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Current Power" value={currentData.power} unit="kW" icon={<Zap className="text-yellow-500" />} />
        <StatCard title="Voltage" value={currentData.voltage} unit="V" icon={<Activity className="text-emerald-500" />} />
        <StatCard title="Amperage" value={currentData.current} unit="A" icon={<Plug className="text-blue-500" />} />
      </div>

      {/* Real-time Graph */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-medium text-gray-700 mb-6">Live Power Usage (kW)</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dataHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="power" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPower)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, unit, icon }) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <div className="flex items-baseline space-x-1">
        <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
        <span className="text-gray-500 font-medium">{unit}</span>
      </div>
    </div>
    <div className="p-4 bg-gray-50 rounded-full">
      {icon}
    </div>
  </div>
);

export default Dashboard;