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
  X
} from "lucide-react"

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
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null)

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("token")
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch("http://localhost:3000/api/meters/payments/history", {
        credentials: "include",
        headers,
      })
      if (res.ok) {
        const data = await res.json()
        setPayments(data)
      }
    } catch (e) {
      console.error("Error fetching payments history:", e)
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
    const totalAmount = payments.reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
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
      default:
        return <CreditCard className="h-4 w-4 text-yellow-400" />
    }
  }

  const getMethodLabel = (method: string) => {
    switch (method?.toLowerCase()) {
      case "card":
        return "Card Payment"
      case "wallet":
        return "Mobile Wallet"
      case "bank":
        return "Bank Transfer"
      default:
        return method || "Card"
    }
  }

  if (loading && payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        <p className="text-white/60 text-sm">Loading payment history...</p>
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
            Payment History
          </h2>
          <p className="text-white/60 text-sm mt-1">
            Complete record of your meter recharges, transaction references, and balances.
          </p>
        </div>
        {onNavigateRecharge && (
          <Button
            onClick={onNavigateRecharge}
            className="bg-[#992511] hover:bg-[#992511]/80 text-white shadow-lg transition-transform hover:scale-105 font-medium flex items-center gap-2 self-start md:self-auto"
          >
            <Zap className="h-4 w-4 text-yellow-400" />
            Quick Recharge
          </Button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Recharged */}
        <Card className="bg-gradient-to-br from-[#992511] to-[#3a0b04] border-0 shadow-xl text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-white/70 text-xs uppercase tracking-wider font-semibold flex items-center justify-between">
              Total Recharged
              <TrendingUp className="h-4 w-4 text-yellow-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              Rs. {stats.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-white/60 mt-1">Across all linked smart meters</p>
          </CardContent>
        </Card>

        {/* Transactions Count */}
        <Card className="bg-[#0f0f11] border border-white/10 shadow-lg text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-white/60 text-xs uppercase tracking-wider font-semibold flex items-center justify-between">
              Successful Transactions
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.count}</div>
            <p className="text-xs text-white/50 mt-1">Lifetime recharge count</p>
          </CardContent>
        </Card>

        {/* Latest Top-up */}
        <Card className="bg-[#0f0f11] border border-white/10 shadow-lg text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-white/60 text-xs uppercase tracking-wider font-semibold flex items-center justify-between">
              Most Recent Recharge
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
              <div className="text-white/40 text-sm py-1">No recharges yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Payment History Table & Search */}
      <Card className="bg-[#0f0f11] border border-white/10 shadow-xl text-white">
        <CardHeader className="border-b border-white/5 pb-3 sm:pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg font-semibold text-white">Transaction Records</CardTitle>
              <CardDescription className="text-white/50 text-xs mt-0.5">
                Showing {filteredPayments.length} of {payments.length} transactions
              </CardDescription>
            </div>

            {/* Filter pills with mobile horizontal scroll */}
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 text-xs overflow-x-auto w-full sm:w-auto scrollbar-none">
              {["all", "card", "wallet", "bank"].map((m) => (
                <button
                  key={m}
                  onClick={() => setMethodFilter(m)}
                  className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all shrink-0 cursor-pointer ${
                    methodFilter === m
                      ? "bg-yellow-400 text-black shadow font-semibold"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {m === "all" ? "All" : m}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-3 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              type="text"
              placeholder="Search by Transaction ID or Meter Number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-black/30 border-white/10 text-white placeholder:text-white/40 pl-10 h-10 text-xs sm:text-sm focus-visible:ring-yellow-400 rounded-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="bg-white/5 p-5 rounded-full mb-3">
                <Receipt className="h-10 w-10 text-white/30" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white mb-1">
                {searchTerm || methodFilter !== "all" ? "No Matching Transactions" : "No Payment History Yet"}
              </h3>
              <p className="text-white/50 text-xs sm:text-sm max-w-sm mb-5">
                {searchTerm || methodFilter !== "all"
                  ? "Try changing your search keywords or clear your payment method filter."
                  : "When you top up your prepaid smart meter, your transaction receipts and balance logs will appear here."}
              </p>
              {onNavigateRecharge && (
                <Button
                  onClick={onNavigateRecharge}
                  className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg text-xs sm:text-sm h-10 cursor-pointer"
                >
                  Make Your First Recharge
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE VIEW: Sleek Native Card Feed (visible on < md) */}
              <div className="block md:hidden divide-y divide-white/5">
                {filteredPayments.map((item) => (
                  <div key={item.id} className="p-3.5 space-y-2.5 hover:bg-white/[0.02] transition-colors">
                    {/* Top Row: Date & Status */}
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
                        {item.status || "Completed"}
                      </Badge>
                    </div>

                    {/* Middle Row: Transaction ID & Amount */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                          {item.transaction_id}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.transaction_id)}
                          className="text-white/40 hover:text-white p-1 cursor-pointer"
                          title="Copy Transaction ID"
                        >
                          {copiedId === item.transaction_id ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="font-bold text-base text-green-400">
                        + Rs. {Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Bottom Row: Meter + Method + View Receipt Action */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs text-white/70">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-yellow-400 shrink-0" />
                          <span className="font-mono text-[11px] text-white">{item.meter_number}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-white/50">
                          {getMethodIcon(item.payment_method)}
                          <span className="capitalize">{item.payment_method}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedReceipt(item)}
                        className="h-7 px-2 text-xs text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 cursor-pointer"
                      >
                        Receipt
                        <ArrowUpRight className="h-3 w-3 ml-0.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP VIEW: Full Data Table (visible on >= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/40 text-white/50 text-xs uppercase tracking-wider border-b border-white/5">
                    <tr>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Transaction ID</th>
                      <th className="py-3 px-4">Meter</th>
                      <th className="py-3 px-4">Payment Method</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Balance Impact</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredPayments.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        {/* Date */}
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

                        {/* Transaction ID */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-yellow-400/90 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                              {item.transaction_id}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(item.transaction_id)}
                              className="text-white/40 hover:text-white transition-colors p-1 cursor-pointer"
                              title="Copy Transaction ID"
                            >
                              {copiedId === item.transaction_id ? (
                                <Check className="h-3.5 w-3.5 text-green-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Meter */}
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

                        {/* Payment Method */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs text-white/80">
                            {getMethodIcon(item.payment_method)}
                            <span>{getMethodLabel(item.payment_method)}</span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <span className="font-bold text-green-400 text-sm">
                            + Rs. {Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Balance Impact */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center text-xs">
                          <span className="text-white/40">
                            Rs. {Number(item.previous_balance).toFixed(2)}
                          </span>
                          <span className="text-white/30 mx-1.5">→</span>
                          <span className="font-medium text-white">
                            Rs. {Number(item.new_balance).toFixed(2)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/40 text-[11px] font-normal">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {item.status || "Success"}
                          </Badge>
                        </td>

                        {/* Receipt Action */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedReceipt(item)}
                            className="h-8 px-2.5 text-xs text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
                          >
                            Receipt
                            <ArrowUpRight className="h-3 w-3 ml-1" />
                          </Button>
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

      {/* Receipt Modal Dialog: Bottom Sheet on Mobile, Centered Modal on Desktop */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#141416] border-t sm:border border-white/20 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 text-white shadow-2xl relative animate-in zoom-in-95 slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-200 max-h-[92vh] overflow-y-auto">
            {/* Mobile handle */}
            <div className="sm:hidden pt-0 pb-2 flex justify-center">
              <div className="w-12 h-1 rounded-full bg-white/25" />
            </div>

            {/* Close button */}
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute right-4 top-4 text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Receipt Header */}
            <div className="text-center pb-3 sm:pb-4 border-b border-white/10">
              <div className="inline-flex p-2.5 sm:p-3 rounded-full bg-green-500/20 text-green-400 mb-2">
                <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white">Prepaid Recharge Receipt</h3>
              <p className="text-[11px] sm:text-xs text-white/50 mt-0.5">E-Meter Smart Grid Energy Portal</p>
            </div>

            {/* Receipt Details */}
            <div className="py-4 space-y-2.5 sm:space-y-3 text-xs sm:text-sm border-b border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-white/50">Transaction ID</span>
                <span className="font-mono text-xs font-semibold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                  {selectedReceipt.transaction_id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Date & Time</span>
                <span className="text-white font-medium text-xs">
                  {new Date(selectedReceipt.created_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Smart Meter</span>
                <span className="font-mono text-xs text-white font-medium">
                  {selectedReceipt.meter_number} {selectedReceipt.meter_name && `(${selectedReceipt.meter_name})`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Payment Method</span>
                <span className="text-white text-xs font-medium capitalize flex items-center gap-1.5">
                  {getMethodIcon(selectedReceipt.payment_method)}
                  {getMethodLabel(selectedReceipt.payment_method)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Status</span>
                <span className="text-green-400 font-semibold text-xs flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completed / Success
                </span>
              </div>
            </div>

            {/* Financial Details */}
            <div className="py-3.5 sm:py-4 space-y-2 text-xs sm:text-sm border-b border-white/10">
              <div className="flex justify-between text-xs text-white/60">
                <span>Previous Balance</span>
                <span>Rs. {Number(selectedReceipt.previous_balance).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-green-400">
                <span>Credit Added</span>
                <span className="font-medium">+ Rs. {Number(selectedReceipt.amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm sm:text-base font-bold pt-2 border-t border-white/10 items-baseline">
                <span>New Balance</span>
                <span className="text-yellow-400 text-lg sm:text-xl font-mono">
                  Rs. {Number(selectedReceipt.new_balance).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 mt-5 sm:mt-6 pb-2 sm:pb-0">
              <Button
                variant="outline"
                onClick={() => setSelectedReceipt(null)}
                className="w-full sm:flex-1 bg-transparent border-white/20 text-white hover:bg-white/10 h-10 text-xs sm:text-sm cursor-pointer"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  window.print()
                }}
                className="w-full sm:flex-1 bg-yellow-400 text-black hover:bg-yellow-500 font-bold h-10 text-xs sm:text-sm cursor-pointer"
              >
                Print Receipt
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
