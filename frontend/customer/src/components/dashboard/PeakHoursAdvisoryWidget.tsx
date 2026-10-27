import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Clock, 
  Flame, 
  Moon, 
  Sun, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Info
} from "lucide-react"

export type TimeOfUseZone = "PEAK" | "DAY" | "OFF_PEAK"

interface ApplianceGuidance {
  name: string
  recommendation: "shift" | "optimal" | "acceptable"
  savingTip: string
  powerDraw: string
}

const APPLIANCE_TIPS: ApplianceGuidance[] = [
  { name: "Water Pump / Motor", recommendation: "shift", savingTip: "Operate after 22:30 to avoid peak surcharge", powerDraw: "0.75 - 1.5 kW" },
  { name: "EV / Inverter Charging", recommendation: "shift", savingTip: "Schedule timer charging between 22:30 - 05:30", powerDraw: "2.0 - 7.0 kW" },
  { name: "Electric Ironing", recommendation: "shift", savingTip: "Shift batch ironing to daytime off-peak hours", powerDraw: "1.0 - 1.8 kW" },
  { name: "Washing Machine / Dryer", recommendation: "optimal", savingTip: "Run full wash cycles in the morning or overnight", powerDraw: "0.5 - 2.0 kW" },
]

export default function PeakHoursAdvisoryWidget() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTab, setActiveTab] = useState<"status" | "appliances">("status")

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Calculate current TOU zone based on Sri Lanka PUCSL / LECO window
  // Peak: 18:30 (6:30 PM) to 22:30 (10:30 PM)
  // Day: 05:30 (5:30 AM) to 18:30 (6:30 PM)
  // Off-Peak: 22:30 (10:30 PM) to 05:30 (5:30 AM)
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
  const peakStart = 18 * 60 + 30 // 1110 mins
  const peakEnd = 22 * 60 + 30   // 1350 mins
  const dayStart = 5 * 60 + 30    // 330 mins

  let currentZone: TimeOfUseZone = "OFF_PEAK"
  let nextTransitionText = ""
  let countdownMinutes = 0

  if (currentMinutes >= peakStart && currentMinutes < peakEnd) {
    currentZone = "PEAK"
    countdownMinutes = peakEnd - currentMinutes
    const hours = Math.floor(countdownMinutes / 60)
    const mins = countdownMinutes % 60
    nextTransitionText = `${hours > 0 ? `${hours}h ` : ""}${mins}m until Off-Peak (22:30)`
  } else if (currentMinutes >= dayStart && currentMinutes < peakStart) {
    currentZone = "DAY"
    countdownMinutes = peakStart - currentMinutes
    const hours = Math.floor(countdownMinutes / 60)
    const mins = countdownMinutes % 60
    nextTransitionText = `${hours > 0 ? `${hours}h ` : ""}${mins}m until Peak (18:30)`
  } else {
    currentZone = "OFF_PEAK"
    if (currentMinutes >= peakEnd) {
      countdownMinutes = (24 * 60 - currentMinutes) + dayStart
    } else {
      countdownMinutes = dayStart - currentMinutes
    }
    const hours = Math.floor(countdownMinutes / 60)
    const mins = countdownMinutes % 60
    nextTransitionText = `${hours > 0 ? `${hours}h ` : ""}${mins}m until Day (05:30)`
  }

  const isPeak = currentZone === "PEAK"
  const isOffPeak = currentZone === "OFF_PEAK"

  return (
    <Card className="bg-[#141416] border border-white/10 shadow-xl rounded-3xl p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between">
      <div 
        className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl pointer-events-none ${
          isPeak ? "bg-red-500/10" : isOffPeak ? "bg-emerald-500/10" : "bg-yellow-400/10"
        }`} 
      />

      <div className="space-y-4">
        {/* Header with Zone Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl border ${
              isPeak 
                ? "bg-red-500/10 text-red-400 border-red-500/30" 
                : isOffPeak 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                  : "bg-yellow-400/10 text-yellow-400 border-yellow-400/30"
            }`}>
              {isPeak ? <Flame className="h-4 w-4 animate-pulse" /> : isOffPeak ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </div>
            <div>
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider block">
                Time-of-Use Advisory
              </span>
              <h4 className="text-sm font-bold text-white">
                {isPeak ? "Peak Demand Window" : isOffPeak ? "Off-Peak Window" : "Day Tariff Window"}
              </h4>
            </div>
          </div>

          <Badge className={`text-[10px] font-bold ${
            isPeak 
              ? "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse" 
              : isOffPeak 
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                : "bg-yellow-400/10 text-yellow-300 border-yellow-400/30"
          }`}>
            {isPeak ? "HIGH TARIFF RATE" : isOffPeak ? "ECONOMICAL RATE" : "NORMAL RATE"}
          </Badge>
        </div>

        {/* Tab switch */}
        <div className="flex p-0.5 rounded-xl bg-white/5 border border-white/5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("status")}
            className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === "status" ? "bg-white/10 text-white shadow-xs" : "text-white/50 hover:text-white"
            }`}
          >
            Live Status & Hours
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("appliances")}
            className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === "appliances" ? "bg-white/10 text-white shadow-xs" : "text-white/50 hover:text-white"
            }`}
          >
            Smart Shift Tips
          </button>
        </div>

        {activeTab === "status" ? (
          <div className="space-y-3">
            {/* Countdown pill */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
              isPeak 
                ? "bg-red-500/10 border-red-500/30 text-red-300" 
                : isOffPeak 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
                  : "bg-white/5 border-white/10 text-white/80"
            }`}>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                <span className="font-semibold">{nextTransitionText}</span>
              </div>
              <span className="text-[10px] opacity-70 font-mono">
                {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            {/* Daily Schedule Segments */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider block">
                LECO Standard Daily Schedule
              </span>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className={`p-2 rounded-xl border ${
                  isOffPeak ? "bg-emerald-500/15 border-emerald-500/40" : "bg-white/[0.02] border-white/5 opacity-60"
                }`}>
                  <span className="text-[10px] text-emerald-400 font-bold block">22:30 - 05:30</span>
                  <span className="text-white font-medium">Off-Peak</span>
                </div>
                <div className={`p-2 rounded-xl border ${
                  currentZone === "DAY" ? "bg-yellow-400/15 border-yellow-400/40" : "bg-white/[0.02] border-white/5 opacity-60"
                }`}>
                  <span className="text-[10px] text-yellow-400 font-bold block">05:30 - 18:30</span>
                  <span className="text-white font-medium">Day (Standard)</span>
                </div>
                <div className={`p-2 rounded-xl border ${
                  isPeak ? "bg-red-500/20 border-red-500/40" : "bg-white/[0.02] border-white/5 opacity-60"
                }`}>
                  <span className="text-[10px] text-red-400 font-bold block">18:30 - 22:30</span>
                  <span className="text-white font-medium">Peak Demand</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {APPLIANCE_TIPS.map((app, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start justify-between gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">{app.name}</span>
                    <span className="text-[10px] text-white/40 font-mono">({app.powerDraw})</span>
                  </div>
                  <p className="text-[11px] text-white/60 mt-0.5">{app.savingTip}</p>
                </div>
                {isPeak && app.recommendation === "shift" ? (
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[9px] shrink-0">
                    Avoid Now
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px] shrink-0">
                    Safe to Run
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-white/5 mt-3 flex items-center justify-between text-[11px] text-white/40">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
          Shifting loads can save up to 22% monthly
        </span>
        <span className="font-mono text-white/60">CEB/LECO TOU</span>
      </div>
    </Card>
  )
}
