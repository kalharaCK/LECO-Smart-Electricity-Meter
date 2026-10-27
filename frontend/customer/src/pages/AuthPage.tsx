import { API_BASE_URL } from "@/lib/api"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  User, 
  Smartphone, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Lock,
  Mail,
  MapPin,
  CreditCard
} from "lucide-react"

import { AdCarouselModal } from "@/components/AdCarouselModal"
import { LanguageSelector } from "@/components/LanguageSelector"
import { getTranslations, type Language } from "@/lib/i18n"
import { OtpInputBoxes } from "@/components/OtpInputBoxes"
import bgImage from "@/assets/background.webp"

export default function AuthPage() {
  useEffect(() => {
    localStorage.removeItem("token")
  }, [])

  const navigate = useNavigate()
  
  // View mode: 'auth' (Login / Register tabs) or 'forgot_password'
  const [view, setView] = useState<"auth" | "forgot_password">("auth")
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Language state (en, si, ta)
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("customer_lang") as Language
    return saved === "si" || saved === "ta" || saved === "en" ? saved : "en"
  })

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang)
    localStorage.setItem("customer_lang", newLang)
  }

  const t = getTranslations(language)

  // Advertisement modal
  const [showAdModal, setShowAdModal] = useState(true)

  // --- Login State ---
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  // --- Step-by-Step Registration State ---
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1)
  const [fullName, setFullName] = useState("")
  const [nic, setNic] = useState("")
  const [address, setAddress] = useState("")
  const [mobileNumber, setMobileNumber] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [regOtp, setRegOtp] = useState("")
  const [sendingRegOtp, setSendingRegOtp] = useState(false)

  // --- Forgot Password State ---
  const [fpStep, setFpStep] = useState<1 | 2>(1)
  const [fpNic, setFpNic] = useState("")
  const [fpMobile, setFpMobile] = useState("")
  const [fpOtp, setFpOtp] = useState("")
  const [fpMaskedPhone, setFpMaskedPhone] = useState("")
  const [fpNewPassword, setFpNewPassword] = useState("")
  const [fpConfirmPassword, setFpConfirmPassword] = useState("")
  const [showFpNewPassword, setShowFpNewPassword] = useState(false)
  const [showFpConfirmPassword, setShowFpConfirmPassword] = useState(false)
  const [sendingFpOtp, setSendingFpOtp] = useState(false)

  // Handle Standard Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/customer-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t.alerts.genericError)
      }
      localStorage.setItem("user", JSON.stringify(data.user))
      if (data.token) {
        localStorage.setItem("token", data.token)
      }

      setMessage({ type: "success", text: t.alerts.loginSuccess })
      setTimeout(() => {
        navigate("/dashboard")
      }, 600)
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Registration: Step 1 -> Step 2
  const handleRegStep1Continue = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (!fullName.trim() || !nic.trim() || !address.trim()) {
      setMessage({ type: "error", text: "Please enter your Full Name, NIC, and Residential Address." })
      return
    }
    setRegStep(2)
  }

  // Registration: Step 2 -> Send OTP -> Step 3
  const handleSendRegOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (!regEmail.trim() || !mobileNumber.trim() || !regPassword) {
      setMessage({ type: "error", text: "Email, Mobile Number, and Password are required." })
      return
    }

    if (regPassword.length < 6) {
      setMessage({ type: "error", text: t.alerts.passwordTooShort })
      return
    }

    setSendingRegOtp(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          full_name: fullName,
          nic,
          address,
          mobile_number: mobileNumber,
          email: regEmail
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t.alerts.genericError)
      }

      setRegStep(3)
      setMessage({ type: "success", text: `${t.alerts.otpSentSuccess} (${mobileNumber})` })
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setSendingRegOtp(false)
    }
  }

  // Resend OTP for Registration
  const handleResendRegOtp = async () => {
    setMessage(null)
    setSendingRegOtp(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          full_name: fullName,
          nic,
          address,
          mobile_number: mobileNumber,
          email: regEmail
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t.alerts.genericError)
      }
      setMessage({ type: "success", text: `New verification code dispatched via SMS to ${mobileNumber}` })
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setSendingRegOtp(false)
    }
  }

  // Registration: Step 3 -> Verify OTP and Finalize Registration
  const handleFinalizeRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (!regOtp.trim() || regOtp.length < 6) {
      setMessage({ type: "error", text: "Please enter the complete 6-digit verification code sent to your mobile." })
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          full_name: fullName,
          address,
          nic,
          mobile_number: mobileNumber,
          email: regEmail,
          password: regPassword,
          otp: regOtp.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t.alerts.genericError)
      }

      localStorage.setItem("user", JSON.stringify(data.user))

      setMessage({ type: "success", text: t.alerts.signupSuccess })
      setTimeout(() => {
        navigate("/dashboard")
      }, 700)
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setLoading(false)
    }
  }

  // Forgot Password: Step 1 -> Send OTP based on NIC and Mobile
  const handleSendFpOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (!fpNic.trim() || !fpMobile.trim()) {
      setMessage({ type: "error", text: "NIC Number and registered Mobile Number are required." })
      return
    }

    setSendingFpOtp(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nic: fpNic.trim(),
          mobile_number: fpMobile.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t.alerts.genericError)
      }

      setFpMaskedPhone(data.maskedPhone || fpMobile)
      setFpStep(2)
      setMessage({ type: "success", text: `${t.alerts.otpSentSuccess} (${data.maskedPhone || fpMobile})` })
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setSendingFpOtp(false)
    }
  }

  // Resend OTP for Forgot Password
  const handleResendFpOtp = async () => {
    setMessage(null)
    setSendingFpOtp(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nic: fpNic.trim(),
          mobile_number: fpMobile.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t.alerts.genericError)
      }
      setMessage({ type: "success", text: `New verification code dispatched via SMS to ${fpMaskedPhone || fpMobile}` })
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setSendingFpOtp(false)
    }
  }

  // Forgot Password: Step 2 -> Verify OTP and Reset Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (!fpOtp.trim()) {
      setMessage({ type: "error", text: t.alerts.otpRequired })
      return
    }

    if (fpNewPassword.length < 6) {
      setMessage({ type: "error", text: t.alerts.passwordTooShort })
      return
    }

    if (fpNewPassword !== fpConfirmPassword) {
      setMessage({ type: "error", text: t.alerts.passwordsDoNotMatch })
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nic: fpNic.trim(),
          otp: fpOtp.trim(),
          newPassword: fpNewPassword
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t.alerts.genericError)
      }

      setMessage({ type: "success", text: t.forgotPassword.resetSuccess })
      setTimeout(() => {
        setView("auth")
        setIsLogin(true)
        setMessage(null)
      }, 1800)
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-3.5 sm:p-6 overflow-hidden bg-[#070707]">
      {/* Background Image: Clearly visible light bulb and meter with atmospheric black gradient overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden">
        <img
          src={bgImage}
          alt=""
          className="w-full h-full object-cover object-center opacity-65 sm:opacity-75 filter brightness-90 contrast-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/85" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.75)_80%)]" />
      </div>

      {/* Pure Image-Focused Advertisement Carousel Modal */}
      <AdCarouselModal
        isOpen={showAdModal}
        onClose={() => setShowAdModal(false)}
        lang={language}
      />

      {/* Login Card Container */}
      <div className="relative z-10 w-full max-w-md sm:max-w-lg flex flex-col items-center">
        {/* Top Control Bar: Re-open Ads Button & Standard Tri-lingual Language Selector */}
        <div className="w-full mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            id="open-ad-modal-button"
            onClick={() => setShowAdModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 active:scale-95 border border-white/15 backdrop-blur-md shadow-md text-white/80 hover:text-white text-xs font-semibold transition-all cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            <span>{t.adsBar.title}</span>
          </button>

          <LanguageSelector
            currentLanguage={language}
            onLanguageChange={handleLanguageChange}
          />
        </div>

        {/* Main Customer Auth Card */}
        <Card className="w-full bg-gradient-to-br from-[#992511]/90 via-[#521308]/90 to-[#240602]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="h-1.5 w-full bg-gradient-to-r from-yellow-400 via-amber-200 to-yellow-400" />
          {view === "forgot_password" ? (
            /* --- FORGOT PASSWORD FLOW --- */
            <div>
              <CardHeader className="p-5 sm:p-7 pb-2 sm:pb-3 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3.5 mb-2">
                  <img src="/leco-logo.png" alt="LECO Self Care" className="h-14 w-auto object-contain shrink-0" />
                  <div className="text-center sm:text-left">
                    <CardTitle className="font-black text-xl sm:text-2xl tracking-tight text-white block">
                      {t.forgotPassword.title}
                    </CardTitle>
                    <span className="text-[11px] font-semibold text-yellow-400 uppercase tracking-wider block">
                      LECO Self Care • Identity Verification
                    </span>
                  </div>
                </div>
                <CardDescription className="text-white/70 text-xs sm:text-sm mt-1">
                  {t.forgotPassword.desc}
                </CardDescription>

                {/* Step Indicator */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className={`p-2 rounded-xl text-center text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    fpStep === 1 
                      ? "bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20" 
                      : fpStep > 1
                      ? "bg-yellow-400/15 text-yellow-300 border-yellow-400/30"
                      : "bg-black/40 text-white/60 border-white/10"
                  }`}>
                    {fpStep > 1 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-yellow-400" />
                    ) : (
                      <CreditCard className="h-3.5 w-3.5" />
                    )}
                    <span>{t.forgotPassword.step1Tag}</span>
                  </div>

                  <div className={`p-2 rounded-xl text-center text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    fpStep === 2 
                      ? "bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20" 
                      : "bg-black/40 text-white/60 border-white/10"
                  }`}>
                    <Lock className="h-3.5 w-3.5" />
                    <span>{t.forgotPassword.step2Tag}</span>
                  </div>
                </div>
              </CardHeader>

              {message && (
                <div className="px-5 sm:px-7 pt-2">
                  <Alert variant={message.type === "error" ? "destructive" : "default"} className={`rounded-xl text-xs py-2.5 ${message.type === "success" ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-200" : "bg-red-950/80 border-red-500/50 text-red-200"}`}>
                    <AlertTitle className="text-xs font-bold">{message.type === "error" ? t.alerts.errorTitle : t.alerts.successTitle}</AlertTitle>
                    <AlertDescription className="text-[11px] leading-tight mt-0.5">{message.text}</AlertDescription>
                  </Alert>
                </div>
              )}

              {fpStep === 1 ? (
                /* Forgot Password Step 1: NIC & Mobile */
                <form onSubmit={handleSendFpOtp}>
                  <CardContent className="flex flex-col gap-4 p-5 sm:p-7 pt-3">
                    <FieldGroup className="space-y-3.5">
                      <Field>
                        <FieldLabel htmlFor="fp-nic" className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-yellow-400" />
                          <span>{t.fields.nicLabel}</span>
                        </FieldLabel>
                        <Input
                          id="fp-nic"
                          placeholder={t.fields.nicPlaceholder}
                          value={fpNic}
                          onChange={(e) => setFpNic(e.target.value)}
                          className="bg-black/40 border border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:border-yellow-400 focus:bg-black/60 transition-all mt-1 uppercase"
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="fp-mobile" className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          <Smartphone className="h-3.5 w-3.5 text-yellow-400" />
                          <span>{t.fields.mobileLabel}</span>
                        </FieldLabel>
                        <Input
                          id="fp-mobile"
                          type="tel"
                          placeholder={t.fields.mobilePlaceholder}
                          value={fpMobile}
                          onChange={(e) => setFpMobile(e.target.value)}
                          className="bg-black/40 border border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:border-yellow-400 focus:bg-black/60 transition-all mt-1"
                          required
                        />
                      </Field>
                    </FieldGroup>
                  </CardContent>
                  <CardFooter className="p-5 sm:p-7 pt-0 flex flex-col gap-3">
                    <Button
                      type="submit"
                      disabled={sendingFpOtp}
                      className="w-full h-11 rounded-xl bg-yellow-400 hover:bg-yellow-500 active:scale-[0.99] text-black font-bold text-sm shadow-xl shadow-black/30 hover:shadow-yellow-400/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {sendingFpOtp ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.buttons.sendingOtp}
                        </>
                      ) : (
                        <>
                          <Smartphone className="h-4 w-4" />
                          {t.forgotPassword.verifyBtn}
                        </>
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setView("auth")
                        setMessage(null)
                      }}
                      className="text-xs text-yellow-400 hover:text-yellow-300 font-semibold transition-colors cursor-pointer py-1 flex items-center justify-center gap-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>{t.forgotPassword.backToLogin}</span>
                    </button>
                  </CardFooter>
                </form>

              ) : (
                /* Forgot Password Step 2: OTP & New Password */
                <form onSubmit={handleResetPasswordSubmit}>
                  <CardContent className="flex flex-col gap-4 p-5 sm:p-7 pt-3">
                    {fpMaskedPhone && (
                      <p className="text-xs text-white/75 bg-black/25 p-2.5 rounded-xl border border-white/10">
                        {t.forgotPassword.phoneHint}: <strong className="text-yellow-400 font-mono">{fpMaskedPhone}</strong>
                      </p>
                    )}

                    <FieldGroup className="space-y-3.5">
                      <Field>
                        <FieldLabel className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-2">
                          <Smartphone className="h-3.5 w-3.5 text-yellow-400" />
                          <span>Enter 6-Digit SMS Verification Code</span>
                        </FieldLabel>
                        <OtpInputBoxes
                          length={6}
                          value={fpOtp}
                          onChange={setFpOtp}
                          onComplete={(code) => setFpOtp(code)}
                          onResend={handleResendFpOtp}
                          isResending={sendingFpOtp}
                          initialSeconds={60}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="fp-new-password" className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 text-yellow-400" />
                          <span>{t.fields.newPasswordLabel}</span>
                        </FieldLabel>
                        <div className="relative mt-1">
                          <Input
                            id="fp-new-password"
                            type={showFpNewPassword ? "text" : "password"}
                            placeholder={t.fields.newPasswordPlaceholder}
                            value={fpNewPassword}
                            onChange={(e) => setFpNewPassword(e.target.value)}
                            className="bg-black/40 border border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:border-yellow-400 focus:bg-black/60 transition-all pr-10"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowFpNewPassword(!showFpNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            aria-label={showFpNewPassword ? "Hide new password" : "Show new password"}
                            aria-pressed={showFpNewPassword}
                          >
                            {showFpNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="fp-confirm-password" className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 text-yellow-400" />
                          <span>{t.fields.confirmPasswordLabel}</span>
                        </FieldLabel>
                        <div className="relative mt-1">
                          <Input
                            id="fp-confirm-password"
                            type={showFpConfirmPassword ? "text" : "password"}
                            placeholder={t.fields.confirmPasswordPlaceholder}
                            value={fpConfirmPassword}
                            onChange={(e) => setFpConfirmPassword(e.target.value)}
                            className="bg-black/40 border border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:border-yellow-400 focus:bg-black/60 transition-all pr-10"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowFpConfirmPassword(!showFpConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            aria-label={showFpConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                            aria-pressed={showFpConfirmPassword}
                          >
                            {showFpConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </Field>
                    </FieldGroup>
                  </CardContent>
                  <CardFooter className="p-5 sm:p-7 pt-0 flex flex-col gap-3">
                    <Button
                      type="submit"
                      disabled={loading || fpOtp.length < 6}
                      className="w-full h-11 rounded-xl bg-yellow-400 hover:bg-yellow-500 active:scale-[0.99] text-black font-bold text-sm shadow-xl shadow-black/30 hover:shadow-yellow-400/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Resetting Password...</span>
                        </>
                      ) : (
                        <span>{t.forgotPassword.resetBtn}</span>
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setFpStep(1)}
                      className="text-xs text-yellow-400 hover:text-yellow-300 font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 py-1"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>{t.buttons.back}</span>
                    </button>
                  </CardFooter>
                </form>
              )}

            </div>
          ) : (
            /* --- STANDARD AUTH: LOGIN / STEP-BY-STEP REGISTER --- */
            <Tabs 
              value={isLogin ? "login" : "signup"} 
              onValueChange={(val) => {
                setIsLogin(val === "login")
                setMessage(null)
              }}
            >
              <CardHeader className="p-5 sm:p-7 pb-2 sm:pb-3 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3.5 mb-3">
                  <img src="/leco-logo.png" alt="LECO Self Care" className="h-14 w-auto object-contain shrink-0" />
                  <div className="text-center sm:text-left">
                    <CardTitle className="font-black text-xl sm:text-2xl tracking-tight text-white block">
                      LECO Self Care
                    </CardTitle>
                    <span className="text-[11px] font-semibold text-yellow-400 uppercase tracking-wider block">
                      Customer Portal
                    </span>
                  </div>
                </div>
                <CardDescription className="text-white/70 text-xs sm:text-sm mt-1">
                  {t.portalDesc}
                </CardDescription>
                <div className="mt-4 sm:mt-5">
                  <TabsList className="w-full bg-black/40 p-1 h-11 rounded-xl border border-white/10">
                    <TabsTrigger value="login" className="flex-1 h-9 rounded-lg text-xs font-bold data-[state=active]:bg-yellow-400 data-[state=active]:text-black transition-all cursor-pointer">
                      {t.tabs.login}
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="flex-1 h-9 rounded-lg text-xs font-bold data-[state=active]:bg-yellow-400 data-[state=active]:text-black transition-all cursor-pointer">
                      {t.tabs.register}
                    </TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>

              {message && (
                <div className="px-5 sm:px-7 pt-1">
                  <Alert variant={message.type === "error" ? "destructive" : "default"} className={`rounded-xl text-xs py-2.5 ${message.type === "success" ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-200" : "bg-red-950/80 border-red-500/50 text-red-200"}`}>
                    <AlertTitle className="text-xs font-bold">{message.type === "error" ? t.alerts.errorTitle : t.alerts.successTitle}</AlertTitle>
                    <AlertDescription className="text-[11px] leading-tight mt-0.5">{message.text}</AlertDescription>
                  </Alert>
                </div>
              )}

              {/* TAB 1: LOGIN */}
              <TabsContent value="login" className="m-0">
                <form onSubmit={handleLoginSubmit}>
                  <CardContent className="flex flex-col gap-4 p-5 sm:p-7 pt-2 sm:pt-3">
                    <FieldGroup className="space-y-3.5">
                      <Field>
                        <FieldLabel htmlFor="login-email" className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-yellow-400" />
                          <span>{t.fields.emailLabel}</span>
                        </FieldLabel>
                        <Input
                          id="login-email"
                          type="email"
                          autoComplete="username"
                          placeholder={t.fields.emailPlaceholder}
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          autoComplete="email"
                          className="bg-black/40 border border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:border-yellow-400 focus:bg-black/60 transition-all mt-1"
                          required
                        />
                      </Field>
                      <Field>
                        <div className="flex justify-between items-center">
                          <FieldLabel htmlFor="login-password" className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-yellow-400" />
                            <span>{t.fields.passwordLabel}</span>
                          </FieldLabel>
                          <button
                            type="button"
                            onClick={() => {
                              setView("forgot_password")
                              setFpStep(1)
                              setMessage(null)
                            }}
                            className="text-xs text-yellow-400 hover:text-yellow-300 font-semibold transition-colors cursor-pointer"
                          >
                            {t.forgotPassword.link}
                          </button>
                        </div>
                        <div className="relative mt-1">
                          <Input
                            id="login-password"
                            type={showLoginPassword ? "text" : "password"}
                            value={loginPassword}
                            placeholder={t.fields.passwordPlaceholder}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            autoComplete="current-password"
                            className="bg-black/40 border border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:border-yellow-400 focus:bg-black/60 transition-all pr-10"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            aria-label={showLoginPassword ? "Hide password" : "Show password"}
                            aria-pressed={showLoginPassword}
                          >
                            {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </Field>
                    </FieldGroup>
                  </CardContent>
                  <CardFooter className="p-5 sm:p-7 pt-0 border-none bg-transparent">
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full h-11 rounded-xl bg-yellow-400 hover:bg-yellow-500 active:scale-[0.99] text-black font-bold text-sm shadow-xl shadow-black/30 hover:shadow-yellow-400/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t.buttons.signingIn}</span>
                        </>
                      ) : (
                        <span>{t.buttons.signIn}</span>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>

              {/* TAB 2: STEP-BY-STEP REGISTRATION */}
              <TabsContent value="signup" className="m-0">
                {/* Step Progress Bar */}
                <div className="px-5 sm:px-7 pt-2 pb-1">
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`p-2 rounded-xl text-center text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      regStep === 1 
                        ? "bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20" 
                        : regStep > 1 
                        ? "bg-yellow-400/15 text-yellow-300 border-yellow-400/30"
                        : "bg-black/40 text-white/60 border-white/10"
                    }`}>
                      {regStep > 1 ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-yellow-400" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                      <span>{t.steps.step1Tag}</span>
                    </div>

                    <div className={`p-2 rounded-xl text-center text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      regStep === 2 
                        ? "bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20" 
                        : regStep > 2 
                        ? "bg-yellow-400/15 text-yellow-300 border-yellow-400/30"
                        : "bg-black/40 text-white/60 border-white/10"
                    }`}>
                      {regStep > 2 ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-yellow-400" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                      <span>{t.steps.step2Tag}</span>
                    </div>

                    <div className={`p-2 rounded-xl text-center text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      regStep === 3 
                        ? "bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20" 
                        : "bg-black/40 text-white/60 border-white/10"
                    }`}>
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>{t.steps.step3Tag}</span>
                    </div>
                  </div>
                </div>

                {/* STEP 1: Personal Details */}
                {regStep === 1 && (
                  <form onSubmit={handleRegStep1Continue}>
                    <CardContent className="flex flex-col gap-3.5 p-5 sm:p-7 pt-3">
                      <div className="mb-1">
                        <h4 className="font-bold text-sm text-white">{t.steps.step1Title}</h4>
                        <p className="text-xs text-white/60">{t.steps.step1Desc}</p>
                      </div>

                      <FieldGroup className="space-y-3">
                        <Field>
                          <FieldLabel htmlFor="reg-name" className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-yellow-400" />
                            <span>{t.fields.fullNameLabel}</span>
                          </FieldLabel>
                          <Input
                            id="reg-name"
                            placeholder={t.fields.fullNamePlaceholder}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="bg-black/40 border border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:border-yellow-400 focus:bg-black/60 transition-all mt-1"
                            required
                          />
                        </Field>

                        <Field>
                          <FieldLabel htmlFor="reg-nic" className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <CreditCard className="h-3.5 w-3.5 text-yellow-400" />
                            <span>{t.fields.nicLabel}</span>
                          </FieldLabel>
                          <Input
                            id="reg-nic"
                            placeholder={t.fields.nicPlaceholder}
                            value={nic}
                            onChange={(e) => setNic(e.target.value)}
                            className="bg-black/40 border border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:border-yellow-400 focus:bg-black/60 transition-all mt-1 uppercase"
                            required
                          />
                        </Field>

                        <Field>
                          <FieldLabel htmlFor="reg-address" className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-yellow-400" />
                            <span>{t.fields.addressLabel}</span>
                          </FieldLabel>
                          <Input
                            id="reg-address"
                            placeholder={t.fields.addressPlaceholder}
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="bg-black/40 border border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:border-yellow-400 focus:bg-black/60 transition-all mt-1"
                            required
                          />
                        </Field>
                      </FieldGroup>
                    </CardContent>

                    <CardFooter className="p-5 sm:p-7 pt-0 border-none bg-transparent">
                      <Button
                        type="submit"
                        className="w-full h-11 rounded-xl bg-yellow-400 hover:bg-yellow-500 active:scale-[0.99] text-black font-bold text-sm shadow-xl shadow-black/30 hover:shadow-yellow-400/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span>{t.buttons.continue}</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </form>
                )}

                {/* STEP 2: Contact & Security */}
                {regStep === 2 && (
                  <form onSubmit={handleSendRegOtp}>
                    <CardContent className="flex flex-col gap-3.5 p-5 sm:p-7 pt-3">
                      <div className="mb-1">
                        <h4 className="font-bold text-sm text-white">{t.steps.step2Title}</h4>
                        <p className="text-xs text-white/60">{t.steps.step2Desc}</p>
                      </div>

                      <FieldGroup className="space-y-3">
                        <Field>
                          <FieldLabel htmlFor="reg-email" className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-yellow-400" />
                            <span>{t.fields.emailLabel}</span>
                          </FieldLabel>
                          <Input
                            id="reg-email"
                            type="email"
                            placeholder={t.fields.emailPlaceholder}
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            className="bg-black/40 border border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:border-yellow-400 focus:bg-black/60 transition-all mt-1"
                            required
                          />
                        </Field>

                        <Field>
                          <FieldLabel htmlFor="reg-mobile" className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <Smartphone className="h-3.5 w-3.5 text-yellow-400" />
                            <span>{t.fields.mobileLabel}</span>
                          </FieldLabel>
                          <Input
                            id="reg-mobile"
                            type="tel"
                            placeholder={t.fields.mobilePlaceholder}
                            value={mobileNumber}
                            onChange={(e) => setMobileNumber(e.target.value)}
                            className="bg-black/40 border border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:border-yellow-400 focus:bg-black/60 transition-all mt-1"
                            required
                          />
                        </Field>

                        <Field>
                          <FieldLabel htmlFor="reg-password" className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-yellow-400" />
                            <span>{t.fields.createPasswordLabel}</span>
                          </FieldLabel>
                          <div className="relative mt-1">
                            <Input
                              id="reg-password"
                              type={showRegPassword ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder={t.fields.createPasswordPlaceholder}
                              value={regPassword}
                              onChange={(e) => setRegPassword(e.target.value)}
                              className="bg-black/40 border border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:border-yellow-400 focus:bg-black/60 transition-all pr-10"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowRegPassword(!showRegPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                              aria-label={showRegPassword ? "Hide password" : "Show password"}
                              aria-pressed={showRegPassword}
                            >
                              {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </Field>
                      </FieldGroup>
                    </CardContent>

                    <CardFooter className="p-5 sm:p-7 pt-0 flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setRegStep(1)
                          setMessage(null)
                        }}
                        className="h-11 px-4 rounded-xl bg-black/40 hover:bg-black/60 active:scale-[0.99] text-white border border-white/20 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-all"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>{t.buttons.back}</span>
                      </Button>

                      <Button
                        type="submit"
                        disabled={sendingRegOtp}
                        className="flex-1 h-11 rounded-xl bg-yellow-400 hover:bg-yellow-500 active:scale-[0.99] text-black font-bold text-sm shadow-xl shadow-black/30 hover:shadow-yellow-400/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {sendingRegOtp ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{t.buttons.sendingOtp}</span>
                          </>
                        ) : (
                          <>
                            <Smartphone className="h-4 w-4" />
                            <span>{t.buttons.sendOtp}</span>
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </form>
                )}

                {/* STEP 3: Mobile Phone Verification (OTP) */}
                {regStep === 3 && (
                  <form onSubmit={handleFinalizeRegistration}>
                    <CardContent className="flex flex-col gap-3.5 p-5 sm:p-7 pt-3">
                      <div className="mb-1">
                        <h4 className="font-bold text-sm text-white">{t.steps.step3Title}</h4>
                        <p className="text-xs text-white/60">
                          {t.steps.step3Desc}: <strong className="text-yellow-400 font-mono">{mobileNumber}</strong>
                        </p>
                      </div>

                      <FieldGroup className="space-y-2">
                        <Field>
                          <FieldLabel className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-2">
                            <Smartphone className="h-3.5 w-3.5 text-yellow-400" />
                            <span>Enter 6-Digit SMS Verification Code</span>
                          </FieldLabel>
                          <OtpInputBoxes
                            length={6}
                            value={regOtp}
                            onChange={setRegOtp}
                            onComplete={(code) => setRegOtp(code)}
                            onResend={handleResendRegOtp}
                            isResending={sendingRegOtp}
                            initialSeconds={60}
                          />
                        </Field>
                      </FieldGroup>
                    </CardContent>

                    <CardFooter className="p-5 sm:p-7 pt-0 flex flex-col gap-3">
                      <div className="flex items-center gap-3 w-full">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setRegStep(2)
                            setMessage(null)
                          }}
                          className="h-11 px-4 rounded-xl bg-black/40 hover:bg-black/60 active:scale-[0.99] text-white border border-white/20 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-all"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          <span>{t.buttons.back}</span>
                        </Button>

                        <Button
                          type="submit"
                          disabled={loading || regOtp.length < 6}
                          className="flex-1 h-11 rounded-xl bg-yellow-400 hover:bg-yellow-500 active:scale-[0.99] text-black font-bold text-sm shadow-xl shadow-black/30 hover:shadow-yellow-400/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>{t.buttons.registering}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Verify & Register</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </CardFooter>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          )}
        </Card>

      </div>
    </div>
  )
}
