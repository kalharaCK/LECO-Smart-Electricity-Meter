import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Zap,
  ZapOff,
  Search,
  RefreshCw,
  Power,
  CreditCard,
  Eye,
  SlidersHorizontal,
  Building2,
  Phone,
  User,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Cpu,
  Loader2,
  X,
  FileText
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
        <div className="bg-[#120403] border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Fleet Fleet Size</span>
            <Cpu className="h-4 w-4 text-[#F5E00B]" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-white">{totalMetersCount}</span>
            <span className="text-[11px] text-white/40 block">Smart Meters</span>
          </div>
        </div>

        <div className="bg-[#120403] border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Grid Connected</span>
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-400">{connectedCount}</span>
            <span className="text-[11px] text-emerald-500/70 block">Relays Closed (Active)</span>
          </div>
        </div>

        <div className="bg-[#120403] border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Disconnected</span>
            <ZapOff className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-rose-400">{disconnectedCount}</span>
            <span className="text-[11px] text-rose-500/70 block">Cutoff Relays Open</span>
          </div>
        </div>

        <div className="bg-[#120403] border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Lifeline Active</span>
            <Power className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-amber-400">{lifelineCount}</span>
            <span className="text-[11px] text-amber-500/70 block">Rs. 500 Buffer In-Use</span>
          </div>
        </div>

        <div className="bg-[#120403] border border-white/10 rounded-2xl p-4 flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Today's Grid Load</span>
            <TrendingUp className="h-4 w-4 text-[#F5E00B]" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-white">{totalTodayKwh.toFixed(2)}</span>
            <span className="text-[11px] text-white/40 block">Total kWh Billed</span>
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-[#120403] border border-white/10 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Meter #, Account #, Email, Phone..."
            className="pl-10 bg-black/40 border-white/15 text-white text-xs h-10 rounded-xl focus-visible:border-[#F5E00B]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-[#F5E00B] text-black shadow-md shadow-[#F5E00B]/20"
                : "bg-black/40 text-white/60 hover:text-white"
            }`}
          >
            All ({meters.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("connected")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "connected"
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                : "bg-black/40 text-white/60 hover:text-white"
            }`}
          >
            Connected ({connectedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("disconnected")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "disconnected"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                : "bg-black/40 text-white/60 hover:text-white"
            }`}
          >
            Disconnected ({disconnectedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("lifeline")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "lifeline"
                ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
                : "bg-black/40 text-white/60 hover:text-white"
            }`}
          >
            Lifeline Active ({lifelineCount})
          </button>
        </div>

        {/* Actions & Sort */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 px-3 py-1.5 rounded-xl text-xs text-white/70">
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#F5E00B]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white text-xs border-none outline-none cursor-pointer"
            >
              <option value="id" className="bg-[#120403] text-white">Default Sort</option>
              <option value="balance_asc" className="bg-[#120403] text-white">Balance: Low to High</option>
              <option value="balance_desc" className="bg-[#120403] text-white">Balance: High to Low</option>
              <option value="today_kwh" className="bg-[#120403] text-white">Today's Usage</option>
            </select>
          </div>

          <Button
            onClick={onRefresh}
            variant="outline"
            className="bg-black/40 border-white/10 hover:bg-white/10 text-white h-9 px-3 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#F5E00B]" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Meters Fleet Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-white/50 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#F5E00B]" />
          <span className="text-xs">Loading complete fleet telemetry...</span>
        </div>
      ) : filteredMeters.length === 0 ? (
        <div className="p-12 text-center bg-[#120403] border border-white/10 rounded-2xl text-white/50 space-y-2">
          <Cpu className="h-8 w-8 mx-auto text-white/30" />
          <p className="text-sm font-semibold text-white">No smart meters match your search/filter.</p>
          <p className="text-xs text-white/40">Try adjusting your filters or search keywords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredMeters.map((meter) => {
            const balanceNum = parseFloat(String(meter.balance))
            const isConnected = meter.status === "Connected"
            const isLifeline = meter.emergency_credit_active
            const isLowBalance = balanceNum <= meter.low_balance_threshold

            return (
              <Card
                key={meter.id}
                className="bg-gradient-to-br from-[#120403] via-[#0d0302] to-[#070707] border-white/10 hover:border-white/20 transition-all rounded-2xl shadow-xl text-white overflow-hidden relative group"
              >
                {/* Top status indicator strip */}
                <div
                  className={`h-1.5 w-full ${
                    !isConnected
                      ? "bg-rose-500"
                      : isLifeline
                      ? "bg-amber-400"
                      : isLowBalance
                      ? "bg-yellow-400"
                      : "bg-emerald-500"
                  }`}
                />

                <CardContent className="p-5 space-y-4">
                  {/* Header Row: Meter # & Relay State */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-white tracking-wide">
                          {meter.meter_number}
                        </span>
                        <Badge
                          variant="outline"
                          className="bg-white/5 border-white/10 text-white/60 text-[10px] font-mono px-2 py-0"
                        >
                          Acc: {meter.account_number}
                        </Badge>
                      </div>
                      <div className="text-xs text-white/60 mt-0.5 flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 text-[#F5E00B]" />
                        <span>{meter.name || "Default Meter"}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
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
                        {isConnected ? "Relay Connected" : "Cutoff Disconnected"}
                      </span>

                      {isLifeline && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          <Power className="h-3 w-3" />
                          Lifeline Buffer Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer Information Block */}
                  <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-white/80">
                      <span className="flex items-center gap-1.5 text-white/50">
                        <User className="h-3.5 w-3.5 text-[#F5E00B]" />
                        Customer:
                      </span>
                      <span className="font-medium text-white truncate max-w-[180px]">
                        {meter.customer_email}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-white/80">
                      <span className="flex items-center gap-1.5 text-white/50">
                        <Phone className="h-3.5 w-3.5 text-white/40" />
                        Phone:
                      </span>
                      <span className="font-mono text-white/80">{meter.phone_number}</span>
                    </div>

                    <div className="flex items-center justify-between text-white/80">
                      <span className="flex items-center gap-1.5 text-white/50">
                        <FileText className="h-3.5 w-3.5 text-white/40" />
                        Tariff Schedule:
                      </span>
                      <span className="text-[11px] text-[#F5E00B] font-semibold truncate max-w-[180px]">
                        {meter.tariff_type}
                      </span>
                    </div>
                  </div>

                  {/* Telemetry Numbers Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {/* Wallet Balance */}
                    <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                      <span className="text-[10px] text-white/40 uppercase block">Wallet Balance</span>
                      <span
                        className={`text-sm font-bold block mt-0.5 ${
                          balanceNum < 0
                            ? "text-rose-400"
                            : balanceNum <= meter.low_balance_threshold
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        Rs. {balanceNum.toFixed(2)}
                      </span>
                    </div>

                    {/* Today Usage */}
                    <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                      <span className="text-[10px] text-white/40 uppercase block">Today (kWh)</span>
                      <span className="text-sm font-bold text-white block mt-0.5">
                        {parseFloat(String(meter.today_kwh)).toFixed(2)}
                      </span>
                    </div>

                    {/* Total Lifetime */}
                    <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                      <span className="text-[10px] text-white/40 uppercase block">Total (kWh)</span>
                      <span className="text-sm font-bold text-white/80 block mt-0.5">
                        {parseFloat(String(meter.total_kwh)).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Open Complaints Indicator */}
                  {meter.open_complaints_count > 0 && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-red-950/40 border border-red-500/20 text-xs text-red-200">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                        <span>{meter.open_complaints_count} Open Customer Complaint(s)</span>
                      </div>
                      {onSelectComplaintTabWithMeter && (
                        <button
                          type="button"
                          onClick={() => onSelectComplaintTabWithMeter(meter.meter_number)}
                          className="text-[11px] underline font-bold text-yellow-300 hover:text-white cursor-pointer"
                        >
                          View Tickets
                        </button>
                      )}
                    </div>
                  )}

                  {/* Staff Action Buttons Strip */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveMeterDetail(meter)}
                      className="bg-black/30 border-white/15 text-white/80 hover:text-white hover:bg-black/60 text-xs h-8 rounded-lg flex items-center gap-1 cursor-pointer flex-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Details
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTopupModalMeter(meter)}
                      className="bg-[#F5E00B]/10 border-[#F5E00B]/30 hover:bg-[#F5E00B]/20 text-[#F5E00B] text-xs h-8 rounded-lg flex items-center gap-1 cursor-pointer flex-1"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Credit Relief
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => setRelayModalMeter(meter)}
                      className={`text-xs h-8 rounded-lg font-bold flex items-center gap-1 cursor-pointer flex-1 ${
                        isConnected
                          ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40"
                          : "bg-emerald-500 hover:bg-emerald-600 text-black font-bold shadow-md shadow-emerald-500/20"
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {isConnected ? "Cutoff Relay" : "Restore Power"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL 1: Full Meter Details Inspector */}
      {activeMeterDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#120403] border border-white/15 rounded-2xl max-w-2xl w-full p-6 text-white space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white font-mono">
                    Meter {activeMeterDetail.meter_number}
                  </h3>
                  <Badge
                    className={
                      activeMeterDetail.status === "Connected"
                        ? "bg-emerald-500 text-black font-bold"
                        : "bg-rose-500 text-white font-bold"
                    }
                  >
                    {activeMeterDetail.status}
                  </Badge>
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  Account #{activeMeterDetail.account_number} • Label: {activeMeterDetail.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMeterDetail(null)}
                className="text-white/40 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-white/5">
                <span className="font-bold text-[#F5E00B] uppercase text-[10px] tracking-wider block">
                  Customer Profile
                </span>
                <div>
                  <span className="text-white/40 block">Email Address</span>
                  <span className="font-semibold text-white">{activeMeterDetail.customer_email}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Mobile Phone</span>
                  <span className="font-semibold text-white">{activeMeterDetail.phone_number}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Member Registered</span>
                  <span className="text-white/70">
                    {new Date(activeMeterDetail.customer_since).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    })}
                  </span>
                </div>
              </div>

              <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-white/5">
                <span className="font-bold text-[#F5E00B] uppercase text-[10px] tracking-wider block">
                  Tariff & Automation Rules
                </span>
                <div>
                  <span className="text-white/40 block">PUCSL Tariff Tier</span>
                  <span className="font-semibold text-[#F5E00B]">{activeMeterDetail.tariff_type}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Low Balance Trigger</span>
                  <span className="text-white font-semibold">
                    Rs. {activeMeterDetail.low_balance_threshold}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block">Daily Energy Quota</span>
                  <span className="text-white font-semibold">
                    {activeMeterDetail.daily_kwh_budget} kWh / day
                  </span>
                </div>
              </div>

              <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-white/5">
                <span className="font-bold text-[#F5E00B] uppercase text-[10px] tracking-wider block">
                  Lifeline Mode Status
                </span>
                <div>
                  <span className="text-white/40 block">Emergency Buffer Allowed</span>
                  <span className="font-semibold text-white">
                    Rs. {parseFloat(String(activeMeterDetail.emergency_credit_limit)).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block">Lifeline State</span>
                  <span
                    className={
                      activeMeterDetail.emergency_credit_active
                        ? "text-amber-400 font-bold"
                        : "text-white/60"
                    }
                  >
                    {activeMeterDetail.emergency_credit_active ? "ACTIVATED & CONSUMING" : "Standby / Available"}
                  </span>
                </div>
              </div>

              <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-white/5">
                <span className="font-bold text-[#F5E00B] uppercase text-[10px] tracking-wider block">
                  Consumption & Payment History
                </span>
                <div>
                  <span className="text-white/40 block">Today's Consumption</span>
                  <span className="font-semibold text-white">{activeMeterDetail.today_kwh} kWh</span>
                </div>
                <div>
                  <span className="text-white/40 block">Lifetime Total Consumption</span>
                  <span className="font-semibold text-white">{activeMeterDetail.total_kwh} kWh</span>
                </div>
                <div>
                  <span className="text-white/40 block">Last Recharge</span>
                  <span className="text-white/70">
                    {activeMeterDetail.last_payment_date
                      ? `Rs. ${parseFloat(String(activeMeterDetail.last_payment_amount)).toFixed(2)} on ${new Date(
                          activeMeterDetail.last_payment_date
                        ).toLocaleDateString()}`
                      : "None recorded"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => setActiveMeterDetail(null)}
                className="bg-white/10 text-white border-white/20 text-xs h-9 rounded-xl cursor-pointer"
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Remote Relay Toggle Confirmation */}
      {relayModalMeter && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#120403] border border-white/15 rounded-2xl max-w-md w-full p-6 text-white space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#120403] border border-white/15 rounded-2xl max-w-md w-full p-6 text-white space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#F5E00B]/20 text-[#F5E00B]">
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
                        ? "bg-[#F5E00B] text-black border-[#F5E00B]"
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
                className="bg-[#F5E00B] hover:bg-[#F5E00B]/90 text-black font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-[#F5E00B]/20 flex items-center gap-2 cursor-pointer"
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
