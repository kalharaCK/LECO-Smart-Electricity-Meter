import { API_BASE_URL } from "@/lib/api"
import { useState, useEffect, useCallback } from "react"
import {
  Cpu,
  MessageSquareWarning,
  LogOut,
  CreditCard,
  Send
} from "lucide-react"
import { Button } from "@/components/ui/button"
import StaffLogin from "./components/StaffLogin"
import MetersManagement from "./components/MetersManagement"
import ComplaintsManagement from "./components/ComplaintsManagement"
import PayhereVerification from "./components/PayhereVerification"
import SmsGatewayManagement from "./components/SmsGatewayManagement"
import { getSocket } from "./lib/socket"
import type { StaffMeter, StaffComplaint, StaffUser, PayhereTransaction } from "./types"

export function App() {
  const [user, setUser] = useState<StaffUser | null>(null)
  const [activeTab, setActiveTab] = useState<"meters" | "complaints" | "payhere" | "sms">("meters")

  // Data states
  const [meters, setMeters] = useState<StaffMeter[]>([])
  const [complaints, setComplaints] = useState<StaffComplaint[]>([])
  const [payhereTransactions, setPayhereTransactions] = useState<PayhereTransaction[]>([])
  const [loadingMeters, setLoadingMeters] = useState(false)
  const [loadingComplaints, setLoadingComplaints] = useState(false)
  const [loadingPayhere, setLoadingPayhere] = useState(false)

  // Cross-tab jump
  const [complaintMeterFilter, setComplaintMeterFilter] = useState("")

  const getAuthHeaders = useCallback((extra: Record<string, string> = {}) => ({ ...extra }), [])

  // Restore the session from the HTTP-only cookie.
  useEffect(() => {
    localStorage.removeItem("staff_token")
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" })
      .then(async (res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.user && ["staff", "admin"].includes(data.user.role?.toLowerCase())) {
          setUser(data.user)
          localStorage.setItem("staff_user", JSON.stringify(data.user))
        } else localStorage.removeItem("staff_user")
      })
      .catch(() => localStorage.removeItem("staff_user"))
  }, [])

  // Fetch Meters
  const fetchMeters = useCallback(async () => {
    setLoadingMeters(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/meters/all`, {
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
      const res = await fetch(`${API_BASE_URL}/api/complaints/all`, {
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

  // Fetch PayHere Transactions
  const fetchPayhereTransactions = useCallback(async () => {
    setLoadingPayhere(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/payments/payhere-transactions`, {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (res.ok) {
        const data = await res.json()
        if (data.transactions && Array.isArray(data.transactions)) {
          setPayhereTransactions(data.transactions)
        }
      }
    } catch (err) {
      console.error("Error fetching PayHere transactions:", err)
    } finally {
      setLoadingPayhere(false)
    }
  }, [getAuthHeaders])

  // When user is authenticated, fetch initial data and maintain continuous REST polling
  useEffect(() => {
    if (user) {
      fetchMeters()
      fetchComplaints()
      fetchPayhereTransactions()

      // High-reliability REST API background synchronization (10-second polling cadence)
      const interval = setInterval(() => {
        fetchMeters()
        fetchComplaints()
        fetchPayhereTransactions()
      }, 10000)

      return () => clearInterval(interval)
    }
  }, [user, fetchMeters, fetchComplaints, fetchPayhereTransactions])

  // WebSocket Live Real-Time Integration
  useEffect(() => {
    if (!user) return

    const socket = getSocket()

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
                  emergency_credit_active: payload.emergency_credit_active ?? m.emergency_credit_active,
                  today_kwh: payload.today !== undefined ? parseFloat(String(payload.today)) : m.today_kwh
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
      socket.off("complaint_update", handleComplaintUpdate)
      socket.off("meter_update", handleMeterUpdate)
    }
  }, [user, fetchMeters])

  const handleLogout = async () => {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined)
    localStorage.removeItem("staff_user")
    setUser(null)
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
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser)
        }}
      />
    )
  }

  const openComplaintsCount = complaints.filter(
    (c) => c.status === "submitted" || c.status === "in_review" || c.status === "investigating"
  ).length

  const pendingPayhereCount = payhereTransactions.filter(
    (t) => t.status.toLowerCase() === "pending" || t.status.toLowerCase() === "review_needed"
  ).length

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans flex flex-col selection:bg-[#992511]/30 selection:text-white">
      {/* Top Operations Header */}
      <header className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-md border-b border-white/5 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Terminal Identity */}
          <div className="flex items-center gap-3">
            <img src="/leco-logo.png" alt="LECO Self Care" className="h-10 w-auto object-contain shrink-0" />

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base lg:text-lg tracking-tight text-white">
                  LECO <span className="text-yellow-400">Self Care</span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                  STAFF PORTAL
                </span>
              </div>
              <p className="text-[11px] text-white/50 hidden sm:block">
                LECO Self Care Smart Grid Operations & Complaint Dispatch
              </p>
            </div>
          </div>

          {/* Right Header Status & Profile Controls */}
          <div className="flex items-center gap-3">
            {/* Live REST API Synchronization Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/5 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/70 text-[11px] font-mono">
                REST Grid Synced
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
              {activeTab === "meters"
                ? "Smart Meters Fleet Command"
                : activeTab === "complaints"
                ? "Customer Complaints & Engineering Triage"
                : activeTab === "payhere"
                ? "PayHere Payment Gateway Ledger & Verification"
                : "Text.lk SMS Gateway & Trilingual Alerts Center"}
            </h1>
            <p className="text-xs text-white/60 mt-1 max-w-xl">
              {activeTab === "meters"
                ? "Full telemetry monitoring, live balance tracking, remote relay cutoff & instant credit relief."
                : activeTab === "complaints"
                ? "Triage customer complaints, dispatch field technicians, update progress stages, and push live resolution notices."
                : activeTab === "payhere"
                ? "Verify online checkout tokens, inspect MD5 digital signatures, review PayHere webhook callbacks, and conduct manual reconciliations."
                : "Live SMS balance tracking, instant transactional SMS dispatch (English, Sinhala, Tamil), automated low-balance fleet broadcasts, and full transmission audit ledger."}
            </p>
          </div>

          {/* Executive Tab Switcher */}
          <div className="flex flex-wrap items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("meters")}
              className={`px-4 lg:px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
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
              className={`px-4 lg:px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
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

            <button
              type="button"
              onClick={() => setActiveTab("payhere")}
              className={`px-4 lg:px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "payhere"
                  ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              PayHere Ledger ({payhereTransactions.length})
              {pendingPayhereCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-black">
                  {pendingPayhereCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("sms")}
              className={`px-4 lg:px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "sms"
                  ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Send className="h-4 w-4" />
              SMS Gateway
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
        ) : activeTab === "complaints" ? (
          <ComplaintsManagement
            complaints={complaints}
            loading={loadingComplaints}
            onRefresh={fetchComplaints}
            initialMeterSearch={complaintMeterFilter}
            getAuthHeaders={getAuthHeaders}
          />
        ) : activeTab === "payhere" ? (
          <PayhereVerification
            transactions={payhereTransactions}
            loading={loadingPayhere}
            onRefresh={fetchPayhereTransactions}
            getAuthHeaders={getAuthHeaders}
          />
        ) : (
          <SmsGatewayManagement
            meters={meters}
            getAuthHeaders={getAuthHeaders}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 px-4 text-center text-xs text-white/30">
        LECO Self Care Operations Console • Port 5174 • Real-Time Dual-Way WebSocket Synchronized
      </footer>
    </div>
  )
}

export default App
