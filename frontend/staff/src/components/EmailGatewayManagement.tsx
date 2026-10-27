import { API_BASE_URL } from "@/lib/api"
import { useState, useEffect, useCallback } from "react"
import {
  Mail,
  Key,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Send,
  Loader2,
  ShieldCheck,
  HelpCircle,
  Clock,
  Search
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { EmailConfig, EmailLog } from "../types"

interface EmailGatewayManagementProps {
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>
}

export default function EmailGatewayManagement({ getAuthHeaders }: EmailGatewayManagementProps) {
  // Config state
  const [config, setConfig] = useState<EmailConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configAlert, setConfigAlert] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Form state
  const [senderEmail, setSenderEmail] = useState("")
  const [appPassword, setAppPassword] = useState("")
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com")
  const [smtpPort, setSmtpPort] = useState("465")
  const [showPassword, setShowPassword] = useState(false)

  // Test email state
  const [testEmail, setTestEmail] = useState("")
  const [sendingTest, setSendingTest] = useState(false)
  const [testAlert, setTestAlert] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Audit logs state
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [purposeFilter, setPurposeFilter] = useState("all")

  // Fetch current email config
  const fetchConfig = useCallback(async () => {
    setLoadingConfig(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/email/config`, {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (res.ok) {
        const data = await res.json()
        if (data.config) {
          setConfig(data.config)
          setSenderEmail(data.config.senderEmail || "")
          setSmtpHost(data.config.smtpHost || "smtp.gmail.com")
          setSmtpPort(String(data.config.smtpPort || 465))
        }
      }
    } catch (err: any) {
      console.error("Error fetching email configuration:", err)
    } finally {
      setLoadingConfig(false)
    }
  }, [getAuthHeaders])

  // Fetch email audit logs
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/email/logs?limit=100`, {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (res.ok) {
        const data = await res.json()
        if (data.logs && Array.isArray(data.logs)) {
          setLogs(data.logs)
        }
      }
    } catch (err: any) {
      console.error("Error fetching email logs:", err)
    } finally {
      setLoadingLogs(false)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    fetchConfig()
    fetchLogs()
  }, [fetchConfig, fetchLogs])

  // Save updated email settings
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setConfigAlert(null)

    if (!senderEmail || !senderEmail.includes("@")) {
      setConfigAlert({ type: "error", text: "Please provide a valid sender email address." })
      return
    }

    if (!config?.isConfigured && !appPassword.trim()) {
      setConfigAlert({ type: "error", text: "Google App Password is required for first-time configuration." })
      return
    }

    setSavingConfig(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/email/config`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          senderEmail: senderEmail.trim(),
          appPassword: appPassword.trim() || undefined,
          smtpHost: smtpHost.trim(),
          smtpPort: parseInt(smtpPort, 10) || 465
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update email gateway configuration.")
      }

      setConfigAlert({ type: "success", text: "Email gateway credentials updated and verified successfully." })
      setAppPassword("")
      fetchConfig()
    } catch (err: any) {
      setConfigAlert({ type: "error", text: err.message })
    } finally {
      setSavingConfig(false)
    }
  }

  // Dispatch live test email
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setTestAlert(null)

    if (!testEmail || !testEmail.includes("@")) {
      setTestAlert({ type: "error", text: "Please enter a valid test recipient email address." })
      return
    }

    setSendingTest(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/email/test`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ testEmail: testEmail.trim() })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch test verification email.")
      }

      setTestAlert({
        type: "success",
        text: `Diagnostic test email dispatched successfully to ${testEmail} (Ref: ${data.messageId || 'SENT'})`
      })
      fetchLogs()
    } catch (err: any) {
      setTestAlert({ type: "error", text: err.message })
    } finally {
      setSendingTest(false)
    }
  }

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchQuery === "" ||
      log.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.purpose.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesPurpose = purposeFilter === "all" || log.purpose === purposeFilter

    return matchesSearch && matchesPurpose
  })

  return (
    <div className="space-y-6">
      {/* Overview Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Connection Status */}
        <Card className="bg-[#0f1422] border-white/5 shadow-xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Gateway Status</p>
              <div className="flex items-center gap-2 mt-1">
                {config?.isConfigured ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-base font-bold text-white">Active & Ready</span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                    <span className="text-base font-bold text-amber-300">Pending Setup</span>
                  </>
                )}
              </div>
            </div>
            <div className={`p-3 rounded-2xl ${config?.isConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {config?.isConfigured ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
            </div>
          </CardContent>
        </Card>

        {/* Sender Email */}
        <Card className="bg-[#0f1422] border-white/5 shadow-xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Sender Email</p>
              <p className="text-sm font-bold text-white truncate mt-1" title={config?.senderEmail || "Not Configured"}>
                {config?.senderEmail || "Not Configured"}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 shrink-0">
              <Mail className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Credential Source */}
        <Card className="bg-[#0f1422] border-white/5 shadow-xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Config Source</p>
              <p className="text-sm font-bold text-white mt-1 capitalize">
                {config?.source === 'database' ? 'Staff Portal (DB)' : config?.source === 'environment' ? 'Server .env File' : 'None'}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-yellow-500/10 text-yellow-400">
              <Server className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Total Emails Dispatched */}
        <Card className="bg-[#0f1422] border-white/5 shadow-xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Emails Dispatched</p>
              <p className="text-2xl font-bold text-white mt-0.5">{logs.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400">
              <Send className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-[#0f1422] border-white/5 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Key className="h-4 w-4 text-yellow-400" />
                    Gmail SMTP Credentials Configuration
                  </h2>
                  <p className="text-xs text-white/50 mt-0.5">
                    Configure your official sender email and Google 16-character App Password to dispatch dual OTPs and verification notices.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchConfig}
                  disabled={loadingConfig}
                  className="h-8 text-xs border-white/10 hover:bg-white/5 cursor-pointer text-white/70"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingConfig ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {configAlert && (
                <div
                  className={`p-3.5 rounded-xl text-xs mb-5 flex items-start gap-2.5 ${
                    configAlert.type === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {configAlert.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span>{configAlert.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveConfig} className="space-y-4">
                {/* Sender Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 flex items-center justify-between">
                    <span>Sender Gmail Address</span>
                    <span className="text-[10px] text-white/40">Official LECO Dispatcher</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                    <Input
                      type="email"
                      required
                      placeholder="e.g. yourname@gmail.com or leco.smartcare@gmail.com"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      className="bg-[#0b0f17] border-white/10 pl-9 text-xs h-10 text-white placeholder:text-white/20 focus-visible:ring-yellow-400/30"
                    />
                  </div>
                </div>

                {/* App Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 flex items-center justify-between">
                    <span>Google App Password (16 Characters)</span>
                    {config?.maskedPassword && (
                      <span className="text-[10px] text-emerald-400 font-mono">
                        Saved: {config.maskedPassword}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={config?.isConfigured ? "Leave blank to keep existing password, or enter new" : "e.g. abcd efgh ijkl mnop"}
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      className="bg-[#0b0f17] border-white/10 pl-9 pr-10 text-xs h-10 text-white font-mono placeholder:text-white/20 focus-visible:ring-yellow-400/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-white/40 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    Enter the 16-letter App Password generated in your Google Account security settings. Spaces are automatically handled.
                  </p>
                </div>

                {/* SMTP Server & Port */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/70">SMTP Host</label>
                    <Input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="bg-[#0b0f17] border-white/10 text-xs h-10 text-white placeholder:text-white/20 focus-visible:ring-yellow-400/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/70">SMTP Port</label>
                    <Input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="465"
                      className="bg-[#0b0f17] border-white/10 text-xs h-10 text-white placeholder:text-white/20 focus-visible:ring-yellow-400/30"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end">
                  <Button
                    type="submit"
                    disabled={savingConfig}
                    className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-xs h-10 px-6 rounded-xl cursor-pointer shadow-lg shadow-yellow-400/10"
                  >
                    {savingConfig ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving Configuration...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4 mr-1.5" />
                        Save Email Configuration
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Diagnostic Test Email Dispatcher */}
          <Card className="bg-[#0f1422] border-white/5 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Send className="h-4 w-4 text-blue-400" />
                    Live SMTP Connectivity & Delivery Test
                  </h3>
                  <p className="text-xs text-white/50 mt-0.5">
                    Send a formatted test email to verify credentials, TLS handshake, and delivery to customer inboxes.
                  </p>
                </div>
              </div>

              {testAlert && (
                <div
                  className={`p-3.5 rounded-xl text-xs mb-4 flex items-start gap-2.5 ${
                    testAlert.type === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {testAlert.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span>{testAlert.text}</span>
                </div>
              )}

              <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                  <Input
                    type="email"
                    required
                    placeholder="Enter your personal or test email address"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="bg-[#0b0f17] border-white/10 pl-9 text-xs h-10 text-white placeholder:text-white/20 focus-visible:ring-yellow-400/30"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={sendingTest || !config?.isConfigured}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-5 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {sendingTest ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing SMTP...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1.5" />
                      Send Test Email
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Google App Password Instructions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-[#0f1422] border-white/5 shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <HelpCircle className="h-4 w-4 text-amber-400" />
                How to Generate a Gmail App Password
              </h3>
              <p className="text-xs text-white/60 leading-relaxed mb-4">
                Google requires a dedicated 16-character <strong>App Password</strong> when sending automated transactional emails via SMTP.
              </p>

              <ol className="space-y-3 text-xs text-white/70 list-decimal list-inside leading-relaxed">
                <li className="pl-1">
                  Log into your Google Account at <span className="text-yellow-400 font-mono">myaccount.google.com</span>.
                </li>
                <li className="pl-1">
                  Navigate to the <strong>Security</strong> tab and ensure <strong>2-Step Verification</strong> is switched ON.
                </li>
                <li className="pl-1">
                  Search for or click on <strong>App Passwords</strong> (under "How you sign in to Google").
                </li>
                <li className="pl-1">
                  Name the application <strong className="text-white">"LECO Smart Meter"</strong> and click <strong>Create</strong>.
                </li>
                <li className="pl-1">
                  Copy the generated 16-character password and paste it into the form on the left.
                </li>
              </ol>

              <div className="mt-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 leading-relaxed">
                <strong>Security Standard:</strong> The App Password gives limited SMTP sending permissions and does not expose your main account password. All OTP codes sent via email expire in 10 minutes.
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats Summary */}
          <Card className="bg-[#0f1422] border-white/5 shadow-xl">
            <CardContent className="p-6 space-y-3">
              <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider">Dual Verification Architecture</h4>
              <div className="space-y-2 text-xs text-white/60 leading-relaxed">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Dual Channel: OTP is sent simultaneously to SMS and Email.</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Single OTP Code: The user can check either SMS or Email.</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Zero-Emoji Compliance: Standard corporate HTML layouts only.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Email Delivery Audit Ledger */}
      <Card className="bg-[#0f1422] border-white/5 shadow-xl">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5 mb-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-400" />
                Email Delivery Audit Ledger
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                Real-time log of customer registration OTPs, password reset codes, and email verifications.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/40" />
                <Input
                  type="text"
                  placeholder="Search recipient or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#0b0f17] border-white/10 pl-8 text-xs h-9 w-48 sm:w-64 text-white placeholder:text-white/20"
                />
              </div>

              {/* Filter */}
              <select
                value={purposeFilter}
                onChange={(e) => setPurposeFilter(e.target.value)}
                className="bg-[#0b0f17] border border-white/10 text-white/80 text-xs h-9 px-3 rounded-lg cursor-pointer"
              >
                <option value="all">All Purposes</option>
                <option value="registration">Registration OTP</option>
                <option value="forgot_password">Password Reset OTP</option>
                <option value="verify_email">Email Verification</option>
                <option value="test_diagnostic">Diagnostic Test</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="h-9 px-3 text-xs border-white/10 hover:bg-white/5 cursor-pointer text-white/70"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-white/40 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Recipient</th>
                  <th className="py-3 px-3">Purpose</th>
                  <th className="py-3 px-3">Subject</th>
                  <th className="py-3 px-3">Delivery Status</th>
                  <th className="py-3 px-3">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-white/40 text-xs">
                      {loadingLogs ? "Loading email records..." : "No email dispatch records found."}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 font-medium text-white">{log.recipient}</td>
                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold uppercase ${
                            log.purpose === 'registration'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : log.purpose === 'forgot_password'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : log.purpose === 'verify_email'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          }`}
                        >
                          {log.purpose.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-white/70 max-w-xs truncate" title={log.subject}>
                        {log.subject}
                      </td>
                      <td className="py-3 px-3">
                        {log.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Delivered
                          </span>
                        ) : log.status === 'pending_config' ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                            <Clock className="h-3.5 w-3.5" />
                            Pending SMTP
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-red-400 font-semibold" title={log.error_message}>
                            <AlertCircle className="h-3.5 w-3.5" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-white/40 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
