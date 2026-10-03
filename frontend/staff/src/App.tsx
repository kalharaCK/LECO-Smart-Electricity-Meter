import { useState, useEffect, useCallback } from "react"
import {
  Zap,
  Cpu,
  MessageSquareWarning,
  LogOut
} from "lucide-react"
import { Button } from "@/components/ui/button"
import StaffLogin from "./components/StaffLogin"
import MetersManagement from "./components/MetersManagement"
import ComplaintsManagement from "./components/ComplaintsManagement"
import { getSocket } from "./lib/socket"
import type { StaffMeter, StaffComplaint, StaffUser } from "./types"

export function App() {
  const [user, setUser] = useState<StaffUser | null>(null)
  const [token, setToken] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"meters" | "complaints">("meters")

  // Data states
  const [meters, setMeters] = useState<StaffMeter[]>([])
  const [complaints, setComplaints] = useState<StaffComplaint[]>([])
  const [loadingMeters, setLoadingMeters] = useState(false)
  const [loadingComplaints, setLoadingComplaints] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)

  // Cross-tab jump
  const [complaintMeterFilter, setComplaintMeterFilter] = useState("")

  const getAuthHeaders = useCallback((extra: Record<string, string> = {}) => {
    const savedToken = token || localStorage.getItem("staff_token") || ""
    const headers: Record<string, string> = { ...extra }
    if (savedToken) {
      headers["Authorization"] = `Bearer ${savedToken}`
    }
    return headers
  }, [token])

  // Load existing session from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("staff_user")
    const savedToken = localStorage.getItem("staff_token")
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser))
        setToken(savedToken)
      } catch (e) {
        console.error("Error parsing staff user from localStorage", e)
      }
    }
  }, [])

  // Fetch Meters
  const fetchMeters = useCallback(async () => {
    setLoadingMeters(true)
    try {
      const res = await fetch("http://localhost:3000/api/meters/all", {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (res.ok) {
        const data = await res.json()
        if (data.meters && Array.isArray(data.meters)) {
          setMeters(data.meters)
        }
      }
    } catch (err) {
      console.error("Error fetching meters:", err)
    } finally {
      setLoadingMeters(false)
    }
  }, [getAuthHeaders])

  // Fetch Complaints
  const fetchComplaints = useCallback(async () => {
    setLoadingComplaints(true)
    try {
      const res = await fetch("http://localhost:3000/api/complaints/all", {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (res.ok) {
        const data = await res.json()
        if (data.complaints && Array.isArray(data.complaints)) {
          setComplaints(data.complaints)
        }
      }
    } catch (err) {
      console.error("Error fetching complaints:", err)
    } finally {
      setLoadingComplaints(false)
    }
  }, [getAuthHeaders])

  // When user is authenticated, fetch initial data
  useEffect(() => {
    if (user) {
      fetchMeters()
      fetchComplaints()
    }
  }, [user, fetchMeters, fetchComplaints])

  // WebSocket Live Real-Time Integration
  useEffect(() => {
    if (!user) return

    const socket = getSocket()

    const handleConnect = () => setSocketConnected(true)
    const handleDisconnect = () => setSocketConnected(false)

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    if (socket.connected) setSocketConnected(true)

    // Listen to real-time complaint updates from customers or other staff
    const handleComplaintUpdate = (updated: StaffComplaint) => {
      setComplaints((prev) => {
        const exists = prev.some((c) => c.id === updated.id)
        if (exists) {
          return prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        }
        return [updated, ...prev]
      })
    }

    // Listen to real-time meter telemetry updates
    const handleMeterUpdate = (payload: any) => {
      if (payload && payload.meterId) {
        setMeters((prev) =>
          prev.map((m) =>
            m.id === payload.meterId
              ? {
                  ...m,
                  balance: payload.balance ?? m.balance,
                  status: payload.status ?? m.status,
                  emergency_credit_active: payload.emergency_credit_active ?? m.emergency_credit_active
                }
              : m
          )
        )
      } else {
        // Fallback re-fetch
        fetchMeters()
      }
    }

    socket.on("complaint_update", handleComplaintUpdate)
    socket.on("meter_update", handleMeterUpdate)

    return () => {
      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("complaint_update", handleComplaintUpdate)
      socket.off("meter_update", handleMeterUpdate)
    }
  }, [user, fetchMeters])

  const handleLogout = () => {
    localStorage.removeItem("staff_token")
    localStorage.removeItem("staff_user")
    setUser(null)
    setToken("")
  }

  // Cross-tab jump from Meter to Complaints
  const handleSelectComplaintTabWithMeter = (meterNumber: string) => {
    setComplaintMeterFilter(meterNumber)
    setActiveTab("complaints")
  }

  // If unauthenticated, show high-tech Staff Login screen
  if (!user) {
    return (
      <StaffLogin
        onLoginSuccess={(loggedInUser, loggedInToken) => {
          setUser(loggedInUser)
          setToken(loggedInToken)
        }}
      />
    )
  }

  const openComplaintsCount = complaints.filter(
    (c) => c.status === "submitted" || c.status === "in_review" || c.status === "investigating"
  ).length

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans flex flex-col selection:bg-[#992511]/30 selection:text-white">
      {/* Top Operations Header */}
      <header className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-md border-b border-white/5 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Terminal Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#992511] to-[#3a0b04] border border-white/10 flex items-center justify-center shadow-lg shadow-[#992511]/20 shrink-0">
              <Zap className="h-5 w-5 text-yellow-400" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base lg:text-lg tracking-tight text-white">
                  LECO <span className="text-yellow-400">OPERATIONS</span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                  STAFF TERMINAL
                </span>
              </div>
              <p className="text-[11px] text-white/50 hidden sm:block">
                Advanced Metering Infrastructure (AMI) Grid Control & Complaint Dispatch
              </p>
            </div>
          </div>

          {/* Right Header Status & Profile Controls */}
          <div className="flex items-center gap-3">
            {/* Live Socket Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/5 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  socketConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
                }`}
              />
              <span className="text-white/70 text-[11px] font-mono">
                {socketConnected ? "Grid Telemetry Live" : "Reconnecting..."}
              </span>
            </div>

            {/* Staff Profile Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0f0f11] border border-white/5 text-xs">
              <div className="w-6 h-6 rounded-full bg-[#992511] text-white flex items-center justify-center font-bold text-[10px]">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden md:block">
                <span className="font-semibold text-white block text-xs leading-none">
                  {user.email}
                </span>
                <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider block mt-0.5">
                  LECO Operations Staff
                </span>
              </div>
            </div>

            {/* Logout */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 text-xs h-9 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Subheader & Tab Switcher */}
      <div className="bg-[#0f0f11] border-b border-white/5 px-4 lg:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {activeTab === "meters" ? "Smart Meters Fleet Command" : "Customer Complaints & Engineering Triage"}
            </h1>
            <p className="text-xs text-white/60 mt-1 max-w-xl">
              {activeTab === "meters"
                ? "Full telemetry monitoring, live balance tracking, remote relay cutoff & instant credit relief."
                : "Triage customer complaints, dispatch field technicians, update progress stages, and push live resolution notices."}
            </p>
          </div>

          {/* Executive Tab Switcher */}
          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("meters")}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "meters"
                  ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Cpu className="h-4 w-4" />
              Smart Meters Fleet ({meters.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setComplaintMeterFilter("")
                setActiveTab("complaints")
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "complaints"
                  ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <MessageSquareWarning className="h-4 w-4" />
              Complaints Queue
              {openComplaintsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-500 text-white animate-pulse">
                  {openComplaintsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8">
        {activeTab === "meters" ? (
          <MetersManagement
            meters={meters}
            loading={loadingMeters}
            onRefresh={fetchMeters}
            onSelectComplaintTabWithMeter={handleSelectComplaintTabWithMeter}
            getAuthHeaders={getAuthHeaders}
          />
        ) : (
          <ComplaintsManagement
            complaints={complaints}
            loading={loadingComplaints}
            onRefresh={fetchComplaints}
            initialMeterSearch={complaintMeterFilter}
            getAuthHeaders={getAuthHeaders}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 px-4 text-center text-xs text-white/30">
        LECO Smart AMI Engineering Console • Port 5174 • Real-Time Dual-Way WebSocket Synchronized
      </footer>
    </div>
  )
}

export default App
