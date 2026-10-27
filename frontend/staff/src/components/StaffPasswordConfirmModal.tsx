import { useState } from "react"
import { Lock, Eye, EyeOff, Loader2, ShieldAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { API_BASE_URL } from "@/lib/api"

interface StaffPasswordConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void | Promise<void>
  title?: string
  description?: string
  confirmButtonText?: string
  isDestructive?: boolean
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>
}

export default function StaffPasswordConfirmModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Staff Security Authorization",
  description = "This is a sensitive administrative operation. Please enter your staff account password to authorize and proceed.",
  confirmButtonText = "Authorize & Proceed",
  isDestructive = false,
  getAuthHeaders
}: StaffPasswordConfirmModalProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      setError("Please enter your staff password.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/verify-password`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ password })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setPassword("")
        setError(null)
        onClose()
        await onSuccess()
      } else {
        setError(data.message || "Invalid staff password. Authorization denied.")
      }
    } catch (err: any) {
      console.error("Staff password verification error:", err)
      setError("Network error communicating with authentication service.")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setPassword("")
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl p-6 text-white relative">
        <button
          type="button"
          onClick={handleCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDestructive ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20"
            }`}
          >
            {isDestructive ? <ShieldAlert className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            <p className="text-[11px] text-white/50">LECO Operations Security Barrier</p>
          </div>
        </div>

        <p className="text-xs text-white/70 mb-5 leading-relaxed bg-[#141416] p-3 rounded-xl border border-white/5">
          {description}
        </p>

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-white/80 block mb-1.5">
              Staff Account Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(null)
                }}
                autoFocus
                placeholder="Enter your login password"
                className="bg-[#141416] border-white/10 text-xs h-10 pr-10 text-white placeholder:text-white/30 focus-visible:ring-yellow-400/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-400 mt-2 font-medium flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={loading}
              className="border-white/10 text-white/70 hover:bg-white/5 text-xs h-9 px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !password}
              className={`text-xs h-9 px-5 font-bold cursor-pointer ${
                isDestructive
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-yellow-400 hover:bg-yellow-500 text-black shadow-lg shadow-yellow-400/20"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Verifying...
                </span>
              ) : (
                confirmButtonText
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
