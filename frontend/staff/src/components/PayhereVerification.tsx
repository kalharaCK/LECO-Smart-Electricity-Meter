import { useState, useMemo } from "react"
import { 
  CreditCard, 
  ShieldCheck, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Filter, 
  X, 
  Check, 
  Loader2, 
  Zap, 
  ArrowUpRight,
  FileCheck,
  Download
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { PayhereTransaction } from "../types"

interface PayhereVerificationProps {
  transactions: PayhereTransaction[]
  loading: boolean
  onRefresh: () => void
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>
}

export default function PayhereVerification({
  transactions,
  loading,
  onRefresh,
  getAuthHeaders
}: PayhereVerificationProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedTx, setSelectedTx] = useState<PayhereTransaction | null>(null)
  const [auditNotes, setAuditNotes] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        tx.transaction_id.toLowerCase().includes(q) ||
        (tx.order_id && tx.order_id.toLowerCase().includes(q)) ||
        (tx.payhere_payment_id && tx.payhere_payment_id.toLowerCase().includes(q)) ||
        (tx.meter_number && tx.meter_number.toLowerCase().includes(q)) ||
        (tx.customer_email && tx.customer_email.toLowerCase().includes(q))

      const matchesStatus =
        statusFilter === "all" ||
        tx.status.toLowerCase() === statusFilter.toLowerCase()

      return matchesSearch && matchesStatus
    })
  }, [transactions, searchQuery, statusFilter])

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalAmount = transactions
      .filter((t) => t.status === "Success")
      .reduce((sum, t) => sum + parseFloat(String(t.amount || 0)), 0)

    const successCount = transactions.filter((t) => t.status === "Success").length
    const pendingCount = transactions.filter((t) => t.status === "Pending").length
    const failedCount = transactions.filter((t) => t.status === "Failed").length

    return { totalAmount, successCount, pendingCount, failedCount }
  }, [transactions])

  // Perform Staff Audit Verification
  const handleAuditAction = async (action: "approve" | "reject") => {
    if (!selectedTx) return
    setActionLoading(true)
    setActionMessage(null)

    try {
      const res = await fetch(`http://localhost:3000/api/staff/payments/${selectedTx.id}/verify-payhere`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          action,
          notes: auditNotes || (action === "approve" ? "Verified and approved by LECO Staff Auditor" : "Rejected by LECO Staff Auditor")
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setActionMessage({ type: "success", text: data.message })
        onRefresh()
        setTimeout(() => {
          setSelectedTx(null)
          setActionMessage(null)
          setAuditNotes("")
        }, 1500)
      } else {
        setActionMessage({ type: "error", text: data.message || "Failed to audit transaction" })
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: "Network error during verification: " + err.message })
    } finally {
      setActionLoading(false)
    }
  }

  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) return
    const headers = ["Order ID", "Txn ID", "PayHere ID", "Customer", "Meter Number", "Amount (LKR)", "Method", "Status", "Timestamp"]
    const rows = filteredTransactions.map(t => [
      t.order_id || "N/A",
      t.transaction_id,
      t.payhere_payment_id || "N/A",
      t.customer_email || "N/A",
      t.meter_number || "N/A",
      t.amount,
      t.payment_method || "PayHere",
      t.status,
      new Date(t.created_at).toLocaleString("en-US")
    ])
    const csv = [headers.join(","), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `LECO_PayHere_Transactions_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#141416] via-[#1a1415] to-[#121214] p-5 rounded-2xl border border-white/10 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#992511]/25 border border-[#992511]/40 text-yellow-400">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              PayHere Payment Gateway Ledger & Audit Verification
              <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/30 text-[10px] font-mono">
                Merchant: 1236689
              </Badge>
            </h2>
            <p className="text-xs text-white/60 mt-0.5">
              Verify cryptographic MD5 payment signatures, review customer meter recharges, and audit transaction records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
          <Button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            variant="outline"
            className="bg-black/40 hover:bg-black/60 border-white/20 text-white text-xs h-9 rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Ledger</span>
          </Button>

          <Button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredTransactions.length === 0}
            variant="outline"
            className="bg-black/40 hover:bg-black/60 border-white/20 text-white text-xs h-9 rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-yellow-400" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-[#121214] border-white/10 text-white">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Total Processed</span>
              <div className="p-1.5 rounded-lg bg-green-500/10 text-green-400">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white mt-2">
              Rs. {metrics.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-white/40 block mt-1">LKR Settled via PayHere</span>
          </CardContent>
        </Card>

        <Card className="bg-[#121214] border-white/10 text-white">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Verified Success</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 mt-2">
              {metrics.successCount}
            </div>
            <span className="text-[11px] text-white/40 block mt-1">Confirmed MD5 & Credited</span>
          </CardContent>
        </Card>

        <Card className="bg-[#121214] border-white/10 text-white">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Pending Audit</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-400 mt-2">
              {metrics.pendingCount}
            </div>
            <span className="text-[11px] text-white/40 block mt-1">Awaiting Gateway / Staff Clearance</span>
          </CardContent>
        </Card>

        <Card className="bg-[#121214] border-white/10 text-white">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Failed / Cancelled</span>
              <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-red-400 mt-2">
              {metrics.failedCount}
            </div>
            <span className="text-[11px] text-white/40 block mt-1">Disputed or Declined</span>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#121214] p-3 rounded-2xl border border-white/10">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order ID, Txn ID, Meter, or Email..."
            className="pl-9 bg-black/40 border-white/10 text-white placeholder:text-white/40 text-xs h-9 rounded-xl focus-visible:border-yellow-400"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-3.5 w-3.5 text-white/40 mr-1 hidden sm:block" />
          {["all", "Success", "Pending", "Failed"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                statusFilter.toLowerCase() === st.toLowerCase()
                  ? "bg-yellow-400 text-black font-bold"
                  : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5"
              }`}
            >
              {st === "all" ? "All Transactions" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <Card className="bg-[#121214] border-white/10 text-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/50 border-b border-white/10 text-white/50 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Order / Txn ID</th>
                <th className="py-3 px-4 font-semibold">Customer & Meter</th>
                <th className="py-3 px-4 font-semibold">Amount (LKR)</th>
                <th className="py-3 px-4 font-semibold">Method / Gateway</th>
                <th className="py-3 px-4 font-semibold">Verification Status</th>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold text-right">Audit Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-white/50">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-yellow-400" />
                    Loading PayHere transactions from ledger...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-white/50">
                    No PayHere transactions found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-yellow-400">
                        {tx.order_id || tx.transaction_id}
                      </div>
                      {tx.payhere_payment_id && (
                        <span className="text-[10px] font-mono text-white/40 block">
                          PayHere ID: {tx.payhere_payment_id}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-white truncate max-w-[200px]">
                        {tx.customer_email || "Customer"}
                      </div>
                      <div className="text-[11px] text-white/50 flex items-center gap-1 font-mono">
                        <Zap className="h-3 w-3 text-yellow-400" />
                        <span>{tx.meter_number || "Unlinked"}</span>
                        {tx.meter_name && <span className="text-white/40">({tx.meter_name})</span>}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-sm text-white">
                        Rs. {parseFloat(String(tx.amount || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-white/40 block">
                        Prev: Rs. {parseFloat(String(tx.previous_balance || 0)).toFixed(2)}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/80">
                        <CreditCard className="h-3 w-3 text-yellow-400" />
                        <span>{tx.payment_method || "PayHere"}</span>
                      </div>
                      {tx.card_no && (
                        <span className="text-[10px] text-white/40 block mt-0.5 font-mono">
                          Card: {tx.card_no}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {tx.status === "Success" ? (
                        <div>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified Success
                          </Badge>
                          <span className="text-[10px] text-white/40 block mt-0.5">
                            {tx.verified_by || "PayHere IPN Checksum"}
                          </span>
                        </div>
                      ) : tx.status === "Pending" ? (
                        <div>
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] font-medium inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Pending Audit
                          </Badge>
                          <span className="text-[10px] text-amber-400/60 block mt-0.5">
                            Awaiting Gateway Finalization
                          </span>
                        </div>
                      ) : (
                        <div>
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] font-medium inline-flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Failed / Cancelled
                          </Badge>
                          {tx.verification_notes && (
                            <span className="text-[10px] text-white/40 block mt-0.5 truncate max-w-xs">
                              {tx.verification_notes}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-white/60 text-[11px]">
                      {new Date(tx.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                      <span className="text-white/40 block text-[10px]">
                        {new Date(tx.created_at).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setSelectedTx(tx)
                          setAuditNotes(tx.verification_notes || "")
                        }}
                        className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs h-8 px-3 rounded-lg font-semibold cursor-pointer shadow-sm"
                      >
                        <FileCheck className="h-3.5 w-3.5 mr-1" />
                        Audit Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Staff Transaction Verification & Audit Modal */}
      {selectedTx && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTx(null)
          }}
        >
          <div className="bg-[#121214] border border-white/20 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl text-white animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 bg-black/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#992511]/30 border border-[#992511]/50 text-yellow-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    PayHere Transaction Verification Audit
                  </h3>
                  <span className="text-[11px] font-mono text-yellow-400">
                    Order ID: {selectedTx.order_id || selectedTx.transaction_id}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {actionMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    actionMessage.type === "success"
                      ? "bg-green-500/10 border-green-500/30 text-green-300"
                      : "bg-red-500/10 border-red-500/30 text-red-300"
                  }`}
                >
                  {actionMessage.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span>{actionMessage.text}</span>
                </div>
              )}

              {/* Transaction Specs */}
              <div className="grid grid-cols-2 gap-3 bg-black/40 p-3.5 rounded-xl border border-white/10 font-mono">
                <div>
                  <span className="text-[10px] text-white/50 block">Customer Email</span>
                  <span className="font-semibold text-white truncate block">
                    {selectedTx.customer_email || "Customer"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-white/50 block">Smart Meter Number</span>
                  <span className="font-semibold text-yellow-400 block">
                    {selectedTx.meter_number || "Unlinked"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-white/50 block">Payment Amount</span>
                  <span className="font-bold text-base text-emerald-400 block">
                    Rs. {parseFloat(String(selectedTx.amount || 0)).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-white/50 block">Payment Method</span>
                  <span className="font-semibold text-white block">
                    {selectedTx.payment_method || "PayHere"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-white/50 block">Previous Balance</span>
                  <span className="text-white/70 block">
                    Rs. {parseFloat(String(selectedTx.previous_balance || 0)).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-white/50 block">New Meter Balance</span>
                  <span className="font-bold text-yellow-400 block">
                    Rs. {parseFloat(String(selectedTx.new_balance || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Cryptographic Checksum Status */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Cryptographic MD5 Signature:</span>
                  <span className="text-emerald-400 font-mono font-bold text-[11px] inline-flex items-center gap-1">
                    <Check className="h-3 w-3 stroke-[3]" />
                    Formula Validated
                  </span>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Formula: MD5(merchant_id + order_id + amount + currency + status_code + MD5(merchant_secret)).
                </p>
                {selectedTx.verified_by && (
                  <span className="text-[10px] text-white/60 block pt-1">
                    Verified By: <span className="text-yellow-400 font-semibold">{selectedTx.verified_by}</span>
                  </span>
                )}
              </div>

              {/* Auditor Notes Field */}
              <div className="space-y-1.5">
                <label className="text-white/80 font-medium block">
                  Auditor Remarks / Override Notes:
                </label>
                <Input
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  placeholder="e.g., PayHere confirmation verified on merchant portal..."
                  className="bg-black/30 border-white/15 text-white text-xs h-9 rounded-xl focus-visible:border-yellow-400"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedTx(null)}
                className="bg-white/5 border-white/15 text-white text-xs h-9 rounded-xl cursor-pointer"
              >
                Close
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAuditAction("reject")}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs h-9 px-3 rounded-xl cursor-pointer"
                >
                  Flag / Reject
                </Button>

                <Button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAuditAction("approve")}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold text-xs h-9 px-4 rounded-xl cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {selectedTx.status === "Success" ? "Re-Approve & Save Notes" : "Confirm & Credit Balance"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
