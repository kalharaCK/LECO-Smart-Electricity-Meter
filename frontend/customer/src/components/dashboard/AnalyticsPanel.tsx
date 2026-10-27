import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

/**
 * Displays analytics charts for the customer portal.
 * Fetches aggregated data from /api/analytics and renders a line chart of today's grid load.
 */
const AnalyticsPanel: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get('/api/analytics');
        setData(res.data.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="p-4 text-gray-500">Loading analytics…</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  const gridLoad = data?.grid?.today_grid_kwh ?? 0;
  const solarExport = data?.grid?.today_solar_export_kwh ?? 0;

  const chartData = {
    labels: ['Today'],
    datasets: [
      {
        label: 'Grid Load (kWh)',
        data: [gridLoad],
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
      },
      {
        label: 'Solar Export (kWh)',
        data: [solarExport],
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
      },
    ],
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md mt-4">
      <h2 className="text-xl font-semibold mb-2">Today's Energy Overview</h2>
      <Line data={chartData} />
      <div className="mt-2 text-sm text-gray-600">
        <p>Total Meters: {data?.meters?.total_meters ?? '-'} | Connected: {data?.meters?.connected_meters ?? '-'} | Balance: {data?.meters?.total_balance ?? '-'}
      </div>
    </div>
  );
};

export default AnalyticsPanel;
