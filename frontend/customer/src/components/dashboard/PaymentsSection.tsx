import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { CreditCard, Smartphone, CheckCircle2, Loader2, ArrowRight, Zap, ArrowLeft, RefreshCw } from "lucide-react"

interface RechargeResult {
  prevBalance: string
  newBalance: string
  amount: string
  txnId: string
}

interface Meter {
  id: number
  meter_number: string
  account_number: string
  balance: string | number
  status: string
  name?: string
}

interface PaymentsSectionProps {
  onSuccess?: () => void
  onNavigateOverview?: () => void
  onNavigateHistory?: () => void
}

export default function PaymentsSection({ onSuccess, onNavigateOverview, onNavigateHistory }: PaymentsSectionProps) {
  const [step, setStep] = useState<"amount" | "payment" | "processing" | "success" | "error">("amount")
  const [amount, setAmount] = useState("1000")
  const [customAmount, setCustomAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("card")
  const [result, setResult] = useState<RechargeResult | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [meters, setMeters] = useState<Meter[]>([])
  const [selectedMeterId, setSelectedMeterId] = useState<number | null>(null)
  const [loadingMeter, setLoadingMeter] = useState(true)

  // Fetch user meters
  useEffect(() => {
    const fetchMeters = async () => {
      try {
        const token = localStorage.getItem("token")
        const res = await fetch("http://localhost:3000/api/meters", {
          headers: { Authorization: `Bearer ${token}` },
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
    setStep("processing")
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`http://localhost:3000/api/meters/${selectedMeterId}/recharge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: parseFloat(selectedAmount), paymentMethod }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        setStep("success")
        // Notify parent so overview balances update in background
        onSuccess?.()
      } else {
        setErrorMsg(data.message || "Payment failed")
        setStep("error")
      }
    } catch (e) {
      setErrorMsg("Network error. Please try again.")
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
          <h3 className="text-xl font-semibold text-white mb-2">No Meter Connected</h3>
          <p className="text-white/50 text-sm max-w-xs">
            You need to add a smart meter before you can recharge. Go to <strong className="text-white/70">Add Meter</strong> first.
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
              <CardTitle>Recharge Prepaid Meter</CardTitle>
              <CardDescription className="text-white/70">
                Top up your meter credit instantly via card, wallet, or bank transfer.
              </CardDescription>
            </div>
            {onNavigateOverview && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateOverview}
                className="text-white/60 hover:text-white hover:bg-white/10 text-xs"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back to Overview
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Active Meter Display / Selector */}
          {selectedMeter && step !== "success" && (
            <div className="mb-6 p-4 rounded-xl bg-black/30 border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">Target Smart Meter</div>
                <div className="font-medium text-white flex items-center gap-2 mt-0.5">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="font-mono text-sm">{selectedMeter.meter_number}</span>
                  {selectedMeter.name && <span className="text-xs text-white/60">({selectedMeter.name})</span>}
                </div>
              </div>
              <div className="sm:text-right">
                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">Current Balance</div>
                <div className="text-lg font-bold text-yellow-400">
                  Rs. {Number(selectedMeter.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}

          {/* Multiple Meters Selector if user has > 1 */}
          {meters.length > 1 && step === "amount" && (
            <div className="mb-6 space-y-2">
              <Label className="text-white text-sm">Select Meter to Recharge</Label>
              <div className="grid grid-cols-2 gap-2">
                {meters.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMeterId(m.id)}
                    className={`p-3 rounded-lg border text-left text-xs transition-all ${
                      selectedMeterId === m.id
                        ? "bg-yellow-400/10 border-yellow-400 text-white font-medium"
                        : "bg-black/20 border-white/10 text-white/70 hover:bg-black/40"
                    }`}
                  >
                    <div className="font-mono">{m.meter_number}</div>
                    <div className="text-white/50 mt-1">Rs. {Number(m.balance).toFixed(2)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1: Choose Amount */}
          {step === "amount" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-4">
                <Label className="text-white">Choose Recharge Amount</Label>
                <div className="grid grid-cols-2 gap-4">
                  {["500", "1000", "2000", "5000"].map((val) => (
                    <div
                      key={val}
                      onClick={() => { setAmount(val); setCustomAmount("") }}
                      className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${
                        amount === val
                          ? "bg-yellow-400 border-yellow-400 text-black font-bold shadow-[0_0_15px_rgba(250,204,21,0.5)] scale-[1.02]"
                          : "bg-black/20 border-white/20 text-white hover:bg-black/40"
                      }`}
                    >
                      Rs. {val}
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <Label className="text-white/80 mb-2 block">Or Enter Custom Amount</Label>
                  <div
                    onClick={() => setAmount("custom")}
                    className={`flex items-center p-1 rounded-xl border transition-all ${
                      amount === "custom"
                        ? "bg-black/40 border-yellow-400 ring-1 ring-yellow-400"
                        : "bg-black/20 border-white/20 hover:bg-black/40"
                    }`}
                  >
                    <span className="pl-4 text-white/60">Rs.</span>
                    <Input
                      type="number"
                      placeholder="e.g. 1500"
                      className="border-0 bg-transparent text-white focus-visible:ring-0 shadow-none text-lg"
                      value={customAmount}
                      onChange={(e) => { setAmount("custom"); setCustomAmount(e.target.value) }}
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setStep("payment")}
                className="w-full bg-white text-[#992511] hover:bg-white/90 font-bold mt-4 shadow-lg text-lg h-12 hover:scale-[1.02] transition-transform"
                disabled={amount === "custom" && (!customAmount || parseInt(customAmount) < 100)}
              >
                Continue to Payment
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* STEP 2: Payment Method */}
          {step === "payment" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="p-4 bg-black/20 rounded-xl border border-white/10 flex justify-between items-center">
                <span className="text-white/80">Total to Pay</span>
                <span className="text-2xl font-bold text-yellow-400">Rs. {parseFloat(selectedAmount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="space-y-4">
                <Label className="text-white">Payment Method</Label>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid gap-3">
                  {[
                    { value: "card", icon: <CreditCard className="h-5 w-5 text-yellow-400" />, label: "Credit / Debit Card (Visa, Mastercard)" },
                    { value: "wallet", icon: <Smartphone className="h-5 w-5 text-yellow-400" />, label: "Mobile Wallet / QR Payment" },
                    { value: "bank", icon: <span className="font-serif font-bold text-lg px-1 text-yellow-400">B</span>, label: "Online Bank Transfer" },
                  ].map(({ value, icon, label }) => (
                    <div
                      key={value}
                      onClick={() => setPaymentMethod(value)}
                      className={`flex items-center space-x-2 border p-4 rounded-xl cursor-pointer transition-all ${
                        paymentMethod === value
                          ? "border-yellow-400/60 bg-yellow-400/10"
                          : "border-white/20 bg-black/20 hover:bg-black/40"
                      }`}
                    >
                      <RadioGroupItem value={value} id={value} className="border-white/50 text-yellow-400" />
                      <Label htmlFor={value} className="flex flex-1 items-center gap-2 cursor-pointer text-sm">
                        {icon}
                        {label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="w-1/3 bg-transparent border-white/20 text-white hover:bg-white/10" onClick={() => setStep("amount")}>
                  Back
                </Button>
                <Button onClick={handlePay} className="flex-1 bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg h-10 hover:scale-[1.02] transition-transform">
                  Confirm & Pay Rs. {parseFloat(selectedAmount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Processing */}
          {step === "processing" && (
            <div className="py-12 flex flex-col items-center justify-center animate-in fade-in duration-500">
              <Loader2 className="h-12 w-12 text-yellow-400 animate-spin mb-4" />
              <h3 className="text-xl font-bold mb-2">Crediting Your Smart Meter...</h3>
              <p className="text-white/70 text-center">Contacting payment gateway. Please wait a moment.</p>
            </div>
          )}

          {/* STEP 4: Success */}
          {step === "success" && result && (
            <div className="animate-in zoom-in-95 duration-500">
              <div className="bg-black/20 rounded-xl p-6 border border-green-500/30">
                <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                  <div className="bg-green-500/20 p-2 rounded-full">
                    <CheckCircle2 className="h-8 w-8 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-green-400">Recharge Successful!</h3>
                    <p className="text-sm text-white/60">Your meter has been credited immediately</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6 border-b border-white/10 pb-6">
                  {selectedMeter && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Meter Number</span>
                      <span className="font-mono text-white">{selectedMeter.meter_number}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Amount Added</span>
                    <span className="font-medium text-white">Rs. {parseFloat(result.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Previous Balance</span>
                    <span className="font-medium text-white/80">Rs. {parseFloat(result.prevBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-400">
                    <span className="text-green-400/80">Recharge Credited</span>
                    <span className="font-medium">+ Rs. {parseFloat(result.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-base pt-2 border-t border-white/10">
                    <span className="font-semibold text-white/80">New Available Balance</span>
                    <span className="font-bold text-2xl text-yellow-400">
                      Rs. {parseFloat(result.newBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-[#1a1a1a]/50 p-3 rounded-lg flex justify-between items-center text-sm">
                    <span className="text-white/50">Transaction ID</span>
                    <span className="font-mono text-xs text-white/80">{result.txnId}</span>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg flex justify-between items-center text-sm text-green-400">
                    <span>Meter Status</span>
                    <span className="font-medium flex items-center gap-1">
                      Updated & Active <CheckCircle2 className="h-4 w-4" />
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10"
                    onClick={() => { setStep("amount"); setResult(null); setAmount("1000"); setCustomAmount("") }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    New Recharge
                  </Button>
                  {onNavigateHistory && (
                    <Button
                      variant="outline"
                      onClick={onNavigateHistory}
                      className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/15"
                    >
                      Payment History
                    </Button>
                  )}
                  {onNavigateOverview && (
                    <Button
                      onClick={onNavigateOverview}
                      className="flex-1 bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                    >
                      View in Overview
                      <ArrowRight className="h-4 w-4" />
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
              <h3 className="text-xl font-bold mb-2">Payment Failed</h3>
              <p className="text-white/70 mb-6">{errorMsg}</p>
              <Button onClick={() => setStep("amount")} variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/10">
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
