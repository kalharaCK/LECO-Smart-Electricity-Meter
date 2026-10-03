import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { getSocket } from "@/lib/socket"
import {
  Phone,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Zap,
  ZapOff,
  RefreshCw,
  Search,
  Activity,
  FileText,
  ShieldAlert,
  ArrowRight,
  Sliders,
  Check,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  CreditCard,
  Wifi,
  TrendingUp
} from "lucide-react"

interface Meter {
  id: number
  meter_number: string
  name: string
  balance?: number
}

interface Complaint {
  id: number
  ticket_number: string
  user_id: number
  meter_id: number | null
  meter_number?: string
  meter_name?: string
  complaint_type: string
  subject: string
  description: string
  priority: "low" | "medium" | "high" | "emergency"
  status: "submitted" | "in_review" | "investigating" | "resolved" | "closed"
  resolution_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

const COMPLAINT_TYPES = [
  { id: "recharge-problem", label: "Recharge / Token Issue", desc: "Money debited but meter balance not credited", icon: CreditCard },
  { id: "incorrect-balance", label: "Incorrect Balance", desc: "Balance deduction mismatch or rate dispute", icon: Sliders },
  { id: "meter-issue", label: "Meter Hardware Issue", desc: "LCD dark, red fault indicator, or relay trip", icon: Zap },
  { id: "power-interruption", label: "Power Interruption", desc: "Unexpected blackout or single-phase loss", icon: ZapOff },
  { id: "high-consumption", label: "High Consumption Surge", desc: "Abnormal surge in daily kWh consumption", icon: TrendingUp },
  { id: "voltage-fluctuation", label: "Voltage Fluctuation", desc: "Flickering lights or high/low voltage hazard", icon: Activity },
  { id: "connection-problem", label: "Smart Connectivity Problem", desc: "Meter offline or telemetry not sending", icon: Wifi },
  { id: "other", label: "Other Support Request", desc: "General administrative or account assistance", icon: HelpCircle }
]

const PRIORITIES = [
  { id: "low", label: "Low Priority", sla: "48h SLA", desc: "General inquiry or tariff question", color: "text-emerald-400", dot: "bg-emerald-400" },
  { id: "medium", label: "Medium Priority", sla: "24h SLA", desc: "Standard meter or billing issue", color: "text-yellow-400", dot: "bg-yellow-400" },
  { id: "high", label: "High Priority", sla: "6h SLA", desc: "Recharge or balance deduction failure", color: "text-orange-400", dot: "bg-orange-400" },
  { id: "emergency", label: "Emergency Breakdown", sla: "Immediate", desc: "Total blackout or electrical hazard", color: "text-red-400", dot: "bg-red-400" }
]

const STATUS_STEPS: Array<{ key: Complaint["status"]; label: string; desc: string }> = [
  { key: "submitted", label: "Queued", desc: "Logged in LECO system and queued for dispatch" },
  { key: "in_review", label: "In Review", desc: "Assigned to Support Specialist / Billing Officer" },
  { key: "investigating", label: "Under Investigation", desc: "Engineering telemetry audit or field inspection" },
  { key: "resolved", label: "Resolved", desc: "Issue addressed, balance synchronized, or service restored" }
]

export default function ComplaintsSection() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [meters, setMeters] = useState<Meter[]>([])
  const [selectedComplaintId, setSelectedComplaintId] = useState<number | null>(null)
  const [filterTab, setFilterTab] = useState<"all" | "active" | "resolved">("active")
  const [searchQuery, setSearchQuery] = useState("")

  // Form State
  const [complaintType, setComplaintType] = useState<string>("recharge-problem")
  const [selectedMeterId, setSelectedMeterId] = useState<string>("")
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "emergency">("medium")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")

  // Dropdown states & click-outside refs
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [isPriorityOpen, setIsPriorityOpen] = useState(false)
  const categoryRef = React.useRef<HTMLDivElement>(null)
  const priorityRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false)
      }
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) {
        setIsPriorityOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // UI state
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [submittedTicket, setSubmittedTicket] = useState<Complaint | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null)

  // Helper to ensure both httpOnly cookies and Bearer tokens are attached
  const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
    const token = localStorage.getItem("token")
    const headers: Record<string, string> = { ...extraHeaders }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
    return headers
  }

  // Fetch Complaints from Backend
  const fetchComplaints = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3000/api/complaints/my", {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (res.ok) {
        const data = await res.json()
        const list: Complaint[] = data.complaints || []
        setComplaints(list)

        // Select the first active complaint by default if none selected
        if (list.length > 0) {
          setSelectedComplaintId((prev) => {
            if (prev && list.some((c) => c.id === prev)) return prev
            return list[0].id
          })
        }
      }
    } catch (err) {
      console.error("Error loading complaints:", err)
    }
  }, [])

  // Fetch User's Meters
  const fetchMeters = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3000/api/meters", {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : data.meters || []
        setMeters(list)
        if (list.length > 0) {
          setSelectedMeterId(list[0].id.toString())
        }
      }
    } catch (err) {
      console.error("Error loading meters:", err)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchComplaints(), fetchMeters()])
      setLoading(false)
    }
    init()
  }, [fetchComplaints, fetchMeters])

  // Real-time WebSocket listener for live complaint updates
  useEffect(() => {
    const socket = getSocket()

    const handleComplaintUpdate = (updated: Complaint) => {
      setComplaints((prev) => {
        const exists = prev.some((c) => c.id === updated.id)
        if (exists) {
          return prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        }
        return [updated, ...prev]
      })
    }

    socket.on("complaint_update", handleComplaintUpdate)
    return () => {
      socket.off("complaint_update", handleComplaintUpdate)
    }
  }, [])

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) {
      setFeedbackMsg({ text: "Please enter both subject and description.", type: "error" })
      return
    }

    setSubmitting(true)
    setFeedbackMsg(null)

    try {
      const selectedTypeObj = COMPLAINT_TYPES.find((t) => t.id === complaintType)
      const res = await fetch("http://localhost:3000/api/complaints", {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify({
          complaint_type: selectedTypeObj?.label || complaintType,
          meter_id: selectedMeterId ? parseInt(selectedMeterId, 10) : null,
          subject: subject.trim(),
          description: description.trim(),
          priority
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        const newTicket: Complaint = data.complaint
        setComplaints((prev) => [newTicket, ...prev])
        setSubmittedTicket(newTicket)
        setSelectedComplaintId(newTicket.id)

        // Reset form inputs
        setSubject("")
        setDescription("")
        setPriority("medium")
      } else {
        setFeedbackMsg({
          text: data.message || "Failed to submit complaint. Please try again.",
          type: "error"
        })
      }
    } catch (err) {
      console.error("Error submitting complaint:", err)
      setFeedbackMsg({ text: "Network error submitting complaint.", type: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  // Simulate Status Progression (Demo feature for testing queue workflow)
  const handleUpdateStatus = async (complaintId: number, nextStatus: Complaint["status"], notes: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`http://localhost:3000/api/complaints/${complaintId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          status: nextStatus,
          resolution_notes: notes
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setComplaints((prev) =>
          prev.map((c) => (c.id === complaintId ? { ...c, ...data.complaint } : c))
        )
      }
    } catch (err) {
      console.error("Error updating status:", err)
    } finally {
      setActionLoading(false)
    }
  }

  // Derived Filtered Complaints
  const filteredComplaints = complaints.filter((c) => {
    // Filter Tab
    if (filterTab === "active" && (c.status === "resolved" || c.status === "closed")) return false
    if (filterTab === "resolved" && c.status !== "resolved" && c.status !== "closed") return false

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchTicket = c.ticket_number.toLowerCase().includes(q)
      const matchSubject = c.subject.toLowerCase().includes(q)
      const matchType = c.complaint_type.toLowerCase().includes(q)
      return matchTicket || matchSubject || matchType
    }
    return true
  })

  const selectedComplaint = complaints.find((c) => c.id === selectedComplaintId) || complaints[0]
  const selectedCategory = COMPLAINT_TYPES.find((t) => t.id === complaintType) || COMPLAINT_TYPES[0]
  const selectedPriority = PRIORITIES.find((p) => p.id === priority) || PRIORITIES[1]

  // Queue step helper
  const getStepIndex = (status: Complaint["status"]) => {
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

  const activeCount = complaints.filter((c) => c.status !== "resolved" && c.status !== "closed").length
  const resolvedCount = complaints.filter((c) => c.status === "resolved" || c.status === "closed").length

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-[#1f0704] via-[#3a0b04] to-[#120302] border border-white/10 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                Customer Support Desk
              </span>
              <span className="text-white/40 text-sm">•</span>
              <span className="text-white/60 text-xs">LECO 24/7 Service Guarantee</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Support Tickets & Queue Tracking</h1>
            <p className="text-white/70 text-sm mt-1 max-w-2xl">
              Submit issues regarding meter hardware, balance discrepancies, or power interruptions. Track real-time progress through our engineering resolution queue.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-black/40 border border-white/10 px-4 py-2.5 rounded-xl text-center min-w-[90px]">
              <div className="text-xs text-white/50 uppercase font-medium">In Queue</div>
              <div className="text-xl font-bold text-yellow-400 flex items-center justify-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                {activeCount}
              </div>
            </div>
            <div className="bg-black/40 border border-white/10 px-4 py-2.5 rounded-xl text-center min-w-[90px]">
              <div className="text-xs text-white/50 uppercase font-medium">Resolved</div>
              <div className="text-xl font-bold text-green-400">{resolvedCount}</div>
            </div>
            <div className="bg-black/40 border border-white/10 px-4 py-2.5 rounded-xl text-center min-w-[90px]">
              <div className="text-xs text-white/50 uppercase font-medium">Total Filed</div>
              <div className="text-xl font-bold text-white">{complaints.length}</div>
            </div>
            <Button
              onClick={fetchComplaints}
              variant="outline"
              size="icon"
              className="bg-black/30 border-white/10 text-white hover:bg-white/10 h-11 w-11 rounded-xl"
              title="Refresh Complaints Queue"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Complaint Submission Form (5 Cols) */}
        <div className="xl:col-span-5 space-y-6">
          <Card className="bg-gradient-to-br from-[#992511] via-[#5c1307] to-[#2b0803] border-white/10 shadow-2xl text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-yellow-400/10 rounded-full blur-2xl pointer-events-none" />

            <CardHeader className="border-b border-white/10 pb-4">
              <CardTitle className="text-xl font-bold flex items-center justify-between">
                <span>File a Complaint</span>
                <span className="text-xs font-normal px-2.5 py-1 rounded-full bg-black/30 border border-white/10 text-white/70">
                  Step 1: Submission
                </span>
              </CardTitle>
              <CardDescription className="text-white/70 text-xs">
                Fill out the details below. A unique ticket ID will be generated and routed directly into our dispatch queue.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              {submittedTicket ? (
                /* Success View with Direct Navigation to Queue */
                <div className="text-center py-6 animate-in zoom-in-95 duration-400 space-y-5">
                  <div className="mx-auto w-16 h-16 bg-green-500/20 border border-green-500/40 text-green-400 flex items-center justify-center rounded-2xl shadow-lg shadow-green-500/10">
                    <CheckCircle2 className="h-9 w-9" />
                  </div>

                  <div>
                    <span className="text-xs uppercase tracking-wider font-semibold text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                      Successfully Queued
                    </span>
                    <h3 className="text-2xl font-bold mt-2">Ticket #{submittedTicket.ticket_number}</h3>
                    <p className="text-white/70 text-sm mt-1 max-w-sm mx-auto">
                      Your complaint has been submitted and assigned to position{" "}
                      <span className="font-semibold text-white">#1</span> in the active engineering review queue.
                    </p>
                  </div>

                  <div className="bg-black/30 border border-white/10 rounded-xl p-4 text-left space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/50">Category:</span>
                      <span className="font-medium text-white">{submittedTicket.complaint_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Priority:</span>
                      <span className="font-semibold uppercase text-yellow-400">{submittedTicket.priority}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Initial Status:</span>
                      <span className="text-yellow-400 font-semibold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                        Queued for Review
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <Button
                      onClick={() => {
                        setSelectedComplaintId(submittedTicket.id)
                        setSubmittedTicket(null)
                      }}
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold h-11 rounded-xl shadow-lg"
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      View Live Tracking in Queue
                    </Button>
                    <Button
                      onClick={() => setSubmittedTicket(null)}
                      variant="outline"
                      className="w-full bg-black/20 border-white/20 text-white hover:bg-white/10 h-10 rounded-xl text-xs"
                    >
                      Submit Another Complaint
                    </Button>
                  </div>
                </div>
              ) : (
                /* Submission Form */
                <form onSubmit={handleSubmit} className="space-y-5">
                  {feedbackMsg && (
                    <div
                      className={`p-3 rounded-xl text-xs font-medium border ${
                        feedbackMsg.type === "error"
                          ? "bg-red-500/20 border-red-500/40 text-red-200"
                          : "bg-green-500/20 border-green-500/40 text-green-200"
                      }`}
                    >
                      {feedbackMsg.text}
                    </div>
                  )}

                  {/* Issue Category - Sleek Executive Dropdown */}
                  <div className="space-y-1.5 relative" ref={categoryRef}>
                    <Label className="text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                      <span>Issue Category</span>
                      <span className="text-[10px] text-white/50 normal-case">Select primary problem</span>
                    </Label>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCategoryOpen(!isCategoryOpen)
                        setIsPriorityOpen(false)
                      }}
                      className="w-full bg-black/40 hover:bg-black/60 border border-white/15 focus:border-yellow-400 rounded-xl px-3.5 py-2.5 flex items-center justify-between transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 text-left">
                        <div className="w-8 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-yellow-400 shrink-0">
                          <selectedCategory.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-yellow-300 transition-colors">
                            {selectedCategory.label}
                          </div>
                          <div className="text-[10px] text-white/50 line-clamp-1">
                            {selectedCategory.desc}
                          </div>
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-white/60 transition-transform duration-200 shrink-0 ${
                          isCategoryOpen ? "rotate-180 text-yellow-400" : ""
                        }`}
                      />
                    </button>

                    {/* Category Popover Menu */}
                    {isCategoryOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#1e0703]/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                        {COMPLAINT_TYPES.map((t) => {
                          const IconComp = t.icon
                          const isSelected = complaintType === t.id
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setComplaintType(t.id)
                                setIsCategoryOpen(false)
                              }}
                              className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-yellow-400/20 text-white border border-yellow-400/40"
                                  : "hover:bg-white/10 text-white/80 hover:text-white border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? "bg-yellow-400 text-black font-bold"
                                      : "bg-white/10 text-white/70"
                                  }`}
                                >
                                  <IconComp className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-white">{t.label}</div>
                                  <div className="text-[10px] text-white/50">{t.desc}</div>
                                </div>
                              </div>
                              {isSelected && <Check className="h-3.5 w-3.5 text-yellow-400 mr-1 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Meter Association & Priority in Balanced Two Columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Affected Smart Meter */}
                    <div className="space-y-1.5">
                      <Label htmlFor="meter-select" className="text-white text-xs font-semibold uppercase tracking-wider">
                        Affected Smart Meter
                      </Label>
                      {meters.length > 0 ? (
                        <div className="relative">
                          <select
                            id="meter-select"
                            value={selectedMeterId}
                            onChange={(e) => setSelectedMeterId(e.target.value)}
                            className="w-full appearance-none bg-black/40 hover:bg-black/60 border border-white/15 focus:border-yellow-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-all cursor-pointer pr-9 h-[42px]"
                          >
                            {meters.map((m) => (
                              <option key={m.id} value={m.id} className="bg-[#240804] text-white">
                                {m.meter_number} — {m.name || "Home"}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="h-4 w-4 text-white/50 absolute right-3 top-3 pointer-events-none" />
                        </div>
                      ) : (
                        <div className="bg-black/30 border border-white/10 rounded-xl px-3.5 py-2 flex items-center gap-2.5 text-white/60 text-xs h-[42px]">
                          <ShieldAlert className="h-4 w-4 text-yellow-400/80 shrink-0" />
                          <div className="line-clamp-1">
                            <span className="font-semibold text-white/80">General Account</span>
                            <span className="text-[9px] text-white/40 block leading-tight">No meter linked yet</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Priority Selector with Custom Dropdown */}
                    <div className="space-y-1.5 relative" ref={priorityRef}>
                      <Label className="text-white text-xs font-semibold uppercase tracking-wider">
                        Urgency / SLA
                      </Label>

                      <button
                        type="button"
                        onClick={() => {
                          setIsPriorityOpen(!isPriorityOpen)
                          setIsCategoryOpen(false)
                        }}
                        className="w-full bg-black/40 hover:bg-black/60 border border-white/15 focus:border-yellow-400 rounded-xl px-3.5 py-2 flex items-center justify-between transition-all group cursor-pointer h-[42px]"
                      >
                        <div className="flex items-center gap-2 text-left">
                          <span className={`h-2.5 w-2.5 rounded-full ${selectedPriority.dot} ring-2 ring-white/10 shrink-0`} />
                          <div className="line-clamp-1">
                            <span className={`text-xs font-bold ${selectedPriority.color}`}>
                              {selectedPriority.label}
                            </span>
                            <span className="text-[10px] text-white/50 ml-1.5 font-medium">({selectedPriority.sla})</span>
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-white/60 transition-transform duration-200 shrink-0 ${
                            isPriorityOpen ? "rotate-180 text-yellow-400" : ""
                          }`}
                        />
                      </button>

                      {/* Priority Dropdown Menu */}
                      {isPriorityOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#1e0703]/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                          {PRIORITIES.map((p) => {
                            const isSelected = priority === p.id
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setPriority(p.id as any)
                                  setIsPriorityOpen(false)
                                }}
                                className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-white/15 text-white border border-white/25"
                                    : "hover:bg-white/5 text-white/80 hover:text-white border border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className={`h-2 w-2 rounded-full ${p.dot} shrink-0`} />
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-xs font-bold ${p.color}`}>{p.label}</span>
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white/70 font-semibold">
                                        {p.sla}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-white/50">{p.desc}</div>
                                  </div>
                                </div>
                                {isSelected && <Check className="h-3.5 w-3.5 text-yellow-400 mr-1 shrink-0" />}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subject Line */}
                  <div className="space-y-1.5">
                    <Label htmlFor="subject" className="text-white text-xs">
                      Subject
                    </Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Card debited Rs. 1000 but meter balance unchanged"
                      className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl focus-visible:ring-yellow-400"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-white text-xs">
                      Detailed Description
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Provide all relevant details (e.g. transaction reference, time observed, displayed error codes on LCD)..."
                      className="bg-black/30 border-white/15 text-white text-xs min-h-[90px] rounded-xl focus-visible:ring-yellow-400"
                      required
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold h-11 rounded-xl shadow-lg hover:shadow-yellow-400/20 transition-all flex items-center justify-center"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Queuing Complaint...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit & Place in Queue
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Emergency 1987 Hotline Quick Card */}
          <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-red-500/30 text-white shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-4 w-4" />
                CEB / LECO Breakdown Emergency Hotline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-white/70 leading-relaxed">
                For life-threatening electrical hazards, spark emissions, fallen conductors, or immediate localized blackouts, contact the 24/7 hotline directly:
              </p>
              <a
                href="tel:1987"
                className="flex items-center justify-center gap-3 bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 text-red-400 font-bold p-3 rounded-xl transition-all text-xl"
              >
                <Phone className="h-5 w-5 animate-pulse" />
                1987
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Real-Time Complaint Tracking Queue (7 Cols) */}
        <div className="xl:col-span-7 space-y-6">
          <Card className="bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a] border-white/10 shadow-2xl text-white">
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-400" />
                    Complaint Tracking Queue
                  </CardTitle>
                  <CardDescription className="text-white/60 text-xs mt-0.5">
                    Live operational status of your logged tickets with LECO technical officers
                  </CardDescription>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterTab("active")}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      filterTab === "active"
                        ? "bg-yellow-400 text-black shadow-md font-semibold"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Active ({activeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab("resolved")}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      filterTab === "resolved"
                        ? "bg-green-500 text-black shadow-md font-semibold"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Resolved ({resolvedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab("all")}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      filterTab === "all"
                        ? "bg-white/20 text-white shadow-md font-semibold"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    All ({complaints.length})
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative mt-3">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-white/40" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ticket #CMP, subject, or category..."
                  className="pl-9 bg-black/30 border-white/10 text-white text-xs h-9 rounded-xl focus-visible:ring-yellow-400"
                />
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-6">
              {loading ? (
                <div className="py-16 text-center text-white/50 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
                  <span className="text-xs">Loading complaint queue...</span>
                </div>
              ) : filteredComplaints.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-black/20 p-6">
                  <FileText className="h-10 w-10 text-white/30 mx-auto mb-3" />
                  <h4 className="text-sm font-semibold text-white">No Tickets in this View</h4>
                  <p className="text-xs text-white/50 max-w-sm mx-auto mt-1">
                    {filterTab === "active"
                      ? "You have no pending complaints in the active engineering queue. All tickets have been addressed."
                      : "No tickets matching your filter criteria."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Left sub-column: Ticket List (5 cols on md) */}
                  <div className="md:col-span-5 space-y-2 max-h-[460px] overflow-y-auto pr-1">
                    {filteredComplaints.map((c) => {
                      const isSelected = c.id === (selectedComplaint?.id ?? null)
                      const isResolved = c.status === "resolved" || c.status === "closed"

                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedComplaintId(c.id)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected
                              ? "bg-gradient-to-r from-yellow-400/20 to-black/40 border-yellow-400/70 shadow-lg shadow-yellow-400/5 ring-1 ring-yellow-400/30"
                              : "bg-black/30 border-white/10 hover:bg-black/50 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold text-yellow-400">
                              #{c.ticket_number}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                                isResolved
                                  ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                  : c.status === "investigating"
                                  ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                  : c.status === "in_review"
                                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                  : "bg-yellow-400/20 text-yellow-300 border border-yellow-400/30"
                              }`}
                            >
                              {c.status.replace("_", " ")}
                            </span>
                          </div>

                          <div className="text-xs font-semibold text-white line-clamp-1 mb-1">
                            {c.subject}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-white/50">
                            <span>{c.complaint_type}</span>
                            <span>{new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Right sub-column: Selected Ticket Detailed Stepper (7 cols on md) */}
                  {selectedComplaint && (
                    <div className="md:col-span-7 bg-black/40 border border-white/10 rounded-2xl p-5 space-y-5">
                      {/* Ticket Header */}
                      <div className="flex justify-between items-start border-b border-white/10 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-yellow-400">
                              #{selectedComplaint.ticket_number}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-bold ${
                                selectedComplaint.priority === "emergency"
                                  ? "bg-red-500/20 text-red-300 border-red-500/40"
                                  : selectedComplaint.priority === "high"
                                  ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                                  : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                              }`}
                            >
                              {selectedComplaint.priority} Priority
                            </Badge>
                          </div>
                          <h4 className="text-sm font-bold text-white mt-1">{selectedComplaint.subject}</h4>
                          <p className="text-xs text-white/60 mt-0.5">
                            Category: {selectedComplaint.complaint_type}
                            {selectedComplaint.meter_number && ` • Meter: ${selectedComplaint.meter_number}`}
                          </p>
                        </div>
                      </div>

                      {/* 4-Step Interactive Tracking Stepper */}
                      <div className="space-y-4">
                        <Label className="text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                          <span>Live Progress Stepper</span>
                          <span className="text-[10px] text-white/50 normal-case">
                            Step {getStepIndex(selectedComplaint.status) + 1} of 4
                          </span>
                        </Label>

                        <div className="relative pl-6 space-y-4 before:absolute before:inset-y-2 before:left-[11px] before:w-[2px] before:bg-white/15">
                          {STATUS_STEPS.map((step, idx) => {
                            const currentIdx = getStepIndex(selectedComplaint.status)
                            const isCompleted = idx < currentIdx
                            const isCurrent = idx === currentIdx
                            const isPending = idx > currentIdx

                            return (
                              <div key={step.key} className="relative group">
                                {/* Dot Icon */}
                                <span
                                  className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full flex items-center justify-center transition-all ${
                                    isCompleted
                                      ? "bg-green-500 ring-4 ring-black"
                                      : isCurrent
                                      ? "bg-yellow-400 ring-4 ring-yellow-400/20 animate-pulse"
                                      : "bg-white/20 ring-4 ring-black"
                                  }`}
                                >
                                  {isCompleted && <Check className="h-2 w-2 text-black stroke-[3]" />}
                                </span>

                                <div>
                                  <div className="flex items-center gap-2">
                                    <p
                                      className={`text-xs font-bold ${
                                        isCurrent
                                          ? "text-yellow-400"
                                          : isCompleted
                                          ? "text-white"
                                          : "text-white/40"
                                      }`}
                                    >
                                      {step.label}
                                    </p>
                                    {isCurrent && (
                                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-300 font-semibold">
                                        Current Stage
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-white/50 mt-0.5">{step.desc}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Ticket Description */}
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3 text-xs space-y-1">
                        <span className="text-white/50 font-medium text-[10px] uppercase">Customer Description</span>
                        <p className="text-white/80 leading-relaxed">{selectedComplaint.description}</p>
                      </div>

                      {/* Resolution / Officer Notes if present */}
                      {selectedComplaint.resolution_notes && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-xs space-y-1">
                          <span className="text-green-400 font-semibold text-[10px] uppercase flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Officer Resolution Remarks
                          </span>
                          <p className="text-white/90 leading-relaxed">{selectedComplaint.resolution_notes}</p>
                          {selectedComplaint.resolved_at && (
                            <span className="text-[10px] text-white/50 block mt-1">
                              Resolved: {new Date(selectedComplaint.resolved_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Quick Testing Progression Bar (Simulates Support Staff moving the queue) */}
                      <div className="border-t border-white/10 pt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-yellow-300 font-semibold flex items-center gap-1.5">
                            <Sliders className="h-3.5 w-3.5" />
                            Simulate Queue Progression (Demo)
                          </span>
                          {actionLoading && <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={actionLoading || selectedComplaint.status === "in_review"}
                            onClick={() =>
                              handleUpdateStatus(
                                selectedComplaint.id,
                                "in_review",
                                "Assigned to Technical Officer Bandara for initial verification."
                              )
                            }
                            className="bg-black/40 hover:bg-yellow-400 hover:text-black border border-white/15 text-[10px] font-semibold text-white h-8 rounded-lg transition-all"
                          >
                            Set In Review
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={actionLoading || selectedComplaint.status === "investigating"}
                            onClick={() =>
                              handleUpdateStatus(
                                selectedComplaint.id,
                                "investigating",
                                "Telemetry meter logs inspected. Line technician dispatched."
                              )
                            }
                            className="bg-black/40 hover:bg-orange-400 hover:text-black border border-white/15 text-[10px] font-semibold text-white h-8 rounded-lg transition-all"
                          >
                            Set Investigating
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={actionLoading || selectedComplaint.status === "resolved"}
                            onClick={() =>
                              handleUpdateStatus(
                                selectedComplaint.id,
                                "resolved",
                                "Balance credit packet synchronized with smart meter. Issue resolved."
                              )
                            }
                            className="bg-black/40 hover:bg-green-500 hover:text-black border border-white/15 text-[10px] font-semibold text-white h-8 rounded-lg transition-all"
                          >
                            Set Resolved
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
