import { API_BASE_URL } from "@/lib/api"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Zap,
  ZapOff,
  Search,
  RefreshCw,
  Power,
  CreditCard,
  SlidersHorizontal,
  Building2,
  User,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Cpu,
  Loader2,
  X,
  ChevronRight,
  Activity,
  Layers,
  Download,
  Lock,
  Plus,
  KeyRound,
  ShieldCheck,
  Copy,
  Check,
  Printer,
  Eye,
  EyeOff
} from "lucide-react"
import type { StaffMeter } from "../types"
import StaffPasswordConfirmModal from "./StaffPasswordConfirmModal"

interface MetersManagementProps {
  meters: StaffMeter[]
  loading: boolean
  onRefresh: () => void
  onSelectComplaintTabWithMeter?: (meterNumber: string) => void
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>
}

export default function MetersManagement({
  meters,
  loading,
  onRefresh,
  onSelectComplaintTabWithMeter,
  getAuthHeaders
}: MetersManagementProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "connected" | "disconnected" | "lifeline" | "low_balance">("all")
  const [sortBy, setSortBy] = useState<"id" | "balance_asc" | "balance_desc" | "today_kwh">("id")

  // Selected meter for action modals
  const [activeMeterDetail, setActiveMeterDetail] = useState<StaffMeter | null>(null)
  const [relayModalMeter, setRelayModalMeter] = useState<StaffMeter | null>(null)
  const [topupModalMeter, setTopupModalMeter] = useState<StaffMeter | null>(null)

  // Action states
  const [actionReason, setActionReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [topupAmount, setTopupAmount] = useState<number>(500)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const [downloadingStatement, setDownloadingStatement] = useState(false)

  // ML Online Intelligence state
  const [mlStatus, setMlStatus] = useState<any>(null)
  const [mlPrepaid, setMlPrepaid] = useState<any>(null)
  const [loadingMl, setLoadingMl] = useState(false)

  // Meter Registration & Security Passcode state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [registerMeterNumber, setRegisterMeterNumber] = useState("")
  const [registerAccountNumber, setRegisterAccountNumber] = useState("")
  const [registerNic, setRegisterNic] = useState("")
  const [registerPasscode, setRegisterPasscode] = useState("")
  const [registerBalance, setRegisterBalance] = useState("0.00")
  const [registerName, setRegisterName] = useState("Home")
  const [registerStaffPassword, setRegisterStaffPassword] = useState("")
  const [showRegisterPasscode, setShowRegisterPasscode] = useState(true)
  const [registerLoading, setRegisterLoading] = useState(false)

  // Handover Voucher Slip state
  const [handoverSlip, setHandoverSlip] = useState<{
    meter_number: string
    account_number: string
    registered_nic: string
    passcode: string
    initial_balance: number
    name: string
  } | null>(null)
  const [slipCopied, setSlipCopied] = useState(false)

  // Passcode Management & Regeneration Modal state
  const [passcodeModalMeter, setPasscodeModalMeter] = useState<StaffMeter | null>(null)
  const [passcodeStaffPassword, setPasscodeStaffPassword] = useState("")
  const [customPasscode, setCustomPasscode] = useState("")
  const [activePasscodeDisplay, setActivePasscodeDisplay] = useState("")
  const [passcodeRegenerating, setPasscodeRegenerating] = useState(false)
  const [passcodeCopied, setPasscodeCopied] = useState(false)

  // Keep active meter synchronized live with incoming fleet updates from WebSocket
  useEffect(() => {
    if (activeMeterDetail) {
      const latest = meters.find((m) => m.id === activeMeterDetail.id)
      if (latest) {
        setActiveMeterDetail(latest)
      }
    }
  }, [meters])

  // Fetch ML online status & forecast when activeMeterDetail opens
  useEffect(() => {
    if (!activeMeterDetail) {
      setMlStatus(null)
      setMlPrepaid(null)
      return
    }
    let isMounted = true
    setLoadingMl(true)
    Promise.allSettled([
      fetch(`${API_BASE_URL}/api/prediction/ml/status/${activeMeterDetail.id}`, {
        headers: getAuthHeaders(),
        credentials: "include"
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE_URL}/api/prediction/ml/prepaid/${activeMeterDetail.id}`, {
        headers: getAuthHeaders(),
        credentials: "include"
      }).then((r) => (r.ok ? r.json() : null))
    ])
      .then(([statusRes, prepaidRes]) => {
        if (!isMounted) return
        if (statusRes.status === "fulfilled" && statusRes.value?.status) {
          setMlStatus(statusRes.value.status)
        }
        if (prepaidRes.status === "fulfilled" && prepaidRes.value?.result) {
          setMlPrepaid(prepaidRes.value.result)
        }
      })
      .finally(() => {
        if (isMounted) setLoadingMl(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeMeterDetail?.id])

  const handleDownloadStatementPdf = async (meter: StaffMeter) => {
    try {
      setDownloadingStatement(true)
      const res = await fetch(`${API_BASE_URL}/api/meters/${meter.id}/statement-pdf`, {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (!res.ok) throw new Error("Failed to download statement PDF")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `LECO_Monthly_Statement_${meter.meter_number || meter.id}_${new Date().toISOString().slice(0, 7)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error("Statement PDF download failed:", e)
      showToast("Unable to generate meter statement PDF.", "error")
    } finally {
      setDownloadingStatement(false)
    }
  }

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  const generateRandomMeterNumber = () => {
    const num = Math.floor(100000 + Math.random() * 900000)
    setRegisterMeterNumber(`MTR-${num}`)
  }

  const generateRandomAccountNumber = () => {
    const num = Math.floor(10000000 + Math.random() * 90000000)
    setRegisterAccountNumber(`ACC-${num}`)
  }

  const generateRandomPasscode = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    setRegisterPasscode(code)
  }

  const handleOpenRegisterModal = () => {
    generateRandomMeterNumber()
    generateRandomAccountNumber()
    generateRandomPasscode()
    setRegisterNic("")
    setRegisterBalance("0.00")
    setRegisterName("Main Residence")
    setRegisterStaffPassword("")
    setIsRegisterModalOpen(true)
  }

  const handleRegisterMeter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!registerMeterNumber.trim()) {
      showToast("Meter number is required.", "error")
      return
    }
    if (!registerAccountNumber.trim()) {
      showToast("Account number is required.", "error")
      return
    }
    if (!registerNic.trim()) {
      showToast("Registered Customer NIC is required for anti-theft binding.", "error")
      return
    }
    if (!registerStaffPassword) {
      showToast("Staff authorization password is required.", "error")
      return
    }

    setRegisterLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/meters/register`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          meter_number: registerMeterNumber.trim().toUpperCase(),
          account_number: registerAccountNumber.trim().toUpperCase(),
          registered_nic: registerNic.trim().toUpperCase(),
          passcode: registerPasscode.trim(),
          initial_balance: parseFloat(registerBalance) || 0,
          name: registerName.trim() || "Home",
          staff_password: registerStaffPassword
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(data.message || "Meter registered successfully.", "success")
        setIsRegisterModalOpen(false)
        setHandoverSlip({
          meter_number: data.meter.meter_number,
          account_number: data.meter.account_number,
          registered_nic: data.meter.registered_nic,
          passcode: data.passcode,
          initial_balance: parseFloat(data.meter.balance) || 0,
          name: data.meter.name
        })
        onRefresh()
      } else {
        showToast(data.message || "Failed to register meter.", "error")
      }
    } catch (err) {
      console.error("Register meter error:", err)
      showToast("Network error registering meter.", "error")
    } finally {
      setRegisterLoading(false)
    }
  }

  const handleOpenPasscodeModal = (meter: StaffMeter) => {
    setPasscodeModalMeter(meter)
    setActivePasscodeDisplay(meter.staff_passcode || "")
    setPasscodeStaffPassword("")
    setCustomPasscode("")
    setPasscodeCopied(false)
  }

  const handleRegeneratePasscode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passcodeModalMeter) return
    if (!passcodeStaffPassword) {
      showToast("Staff authorization password is required to regenerate passcode.", "error")
      return
    }

    setPasscodeRegenerating(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/meters/${passcodeModalMeter.id}/regenerate-passcode`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          staffPassword: passcodeStaffPassword,
          customPasscode: customPasscode.trim() || undefined
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(data.message || "Passcode regenerated successfully.", "success")
        setActivePasscodeDisplay(data.passcode)
        setPasscodeStaffPassword("")
        setCustomPasscode("")
        onRefresh()
      } else {
        showToast(data.message || "Failed to regenerate passcode.", "error")
      }
    } catch (err) {
      console.error("Regenerate passcode error:", err)
      showToast("Network error regenerating passcode.", "error")
    } finally {
      setPasscodeRegenerating(false)
    }
  }

  const handleCopyText = (text: string, setCopiedState: (v: boolean) => void) => {
    navigator.clipboard.writeText(text)
    setCopiedState(true)
    setTimeout(() => setCopiedState(false), 2500)
  }

  const handlePrintSlip = () => {
    window.print()
  }

  // Summary Metrics
  const totalMetersCount = meters.length
  const connectedCount = meters.filter((m) => m.status === "Connected").length
  const disconnectedCount = meters.filter((m) => m.status === "Disconnected").length
  const lifelineCount = meters.filter((m) => m.emergency_credit_active).length
  const totalTodayKwh = meters.reduce((acc, m) => acc + (parseFloat(String(m.today_kwh)) || 0), 0)

  // Filter & Search
  const filteredMeters = meters
    .filter((m) => {
      const q = searchTerm.toLowerCase().trim()
      const matchSearch =
        !q ||
        m.meter_number.toLowerCase().includes(q) ||
        m.account_number.toLowerCase().includes(q) ||
        (m.customer_email && m.customer_email.toLowerCase().includes(q)) ||
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.phone_number && m.phone_number.includes(q))

      if (!matchSearch) return false

      const balance = parseFloat(String(m.balance))
      if (statusFilter === "connected") return m.status === "Connected"
      if (statusFilter === "disconnected") return m.status === "Disconnected"
      if (statusFilter === "lifeline") return m.emergency_credit_active
      if (statusFilter === "low_balance") return balance <= m.low_balance_threshold
      return true
    })
    .sort((a, b) => {
      const balA = parseFloat(String(a.balance))
      const balB = parseFloat(String(b.balance))
      if (sortBy === "balance_asc") return balA - balB
      if (sortBy === "balance_desc") return balB - balA
      if (sortBy === "today_kwh") return (parseFloat(String(b.today_kwh)) || 0) - (parseFloat(String(a.today_kwh)) || 0)
      return a.id - b.id
    })

  // State for Sensitive Action Password Authorization Modal
  const [passwordModalConfig, setPasswordModalConfig] = useState<{
    isOpen: boolean
    title: string
    description: string
    confirmButtonText: string
    isDestructive?: boolean
    onConfirm: () => Promise<void> | void
  } | null>(null)

  // Execute Relay Toggle after password verification
  const executeToggleRelay = async () => {
    if (!relayModalMeter) return
    setActionLoading(true)
    const newTargetStatus = relayModalMeter.status === "Connected" ? "Disconnected" : "Connected"

    try {
      const res = await fetch(`${API_BASE_URL}/api/meters/${relayModalMeter.id}/toggle-relay`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          action: newTargetStatus,
          reason: actionReason || `Staff manual override to ${newTargetStatus}`
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(`Meter ${relayModalMeter.meter_number} relay set to ${newTargetStatus}`, "success")
        if (activeMeterDetail && activeMeterDetail.id === relayModalMeter.id) {
          setActiveMeterDetail({ ...activeMeterDetail, status: newTargetStatus })
        }
        setRelayModalMeter(null)
        setActionReason("")
        onRefresh()
      } else {
        showToast(data.message || "Failed to update relay state", "error")
      }
    } catch (err) {
      console.error("Relay toggle error:", err)
      showToast("Network error updating relay state", "error")
    } finally {
      setActionLoading(false)
    }
  }

  // Prompt Password Authorization for Relay Toggle
  const promptToggleRelay = () => {
    if (!relayModalMeter) return
    const isDisconnect = relayModalMeter.status === "Connected"
    setPasswordModalConfig({
      isOpen: true,
      title: isDisconnect ? "Authorize Remote Relay Disconnection" : "Authorize Remote Relay Reconnection",
      description: `You are about to remotely ${isDisconnect ? "DISCONNECT and CUT OFF" : "RESTORE"} electricity for meter ${relayModalMeter.meter_number} (${relayModalMeter.customer_email}). Please confirm with your staff password.`,
      confirmButtonText: isDisconnect ? "Authorize Disconnection" : "Authorize Reconnection",
      isDestructive: isDisconnect,
      onConfirm: executeToggleRelay
    })
  }

  // Execute Staff Top-up after password verification
  const executeStaffTopup = async () => {
    if (!topupModalMeter) return
    setActionLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/meters/${topupModalMeter.id}/staff-topup`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          amount: topupAmount,
          reason: actionReason || "Emergency relief credit granted by staff"
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(`Successfully credited Rs. ${topupAmount.toFixed(2)} to ${topupModalMeter.meter_number}`, "success")
        if (activeMeterDetail && activeMeterDetail.id === topupModalMeter.id) {
          setActiveMeterDetail({
            ...activeMeterDetail,
            balance: data.newBalance ?? (parseFloat(String(activeMeterDetail.balance)) + topupAmount),
            status: data.status ?? activeMeterDetail.status
          })
        }
        setTopupModalMeter(null)
        setActionReason("")
        onRefresh()
      } else {
        showToast(data.message || "Failed to credit meter", "error")
      }
    } catch (err) {
      console.error("Staff top-up error:", err)
      showToast("Network error executing staff top-up", "error")
    } finally {
      setActionLoading(false)
    }
  }

  // Prompt Password Authorization for Staff Top-up
  const promptStaffTopup = () => {
    if (!topupModalMeter) return
    setPasswordModalConfig({
      isOpen: true,
      title: "Authorize Manual Credit Adjustment",
      description: `You are applying manual credit relief of Rs. ${topupAmount.toFixed(2)} to meter ${topupModalMeter.meter_number}. Please confirm with your staff password.`,
      confirmButtonText: "Authorize & Apply Credit",
      isDestructive: false,
      onConfirm: executeStaffTopup
    })
  }

  const handleExportCsv = () => {
    if (filteredMeters.length === 0) return
    const headers = [
      "ID",
      "Meter Number",
      "Account Number",
      "Label",
      "Customer Email",
      "Customer Phone",
      "Status",
      "Balance (LKR)",
      "Today (kWh)",
      "Total (kWh)",
      "Tariff",
      "Lifeline Active",
      "Open Complaints"
    ]
    const rows = filteredMeters.map((m) => [
      m.id,
      m.meter_number,
      m.account_number,
      m.name || "Main Meter",
      m.customer_email || "N/A",
      m.phone_number || "N/A",
      m.status,
      parseFloat(String(m.balance)).toFixed(2),
      parseFloat(String(m.today_kwh)).toFixed(2),
      parseFloat(String(m.total_kwh)).toFixed(1),
      m.tariff_type || "N/A",
      m.emergency_credit_active ? "Yes" : "No",
      m.open_complaints_count || 0
    ])
    const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `LECO_Smart_Meters_Fleet_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 text-sm font-semibold ${
            toastMessage.type === "success"
              ? "bg-green-950/90 border-green-500/40 text-green-200"
              : "bg-red-950/90 border-red-500/40 text-red-200"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-gradient-to-br from-[#992511] to-[#3a0b04] border-0 shadow-xl rounded-2xl p-4 flex flex-col justify-between text-white">
          <div className="flex items-center justify-between text-white/80 text-xs font-medium">
            <span>Fleet Total</span>
            <Cpu className="h-4 w-4 text-yellow-300" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-white">{totalMetersCount}</span>
            <span className="text-[11px] text-white/70 block font-medium">Active Smart Meters</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Grid Connected</span>
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-400">{connectedCount}</span>
            <span className="text-[11px] text-emerald-500/70 block">Relays Closed (Active)</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Disconnected</span>
            <ZapOff className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-rose-400">{disconnectedCount}</span>
            <span className="text-[11px] text-rose-500/70 block">Cutoff Relays Open</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Lifeline Active</span>
            <Power className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-amber-400">{lifelineCount}</span>
            <span className="text-[11px] text-amber-500/70 block">Rs. 500 Buffer In-Use</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Today's Grid Load</span>
            <TrendingUp className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-white">{totalTodayKwh.toFixed(2)}</span>
            <span className="text-[11px] text-white/40 block">Total kWh Billed</span>
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-[#0f0f11] border border-white/5 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-xl">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Meter #, Account #, Email, Phone..."
            className="pl-10 bg-black/40 border-white/10 text-white placeholder:text-white/40 text-xs h-10 rounded-xl focus-visible:border-yellow-400"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-yellow-400 text-black shadow-md shadow-yellow-400/20 font-bold"
                : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            All ({meters.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("connected")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "connected"
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20 font-bold"
                : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            Connected ({connectedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("disconnected")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "disconnected"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20 font-bold"
                : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            Disconnected ({disconnectedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("lifeline")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "lifeline"
                ? "bg-amber-400 text-black shadow-md shadow-amber-400/20 font-bold"
                : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            Lifeline Active ({lifelineCount})
          </button>
        </div>

        {/* Actions & Sort */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 px-3 py-1.5 rounded-xl text-xs text-white/70">
            <SlidersHorizontal className="h-3.5 w-3.5 text-yellow-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white text-xs border-none outline-none cursor-pointer"
            >
              <option value="id" className="bg-[#0f0f11] text-white">Default Sort</option>
              <option value="balance_asc" className="bg-[#0f0f11] text-white">Balance: Low to High</option>
              <option value="balance_desc" className="bg-[#0f0f11] text-white">Balance: High to Low</option>
              <option value="today_kwh" className="bg-[#0f0f11] text-white">Today's Usage</option>
            </select>
          </div>

            <Button
            onClick={handleOpenRegisterModal}
            className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-bold h-9 px-3.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Register New Meter
          </Button>

          <Button
            onClick={onRefresh}
            variant="outline"
            className="bg-black/40 border-white/5 hover:bg-white/10 text-white h-9 px-3 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-yellow-400" : ""}`} />
            Refresh
          </Button>

          <Button
            onClick={handleExportCsv}
            disabled={filteredMeters.length === 0}
            variant="outline"
            className="bg-black/40 border-white/5 hover:bg-white/10 text-white h-9 px-3 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-yellow-400" />
            Export Fleet CSV
          </Button>
        </div>
      </div>

      {/* METERS LIST VIEW */}
      {loading ? (
        <div className="py-20 text-center text-white/50 flex flex-col items-center justify-center gap-3 bg-[#0f0f11] border border-white/5 rounded-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
          <span className="text-xs">Loading complete fleet telemetry...</span>
        </div>
      ) : filteredMeters.length === 0 ? (
        <div className="p-12 text-center bg-[#0f0f11] border border-white/5 rounded-2xl text-white/50 space-y-2">
          <Cpu className="h-8 w-8 mx-auto text-white/30" />
          <p className="text-sm font-semibold text-white">No smart meters match your search/filter.</p>
          <p className="text-xs text-white/40">Try adjusting your filters or search keywords.</p>
        </div>
      ) : (
        <div className="bg-[#0f0f11] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          {/* List Header Bar */}
          <div className="grid grid-cols-12 gap-3 px-5 py-3.5 border-b border-white/5 text-[11px] font-bold uppercase tracking-wider text-white/50 bg-black/40">
            <div className="col-span-3">Smart Meter & Account</div>
            <div className="col-span-3">Customer & Contact</div>
            <div className="col-span-2">Wallet Balance</div>
            <div className="col-span-2">Relay State</div>
            <div className="col-span-2 text-right">Operational Actions</div>
          </div>

          {/* List Rows */}
          <div className="divide-y divide-white/5">
            {filteredMeters.map((meter) => {
              const balanceNum = parseFloat(String(meter.balance))
              const isConnected = meter.status === "Connected"
              const isLifeline = meter.emergency_credit_active
              const isLowBalance = balanceNum <= meter.low_balance_threshold

              return (
                <div
                  key={meter.id}
                  onClick={() => setActiveMeterDetail(meter)}
                  className="grid grid-cols-12 gap-3 px-5 py-4 items-center hover:bg-white/[0.04] transition-all cursor-pointer group text-xs text-white"
                >
                  {/* Col 1: Meter # & Account */}
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-white group-hover:text-yellow-400 transition-colors">
                        {meter.meter_number}
                      </span>
                      {meter.open_complaints_count > 0 && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                          {meter.open_complaints_count} ticket
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-white/50 text-[11px] mt-0.5">
                      <Building2 className="h-3 w-3 text-yellow-400" />
                      <span className="truncate">{meter.name || "Main Meter"}</span>
                      <span className="text-white/20">•</span>
                      <span className="font-mono text-white/40">Acc #{meter.account_number}</span>
                    </div>
                  </div>

                  {/* Col 2: Customer Email & Phone & Registered NIC */}
                  <div className="col-span-3">
                    <div className="font-medium text-white truncate max-w-[220px]">
                      {meter.customer_email || (
                        <span className="text-amber-400 font-semibold italic text-[11px]">
                          Awaiting Customer Link
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/50 font-mono mt-0.5">
                      {meter.registered_nic && (
                        <span className="px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-300 border border-yellow-400/20 text-[10px] font-semibold">
                          NIC: {meter.registered_nic}
                        </span>
                      )}
                      <span>{meter.phone_number || "Not Registered"}</span>
                    </div>
                  </div>

                  {/* Col 3: Balance & Lifeline */}
                  <div className="col-span-2">
                    <div
                      className={`font-bold font-mono text-sm ${
                        balanceNum < 0
                          ? "text-rose-400"
                          : isLowBalance
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      Rs. {balanceNum.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5">
                      {isLifeline ? (
                        <span className="text-amber-400 font-bold">Lifeline Buffer Active</span>
                      ) : (
                        <span>Today: {parseFloat(String(meter.today_kwh)).toFixed(1)} kWh</span>
                      )}
                    </div>
                  </div>

                  {/* Col 4: Relay Status */}
                  <div className="col-span-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        isConnected
                          ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                          : "bg-rose-500/15 border border-rose-500/30 text-rose-300"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
                        }`}
                      />
                      {isConnected ? "Connected" : "Disconnected"}
                    </span>
                  </div>

                  {/* Col 5: Actions */}
                  <div
                    className="col-span-2 flex items-center justify-end gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      title="View or Regenerate Passcode"
                      onClick={() => handleOpenPasscodeModal(meter)}
                      className="bg-amber-400/10 hover:bg-amber-400/20 border-amber-400/30 text-amber-300 text-xs h-7 px-2 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound className="h-3 w-3" />
                      Passcode
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      title="Adjust credit"
                      onClick={() => setTopupModalMeter(meter)}
                      className="bg-yellow-400/10 hover:bg-yellow-400/20 border-yellow-400/30 text-yellow-300 text-xs h-7 px-2 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <CreditCard className="h-3 w-3" />
                      Credit
                    </Button>

                    <Button
                      size="sm"
                      title={isConnected ? "Cutoff supply" : "Restore supply"}
                      onClick={() => setRelayModalMeter(meter)}
                      className={`text-xs h-7 px-2.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer ${
                        isConnected
                          ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40"
                          : "bg-emerald-500 hover:bg-emerald-600 text-black shadow-md"
                      }`}
                    >
                      <Power className="h-3 w-3" />
                      {isConnected ? "Cutoff" : "Restore"}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActiveMeterDetail(meter)}
                      className="text-white/40 hover:text-white p-1 h-7 w-7 rounded-lg cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* WHOLE DETAILS MODAL / INSPECTOR (When Clicked, Whole Details Appear) */}
      {activeMeterDetail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0f11] border border-white/10 rounded-3xl max-w-3xl w-full p-6 text-white space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            {/* Header Strip */}
            <div className="flex items-start justify-between border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#992511] to-[#3a0b04] border border-white/10 flex items-center justify-center shadow-lg shadow-[#992511]/20">
                    <Zap className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold font-mono text-white tracking-wide">
                        {activeMeterDetail.meter_number}
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          activeMeterDetail.status === "Connected"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            activeMeterDetail.status === "Connected"
                              ? "bg-emerald-400 animate-pulse"
                              : "bg-rose-500"
                          }`}
                        />
                        {activeMeterDetail.status === "Connected" ? "Live Relay Connected" : "Cutoff Relay Disconnected"}
                      </span>
                    </div>
                    <p className="text-xs text-white/60 mt-0.5 flex items-center gap-2">
                      <span>Account #{activeMeterDetail.account_number}</span>
                      <span>•</span>
                      <span>Label: {activeMeterDetail.name}</span>
                      <span>•</span>
                      <span className="text-yellow-400">{activeMeterDetail.tariff_type}</span>
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveMeterDetail(null)}
                className="text-white/40 hover:text-white p-2 rounded-xl bg-black/40 border border-white/10 cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Whole Details 4-Quadrant Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Quadrant 1: Customer & Account Profile */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-yellow-400 font-bold uppercase text-[11px] tracking-wider pb-1 border-b border-white/5">
                  <User className="h-4 w-4" />
                  Customer Dossier & Contact
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Registered Email:</span>
                    <span className="font-semibold text-white truncate max-w-[200px]">
                      {activeMeterDetail.customer_email || "Awaiting Customer Link"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Registered NIC (Anti-Theft):</span>
                    <span className="font-mono text-yellow-300 font-bold bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                      {activeMeterDetail.registered_nic || activeMeterDetail.customer_nic || "Not Specified"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Account Binding:</span>
                    <span className={activeMeterDetail.customer_email ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                      {activeMeterDetail.customer_email ? "Linked to Customer" : "Awaiting Customer Verification"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">SMS Alert Phone:</span>
                    <span className="font-mono text-white font-semibold">
                      {activeMeterDetail.phone_number || "Not Registered"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Customer System ID:</span>
                    <span className="font-mono text-white/70">
                      {activeMeterDetail.customer_id ? `USR-${activeMeterDetail.customer_id}` : "Unlinked"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Member Registered:</span>
                    <span className="text-white/70">
                      {activeMeterDetail.customer_since
                        ? new Date(activeMeterDetail.customer_since).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })
                        : "Awaiting Link"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Meter Install Date:</span>
                    <span className="text-white/70">
                      {new Date(activeMeterDetail.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quadrant 2: Financials & Balance State */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-yellow-400 font-bold uppercase text-[11px] tracking-wider pb-1 border-b border-white/5">
                  <CreditCard className="h-4 w-4" />
                  Prepaid Balance & Automation
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Live Wallet Balance:</span>
                    <span
                      className={`text-base font-bold font-mono ${
                        parseFloat(String(activeMeterDetail.balance)) < 0
                          ? "text-rose-400"
                          : parseFloat(String(activeMeterDetail.balance)) <= activeMeterDetail.low_balance_threshold
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      Rs. {parseFloat(String(activeMeterDetail.balance)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Low Balance Alert Point:</span>
                    <span className="font-semibold text-white">
                      Rs. {activeMeterDetail.low_balance_threshold}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Daily Energy Quota:</span>
                    <span className="font-semibold text-white">
                      {activeMeterDetail.daily_kwh_budget} kWh / day
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Lifeline Emergency Credit:</span>
                    <span
                      className={
                        activeMeterDetail.emergency_credit_active
                          ? "text-amber-400 font-bold"
                          : "text-white/70 font-semibold"
                      }
                    >
                      {activeMeterDetail.emergency_credit_active
                        ? "Active (-Rs. 500 Buffer In Use)"
                        : `Permitted (Rs. ${parseFloat(String(activeMeterDetail.emergency_credit_limit)).toFixed(2)} buffer)`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Last Payment:</span>
                    <span className="text-white/70">
                      {activeMeterDetail.last_payment_date
                        ? `Rs. ${parseFloat(String(activeMeterDetail.last_payment_amount)).toFixed(2)} on ${new Date(
                            activeMeterDetail.last_payment_date
                          ).toLocaleDateString()}`
                        : "No recorded transactions"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quadrant 3: Telemetry & Consumption Metrics */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-yellow-400 font-bold uppercase text-[11px] tracking-wider pb-1 border-b border-white/5">
                  <Activity className="h-4 w-4" />
                  Grid Telemetry & Load
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Today's Consumption:</span>
                    <span className="font-bold text-white text-sm">
                      {parseFloat(String(activeMeterDetail.today_kwh)).toFixed(2)} kWh
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Lifetime Net Import:</span>
                    <span className="font-bold text-white text-sm">
                      {parseFloat(String(activeMeterDetail.total_kwh)).toFixed(1)} kWh
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Tariff Class:</span>
                    <span className="font-semibold text-yellow-300">
                      {activeMeterDetail.tariff_type}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Telemetry Ping Interval:</span>
                    <span className="text-emerald-400 font-mono">15s Live Telemetry</span>
                  </div>
                </div>
              </div>

              {/* Quadrant 4: Complaint Status & Support */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-yellow-400 font-bold uppercase text-[11px] tracking-wider pb-1 border-b border-white/5">
                  <Layers className="h-4 w-4" />
                  Active Support & Complaints
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Pending Customer Tickets:</span>
                    <span
                      className={`font-bold ${
                        activeMeterDetail.open_complaints_count > 0 ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {activeMeterDetail.open_complaints_count} Open Issue(s)
                    </span>
                  </div>
                  {activeMeterDetail.open_complaints_count > 0 && onSelectComplaintTabWithMeter && (
                    <div className="pt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const num = activeMeterDetail.meter_number
                          setActiveMeterDetail(null)
                          onSelectComplaintTabWithMeter(num)
                        }}
                        className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 text-xs h-8 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Jump to Complaints Queue for this Meter
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Quadrant 5: Adaptive ML Online Forecasting Engine */}
              <div className="md:col-span-2 bg-[#121214] border border-yellow-400/20 rounded-2xl p-4 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2 text-yellow-400 font-bold uppercase text-[11px] tracking-wider">
                    <Cpu className="h-4 w-4" />
                    Adaptive ML Online Forecasting Engine
                  </div>
                  <div className="flex items-center gap-2">
                    {loadingMl ? (
                      <span className="flex items-center gap-1.5 text-[11px] text-white/50 font-mono">
                        <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />
                        Synchronizing Model...
                      </span>
                    ) : mlStatus ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {mlStatus.stage || "ONLINE"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-white/40 font-mono">Cold-Start Ready</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                  <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                    <span className="text-[11px] text-white/50 block">Predicted Supply Horizon</span>
                    <span className="text-sm font-bold font-mono text-white mt-0.5 block">
                      {mlPrepaid?.expected_remaining_days != null
                        ? `${Number(mlPrepaid.expected_remaining_days).toFixed(1)} Days`
                        : "Calculating..."}
                    </span>
                    <span className="text-[10px] text-white/40 block mt-0.5 truncate">
                      {mlPrepaid?.exhaustion_timestamp
                        ? new Date(mlPrepaid.exhaustion_timestamp).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : "Continuous tracking"}
                    </span>
                  </div>

                  <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                    <span className="text-[11px] text-white/50 block">Dynamic Daily Burn Rate</span>
                    <span className="text-sm font-bold font-mono text-yellow-300 mt-0.5 block">
                      {mlPrepaid?.daily_burn_rate_lkr != null
                        ? `Rs. ${Number(mlPrepaid.daily_burn_rate_lkr).toFixed(2)}/day`
                        : "Analyzing..."}
                    </span>
                    <span className="text-[10px] text-white/40 block mt-0.5">
                      Tariff Tier Progressive
                    </span>
                  </div>

                  <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                    <span className="text-[11px] text-white/50 block">Telemetry Samples</span>
                    <span className="text-sm font-bold font-mono text-emerald-400 mt-0.5 block">
                      {mlStatus?.samples_seen ?? 0} Observations
                    </span>
                    <span className="text-[10px] text-white/40 block mt-0.5">
                      Real-Time Streaming
                    </span>
                  </div>

                  <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                    <span className="text-[11px] text-white/50 block">ADWIN Drift & Anomalies</span>
                    <span className="text-sm font-bold font-mono text-sky-400 mt-0.5 block">
                      {mlStatus?.drift_events_detected ?? 0} Drifts / {mlStatus?.total_anomalies_flagged ?? 0} Anomalies
                    </span>
                    <span className="text-[10px] text-white/40 block mt-0.5">
                      Concept Drift Immune
                    </span>
                  </div>
                </div>

                {mlStatus?.ensemble_weights && (
                  <div className="bg-black/20 border border-white/5 rounded-xl p-2.5 flex flex-wrap items-center justify-between text-[11px] gap-2">
                    <span className="text-white/50 font-medium">Model Fusion Weights:</span>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-white/80">EWMA: <strong className="text-yellow-400">{((mlStatus.ensemble_weights.ewma || 0) * 100).toFixed(0)}%</strong></span>
                      <span className="text-white/80">Kalman: <strong className="text-yellow-400">{((mlStatus.ensemble_weights.kalman || 0) * 100).toFixed(0)}%</strong></span>
                      <span className="text-white/80">Linear: <strong className="text-yellow-400">{((mlStatus.ensemble_weights.linear || 0) * 100).toFixed(0)}%</strong></span>
                      <span className="text-white/80">Tree: <strong className="text-yellow-400">{((mlStatus.ensemble_weights.forest || 0) * 100).toFixed(0)}%</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Direct Operational Controls Inside Details */}
            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => handleDownloadStatementPdf(activeMeterDetail)}
                  disabled={downloadingStatement}
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9 px-3.5 rounded-xl flex items-center gap-2 cursor-pointer"
                  title="Download standard 30-day consumption statement PDF"
                >
                  {downloadingStatement ? (
                    <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                  ) : (
                    <Download className="h-4 w-4 text-yellow-400" />
                  )}
                  <span>Statement PDF</span>
                </Button>

                <Button
                  onClick={() => setTopupModalMeter(activeMeterDetail)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-yellow-400/20 flex items-center gap-2 cursor-pointer"
                >
                  <CreditCard className="h-4 w-4" />
                  Grant Relief Credit
                </Button>

                <Button
                  onClick={() => handleOpenPasscodeModal(activeMeterDetail)}
                  className="bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 text-xs h-9 px-3.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="h-4 w-4" />
                  Passcode Voucher
                </Button>

                <Button
                  onClick={() => setRelayModalMeter(activeMeterDetail)}
                  className={`text-xs h-9 px-4 rounded-xl font-bold flex items-center gap-2 cursor-pointer ${
                    activeMeterDetail.status === "Connected"
                      ? "bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20"
                      : "bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg shadow-emerald-500/20"
                  }`}
                >
                  <Power className="h-4 w-4" />
                  {activeMeterDetail.status === "Connected"
                    ? "Cutoff Relay Override"
                    : "Restore Power Override"}
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={() => setActiveMeterDetail(null)}
                className="bg-white/10 text-white border-white/20 text-xs h-9 px-4 rounded-xl cursor-pointer"
              >
                Close Details
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Remote Relay Toggle Confirmation */}
      {relayModalMeter && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0f11] border border-white/10 rounded-3xl max-w-md w-full p-6 text-white space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${
                  relayModalMeter.status === "Connected"
                    ? "bg-rose-500/20 text-rose-400"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                <Power className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {relayModalMeter.status === "Connected"
                    ? "Remote Power Disconnection Override"
                    : "Remote Power Reconnection Override"}
                </h3>
                <p className="text-xs text-white/50 font-mono">
                  Meter: {relayModalMeter.meter_number} ({relayModalMeter.customer_email})
                </p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              {relayModalMeter.status === "Connected"
                ? "This command instructs the physical smart meter relay to open and cut off supply to the customer premise. An official alert notification will be immediately dispatched."
                : "This command triggers the smart meter relay to close and immediately restore live 230V electricity to the customer premise."}
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80 block">
                Operation Reason / Engineering Memo (Optional)
              </label>
              <Input
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="e.g. Emergency inspection, scheduled line maintenance, verified topup"
                className="bg-black/40 border-white/15 text-white text-xs h-10 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                disabled={actionLoading}
                onClick={() => setRelayModalMeter(null)}
                className="bg-white/10 text-white border-white/20 text-xs h-9 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                disabled={actionLoading}
                onClick={promptToggleRelay}
                className={`text-xs h-9 px-4 rounded-xl font-bold flex items-center gap-2 cursor-pointer ${
                  relayModalMeter.status === "Connected"
                    ? "bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20"
                    : "bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg shadow-emerald-500/20"
                }`}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Transmitting Relay Command...
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Confirm {relayModalMeter.status === "Connected" ? "Disconnection" : "Reconnection"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Staff Credit Relief / Top-up */}
      {topupModalMeter && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0f11] border border-white/10 rounded-3xl max-w-md w-full p-6 text-white space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-yellow-400/20 text-yellow-400">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Manual Staff Credit Adjustment</h3>
                <p className="text-xs text-white/50 font-mono">
                  Meter: {topupModalMeter.meter_number} (Current: Rs. {parseFloat(String(topupModalMeter.balance)).toFixed(2)})
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-white/80 block">
                Select Relief / Credit Amount (LKR)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[200, 500, 1000, 2000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopupAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      topupAmount === amt
                        ? "bg-yellow-400 text-black border-yellow-400"
                        : "bg-black/40 border-white/10 text-white/70 hover:text-white"
                    }`}
                  >
                    Rs. {amt}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min="50"
                step="50"
                value={topupAmount}
                onChange={(e) => setTopupAmount(parseFloat(e.target.value) || 0)}
                className="bg-black/40 border-white/15 text-white text-xs h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80 block">
                Reason / Relief Justification
              </label>
              <Input
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="e.g. Complaint resolution adjustment, verified bank slip"
                className="bg-black/40 border-white/15 text-white text-xs h-10 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                disabled={actionLoading}
                onClick={() => setTopupModalMeter(null)}
                className="bg-white/10 text-white border-white/20 text-xs h-9 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                disabled={actionLoading}
                onClick={promptStaffTopup}
                className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-yellow-400/20 flex items-center gap-2 cursor-pointer"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing Credit...
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Apply Rs. {topupAmount} Credit
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Register New Smart Meter with NIC and Passcode */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0f11] border border-white/10 rounded-3xl max-w-xl w-full p-6 text-white space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-black font-bold">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Register New Smart Meter</h3>
                  <p className="text-xs text-white/50">Anti-Theft Hardware Registration & NIC Identity Binding</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-white/40 hover:text-white p-1.5 rounded-lg bg-black/40 border border-white/5 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Anti-Theft Notice */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
              <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Anti-Theft Security Enforcement</span>
                <span>The meter will be permanently bound to the specified National Identity Card (NIC). Only a customer authenticated with this NIC can claim and link the meter to their profile.</span>
              </div>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleRegisterMeter} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Meter Serial Number */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-white/70 font-medium">Meter Serial Number *</label>
                    <button
                      type="button"
                      onClick={generateRandomMeterNumber}
                      className="text-[10px] text-yellow-400 hover:underline cursor-pointer"
                    >
                      Generate New
                    </button>
                  </div>
                  <Input
                    required
                    value={registerMeterNumber}
                    onChange={(e) => setRegisterMeterNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. MTR-782910"
                    className="bg-black/40 border-white/10 text-white font-mono h-9 rounded-xl focus-visible:border-yellow-400"
                  />
                </div>

                {/* Account Number */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-white/70 font-medium">Account Number *</label>
                    <button
                      type="button"
                      onClick={generateRandomAccountNumber}
                      className="text-[10px] text-yellow-400 hover:underline cursor-pointer"
                    >
                      Generate New
                    </button>
                  </div>
                  <Input
                    required
                    value={registerAccountNumber}
                    onChange={(e) => setRegisterAccountNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. ACC-9821734"
                    className="bg-black/40 border-white/10 text-white font-mono h-9 rounded-xl focus-visible:border-yellow-400"
                  />
                </div>
              </div>

              {/* Registered Customer NIC */}
              <div className="space-y-1.5">
                <label className="text-white/70 font-medium">Registered Customer NIC (Anti-Theft Binding) *</label>
                <Input
                  required
                  value={registerNic}
                  onChange={(e) => setRegisterNic(e.target.value.toUpperCase())}
                  placeholder="e.g. 199512345678 or 951234567V"
                  className="bg-black/40 border-white/10 text-white font-mono h-9 rounded-xl focus-visible:border-yellow-400"
                />
                <span className="text-[10px] text-white/40 block">Customer must present this National Identity Card (NIC) to claim the meter.</span>
              </div>

              {/* Staff-Issued Security Passcode */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-white/70 font-medium">Customer Security Passcode (6 Digits) *</label>
                  <button
                    type="button"
                    onClick={generateRandomPasscode}
                    className="text-[10px] text-yellow-400 hover:underline cursor-pointer"
                  >
                    Generate Passcode
                  </button>
                </div>
                <div className="relative">
                  <Input
                    required
                    type={showRegisterPasscode ? "text" : "password"}
                    value={registerPasscode}
                    onChange={(e) => setRegisterPasscode(e.target.value)}
                    placeholder="6-digit security PIN"
                    maxLength={10}
                    className="bg-black/40 border-white/10 text-white font-mono font-bold tracking-widest text-sm h-9 rounded-xl pr-10 focus-visible:border-yellow-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPasscode(!showRegisterPasscode)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1 cursor-pointer"
                  >
                    {showRegisterPasscode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-white/40 block">Hand this passcode to the customer along with the official provisioning voucher.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Initial Balance */}
                <div className="space-y-1.5">
                  <label className="text-white/70 font-medium">Initial Credit Balance (LKR)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={registerBalance}
                    onChange={(e) => setRegisterBalance(e.target.value)}
                    placeholder="0.00"
                    className="bg-black/40 border-white/10 text-white font-mono h-9 rounded-xl focus-visible:border-yellow-400"
                  />
                </div>

                {/* Friendly Location Label */}
                <div className="space-y-1.5">
                  <label className="text-white/70 font-medium">Meter Label / Premise</label>
                  <Input
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="e.g. Main Residence, Shop 2"
                    className="bg-black/40 border-white/10 text-white h-9 rounded-xl focus-visible:border-yellow-400"
                  />
                </div>
              </div>

              {/* Staff Password Authorization */}
              <div className="space-y-1.5 pt-2 border-t border-white/5">
                <label className="text-yellow-400 font-semibold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Staff Authorization Password *
                </label>
                <Input
                  required
                  type="password"
                  value={registerStaffPassword}
                  onChange={(e) => setRegisterStaffPassword(e.target.value)}
                  placeholder="Enter your staff account password"
                  className="bg-black/40 border-yellow-400/30 text-white h-9 rounded-xl focus-visible:border-yellow-400"
                />
                <span className="text-[10px] text-white/40 block">Mandatory security barrier to record authorization in staff activity audit ledger.</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  disabled={registerLoading}
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="bg-white/5 border-white/10 text-white text-xs h-9 px-4 rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={registerLoading}
                  className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-bold text-xs h-9 px-5 rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {registerLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Provisioning Meter...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Register & Issue Meter
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Official LECO Meter Handover Voucher Slip */}
      {handoverSlip && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0f11] border border-amber-500/30 rounded-3xl max-w-lg w-full p-6 text-white space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            {/* Slip Header */}
            <div className="text-center pb-4 border-b border-white/10 space-y-1">
              <span className="text-[10px] font-mono tracking-widest text-yellow-400 uppercase font-bold block">
                LANKA ELECTRICITY COMPANY (PVT) LTD
              </span>
              <h3 className="text-xl font-bold text-white">Smart Meter Provisioning Voucher</h3>
              <p className="text-xs text-white/50">Official Customer Handover Document</p>
            </div>

            {/* Anti-Theft Identity Binding Badge */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center space-y-1">
              <span className="text-[11px] uppercase font-bold tracking-wider text-amber-300 block">
                Anti-Theft Hardware Protection
              </span>
              <p className="text-xs text-white/80">
                This meter is registered strictly to National Identity Card (NIC):
              </p>
              <div className="font-mono text-base font-extrabold text-yellow-300 tracking-wider">
                {handoverSlip.registered_nic}
              </div>
              <span className="text-[10px] text-white/50 block">
                The customer must log in with an account registered to this exact NIC to link and activate this meter.
              </span>
            </div>

            {/* Meter Credentials Box */}
            <div className="bg-black/60 border border-white/10 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-white/50">Meter Serial Number:</span>
                <span className="font-mono font-bold text-sm text-white">{handoverSlip.meter_number}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-white/50">Account Number:</span>
                <span className="font-mono font-bold text-sm text-white">{handoverSlip.account_number}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-white/50">Premise Label:</span>
                <span className="font-medium text-white">{handoverSlip.name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-white/50">Initial Balance Credited:</span>
                <span className="font-mono font-bold text-emerald-400">Rs. {handoverSlip.initial_balance.toFixed(2)}</span>
              </div>

              {/* Large Passcode Highlight */}
              <div className="pt-2">
                <span className="text-[11px] text-white/60 block mb-1 font-medium">Customer Security Passcode:</span>
                <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-3 flex items-center justify-between">
                  <span className="font-mono text-2xl font-extrabold text-yellow-300 tracking-widest">
                    {handoverSlip.passcode}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyText(handoverSlip.passcode, setSlipCopied)}
                    className="bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border-yellow-400/40 text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    {slipCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {slipCopied ? "Copied" : "Copy Passcode"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-1.5 text-[11px] text-white/60 bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="font-bold text-white block">Instructions for the Customer:</span>
              <p>1. Open the LECO Smart Electricity app or web dashboard.</p>
              <p>2. Ensure customer profile is registered under NIC <strong>{handoverSlip.registered_nic}</strong>.</p>
              <p>3. Go to <strong>Add Meter</strong> and enter the Meter Number, Account Number, and Security Passcode.</p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
              <Button
                variant="outline"
                onClick={handlePrintSlip}
                className="bg-white/5 border-white/10 text-white text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-yellow-400" />
                Print Handover Slip
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const fullText = `LECO SMART METER PROVISIONING VOUCHER\nMeter Number: ${handoverSlip.meter_number}\nAccount Number: ${handoverSlip.account_number}\nRegistered NIC: ${handoverSlip.registered_nic}\nSecurity Passcode: ${handoverSlip.passcode}\nInitial Balance: Rs. ${handoverSlip.initial_balance.toFixed(2)}`
                    handleCopyText(fullText, setSlipCopied)
                  }}
                  className="bg-white/5 border-white/10 text-white text-xs h-9 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5 text-yellow-400" />
                  Copy Voucher
                </Button>
                <Button
                  onClick={() => setHandoverSlip(null)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs h-9 px-4 rounded-xl shadow-lg cursor-pointer"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Security Passcode Management & Regeneration */}
      {passcodeModalMeter && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0f11] border border-white/10 rounded-3xl max-w-lg w-full p-6 text-white space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-bold">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Security Passcode Management</h3>
                  <p className="text-xs text-white/50">Meter #{passcodeModalMeter.meter_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasscodeModalMeter(null)}
                className="text-white/40 hover:text-white p-1.5 rounded-lg bg-black/40 border border-white/5 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Anti-Theft Binding Details */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-white/50">Registered NIC (Anti-Theft):</span>
                <span className="font-mono text-yellow-300 font-bold bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                  {passcodeModalMeter.registered_nic || passcodeModalMeter.customer_nic || "Not Bound"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Account Number:</span>
                <span className="font-mono text-white font-semibold">{passcodeModalMeter.account_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Customer Account:</span>
                <span className="text-white font-semibold">{passcodeModalMeter.customer_email || "Awaiting Customer Link"}</span>
              </div>
            </div>

            {/* Current Passcode Display */}
            <div className="space-y-1.5">
              <span className="text-xs text-white/70 font-medium block">Current Provisioned Passcode:</span>
              <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-3 flex items-center justify-between">
                <span className="font-mono text-xl font-extrabold text-yellow-300 tracking-widest">
                  {activePasscodeDisplay || (
                    <span className="text-xs text-white/50 font-normal tracking-normal italic">
                      Secured with Cryptographic Bcrypt Hash
                    </span>
                  )}
                </span>
                {activePasscodeDisplay && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyText(activePasscodeDisplay, setPasscodeCopied)}
                    className="bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border-yellow-400/40 text-xs h-8 px-3 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    {passcodeCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {passcodeCopied ? "Copied" : "Copy"}
                  </Button>
                )}
              </div>
            </div>

            {/* Regenerate Passcode Section */}
            <form onSubmit={handleRegeneratePasscode} className="space-y-3 pt-3 border-t border-white/10 text-xs">
              <div className="flex items-center gap-2 text-yellow-400 font-bold uppercase text-[11px] tracking-wider">
                <Lock className="h-3.5 w-3.5" />
                Regenerate Passcode with Staff Authorization
              </div>
              <p className="text-white/50 text-[11px]">
                If the customer lost their handover voucher, generate a new passcode here after verifying their physical National Identity Card (NIC).
              </p>

              <div className="space-y-1.5">
                <label className="text-white/70 font-medium">Custom Passcode (Optional - leave blank to auto-generate 6 digits)</label>
                <Input
                  value={customPasscode}
                  onChange={(e) => setCustomPasscode(e.target.value)}
                  placeholder="e.g. 849201"
                  className="bg-black/40 border-white/10 text-white font-mono h-9 rounded-xl focus-visible:border-yellow-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-yellow-400 font-medium">Staff Password Authorization *</label>
                <Input
                  required
                  type="password"
                  value={passcodeStaffPassword}
                  onChange={(e) => setPasscodeStaffPassword(e.target.value)}
                  placeholder="Enter your staff password to confirm"
                  className="bg-black/40 border-yellow-400/30 text-white h-9 rounded-xl focus-visible:border-yellow-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPasscodeModalMeter(null)}
                  className="bg-white/5 border-white/10 text-white text-xs h-9 px-4 rounded-xl cursor-pointer"
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  disabled={passcodeRegenerating}
                  className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-xs h-9 px-4 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  {passcodeRegenerating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-3.5 w-3.5" />
                      Regenerate Passcode
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {passwordModalConfig && (
        <StaffPasswordConfirmModal
          isOpen={passwordModalConfig.isOpen}
          onClose={() => setPasswordModalConfig(null)}
          onSuccess={passwordModalConfig.onConfirm}
          title={passwordModalConfig.title}
          description={passwordModalConfig.description}
          confirmButtonText={passwordModalConfig.confirmButtonText}
          isDestructive={passwordModalConfig.isDestructive}
          getAuthHeaders={getAuthHeaders}
        />
      )}
    </div>
  )
}
