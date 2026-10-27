import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { API_BASE_URL } from '@/lib/api';

/**
 * Displays analytics charts for the customer portal.
 * Fetches aggregated data from /api/analytics and renders an overview of today's grid load.
 */
const AnalyticsPanel: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/api/analytics`, {
          headers,
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to load analytics');
        const json = await res.json();
        setData(json.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="p-4 text-gray-400 text-xs">Loading analytics...</div>;
  if (error) return <div className="p-4 text-red-400 text-xs">{error}</div>;

  const gridLoad = data?.grid?.today_grid_kwh ?? 0;
  const solarExport = data?.grid?.today_solar_export_kwh ?? 0;

  const chartData = [
    {
      name: 'Today',
      'Grid Load (kWh)': gridLoad,
      'Solar Export (kWh)': solarExport,
    },
  ];

  return (
    <div className="p-5 bg-[#141416] border border-white/10 rounded-2xl shadow-xl mt-4 text-white">
      <h2 className="text-base font-bold mb-3 text-white">Today's Energy Overview</h2>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" stroke="#666" fontSize={11} />
            <YAxis stroke="#666" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '8px' }} />
            <Legend />
            <Bar dataKey="Grid Load (kWh)" fill="#facc15" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Solar Export (kWh)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 text-xs text-white/50 border-t border-white/5 pt-2">
        <p>
          Total Meters: {data?.meters?.total_meters ?? '-'} | Connected: {data?.meters?.connected_meters ?? '-'} | Balance: {data?.meters?.total_balance ?? '-'}
        </p>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
