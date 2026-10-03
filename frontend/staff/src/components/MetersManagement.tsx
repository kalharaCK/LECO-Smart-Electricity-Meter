import { useState } from "react"
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
  Layers
} from "lucide-react"
import type { StaffMeter } from "../types"

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

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
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

  // Execute Relay Toggle
  const handleToggleRelay = async () => {
    if (!relayModalMeter) return
    setActionLoading(true)
    const newTargetStatus = relayModalMeter.status === "Connected" ? "Disconnected" : "Connected"

    try {
      const res = await fetch(`http://localhost:3000/api/meters/${relayModalMeter.id}/toggle-relay`, {
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

  // Execute Staff Top-up
  const handleStaffTopup = async () => {
    if (!topupModalMeter) return
    setActionLoading(true)

    try {
      const res = await fetch(`http://localhost:3000/api/meters/${topupModalMeter.id}/staff-topup`, {
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
            onClick={onRefresh}
            variant="outline"
            className="bg-black/40 border-white/5 hover:bg-white/10 text-white h-9 px-3 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-yellow-400" : ""}`} />
            Refresh
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

                  {/* Col 2: Customer Email & Phone */}
                  <div className="col-span-3">
                    <div className="font-medium text-white truncate max-w-[220px]">
                      {meter.customer_email}
                    </div>
                    <div className="text-[11px] text-white/50 font-mono mt-0.5">
                      {meter.phone_number || "+94 77 123 4567"}
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
                      title="Adjust credit"
                      onClick={() => setTopupModalMeter(meter)}
                      className="bg-yellow-400/10 hover:bg-yellow-400/20 border-yellow-400/30 text-yellow-300 text-xs h-7 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer"
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
                      {activeMeterDetail.customer_email}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">SMS Alert Phone:</span>
                    <span className="font-mono text-white font-semibold">
                      {activeMeterDetail.phone_number || "+94 77 123 4567"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Customer System ID:</span>
                    <span className="font-mono text-white/70">USR-{activeMeterDetail.customer_id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Member Registered:</span>
                    <span className="text-white/70">
                      {new Date(activeMeterDetail.customer_since).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
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
                    <span className="text-white/50">AMI Ping Interval:</span>
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
            </div>

            {/* Direct Operational Controls Inside Details */}
            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setTopupModalMeter(activeMeterDetail)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-yellow-400/20 flex items-center gap-2 cursor-pointer"
                >
                  <CreditCard className="h-4 w-4" />
                  Grant Relief Credit
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
                onClick={handleToggleRelay}
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
                    <Power className="h-4 w-4" />
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
                onClick={handleStaffTopup}
                className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-yellow-400/20 flex items-center gap-2 cursor-pointer"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing Credit...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Apply Rs. {topupAmount} Credit
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
