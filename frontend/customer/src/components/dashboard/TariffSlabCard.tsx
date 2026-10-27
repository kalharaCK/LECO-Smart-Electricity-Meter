import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Layers, 
  ChevronRight, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  X
} from "lucide-react"

export interface TariffSlabInfo {
  tierName: string
  group: "Group A" | "Group B" | "Group C"
  currentKwh: number
  slabMin: number
  slabMax: number
  unitRate: number
  fixedCharge: number
  nextSlabThreshold: number | null
  unitsRemainingInSlab: number | null
  nextSlabRate: number | null
}

interface TariffSlabCardProps {
  currentMonthlyKwh: number
  tariffType?: string
}

/**
 * Calculates current PUCSL 2026 domestic block tariff tier and threshold indicators.
 */
export function getTariffTierDetails(kwh: number): TariffSlabInfo {
  const usage = Math.max(0, Number(kwh) || 0)

  if (usage <= 30) {
    return {
      tierName: "0 - 30 kWh (Lifeline Tier)",
      group: "Group A",
      currentKwh: usage,
      slabMin: 0,
      slabMax: 30,
      unitRate: 5.0,
      fixedCharge: 80.0,
      nextSlabThreshold: 30,
      unitsRemainingInSlab: Math.max(0, 30 - usage),
      nextSlabRate: 9.0,
    }
  }

  if (usage <= 60) {
    return {
      tierName: "31 - 60 kWh (Subsidized Tier)",
      group: "Group A",
      currentKwh: usage,
      slabMin: 31,
      slabMax: 60,
      unitRate: 9.0,
      fixedCharge: 210.0,
      nextSlabThreshold: 60,
      unitsRemainingInSlab: Math.max(0, 60 - usage),
      nextSlabRate: 20.0,
    }
  }

  if (usage <= 90) {
    return {
      tierName: "61 - 90 kWh (Standard Tier)",
      group: "Group B",
      currentKwh: usage,
      slabMin: 61,
      slabMax: 90,
      unitRate: 20.0,
      fixedCharge: 400.0,
      nextSlabThreshold: 90,
      unitsRemainingInSlab: Math.max(0, 90 - usage),
      nextSlabRate: 28.0,
    }
  }

  if (usage <= 120) {
    return {
      tierName: "91 - 120 kWh (Moderate Tier)",
      group: "Group B",
      currentKwh: usage,
      slabMin: 91,
      slabMax: 120,
      unitRate: 28.0,
      fixedCharge: 1000.0,
      nextSlabThreshold: 120,
      unitsRemainingInSlab: Math.max(0, 120 - usage),
      nextSlabRate: 44.0,
    }
  }

  if (usage <= 180) {
    return {
      tierName: "121 - 180 kWh (Higher Usage Tier)",
      group: "Group B",
      currentKwh: usage,
      slabMin: 121,
      slabMax: 180,
      unitRate: 44.0,
      fixedCharge: 1500.0,
      nextSlabThreshold: 180,
      unitsRemainingInSlab: Math.max(0, 180 - usage),
      nextSlabRate: 100.0,
    }
  }

  return {
    tierName: "Above 180 kWh (Peak Domestic Tier)",
    group: "Group C",
    currentKwh: usage,
    slabMin: 181,
    slabMax: 9999,
    unitRate: 100.0,
    fixedCharge: 2500.0,
    nextSlabThreshold: null,
    unitsRemainingInSlab: null,
    nextSlabRate: null,
  }
}

export const PUCSL_TARIFF_SLABS = [
  { group: "Group A", range: "0 - 30 kWh", rate: "LKR 5.00 / kWh", fixed: "LKR 80.00", desc: "Subsidized Lifeline consumption" },
  { group: "Group A", range: "31 - 60 kWh", rate: "LKR 9.00 / kWh", fixed: "LKR 210.00", desc: "Low domestic consumption" },
  { group: "Group B", range: "61 - 90 kWh", rate: "LKR 20.00 / kWh", fixed: "LKR 400.00", desc: "First 60 units @ LKR 14.00" },
  { group: "Group B", range: "91 - 120 kWh", rate: "LKR 28.00 / kWh", fixed: "LKR 1,000.00", desc: "Moderate domestic consumption" },
  { group: "Group B", range: "121 - 180 kWh", rate: "LKR 44.00 / kWh", fixed: "LKR 1,500.00", desc: "Upper domestic band" },
  { group: "Group C", range: "> 180 kWh", rate: "LKR 100.00 / kWh", fixed: "LKR 2,500.00", desc: "0-180 @ LKR 32.50, units >180 @ LKR 100.00" },
]

export default function TariffSlabCard({ currentMonthlyKwh, tariffType }: TariffSlabCardProps) {
  const [showTableModal, setShowTableModal] = useState(false)
  const tier = getTariffTierDetails(currentMonthlyKwh)

  // Progress within current slab
  let progressPercent = 100
  if (tier.nextSlabThreshold) {
    const rangeSpan = tier.slabMax - tier.slabMin + 1
    const consumedInRange = Math.max(0, tier.currentKwh - (tier.slabMin > 0 ? tier.slabMin - 1 : 0))
    progressPercent = Math.min(100, Math.max(5, Math.round((consumedInRange / rangeSpan) * 100)))
  }

  const isNearThreshold = tier.unitsRemainingInSlab !== null && tier.unitsRemainingInSlab <= 6 && tier.unitsRemainingInSlab > 0

  return (
    <>
      <Card className="bg-[#141416] border border-white/10 shadow-xl rounded-3xl p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider block">
                  PUCSL Tariff Slab
                </span>
                <h4 className="text-sm font-bold text-white">
                  {tier.group} • {tier.tierName}
                </h4>
              </div>
            </div>
            <Badge className="bg-amber-400/10 text-amber-300 border-amber-400/30 text-[10px] font-bold">
              {tariffType || "Domestic D-1"}
            </Badge>
          </div>

          {/* Active Unit Rate & Fixed Charge Pills */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <span className="text-[10px] text-white/50 font-medium block">Active Unit Rate</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-amber-400">Rs. {tier.unitRate.toFixed(2)}</span>
                <span className="text-[10px] text-white/40">/ kWh</span>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <span className="text-[10px] text-white/50 font-medium block">Monthly Fixed Charge</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-white">Rs. {tier.fixedCharge.toFixed(0)}</span>
                <span className="text-[10px] text-white/40">/ mo</span>
              </div>
            </div>
          </div>

          {/* Tier Threshold Visual Progress Bar */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60 font-medium">Cycle Consumption:</span>
              <span className="font-mono font-bold text-white">
                {tier.currentKwh.toFixed(1)} kWh
                {tier.nextSlabThreshold && (
                  <span className="text-white/40 font-normal"> / {tier.nextSlabThreshold} kWh cap</span>
                )}
              </span>
            </div>

            <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isNearThreshold 
                    ? "bg-gradient-to-r from-amber-400 to-red-500 animate-pulse" 
                    : "bg-gradient-to-r from-yellow-500 to-amber-400"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Threshold Advisory Alert */}
            {tier.unitsRemainingInSlab !== null ? (
              <div className={`p-2.5 rounded-xl border flex items-center justify-between text-[11px] ${
                isNearThreshold 
                  ? "bg-red-500/10 border-red-500/30 text-red-300" 
                  : "bg-white/[0.03] border-white/10 text-white/70"
              }`}>
                <div className="flex items-center gap-2">
                  {isNearThreshold ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  ) : (
                    <Info className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  )}
                  <span>
                    <strong>{tier.unitsRemainingInSlab.toFixed(1)} kWh</strong> until rate jumps to 
                    <strong className="text-amber-300"> Rs. {tier.nextSlabRate?.toFixed(2)}</strong>/unit
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                <span>Operating in maximum PUCSL domestic tier (&gt;180 kWh). Conserve energy to reduce peak bills.</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between">
          <span className="text-[11px] text-white/40">Official PUCSL Tariff Policy</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowTableModal(true)}
            className="text-xs text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 h-8 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <span>View All Slabs</span>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </Card>

      {/* PUCSL Domestic Tariff Schedule Modal */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121214] border border-white/20 rounded-3xl w-full max-w-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">PUCSL Domestic Tariff Slabs</h3>
                  <p className="text-xs text-white/50">LECO / CEB End-User Electricity Tariff Schedule</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {PUCSL_TARIFF_SLABS.map((slab, idx) => {
                const isCurrent = slab.range === tier.tierName.split(" (")[0] || (idx === 0 && tier.currentKwh <= 30) || (idx === 1 && tier.currentKwh > 30 && tier.currentKwh <= 60)
                return (
                  <div 
                    key={idx}
                    className={`p-3 rounded-2xl border transition-all ${
                      isCurrent
                        ? "bg-amber-400/10 border-amber-400/40 shadow-sm"
                        : "bg-white/[0.02] border-white/5 hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{slab.range}</span>
                        {isCurrent && (
                          <Badge className="bg-amber-400 text-black font-black text-[9px] px-1.5 py-0 h-4">
                            Current
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs font-black text-amber-400">{slab.rate}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-white/50">
                      <span>{slab.desc}</span>
                      <span className="text-white/70 font-mono">Fixed: {slab.fixed}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between">
              <span className="text-[11px] text-white/40 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Updated with PUCSL Standard Regulations
              </span>
              <Button
                type="button"
                onClick={() => setShowTableModal(false)}
                className="bg-white/10 hover:bg-white/15 text-white text-xs font-semibold h-8 px-4 rounded-xl cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
