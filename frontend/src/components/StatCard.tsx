import React from 'react';
import { cn } from '../utils/cn';

interface StatCardProps {
  title: string;
  value: string | React.ReactNode;
  icon: React.ElementType;
  description?: string | React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export function StatCard({ title, value, icon: Icon, description, trend, className }: StatCardProps) {
  return (
    <div className={cn("bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[1px] text-slate-500 font-semibold">{title}</div>
        <Icon className="w-4 h-4 text-slate-500 hidden" />
      </div>
      
      <div className="mt-1">
        <div className="text-2xl font-semibold text-slate-50 flex items-baseline gap-1">
          {value}
        </div>
        
        {(description || trend) && (
          <div className={cn("text-xs mt-1 flex items-center gap-1", 
            trend 
              ? (trend.value < 0 ? "text-emerald-500" : "text-rose-500") 
              : "text-slate-500")}>
            {trend && (
              <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
            )}
            <span className={trend ? "" : "text-slate-500"}>{description || trend?.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
