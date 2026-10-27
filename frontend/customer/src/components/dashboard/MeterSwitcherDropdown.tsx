import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { 
  Building2, 
  ChevronDown, 
  Check, 
  PlusCircle, 
  Zap, 
  ShieldCheck 
} from "lucide-react"

export interface MeterOption {
  id: number
  meter_number: string
  account_number: string
  name?: string
  status?: string
  balance?: number | string
  tariff_type?: string
}

interface MeterSwitcherDropdownProps {
  onSelectMeter?: (meter: MeterOption) => void
  onAddMeter?: () => void
}

export default function MeterSwitcherDropdown({
  onSelectMeter,
  onAddMeter,
}: MeterSwitcherDropdownProps) {
  const [meters, setMeters] = useState<MeterOption[]>([])
  const [selectedMeterId, setSelectedMeterId] = useState<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchMeters = async () => {
      try {
        const token = localStorage.getItem("token")
        const headers: Record<string, string> = {}
        if (token) headers["Authorization"] = `Bearer ${token}`

        const res = await fetch("http://localhost:3000/api/meters", {
          headers,
          credentials: "include",
        })

        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            setMeters(data)
            const savedId = localStorage.getItem("active_meter_id")
            const found = data.find((m) => String(m.id) === savedId)
            const activeId = found ? found.id : data[0].id
            setSelectedMeterId(activeId)
            localStorage.setItem("active_meter_id", String(activeId))
          }
        }
      } catch (err) {
        console.error("Failed to load meter options:", err)
      }
    }

    void fetchMeters()
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const activeMeter = meters.find((m) => m.id === selectedMeterId) || meters[0]

  const handleSelect = (meter: MeterOption) => {
    setSelectedMeterId(meter.id)
    localStorage.setItem("active_meter_id", String(meter.id))
    setIsOpen(false)
    onSelectMeter?.(meter)
  }

  if (!activeMeter) {
    return null
  }

  const premiseLabel = activeMeter.name || `Premise #${activeMeter.account_number || activeMeter.id}`

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 transition-all rounded-xl py-1.5 px-2.5 sm:px-3 text-xs font-medium cursor-pointer"
        aria-label="Select premise meter"
      >
        <div className="p-1 rounded-lg bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 shrink-0">
          <Building2 className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col text-left leading-tight">
          <span className="text-[11px] font-bold text-white max-w-[110px] sm:max-w-[140px] truncate">
            {premiseLabel}
          </span>
          <span className="text-[9px] text-white/50 font-mono">
            {activeMeter.meter_number}
          </span>
        </div>
        <ChevronDown className={`h-3 w-3 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[#121214] border border-white/20 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
          <div className="px-2.5 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
              Connected Premises
            </span>
            <Badge className="bg-white/10 text-white/80 border-white/15 text-[9px] px-1.5 py-0">
              {meters.length} Active
            </Badge>
          </div>

          <div className="max-h-60 overflow-y-auto py-1 space-y-1">
            {meters.map((meter) => {
              const isCurrent = meter.id === activeMeter.id
              const meterBalance = Number(meter.balance ?? 0)

              return (
                <button
                  key={meter.id}
                  type="button"
                  onClick={() => handleSelect(meter)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isCurrent
                      ? "bg-yellow-400/10 border-yellow-400/40 text-white"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/15 text-white/70"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                      isCurrent ? "bg-yellow-400 text-black" : "bg-white/10 text-white/60"
                    }`}>
                      <Zap className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">
                          {meter.name || `Premise #${meter.account_number}`}
                        </span>
                        {isCurrent && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-mono mt-0.5">
                        <span>Meter: {meter.meter_number}</span>
                        <span>•</span>
                        <span className={meterBalance < 0 ? "text-amber-400" : "text-emerald-400 font-bold"}>
                          Rs. {meterBalance.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isCurrent && (
                    <div className="p-1 rounded-full bg-yellow-400/20 text-yellow-400 shrink-0 ml-2">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="pt-2 border-t border-white/10 mt-1 flex items-center justify-between px-1">
            <span className="text-[10px] text-white/40 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              LECO Verified Meters
            </span>
            {onAddMeter && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  onAddMeter()
                }}
                className="text-[11px] font-semibold text-yellow-400 hover:text-yellow-300 flex items-center gap-1 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-yellow-400/10 transition-colors"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Link Meter</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
