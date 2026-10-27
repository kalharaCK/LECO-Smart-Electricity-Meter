import { API_BASE_URL } from "@/lib/api"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { CreditCard, Smartphone, CheckCircle2, Loader2, ArrowRight, Zap, ArrowLeft, RefreshCw, LifeBuoy, AlertTriangle, ShieldCheck, Lock } from "lucide-react"
import { useDashboardI18n } from "@/lib/dashboardI18n"

interface RechargeResult {
  prevBalance: string
  newBalance: string
  amount: string
  txnId: string
  debtRecovered?: number
  lifelineReplenished?: boolean
  gateway?: string
}

interface Meter {
  id: number
  meter_number: string
  account_number: string
  balance: string | number
  status: string
  name?: string
  emergency_credit_active?: boolean
  emergency_credit_limit?: string | number
}

interface PaymentsSectionProps {
  onSuccess?: () => void
  onNavigateOverview?: () => void
  onNavigateHistory?: () => void
}

export default function PaymentsSection({ onSuccess, onNavigateOverview, onNavigateHistory }: PaymentsSectionProps) {
  const { t } = useDashboardI18n()
  const [step, setStep] = useState<"amount" | "payment" | "processing" | "success" | "error">("amount")
  const [amount, setAmount] = useState("1000")
  const [customAmount, setCustomAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("payhere")
  const [result, setResult] = useState<RechargeResult | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [meters, setMeters] = useState<Meter[]>([])
  const [selectedMeterId, setSelectedMeterId] = useState<number | null>(null)
  const [loadingMeter, setLoadingMeter] = useState(true)
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())

  // Fetch user meters
  useEffect(() => {
    const fetchMeters = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/meters`, {
          credentials: "include",
        })
        if (res.ok) {
          const data: Meter[] = await res.json()
          setMeters(data)
          if (data.length > 0) {
            setSelectedMeterId(data[0].id)
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingMeter(false)
      }
    }
    fetchMeters()
  }, [])

  const selectedMeter = meters.find((m) => m.id === selectedMeterId) || meters[0]
  const selectedAmount = amount === "custom" ? customAmount : amount

  const handlePay = async () => {
    if (!selectedMeterId) return
    setErrorMsg("")

    const authHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // If customer selected PayHere Online Gateway
    if (paymentMethod === "payhere") {
      setStep("processing")
      try {
        const initRes = await fetch(`${API_BASE_URL}/api/customer/payments/payhere-init`, {
          method: "POST",
          credentials: "include",
          headers: authHeaders,
          body: JSON.stringify({
            meterId: selectedMeterId,
            amount: parseFloat(selectedAmount),
            paymentMethod: "payhere",
          }),
        })

        const initData = await initRes.json()
        if (!initRes.ok || !initData.success) {
          setErrorMsg(initData.message || "Unable to initialize PayHere checkout session.")
          setStep("error")
          return
        }

        const payhereObj = (window as any).payhere
        if (!payhereObj || typeof payhereObj.startPayment !== "function") {
          console.warn("PayHere JS SDK library (payhere.js) is not loaded on window.")
          setErrorMsg("PayHere Payment Gateway script is loading or blocked by your browser ad-blocker. Please refresh the page.")
          setStep("error")
          return
        }

        // Configure PayHere JS SDK Event Handlers per documentation
        payhereObj.onCompleted = async function onCompleted(orderId: string) {
          console.log("PayHere checkout onCompleted received for order:", orderId)
          setStep("processing")
          try {
            // The browser callback is only a UX signal. Wait for the signed server-to-server
            // PayHere notification to reconcile the payment before displaying success.
            for (let attempt = 0; attempt < 10; attempt++) {
              const completeRes = await fetch(`${API_BASE_URL}/api/customer/payments/payhere-complete`, {
                method: "POST",
                credentials: "include",
                headers: authHeaders,
                body: JSON.stringify({ orderId }),
              })
              const completeData = await completeRes.json()
              if (completeRes.ok && completeData.success && completeData.payment?.status === "Success") {
                setResult({
                  prevBalance: String(completeData.payment.prevBalance ?? selectedMeter.balance),
                  newBalance: String(completeData.payment.newBalance),
                  amount: String(completeData.payment.amount),
                  txnId: completeData.payment.orderId,
                  gateway: "PayHere Verified Gateway",
                })
                setStep("success")
                onSuccess?.()
                return
              }
              if (completeRes.status !== 202) {
                setErrorMsg(completeData.message || t.payments.paymentFailed)
                setStep("error")
                return
              }
              await new Promise((resolve) => setTimeout(resolve, 1500))
            }
            setErrorMsg("PayHere is still confirming this payment. Check payment history shortly before trying again.")
            setStep("error")
          } catch (finalizeErr) {
            console.error("Error checking PayHere payment status:", finalizeErr)
            setErrorMsg("Payment status could not be confirmed yet. Check payment history shortly before trying again.")
            setStep("error")
          }
        }

        payhereObj.onDismissed = function onDismissed() {
          console.log("PayHere payment modal was dismissed by the user.")
          setStep("payment")
        }

        payhereObj.onError = function onError(error: any) {
          console.error("PayHere SDK reported an error:", error)
          setErrorMsg("PayHere Gateway Error: " + (typeof error === "string" ? error : JSON.stringify(error)))
          setStep("error")
        }

        // Launch Onsite Checkout popup
        payhereObj.startPayment(initData.payhere)
      } catch (err) {
        console.error("PayHere init exception:", err)
        setErrorMsg(t.payments.networkError)
        setStep("error")
      }
      return
    }

    // Direct / mock fallback for alternative payment channels
    setStep("processing")
    try {
      const res = await fetch(`${API_BASE_URL}/api/meters/${selectedMeterId}/recharge`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...authHeaders,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          amount: parseFloat(selectedAmount),
          paymentMethod,
          idempotencyKey,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        setStep("success")
        onSuccess?.()
      } else {
        setErrorMsg(data.message || t.payments.paymentFailed)
        setStep("error")
      }
    } catch (e) {
      console.error(e)
      setErrorMsg(t.payments.networkError)
      setStep("error")
    }
  }

  if (loadingMeter) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  if (meters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="bg-white/5 p-6 rounded-full">
          <Zap className="h-12 w-12 text-white/30" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">{t.payments.noMeterTitle}</h3>
          <p className="text-white/50 text-sm max-w-xs">
            {t.payments.noMeterDesc}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Card className="bg-gradient-to-br from-[#992511] to-[#3a0b04] border-0 shadow-xl text-white">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{t.payments.title}</CardTitle>
              <CardDescription className="text-white/70">
                {t.payments.subtitle}
              </CardDescription>
            </div>
            {onNavigateOverview && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateOverview}
                className="text-white/60 hover:text-white hover:bg-white/10 text-xs cursor-pointer"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                {t.payments.backToOverview}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Active Meter Display / Selector */}
          {selectedMeter && step !== "success" && (
            <div className="mb-6 space-y-3">
              <div className="p-4 rounded-xl bg-black/30 border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">{t.payments.targetMeter}</div>
                  <div className="font-medium text-white flex items-center gap-2 mt-0.5">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    <span className="font-mono text-sm">{selectedMeter.meter_number}</span>
                    {selectedMeter.name && <span className="text-xs text-white/60">({selectedMeter.name})</span>}
                  </div>
                </div>
                <div className="sm:text-right">
                  <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">{t.payments.currentBalance}</div>
                  <div className={`text-lg font-bold ${Number(selectedMeter.balance) < 0 ? 'text-amber-400' : 'text-yellow-400'}`}>
                    Rs. {Number(selectedMeter.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {Number(selectedMeter.balance) < 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-3 text-amber-200 text-xs">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-300">{t.payments.debtNoticeTitle}:</span>
                    {" "}{t.payments.debtNoticeDesc}{" "}
                    <strong className="text-white font-mono">Rs. {Math.abs(Number(selectedMeter.balance)).toFixed(2)}</strong>.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Multiple Meters Selector if user has > 1 */}
          {meters.length > 1 && step === "amount" && (
            <div className="mb-6 space-y-2">
              <Label className="text-white text-xs sm:text-sm">{t.payments.selectMeterLabel}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {meters.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMeterId(m.id)}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      selectedMeterId === m.id
                        ? "bg-yellow-400/15 border-yellow-400 text-white font-medium shadow-sm"
                        : "bg-black/20 border-white/10 text-white/70 hover:bg-black/40"
                    }`}
                  >
                    <div className="font-mono font-semibold">{m.meter_number}</div>
                    <div className="text-white/50 mt-1">Rs. {Number(m.balance).toFixed(2)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1: Choose Amount */}
          {step === "amount" && (
            <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-3 sm:space-y-4">
                <Label className="text-white text-xs sm:text-sm font-semibold uppercase tracking-wider">
                  {t.payments.chooseAmount}
                </Label>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                  {["500", "1000", "2000", "5000"].map((val) => (
                    <div
                      key={val}
                      onClick={() => { setAmount(val); setCustomAmount("") }}
                      className={`p-3.5 sm:p-4 rounded-xl border text-center cursor-pointer transition-all min-h-[50px] flex items-center justify-center font-bold text-sm sm:text-base ${
                        amount === val
                          ? "bg-yellow-400 border-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.4)] scale-[1.01]"
                          : "bg-black/20 border-white/20 text-white hover:bg-black/40 active:scale-95"
                      }`}
                    >
                      Rs. {val}
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <Label className="text-white/80 text-xs sm:text-sm mb-1.5 block">
                    {t.payments.orCustomAmount}
                  </Label>
                  <div
                    onClick={() => setAmount("custom")}
                    className={`flex items-center p-1 rounded-xl border transition-all ${
                      amount === "custom"
                        ? "bg-black/40 border-yellow-400 ring-1 ring-yellow-400"
                        : "bg-black/20 border-white/20 hover:bg-black/40"
                    }`}
                  >
                    <span className="pl-3.5 text-white/60 text-sm sm:text-base font-semibold">Rs.</span>
                    <Input
                      type="number"
                      placeholder={t.payments.customPlaceholder}
                      className="border-0 bg-transparent text-white focus-visible:ring-0 shadow-none text-base sm:text-lg h-10"
                      value={customAmount}
                      onChange={(e) => { setAmount("custom"); setCustomAmount(e.target.value) }}
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setStep("payment")}
                className="w-full bg-white text-[#992511] hover:bg-white/90 font-bold mt-2 sm:mt-4 shadow-lg text-base sm:text-lg h-12 hover:scale-[1.01] active:scale-98 transition-all cursor-pointer"
                disabled={amount === "custom" && (!customAmount || parseInt(customAmount) < 100)}
              >
                {t.payments.continueBtn}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* STEP 2: Payment Method */}
          {step === "payment" && (
            <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="p-3.5 sm:p-4 bg-black/30 rounded-xl border border-white/10 flex justify-between items-center">
                <span className="text-white/80 text-xs sm:text-sm">{t.payments.totalToPay}</span>
                <span className="text-xl sm:text-2xl font-bold text-yellow-400">Rs. {parseFloat(selectedAmount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <Label className="text-white text-xs sm:text-sm font-semibold uppercase tracking-wider">{t.payments.paymentMethod}</Label>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid gap-2.5 sm:gap-3">
                  {/* PayHere Gateway (Featured / Recommended) */}
                  <div
                    onClick={() => setPaymentMethod("payhere")}
                    className={`flex flex-col border p-3.5 sm:p-4 rounded-xl cursor-pointer transition-all ${
                      paymentMethod === "payhere"
                        ? "border-yellow-400 bg-yellow-400/10 shadow-[0_0_15px_rgba(250,204,21,0.2)]"
                        : "border-white/20 bg-black/20 hover:bg-black/40"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem value="payhere" id="payhere" className="border-white/50 text-yellow-400 shrink-0" />
                      <Label htmlFor="payhere" className="flex flex-1 items-center justify-between cursor-pointer text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-5 w-5 text-yellow-400 shrink-0" />
                          <div>
                            <span className="text-white font-bold block sm:inline">PayHere Onsite Checkout</span>
                            <span className="ml-0 sm:ml-2 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-yellow-400 text-black">
                              RECOMMENDED
                            </span>
                          </div>
                        </div>
                      </Label>
                    </div>

                    <div className="pl-6 pt-2 text-[11px] text-white/70">
                      {t.payments.methodPayhere}
                    </div>

                    <div className="pl-6 pt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-white/10 text-white/90 font-mono">VISA</span>
                      <span className="px-2 py-0.5 rounded bg-white/10 text-white/90 font-mono">MasterCard</span>
                      <span className="px-2 py-0.5 rounded bg-white/10 text-white/90 font-mono">AMEX</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">eZ Cash</span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">mCash</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">Genie</span>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">Vishwa</span>
                      <span className="ml-auto text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                        <Lock className="h-3 w-3" /> {t.payments.payhereSecureBadge}
                      </span>
                    </div>
                  </div>

                  {(import.meta.env.DEV ? [
                    { value: "card", icon: <CreditCard className="h-5 w-5 text-yellow-400 shrink-0" />, label: t.payments.methodCard },
                    { value: "wallet", icon: <Smartphone className="h-5 w-5 text-yellow-400 shrink-0" />, label: t.payments.methodWallet },
                    { value: "bank", icon: <span className="font-serif font-bold text-base px-1 text-yellow-400 shrink-0">B</span>, label: t.payments.methodBank },
                  ] : []).map(({ value, icon, label }) => (
                    <div
                      key={value}
                      onClick={() => setPaymentMethod(value)}
                      className={`flex items-center space-x-2.5 border p-3.5 sm:p-4 rounded-xl cursor-pointer transition-all min-h-[52px] ${
                        paymentMethod === value
                          ? "border-yellow-400/60 bg-yellow-400/10 shadow-sm"
                          : "border-white/20 bg-black/20 hover:bg-black/40"
                      }`}
                    >
                      <RadioGroupItem value={value} id={value} className="border-white/50 text-yellow-400 shrink-0" />
                      <Label htmlFor={value} className="flex flex-1 items-center gap-2 cursor-pointer text-xs sm:text-sm">
                        {icon}
                        <span className="text-white font-medium">{label}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="w-full sm:w-1/3 bg-transparent border-white/20 text-white hover:bg-white/10 h-11 text-xs sm:text-sm cursor-pointer" 
                  onClick={() => setStep("amount")}
                >
                  {t.payments.backBtn}
                </Button>
                <Button 
                  onClick={handlePay} 
                  className="w-full sm:flex-1 bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg h-11 text-xs sm:text-sm hover:scale-[1.01] active:scale-98 transition-all cursor-pointer"
                >
                  {paymentMethod === "payhere" ? "Pay via PayHere Onsite" : t.payments.confirmAndPay} Rs. {parseFloat(selectedAmount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Processing */}
          {step === "processing" && (
            <div className="py-12 flex flex-col items-center justify-center animate-in fade-in duration-500">
              <Loader2 className="h-12 w-12 text-yellow-400 animate-spin mb-4" />
              <h3 className="text-lg sm:text-xl font-bold mb-2 text-center">{t.payments.creditingTitle}</h3>
              <p className="text-white/70 text-center text-xs sm:text-sm">{t.payments.creditingDesc}</p>
            </div>
          )}

          {/* STEP 4: Success */}
          {step === "success" && result && (
            <div className="animate-in zoom-in-95 duration-500">
              <div className="bg-black/20 rounded-2xl p-4 sm:p-6 border border-green-500/30">
                <div className="flex items-center justify-between gap-3 mb-5 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500/20 p-2 sm:p-2.5 rounded-full shrink-0">
                      <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8 text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg sm:text-xl text-green-400">{t.payments.successTitle}</h3>
                      <p className="text-xs sm:text-sm text-white/60">{t.payments.successDesc}</p>
                    </div>
                  </div>
                  <img src="/leco-logo.png" alt="LECO Self Care" className="hidden sm:block h-10 w-auto object-contain shrink-0" />
                </div>

                <div className="space-y-3 mb-5 border-b border-white/10 pb-5">
                  {selectedMeter && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-white/60">{t.addMeter.meterNumberLabel}</span>
                      <span className="font-mono text-white font-semibold">{selectedMeter.meter_number}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-white/60">{t.history.amountCol}</span>
                    <span className="font-medium text-white">Rs. {parseFloat(result.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-white/60">{t.history.previousBalance}</span>
                    <span className={`font-medium ${Number(result.prevBalance) < 0 ? 'text-amber-400 font-bold' : 'text-white/80'}`}>
                      Rs. {parseFloat(result.prevBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {result.debtRecovered && Number(result.debtRecovered) > 0 && (
                    <div className="flex justify-between text-xs text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      <span className="flex items-center gap-1">
                        <LifeBuoy className="h-3.5 w-3.5" /> {t.payments.debtNoticeTitle}
                      </span>
                      <span className="font-medium font-mono">
                        - Rs. {Number(result.debtRecovered).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {result.lifelineReplenished && (
                    <div className="flex justify-between text-xs text-green-300 bg-green-500/10 px-2.5 py-1.5 rounded border border-green-500/20">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t.overview.lifelineProtection}
                      </span>
                      <span>Rs. 500.00</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm sm:text-base pt-2 border-t border-white/10 items-baseline">
                    <span className="font-semibold text-white/80">{t.history.newBalance}</span>
                    <span className="font-bold text-xl sm:text-2xl text-yellow-400">
                      Rs. {parseFloat(result.newBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-6 text-xs sm:text-sm">
                  {result.gateway && (
                    <div className="bg-[#1a1a1a]/50 p-2.5 sm:p-3 rounded-xl flex justify-between items-center text-xs">
                      <span className="text-white/50">Payment Channel</span>
                      <span className="font-semibold text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> {result.gateway}
                      </span>
                    </div>
                  )}
                  <div className="bg-[#1a1a1a]/50 p-2.5 sm:p-3 rounded-xl flex justify-between items-center">
                    <span className="text-white/50">{t.history.transactionId}</span>
                    <span className="font-mono text-xs text-yellow-300 font-semibold">{result.txnId}</span>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 p-2.5 sm:p-3 rounded-xl flex justify-between items-center text-green-400 text-xs">
                    <span>{t.overview.meterStatus}</span>
                    <span className="font-medium flex items-center gap-1">
                      {t.addMeter.activeStatus} <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10 h-11 text-xs cursor-pointer"
                    onClick={() => {
                      setStep("amount");
                      setResult(null);
                      setAmount("1000");
                      setCustomAmount("");
                      setIdempotencyKey(crypto.randomUUID());
                    }}
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    {t.overview.rechargeNow}
                  </Button>
                  {onNavigateHistory && (
                    <Button
                      variant="outline"
                      onClick={onNavigateHistory}
                      className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/15 h-11 text-xs cursor-pointer"
                    >
                      {t.payments.viewReceiptHistory}
                    </Button>
                  )}
                  {onNavigateOverview && (
                    <Button
                      onClick={onNavigateOverview}
                      className="flex-1 bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg flex items-center justify-center gap-1.5 h-11 text-xs cursor-pointer"
                    >
                      {t.payments.backToOverview}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="text-center py-10 animate-in zoom-in-95 duration-500">
              <div className="mx-auto w-16 h-16 bg-red-500/20 text-red-400 flex items-center justify-center rounded-full mb-4">
                <Zap className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">{t.payments.paymentFailed}</h3>
              <p className="text-white/70 mb-6">{errorMsg}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button onClick={() => setStep("amount")} variant="outline" className="w-full sm:w-auto bg-transparent border-white/20 text-white hover:bg-white/10 cursor-pointer">
                  {t.addMeter.tryAgain}
                </Button>
                <Button 
                  onClick={() => {
                    setPaymentMethod("card")
                    setStep("payment")
                  }}
                  className="w-full sm:w-auto bg-yellow-400 text-black hover:bg-yellow-500 font-bold cursor-pointer"
                >
                  Choose Alternative Channel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
