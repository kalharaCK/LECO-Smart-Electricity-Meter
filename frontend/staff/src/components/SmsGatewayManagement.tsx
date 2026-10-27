import { useState, useMemo, useEffect } from "react"
import { 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  X, 
  Search, 
  ShieldCheck, 
  Radio, 
  Zap, 
  Globe2, 
  Check, 
  Loader2,
  FileText,
  Download
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { SmsLog, SmsBalance, SmsStats, StaffMeter } from "../types"

interface SmsGatewayManagementProps {
  meters: StaffMeter[]
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>
}

export default function SmsGatewayManagement({
  meters,
  getAuthHeaders
}: SmsGatewayManagementProps) {
  // Data states
  const [balance, setBalance] = useState<SmsBalance | null>(null)
  const [stats, setStats] = useState<SmsStats>({ total_sent: 0, total_delivered: 0, total_failed: 0, sent_today: 0 })
  const [logs, setLogs] = useState<SmsLog[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Dispatch Studio states
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "si" | "ta">("en")
  const [selectedTemplate, setSelectedTemplate] = useState<string>("low_balance")
  const [recipient, setRecipient] = useState<string>("")
  const [customMessage, setCustomMessage] = useState<string>("")
  const [accountNo, setAccountNo] = useState<string>("")
  const [amount, setAmount] = useState<string>("500.00")
  const [balanceVal, setBalanceVal] = useState<string>("0.00")
  const [refNo, setRefNo] = useState<string>("PAY-" + Date.now().toString().slice(-4))
  const [sendingSms, setSendingSms] = useState(false)
  const [dispatchAlert, setDispatchAlert] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Automatically sync Dispatch Studio recipient and account with live meters
  useEffect(() => {
    if (meters && meters.length > 0 && !accountNo) {
      const first = meters[0]
      setRecipient(first.phone_number || "")
      setAccountNo(first.account_number || first.meter_number || "")
      setBalanceVal(parseFloat(String(first.balance || 0)).toFixed(2))
    }
  }, [meters, accountNo])

  // Broadcast Low Balance states
  const [broadcastThreshold, setBroadcastThreshold] = useState<number>(300)
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null)

  // Table filter & inspect states
  const [searchQuery, setSearchQuery] = useState("")
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all")
  const [selectedLog, setSelectedLog] = useState<SmsLog | null>(null)

  // Templates in 3 languages
  const templates = useMemo(() => ({
    low_balance: {
      id: "low_balance",
      name: "Low Balance Warning",
      en: `LECO Alert: Low balance on A/C ${accountNo || 'ACC'}. Current: LKR ${balanceVal || '0.00'}. Reload now at leco.lk to avoid cutoff.`,
      si: `LECO අනතුරු ඇඟවීම: ${accountNo || 'ගිණුමේ'} ශේෂය රු.${balanceVal || '0.00'} කි. විසන්ධිවීම් වලක්වා ගැනීමට වහාම මුදල් පුරවන්න.`,
      ta: `LECO எச்சரிக்கை: கணக்கு ${accountNo || 'ACC'} இல் இருப்பு ரூ.${balanceVal || '0.00'}. துண்டிக்கப்படுவதைத் தவிர்க்க உடனே ரீசார்ஜ் செய்யவும்.`
    },
    payment: {
      id: "payment",
      name: "Payment Receipt",
      en: `LECO Self Care: Paid LKR ${amount || '0.00'} for A/C ${accountNo || 'ACC'}. Ref: ${refNo || 'PAY'}. Bal: LKR ${balanceVal || '0.00'}. Thank you.`,
      si: `LECO: ${accountNo || 'ගිණුම'} ට රු.${amount || '0.00'} ගෙවීම සාර්ථකයි. අංකය: ${refNo || 'PAY'}. නව ශේෂය: රු.${balanceVal || '0.00'}. ස්තූතියි.`,
      ta: `LECO: கணக்கு ${accountNo || 'ACC'} இற்கு ரூ.${amount || '0.00'} பெறப்பட்டது. குறிப்பு: ${refNo || 'PAY'}. இருப்பு: ரூ.${balanceVal || '0.00'}. நன்றி.`
    },
    relay_command: {
      id: "relay_command",
      name: "Power Relay Supply Alert",
      en: `LECO Notice: Power supply for meter ${accountNo || 'METER'} is now Active. Helpline: 1987.`,
      si: `LECO: ${accountNo || 'මීටරයේ'} විදුලි සැපයුම සක්‍රිය කර ඇත. විස්තර: 1987.`,
      ta: `LECO: மீட்டர் ${accountNo || 'METER'} மின் இணைப்பு செயலில் உள்ளது. உதவி: 1987.`
    },
    login_attempt: {
      id: "login_attempt",
      name: "Account Login Alert",
      en: `LECO Alert: Account login detected at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. If not you, please call 1987.`,
      si: `LECO දැනුම්දීම: ගිණුමට ඇතුළු වීමක් වාර්තා විය. ඔබ නොවේ නම් 1987 අමතන්න.`,
      ta: `LECO எச்சரிக்கை: கணக்கில் உள்நுழைவு நிகழ்ந்தது. நீங்கள் இல்லையெனில் 1987 ஐ அழைக்கவும்.`
    },
    custom: {
      id: "custom",
      name: "Custom Free-Text Announcement",
      en: customMessage || "LECO Official Notice: Scheduled system maintenance in your area.",
      si: customMessage || "LECO නිල දැනුම්දීම: ඔබගේ ප්‍රදේශයේ සැලසුම් කළ පද්ධති නඩත්තු කටයුත්තක් සිදුවේ.",
      ta: customMessage || "LECO உத்தியோகபூர்வ அறிவிப்பு: உங்கள் பகுதியில் பராமரிப்பு பணிகள் நடைபெறுகின்றன."
    }
  }), [accountNo, balanceVal, amount, refNo, customMessage])

  // Active message to be dispatched
  const activeMessage = useMemo(() => {
    const t = templates[selectedTemplate as keyof typeof templates] || templates.custom
    return t[selectedLanguage] || t.en
  }, [templates, selectedTemplate, selectedLanguage])

  // Fetch live gateway data
  const fetchData = async () => {
    setRefreshing(true)
    try {
      // 1. Balance
      const balRes = await fetch("http://localhost:3000/api/staff/sms/balance", {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (balRes.ok) {
        const balData = await balRes.json()
        if (balData.balance?.data) {
          setBalance(balData.balance.data)
        }
      }

      // 2. Logs
      const logsRes = await fetch("http://localhost:3000/api/staff/sms/logs?limit=100", {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        if (logsData.logs) {
          setLogs(logsData.logs)
        }
        if (logsData.stats) {
          setStats(logsData.stats)
        }
      }
    } catch (err) {
      console.error("Error fetching SMS gateway data:", err)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [])

  // Send Single SMS
  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipient.trim()) {
      setDispatchAlert({ type: "error", text: "Please enter a valid mobile number." })
      return
    }

    setSendingSms(true)
    setDispatchAlert(null)

    try {
      const res = await fetch("http://localhost:3000/api/staff/sms/send", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          recipient: recipient.trim(),
          message: activeMessage,
          language: selectedLanguage,
          eventType: selectedTemplate
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setDispatchAlert({
          type: "success",
          text: `SMS dispatched successfully to ${data.recipient || recipient}. Status: ${data.status}`
        })
        fetchData()
      } else {
        setDispatchAlert({
          type: "error",
          text: data.error || data.errorMessage || "Failed to send SMS through gateway."
        })
      }
    } catch (err: any) {
      setDispatchAlert({ type: "error", text: err.message || "Network error dispatching SMS." })
    } finally {
      setSendingSms(false)
    }
  }

  // Scan & Broadcast Low Balance Alerts
  const handleBroadcastLowBalance = async () => {
    setBroadcasting(true)
    setBroadcastResult(null)
    try {
      const res = await fetch("http://localhost:3000/api/staff/sms/broadcast-low-balance", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          threshold: broadcastThreshold,
          language: selectedLanguage
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setBroadcastResult(
          `Scanned ${data.scannedMetersCount} meters below LKR ${broadcastThreshold}. Dispatched warning SMS to ${data.smsDispatchedCount} accounts.`
        )
        fetchData()
      } else {
        setBroadcastResult("Error: " + (data.error || "Failed to broadcast warnings."))
      }
    } catch (err: any) {
      setBroadcastResult("Network Error: " + err.message)
    } finally {
      setBroadcasting(false)
    }
  }

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        l.recipient.toLowerCase().includes(q) ||
        l.message.toLowerCase().includes(q) ||
        (l.provider_uid && l.provider_uid.toLowerCase().includes(q))

      const matchesType =
        eventTypeFilter === "all" ||
        l.event_type.toLowerCase() === eventTypeFilter.toLowerCase()

      return matchesSearch && matchesType
    })
  }, [logs, searchQuery, eventTypeFilter])

  // Quick recipient autofill from meters fleet
  const handleSelectMeterForSms = (m: StaffMeter) => {
    setRecipient(m.phone_number || "")
    setAccountNo(m.account_number || m.meter_number)
    setBalanceVal(parseFloat(String(m.balance)).toFixed(2))
  }

  const isUnicode = /[\u0D80-\u0DFF\u0B80-\u0BFF]/.test(activeMessage)
  const charLimit = isUnicode ? 70 : 160

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return
    const headers = ["Time", "Recipient", "Event Type", "Language", "Message", "Status", "Units Charged"]
    const rows = filteredLogs.map(l => [
      new Date(l.created_at).toLocaleString("en-US"),
      l.recipient,
      l.event_type,
      l.language,
      l.message,
      l.status,
      l.cost || 1
    ])
    const csv = [headers.join(","), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `LECO_SMS_Logs_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading && logs.length === 0 && !balance) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-8 w-8 text-yellow-400 animate-spin mb-3" />
        <p className="text-sm font-semibold text-white/70">Connecting to Text.lk Programmable SMS Gateway...</p>
        <p className="text-xs text-white/40 mt-1">Fetching live balance and transmission records</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Gateway Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Remaining Units */}
        <Card className="bg-[#121214] border-white/10 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">SMS Balance Units</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {balance?.remaining_balance != null ? balance.remaining_balance : "0"} <span className="text-xs font-normal text-yellow-400">Units</span>
              </h3>
              <p className="text-[11px] text-white/40 mt-1">
                {balance?.expired_on ? `Expires: ${balance.expired_on}` : "Gateway Active"}
              </p>
            </div>
            <div className="p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-2xl text-yellow-400">
              <Radio className="h-6 w-6 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        {/* Total Delivered */}
        <Card className="bg-[#121214] border-white/10 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Delivered Messages</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                {stats.total_delivered}
              </h3>
              <p className="text-[11px] text-white/40 mt-1">
                {stats.total_sent > 0 ? `${Math.round((stats.total_delivered / stats.total_sent) * 100)}% Success Rate` : "100% Reliability"}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Dispatched Today */}
        <Card className="bg-[#121214] border-white/10 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Dispatched Today</p>
              <h3 className="text-2xl font-bold text-sky-400 mt-1">
                {stats.sent_today} <span className="text-xs font-normal text-white/40">Alerts</span>
              </h3>
              <p className="text-[11px] text-white/40 mt-1">
                Lifetime: {stats.total_sent} Messages
              </p>
            </div>
            <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-2xl text-sky-400">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Gateway Connection Status */}
        <Card className="bg-[#121214] border-white/10 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Gateway Status</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-lg font-bold text-white">Text.lk Live</h3>
              </div>
              <p className="text-[11px] text-white/40 mt-1">
                Bearer Token Active
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Studio Split: Dispatch Form (Left) & Broadcast Scanner (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Quick SMS Dispatch Studio */}
        <div className="lg:col-span-2 bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="h-5 w-5 text-yellow-400" />
                Programmable SMS Dispatch Studio
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                Dispatch trilingual, high-clarity transactional notices directly to consumer mobile devices.
              </p>
            </div>

            {/* Language Switcher Pill */}
            <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setSelectedLanguage("en")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedLanguage === "en" ? "bg-yellow-400 text-black shadow-sm" : "text-white/60 hover:text-white"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setSelectedLanguage("si")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedLanguage === "si" ? "bg-yellow-400 text-black shadow-sm" : "text-white/60 hover:text-white"
                }`}
              >
                සිංහල
              </button>
              <button
                type="button"
                onClick={() => setSelectedLanguage("ta")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedLanguage === "ta" ? "bg-yellow-400 text-black shadow-sm" : "text-white/60 hover:text-white"
                }`}
              >
                தமிழ்
              </button>
            </div>
          </div>

          <form onSubmit={handleSendSms} className="space-y-5">
            {/* Template Selector Tabs */}
            <div>
              <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-2">
                Select Transactional Event Template
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {[
                  { id: "low_balance", label: "Low Balance" },
                  { id: "payment", label: "Payment Receipt" },
                  { id: "relay_command", label: "Relay Power" },
                  { id: "login_attempt", label: "Login Alert" },
                  { id: "custom", label: "Custom Text" }
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border text-center cursor-pointer ${
                      selectedTemplate === tpl.id
                        ? "bg-yellow-400/15 border-yellow-400/50 text-yellow-300 font-bold"
                        : "bg-white/[0.03] border-white/5 text-white/60 hover:text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Number & Fleet Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-1.5">
                  Recipient Mobile Number
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="e.g. 0771234567 or 94771234567"
                    className="bg-black/40 border-white/10 text-white placeholder:text-white/30 h-10 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-1.5">
                  Autofill from Fleet Customer
                </label>
                <select
                  onChange={(e) => {
                    const found = meters.find((m) => String(m.id) === e.target.value)
                    if (found) handleSelectMeterForSms(found)
                  }}
                  defaultValue=""
                  className="w-full bg-black/40 border border-white/10 text-white text-xs h-10 px-3 rounded-xl focus:outline-none focus:border-yellow-400"
                >
                  <option value="" disabled>-- Select consumer account --</option>
                  {meters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.account_number || m.meter_number} • {m.customer_email.split('@')[0]} ({m.phone_number})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Template Specific Variables */}
            {selectedTemplate !== "custom" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                <div>
                  <label className="block text-[11px] text-white/50 mb-1">Account / Meter</label>
                  <Input
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    className="bg-black/50 border-white/10 text-white h-8 text-xs rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-white/50 mb-1">Balance (LKR)</label>
                  <Input
                    value={balanceVal}
                    onChange={(e) => setBalanceVal(e.target.value)}
                    className="bg-black/50 border-white/10 text-white h-8 text-xs rounded-lg"
                  />
                </div>
                {selectedTemplate === "payment" && (
                  <>
                    <div>
                      <label className="block text-[11px] text-white/50 mb-1">Amount (LKR)</label>
                      <Input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-black/50 border-white/10 text-white h-8 text-xs rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-white/50 mb-1">Payment Ref</label>
                      <Input
                        value={refNo}
                        onChange={(e) => setRefNo(e.target.value)}
                        className="bg-black/50 border-white/10 text-white h-8 text-xs rounded-lg"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Custom Message Field */}
            {selectedTemplate === "custom" && (
              <div>
                <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-1.5">
                  Custom Message Content
                </label>
                <textarea
                  rows={3}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Type clear and concise message to consumer..."
                  className="w-full bg-black/40 border border-white/10 text-white placeholder:text-white/30 text-xs p-3 rounded-xl focus:outline-none focus:border-yellow-400"
                />
              </div>
            )}

            {/* Live Message Preview Box */}
            <div className="bg-black/50 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-yellow-400" />
                  Live Preview on Recipient Device
                </span>
                <span className="text-[11px] text-white/40">
                  {activeMessage.length} / {charLimit} chars • {isUnicode ? "Unicode (UCS-2)" : "GSM Plain"}
                </span>
              </div>
              <div className="bg-[#18181b] border border-white/10 p-3 rounded-xl font-mono text-xs text-white/90 leading-relaxed shadow-inner">
                {activeMessage}
              </div>
            </div>

            {/* Feedback Alert */}
            {dispatchAlert && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
                  dispatchAlert.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/10 border border-red-500/30 text-red-300"
                }`}
              >
                <span>{dispatchAlert.text}</span>
                <button
                  type="button"
                  onClick={() => setDispatchAlert(null)}
                  className="text-white/40 hover:text-white p-0.5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Send Button */}
            <Button
              type="submit"
              disabled={sendingSms}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold text-sm h-11 rounded-xl shadow-lg shadow-yellow-400/10 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
            >
              {sendingSms ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transmitting over Text.lk Gateway...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Dispatch Instant SMS
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Right Column (1 Col): Automated Fleet Low-Balance Broadcast */}
        <div className="bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Low Balance Fleet Alert</h3>
                <p className="text-xs text-white/50">Automated consumer notifications</p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed mb-5">
              Scan all smart meters in the fleet where balance has fallen below the safety threshold and send proactive refill notices before remote cutoff.
            </p>

            <div className="space-y-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl mb-5">
              <div>
                <label className="block text-xs font-bold text-white/60 mb-1.5">
                  Balance Threshold (LKR)
                </label>
                <Input
                  type="number"
                  value={broadcastThreshold}
                  onChange={(e) => setBroadcastThreshold(parseFloat(e.target.value) || 0)}
                  className="bg-black/50 border-white/10 text-white h-9 rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-white/50">Meters Below Threshold:</span>
                <span className="font-bold text-red-400">
                  {meters.filter((m) => Number(m.balance) <= broadcastThreshold).length} Meters
                </span>
              </div>
            </div>

            {broadcastResult && (
              <div className="p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-xs text-yellow-300 leading-relaxed mb-4">
                {broadcastResult}
              </div>
            )}
          </div>

          <Button
            type="button"
            onClick={handleBroadcastLowBalance}
            disabled={broadcasting}
            className="w-full bg-red-600/90 hover:bg-red-600 text-white font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
          >
            {broadcasting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning Fleet & Dispatching...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Scan & Broadcast Low Balance
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Live SMS Gateway Dispatch Ledger */}
      <div className="bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-yellow-400" />
              Live SMS Transmission Audit Ledger
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Full cryptographic record of OTP codes, payment receipts, low balance alerts, and login verifications.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <Input
                type="text"
                placeholder="Search phone, text, UID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-black/40 border-white/10 text-white text-xs h-9 rounded-xl placeholder:text-white/30"
              />
            </div>

            {/* Event Filter */}
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="bg-black/40 border border-white/10 text-white text-xs h-9 px-3 rounded-xl focus:outline-none focus:border-yellow-400"
            >
              <option value="all">All Events</option>
              <option value="otp_registration">Registration OTP</option>
              <option value="otp_forgot_password">Password Reset OTP</option>
              <option value="login_attempt">Login Alert</option>
              <option value="payment">Payment Receipt</option>
              <option value="low_balance">Low Balance</option>
              <option value="relay_command">Relay Power</option>
              <option value="custom">Custom</option>
            </select>

            {/* Refresh */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={refreshing}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs h-9 px-3 rounded-xl cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-yellow-400" : ""}`} />
            </Button>

            {/* Export CSV */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filteredLogs.length === 0}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs h-9 px-3 rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5 text-yellow-400" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/5">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/10 text-white/60 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Lang</th>
                <th className="py-3 px-4">Message Preview</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Cost</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-white/40">
                    No SMS transmission records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isDelivered = log.status === "delivered"
                  const isFailed = log.status === "failed"

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-mono text-white/60 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("en-GB", {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                        {log.recipient}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge className="bg-white/10 text-white/90 border-white/15 text-[10px] uppercase font-mono">
                          {log.event_type.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-yellow-400 border border-yellow-400/20">
                          {log.language || "en"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-white/80">
                        {log.message}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            <Check className="h-3 w-3 stroke-[3]" /> Delivered
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                            <AlertCircle className="h-3 w-3" /> Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full">
                            <Clock className="h-3 w-3" /> Sent
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-white/60 font-mono">
                        {log.cost || "1"} Unit
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLog(log)
                          }}
                          className="text-yellow-400 hover:text-yellow-300 font-semibold underline underline-offset-2 cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-yellow-400" />
                <h4 className="text-lg font-bold text-white">SMS Transmission Record</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                <div>
                  <span className="text-white/40 block text-[10px] uppercase">Recipient</span>
                  <span className="font-mono font-bold text-white text-sm">{selectedLog.recipient}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px] uppercase">Status</span>
                  <span className="font-bold text-emerald-400">{selectedLog.status}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px] uppercase">Event Type</span>
                  <span className="font-mono text-white">{selectedLog.event_type}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px] uppercase">Language</span>
                  <span className="font-bold text-yellow-400 uppercase">{selectedLog.language || "en"}</span>
                </div>
              </div>

              <div>
                <span className="text-white/40 block text-[10px] uppercase mb-1">Full SMS Message</span>
                <div className="p-3 bg-black/60 rounded-xl border border-white/10 text-white font-mono text-xs leading-relaxed">
                  {selectedLog.message}
                </div>
              </div>

              {selectedLog.provider_uid && (
                <div>
                  <span className="text-white/40 block text-[10px] uppercase">Text.lk Gateway UID</span>
                  <span className="font-mono text-white/70">{selectedLog.provider_uid}</span>
                </div>
              )}

              {selectedLog.error_message && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300">
                  <span className="font-bold block text-[10px] uppercase">Gateway Error:</span>
                  {selectedLog.error_message}
                </div>
              )}

              <div className="text-[11px] text-white/40 pt-2 border-t border-white/5">
                Timestamp: {new Date(selectedLog.created_at).toLocaleString()}
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="w-full mt-6 bg-white/10 hover:bg-white/15 text-white font-bold text-xs h-10 rounded-xl cursor-pointer"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
