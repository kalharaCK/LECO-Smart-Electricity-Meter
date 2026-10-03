import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, Activity, ShieldCheck, CheckCircle2, Loader2, Zap } from "lucide-react"

export default function AddMeterSection({
  onMeterAdded,
  onNavigateOverview,
}: {
  onMeterAdded?: () => void
  onNavigateOverview?: () => void
}) {
  const [step, setStep] = useState<"search" | "found" | "added" | "error">("search")
  const [meterData, setMeterData] = useState({ meterNumber: "", accountNumber: "", pin: "" })
  const [errorMessage, setErrorMessage] = useState("")
  const [meters, setMeters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMeters = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3000/api/meters", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMeters(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMeters();
  }, [])

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    // Local check passes, simulate found
    setStep("found")
  }

  const handleAdd = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3000/api/meters/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(meterData)
      });
      
      const data = await res.json();
      if (res.ok) {
        setStep("added");
        fetchMeters(); // Refresh the list
        // Notify parent so Overview refreshes
        onMeterAdded?.();
      } else {
        setErrorMessage(data.message || "Failed to add meter");
        setStep("error");
      }
    } catch (e) {
      setErrorMessage("Network error connecting to server");
      setStep("error");
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Card className="bg-gradient-to-br from-[#992511] to-[#3a0b04] border-0 shadow-xl text-white">
        <CardHeader>
          <CardTitle>Add Existing Smart Meter</CardTitle>
          <CardDescription className="text-white/70">
            Link a smart meter to your account to monitor consumption and recharge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "search" && (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="meterNumber" className="text-sm font-medium text-white/90">Meter Number</label>
                <Input 
                  id="meterNumber" 
                  placeholder="e.g. 123456789" 
                  className="bg-black/20 border-white/10 text-white" 
                  value={meterData.meterNumber}
                  onChange={e => setMeterData({...meterData, meterNumber: e.target.value})}
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="accountNumber" className="text-sm font-medium text-white/90">Account Number</label>
                <Input 
                  id="accountNumber" 
                  placeholder="e.g. 1234567890" 
                  className="bg-black/20 border-white/10 text-white" 
                  value={meterData.accountNumber}
                  onChange={e => setMeterData({...meterData, accountNumber: e.target.value})}
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="pin" className="text-sm font-medium text-white/90">Meter PIN / Verification Code</label>
                <Input 
                  id="pin" 
                  type="password" 
                  placeholder="******" 
                  className="bg-black/20 border-white/10 text-white" 
                  value={meterData.pin}
                  onChange={e => setMeterData({...meterData, pin: e.target.value})}
                  required 
                />
              </div>
              <Button type="submit" className="w-full bg-white text-[#992511] hover:bg-white/90 font-bold mt-4 shadow-lg hover:scale-[1.02] transition-transform">
                <Search className="mr-2 h-4 w-4" />
                Verify Meter
              </Button>
            </form>
          )}

          {step === "found" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-black/20 rounded-xl p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-green-500/20 p-2 rounded-full">
                    <CheckCircle2 className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Meter Found</h3>
                    <p className="text-sm text-white/60">Verification successful</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <ShieldCheck className="h-4 w-4 text-white/50" />
                    <span className="text-white/60 w-24">Meter No:</span>
                    <span className="font-mono font-medium">{meterData.meterNumber}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-white/50" />
                    <span className="text-white/60 w-24">Location:</span>
                    <span className="font-medium">Galle</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Activity className="h-4 w-4 text-white/50" />
                    <span className="text-white/60 w-24">Connection:</span>
                    <Badge className="bg-green-500/20 text-green-400 border-0">Active</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Zap className="h-4 w-4 text-white/50" />
                    <span className="text-white/60 w-24">Tariff:</span>
                    <span className="font-medium">Domestic</span>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <Button variant="outline" className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10" onClick={() => setStep("search")}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg" onClick={handleAdd}>
                    Add Meter
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === "added" && (
            <div className="text-center py-8 animate-in zoom-in-95 duration-500">
              <div className="mx-auto w-16 h-16 bg-green-500/20 text-green-400 flex items-center justify-center rounded-full mb-4">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Meter Added Successfully!</h3>
              <p className="text-white/70 mb-6">Meter <span className="font-mono font-bold text-yellow-400">{meterData.meterNumber}</span> has been linked to your account.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => { setStep("search"); setMeterData({ meterNumber: "", accountNumber: "", pin: "" }) }} variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/10">
                  Add Another Meter
                </Button>
                {onNavigateOverview && (
                  <Button
                    onClick={onNavigateOverview}
                    className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg"
                  >
                    View in Overview
                  </Button>
                )}
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-8 animate-in zoom-in-95 duration-500">
              <div className="mx-auto w-16 h-16 bg-red-500/20 text-red-400 flex items-center justify-center rounded-full mb-4">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Error Adding Meter</h3>
              <p className="text-white/70 mb-6">{errorMessage}</p>
              <Button onClick={() => setStep("search")} variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/10">
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Existing Meters (Multiple Meters Example) */}
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-white/10 shadow-xl text-white">
        <CardHeader>
          <CardTitle>My Meters</CardTitle>
          <CardDescription className="text-white/60">Switch between your linked meters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-yellow-400" /></div>
          ) : meters.length === 0 ? (
            <p className="text-sm text-white/50 text-center py-4">No meters added yet.</p>
          ) : (
            meters.map((meter, idx) => (
              <div key={meter.id} className={`p-4 rounded-lg border cursor-pointer transition-colors ${idx === 0 ? 'bg-[#992511]/20 border-[#992511]/50 hover:bg-[#992511]/30' : 'bg-black/40 border-white/5 hover:bg-white/5'}`}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="font-medium">{meter.name || "Meter " + (idx + 1)}</span>
                  </div>
                  {idx === 0 && <span className="text-xs bg-[#992511] px-2 py-0.5 rounded text-white font-medium">Active</span>}
                </div>
                <div className="flex justify-between items-center text-sm text-white/60">
                  <span>Meter: {meter.meter_number}</span>
                  <span className="text-white font-medium">Bal: Rs. {Number(meter.balance).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
