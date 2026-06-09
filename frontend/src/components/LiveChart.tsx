import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { UsageData } from '../types';
import { generateInitialUsage } from '../utils/mockData';

interface LiveChartProps {
  height?: number | string;
  showDetails?: boolean;
  metric?: 'power' | 'voltage' | 'current';
}

export function LiveChart({ height = 300, showDetails = true, metric = 'power' }: LiveChartProps) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    // Generate initial specific metric data
    const initialRaw = generateInitialUsage();
    
    const initialData = initialRaw.map(item => {
      let val = item.kw;
      if (metric === 'voltage') {
         val = 230 + (Math.random() * 4 - 2);
      } else if (metric === 'current') {
         val = item.kw * 4.3; // Approx calculation for current
      }
      return {
        ...item,
        value: Number(val.toFixed(2))
      }
    });

    setData(initialData);

    const interval = setInterval(() => {
      setData(prev => {
        const newData = [...prev];
        const now = new Date();
        const lastVal = newData[newData.length - 1].value;
        
        let newVal = lastVal;
        
        if (metric === 'power') {
           let change = (Math.random() - 0.5) * 0.5;
           newVal = Math.max(0.5, Math.min(7.0, lastVal + change));
        } else if (metric === 'voltage') {
           let change = (Math.random() - 0.5) * 0.5;
           newVal = Math.max(225.0, Math.min(235.0, lastVal + change));
        } else if (metric === 'current') {
           let change = (Math.random() - 0.5) * 1.5;
           newVal = Math.max(2.0, Math.min(30.0, lastVal + change));
        }

        newData.push({
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: showDetails ? '2-digit' : undefined }),
          timestamp: now.getTime(),
          value: Number(newVal.toFixed(2))
        });

        // Keep last n items (e.g. 20 for simple view, 60 for detailed)
        if (newData.length > (showDetails ? 60 : 20)) {
          newData.shift();
        }

        return newData;
      });
    }, showDetails ? 2000 : 5000); // Update faster on detailed view

    return () => clearInterval(interval);
  }, [showDetails, metric]);

  const getMetricConfig = () => {
    switch (metric) {
      case 'voltage':
        return { color: '#3b82f6', unit: 'V', label: 'Voltage', gradient: 'colorVoltage' };
      case 'current':
        return { color: '#f59e0b', unit: 'A', label: 'Current', gradient: 'colorCurrent' };
      default:
        return { color: '#10b981', unit: 'kW', label: 'Power', gradient: 'colorKw' };
    }
  };

  const config = getMetricConfig();

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={config.gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={config.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            dy={10}
            minTickGap={30}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            domain={metric === 'voltage' ? [220, 240] : [0, 'dataMax + 1']}
          />
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f1f" />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #1f1f1f', color: '#f8fafc' }}
            itemStyle={{ color: config.color }}
            formatter={(value: number) => [`${value} ${config.unit}`, config.label]}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={config.color} 
            strokeWidth={3}
            fillOpacity={1} 
            fill={`url(#${config.gradient})`} 
            isAnimationActive={false} // Disable animation for live charts to prevent jitter
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
