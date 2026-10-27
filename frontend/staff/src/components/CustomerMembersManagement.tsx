import { useState, useEffect, useCallback } from "react"
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Phone,
  CreditCard,
  Cpu,
  ShieldCheck,
  Lock,
  X,
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  Check
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { API_BASE_URL } from "@/lib/api"
import StaffPasswordConfirmModal from "./StaffPasswordConfirmModal"

interface LinkedMeter {
  id: number
  meter_number: string
  account_number: string
  balance: string | number
  status: string
  name: string
}

interface CustomerMember {
  id: number
  email: string
  full_name: string
  mobile_number: string
  nic: string
  address: string
  email_verified: boolean
  role: string
  created_at: string
  meter_count: number
  total_balance: number | string
  meters: LinkedMeter[]
}

interface CustomerMembersManagementProps {
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>
}

export default function CustomerMembersManagement({ getAuthHeaders }: CustomerMembersManagementProps) {
  const [customers, setCustomers] = useState<CustomerMember[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterMeterStatus, setFilterMeterStatus] = useState<"all" | "with_meters" | "no_meters">("all")
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerMember | null>(null)

  // Add Customer Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Form Fields
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [mobileNumber, setMobileNumber] = useState("")
  const [nic, setNic] = useState("")
  const [address, setAddress] = useState("")
  const [password, setPassword] = useState("LecoCustomer@2026")
  const [showPassword, setShowPassword] = useState(false)

  // Smart Meter Assignment Toggle
  const [assignMeter, setAssignMeter] = useState(true)
  const [meterNumber, setMeterNumber] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [initialBalance, setInitialBalance] = useState("500.00")
  const [meterPin, setMeterPin] = useState("1234")

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4500)
  }

  // Customer Password Reset State
  const [resetPasswordCustomer, setResetPasswordCustomer] = useState<CustomerMember | null>(null)
  const [newCustomerPassword, setNewCustomerPassword] = useState("")
  const [confirmCustomerPassword, setConfirmCustomerPassword] = useState("")
  const [resetPasswordStaffAuth, setResetPasswordStaffAuth] = useState("")
  const [resetPasswordReason, setResetPasswordReason] = useState("Customer requested in-person password reset at LECO branch office")
  const [showNewPassword, setShowNewPassword] = useState(true)
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false)
  const [completedResetResult, setCompletedResetResult] = useState<{ email: string; tempPass: string } | null>(null)
  const [tempPassCopied, setTempPassCopied] = useState(false)

  const generateStrongPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*"
    let pass = ""
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewCustomerPassword(pass)
    setConfirmCustomerPassword(pass)
  }

  const handleOpenResetModal = (customer: CustomerMember) => {
    setResetPasswordCustomer(customer)
    generateStrongPassword()
    setResetPasswordStaffAuth("")
    setResetPasswordReason("Customer requested in-person password reset at LECO branch office")
    setShowNewPassword(true)
    setCompletedResetResult(null)
    setTempPassCopied(false)
  }

  const handleExecutePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPasswordCustomer) return

    if (!newCustomerPassword || newCustomerPassword.length < 8) {
      showToast("New customer password must be at least 8 characters long.", "error")
      return
    }
    if (newCustomerPassword !== confirmCustomerPassword) {
      showToast("Password confirmation does not match.", "error")
      return
    }
    if (!resetPasswordStaffAuth) {
      showToast("Staff authorization password is required to reset customer password.", "error")
      return
    }

    setResetPasswordLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/customers/${resetPasswordCustomer.id}/reset-password`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          staffPassword: resetPasswordStaffAuth,
          newPassword: newCustomerPassword,
          reason: resetPasswordReason.trim()
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(data.message || `Password reset successfully for ${resetPasswordCustomer.email}.`, "success")
        setCompletedResetResult({
          email: resetPasswordCustomer.email,
          tempPass: newCustomerPassword
        })
      } else {
        showToast(data.message || "Failed to reset customer password.", "error")
      }
    } catch (err) {
      console.error("Reset password error:", err)
      showToast("Network error resetting password.", "error")
    } finally {
      setResetPasswordLoading(false)
    }
  }

  const handleCopyTempPassword = (text: string) => {
    navigator.clipboard.writeText(text)
    setTempPassCopied(true)
    setTimeout(() => setTempPassCopied(false), 2500)
  }

  // Fetch Customers
  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/customers`, {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (res.ok) {
        const data = await res.json()
        if (data.customers && Array.isArray(data.customers)) {
          setCustomers(data.customers)
        }
      }
    } catch (err) {
      console.error("Error fetching customers:", err)
      showToast("Network error fetching customer directory", "error")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  // Open password confirmation before submitting customer
  const handleInitiateAddCustomer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || !mobileNumber.trim() || !nic.trim() || !password) {
      showToast("Please fill in all mandatory customer fields", "error")
      return
    }
    if (assignMeter && !meterNumber.trim()) {
      showToast("Please specify a smart meter number or uncheck meter assignment", "error")
      return
    }
    setIsPasswordModalOpen(true)
  }

  // Execute customer creation upon password verification
  const handleConfirmedAddCustomer = async () => {
    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        mobile_number: mobileNumber.trim(),
        nic: nic.trim(),
        address: address.trim()
      }

      if (assignMeter && meterNumber.trim()) {
        payload.meter_number = meterNumber.trim()
        payload.account_number = accountNumber.trim() || `ACC-${Math.floor(10000000 + Math.random() * 90000000)}`
        payload.initial_balance = parseFloat(initialBalance) || 0
        payload.meter_pin = meterPin.trim() || "1234"
      }

      const res = await fetch(`${API_BASE_URL}/api/staff/customers`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(`Customer ${fullName} created successfully`, "success")
        setIsAddModalOpen(false)
        resetForm()
        fetchCustomers()
      } else {
        showToast(data.message || "Failed to create customer member", "error")
      }
    } catch (err) {
      console.error("Error creating customer:", err)
      showToast("Network error creating customer member", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFullName("")
    setEmail("")
    setMobileNumber("")
    setNic("")
    setAddress("")
    setPassword("LecoCustomer@2026")
    setAssignMeter(true)
    setMeterNumber("")
    setAccountNumber("")
    setInitialBalance("500.00")
    setMeterPin("1234")
  }

  // Pre-generate unique demo meter number
  const handleOpenAddModal = () => {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000)
    setMeterNumber(`MTR-${randomSuffix}`)
    setAccountNumber(`ACC-01${randomSuffix}`)
    setIsAddModalOpen(true)
  }

  // Metrics
  const totalCustomers = customers.length
  const verifiedAccounts = customers.filter((c) => c.email_verified).length
  const customersWithMeters = customers.filter((c) => c.meter_count > 0).length
  const totalFleetBalance = customers.reduce(
    (acc, c) => acc + (parseFloat(String(c.total_balance)) || 0),
    0
  )

  // Filter & Search
  const filteredCustomers = customers.filter((c) => {
    const q = searchTerm.toLowerCase().trim()
    const matchSearch =
      !q ||
      c.full_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.mobile_number?.toLowerCase().includes(q) ||
      c.nic?.toLowerCase().includes(q) ||
      c.meters?.some((m) => m.meter_number.toLowerCase().includes(q) || m.account_number.toLowerCase().includes(q))

    if (!matchSearch) return false

    if (filterMeterStatus === "with_meters") return c.meter_count > 0
    if (filterMeterStatus === "no_meters") return c.meter_count === 0

    return true
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs font-medium">
            <span>Total Customers</span>
            <Users className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-white">{totalCustomers}</span>
            <span className="text-[11px] text-white/60 block font-medium">Registered Accounts</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Verified Status</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-400">{verifiedAccounts}</span>
            <span className="text-[11px] text-emerald-500/70 block">Email & OTP Verified</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Meters Assigned</span>
            <Cpu className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-blue-400">{customersWithMeters}</span>
            <span className="text-[11px] text-blue-400/70 block">With Smart Hardware</span>
          </div>
        </div>

        <div className="bg-[#0f0f11] border border-white/5 shadow-xl rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Prepaid Balance</span>
            <CreditCard className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-white">Rs. {totalFleetBalance.toFixed(2)}</span>
            <span className="text-[11px] text-amber-400/70 block">Total Customer Credit</span>
          </div>
        </div>
      </div>

      {/* Main Operations Card */}
      <Card className="bg-[#0f0f11] border-white/5 shadow-2xl">
        <CardContent className="p-6">
          {/* Header & Controls Strip */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/5">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-yellow-400" />
                Customer Members Directory
              </h2>
              <p className="text-xs text-white/50 mt-0.5">
                Register new customer accounts, link smart electricity meters, inspect member credentials and balances.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchCustomers}
                disabled={loading}
                className="h-9 text-xs border-white/10 hover:bg-white/5 text-white/70 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleOpenAddModal}
                className="h-9 text-xs bg-yellow-400 hover:bg-yellow-500 text-black font-bold shadow-lg shadow-yellow-400/20 cursor-pointer flex items-center gap-1.5"
              >
                <UserPlus className="h-4 w-4" />
                Add Customer Member
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 my-5">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by full name, email, mobile (07X...), NIC, or meter number..."
                className="bg-[#141416] border-white/10 pl-10 text-xs h-10 text-white placeholder:text-white/30 focus-visible:ring-yellow-400/30 w-full"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#141416] p-1 rounded-xl border border-white/5 self-stretch sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setFilterMeterStatus("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  filterMeterStatus === "all" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                All ({customers.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMeterStatus("with_meters")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  filterMeterStatus === "with_meters" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                With Meters ({customersWithMeters})
              </button>
              <button
                type="button"
                onClick={() => setFilterMeterStatus("no_meters")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  filterMeterStatus === "no_meters" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                Unassigned ({customers.length - customersWithMeters})
              </button>
            </div>
          </div>

          {/* Customer Table */}
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#141416] text-[11px] font-bold text-white/50 uppercase tracking-wider border-b border-white/5">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact & NIC</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4">Assigned Meters</th>
                  <th className="py-3 px-4">Total Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-white/80">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-white/40">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                          <span>Loading customer directory...</span>
                        </div>
                      ) : (
                        "No customer members match your search criteria."
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{c.full_name || "LECO Consumer"}</div>
                        <div className="text-[11px] text-white/40 font-mono mt-0.5">{c.email}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5 text-white/90">
                          <Phone className="h-3 w-3 text-yellow-400/80" />
                          {c.mobile_number || "-"}
                        </div>
                        <div className="text-white/40 mt-0.5">NIC: {c.nic || "-"}</div>
                      </td>

                      <td className="py-3.5 px-4 text-white/60 max-w-[180px] truncate">
                        {c.address || "Sri Lanka"}
                      </td>

                      <td className="py-3.5 px-4">
                        {c.meters && c.meters.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.meters.map((m) => (
                              <Badge
                                key={m.id}
                                variant="outline"
                                className="bg-[#141416] border-white/10 text-yellow-300 font-mono text-[10px] py-0.5 px-2"
                              >
                                {m.meter_number}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-white/30 italic">No meter linked</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-white font-mono">
                        Rs. {(parseFloat(String(c.total_balance)) || 0).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4">
                        {c.email_verified ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"
                          >
                            Verified
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]"
                          >
                            Unverified
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            title="Reset Customer Password"
                            onClick={() => handleOpenResetModal(c)}
                            className="h-7 text-[11px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/20 flex items-center gap-1 cursor-pointer"
                          >
                            <KeyRound className="h-3 w-3" />
                            Reset Password
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCustomer(c)}
                            className="h-7 text-[11px] border-white/10 hover:bg-white/5 text-white/80 cursor-pointer"
                          >
                            View Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl p-6 text-white relative">
            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 flex items-center justify-center font-bold">
                {selectedCustomer.full_name?.charAt(0) || "C"}
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{selectedCustomer.full_name}</h3>
                <p className="text-[11px] text-white/50">{selectedCustomer.email}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#141416] p-4 rounded-xl border border-white/5">
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-bold">Mobile Number</span>
                  <span className="font-semibold text-white mt-0.5 block">{selectedCustomer.mobile_number || "None"}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-bold">NIC Number</span>
                  <span className="font-semibold text-white mt-0.5 block">{selectedCustomer.nic || "None"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-white/40 block text-[10px] uppercase font-bold">Address</span>
                  <span className="font-semibold text-white mt-0.5 block">{selectedCustomer.address || "Sri Lanka"}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-bold">Member Since</span>
                  <span className="font-semibold text-white mt-0.5 block">
                    {new Date(selectedCustomer.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-bold">Account Verification</span>
                  <span className="font-semibold text-emerald-400 mt-0.5 block">
                    {selectedCustomer.email_verified ? "Verified" : "Pending OTP"}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-yellow-400" />
                  Assigned Smart Meters ({selectedCustomer.meters?.length || 0})
                </h4>
                {selectedCustomer.meters && selectedCustomer.meters.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomer.meters.map((m) => (
                      <div
                        key={m.id}
                        className="bg-[#141416] p-3 rounded-xl border border-white/5 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-white font-mono">{m.meter_number}</div>
                          <div className="text-[10px] text-white/40 font-mono">Account: {m.account_number}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-yellow-400 font-mono">
                            Rs. {(parseFloat(String(m.balance)) || 0).toFixed(2)}
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 ${
                              m.status === "Connected"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                            }`}
                          >
                            {m.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/40 italic bg-[#141416] p-3 rounded-xl border border-white/5">
                    No physical smart meters linked to this account yet.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const cust = selectedCustomer
                  setSelectedCustomer(null)
                  handleOpenResetModal(cust)
                }}
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs h-9 px-4 flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Reset Account Password
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
                className="border-white/10 text-white/70 hover:bg-white/5 text-xs h-9 px-5 cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto relative">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 flex items-center justify-center">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Register New Customer Member</h3>
                <p className="text-[11px] text-white/50">
                  Create customer credentials, profile details, and optionally onboard a smart meter
                </p>
              </div>
            </div>

            <form onSubmit={handleInitiateAddCustomer} className="space-y-5">
              {/* Profile Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Customer Profile Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/80">Full Name *</label>
                    <Input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Kasun Jayawardena"
                      className="bg-[#141416] border-white/10 text-xs h-10 text-white placeholder:text-white/30 focus-visible:ring-yellow-400/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/80">Email Address *</label>
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. kasun@gmail.com"
                      className="bg-[#141416] border-white/10 text-xs h-10 text-white placeholder:text-white/30 focus-visible:ring-yellow-400/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/80">Mobile Number (SMS alerts) *</label>
                    <Input
                      type="text"
                      required
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="e.g. 0771234567"
                      className="bg-[#141416] border-white/10 text-xs h-10 text-white placeholder:text-white/30 focus-visible:ring-yellow-400/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/80">NIC Number *</label>
                    <Input
                      type="text"
                      required
                      value={nic}
                      onChange={(e) => setNic(e.target.value)}
                      placeholder="e.g. 199012345678 or 901234567V"
                      className="bg-[#141416] border-white/10 text-xs h-10 text-white placeholder:text-white/30 focus-visible:ring-yellow-400/30"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-white/80">Residential Address</label>
                    <Input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. No. 45, Temple Road, Colombo 03"
                      className="bg-[#141416] border-white/10 text-xs h-10 text-white placeholder:text-white/30 focus-visible:ring-yellow-400/30"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-white/80">Initial Password *</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="bg-[#141416] border-white/10 text-xs h-10 pr-10 text-white font-mono placeholder:text-white/30 focus-visible:ring-yellow-400/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Optional Meter Link Section */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                      Initial Smart Meter Assignment
                    </h4>
                    <p className="text-[11px] text-white/50">
                      Provision a smart meter directly onto this customer's account during registration
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="assignMeterCheck"
                    checked={assignMeter}
                    onChange={(e) => setAssignMeter(e.target.checked)}
                    className="h-4 w-4 rounded accent-yellow-400 cursor-pointer"
                  />
                </div>

                {assignMeter && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#141416] p-4 rounded-xl border border-white/5 animate-in fade-in duration-150">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white/80">Meter Serial Number *</label>
                      <Input
                        type="text"
                        required={assignMeter}
                        value={meterNumber}
                        onChange={(e) => setMeterNumber(e.target.value)}
                        placeholder="e.g. MTR-748291"
                        className="bg-[#09090b] border-white/10 text-xs h-10 font-mono text-white placeholder:text-white/30 focus-visible:ring-yellow-400/30"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white/80">Account Number</label>
                      <Input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="e.g. ACC-01748291"
                        className="bg-[#09090b] border-white/10 text-xs h-10 font-mono text-white placeholder:text-white/30 focus-visible:ring-yellow-400/30"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white/80">Initial Balance (LKR)</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={initialBalance}
                        onChange={(e) => setInitialBalance(e.target.value)}
                        placeholder="500.00"
                        className="bg-[#09090b] border-white/10 text-xs h-10 font-mono text-white placeholder:text-white/30 focus-visible:ring-yellow-400/30"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white/80">Default Meter PIN</label>
                      <Input
                        type="text"
                        maxLength={6}
                        value={meterPin}
                        onChange={(e) => setMeterPin(e.target.value)}
                        placeholder="1234"
                        className="bg-[#09090b] border-white/10 text-xs h-10 font-mono text-white placeholder:text-white/30 focus-visible:ring-yellow-400/30"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={submitting}
                  className="border-white/10 text-white/70 hover:bg-white/5 text-xs h-9 px-4 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="text-xs h-9 px-5 bg-yellow-400 hover:bg-yellow-500 text-black font-bold shadow-lg shadow-yellow-400/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Continue with Security Authorization
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Customer Password Modal */}
      {resetPasswordCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl p-6 text-white relative max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setResetPasswordCustomer(null)
                setCompletedResetResult(null)
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {completedResetResult ? (
              /* Success Result View */
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Password Reset Completed</h3>
                    <p className="text-[11px] text-white/50">{completedResetResult.email}</p>
                  </div>
                </div>

                <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-2">
                  <span className="text-[11px] text-white/50 block font-medium">New Account Password:</span>
                  <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3 flex items-center justify-between">
                    <span className="font-mono text-lg font-bold text-yellow-300">
                      {completedResetResult.tempPass}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyTempPassword(completedResetResult.tempPass)}
                      className="bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border-yellow-400/40 text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      {tempPassCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {tempPassCopied ? "Copied" : "Copy Password"}
                    </Button>
                  </div>
                </div>

                <div className="text-[11px] text-white/60 bg-white/5 p-3 rounded-xl border border-white/5">
                  Securely provide this password to the customer. They can now log in using their email and this password, and update it under account settings.
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={() => {
                      setResetPasswordCustomer(null)
                      setCompletedResetResult(null)
                    }}
                    className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-xs h-9 px-5 rounded-xl cursor-pointer"
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              /* Reset Password Form */
              <form onSubmit={handleExecutePasswordReset} className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Reset Customer Password</h3>
                    <p className="text-[11px] text-white/50">Staff Administrative Credential Reset</p>
                  </div>
                </div>

                {/* Target Customer Identity Badge */}
                <div className="bg-black/50 border border-white/10 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Customer Name:</span>
                    <span className="font-semibold text-white">{resetPasswordCustomer.full_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Account Email:</span>
                    <span className="font-mono text-white/90">{resetPasswordCustomer.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Verified NIC:</span>
                    <span className="font-mono text-yellow-300 font-bold bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                      {resetPasswordCustomer.nic || "Not Linked"}
                    </span>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <label className="text-white/70 font-medium">New Customer Password *</label>
                    <button
                      type="button"
                      onClick={generateStrongPassword}
                      className="text-[10px] text-yellow-400 hover:underline cursor-pointer"
                    >
                      Generate Strong Password
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      required
                      type={showNewPassword ? "text" : "password"}
                      value={newCustomerPassword}
                      onChange={(e) => setNewCustomerPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      className="bg-black/40 border-white/10 text-white font-mono text-xs h-9 pr-10 rounded-xl focus-visible:border-yellow-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="space-y-1.5 text-xs">
                  <label className="text-white/70 font-medium">Confirm New Password *</label>
                  <Input
                    required
                    type="password"
                    value={confirmCustomerPassword}
                    onChange={(e) => setConfirmCustomerPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    minLength={8}
                    className="bg-black/40 border-white/10 text-white font-mono text-xs h-9 rounded-xl focus-visible:border-yellow-400"
                  />
                </div>

                {/* Reason for Reset */}
                <div className="space-y-1.5 text-xs">
                  <label className="text-white/70 font-medium">Reason for Password Reset</label>
                  <Input
                    value={resetPasswordReason}
                    onChange={(e) => setResetPasswordReason(e.target.value)}
                    placeholder="e.g. In-person request with verified national ID"
                    className="bg-black/40 border-white/10 text-white text-xs h-9 rounded-xl focus-visible:border-yellow-400"
                  />
                </div>

                {/* Staff Authorization Password */}
                <div className="space-y-1.5 pt-2 border-t border-white/5 text-xs">
                  <label className="text-yellow-400 font-semibold flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Staff Authorization Password *
                  </label>
                  <Input
                    required
                    type="password"
                    value={resetPasswordStaffAuth}
                    onChange={(e) => setResetPasswordStaffAuth(e.target.value)}
                    placeholder="Enter your staff password to authorize"
                    className="bg-black/40 border-yellow-400/30 text-white text-xs h-9 rounded-xl focus-visible:border-yellow-400"
                  />
                  <span className="text-[10px] text-white/40 block">This security override will be logged in the immutable staff activity audit log.</span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={resetPasswordLoading}
                    onClick={() => setResetPasswordCustomer(null)}
                    className="bg-white/5 border-white/10 text-white text-xs h-9 px-4 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={resetPasswordLoading}
                    className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-xs h-9 px-5 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    {resetPasswordLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Resetting Password...
                      </>
                    ) : (
                      <>
                        <KeyRound className="h-3.5 w-3.5" />
                        Reset Customer Password
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      <StaffPasswordConfirmModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={handleConfirmedAddCustomer}
        title="Authorize Customer Member Creation"
        description={`You are registering customer member ${fullName} (${email}). Please confirm with your staff credentials password to authorize creation.`}
        confirmButtonText="Authorize & Create Member"
        getAuthHeaders={getAuthHeaders}
      />
    </div>
  )
}
