import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  MessageSquareWarning,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  FileText,
  User,
  Zap,
  ArrowRight,
  Loader2,
  Send,
  Check,
  RefreshCw
} from "lucide-react"
import type { StaffComplaint } from "../types"

interface ComplaintsManagementProps {
  complaints: StaffComplaint[]
  loading: boolean
  onRefresh: () => void
  initialMeterSearch?: string
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>
}

const STATUS_STEPS = [
  { key: "submitted", label: "Queued", desc: "Received in triage" },
  { key: "in_review", label: "In Review", desc: "Assigned to engineer" },
  { key: "investigating", label: "Investigating", desc: "Field crew dispatched" },
  { key: "resolved", label: "Resolved", desc: "Issue verified & closed" }
]

const PRIORITY_BADGES = {
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  low: "bg-blue-500/20 text-blue-300 border-blue-500/40"
}

export default function ComplaintsManagement({
  complaints,
  loading,
  onRefresh,
  initialMeterSearch = "",
  getAuthHeaders
}: ComplaintsManagementProps) {
  const [searchTerm, setSearchTerm] = useState(initialMeterSearch)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")

  // Selected complaint for resolution inspection
  const [selectedComplaintId, setSelectedComplaintId] = useState<number | null>(
    complaints.length > 0 ? complaints[0].id : null
  )

  // Resolution Form State
  const [targetStatus, setTargetStatus] = useState<StaffComplaint["status"]>("in_review")
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [updating, setUpdating] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Active complaint object
  const activeComplaint =
    complaints.find((c) => c.id === selectedComplaintId) || complaints[0] || null

  // Summary Metrics
  const totalCount = complaints.length
  const submittedCount = complaints.filter((c) => c.status === "submitted").length
  const inReviewCount = complaints.filter((c) => c.status === "in_review").length
  const investigatingCount = complaints.filter((c) => c.status === "investigating").length
  const resolvedCount = complaints.filter((c) => c.status === "resolved" || c.status === "closed").length

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    const q = searchTerm.toLowerCase().trim()
    const matchSearch =
      !q ||
      c.ticket_number.toLowerCase().includes(q) ||
      (c.customer_email && c.customer_email.toLowerCase().includes(q)) ||
      (c.meter_number && c.meter_number.toLowerCase().includes(q)) ||
      c.subject.toLowerCase().includes(q) ||
      c.complaint_type.toLowerCase().includes(q)

    if (!matchSearch) return false
    if (statusFilter !== "all" && c.status !== statusFilter) return false
    if (priorityFilter !== "all" && c.priority !== priorityFilter) return false
    return true
  })

  const getStepIndex = (status: string) => {
    switch (status) {
      case "submitted":
        return 0
      case "in_review":
        return 1
      case "investigating":
        return 2
      case "resolved":
      case "closed":
        return 3
      default:
        return 0
    }
  }

  // Handle Staff Complaint Status Update
  const handleUpdateStatus = async (complaintId: number, newStatus: StaffComplaint["status"], customNotes?: string) => {
    setUpdating(true)
    try {
      const res = await fetch(`http://localhost:3000/api/complaints/${complaintId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          status: newStatus,
          resolution_notes: customNotes !== undefined ? customNotes : resolutionNotes
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(`Ticket #${data.complaint?.ticket_number || complaintId} updated to '${newStatus}'! Customer notified.`, "success")
        setResolutionNotes("")
        onRefresh()
      } else {
        showToast(data.message || "Failed to update complaint", "error")
      }
    } catch (err) {
      console.error("Complaint status update error:", err)
      showToast("Network error updating complaint status", "error")
    } finally {
      setUpdating(false)
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

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-gradient-to-br from-[#992511] to-[#3a0b04] border-0 shadow-xl rounded-2xl p-4 flex flex-col justify-between text-white">
          <div className="flex items-center justify-between text-white/80 text-xs font-medium">
            <span>Total Tickets</span>
            <FileText className="h-4 w-4 text-yellow-300" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-white">{totalCount}</span>
            <span className="text-[11px] text-white/70 block font-medium">Customer Complaints</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Triage Queue</span>
            <Clock className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-blue-400">{submittedCount}</span>
            <span className="text-[11px] text-blue-400/60 block">Awaiting First Review</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>In Engineering Review</span>
            <Search className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-yellow-400">{inReviewCount}</span>
            <span className="text-[11px] text-yellow-400/60 block">Desk Assessment</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Field Dispatched</span>
            <Zap className="h-4 w-4 text-orange-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-orange-400">{investigatingCount}</span>
            <span className="text-[11px] text-orange-400/60 block">Investigation Active</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-400">{resolvedCount}</span>
            <span className="text-[11px] text-emerald-500/70 block">Completed & Verified</span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-[#0f0f11] border border-white/5 rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Ticket #, Email, Meter #, Subject..."
            className="pl-10 bg-black/40 border-white/10 text-white placeholder:text-white/40 text-xs h-10 rounded-xl focus-visible:border-yellow-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 px-3 py-1.5 rounded-xl text-xs text-white/70">
            <Filter className="h-3.5 w-3.5 text-yellow-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-white text-xs border-none outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#0f0f11] text-white">All Statuses</option>
              <option value="submitted" className="bg-[#0f0f11] text-white">Submitted</option>
              <option value="in_review" className="bg-[#0f0f11] text-white">In Review</option>
              <option value="investigating" className="bg-[#0f0f11] text-white">Investigating</option>
              <option value="resolved" className="bg-[#0f0f11] text-white">Resolved</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 px-3 py-1.5 rounded-xl text-xs text-white/70">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-white text-xs border-none outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#0f0f11] text-white">All Priorities</option>
              <option value="critical" className="bg-[#0f0f11] text-white">Critical</option>
              <option value="high" className="bg-[#0f0f11] text-white">High</option>
              <option value="medium" className="bg-[#0f0f11] text-white">Medium</option>
              <option value="low" className="bg-[#0f0f11] text-white">Low</option>
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

      {/* Main Two-Column Layout: Complaints Queue + Active Resolution Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Complaints List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-white/60 px-1 font-semibold">
            <span>COMPLAINT TICKETS ({filteredComplaints.length})</span>
            <span>CLICK TO RESOLVE</span>
          </div>

          {loading ? (
            <div className="py-20 text-center text-white/50 flex flex-col items-center justify-center gap-3 bg-[#0f0f11] border border-white/5 rounded-2xl">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
              <span className="text-xs">Loading complaints queue...</span>
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="p-8 text-center bg-[#0f0f11] border border-white/5 rounded-2xl text-white/50 space-y-2">
              <MessageSquareWarning className="h-8 w-8 mx-auto text-white/30" />
              <p className="text-sm font-semibold text-white">No complaints found.</p>
              <p className="text-xs text-white/40">Queue is clear or no tickets match the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {filteredComplaints.map((c) => {
                const isSelected = activeComplaint?.id === c.id
                const isResolved = c.status === "resolved" || c.status === "closed"

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedComplaintId(c.id)
                      setTargetStatus(c.status)
                      setResolutionNotes(c.resolution_notes || "")
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative overflow-hidden ${
                      isSelected
                        ? "bg-[#992511]/15 border-yellow-400/50 shadow-xl shadow-yellow-400/5"
                        : "bg-[#0f0f11] border-white/5 hover:border-white/20 hover:bg-white/[0.03]"
                    }`}
                  >
                    {/* Status side bar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                        isResolved
                          ? "bg-emerald-500"
                          : c.status === "investigating"
                          ? "bg-orange-500"
                          : c.status === "in_review"
                          ? "bg-yellow-400"
                          : "bg-blue-500"
                      }`}
                    />

                    <div className="flex items-start justify-between gap-2 mb-1.5 pl-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white tracking-wider">
                          {c.ticket_number}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase font-bold px-1.5 py-0 border ${
                            PRIORITY_BADGES[c.priority] || PRIORITY_BADGES.medium
                          }`}
                        >
                          {c.priority}
                        </Badge>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isResolved
                            ? "bg-emerald-500/20 text-emerald-300"
                            : c.status === "investigating"
                            ? "bg-orange-500/20 text-orange-300"
                            : c.status === "in_review"
                            ? "bg-yellow-400/20 text-yellow-300"
                            : "bg-blue-500/20 text-blue-300"
                        }`}
                      >
                        {c.status.replace("_", " ")}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-white truncate pl-2 mb-1">
                      {c.subject}
                    </h4>

                    <div className="text-[11px] text-white/50 line-clamp-2 pl-2 leading-relaxed">
                      {c.description}
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40 pl-2">
                      <span className="truncate max-w-[170px] text-white/70">
                        {c.customer_email || "Customer"}
                      </span>
                      <span>
                        {new Date(c.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Complaint Resolution Console (7 cols) */}
        <div className="lg:col-span-7">
          {activeComplaint ? (
            <Card className="bg-[#0f0f11] border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden sticky top-24">
              {/* Header */}
              <div className="p-6 border-b border-white/5 bg-gradient-to-r from-[#992511]/30 via-[#0f0f11] to-[#0f0f11]">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold font-mono text-yellow-400">
                      {activeComplaint.ticket_number}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs uppercase font-bold px-2 py-0.5 border ${
                        PRIORITY_BADGES[activeComplaint.priority] || PRIORITY_BADGES.medium
                      }`}
                    >
                      {activeComplaint.priority} Priority
                    </Badge>
                  </div>

                  <span className="text-xs text-white/50">
                    Logged: {new Date(activeComplaint.created_at).toLocaleString()}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-white">{activeComplaint.subject}</h2>
                <div className="flex items-center gap-4 text-xs text-white/60 mt-1">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-yellow-400" />
                    {activeComplaint.customer_email}
                  </span>
                  {activeComplaint.meter_number && (
                    <span className="flex items-center gap-1.5 font-mono">
                      <Zap className="h-3.5 w-3.5 text-yellow-400" />
                      Meter: {activeComplaint.meter_number}
                    </span>
                  )}
                </div>
              </div>

              <CardContent className="p-6 space-y-6">
                {/* 4-Stage Status Progress Stepper */}
                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider block mb-3">
                    Customer End Real-Time Tracking State
                  </span>
                  <div className="grid grid-cols-4 gap-2 relative">
                    {STATUS_STEPS.map((step, idx) => {
                      const currentIdx = getStepIndex(activeComplaint.status)
                      const isCompleted = idx < currentIdx
                      const isCurrent = idx === currentIdx

                      return (
                        <div key={step.key} className="text-center relative">
                          <div
                            className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-bold transition-all mb-1.5 ${
                              isCompleted
                                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                                : isCurrent
                                ? "bg-yellow-400 text-black ring-4 ring-yellow-400/20 animate-pulse font-bold"
                                : "bg-white/10 text-white/40 border border-white/10"
                            }`}
                          >
                            {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
                          </div>
                          <span
                            className={`text-xs block font-bold truncate ${
                              isCurrent
                                ? "text-yellow-400"
                                : isCompleted
                                ? "text-emerald-400"
                                : "text-white/40"
                            }`}
                          >
                            {step.label}
                          </span>
                          <span className="text-[9px] text-white/30 hidden sm:block truncate">
                            {step.desc}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Customer's Complaint Description */}
                <div className="space-y-1.5 bg-black/30 p-4 rounded-xl border border-white/5">
                  <span className="text-xs font-bold text-white/80 block">
                    Customer Problem Statement:
                  </span>
                  <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line">
                    {activeComplaint.description}
                  </p>
                </div>

                {/* Existing Engineering Resolution Note (if any) */}
                {activeComplaint.resolution_notes && (
                  <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Recorded Engineering Note / Action:
                    </div>
                    <p className="text-emerald-200/90 leading-relaxed">
                      {activeComplaint.resolution_notes}
                    </p>
                    {activeComplaint.resolved_at && (
                      <span className="text-[10px] text-emerald-400/60 block pt-1">
                        Resolved on {new Date(activeComplaint.resolved_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {/* Interactive Resolution & Dispatch Form */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a] border border-yellow-400/25 space-y-4 shadow-xl">
                  <div className="flex items-center gap-2 text-sm font-bold text-yellow-400">
                    <Send className="h-4 w-4" />
                    Take Operations Action & Push Real-Time Update to Customer
                  </div>

                  {/* Target Status Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/80 block">
                      Transition Complaint Stage:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setTargetStatus("submitted")}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          targetStatus === "submitted"
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-black/40 border-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        1. Queued
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetStatus("in_review")}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          targetStatus === "in_review"
                            ? "bg-yellow-400 text-black border-yellow-400 font-bold"
                            : "bg-black/40 border-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        2. In Review
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetStatus("investigating")}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          targetStatus === "investigating"
                            ? "bg-orange-500 text-white border-orange-500 font-bold"
                            : "bg-black/40 border-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        3. Investigating
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetStatus("resolved")}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          targetStatus === "resolved"
                            ? "bg-emerald-500 text-black border-emerald-500 font-bold"
                            : "bg-black/40 border-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        4. Resolved
                      </button>
                    </div>
                  </div>

                  {/* Staff Notes Textarea */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/80 block">
                      Engineering Resolution Notes (Customer Receives Live):
                    </label>
                    <textarea
                      rows={3}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="e.g. Dispatched technician to check line voltage. Feeder contact tightened and meter rebooted. Power verified normal."
                      className="w-full bg-black/50 border border-white/15 text-white placeholder:text-white/40 text-xs p-3 rounded-xl outline-none focus:border-yellow-400 leading-relaxed resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-1 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-white/40 flex items-center gap-1">
                      <Zap className="h-3 w-3 text-yellow-400" />
                      Broadcasts live update to customer portal (:5173) via WebSocket
                    </span>

                    <Button
                      disabled={updating}
                      onClick={() => handleUpdateStatus(activeComplaint.id, targetStatus, resolutionNotes)}
                      className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs h-10 px-5 rounded-xl shadow-lg shadow-yellow-400/20 flex items-center gap-2 cursor-pointer transition-transform hover:scale-[1.01]"
                    >
                      {updating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Broadcasting Update...
                        </>
                      ) : (
                        <>
                          Update Status & Notify User
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-12 text-center bg-[#0f0f11] border border-white/5 rounded-2xl text-white/50">
              Select a complaint ticket on the left to inspect and take action.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
