import { API_BASE_URL } from "@/lib/api"
import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShieldCheck, Lock, Mail, Loader2, AlertTriangle, ArrowRight, Eye, EyeOff } from "lucide-react"
import type { StaffUser } from "../types"

interface StaffLoginProps {
  onLoginSuccess: (user: StaffUser) => void
}

export default function StaffLogin({ onLoginSuccess }: StaffLoginProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPw?: string) => {
    if (e) e.preventDefault()
    const targetEmail = customEmail || email
    const targetPw = customPw || password

    if (!targetEmail || !targetPw) {
      setErrorMsg("Please enter both staff email and password.")
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/staff-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: targetEmail, password: targetPw })
      })

      const data = await res.json()
      if (res.ok && data.user) {
        localStorage.setItem("staff_user", JSON.stringify(data.user))
        onLoginSuccess(data.user)
      } else {
        setErrorMsg(data.error || data.message || "Invalid staff credentials")
      }
    } catch (err) {
      console.error("Staff login error:", err)
      setErrorMsg("Unable to connect to LECO Self Care backend. Please verify server on port 3000.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 relative overflow-hidden text-white font-sans selection:bg-[#992511]/30">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#992511]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md bg-gradient-to-br from-[#992511] to-[#3a0b04] border-0 shadow-2xl relative z-10 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-700">
        <div className="h-1.5 w-full bg-gradient-to-r from-yellow-400 via-amber-200 to-yellow-400" />

        <CardHeader className="text-center pt-8 pb-4">
          <div className="flex justify-center mb-3">
            <img src="/leco-logo.png" alt="LECO Self Care" className="h-14 w-auto object-contain" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-400/20 border border-yellow-400/30 text-yellow-300 text-xs font-bold uppercase tracking-wider mx-auto mb-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            LECO Self Care • Staff Portal
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            Operations & Grid Control
          </CardTitle>
          <CardDescription className="text-white/70 text-xs">
            Lanka Electricity Company (Pvt) Ltd. Advanced Metering Infrastructure
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2 pb-8 px-6 space-y-5">
          {errorMsg && (
            <div role="alert" className="p-3 rounded-xl bg-black/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/90 font-semibold flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-yellow-400" />
                Staff Email ID
              </Label>
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@leco.lk"
                required
                className="bg-black/30 border-white/15 text-white placeholder:text-white/40 text-xs h-10 rounded-xl focus-visible:border-yellow-400"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/90 font-semibold flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-yellow-400" />
                Security Password
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-black/30 border-white/15 text-white placeholder:text-white/40 text-xs h-10 rounded-xl focus-visible:border-yellow-400 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold h-11 rounded-xl text-xs shadow-lg shadow-black/20 transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating Staff Credentials...
                </>
              ) : (
                <>
                  Enter Operations Console
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
