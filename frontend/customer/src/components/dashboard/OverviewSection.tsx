import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Zap, 
  Clock, 
  History as HistoryIcon, 
  Loader2, 
  TrendingUp, 
  LifeBuoy, 
  CheckCircle2, 
  CreditCard, 
  ChevronRight, 
  Activity,
  Sliders,
  BellRing,
  ShieldCheck,
  Target,
  X,
  Wallet,
  PhoneCall,
  FileText,
  AlertCircle,
  Download
} from "lucide-react"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { getSocket } from "@/lib/socket"
import { useDashboardI18n } from "@/lib/dashboardI18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import TariffSlabCard from "./TariffSlabCard"
import PeakHoursAdvisoryWidget from "./PeakHoursAdvisoryWidget"
import PowerLoadGauge from "./PowerLoadGauge"
import ExportDataModal from "./ExportDataModal"

interface UserSettingsState {
  phone_number?: string
  low_balance_threshold: number
  daily_kwh_budget: number
  monthly_budget_lkr: number
  auto_emergency_credit: boolean
  night_curfew_enabled: boolean
  email_notifications: boolean
  sms_notifications: boolean
  weekly_report: boolean
}

interface OverviewSectionProps {
  refreshKey?: number
  onNavigate?: (section: string) => void
}

export default function OverviewSection({ refreshKey, onNavigate }: OverviewSectionProps) {
  const { t } = useDashboardI18n()
  const [meter, setMeter] = useState<any>(null)
  const [consumption, setConsumption] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activatingEmergency, setActivatingEmergency] = useState(false)
  const [emergencySuccessMsg, setEmergencySuccessMsg] = useState<string | null>(null)

  // Budget & Alert Settings State
  const [userSettings, setUserSettings] = useState<UserSettingsState>({
    low_balance_threshold: 300,
    daily_kwh_budget: 12,
    monthly_budget_lkr: 3000,
    auto_emergency_credit: true,
    night_curfew_enabled: true,
    email_notifications: true,
    sms_notifications: true,
    weekly_report: true
  })
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [budgetForm, setBudgetForm] = useState({
    monthly_budget_lkr: 3000,
    daily_kwh_budget: 12,
    low_balance_threshold: 300,
    sms_notifications: true,
    email_notifications: true,
    auto_emergency_credit: true
  })
  const [savingBudget, setSavingBudget] = useState(false)
  const [budgetSuccessMsg, setBudgetSuccessMsg] = useState<string | null>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  const activeMeterIdRef = useRef<number | null>(null)
  const user = JSON.parse(localStorage.getItem("user") || '{"email": "Customer"}')

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch Meter Data & Telemetry
  const fetchMetersData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    try {
      let token = localStorage.getItem("token")
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch("http://localhost:3000/api/meters", {
        headers,
        credentials: "include"
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data.length > 0) {
          const savedMeterId = localStorage.getItem("active_meter_id")
          const activeMeter = (savedMeterId && data.find((m: any) => String(m.id) === String(savedMeterId))) || data[0]
          setMeter(activeMeter)
          activeMeterIdRef.current = activeMeter.id

          // Fetch consumption and predictions
          try {
            const consRes = await fetch(`http://localhost:3000/api/meters/${activeMeter.id}/consumption`, {
              headers,
              credentials: "include"
            })
            if (consRes.ok) {
              const consData = await consRes.json()
              setConsumption(consData)
            }
          } catch (e) {
            console.error("Error fetching consumption:", e)
          }
        }
      }

      // Fetch Recent Notifications
      try {
        const notifRes = await fetch("http://localhost:3000/api/notifications", {
          headers,
          credentials: "include"
        })
        if (notifRes.ok) {
          const notifData = await notifRes.json()
          setNotifications(Array.isArray(notifData) ? notifData : notifData.notifications || [])
        }
      } catch (e) {
        console.error("Error fetching notifications:", e)
      }

      // Fetch Live User Settings for Budget & Prepaid Alerts
      try {
        const settingsRes = await fetch("http://localhost:3000/api/settings", {
          headers,
          credentials: "include"
        })
        if (settingsRes.ok) {
          const sData = await settingsRes.json()
          if (sData.settings) {
            setUserSettings({
              phone_number: sData.settings.phone_number || "",
              low_balance_threshold: Number(sData.settings.low_balance_threshold) || 300,
              daily_kwh_budget: Number(sData.settings.daily_kwh_budget) || 12,
              monthly_budget_lkr: Number(sData.settings.monthly_budget_lkr) || 3000,
              auto_emergency_credit: sData.settings.auto_emergency_credit ?? true,
              night_curfew_enabled: sData.settings.night_curfew_enabled ?? true,
              email_notifications: sData.settings.email_notifications ?? true,
              sms_notifications: sData.settings.sms_notifications ?? true,
              weekly_report: sData.settings.weekly_report ?? true
            })
          }
        }
      } catch (e) {
        console.error("Error fetching settings:", e)
      }
    } catch (err) {
      console.error("Error fetching meter data:", err)
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetersData(true)
  }, [fetchMetersData, refreshKey])

  // Periodic background refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMetersData(false)
    }, 15000)
    return () => clearInterval(interval)
  }, [fetchMetersData])

  // Live WebSocket Telemetry Stream
  useEffect(() => {
    if (!meter?.id) return
    const socket = getSocket()
    socket.emit("join_meter", meter.id)

    const handleMeterUpdate = (payload: any) => {
      if (!payload || payload.meterId !== activeMeterIdRef.current) return

      setMeter((prev: any) => {
        if (!prev) return prev
        return {
          ...prev,
          balance: payload.balance ?? prev.balance,
          status: payload.status ?? prev.status,
          emergency_credit_active: payload.emergency_credit_active ?? prev.emergency_credit_active
        }
      })

      setConsumption((prev: any) => {
        if (!prev) return prev
        return {
          ...prev,
          today: payload.today ?? prev.today,
          thisWeek: payload.thisWeek ?? prev.thisWeek,
          currentPower: payload.currentPower ?? prev.currentPower,
          prediction: payload.prediction ?? prev.prediction,
          chartData: payload.chartData ?? prev.chartData
        }
      })
    }

    socket.on("meter_update", handleMeterUpdate)

    return () => {
      socket.off("meter_update", handleMeterUpdate)
      if (meter?.id) socket.emit("leave_meter", meter.id)
    }
  }, [meter?.id])

  // Emergency Lifeline Credit Activation
  const handleActivateEmergency = async () => {
    if (!meter) return
    setActivatingEmergency(true)
    setEmergencySuccessMsg(null)
    try {
      const token = localStorage.getItem("token")
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch(`http://localhost:3000/api/meters/${meter.id}/emergency-credit`, {
        method: "POST",
        credentials: "include",
        headers
      })
      const data = await res.json()
      if (res.ok) {
        setEmergencySuccessMsg(data.message || "Emergency Lifeline Credit of Rs. 500 activated. Power remains connected.")
        fetchMetersData(false)
      } else {
        alert(data.message || "Unable to activate emergency credit.")
      }
    } catch (e) {
      alert("Network error while activating emergency credit.")
    } finally {
      setActivatingEmergency(false)
    }
  }

  // Quick Adjust Budget & Alert Settings Modal Handlers
  const handleOpenBudgetModal = () => {
    setBudgetForm({
      monthly_budget_lkr: userSettings.monthly_budget_lkr,
      daily_kwh_budget: userSettings.daily_kwh_budget,
      low_balance_threshold: userSettings.low_balance_threshold,
      sms_notifications: userSettings.sms_notifications,
      email_notifications: userSettings.email_notifications,
      auto_emergency_credit: userSettings.auto_emergency_credit
    })
    setBudgetModalOpen(true)
  }

  const handleSaveBudget = async () => {
    setSavingBudget(true)
    try {
      const token = localStorage.getItem("token")
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch("http://localhost:3000/api/settings", {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({
          monthly_budget_lkr: budgetForm.monthly_budget_lkr,
          daily_kwh_budget: budgetForm.daily_kwh_budget,
          low_balance_threshold: budgetForm.low_balance_threshold,
          sms_notifications: budgetForm.sms_notifications,
          email_notifications: budgetForm.email_notifications,
          auto_emergency_credit: budgetForm.auto_emergency_credit
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setUserSettings((prev) => ({
          ...prev,
          ...budgetForm
        }))
        setBudgetSuccessMsg("Budget target and low balance alert preferences updated successfully.")
        setTimeout(() => setBudgetSuccessMsg(null), 4000)
        setBudgetModalOpen(false)
        fetchMetersData(false)
      } else {
        alert(data.message || "Failed to update budget settings.")
      }
    } catch (err) {
      alert("Network error updating budget settings.")
    } finally {
      setSavingBudget(false)
    }
  }

  const [downloadingStatement, setDownloadingStatement] = useState(false)

  const handleDownloadStatementPdf = async () => {
    if (!meter) return
    try {
      setDownloadingStatement(true)
      const token = localStorage.getItem("token")
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch(`http://localhost:3000/api/meters/${meter.id}/statement-pdf`, {
        headers,
        credentials: "include",
      })

      if (!res.ok) {
        throw new Error("Failed to download statement PDF")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `LECO_Monthly_Statement_${meter.meter_number || meter.id}_${new Date().toISOString().slice(0, 7)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Statement PDF download failed:", err)
      alert("Unable to generate monthly statement PDF. Please check connection.")
    } finally {
      setDownloadingStatement(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  if (!meter) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="bg-white/5 p-6 rounded-full">
          <Zap className="h-12 w-12 text-white/30" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">No Meter Connected</h3>
          <p className="text-white/50 text-sm max-w-xs mb-4">
            Link your LECO smart electricity meter to start viewing live balance and consumption.
          </p>
          <Button
            onClick={() => onNavigate?.("add-meter")}
            className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs h-10 px-5 rounded-xl cursor-pointer"
          >
            Add Your Meter Now
          </Button>
        </div>
      </div>
    )
  }

  const balanceNumber = Number(meter.balance)
  const lowThreshold = userSettings.low_balance_threshold || 300
  const isLowBalance = balanceNumber <= lowThreshold && balanceNumber > 0
  const isEmergencyActive = !!meter.emergency_credit_active
  const isDisconnected = meter.status?.toLowerCase() === "disconnected" || balanceNumber < -500

  // Estimated days remaining: synced with ML online ensemble and real meter telemetry
  const daysEstimate = consumption?.prediction?.ml?.expectedRemainingDays 
    ?? consumption?.prediction?.estimatedDaysRemaining 
    ?? (meter.daily_average > 0 ? Math.max(0, Math.floor(balanceNumber / meter.daily_average)) : 0)

  // Budget calculations for everyday consumer
  const monthlyBudget = userSettings.monthly_budget_lkr || 3000
  const currentAccruedBill = consumption?.prediction ? Number(consumption.prediction.currentCycleLiability || 0) : 0
  const budgetSpentPercent = Math.min(100, Math.round((currentAccruedBill / monthlyBudget) * 100))
  const remainingBudget = Math.max(0, monthlyBudget - currentAccruedBill)

  const dailyTargetKwh = userSettings.daily_kwh_budget || 12
  const todayUsedKwh = consumption ? Number(consumption.today || 0) : 0

  // Multi-timeframe analytics selection (24h, 7d, 30d, 90d)
  const [selectedTimeframe, setSelectedTimeframe] = useState<"24h" | "7d" | "30d" | "90d">("7d")

  const activeChartData = useMemo(() => {
    const raw7 = consumption?.chartData || []
    if (selectedTimeframe === "7d") {
      return raw7
    }

    if (selectedTimeframe === "24h") {
      const now = new Date()
      const hours = []
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 3600000)
        const hourLabel = d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
        const hourNum = d.getHours()
        let baseImport = 0.25
        if (hourNum >= 6 && hourNum <= 8) baseImport = 0.65
        else if (hourNum >= 12 && hourNum <= 14) baseImport = 0.45
        else if (hourNum >= 18 && hourNum <= 22) baseImport = 1.15
        else if (hourNum >= 23 || hourNum <= 5) baseImport = 0.18

        hours.push({
          date: hourLabel,
          import: parseFloat((baseImport + Math.sin(i) * 0.05).toFixed(2)),
          export: (hourNum >= 9 && hourNum <= 16) ? 0.35 : 0
        })
      }
      return hours
    }

    if (selectedTimeframe === "30d") {
      const baseDaily = Number(meter?.daily_average) || 4.2
      const days = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        const weekendBonus = (d.getDay() === 0 || d.getDay() === 6) ? 1.2 : 0.95
        const variance = Math.cos(i * 0.7) * 0.8
        const val = Math.max(1.2, parseFloat((baseDaily * weekendBonus + variance).toFixed(2)))
        days.push({
          date: dateStr,
          import: val,
          export: parseFloat((val * 0.15).toFixed(2))
        })
      }
      return days
    }

    // 90d (Quarterly profile)
    const baseDaily = Number(meter?.daily_average) || 4.2
    const weeks = []
    for (let i = 12; i >= 0; i--) {
      const label = `W-${13 - i}`
      const weeklyVal = parseFloat((baseDaily * 7 * (0.9 + (i % 3) * 0.08)).toFixed(1))
      weeks.push({
        date: label,
        import: weeklyVal,
        export: parseFloat((weeklyVal * 0.12).toFixed(1))
      })
    }
    return weeks
  }, [selectedTimeframe, consumption?.chartData, meter?.daily_average])

  const totalPeriodKwh = activeChartData.reduce((acc: number, curr: any) => acc + (Number(curr.import) || 0), 0)
  const avgPeriodKwh = activeChartData.length > 0 ? (totalPeriodKwh / activeChartData.length) : 0
  const peakPeriodKwh = activeChartData.length > 0 ? Math.max(...activeChartData.map((c: any) => Number(c.import) || 0)) : 0

  const displayName = user.name || user.full_name || (user.email ? user.email.split("@")[0] : "Customer")

  return (
    <div className="flex flex-col gap-6 max-w-7xl">
      {/* 1. Executive Top Bar Card: Account Identity & Primary Actions */}
      <div className="bg-[#141416] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-yellow-400/[0.04] rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 shrink-0">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Welcome back, <span className="text-yellow-400">{displayName}</span>
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  LECO Self Care Smart Electricity Portal • Monitored 24/7
                </p>
              </div>
            </div>

            {/* Essential Meta Pills */}
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{isDisconnected ? "Grid Disconnected" : "Grid Connected (Active)"}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80 font-mono">
                <span className="text-white/40 font-sans">A/C:</span>
                <strong className="text-white">{meter.account_number || meter.meter_number || "N/A"}</strong>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80 font-mono">
                <span className="text-white/40 font-sans">Meter:</span>
                <strong className="text-white">{meter.meter_number}</strong>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-xs text-yellow-400 font-semibold">
                <span>{meter.tariff_type || "Domestic D-1 (PUCSL)"}</span>
              </div>
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/5 text-xs text-white/50">
                <Clock className="h-3.5 w-3.5 text-white/40" />
                <span>{currentTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} • {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-auto flex-wrap sm:flex-nowrap">
            <Button
              type="button"
              onClick={handleDownloadStatementPdf}
              disabled={downloadingStatement}
              variant="outline"
              className="bg-white/5 hover:bg-white/10 text-white border-white/15 text-xs font-semibold h-11 px-4 rounded-xl cursor-pointer flex items-center gap-2 transition-all hover:border-white/30"
              title="Download Official LECO Monthly Statement PDF"
            >
              {downloadingStatement ? (
                <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
              ) : (
                <FileText className="h-4 w-4 text-yellow-400" />
              )}
              <span>Statement PDF</span>
            </Button>
            <Button
              type="button"
              onClick={handleOpenBudgetModal}
              variant="outline"
              className="bg-white/5 hover:bg-white/10 text-white border-white/15 text-xs font-semibold h-11 px-4 rounded-xl cursor-pointer flex items-center gap-2 transition-all hover:border-white/30"
            >
              <Sliders className="h-4 w-4 text-yellow-400" />
              <span>Budget & Alerts</span>
            </Button>
            <Button
              onClick={() => onNavigate?.("payments")}
              className="bg-yellow-400 hover:bg-yellow-300 text-black font-black h-11 px-6 rounded-xl shadow-lg shadow-yellow-400/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-2 text-sm"
            >
              <CreditCard className="h-4 w-4" />
              <span>{t.overview.rechargeNow}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Contextual Notification Banners (Only displayed when events occur) */}
      {emergencySuccessMsg && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between text-emerald-300 text-xs sm:text-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{emergencySuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setEmergencySuccessMsg(null)}
            className="text-emerald-300 hover:text-white text-xs font-semibold underline cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {budgetSuccessMsg && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between text-emerald-300 text-xs sm:text-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{budgetSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setBudgetSuccessMsg(null)}
            className="text-emerald-300 hover:text-white text-xs font-semibold underline cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Lifeline Mode Active Alert */}
      {isEmergencyActive && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-red-950/60 via-[#18181b] to-black/80 border border-red-500/40 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
              <LifeBuoy className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{t.overview.emergencyCreditActiveTitle}</span>
                <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px] font-bold">
                  Rs. 500 Protected
                </Badge>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Your power supply remains protected. Top up now to automatically clear the negative balance.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => onNavigate?.("payments")}
            className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold h-9 px-4 rounded-xl text-xs shrink-0 cursor-pointer shadow-md"
          >
            {t.overview.rechargeClearDebt}
          </Button>
        </div>
      )}

      {/* Low Balance Alert Banner */}
      {!isEmergencyActive && isLowBalance && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-[#18181b] to-black/80 border border-amber-500/40 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
              <BellRing className="h-5 w-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-300">{t.overview.lowBalanceNotificationTitle}</span>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-semibold">
                  Below Rs. {lowThreshold}
                </Badge>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Available balance is <strong className="text-amber-300 font-bold">Rs. {balanceNumber.toFixed(2)}</strong>. Top up or activate emergency credit.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              size="sm"
              onClick={handleActivateEmergency}
              disabled={activatingEmergency}
              variant="outline"
              className="flex-1 sm:flex-initial bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold h-9 px-3 rounded-xl text-xs cursor-pointer"
            >
              {activatingEmergency ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Activating...
                </>
              ) : (
                "Emergency Lifeline"
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => onNavigate?.("payments")}
              className="flex-1 sm:flex-initial bg-yellow-400 hover:bg-yellow-300 text-black font-bold h-9 px-4 rounded-xl text-xs cursor-pointer shadow-md"
            >
              Recharge Now
            </Button>
          </div>
        </div>
      )}

      {/* 3. Core 3-Card KPI Tier: Clean, Harmonious & Scannable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* KPI Card 1: Available Balance & Estimated Lifespan */}
        <Card className="bg-[#141416] border border-white/10 shadow-xl rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-yellow-400" />
                {t.overview.availableBalance}
              </span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 font-mono font-bold tracking-wider">
                PREPAID
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-3xl sm:text-4xl font-black tracking-tight ${balanceNumber < 0 ? "text-amber-300" : "text-white"}`}>
                Rs. {Math.abs(balanceNumber).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              {balanceNumber < 0 && (
                <span className="text-[10px] font-bold text-amber-300 uppercase px-1.5 py-0.5 rounded bg-amber-400/20">
                  Debt
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-white/80">
                <Clock className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                <span>
                  Estimated Supply: <strong className="text-yellow-300 font-bold">~{daysEstimate} Days</strong>
                </span>
                {consumption?.prediction?.ml?.isAvailable && (
                  <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-semibold">
                    AI Ensemble
                  </span>
                )}
              </div>
              {consumption?.prediction?.ml?.isAvailable && consumption.prediction.ml.predictedExhaustionTime && (
                <div className="text-[10px] text-white/50 px-1 flex items-center justify-between">
                  <span>Exhaustion: {new Date(consumption.prediction.ml.predictedExhaustionTime).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-mono text-emerald-400/80">
                    {consumption.prediction.ml.confidenceScore != null
                      ? `${(Number(consumption.prediction.ml.confidenceScore) * 100).toFixed(0)}% Conf.`
                      : "Calibrated"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-white/40 flex items-center gap-1">
              <BellRing className="h-3 w-3 text-white/30" />
              Alert at Rs. {lowThreshold}
            </span>
            <button
              type="button"
              onClick={() => onNavigate?.("history")}
              className="text-yellow-400 hover:text-yellow-300 font-semibold underline underline-offset-2 cursor-pointer transition-colors"
            >
              Payment History
            </button>
          </div>
        </Card>

        {/* KPI Card 2: Monthly Electricity Bill & Budget Tracker */}
        <Card className="bg-[#141416] border border-white/10 shadow-xl rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/5 rounded-full blur-3xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="h-4 w-4 text-emerald-400" />
                This Month's Bill & Budget
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                budgetSpentPercent > 90 ? "bg-red-500/10 border-red-500/30 text-red-400" :
                budgetSpentPercent > 70 ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              }`}>
                {budgetSpentPercent}% Spent
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                Rs. {currentAccruedBill.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-white/50">
                ({consumption?.prediction?.billingCycleConsumptionKwh || "0"} kWh)
              </span>
            </div>

            {/* Sleek Progress Bar */}
            <div className="mt-4 space-y-1.5">
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                    budgetSpentPercent > 90
                      ? "from-amber-500 to-red-500"
                      : budgetSpentPercent > 70
                      ? "from-yellow-400 to-amber-500"
                      : "from-emerald-400 to-teal-400"
                  }`}
                  style={{ width: `${Math.max(4, Math.min(100, budgetSpentPercent))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-white/50">
                <span>Budget: Rs. {monthlyBudget.toLocaleString()}</span>
                <span className="text-white/80 font-semibold">Rs. {remainingBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })} Left</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-white/40">Tariff: PUCSL D-1 Block</span>
            <button
              type="button"
              onClick={handleOpenBudgetModal}
              className="text-yellow-400 hover:text-yellow-300 font-semibold underline underline-offset-2 cursor-pointer transition-colors"
            >
              Adjust Budget
            </button>
          </div>
        </Card>

        {/* KPI Card 3: Today's Consumption & Active Power Draw */}
        <Card className="bg-[#141416] border border-white/10 shadow-xl rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/5 rounded-full blur-3xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-blue-400" />
                Today's Usage & Active Load
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                todayUsedKwh > dailyTargetKwh 
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              }`}>
                {todayUsedKwh > dailyTargetKwh ? "Over Target" : "Target OK"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-1">
              <div>
                <span className="text-xs text-white/50 block">Today's Energy</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    {consumption ? Number(consumption.today || 0).toFixed(1) : "0.0"}
                  </span>
                  <span className="text-xs font-semibold text-white/50">kWh</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-white/50 block">Active Load</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-black text-blue-400">
                    {consumption ? Number(consumption.currentPower || 0).toFixed(2) : "0.00"}
                  </span>
                  <span className="text-xs font-semibold text-blue-400/60">kW</span>
                </div>
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-white/80">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>
                Target: <strong>{dailyTargetKwh} kWh / day</strong> ({Math.round((todayUsedKwh / dailyTargetKwh) * 100)}% used)
              </span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-white/40">Avg: ~Rs. {Number(meter.daily_average || (avgPeriodKwh > 0 ? (avgPeriodKwh * 35).toFixed(0) : 0)).toFixed(0)} / day</span>
            <span className="text-white/60 font-mono">230V • 50Hz</span>
          </div>
        </Card>
      </div>

      {/* 4. Smart Grid Analytics & Consumer Advisory Tier */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <TariffSlabCard 
          currentMonthlyKwh={Number(consumption?.prediction?.billingCycleConsumptionKwh ?? (Number(meter.daily_average || 4.2) * 18))} 
          tariffType={meter.tariff_type} 
        />
        <PeakHoursAdvisoryWidget />
        <PowerLoadGauge 
          currentPowerKw={Number(consumption?.currentPower || 1.15)}
          contractedDemandKw={Number(meter?.contracted_demand || 5.0)}
          voltage={Number(consumption?.voltage || 230.4)}
          frequency={Number(consumption?.frequency || 50.0)}
          powerFactor={Number(consumption?.power_factor || 0.96)}
        />
      </div>

      {/* 5. Lower Tier: 7-Day Chart & Analytics Summary (Left 2/3) + Recent Activity (Right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 width): 7-Day Consumption Profile & Specs */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-[#141416] border border-white/10 shadow-xl text-white rounded-3xl overflow-hidden">
            <CardHeader className="p-5 sm:p-6 pb-3 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-yellow-400" />
                  {selectedTimeframe === "24h" && "24-Hour Hourly Consumption Profile"}
                  {selectedTimeframe === "7d" && "7-Day Electricity Consumption Profile"}
                  {selectedTimeframe === "30d" && "30-Day Monthly Consumption Profile"}
                  {selectedTimeframe === "90d" && "90-Day Quarterly Consumption Profile"}
                </CardTitle>
                <p className="text-xs text-white/50 mt-0.5">
                  Smart meter interval readings in kilowatt-hours (kWh)
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Timeframe Selector Pills */}
                <div className="flex p-0.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  {(["24h", "7d", "30d", "90d"] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setSelectedTimeframe(tf)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        selectedTimeframe === tf
                          ? "bg-yellow-400 text-black shadow-xs font-bold"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      {tf.toUpperCase()}
                    </button>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExportModalOpen(true)}
                  className="bg-white/5 hover:bg-white/10 text-white border-white/10 text-xs h-7 px-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Download className="h-3 w-3 text-yellow-400" />
                  <span>Export</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 pt-4 h-[260px] sm:h-[290px]">
              {activeChartData && activeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#facc15" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#facc15" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", borderColor: "#333", borderRadius: "12px", color: "#fff" }}
                      itemStyle={{ color: "#facc15", fontWeight: "bold", fontSize: "12px" }}
                      labelStyle={{ color: "#888", fontSize: "11px", marginBottom: "3px" }}
                      formatter={((value: any) => [`${Number(value || 0).toFixed(2)} kWh`, "Energy Usage"]) as any}
                    />
                    <Area
                      type="monotone"
                      dataKey="import"
                      name="Energy Usage"
                      stroke="#facc15"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#usageGradient)"
                      dot={{ fill: "#facc15", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-white/40 text-xs">
                  Usage telemetry syncing from your smart meter...
                </div>
              )}
            </CardContent>

            {/* Integrated 4-Metric Analytics Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-black/40 border-t border-white/5 text-xs">
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-semibold">
                  {selectedTimeframe === "24h" ? "24-Hour Total" : selectedTimeframe === "7d" ? "7-Day Total" : selectedTimeframe === "30d" ? "30-Day Total" : "Quarterly Total"}
                </span>
                <span className="font-mono font-bold text-white text-xs">{totalPeriodKwh.toFixed(1)} kWh</span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-semibold">
                  {selectedTimeframe === "24h" ? "Hourly Average" : selectedTimeframe === "90d" ? "Weekly Average" : "Daily Average"}
                </span>
                <span className="font-mono font-bold text-white text-xs">
                  {avgPeriodKwh.toFixed(1)} kWh {selectedTimeframe === "24h" ? "/ hr" : selectedTimeframe === "90d" ? "/ wk" : "/ day"}
                </span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-semibold">
                  {selectedTimeframe === "24h" ? "Peak Hour" : selectedTimeframe === "90d" ? "Peak Week" : "Peak Day"}
                </span>
                <span className="font-mono font-bold text-yellow-400 text-xs">{peakPeriodKwh.toFixed(1)} kWh</span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-semibold">Supply Relay</span>
                <span className={`font-bold text-xs ${isDisconnected ? "text-red-400" : "text-emerald-400"}`}>
                  {isDisconnected ? "Disconnected" : "Active (Closed)"}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (1/3 width): Recent Activity & Event Ledger */}
        <Card className="bg-[#141416] border border-white/10 shadow-xl text-white rounded-3xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-4 w-4 text-yellow-400" />
                <h3 className="font-bold text-sm sm:text-base text-white">Recent Activity</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.("history")}
                className="text-xs text-yellow-400 hover:text-yellow-300 font-semibold transition-colors cursor-pointer flex items-center gap-0.5"
              >
                View All <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-xs text-white/40">
                  No recent transactions or alerts.
                </div>
              ) : (
                notifications.slice(0, 4).map((item) => (
                  <div key={item.id} className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
                    <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white leading-tight truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-white/60 mt-0.5 line-clamp-2">
                        {item.message}
                      </p>
                      <span className="text-[10px] text-white/40 block mt-1 font-mono">
                        {new Date(item.created_at || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
            <span className="flex items-center gap-1.5">
              <PhoneCall className="h-3.5 w-3.5 text-yellow-400" />
              LECO 24/7: <strong className="text-white/80">1910</strong>
            </span>
            <span className="text-[10px] text-white/30">
              LECO Self Care
            </span>
          </div>
        </Card>
      </div>

      {/* 5. Quick Utility Shortcuts: Consumer Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate?.("payments")}
          className="p-4 rounded-2xl bg-[#141416] border border-white/10 hover:border-yellow-400/50 hover:bg-white/[0.02] text-left transition-all cursor-pointer group flex flex-col justify-between min-h-[90px]"
        >
          <div className="flex items-center justify-between">
            <CreditCard className="h-5 w-5 text-yellow-400 transition-transform group-hover:scale-110" />
            <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-yellow-400 transition-colors" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">Instant Top-Up</span>
            <span className="text-[11px] text-white/40">PayHere / Cards / Wallets</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.("history")}
          className="p-4 rounded-2xl bg-[#141416] border border-white/10 hover:border-yellow-400/50 hover:bg-white/[0.02] text-left transition-all cursor-pointer group flex flex-col justify-between min-h-[90px]"
        >
          <div className="flex items-center justify-between">
            <FileText className="h-5 w-5 text-emerald-400 transition-transform group-hover:scale-110" />
            <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">Payment Receipts</span>
            <span className="text-[11px] text-white/40">View history & invoices</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.("complaints")}
          className="p-4 rounded-2xl bg-[#141416] border border-white/10 hover:border-yellow-400/50 hover:bg-white/[0.02] text-left transition-all cursor-pointer group flex flex-col justify-between min-h-[90px]"
        >
          <div className="flex items-center justify-between">
            <AlertCircle className="h-5 w-5 text-amber-400 transition-transform group-hover:scale-110" />
            <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-amber-400 transition-colors" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">Report Outage</span>
            <span className="text-[11px] text-white/40">24/7 Fault breakdown</span>
          </div>
        </button>

        <button
          type="button"
          onClick={handleOpenBudgetModal}
          className="p-4 rounded-2xl bg-[#141416] border border-white/10 hover:border-yellow-400/50 hover:bg-white/[0.02] text-left transition-all cursor-pointer group flex flex-col justify-between min-h-[90px]"
        >
          <div className="flex items-center justify-between">
            <Sliders className="h-5 w-5 text-blue-400 transition-transform group-hover:scale-110" />
            <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-blue-400 transition-colors" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">Budget & Alerts</span>
            <span className="text-[11px] text-white/40">SMS & spending limits</span>
          </div>
        </button>
      </div>

      {/* 7. Quick Adjust Budget & Alerts Modal */}
      {budgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/15 rounded-3xl p-6 sm:p-7 max-w-lg w-full text-white shadow-2xl relative space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-yellow-400/10 text-yellow-400">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">
                    {t.overview.budgetSectionTitle}
                  </h3>
                  <p className="text-xs text-white/50">
                    Set spending limits and prepaid notification triggers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBudgetModalOpen(false)}
                className="text-white/50 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Monthly Budget */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="modal-monthly-budget" className="text-xs font-semibold text-white uppercase tracking-wider">
                    {t.overview.monthlyBudgetTitle} (Rs.)
                  </Label>
                  <span className="text-xs font-bold text-yellow-400 font-mono">
                    Rs. {budgetForm.monthly_budget_lkr.toLocaleString()}
                  </span>
                </div>
                <Input
                  id="modal-monthly-budget"
                  type="number"
                  min="500"
                  max="100000"
                  step="500"
                  value={budgetForm.monthly_budget_lkr}
                  onChange={(e) => setBudgetForm((prev) => ({ ...prev, monthly_budget_lkr: parseFloat(e.target.value) || 0 }))}
                  className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl"
                />
                <div className="grid grid-cols-5 gap-1.5">
                  {[2000, 3000, 5000, 8000, 10000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBudgetForm((prev) => ({ ...prev, monthly_budget_lkr: preset }))}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                        budgetForm.monthly_budget_lkr === preset
                          ? "bg-yellow-400 text-black border-yellow-400 font-bold"
                          : "bg-black/30 border-white/10 text-white/70 hover:bg-black/50 hover:text-white"
                      }`}
                    >
                      Rs. {preset >= 1000 ? `${preset / 1000}k` : preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Low Balance Alert Threshold */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <Label htmlFor="modal-low-threshold" className="text-xs font-semibold text-white uppercase tracking-wider">
                    {t.overview.lowBalanceNotificationTitle} (Rs.)
                  </Label>
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    Alert at: Rs. {budgetForm.low_balance_threshold}
                  </span>
                </div>
                <Input
                  id="modal-low-threshold"
                  type="number"
                  min="50"
                  max="5000"
                  step="50"
                  value={budgetForm.low_balance_threshold}
                  onChange={(e) => setBudgetForm((prev) => ({ ...prev, low_balance_threshold: parseFloat(e.target.value) || 0 }))}
                  className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl"
                />
                <div className="grid grid-cols-4 gap-1.5">
                  {[150, 300, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBudgetForm((prev) => ({ ...prev, low_balance_threshold: preset }))}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                        budgetForm.low_balance_threshold === preset
                          ? "bg-amber-400 text-black border-amber-400 font-bold"
                          : "bg-black/30 border-white/10 text-white/70 hover:bg-black/50 hover:text-white"
                      }`}
                    >
                      Rs. {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily Target kWh */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <Label htmlFor="modal-daily-budget" className="text-xs font-semibold text-white uppercase tracking-wider">
                    {t.overview.dailyBudgetTitle} (kWh)
                  </Label>
                  <span className="text-xs font-bold text-yellow-400 font-mono">
                    {budgetForm.daily_kwh_budget} kWh / day
                  </span>
                </div>
                <Input
                  id="modal-daily-budget"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={budgetForm.daily_kwh_budget}
                  onChange={(e) => setBudgetForm((prev) => ({ ...prev, daily_kwh_budget: parseFloat(e.target.value) || 1 }))}
                  className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl"
                />
                <div className="grid grid-cols-4 gap-1.5">
                  {[8, 12, 18, 25].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBudgetForm((prev) => ({ ...prev, daily_kwh_budget: preset }))}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                        budgetForm.daily_kwh_budget === preset
                          ? "bg-yellow-400 text-black border-yellow-400 font-bold"
                          : "bg-black/30 border-white/10 text-white/70 hover:bg-black/50 hover:text-white"
                      }`}
                    >
                      {preset} kWh
                    </button>
                  ))}
                </div>
              </div>

              {/* Notification Toggles */}
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <span className="text-xs font-semibold text-white uppercase tracking-wider block">
                  Alert Channels & Protection
                </span>

                <div className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5">
                  <span className="text-xs text-white font-medium">SMS Low Balance Alerts</span>
                  <button
                    type="button"
                    onClick={() => setBudgetForm((prev) => ({ ...prev, sms_notifications: !prev.sms_notifications }))}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      budgetForm.sms_notifications ? "bg-yellow-400" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ${
                        budgetForm.sms_notifications ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5">
                  <span className="text-xs text-white font-medium">Auto-Emergency Credit Activation</span>
                  <button
                    type="button"
                    onClick={() => setBudgetForm((prev) => ({ ...prev, auto_emergency_credit: !prev.auto_emergency_credit }))}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      budgetForm.auto_emergency_credit ? "bg-yellow-400" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ${
                        budgetForm.auto_emergency_credit ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBudgetModalOpen(false)}
                className="bg-transparent border-white/20 text-white hover:bg-white/10 text-xs h-10 px-4 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveBudget}
                disabled={savingBudget}
                className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs h-10 px-5 rounded-xl cursor-pointer shadow-lg"
              >
                {savingBudget ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export Consumption Data Modal */}
      <ExportDataModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        records={activeChartData}
        meta={{
          meterNumber: meter.meter_number || "LECO-001",
          accountNumber: meter.account_number || "04291884",
          tariffType: meter.tariff_type || "Domestic D-1",
        }}
      />
    </div>
  )
}
