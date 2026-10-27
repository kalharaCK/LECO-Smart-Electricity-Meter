import { useState, useEffect, useCallback } from "react"
import {
  FileText,
  Search,
  RefreshCw,
  ShieldAlert,
  Zap,
  ZapOff,
  CreditCard,
  UserPlus,
  Sliders,
  Mail,
  Loader2,
  X,
  Code
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { API_BASE_URL } from "@/lib/api"

interface ActivityLogItem {
  id: number
  staff_id: number | null
  staff_email: string
  action_type: string
  target_entity: string
  details: Record<string, any> | string
  ip_address: string
  status: string
  created_at: string
}

interface ActivityLogsManagementProps {
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>
}

export default function ActivityLogsManagement({ getAuthHeaders }: ActivityLogsManagementProps) {
  const [logs, setLogs] = useState<ActivityLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (actionFilter) params.append("actionType", actionFilter)
      if (searchTerm) params.append("search", searchTerm)
      params.append("limit", "150")

      const res = await fetch(`${API_BASE_URL}/api/staff/activity-logs?${params.toString()}`, {
        headers: getAuthHeaders(),
        credentials: "include"
      })

      if (res.ok) {
        const data = await res.json()
        if (data.logs && Array.isArray(data.logs)) {
          setLogs(data.logs)
        }
      }
    } catch (err) {
      console.error("Error fetching staff activity logs:", err)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders, actionFilter, searchTerm])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Metric Computations
  const totalLogs = logs.length
  const relayEventsCount = logs.filter(
    (l) => l.action_type === "RELAY_CONNECT" || l.action_type === "RELAY_CUTOFF"
  ).length
  const topupEventsCount = logs.filter((l) => l.action_type === "STAFF_MANUAL_TOPUP").length
  const securityAlertsCount = logs.filter(
    (l) => l.action_type === "PASSWORD_VERIFY_FAILED" || l.status === "failed"
  ).length

  const getActionBadge = (actionType: string, status: string) => {
    if (status === "failed" || actionType === "PASSWORD_VERIFY_FAILED") {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] font-mono">
          <ShieldAlert className="h-3 w-3 mr-1 shrink-0" />
          {actionType}
        </Badge>
      )
    }

    switch (actionType) {
      case "RELAY_CONNECT":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-mono">
            <Zap className="h-3 w-3 mr-1 shrink-0" />
            RELAY_CONNECT
          </Badge>
        )
      case "RELAY_CUTOFF":
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] font-mono">
            <ZapOff className="h-3 w-3 mr-1 shrink-0" />
            RELAY_CUTOFF
          </Badge>
        )
      case "STAFF_MANUAL_TOPUP":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] font-mono">
            <CreditCard className="h-3 w-3 mr-1 shrink-0" />
            STAFF_MANUAL_TOPUP
          </Badge>
        )
      case "CREATE_CUSTOMER_MEMBER":
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] font-mono">
            <UserPlus className="h-3 w-3 mr-1 shrink-0" />
            CREATE_CUSTOMER
          </Badge>
        )
      case "UPDATE_SYSTEM_SETTINGS":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] font-mono">
            <Sliders className="h-3 w-3 mr-1 shrink-0" />
            SYSTEM_SETTINGS
          </Badge>
        )
      case "UPDATE_EMAIL_CREDENTIALS":
        return (
          <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px] font-mono">
            <Mail className="h-3 w-3 mr-1 shrink-0" />
            EMAIL_CONFIG
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-white/10 text-white/80 border-white/20 text-[10px] font-mono">
            {actionType}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs font-medium">
            <span>Audit Entries</span>
            <FileText className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-white">{totalLogs}</span>
            <span className="text-[11px] text-white/60 block font-medium">Recorded Operations</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Relay Commands</span>
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-400">{relayEventsCount}</span>
            <span className="text-[11px] text-emerald-500/70 block">Connect & Cutoff Relays</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Manual Topups</span>
            <CreditCard className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-amber-400">{topupEventsCount}</span>
            <span className="text-[11px] text-amber-400/70 block">Emergency Credit Overrides</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Security Alerts</span>
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-rose-400">{securityAlertsCount}</span>
            <span className="text-[11px] text-rose-400/70 block">Failed Password Attempts</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="bg-[#0f0f11] border-white/5 shadow-2xl">
        <CardContent className="p-6">
          {/* Header & Controls Strip */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/5">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-yellow-400" />
                Traceable Staff Operations Audit Log
              </h2>
              <p className="text-xs text-white/50 mt-0.5">
                Every sensitive administrative action, relay modification, topup, credential edit, and security barrier challenge is immutably logged with timestamp and IP address.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={loading}
              className="h-9 text-xs border-white/10 hover:bg-white/5 text-white/70 cursor-pointer self-start md:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh Logs
            </Button>
          </div>

          {/* Search & Quick Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 my-5">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search logs by staff email, target entity, or action..."
                className="bg-[#141416] border-white/10 pl-10 text-xs h-10 text-white placeholder:text-white/30 focus-visible:ring-yellow-400/30 w-full"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#141416] p-1 rounded-xl border border-white/5 self-stretch sm:self-auto shrink-0 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActionFilter("")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  actionFilter === "" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                All Actions
              </button>
              <button
                type="button"
                onClick={() => setActionFilter("RELAY_CONNECT")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  actionFilter === "RELAY_CONNECT" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                Connects
              </button>
              <button
                type="button"
                onClick={() => setActionFilter("RELAY_CUTOFF")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  actionFilter === "RELAY_CUTOFF" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                Cutoffs
              </button>
              <button
                type="button"
                onClick={() => setActionFilter("STAFF_MANUAL_TOPUP")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  actionFilter === "STAFF_MANUAL_TOPUP" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                Topups
              </button>
              <button
                type="button"
                onClick={() => setActionFilter("CREATE_CUSTOMER_MEMBER")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  actionFilter === "CREATE_CUSTOMER_MEMBER" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                New Members
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#141416] text-[11px] font-bold text-white/50 uppercase tracking-wider border-b border-white/5">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Staff Officer</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Origin IP</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-white/80 font-mono">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-white/40 font-sans">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                          <span>Retrieving activity audit trail...</span>
                        </div>
                      ) : (
                        "No traceable staff activity records found."
                      )}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-white/60 whitespace-nowrap text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <span className="font-semibold text-white block text-xs">{log.staff_email}</span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">{getActionBadge(log.action_type, log.status)}</td>

                      <td className="py-3 px-4 font-sans text-white/90">{log.target_entity || "-"}</td>

                      <td className="py-3 px-4 text-white/50 text-[11px]">{log.ip_address || "127.0.0.1"}</td>

                      <td className="py-3 px-4">
                        {log.status === "success" ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] uppercase font-sans"
                          >
                            Success
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px] uppercase font-sans"
                          >
                            Failed
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-sans">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="h-7 text-[11px] border-white/10 hover:bg-white/5 text-white/80 cursor-pointer"
                        >
                          View Payload
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Details JSON Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl p-6 text-white relative">
            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/5">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 flex items-center justify-center">
                <Code className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Audit Payload Inspector</h3>
                <p className="text-[11px] text-white/50">Log ID #{selectedLog.id} - {selectedLog.action_type}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div className="grid grid-cols-2 gap-3 bg-[#141416] p-3 rounded-xl border border-white/5 font-sans">
                <div>
                  <span className="text-white/40 text-[10px] block uppercase font-bold">Staff Email</span>
                  <span className="font-semibold text-white">{selectedLog.staff_email}</span>
                </div>
                <div>
                  <span className="text-white/40 text-[10px] block uppercase font-bold">Action Type</span>
                  <span className="font-semibold text-yellow-400 font-mono">{selectedLog.action_type}</span>
                </div>
                <div>
                  <span className="text-white/40 text-[10px] block uppercase font-bold">Target</span>
                  <span className="font-semibold text-white">{selectedLog.target_entity}</span>
                </div>
                <div>
                  <span className="text-white/40 text-[10px] block uppercase font-bold">Timestamp</span>
                  <span className="font-semibold text-white">{new Date(selectedLog.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <span className="text-white/50 text-[10px] uppercase font-bold block mb-1">
                  Structured Payload (JSON)
                </span>
                <pre className="bg-[#09090b] p-4 rounded-xl border border-white/10 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-60">
                  {typeof selectedLog.details === "object"
                    ? JSON.stringify(selectedLog.details, null, 2)
                    : selectedLog.details}
                </pre>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedLog(null)}
                className="border-white/10 text-white/70 hover:bg-white/5 text-xs h-9 px-5 cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
