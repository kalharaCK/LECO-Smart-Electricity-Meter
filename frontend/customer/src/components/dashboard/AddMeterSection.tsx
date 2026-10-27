import { API_BASE_URL } from "@/lib/api"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, Activity, ShieldCheck, CheckCircle2, Loader2, Zap, Eye, EyeOff } from "lucide-react"
import { useDashboardI18n } from "@/lib/dashboardI18n"

export default function AddMeterSection({
  onMeterAdded,
  onNavigateOverview,
}: {
  onMeterAdded?: () => void
  onNavigateOverview?: () => void
}) {
  const { t } = useDashboardI18n()
  const [step, setStep] = useState<"search" | "found" | "added" | "error">("search")
  const [meterData, setMeterData] = useState({ meterNumber: "", accountNumber: "", pin: "" })
  const [errorMessage, setErrorMessage] = useState("")
  const [meters, setMeters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showPin, setShowPin] = useState(false)

  const fetchMeters = async () => {
    try {
      const headers: Record<string, string> = {}

      const res = await fetch(`${API_BASE_URL}/api/meters`, {
        credentials: "include",
        headers
      })
      if (res.ok) {
        const data = await res.json()
        setMeters(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeters()
  }, [])

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    setStep("found")
  }

  const handleAdd = async () => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }

      const res = await fetch(`${API_BASE_URL}/api/meters/add`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(meterData)
      })
      
      const data = await res.json()
      if (res.ok) {
        setStep("added")
        fetchMeters()
        onMeterAdded?.()
      } else {
        setErrorMessage(data.message || t.addMeter.errorAddingMeter)
        setStep("error")
      }
    } catch (e) {
      console.error(e)
      setErrorMessage(t.payments.networkError)
      setStep("error")
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl w-full mx-auto">
      <Card className="bg-gradient-to-br from-[#992511] to-[#3a0b04] border-0 shadow-xl text-white">
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
          <CardTitle className="text-lg sm:text-xl font-bold">{t.addMeter.title}</CardTitle>
          <CardDescription className="text-white/70 text-xs sm:text-sm">
            {t.addMeter.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2 sm:pt-2">
          {step === "search" && (
            <form onSubmit={handleVerify} className="space-y-4 sm:space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="meterNumber" className="text-xs sm:text-sm font-medium text-white/90">
                  {t.addMeter.meterNumberLabel}
                </label>
                <Input 
                  id="meterNumber" 
                  placeholder={t.addMeter.meterNumberPlaceholder} 
                  className="bg-black/25 border-white/15 text-white h-11 text-sm focus-visible:ring-yellow-400" 
                  value={meterData.meterNumber}
                  onChange={e => setMeterData({...meterData, meterNumber: e.target.value})}
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="accountNumber" className="text-xs sm:text-sm font-medium text-white/90">
                  {t.addMeter.accountNumberLabel}
                </label>
                <Input 
                  id="accountNumber" 
                  placeholder={t.addMeter.accountNumberPlaceholder} 
                  className="bg-black/25 border-white/15 text-white h-11 text-sm focus-visible:ring-yellow-400" 
                  value={meterData.accountNumber}
                  onChange={e => setMeterData({...meterData, accountNumber: e.target.value})}
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="pin" className="text-xs sm:text-sm font-medium text-white/90">
                  {t.addMeter.pinLabel}
                </label>
                <div className="relative">
                  <Input 
                    id="pin" 
                    type={showPin ? "text" : "password"} 
                    placeholder={t.addMeter.pinPlaceholder} 
                    className="bg-black/25 border-white/15 text-white h-11 text-sm focus-visible:ring-yellow-400 pr-10" 
                    value={meterData.pin}
                    onChange={e => setMeterData({...meterData, pin: e.target.value})}
                    required 
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1"
                    aria-label={showPin ? "Hide PIN" : "Show PIN"}
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-white text-[#992511] hover:bg-white/90 font-bold h-11 text-sm mt-3 sm:mt-4 shadow-lg hover:scale-[1.01] transition-transform cursor-pointer">
                <Search className="mr-2 h-4 w-4" />
                {t.addMeter.verifyBtn}
              </Button>
            </form>
          )}

          {step === "found" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-black/30 rounded-xl p-4 sm:p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="bg-green-500/20 p-2.5 rounded-full shrink-0">
                    <CheckCircle2 className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg">{t.addMeter.meterFound}</h3>
                    <p className="text-xs sm:text-sm text-white/60">{t.addMeter.verificationSuccess}</p>
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4 bg-black/20 p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between sm:justify-start gap-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-white/60 sm:w-28">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      <span>{t.addMeter.meterNumberLabel}:</span>
                    </div>
                    <span className="font-mono font-bold text-yellow-400">{meterData.meterNumber}</span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start gap-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-white/60 sm:w-28">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>{t.addMeter.locationLabel}:</span>
                    </div>
                    <span className="font-medium">LECO Customer Area</span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start gap-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-white/60 sm:w-28">
                      <Activity className="h-4 w-4 shrink-0" />
                      <span>{t.addMeter.connectionLabel}:</span>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400 border-0 text-[10px] sm:text-xs">{t.addMeter.activeStatus}</Badge>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start gap-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 text-white/60 sm:w-28">
                      <Zap className="h-4 w-4 shrink-0" />
                      <span>{t.addMeter.tariffLabel}:</span>
                    </div>
                    <span className="font-medium">{t.addMeter.domesticTariff}</span>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 mt-6">
                  <Button variant="outline" className="w-full sm:flex-1 h-11 bg-transparent border-white/20 text-white hover:bg-white/10 cursor-pointer" onClick={() => setStep("search")}>
                    {t.addMeter.cancelBtn}
                  </Button>
                  <Button className="w-full sm:flex-1 h-11 bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg cursor-pointer" onClick={handleAdd}>
                    {t.addMeter.addMeterBtn}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === "added" && (
            <div className="text-center py-6 sm:py-8 animate-in zoom-in-95 duration-500">
              <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-green-500/20 text-green-400 flex items-center justify-center rounded-full mb-4">
                <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2">{t.addMeter.meterAddedSuccess}</h3>
              <p className="text-white/70 text-xs sm:text-sm mb-6 max-w-sm mx-auto">
                {t.addMeter.meterNumberLabel} <span className="font-mono font-bold text-yellow-400">{meterData.meterNumber}</span> {t.addMeter.meterLinkedDesc}
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center w-full max-w-xs mx-auto">
                <Button onClick={() => { setStep("search"); setMeterData({ meterNumber: "", accountNumber: "", pin: "" }) }} variant="outline" className="w-full sm:w-auto h-11 bg-transparent border-white/20 text-white hover:bg-white/10 cursor-pointer">
                  {t.addMeter.addAnotherMeter}
                </Button>
                {onNavigateOverview && (
                  <Button
                    onClick={onNavigateOverview}
                    className="w-full sm:w-auto h-11 bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg cursor-pointer"
                  >
                    {t.addMeter.viewInOverview}
                  </Button>
                )}
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-6 sm:py-8 animate-in zoom-in-95 duration-500">
              <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-red-500/20 text-red-400 flex items-center justify-center rounded-full mb-4">
                <ShieldCheck className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2">{t.addMeter.errorAddingMeter}</h3>
              <p className="text-white/70 text-xs sm:text-sm mb-6 max-w-sm mx-auto">{errorMessage}</p>
              <Button onClick={() => setStep("search")} variant="outline" className="h-11 px-6 bg-transparent border-white/20 text-white hover:bg-white/10 cursor-pointer">
                {t.addMeter.tryAgain}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Existing Linked Meters List */}
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-white/10 shadow-xl text-white">
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg font-bold">{t.addMeter.myLinkedMeters}</CardTitle>
          <CardDescription className="text-white/60 text-xs sm:text-sm">{t.addMeter.manageMetersDesc}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2 sm:pt-2 space-y-3">
          {loading ? (
            <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-yellow-400" /></div>
          ) : meters.length === 0 ? (
            <p className="text-xs sm:text-sm text-white/50 text-center py-4">{t.addMeter.noMetersYet}</p>
          ) : (
            meters.map((meter, idx) => (
              <div key={meter.id} className={`p-3.5 sm:p-4 rounded-xl border transition-all ${idx === 0 ? 'bg-[#992511]/20 border-[#992511]/50' : 'bg-black/40 border-white/5'}`}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                    <span className="font-semibold text-xs sm:text-sm">{meter.name || "Meter " + (idx + 1)}</span>
                  </div>
                  {idx === 0 && <span className="text-[10px] sm:text-xs bg-[#992511] px-2 py-0.5 rounded-full text-white font-medium">{t.addMeter.activeDefault}</span>}
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-xs text-white/60">
                  <span className="font-mono">{t.addMeter.meterNumberLabel}: {meter.meter_number}</span>
                  <span className="text-white font-bold text-xs sm:text-sm">{t.addMeter.balancePrefix}: Rs. {Number(meter.balance).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
