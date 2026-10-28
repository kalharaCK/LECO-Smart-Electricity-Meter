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
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Cpu,
  Loader2,
  X,
  ChevronRight,
  Download,
  Lock,
  Plus,
  KeyRound,
  ShieldCheck,
  Copy,
  Check,
  Printer,
  Eye,
  EyeOff,
  Radio,
  UserCheck,
  UserPlus
} from "lucide-react"
import type { StaffMeter, HardwareTelemetryMeter } from "../types"
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
  // Search, filter & sorting
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "connected" | "disconnected" | "lifeline" | "low_balance">("all")
  const [sortBy, setSortBy] = useState<"id" | "balance_asc" | "balance_desc" | "today_kwh">("id")

  // Active modals
  const [activeMeterDetail, setActiveMeterDetail] = useState<StaffMeter | null>(null)
  const [relayModalMeter, setRelayModalMeter] = useState<StaffMeter | null>(null)
  const [topupModalMeter, setTopupModalMeter] = useState<StaffMeter | null>(null)
  const [passcodeModalMeter, setPasscodeModalMeter] = useState<StaffMeter | null>(null)
  const [assignModalMeter, setAssignModalMeter] = useState<StaffMeter | null>(null)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)

  // Actions states
  const [actionReason, setActionReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [topupAmount, setTopupAmount] = useState<number>(500)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const [downloadingStatement, setDownloadingStatement] = useState(false)

  // Meter Registration states
  const [registerMeterNumber, setRegisterMeterNumber] = useState("")
  const [registerAccountNumber, setRegisterAccountNumber] = useState("")
  const [registerNic, setRegisterNic] = useState("")
  const [registerPasscode, setRegisterPasscode] = useState("")
  const [registerBalance, setRegisterBalance] = useState("0.00")
  const [registerName, setRegisterName] = useState("Main Residence")
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

  // Passcode modal states
  const [passcodeStaffPassword, setPasscodeStaffPassword] = useState("")
  const [customPasscode, setCustomPasscode] = useState("")
  const [activePasscodeDisplay, setActivePasscodeDisplay] = useState("")
  const [passcodeRegenerating, setPasscodeRegenerating] = useState(false)
  const [passcodeCopied, setPasscodeCopied] = useState(false)

  // Hardware Telemetry & Customer Assignment states
  const [hardwareMeters, setHardwareMeters] = useState<HardwareTelemetryMeter[]>([])
  const [assignCustomerId, setAssignCustomerId] = useState("")
  const [assignCustomerNic, setAssignCustomerNic] = useState("")
  const [assignPasscode, setAssignPasscode] = useState("719302")
  const [assignBalance, setAssignBalance] = useState("1500.00")
  const [assignName, setAssignName] = useState("Main Residence")
  const [assignStaffPassword, setAssignStaffPassword] = useState("")
  const [assignLoading, setAssignLoading] = useState(false)
  const [customersList, setCustomersList] = useState<Array<{ id: number; full_name?: string; email: string; nic?: string; mobile_number?: string }>>([])

  // Inspector detail tabs
  const [detailTab, setDetailTab] = useState<"overview" | "customer" | "telemetry">("overview")

  // Password confirmation modal for sensitive operations
  const [passwordModalConfig, setPasswordModalConfig] = useState<{
    isOpen: boolean
    title: string
    description: string
    confirmButtonText: string
    isDestructive?: boolean
    onConfirm: () => Promise<void> | void
  } | null>(null)

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Fetch Hardware & Customers
  const fetchHardwareMeters = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/meters/unregistered-hardware`, {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.hardwareMeters)) {
          setHardwareMeters(data.hardwareMeters)
        }
      }
    } catch (err) {
      console.error("Error fetching hardware meters:", err)
    }
  }

  const fetchCustomersList = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/customers`, {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.customers)) {
          setCustomersList(data.customers)
        }
      }
    } catch (err) {
      console.error("Error fetching customers list:", err)
    }
  }

  useEffect(() => {
    fetchHardwareMeters()
    fetchCustomersList()
  }, [])

  // Keep active meter synchronized live with incoming WebSocket fleet updates
  useEffect(() => {
    if (activeMeterDetail) {
      const latest = meters.find((m) => m.id === activeMeterDetail.id)
      if (latest) {
        setActiveMeterDetail(latest)
      }
    }
  }, [meters])

  // Generator Helpers
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

  // Register Meter Handler
  const handleRegisterMeter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!registerMeterNumber.trim()) {
      showToast("Meter serial number is required.", "error")
      return
    }
    if (!registerAccountNumber.trim()) {
      showToast("Account number is required.", "error")
      return
    }
    if (!registerNic.trim()) {
      showToast("Registered Customer NIC is required for Anti-Theft Protection.", "error")
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
          name: registerName.trim() || "Main Residence",
          staff_password: registerStaffPassword
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(data.message || "Meter registered and provisioned successfully.", "success")
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

  // Passcode Modal Handler
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
      showToast("Staff password is required to authorize passcode regeneration.", "error")
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

  // Customer Assignment Handler
  const handleOpenAssignModal = (meter: StaffMeter) => {
    setAssignModalMeter(meter)
    setAssignCustomerId("")
    setAssignCustomerNic(meter.registered_nic || "")
    setAssignPasscode(meter.staff_passcode || "719302")
    const curBal = parseFloat(String(meter.balance))
    setAssignBalance(curBal > 0 ? curBal.toFixed(2) : "1500.00")
    setAssignName(meter.name || "Main Residence")
    setAssignStaffPassword("")
    if (customersList.length === 0) {
      fetchCustomersList()
    }
  }

  const handleExecuteAssignMeter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignModalMeter) return
    if (!assignCustomerId && !assignCustomerNic.trim()) {
      showToast("Please choose a registered customer or provide a customer NIC.", "error")
      return
    }
    if (!assignStaffPassword) {
      showToast("Staff password is required to authorize assignment.", "error")
      return
    }

    setAssignLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/meters/${assignModalMeter.id}/assign`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          customerId: assignCustomerId ? Number(assignCustomerId) : undefined,
          customerNic: assignCustomerNic.trim() || undefined,
          passcode: assignPasscode.trim(),
          initialBalance: parseFloat(assignBalance) || 0,
          name: assignName.trim() || "Main Residence",
          staffPassword: assignStaffPassword
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(data.message || "Meter assigned to customer successfully.", "success")
        setAssignModalMeter(null)
        setAssignStaffPassword("")
        if (data.voucher) {
          setHandoverSlip({
            meter_number: data.voucher.meterNumber,
            account_number: data.voucher.accountNumber,
            registered_nic: data.voucher.customerNic || assignCustomerNic,
            passcode: data.voucher.passcode,
            initial_balance: data.voucher.balance,
            name: assignName
          })
        }
        onRefresh()
        fetchHardwareMeters()
      } else {
        showToast(data.message || "Failed to assign meter.", "error")
      }
    } catch (err) {
      console.error("Assign meter error:", err)
      showToast("Network error executing meter assignment.", "error")
    } finally {
      setAssignLoading(false)
    }
  }

  // Relay Toggle Execution
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
          reason: actionReason || `Staff manual supply override to ${newTargetStatus}`
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(`Meter ${relayModalMeter.meter_number} relay set to ${newTargetStatus}.`, "success")
        if (activeMeterDetail && activeMeterDetail.id === relayModalMeter.id) {
          setActiveMeterDetail({ ...activeMeterDetail, status: newTargetStatus })
        }
        setRelayModalMeter(null)
        setActionReason("")
        onRefresh()
      } else {
        showToast(data.message || "Failed to update relay state.", "error")
      }
    } catch (err) {
      console.error("Relay toggle error:", err)
      showToast("Network error updating relay state.", "error")
    } finally {
      setActionLoading(false)
    }
  }

  const promptToggleRelay = () => {
    if (!relayModalMeter) return
    const isDisconnect = relayModalMeter.status === "Connected"
    setPasswordModalConfig({
      isOpen: true,
      title: isDisconnect ? "Confirm Supply Disconnection" : "Confirm Supply Restoration",
      description: `You are about to remotely ${isDisconnect ? "DISCONNECT and cut off" : "RESTORE"} electricity for meter ${relayModalMeter.meter_number}. Enter staff password to authorize.`,
      confirmButtonText: isDisconnect ? "Cut Off Supply" : "Restore Supply",
      isDestructive: isDisconnect,
      onConfirm: executeToggleRelay
    })
  }

  // Staff Topup Execution
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
        showToast(`Credited Rs. ${topupAmount.toFixed(2)} to ${topupModalMeter.meter_number}.`, "success")
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
        showToast(data.message || "Failed to credit meter.", "error")
      }
    } catch (err) {
      console.error("Staff top-up error:", err)
      showToast("Network error executing credit adjustment.", "error")
    } finally {
      setActionLoading(false)
    }
  }

  const promptStaffTopup = () => {
    if (!topupModalMeter) return
    setPasswordModalConfig({
      isOpen: true,
      title: "Authorize Credit Adjustment",
      description: `Apply manual credit relief of Rs. ${topupAmount.toFixed(2)} to meter ${topupModalMeter.meter_number}. Confirm with your staff password.`,
      confirmButtonText: "Apply Credit",
      isDestructive: false,
      onConfirm: executeStaffTopup
    })
  }

  // Statement PDF
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

  // Copy helper
  const handleCopyText = (text: string, setCopiedState: (v: boolean) => void) => {
    navigator.clipboard.writeText(text)
    setCopiedState(true)
    setTimeout(() => setCopiedState(false), 2500)
  }

  // Export CSV
  const handleExportCsv = () => {
    if (filteredMeters.length === 0) return
    const headers = [
      "ID",
      "Meter Number",
      "Account Number",
      "Premise",
      "Customer Email",
      "Customer Phone",
      "Status",
      "Balance (LKR)",
      "Today (kWh)",
      "Total (kWh)",
      "Tariff",
      "Lifeline Active"
    ]
    const rows = filteredMeters.map((m) => [
      m.id,
      m.meter_number,
      m.account_number,
      m.name || "Main Residence",
      m.customer_email || "Unassigned",
      m.phone_number || "N/A",
      m.status,
      parseFloat(String(m.balance)).toFixed(2),
      parseFloat(String(m.today_kwh)).toFixed(2),
      parseFloat(String(m.total_kwh)).toFixed(1),
      m.tariff_type || "N/A",
      m.emergency_credit_active ? "Yes" : "No"
    ])
    const csvContent = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `LECO_Smart_Meters_Fleet_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filtered & Sorted Meters
  const filteredMeters = meters
    .filter((m) => {
      const q = searchTerm.toLowerCase().trim()
      const matchSearch =
        !q ||
        m.meter_number.toLowerCase().includes(q) ||
        m.account_number.toLowerCase().includes(q) ||
        (m.customer_email && m.customer_email.toLowerCase().includes(q)) ||
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.registered_nic && m.registered_nic.toLowerCase().includes(q)) ||
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

  // Summary Metrics
  const totalMetersCount = meters.length
  const connectedCount = meters.filter((m) => m.status === "Connected").length
  const disconnectedCount = meters.filter((m) => m.status === "Disconnected").length
  const lifelineCount = meters.filter((m) => m.emergency_credit_active).length
  const totalTodayKwh = meters.reduce((acc, m) => acc + (parseFloat(String(m.today_kwh)) || 0), 0)

  // Detect unassigned hardware streaming
  const activeUnclaimedHw = hardwareMeters.find((h) => !h.is_claimed) ||
                            meters.find((m) => m.has_hardware_telemetry && !m.is_claimed)

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 text-sm font-semibold ${
            toastMessage.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/90 border-rose-500/40 text-rose-200"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Sleek Hardware Detection Banner (shown only when an unclaimed streaming meter exists) */}
      {activeUnclaimedHw && (
        <div className="bg-[#12161f] border border-emerald-500/30 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Live Physical Meter Detected</span>
                <span className="font-mono text-xs font-bold text-yellow-300 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                  {"meter_id" in activeUnclaimedHw ? activeUnclaimedHw.meter_id : activeUnclaimedHw.meter_number}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Online
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Streaming telemetry is ready for customer allocation or official registration.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Button
              onClick={() => {
                const meterId = "meter_id" in activeUnclaimedHw ? activeUnclaimedHw.meter_id : activeUnclaimedHw.meter_number
                const targetStaffMeter = meters.find((m) => m.meter_number.toUpperCase() === meterId.toUpperCase())
                if (targetStaffMeter) {
                  handleOpenAssignModal(targetStaffMeter)
                } else {
                  setRegisterMeterNumber(meterId)
                  setRegisterAccountNumber(`ACC-${meterId}`)
                  setRegisterPasscode("719302")
                  setRegisterBalance("1500.00")
                  setIsRegisterModalOpen(true)
                }
              }}
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs h-8 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Assign to Customer
            </Button>
          </div>
        </div>
      )}

      {/* 4 Clean Metric Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Fleet */}
        <div className="bg-[#121215] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-white/60 font-medium">
            <span>Total Smart Meters</span>
            <div className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white tracking-tight">{totalMetersCount}</div>
            <div className="text-xs text-white/50 mt-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Full AMI Telemetry Monitored</span>
            </div>
          </div>
        </div>

        {/* Connected Meters */}
        <div className="bg-[#121215] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-white/60 font-medium">
            <span>Grid Connected</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">{connectedCount}</div>
            <div className="text-xs text-emerald-500/80 mt-1">
              Relays Closed &bull; Active Supply
            </div>
          </div>
        </div>

        {/* Disconnected Meters */}
        <div className="bg-[#121215] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-white/60 font-medium">
            <span>Supply Cut Off</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ZapOff className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-rose-400 tracking-tight">{disconnectedCount}</div>
            <div className="text-xs text-rose-500/80 mt-1">
              Relays Open &bull; Zero Balance / Manual
            </div>
          </div>
        </div>

        {/* Today's Grid Load */}
        <div className="bg-[#121215] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-white/60 font-medium">
            <span>Today's Fleet Load</span>
            <div className="w-8 h-8 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white tracking-tight">{totalTodayKwh.toFixed(1)} <span className="text-sm font-normal text-white/60">kWh</span></div>
            <div className="text-xs text-white/50 mt-1">
              {lifelineCount > 0 ? `${lifelineCount} on emergency lifeline` : "Normal operation"}
            </div>
          </div>
        </div>
      </div>

      {/* Clean Controls & Action Bar */}
      <div className="bg-[#121215] border border-white/5 rounded-2xl p-4 shadow-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Meter #, Account #, Email, NIC..."
            className="pl-10 bg-black/40 border-white/10 text-white placeholder:text-white/40 text-xs h-10 rounded-xl focus-visible:border-yellow-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-yellow-400 text-black shadow-md font-bold"
                : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            All ({meters.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("connected")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "connected"
                ? "bg-emerald-500 text-black shadow-md font-bold"
                : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            Connected ({connectedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("disconnected")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "disconnected"
                ? "bg-rose-500 text-white shadow-md font-bold"
                : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            Cut Off ({disconnectedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("lifeline")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "lifeline"
                ? "bg-amber-400 text-black shadow-md font-bold"
                : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            Lifeline ({lifelineCount})
          </button>
        </div>

        {/* Primary CTA & Secondary Tools */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 px-3 py-2 rounded-xl text-xs text-white/70">
            <SlidersHorizontal className="h-3.5 w-3.5 text-yellow-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white text-xs border-none outline-none cursor-pointer"
            >
              <option value="id" className="bg-[#121215] text-white">Default Sort</option>
              <option value="balance_asc" className="bg-[#121215] text-white">Lowest Balance</option>
              <option value="balance_desc" className="bg-[#121215] text-white">Highest Balance</option>
              <option value="today_kwh" className="bg-[#121215] text-white">Highest Usage Today</option>
            </select>
          </div>

          <Button
            onClick={handleOpenRegisterModal}
            className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold h-10 px-4 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-yellow-400/20 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Register Meter
          </Button>

          <Button
            onClick={onRefresh}
            variant="outline"
            className="bg-black/40 border-white/10 hover:bg-white/10 text-white h-10 px-3 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            title="Refresh Fleet Telemetry"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-yellow-400" : ""}`} />
          </Button>

          <Button
            onClick={handleExportCsv}
            disabled={filteredMeters.length === 0}
            variant="outline"
            className="bg-black/40 border-white/10 hover:bg-white/10 text-white h-10 px-3 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            title="Export Fleet CSV"
          >
            <Download className="h-3.5 w-3.5 text-yellow-400" />
          </Button>
        </div>
      </div>

      {/* Streamlined Fleet Table */}
      {loading ? (
        <div className="py-20 text-center text-white/50 flex flex-col items-center justify-center gap-3 bg-[#121215] border border-white/5 rounded-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
          <span className="text-xs">Synchronizing smart meter telemetry...</span>
        </div>
      ) : filteredMeters.length === 0 ? (
        <div className="p-12 text-center bg-[#121215] border border-white/5 rounded-2xl text-white/50 space-y-2">
          <Cpu className="h-8 w-8 mx-auto text-white/30" />
          <p className="text-sm font-semibold text-white">No smart meters match your query.</p>
          <p className="text-xs text-white/40">Try adjusting your search terms or filters.</p>
        </div>
      ) : (
        <div className="bg-[#121215] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-black/30 text-[11px] font-bold uppercase tracking-wider text-white/50">
                  <th className="py-3.5 px-5">Smart Meter</th>
                  <th className="py-3.5 px-5">Customer & NIC</th>
                  <th className="py-3.5 px-5">Supply Status</th>
                  <th className="py-3.5 px-5">Prepaid Balance</th>
                  <th className="py-3.5 px-5">Usage Today</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMeters.map((meter) => {
                  const balanceNum = parseFloat(String(meter.balance))
                  const isConnected = meter.status === "Connected"
                  const isLifeline = meter.emergency_credit_active
                  const isLow = balanceNum <= meter.low_balance_threshold

                  return (
                    <tr
                      key={meter.id}
                      onClick={() => setActiveMeterDetail(meter)}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      {/* Meter ID & Account */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white group-hover:text-yellow-400 transition-colors">
                            {meter.meter_number}
                          </span>
                          {meter.has_hardware_telemetry && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono">
                              Live
                            </span>
                          )}
                          {meter.open_complaints_count > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              {meter.open_complaints_count} ticket
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-white/50 text-[11px] mt-0.5">
                          <Building2 className="h-3 w-3 text-yellow-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{meter.name || "Main Residence"}</span>
                          <span className="text-white/20">&bull;</span>
                          <span className="font-mono text-white/40">{meter.account_number}</span>
                        </div>
                      </td>

                      {/* Customer & NIC */}
                      <td className="py-4 px-5">
                        <div className="font-medium text-white truncate max-w-[200px]">
                          {meter.customer_email || (
                            <span className="text-amber-300 font-semibold italic text-[11px] flex items-center gap-1">
                              Unassigned Meter
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-white/50 mt-0.5">
                          {meter.registered_nic ? (
                            <span className="font-mono font-semibold text-yellow-300 bg-yellow-400/10 px-1.5 py-0.2 rounded border border-yellow-400/20 text-[10px]">
                              NIC: {meter.registered_nic}
                            </span>
                          ) : (
                            <span>{meter.phone_number || "No contact"}</span>
                          )}
                        </div>
                      </td>

                      {/* Supply Status */}
                      <td className="py-4 px-5">
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
                      </td>

                      {/* Prepaid Balance */}
                      <td className="py-4 px-5">
                        <div
                          className={`font-mono font-bold text-sm ${
                            balanceNum < 0
                              ? "text-rose-400"
                              : isLow
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }`}
                        >
                          Rs. {balanceNum.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          {isLifeline ? (
                            <span className="text-amber-400 font-semibold">Lifeline Buffer Active</span>
                          ) : (
                            <span>{meter.tariff_type || "Domestic Tariff"}</span>
                          )}
                        </div>
                      </td>

                      {/* Usage Today */}
                      <td className="py-4 px-5">
                        <div className="font-semibold text-white">
                          {parseFloat(String(meter.today_kwh)).toFixed(2)} kWh
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5 font-mono">
                          {parseFloat(String(meter.total_kwh)).toFixed(1)} kWh Total
                        </div>
                      </td>

                      {/* Quick Actions (Focused & Clean) */}
                      <td
                        className="py-4 px-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Credit */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setTopupModalMeter(meter)}
                            className="bg-yellow-400/10 hover:bg-yellow-400/20 border-yellow-400/30 text-yellow-300 text-xs h-8 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer"
                            title="Apply credit adjustment"
                          >
                            <CreditCard className="h-3 w-3" />
                            Credit
                          </Button>

                          {/* Quick Relay Toggle */}
                          <Button
                            size="sm"
                            onClick={() => setRelayModalMeter(meter)}
                            className={`text-xs h-8 px-2.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer ${
                              isConnected
                                ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40"
                                : "bg-emerald-500 hover:bg-emerald-600 text-black shadow-md"
                            }`}
                            title={isConnected ? "Cut off electricity supply" : "Restore electricity supply"}
                          >
                            <Power className="h-3 w-3" />
                            {isConnected ? "Cutoff" : "Restore"}
                          </Button>

                          {/* Inspect Details */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setActiveMeterDetail(meter)}
                            className="text-white/40 hover:text-white p-1.5 h-8 w-8 rounded-lg cursor-pointer"
                            title="View full meter details"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP 1: Meter Detail Workspace / Inspector
         ========================================================================= */}
      {activeMeterDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-white/10 rounded-3xl max-w-2xl w-full p-6 text-white space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400 shrink-0">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-mono font-bold text-white tracking-wide">
                      {activeMeterDetail.meter_number}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        activeMeterDetail.status === "Connected"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${activeMeterDetail.status === "Connected" ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
                      {activeMeterDetail.status === "Connected" ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">
                    Account: <strong className="font-mono text-white/80">{activeMeterDetail.account_number}</strong> &bull; Premise: {activeMeterDetail.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveMeterDetail(null)}
                className="text-white/40 hover:text-white p-1.5 rounded-xl bg-black/40 border border-white/10 cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Clean Detail Tabs */}
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <button
                type="button"
                onClick={() => setDetailTab("overview")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  detailTab === "overview"
                    ? "bg-white/10 text-white font-bold"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Overview & Balance
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("customer")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  detailTab === "customer"
                    ? "bg-white/10 text-white font-bold"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Customer & Passcode
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("telemetry")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  detailTab === "telemetry"
                    ? "bg-white/10 text-white font-bold"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Live Telemetry & Usage
              </button>
            </div>

            {/* Tab Contents */}
            {detailTab === "overview" && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2">
                  <span className="text-[11px] text-white/40 uppercase font-bold tracking-wider block">Prepaid Balance</span>
                  <div className="text-2xl font-mono font-bold text-emerald-400">
                    Rs. {parseFloat(String(activeMeterDetail.balance)).toFixed(2)}
                  </div>
                  <div className="text-white/60">
                    Low Balance Threshold: Rs. {activeMeterDetail.low_balance_threshold}
                  </div>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2">
                  <span className="text-[11px] text-white/40 uppercase font-bold tracking-wider block">Tariff & Lifeline</span>
                  <div className="text-sm font-semibold text-yellow-300">
                    {activeMeterDetail.tariff_type || "Domestic Tariff Tier"}
                  </div>
                  <div className="text-white/60">
                    Lifeline Credit: {activeMeterDetail.emergency_credit_active ? "Active (-Rs. 500 Buffer)" : "Eligible (Normal)"}
                  </div>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2 col-span-2">
                  <div className="flex justify-between items-center text-white/60 py-1 border-b border-white/5">
                    <span>Daily kWh Budget:</span>
                    <span className="font-semibold text-white">{activeMeterDetail.daily_kwh_budget} kWh/day</span>
                  </div>
                  <div className="flex justify-between items-center text-white/60 py-1">
                    <span>Open Customer Tickets:</span>
                    <div className="flex items-center gap-2">
                      <span className={activeMeterDetail.open_complaints_count > 0 ? "font-bold text-rose-400" : "text-emerald-400 font-semibold"}>
                        {activeMeterDetail.open_complaints_count} Open Issue(s)
                      </span>
                      {activeMeterDetail.open_complaints_count > 0 && onSelectComplaintTabWithMeter && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const num = activeMeterDetail.meter_number
                            setActiveMeterDetail(null)
                            onSelectComplaintTabWithMeter(num)
                          }}
                          className="h-6 px-2 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30 cursor-pointer"
                        >
                          View Tickets
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detailTab === "customer" && (
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-white/50">Registered Email:</span>
                  <span className="font-medium text-white">{activeMeterDetail.customer_email || "Unassigned"}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-white/50">Registered NIC (Anti-Theft):</span>
                  <span className="font-mono font-bold text-yellow-300 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                    {activeMeterDetail.registered_nic || activeMeterDetail.customer_nic || "Not Bound"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-white/50">Contact Phone:</span>
                  <span className="font-mono text-white">{activeMeterDetail.phone_number || "Not Registered"}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-white/50">Installation Date:</span>
                  <span className="text-white/70">
                    {new Date(activeMeterDetail.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                {activeMeterDetail.staff_passcode && (
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-white/50">Initial Passcode:</span>
                    <span className="font-mono font-bold text-yellow-300">{activeMeterDetail.staff_passcode}</span>
                  </div>
                )}
              </div>
            )}

            {detailTab === "telemetry" && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-1">
                  <span className="text-[11px] text-white/40 uppercase font-bold tracking-wider block">Today's Usage</span>
                  <div className="text-xl font-bold text-white font-mono">
                    {parseFloat(String(activeMeterDetail.today_kwh)).toFixed(2)} kWh
                  </div>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-1">
                  <span className="text-[11px] text-white/40 uppercase font-bold tracking-wider block">Lifetime Cumulative</span>
                  <div className="text-xl font-bold text-white font-mono">
                    {parseFloat(String(activeMeterDetail.total_kwh)).toFixed(1)} kWh
                  </div>
                </div>

                {activeMeterDetail.has_hardware_telemetry && (
                  <div className="bg-black/40 border border-emerald-500/20 rounded-2xl p-4 col-span-2 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <Radio className="h-4 w-4 animate-pulse" />
                      Live Physical Hardware Telemetry
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-white/70">
                      <div>Voltage: <strong className="text-white font-mono">{activeMeterDetail.hardware_voltage || "230.0"} V</strong></div>
                      <div>Energy: <strong className="text-white font-mono">{activeMeterDetail.hardware_energy || "0.000"} kWh</strong></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Operational Actions Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setTopupModalMeter(activeMeterDetail)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs h-9 px-3.5 rounded-xl cursor-pointer"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Grant Relief Credit
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleOpenPasscodeModal(activeMeterDetail)}
                  variant="outline"
                  className="bg-amber-400/10 hover:bg-amber-400/20 border-amber-400/30 text-amber-300 text-xs h-9 px-3.5 rounded-xl font-bold cursor-pointer"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Passcode
                </Button>

                <Button
                  size="sm"
                  onClick={() => setRelayModalMeter(activeMeterDetail)}
                  className={`text-xs h-9 px-3.5 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer ${
                    activeMeterDetail.status === "Connected"
                      ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40"
                      : "bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {activeMeterDetail.status === "Connected" ? "Cutoff Supply" : "Restore Supply"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadStatementPdf(activeMeterDetail)}
                  disabled={downloadingStatement}
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-white text-xs h-9 px-3 rounded-xl cursor-pointer"
                  title="Download PDF statement"
                >
                  {downloadingStatement ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Statement
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveMeterDetail(null)}
                className="bg-white/5 border-white/10 text-white text-xs h-9 px-4 rounded-xl cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP 2: Register New Smart Meter (Clean, Intuitive & Sectioned)
         ========================================================================= */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-white/10 rounded-3xl max-w-lg w-full p-6 text-white space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-black font-bold">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Register New Smart Meter</h3>
                  <p className="text-xs text-white/50">Anti-Theft Hardware Protection & NIC Identity Binding</p>
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

            {/* Registration Form */}
            <form onSubmit={handleRegisterMeter} className="space-y-4 text-xs">
              {/* Section 1: Meter Identifiers */}
              <div className="space-y-3 bg-black/40 border border-white/5 p-4 rounded-2xl">
                <span className="text-[11px] uppercase font-bold text-white/60 tracking-wider block">
                  1. Hardware Identifiers
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-white/80 font-medium">Meter Serial Number *</label>
                      <button
                        type="button"
                        onClick={generateRandomMeterNumber}
                        className="text-[10px] text-yellow-400 hover:underline cursor-pointer"
                      >
                        Auto-Generate
                      </button>
                    </div>
                    <Input
                      required
                      value={registerMeterNumber}
                      onChange={(e) => setRegisterMeterNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. MTR-782910"
                      className="bg-black/60 border-white/10 text-white font-mono h-9 rounded-xl focus-visible:border-yellow-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-white/80 font-medium">Account Number *</label>
                      <button
                        type="button"
                        onClick={generateRandomAccountNumber}
                        className="text-[10px] text-yellow-400 hover:underline cursor-pointer"
                      >
                        Auto-Generate
                      </button>
                    </div>
                    <Input
                      required
                      value={registerAccountNumber}
                      onChange={(e) => setRegisterAccountNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. ACC-9821734"
                      className="bg-black/60 border-white/10 text-white font-mono h-9 rounded-xl focus-visible:border-yellow-400"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Customer Identity & Security Passcode */}
              <div className="space-y-3 bg-black/40 border border-white/5 p-4 rounded-2xl">
                <span className="text-[11px] uppercase font-bold text-white/60 tracking-wider block">
                  2. Anti-Theft NIC Binding & Passcode
                </span>

                <div className="space-y-1.5">
                  <label className="text-white/80 font-medium block">
                    Registered Customer NIC (National Identity Card) *
                  </label>
                  <Input
                    required
                    value={registerNic}
                    onChange={(e) => setRegisterNic(e.target.value.toUpperCase())}
                    placeholder="e.g. 199512345678 or 951234567V"
                    className="bg-black/60 border-white/10 text-white font-mono h-9 rounded-xl focus-visible:border-yellow-400"
                  />
                  <span className="text-[10px] text-white/40 block">
                    Prevents meter theft. The meter will be permanently linked to this NIC.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-white/80 font-medium">Customer Security Passcode (6 Digits) *</label>
                    <button
                      type="button"
                      onClick={generateRandomPasscode}
                      className="text-[10px] text-yellow-400 hover:underline cursor-pointer"
                    >
                      Regenerate
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
                      className="bg-black/60 border-white/10 text-white font-mono font-bold tracking-widest text-sm h-9 rounded-xl pr-10 focus-visible:border-yellow-400 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPasscode(!showRegisterPasscode)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1 cursor-pointer"
                    >
                      {showRegisterPasscode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 3: Initial Setup & Staff Password */}
              <div className="space-y-3 bg-black/40 border border-white/5 p-4 rounded-2xl">
                <span className="text-[11px] uppercase font-bold text-white/60 tracking-wider block">
                  3. Setup & Authorization
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-white/80 font-medium block">Premise Label</label>
                    <Input
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      placeholder="e.g. Main Residence"
                      className="bg-black/60 border-white/10 text-white h-9 rounded-xl focus-visible:border-yellow-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-white/80 font-medium block">Initial Credit (LKR)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={registerBalance}
                      onChange={(e) => setRegisterBalance(e.target.value)}
                      placeholder="0.00"
                      className="bg-black/60 border-white/10 text-white font-mono h-9 rounded-xl focus-visible:border-yellow-400"
                    />
                  </div>
                </div>

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
                    placeholder="Enter your LECO staff password"
                    className="bg-black/60 border-yellow-400/30 text-white h-9 rounded-xl focus-visible:border-yellow-400"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
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
                  className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold text-xs h-9 px-5 rounded-xl shadow-lg shadow-yellow-400/20 flex items-center gap-2 cursor-pointer"
                >
                  {registerLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Provisioning...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Register & Provision Meter
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP 3: Official Provisioning Voucher Slip
         ========================================================================= */}
      {handoverSlip && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-amber-500/30 rounded-3xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center pb-3 border-b border-white/10 space-y-1">
              <span className="text-[10px] font-mono tracking-widest text-yellow-400 uppercase font-bold block">
                LANKA ELECTRICITY COMPANY (PVT) LTD
              </span>
              <h3 className="text-lg font-bold text-white">Smart Meter Provisioning Voucher</h3>
              <p className="text-xs text-white/50">Official Customer Handover Document</p>
            </div>

            {/* Voucher Details */}
            <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-white/50">Meter Serial Number:</span>
                <span className="font-mono font-bold text-sm text-white">{handoverSlip.meter_number}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-white/50">Account Number:</span>
                <span className="font-mono font-bold text-sm text-white">{handoverSlip.account_number}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-white/50">Bound Customer NIC:</span>
                <span className="font-mono font-bold text-yellow-300">{handoverSlip.registered_nic}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-white/50">Initial Balance:</span>
                <span className="font-mono font-bold text-emerald-400">Rs. {handoverSlip.initial_balance.toFixed(2)}</span>
              </div>

              {/* Large Passcode Box */}
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
                    {slipCopied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick Customer Instruction */}
            <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-[11px] text-white/70 space-y-1">
              <span className="font-bold text-white block">Next Steps for Customer:</span>
              <p>Log in to LECO Self Care, select <strong>Add Meter</strong>, and enter this Meter Number, Account Number, and Passcode.</p>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="bg-white/5 border-white/10 text-white text-xs h-9 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-yellow-400" />
                Print Voucher
              </Button>

              <Button
                onClick={() => setHandoverSlip(null)}
                className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs h-9 px-5 rounded-xl cursor-pointer"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP 4: Remote Relay Supply Confirmation
         ========================================================================= */}
      {relayModalMeter && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-white/10 rounded-3xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl relative">
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
                    ? "Disconnect Electricity Supply"
                    : "Restore Electricity Supply"}
                </h3>
                <p className="text-xs text-white/50 font-mono">
                  Meter: {relayModalMeter.meter_number}
                </p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              {relayModalMeter.status === "Connected"
                ? "This command instructs the smart meter cutoff relay to open, safely cutting power to the premise."
                : "This command triggers the smart meter relay to close, restoring live electricity to the premise."}
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80 block">
                Operation Reason / Memo (Optional)
              </label>
              <Input
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="e.g. Verified top-up, inspection, customer request"
                className="bg-black/40 border-white/15 text-white text-xs h-9 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                disabled={actionLoading}
                onClick={() => setRelayModalMeter(null)}
                className="bg-white/5 text-white border-white/10 text-xs h-9 rounded-xl cursor-pointer"
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
                    Transmitting...
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Confirm {relayModalMeter.status === "Connected" ? "Disconnection" : "Restoration"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP 5: Staff Credit Relief / Top-up
         ========================================================================= */}
      {topupModalMeter && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-white/10 rounded-3xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl relative">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Manual Credit Adjustment</h3>
                <p className="text-xs text-white/50 font-mono">
                  Meter: {topupModalMeter.meter_number} (Current: Rs. {parseFloat(String(topupModalMeter.balance)).toFixed(2)})
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/80 block">Select Relief Amount (LKR)</label>
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
                className="bg-black/40 border-white/15 text-white text-xs h-9 rounded-xl font-mono mt-1"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80 block">Relief Justification / Memo</label>
              <Input
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="e.g. Complaint resolution, emergency relief"
                className="bg-black/40 border-white/15 text-white text-xs h-9 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                disabled={actionLoading}
                onClick={() => setTopupModalMeter(null)}
                className="bg-white/5 text-white border-white/10 text-xs h-9 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                disabled={actionLoading}
                onClick={promptStaffTopup}
                className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-yellow-400/20 flex items-center gap-1.5 cursor-pointer"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Applying...
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

      {/* =========================================================================
          POPUP 6: Security Passcode Management & Regeneration
         ========================================================================= */}
      {passcodeModalMeter && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-white/10 rounded-3xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl relative">
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-bold">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Security Passcode</h3>
                  <p className="text-xs text-white/50 font-mono">Meter #{passcodeModalMeter.meter_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasscodeModalMeter(null)}
                className="text-white/40 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current Passcode Display */}
            <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2">
              <span className="text-xs text-white/50 block">Active Provisioned Passcode:</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xl font-extrabold text-yellow-300 tracking-widest">
                  {activePasscodeDisplay || "Secured with Bcrypt"}
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

            {/* Regenerate Section */}
            <form onSubmit={handleRegeneratePasscode} className="space-y-3 pt-2 text-xs">
              <span className="font-bold text-white block">Regenerate Passcode with Staff Authorization</span>
              <div className="space-y-1.5">
                <label className="text-white/70">Custom 6-Digit PIN (Optional)</label>
                <Input
                  value={customPasscode}
                  onChange={(e) => setCustomPasscode(e.target.value)}
                  placeholder="Leave empty to auto-generate"
                  className="bg-black/40 border-white/10 text-white font-mono h-9 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-yellow-400 font-medium">Staff Password Authorization *</label>
                <Input
                  required
                  type="password"
                  value={passcodeStaffPassword}
                  onChange={(e) => setPasscodeStaffPassword(e.target.value)}
                  placeholder="Enter staff password to confirm"
                  className="bg-black/40 border-yellow-400/30 text-white h-9 rounded-xl text-xs"
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
                  className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-xs h-9 px-4 rounded-xl shadow-lg cursor-pointer flex items-center gap-1.5"
                >
                  {passcodeRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  Regenerate Passcode
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          POPUP 7: Assign Hardware Meter to Customer
         ========================================================================= */}
      {assignModalMeter && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-white/10 rounded-3xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Assign Meter to Customer</h3>
                  <p className="text-xs text-white/50 font-mono">Meter #{assignModalMeter.meter_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalMeter(null)}
                className="text-white/40 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteAssignMeter} className="space-y-3.5 text-xs">
              <div className="space-y-1.5">
                <label className="text-white/80 font-medium block">Select Registered Customer Account</label>
                <select
                  value={assignCustomerId}
                  onChange={(e) => {
                    const selectedId = e.target.value
                    setAssignCustomerId(selectedId)
                    const found = customersList.find((c) => String(c.id) === selectedId)
                    if (found && found.nic) {
                      setAssignCustomerNic(found.nic)
                    }
                  }}
                  className="w-full bg-black/60 border border-white/15 text-white h-9 px-3 rounded-xl focus:border-yellow-400 outline-none text-xs"
                >
                  <option value="">-- Choose from Registered Customer Directory --</option>
                  {customersList.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#121215] text-white">
                      {c.full_name || "Customer"} ({c.email}) {c.nic ? `- NIC: ${c.nic}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-white/80 font-medium block">Customer NIC (National Identity Card) *</label>
                <Input
                  required
                  value={assignCustomerNic}
                  onChange={(e) => setAssignCustomerNic(e.target.value.toUpperCase())}
                  placeholder="e.g. 199512345678 or 951234567V"
                  className="bg-black/60 border-white/10 text-white font-mono h-9 rounded-xl focus-visible:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-white/80 font-medium block">Security Passcode</label>
                  <Input
                    required
                    value={assignPasscode}
                    onChange={(e) => setAssignPasscode(e.target.value)}
                    placeholder="6-digit PIN"
                    className="bg-black/60 border-white/10 text-white font-mono h-9 rounded-xl text-center font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-white/80 font-medium block">Initial Credit (LKR)</label>
                  <Input
                    required
                    type="number"
                    min="0"
                    step="50"
                    value={assignBalance}
                    onChange={(e) => setAssignBalance(e.target.value)}
                    placeholder="1500.00"
                    className="bg-black/60 border-white/10 text-white font-mono h-9 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-yellow-400 font-semibold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Staff Authorization Password *
                </label>
                <Input
                  required
                  type="password"
                  value={assignStaffPassword}
                  onChange={(e) => setAssignStaffPassword(e.target.value)}
                  placeholder="Enter your staff password"
                  className="bg-black/60 border-yellow-400/30 text-white h-9 rounded-xl focus-visible:border-yellow-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={assignLoading}
                  onClick={() => setAssignModalMeter(null)}
                  className="bg-white/5 border-white/10 text-white text-xs h-9 px-4 rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={assignLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs h-9 px-4 rounded-xl shadow-lg cursor-pointer flex items-center gap-1.5"
                >
                  {assignLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                  Assign Meter
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sensitive Operation Password Modal */}
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
