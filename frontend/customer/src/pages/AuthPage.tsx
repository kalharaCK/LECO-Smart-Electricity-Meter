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
import { Loader2, Eye, EyeOff } from "lucide-react"
import { AdCarouselModal } from "@/components/AdCarouselModal"
import { LanguageSelector } from "@/components/LanguageSelector"
import { getTranslations, type Language } from "@/lib/i18n"
import bgImage from "@/assets/background.webp"

export default function AuthPage() {
  useEffect(() => {
    localStorage.removeItem("token")
  }, [])

  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  // Tri-lingual state (English, Sinhala, Tamil) with localStorage persistence
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("customer_lang") as Language
    return saved === "si" || saved === "ta" || saved === "en" ? saved : "en"
  })

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang)
    localStorage.setItem("customer_lang", newLang)
  }

  const t = getTranslations(language)

  // Advertisement carousel modal state (opens on initial visit, can be reopened)
  const [showAdModal, setShowAdModal] = useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    
    const endpoint = isLogin ? "/api/login" : "/api/signup"
    const body = isLogin 
      ? { email, password } 
      : { email, password, role: "customer" }

    try {
      const res = await fetch(`http://localhost:3000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || t.alerts.genericError)
      }
      
      if (isLogin) {
        // Store display data only; the HTTP-only cookie is the session credential.
        localStorage.setItem("user", JSON.stringify(data.user))
        
        setMessage({ type: "success", text: t.alerts.loginSuccess })
        
        // Navigate to dashboard after short delay
        setTimeout(() => {
          navigate("/dashboard")
        }, 600)
      } else {
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user))
        }
        setMessage({ type: "success", text: t.alerts.signupSuccess })
      }
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
        {/* Black gradient overlays to darken and blend seamlessly into the edges */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/85" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.75)_80%)]" />
      </div>

      {/* Pure Image-Focused Advertisement Carousel Modal (Clear Close Button, works on Mobile & PC) */}
      <AdCarouselModal
        isOpen={showAdModal}
        onClose={() => setShowAdModal(false)}
        lang={language}
      />

      {/* Login Card Container */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Top Control Bar: Re-open Ads Button & Standard Tri-lingual Language Selector */}
        <div className="w-full mb-3 flex items-center justify-between gap-2">
          {/* Re-open Advertisement Carousel */}
          <button
            type="button"
            id="open-ad-modal-button"
            onClick={() => setShowAdModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 active:scale-95 border border-white/15 backdrop-blur-md shadow-md text-white/80 hover:text-white text-xs font-semibold transition-all cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            <span>{t.adsBar.title}</span>
          </button>

          {/* Standard Tri-lingual Selector: English | සිංහල | தமிழ் */}
          <LanguageSelector
            currentLanguage={language}
            onLanguageChange={handleLanguageChange}
          />
        </div>

        {/* Main Customer Auth Card */}
        <Card className="w-full bg-gradient-to-br from-[#992511]/90 via-[#521308]/90 to-[#240602]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <Tabs 
            value={isLogin ? "login" : "signup"} 
            onValueChange={(val) => {
              setIsLogin(val === "login")
              setMessage(null)
              setEmail("")
              setPassword("")
            }}
          >
            <CardHeader className="p-5 sm:p-7 pb-2 sm:pb-3 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3.5 mb-3">
                <img src="/leco-logo.png" alt="LECO Self Care" className="h-14 w-auto object-contain shrink-0" />
                <div className="text-center sm:text-left">
                  <CardTitle className="font-black text-xl sm:text-2xl tracking-tight text-white block">LECO Self Care</CardTitle>
                  <span className="text-[11px] font-semibold text-yellow-400 uppercase tracking-wider block">Customer Portal</span>
                </div>
              </div>
              <CardDescription className="text-white/70 text-xs sm:text-sm mt-1">
                {t.portalDesc}
              </CardDescription>
              <div className="mt-4 sm:mt-5">
                <TabsList className="w-full bg-black/40 p-1 h-11 rounded-xl border border-white/10">
                  <TabsTrigger value="login" className="flex-1 h-9 rounded-lg text-xs font-bold data-[state=active]:bg-yellow-400 data-[state=active]:text-black transition-all">
                    {t.tabs.login}
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="flex-1 h-9 rounded-lg text-xs font-bold data-[state=active]:bg-yellow-400 data-[state=active]:text-black transition-all">
                    {t.tabs.register}
                  </TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>

            <TabsContent value="login" className="m-0">
              <form onSubmit={handleSubmit}>
                <CardContent className="flex flex-col gap-4 p-5 sm:p-7 pt-2 sm:pt-3">
                  {message && isLogin && (
                    <Alert variant={message.type === "error" ? "destructive" : "default"} className={`rounded-xl text-xs py-2.5 ${message.type === "success" ? "border-green-500/50 bg-green-950/80 text-green-200" : "bg-red-950/80 border-red-500/50 text-red-200"}`}>
                      <AlertTitle className="text-xs font-bold">{message.type === "error" ? t.alerts.errorTitle : t.alerts.successTitle}</AlertTitle>
                      <AlertDescription className="text-[11px] leading-tight mt-0.5">{message.text}</AlertDescription>
                    </Alert>
                  )}
                  <FieldGroup className="space-y-3.5">
                    <Field>
                      <FieldLabel htmlFor="login-email" className="text-white text-xs font-semibold uppercase tracking-wider">{t.fields.emailLabel}</FieldLabel>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder={t.fields.emailPlaceholder}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        className="bg-black/30 border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-yellow-400 mt-1"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="login-password" className="text-white text-xs font-semibold uppercase tracking-wider">{t.fields.passwordLabel}</FieldLabel>
                      <div className="relative mt-1">
                        <Input
                          id="login-password"
                          type={showLoginPassword ? "text" : "password"}
                          value={password}
                          placeholder={t.fields.passwordPlaceholder}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="current-password"
                          className="bg-black/30 border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-yellow-400 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                          aria-label={showLoginPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
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
                    className="w-full h-11 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-sm shadow-xl hover:shadow-yellow-400/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.buttons.signingIn}
                      </>
                    ) : (
                      t.buttons.signIn
                    )}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="m-0">
              <form onSubmit={handleSubmit}>
                <CardContent className="flex flex-col gap-4 p-5 sm:p-7 pt-2 sm:pt-3">
                  {message && !isLogin && (
                    <Alert variant={message.type === "error" ? "destructive" : "default"} className={`rounded-xl text-xs py-2.5 ${message.type === "success" ? "border-green-500/50 bg-green-950/80 text-green-200" : "bg-red-950/80 border-red-500/50 text-red-200"}`}>
                      <AlertTitle className="text-xs font-bold">{message.type === "error" ? t.alerts.errorTitle : t.alerts.successTitle}</AlertTitle>
                      <AlertDescription className="text-[11px] leading-tight mt-0.5">{message.text}</AlertDescription>
                    </Alert>
                  )}
                  <FieldGroup className="space-y-3.5">
                    <Field>
                      <FieldLabel htmlFor="signup-email" className="text-white text-xs font-semibold uppercase tracking-wider">{t.fields.emailLabel}</FieldLabel>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder={t.fields.emailPlaceholder}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        className="bg-black/30 border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-yellow-400 mt-1"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="signup-password" className="text-white text-xs font-semibold uppercase tracking-wider">{t.fields.createPasswordLabel}</FieldLabel>
                      <div className="relative mt-1">
                        <Input
                          id="signup-password"
                          type={showSignupPassword ? "text" : "password"}
                          placeholder={t.fields.createPasswordPlaceholder}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="new-password"
                          className="bg-black/30 border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-yellow-400 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                          aria-label={showSignupPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </Field>
                  </FieldGroup>
                </CardContent>
                <CardFooter className="p-5 sm:p-7 pt-0 border-none bg-transparent">
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-sm shadow-xl hover:shadow-yellow-400/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.buttons.registering}
                      </>
                    ) : (
                      t.buttons.register
                    )}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
