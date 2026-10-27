import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Clock, 
  Flame, 
  Moon, 
  Sun,
  Sparkles
} from "lucide-react"

export type TimeOfUseZone = "PEAK" | "DAY" | "OFF_PEAK"

export default function PeakHoursAdvisoryWidget() {
  const [currentTime, setCurrentTime] = useState(new Date())

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
    <Card className="bg-[#141416] border border-white/10 shadow-xl rounded-3xl p-5 sm:p-6 relative overflow-hidden h-full flex flex-col justify-between">
      <div 
        className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl pointer-events-none ${
          isPeak ? "bg-red-500/10" : isOffPeak ? "bg-emerald-500/10" : "bg-yellow-400/10"
        }`} 
      />

      <div className="space-y-4">
        {/* Header with Zone Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border shrink-0 ${
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
            {isPeak ? "HIGH RATE" : isOffPeak ? "ECONOMICAL" : "NORMAL"}
          </Badge>
        </div>

        {/* Live Countdown Pill */}
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

        {/* 3-Window Daily Schedule Matrix */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className={`p-2.5 rounded-2xl border transition-all ${
            isOffPeak 
              ? "bg-emerald-500/15 border-emerald-500/40 shadow-xs" 
              : "bg-white/5 border-white/10 opacity-70"
          }`}>
            <span className="text-[10px] text-emerald-400 font-bold block">22:30 - 05:30</span>
            <span className="text-xs text-white font-medium block mt-0.5">Off-Peak</span>
          </div>
          <div className={`p-2.5 rounded-2xl border transition-all ${
            currentZone === "DAY" 
              ? "bg-yellow-400/15 border-yellow-400/40 shadow-xs" 
              : "bg-white/5 border-white/10 opacity-70"
          }`}>
            <span className="text-[10px] text-yellow-400 font-bold block">05:30 - 18:30</span>
            <span className="text-xs text-white font-medium block mt-0.5">Day Rate</span>
          </div>
          <div className={`p-2.5 rounded-2xl border transition-all ${
            isPeak 
              ? "bg-red-500/20 border-red-500/40 shadow-xs" 
              : "bg-white/5 border-white/10 opacity-70"
          }`}>
            <span className="text-[10px] text-red-400 font-bold block">18:30 - 22:30</span>
            <span className="text-xs text-white font-medium block mt-0.5">Peak Rate</span>
          </div>
        </div>

        {/* Actionable Shift Recommendation Tip */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-white/70 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          <span>
            {isPeak 
              ? "Avoid running high-draw appliances (pumps, irons) during peak window."
              : "Optimal time to run washing machines, EV chargers, and water pumps."}
          </span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-white/5 mt-auto flex items-center justify-between text-xs text-white/50">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-yellow-400" />
          <span>TOU Schedule Active</span>
        </span>
        <span className="font-mono text-white/70">PUCSL TOU</span>
      </div>
    </Card>
  )
}
