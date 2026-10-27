import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Zap, 
  Activity, 
  Gauge, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck 
} from "lucide-react"

interface PowerLoadGaugeProps {
  currentPowerKw?: number
  contractedDemandKw?: number
  voltage?: number
  frequency?: number
  powerFactor?: number
}

export default function PowerLoadGauge({
  currentPowerKw = 0.00,
  contractedDemandKw = 5.0,
  voltage = 230.4,
  frequency = 50.0,
  powerFactor = 0.96,
}: PowerLoadGaugeProps) {
  const activeKw = Math.max(0, currentPowerKw)
  const maxKw = Math.max(1, contractedDemandKw)
  const loadPercentage = Math.min(100, Math.round((activeKw / maxKw) * 100))

  // Voltage PUCSL compliance: 230V +/- 6% (216.2V - 243.8V)
  const isVoltageNormal = voltage >= 216 && voltage <= 244

  // Frequency PUCSL compliance: 50.0 Hz +/- 1% (49.5 - 50.5 Hz)
  const isFrequencyNormal = frequency >= 49.5 && frequency <= 50.5

  // Load Status Assessment
  let loadZone: "low" | "moderate" | "heavy" = "low"
  if (loadPercentage >= 80) {
    loadZone = "heavy"
  } else if (loadPercentage >= 40) {
    loadZone = "moderate"
  }

  // Semi-circle gauge calculation (radius = 65, semi-circumference = PI * 65 ≈ 204.2)
  const arcRadius = 65
  const arcLength = Math.PI * arcRadius
  const strokeOffset = arcLength * (1 - loadPercentage / 100)

  return (
    <Card className="bg-[#141416] border border-white/10 shadow-xl rounded-3xl p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between">
      <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-400/5 rounded-full blur-3xl pointer-events-none" />

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Gauge className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider block">
                Instantaneous Load & Grid
              </span>
              <h4 className="text-sm font-bold text-white">Active Power Demand</h4>
            </div>
          </div>
          <Badge className={`text-[10px] font-bold ${
            loadZone === "heavy" 
              ? "bg-red-500/20 text-red-300 border-red-500/40" 
              : loadZone === "moderate" 
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40" 
                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          }`}>
            {loadZone === "heavy" ? "Heavy Load" : loadZone === "moderate" ? "Normal Load" : "Low Demand"}
          </Badge>
        </div>

        {/* Semi-Circular Radial Load Gauge Visualizer */}
        <div className="flex flex-col items-center justify-center pt-2 relative">
          <svg className="w-48 h-28 overflow-visible" viewBox="0 0 160 90">
            <defs>
              <linearGradient id="loadGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="60%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>

            {/* Background Track Arc */}
            <path
              d="M 15 85 A 65 65 0 0 1 145 85"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="10"
              strokeLinecap="round"
            />

            {/* Active Load Progress Arc */}
            <path
              d="M 15 85 A 65 65 0 0 1 145 85"
              fill="none"
              stroke="url(#loadGaugeGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={arcLength}
              strokeDashoffset={strokeOffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Central Active Load Indicator Text */}
          <div className="text-center -mt-10">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {activeKw.toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-white/50">kW</span>
            </div>
            <span className="text-[10px] text-white/40 block">
              {loadPercentage}% of {maxKw.toFixed(1)} kW Contracted Cap
            </span>
          </div>
        </div>

        {/* 3-Pill Grid Quality & Compliance Telemetry Bar */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          {/* Voltage */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 text-center">
            <span className="text-[9px] text-white/50 font-medium uppercase tracking-wider block">Supply Voltage</span>
            <span className="text-xs font-extrabold text-white block mt-0.5">{voltage.toFixed(1)} V</span>
            <div className="flex items-center justify-center gap-1 mt-1 text-[9px]">
              {isVoltageNormal ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-amber-400" />
              )}
              <span className={isVoltageNormal ? "text-emerald-400" : "text-amber-400"}>
                {isVoltageNormal ? "Normal" : "Fluctuation"}
              </span>
            </div>
          </div>

          {/* Grid Frequency */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 text-center">
            <span className="text-[9px] text-white/50 font-medium uppercase tracking-wider block">Frequency</span>
            <span className="text-xs font-extrabold text-white block mt-0.5">{frequency.toFixed(1)} Hz</span>
            <div className="flex items-center justify-center gap-1 mt-1 text-[9px]">
              {isFrequencyNormal ? (
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-amber-400" />
              )}
              <span className={isFrequencyNormal ? "text-emerald-400" : "text-amber-400"}>
                {isFrequencyNormal ? "50 Hz Sync" : "Drift"}
              </span>
            </div>
          </div>

          {/* Power Factor */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 text-center">
            <span className="text-[9px] text-white/50 font-medium uppercase tracking-wider block">Power Factor</span>
            <span className="text-xs font-extrabold text-white block mt-0.5">{powerFactor.toFixed(2)}</span>
            <div className="flex items-center justify-center gap-1 mt-1 text-[9px]">
              <Zap className="h-3 w-3 text-cyan-400" />
              <span className="text-cyan-400">
                {powerFactor >= 0.90 ? "Optimal" : "Reactive"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-white/5 mt-3 flex items-center justify-between text-[11px] text-white/40">
        <span className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-cyan-400" />
          Single Phase 230V Domestic
        </span>
        <span className="font-mono text-white/60">30A Service</span>
      </div>
    </Card>
  )
}
