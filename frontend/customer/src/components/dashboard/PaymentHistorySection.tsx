import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  History as HistoryIcon, 
  Search, 
  CreditCard, 
  Smartphone, 
  Building2, 
  CheckCircle2, 
  Loader2, 
  ArrowUpRight, 
  Copy, 
  Check, 
  Receipt, 
  Calendar, 
  Zap,
  TrendingUp,
  Download,
  X,
  FileText
} from "lucide-react"
import { useDashboardI18n } from "@/lib/dashboardI18n"

interface PaymentRecord {
  id: number
  user_id: number
  meter_id: number
  amount: string | number
  payment_method: string
  transaction_id: string
  previous_balance: string | number
  new_balance: string | number
  status: string
  created_at: string
  meter_number: string
  meter_name?: string
}

interface PaymentHistorySectionProps {
  refreshKey?: number
  onNavigateRecharge?: () => void
}

export default function PaymentHistorySection({
  refreshKey = 0,
  onNavigateRecharge,
}: PaymentHistorySectionProps) {
  const { t } = useDashboardI18n()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | string | null>(null)

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const res = await fetch("http://localhost:3000/api/payments/history", {
        credentials: "include",
      })
      if (res.ok) {
        const data = await res.json()
        setPayments(data)
      }
    } catch (e) {
      console.error("Error fetching payment history:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [refreshKey])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const exportToCsv = () => {
    if (filteredPayments.length === 0) return
    const headers = ["Date", "Time", "Transaction ID", "Meter Number", "Meter Name", "Payment Method", "Amount (LKR)", "Previous Balance (LKR)", "New Balance (LKR)", "Status"]
    const rows = filteredPayments.map((p) => [
      new Date(p.created_at).toLocaleDateString("en-US"),
      new Date(p.created_at).toLocaleTimeString("en-US"),
      p.transaction_id,
      p.meter_number,
      p.meter_name || "N/A",
      p.payment_method,
      Number(p.amount).toFixed(2),
      Number(p.previous_balance).toFixed(2),
      Number(p.new_balance).toFixed(2),
      p.status || "completed"
    ])
    const csvContent = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `LECO_Payment_History_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintReceipt = (receipt: PaymentRecord) => {
    const printWindow = window.open("", "_blank", "width=600,height=700")
    if (!printWindow) {
      window.print()
      return
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>LECO Payment Receipt - ${receipt.transaction_id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #111; max-width: 480px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 16px; margin-bottom: 20px; }
            .logo { height: 48px; margin-bottom: 8px; }
            .title { font-size: 18px; font-weight: bold; margin: 0; color: #992511; }
            .subtitle { font-size: 12px; color: #666; margin-top: 4px; }
            .row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
            .row.total { font-size: 16px; font-weight: bold; border-top: 2px solid #111; border-bottom: 2px solid #111; margin-top: 12px; padding: 10px 0; }
            .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #888; border-top: 1px dashed #ccc; padding-top: 16px; }
            .badge { display: inline-block; padding: 2px 8px; background: #e6f4ea; color: #137333; border-radius: 4px; font-weight: bold; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Lanka Electricity Company (Pvt) Ltd</h1>
            <p class="subtitle">Official Smart Meter Prepaid Payment Receipt</p>
          </div>
          <div class="row"><span>Transaction ID</span><strong>${receipt.transaction_id}</strong></div>
          <div class="row"><span>Date & Time</span><span>${new Date(receipt.created_at).toLocaleString()}</span></div>
          <div class="row"><span>Meter Number</span><strong>${receipt.meter_number} ${receipt.meter_name ? `(${receipt.meter_name})` : ''}</strong></div>
          <div class="row"><span>Payment Channel</span><span>${receipt.payment_method}</span></div>
          <div class="row"><span>Payment Status</span><span class="badge">${(receipt.status || 'completed').toUpperCase()}</span></div>
          <div class="row"><span>Previous Balance</span><span>Rs. ${Number(receipt.previous_balance).toFixed(2)}</span></div>
          <div class="row"><span>Top-Up Amount</span><strong>Rs. ${Number(receipt.amount).toFixed(2)}</strong></div>
          <div class="row total"><span>New Meter Balance</span><span>Rs. ${Number(receipt.new_balance).toFixed(2)}</span></div>
          <div class="footer">
            <p>Thank you for using LECO Self Care Services.</p>
            <p>For 24/7 inquiries, call 1910 or visit www.leco.lk</p>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handleDownloadPdf = async (receipt: PaymentRecord) => {
    const targetId = receipt.id || receipt.transaction_id
    try {
      setDownloadingId(targetId)
      const token = localStorage.getItem("token")
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch(`http://localhost:3000/api/payments/${targetId}/receipt-pdf`, {
        headers,
        credentials: "include",
      })

      if (!res.ok) {
        throw new Error("Failed to generate PDF")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `LECO_Payment_Receipt_${receipt.transaction_id || targetId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("PDF download failed:", err)
      handlePrintReceipt(receipt)
    } finally {
      setDownloadingId(null)
    }
  }

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments.filter((item) => {
      const matchesSearch =
        item.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.meter_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.meter_name && item.meter_name.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesMethod =
        methodFilter === "all" || item.payment_method.toLowerCase() === methodFilter.toLowerCase()

      return matchesSearch && matchesMethod
    })
  }, [payments, searchTerm, methodFilter])

  // Summary statistics
  const stats = useMemo(() => {
    const totalAmount = payments
      .filter((p) => p.payment_method !== "Monthly Cycle Settlement")
      .reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
    const count = payments.length
    const latest = payments[0] || null
    return { totalAmount, count, latest }
  }, [payments])

  const getMethodIcon = (method: string) => {
    switch (method?.toLowerCase()) {
      case "card":
        return <CreditCard className="h-4 w-4 text-yellow-400" />
      case "wallet":
        return <Smartphone className="h-4 w-4 text-emerald-400" />
      case "bank":
        return <Building2 className="h-4 w-4 text-blue-400" />
      case "monthly cycle settlement":
        return <Receipt className="h-4 w-4 text-amber-400" />
      default:
        return <CreditCard className="h-4 w-4 text-yellow-400" />
    }
  }

  const getMethodLabel = (method: string) => {
    switch (method?.toLowerCase()) {
      case "card":
        return t.history.filterCard
      case "wallet":
        return t.history.filterWallet
      case "bank":
        return t.history.filterBank
      case "monthly cycle settlement":
        return t.overview.settleCycle
      default:
        return method || t.history.filterCard
    }
  }

  if (loading && payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        <p className="text-white/60 text-sm">{t.overview.calculating}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-1">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <HistoryIcon className="h-8 w-8 text-[#992511]" />
            {t.history.title}
          </h2>
          <p className="text-white/60 text-sm mt-1">
            {t.history.subtitle}
          </p>
        </div>
        {onNavigateRecharge && (
          <Button
            onClick={onNavigateRecharge}
            className="bg-[#992511] hover:bg-[#992511]/80 text-white shadow-lg transition-transform hover:scale-105 font-medium flex items-center gap-2 self-start md:self-auto cursor-pointer"
          >
            <Zap className="h-4 w-4 text-yellow-400" />
            {t.overview.rechargeNow}
          </Button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Recharged */}
        <Card className="bg-gradient-to-br from-[#992511] to-[#3a0b04] border-0 shadow-xl text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-white/70 text-xs uppercase tracking-wider font-semibold flex items-center justify-between">
              {t.history.totalSpent}
              <TrendingUp className="h-4 w-4 text-yellow-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              Rs. {stats.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-white/60 mt-1">{t.addMeter.manageMetersDesc}</p>
          </CardContent>
        </Card>

        {/* Transactions Count */}
        <Card className="bg-[#0f0f11] border border-white/10 shadow-lg text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-white/60 text-xs uppercase tracking-wider font-semibold flex items-center justify-between">
              {t.history.successfulRecharges}
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.count}</div>
            <p className="text-xs text-white/50 mt-1">{t.history.totalTransactions}</p>
          </CardContent>
        </Card>

        {/* Latest Top-up */}
        <Card className="bg-[#0f0f11] border border-white/10 shadow-lg text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-white/60 text-xs uppercase tracking-wider font-semibold flex items-center justify-between">
              {t.payments.successTitle}
              <Calendar className="h-4 w-4 text-blue-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.latest ? (
              <>
                <div className="text-3xl font-bold text-yellow-400">
                  Rs. {Number(stats.latest.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-white/50 mt-1">
                  {new Date(stats.latest.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  at {new Date(stats.latest.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </>
            ) : (
              <div className="text-white/40 text-sm py-1">{t.history.noRecords}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Payment History Table & Search */}
      <Card className="bg-[#0f0f11] border border-white/10 shadow-xl text-white">
        <CardHeader className="border-b border-white/5 pb-3 sm:pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg font-semibold text-white">{t.history.title}</CardTitle>
              <CardDescription className="text-white/50 text-xs mt-0.5">
                {filteredPayments.length} / {payments.length} {t.history.totalTransactions.toLowerCase()}
              </CardDescription>
            </div>

            {/* Filter pills with mobile horizontal scroll */}
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 text-xs overflow-x-auto w-full sm:w-auto scrollbar-none">
              {[
                { id: "all", label: t.history.filterAll },
                { id: "card", label: t.history.filterCard },
                { id: "wallet", label: t.history.filterWallet },
                { id: "bank", label: t.history.filterBank },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethodFilter(m.id)}
                  className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all shrink-0 cursor-pointer ${
                    methodFilter === m.id
                      ? "bg-yellow-400 text-black shadow font-semibold"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar and Export */}
          <div className="mt-3 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                type="text"
                placeholder={t.history.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-black/30 border-white/10 text-white placeholder:text-white/40 pl-10 h-10 text-xs sm:text-sm focus-visible:ring-yellow-400 rounded-xl"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={exportToCsv}
              disabled={filteredPayments.length === 0}
              className="bg-black/40 hover:bg-white/10 text-white border-white/15 h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shrink-0 transition-colors"
            >
              <Download className="h-4 w-4 text-yellow-400" />
              <span>Export CSV</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="bg-white/5 p-5 rounded-full mb-3">
                <Receipt className="h-10 w-10 text-white/30" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white mb-1">
                {t.history.noRecords}
              </h3>
              <p className="text-white/50 text-xs sm:text-sm max-w-sm mb-5">
                {t.history.noRecordsDesc}
              </p>
              {onNavigateRecharge && (
                <Button
                  onClick={onNavigateRecharge}
                  className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg text-xs sm:text-sm h-10 cursor-pointer"
                >
                  {t.overview.rechargeNow}
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE VIEW: Sleek Native Card Feed */}
              <div className="block md:hidden divide-y divide-white/5">
                {filteredPayments.map((item) => (
                  <div key={item.id} className="p-3.5 space-y-2.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-white/50 font-medium">
                        {new Date(item.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        •{" "}
                        {new Date(item.created_at).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px] py-0 px-2 font-normal">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                        {item.status === "completed" || !item.status ? t.history.completed : item.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                          {item.transaction_id}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.transaction_id)}
                          className="text-white/40 hover:text-white p-1 cursor-pointer"
                          title="Copy ID"
                        >
                          {copiedId === item.transaction_id ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className={`font-bold text-base ${
                        item.payment_method === "Monthly Cycle Settlement" || Number(item.new_balance) < Number(item.previous_balance)
                          ? "text-amber-400" 
                          : "text-green-400"
                      }`}>
                        {item.payment_method === "Monthly Cycle Settlement" || Number(item.new_balance) < Number(item.previous_balance) ? "- " : "+ "}
                        Rs. {Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs text-white/70">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-yellow-400 shrink-0" />
                          <span className="font-mono text-[11px] text-white">{item.meter_number}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-white/50">
                          {getMethodIcon(item.payment_method)}
                          <span className="capitalize">{getMethodLabel(item.payment_method)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedReceipt(item)}
                        className="h-7 px-2 text-xs text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 cursor-pointer"
                      >
                        {t.history.receiptCol}
                        <ArrowUpRight className="h-3 w-3 ml-0.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP VIEW: Full Data Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/40 text-white/50 text-xs uppercase tracking-wider border-b border-white/5">
                    <tr>
                      <th className="py-3 px-4">{t.history.dateCol}</th>
                      <th className="py-3 px-4">{t.history.referenceCol}</th>
                      <th className="py-3 px-4">{t.history.meterCol}</th>
                      <th className="py-3 px-4">{t.history.methodCol}</th>
                      <th className="py-3 px-4 text-right">{t.history.amountCol}</th>
                      <th className="py-3 px-4 text-center">{t.overview.projectedNetAfterSettlement}</th>
                      <th className="py-3 px-4 text-center">{t.history.statusCol}</th>
                      <th className="py-3 px-4 text-right">{t.history.receiptCol}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredPayments.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-medium text-white">
                            {new Date(item.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-xs text-white/40">
                            {new Date(item.created_at).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-yellow-400/90 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                              {item.transaction_id}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(item.transaction_id)}
                              className="text-white/40 hover:text-white transition-colors p-1 cursor-pointer"
                              title="Copy ID"
                            >
                              {copiedId === item.transaction_id ? (
                                <Check className="h-3.5 w-3.5 text-green-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                            <span className="font-mono text-xs text-white">{item.meter_number}</span>
                            {item.meter_name && (
                              <span className="text-[10px] text-white/50 bg-white/5 px-1.5 py-0.5 rounded">
                                {item.meter_name}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs text-white/80">
                            {getMethodIcon(item.payment_method)}
                            <span>{getMethodLabel(item.payment_method)}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <span className={`font-bold text-sm ${
                            item.payment_method === "Monthly Cycle Settlement" || Number(item.new_balance) < Number(item.previous_balance)
                              ? "text-amber-400"
                              : "text-green-400"
                          }`}>
                            {item.payment_method === "Monthly Cycle Settlement" || Number(item.new_balance) < Number(item.previous_balance) ? "- " : "+ "}
                            Rs. {Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-center text-xs">
                          <span className="text-white/40">
                            Rs. {Number(item.previous_balance).toFixed(2)}
                          </span>
                          <span className="text-white/30 mx-1.5">→</span>
                          <span className="font-medium text-white">
                            Rs. {Number(item.new_balance).toFixed(2)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/40 text-[11px] font-normal">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {item.status === "completed" || !item.status ? t.history.completed : item.status}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadPdf(item)}
                              title="Download Official PDF Receipt"
                              disabled={downloadingId === (item.id || item.transaction_id)}
                              className="h-8 w-8 p-0 text-white/70 hover:text-yellow-400 hover:bg-white/10 cursor-pointer rounded-lg"
                            >
                              {downloadingId === (item.id || item.transaction_id) ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />
                              ) : (
                                <FileText className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedReceipt(item)}
                              className="h-8 px-2.5 text-xs text-white/70 hover:text-white hover:bg-white/10 cursor-pointer rounded-lg"
                            >
                              {t.history.receiptCol}
                              <ArrowUpRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Receipt Modal Dialog */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#141416] border-t sm:border border-white/20 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 text-white shadow-2xl relative animate-in zoom-in-95 slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="sm:hidden pt-0 pb-2 flex justify-center">
              <div className="w-12 h-1 rounded-full bg-white/25" />
            </div>

            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute right-4 top-4 text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center pb-3 sm:pb-4 border-b border-white/10">
              <div className="flex justify-center mb-2">
                <img src="/leco-logo.png" alt="LECO Self Care" className="h-12 w-auto object-contain" />
              </div>
              <div className="inline-flex p-2 rounded-full bg-green-500/20 text-green-400 mb-1.5">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white">{t.history.receiptModalTitle}</h3>
              <p className="text-[11px] sm:text-xs text-white/50 mt-0.5">{t.history.officialReceipt} • LECO Self Care</p>
            </div>

            <div className="py-4 space-y-2.5 sm:space-y-3 text-xs sm:text-sm border-b border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-white/50">{t.history.transactionId}</span>
                <span className="font-mono text-xs font-semibold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                  {selectedReceipt.transaction_id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">{t.history.paymentDate}</span>
                <span className="text-white font-medium text-xs">
                  {new Date(selectedReceipt.created_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">{t.history.meterNumber}</span>
                <span className="font-mono text-xs text-white font-medium">
                  {selectedReceipt.meter_number} {selectedReceipt.meter_name && `(${selectedReceipt.meter_name})`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">{t.history.methodCol}</span>
                <span className="text-white text-xs font-medium capitalize flex items-center gap-1.5">
                  {getMethodIcon(selectedReceipt.payment_method)}
                  {getMethodLabel(selectedReceipt.payment_method)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">{t.history.statusCol}</span>
                <span className="text-green-400 font-semibold text-xs flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t.history.completed}
                </span>
              </div>
            </div>

            <div className="py-3.5 sm:py-4 space-y-2 text-xs sm:text-sm border-b border-white/10">
              <div className="flex justify-between text-xs text-white/60">
                <span>{t.history.previousBalance}</span>
                <span>Rs. {Number(selectedReceipt.previous_balance).toFixed(2)}</span>
              </div>
              <div className={`flex justify-between text-xs ${
                selectedReceipt.payment_method === "Monthly Cycle Settlement" || Number(selectedReceipt.new_balance) < Number(selectedReceipt.previous_balance)
                  ? "text-amber-400"
                  : "text-green-400"
              }`}>
                <span>{selectedReceipt.payment_method === "Monthly Cycle Settlement" ? t.overview.settleCycle : t.payments.totalToPay}</span>
                <span className="font-medium">
                  {selectedReceipt.payment_method === "Monthly Cycle Settlement" || Number(selectedReceipt.new_balance) < Number(selectedReceipt.previous_balance) ? "- " : "+ "}
                  Rs. {Number(selectedReceipt.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm sm:text-base font-bold pt-2 border-t border-white/10 items-baseline">
                <span>{t.history.newBalance}</span>
                <span className="text-yellow-400 text-lg sm:text-xl font-mono">
                  Rs. {Number(selectedReceipt.new_balance).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2.5 mt-5 sm:mt-6 pb-2 sm:pb-0">
              <Button
                variant="outline"
                onClick={() => setSelectedReceipt(null)}
                className="w-full sm:flex-1 bg-transparent border-white/20 text-white hover:bg-white/10 h-10 text-xs sm:text-sm cursor-pointer"
              >
                {t.history.closeBtn}
              </Button>
              <Button
                variant="outline"
                onClick={() => handlePrintReceipt(selectedReceipt)}
                className="w-full sm:flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10 font-medium h-10 text-xs sm:text-sm cursor-pointer"
              >
                {t.history.viewReceipt}
              </Button>
              <Button
                onClick={() => handleDownloadPdf(selectedReceipt)}
                disabled={downloadingId === (selectedReceipt.id || selectedReceipt.transaction_id)}
                className="w-full sm:flex-1 bg-yellow-400 text-black hover:bg-yellow-500 font-bold h-10 text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-400/20"
              >
                {downloadingId === (selectedReceipt.id || selectedReceipt.transaction_id) ? (
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                <span>Download PDF</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
