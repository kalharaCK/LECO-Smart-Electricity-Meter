import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Battery, Zap, AlertTriangle, Activity, Clock, History as HistoryIcon, Loader2, TrendingUp, Sparkles, LifeBuoy, HeartPulse, CheckCircle2, Flame, Sliders, RotateCcw, ChevronDown, ChevronUp, Play, ArrowDownRight, Wifi, Calendar, Receipt } from "lucide-react"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { getSocket } from "@/lib/socket"
import { useDashboardI18n } from "@/lib/dashboardI18n"

export default function OverviewSection({ refreshKey, onNavigate }: { refreshKey?: number; onNavigate?: (section: string) => void }) {
  const { t } = useDashboardI18n()
  const [meter, setMeter] = useState<any>(null)
  const [consumption, setConsumption] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activatingEmergency, setActivatingEmergency] = useState(false)
  const [emergencySuccessMsg, setEmergencySuccessMsg] = useState<string | null>(null)
  const [settlingCycle, setSettlingCycle] = useState(false)
  const [settleSuccessMsg, setSettleSuccessMsg] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [simulationLog, setSimulationLog] = useState<string | null>(null)
  const [customKwh, setCustomKwh] = useState("2.5")
  const [showSimulator, setShowSimulator] = useState(true)

  const activeMeterIdRef = useRef<number | null>(null);

  const user = JSON.parse(localStorage.getItem('user') || '{"email": "User"}')

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Non-blocking fetch: Only sets loading spinner on initial load or manual reload
  const fetchMetersData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/meters', { credentials: 'include' });

      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const firstMeter = data[0];
          activeMeterIdRef.current = firstMeter.id;
          setMeter((prev: any) => ({ ...(prev || {}), ...firstMeter }));
          
          // Fetch consumption stats for this meter
          const consRes = await fetch(`http://localhost:3000/api/meters/${firstMeter.id}/consumption`, {
            credentials: 'include'
          });
          if (consRes.ok) {
            setConsumption(await consRes.json());
          }
          // Fetch notifications
          const notifRes = await fetch("http://localhost:3000/api/notifications", {
            credentials: 'include'
          });
          if (notifRes.ok) {
            setNotifications(await notifRes.json());
          }
        } else {
          setMeter(null);
        }
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetersData(true);

    // Continuous REST API background polling (10-second cadence) ensures uninterrupted telemetry sync
    const pollInterval = setInterval(() => {
      fetchMetersData(false);
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [fetchMetersData, refreshKey]);

  // Optional real-time socket listener (complements continuous REST polling)
  useEffect(() => {
    const socket = getSocket();

    if (meter?.id) {
      socket.emit('join_meter', meter.id);
    }

    const handleMeterUpdate = (payload: any) => {
      if (!payload || (meter?.id && payload.meterId !== meter.id)) return;

      // SURGICAL UPDATE 1: Meter Balance & Status
      setMeter((prev: any) => prev ? {
        ...prev,
        balance: payload.balance ?? prev.balance,
        status: payload.status ?? prev.status,
        emergency_credit_active: payload.emergency_credit_active ?? prev.emergency_credit_active,
        emergency_credit_limit: payload.emergency_credit_limit ?? prev.emergency_credit_limit,
      } : prev);

      // SURGICAL UPDATE 2: Consumption & Chart Data
      setConsumption((prev: any) => {
        if (!prev) return payload;
        return {
          ...prev,
          today: payload.today ?? prev.today,
          exportToday: payload.exportToday ?? prev.exportToday,
          yesterday: payload.yesterday ?? prev.yesterday,
          exportYesterday: payload.exportYesterday ?? prev.exportYesterday,
          thisWeek: payload.thisWeek ?? prev.thisWeek,
          exportThisWeek: payload.exportThisWeek ?? prev.exportThisWeek,
          currentPower: payload.currentPower ?? prev.currentPower,
          currentExport: payload.currentExport ?? prev.currentExport,
          prediction: payload.prediction ?? prev.prediction,
          chartData: payload.chartData ?? prev.chartData
        };
      });
    };

    socket.on('meter_update', handleMeterUpdate);

    return () => {
      socket.off('meter_update', handleMeterUpdate);
      if (meter?.id) {
        socket.emit('leave_meter', meter.id);
      }
    };
  }, [meter?.id]);

  const handleActivateEmergency = async () => {
    if (!meter) return;
    setActivatingEmergency(true);
    setEmergencySuccessMsg(null);
    try {
      const res = await fetch(`http://localhost:3000/api/meters/${meter.id}/emergency-credit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setEmergencySuccessMsg(data.message || 'Emergency Credit activated! Power will remain connected.');
        // State is updated automatically via WebSocket broadcast from backend
      } else {
        alert(data.message || 'Failed to activate emergency credit');
      }
    } catch (e) {
      alert('Network error while activating emergency credit.');
    } finally {
      setActivatingEmergency(false);
    }
  };

  const handleSimulate = async (kwhAmount: number) => {
    if (!meter) return;
    setSimulating(true);
    setSimulationLog(null);
    try {
      const res = await fetch(`http://localhost:3000/api/meters/${meter.id}/simulate-consumption`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kwh: kwhAmount })
      });
      const data = await res.json();
      if (res.ok) {
        setSimulationLog(`⚡ Recorded +${data.kwhAdded} kWh. Accrued Month Bill: Rs. ${Number(data.currentMonthBill || 0).toFixed(2)} (${data.tariffGroup || 'PUCSL'}). Prepaid Balance retained at Rs. ${Number(data.prepaidBalance || meter.balance).toFixed(2)}.`);
        // Backend already emitted 'meter_update' via WebSocket; apply surgical fallback if needed
        if (data.livePayload) {
          setMeter((prev: any) => prev ? {
            ...prev,
            balance: data.livePayload.balance,
            status: data.livePayload.status,
            emergency_credit_active: data.livePayload.emergency_credit_active
          } : prev);
          setConsumption((prev: any) => prev ? {
            ...prev,
            today: data.livePayload.today,
            thisWeek: data.livePayload.thisWeek,
            prediction: data.livePayload.prediction,
            chartData: data.livePayload.chartData
          } : prev);
        }
      } else {
        alert(data.message || 'Simulation failed');
      }
    } catch (e) {
      alert('Network error during consumption simulation.');
    } finally {
      setSimulating(false);
    }
  };

  const handleSettleCycle = async () => {
    if (!meter) return;
    const confirmSettle = window.confirm(
      `Trigger Month-End Settlement for meter ${meter.meter_number}?\n\nThis will compute the official PUCSL monthly tariff bill and deduct it from your prepaid balance.`
    );
    if (!confirmSettle) return;

    setSettlingCycle(true);
    setSettleSuccessMsg(null);
    try {
      const res = await fetch(`http://localhost:3000/api/meters/${meter.id}/settle-cycle`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setSettleSuccessMsg(`✅ Month-End Cycle (${data.cycle}) settled: Rs. ${Number(data.bill?.totalCharge || 0).toFixed(2)} deducted for ${Number(data.netKwh || 0).toFixed(1)} kWh (${data.bill?.tariffGroup || 'PUCSL'}). New Prepaid Balance: Rs. ${Number(data.newBalance).toFixed(2)}.`);
        fetchMetersData(false);
      } else {
        alert(data.message || 'Cycle settlement failed');
      }
    } catch (e) {
      alert('Network error during cycle settlement.');
    } finally {
      setSettlingCycle(false);
    }
  };

  const handleSetBalance = async (targetBalance: number) => {
    if (!meter) return;
    setSimulating(true);
    setSimulationLog(null);
    try {
      const res = await fetch(`http://localhost:3000/api/meters/${meter.id}/set-balance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: targetBalance })
      });
      const data = await res.json();
      if (res.ok) {
        setSimulationLog(`🎯 Balance updated directly to Rs. ${Number(data.newBalance).toFixed(2)}. Status: ${data.status}.`);
        // Instant surgical update without reloading
        setMeter((prev: any) => prev ? {
          ...prev,
          balance: data.newBalance,
          status: data.status
        } : prev);
      } else {
        alert(data.message || 'Failed to set balance');
      }
    } catch (e) {
      alert('Network error updating balance.');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-yellow-400" /></div>
  }

  if (!meter) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="bg-white/5 p-6 rounded-full">
          <Zap className="h-12 w-12 text-white/30" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">No Meters Connected</h3>
          <p className="text-white/50 text-sm max-w-xs">You haven't added a smart meter yet. Go to <strong className="text-white/70">Add Meter</strong> to link your first meter and start monitoring your usage.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Welcome & Live Status Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 sm:gap-4 mb-1">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, <span className="text-[#ff6b52]">{user.email.split('@')[0]}</span>
            </h2>
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-mono text-green-400 bg-green-500/10 border-green-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <Wifi className="h-3 w-3 ml-0.5" />
              <span>REST Cloud Synced</span>
            </div>
          </div>
          <p className="text-white/60 text-xs sm:text-sm mt-1">
            {currentTime.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            <span className="mx-2">•</span>
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <Button
          onClick={() => onNavigate?.("payments")}
          className="w-full sm:w-auto bg-[#992511] hover:bg-[#992511]/80 text-white shadow-lg transition-transform hover:scale-105 font-bold h-10 text-xs sm:text-sm cursor-pointer"
        >
          Quick Recharge Now
        </Button>
      </div>

      {/* Interactive Consumption & Balance Simulator Bar */}
      <Card className="bg-gradient-to-r from-[#141416] via-[#1a1829] to-[#121217] border border-yellow-500/25 shadow-2xl text-white rounded-2xl overflow-hidden">
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-yellow-500/10 via-red-500/10 to-transparent flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-yellow-400/20 text-yellow-300 rounded-lg border border-yellow-400/30 shrink-0">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs sm:text-sm text-white">{t.overview.simulatorTitle}</span>
                <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/40 text-[10px] py-0 px-1.5 font-mono">
                  {t.overview.testSandbox}
                </Badge>
              </div>
              <p className="text-[10px] sm:text-[11px] text-white/50 line-clamp-1 sm:line-clamp-none">
                {t.overview.simulatorDesc}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSimulator(!showSimulator)}
            className="text-white/60 hover:text-white hover:bg-white/10 text-xs gap-1 shrink-0 cursor-pointer"
          >
            {showSimulator ? (
              <>{t.overview.hide} <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>{t.overview.expand} <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </Button>
        </div>

        {showSimulator && (
          <CardContent className="p-3.5 sm:p-4 space-y-3">
            {/* Quick Consumption Buttons */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4">
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <span className="text-xs font-semibold text-white/70 flex items-center gap-1 mr-1">
                  <Flame className="h-3.5 w-3.5 text-amber-400" /> Usage:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <Button
                    size="sm"
                    disabled={simulating}
                    onClick={() => handleSimulate(1)}
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/10 text-xs h-8 hover:scale-105 transition-all cursor-pointer"
                  >
                    +1 kWh
                  </Button>
                  <Button
                    size="sm"
                    disabled={simulating}
                    onClick={() => handleSimulate(5)}
                    className="bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border border-yellow-400/40 text-xs h-8 hover:scale-105 transition-all font-semibold cursor-pointer"
                  >
                    +5 kWh
                  </Button>
                  <Button
                    size="sm"
                    disabled={simulating}
                    onClick={() => handleSimulate(15)}
                    className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 text-xs h-8 hover:scale-105 transition-all font-semibold cursor-pointer"
                  >
                    +15 kWh
                  </Button>
                  
                  {/* Custom kWh input */}
                  <div className="flex items-center gap-1.5 ml-1">
                    <Input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={customKwh}
                      onChange={(e) => setCustomKwh(e.target.value)}
                      className="w-14 sm:w-16 h-8 text-xs bg-black/40 border-white/15 text-white focus-visible:ring-yellow-400/50"
                    />
                    <span className="text-xs text-white/60">kWh</span>
                    <Button
                      size="sm"
                      disabled={simulating || !customKwh || parseFloat(customKwh) <= 0}
                      onClick={() => handleSimulate(parseFloat(customKwh))}
                      className="bg-[#992511] hover:bg-[#992511]/80 text-white text-xs h-8 px-2.5 ml-1 cursor-pointer"
                    >
                      <Play className="h-3 w-3 mr-1" /> Log kWh
                    </Button>
                  </div>
                </div>
              </div>

              {/* Balance Jump Presets */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 border-t lg:border-t-0 lg:border-l border-white/10 pt-2 lg:pt-0 lg:pl-4 w-full lg:w-auto">
                <span className="text-xs font-semibold text-white/70 mr-1">
                  Preset:
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={simulating}
                  onClick={() => handleSetBalance(80)}
                  className="bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs h-8 cursor-pointer"
                  title="Simulates low balance (< Rs. 100)"
                >
                  Rs. 80 (Low)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={simulating}
                  onClick={() => handleSetBalance(-50)}
                  className="bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20 text-xs h-8 cursor-pointer"
                  title="Simulates negative balance"
                >
                  -Rs. 50 (Debt)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={simulating}
                  onClick={() => handleSetBalance(1500)}
                  className="bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20 text-xs h-8 cursor-pointer"
                  title="Resets balance to Rs. 1,500"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Rs. 1,500
                </Button>
              </div>
            </div>

            {/* Simulation Feedback Log */}
            {simulationLog && (
              <div className="p-2.5 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-yellow-200 text-xs flex items-center justify-between animate-in fade-in duration-300">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                  <span className="line-clamp-1">{simulationLog}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSimulationLog(null)}
                  className="text-yellow-400 hover:text-white hover:bg-yellow-400/20 text-[10px] h-6 px-1.5 cursor-pointer"
                >
                  Clear
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Success Notification for Emergency Credit */}
      {emergencySuccessMsg && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center justify-between text-green-300 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
            <span>{emergencySuccessMsg}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEmergencySuccessMsg(null)}
            className="text-green-300 hover:text-white hover:bg-green-500/20 text-xs cursor-pointer"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Lifeline Mode Active Card */}
      {meter?.emergency_credit_active && (
        <Card className="bg-gradient-to-r from-red-950/40 via-amber-950/30 to-black/60 border border-red-500/40 shadow-xl text-white p-4 sm:p-5 rounded-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 sm:p-3 bg-red-500/20 rounded-xl border border-red-500/30 text-red-400 shrink-0 mt-0.5">
                <LifeBuoy className="h-5 w-5 sm:h-6 sm:w-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-base sm:text-lg text-white">{t.overview.emergencyCreditActiveTitle}</h4>
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-xs animate-pulse">{t.overview.powerProtected}</Badge>
                </div>
                <p className="text-xs sm:text-sm text-white/70 mt-1 max-w-xl">
                  {t.overview.emergencyCreditActiveDesc}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-white/80">
                  <div className="bg-black/30 px-2.5 py-1 rounded-lg border border-white/10">
                    <span className="text-white/50">{t.overview.bufferUsed}: </span>
                    <span className="font-mono font-bold text-amber-300">
                      Rs. {consumption?.prediction ? Number(consumption.prediction.lifelineUsed).toFixed(2) : (Number(meter.balance) < 0 ? Math.abs(Number(meter.balance)).toFixed(2) : '0.00')}
                    </span>
                  </div>
                  <div className="bg-black/30 px-2.5 py-1 rounded-lg border border-white/10">
                    <span className="text-white/50">{t.overview.bufferLeft}: </span>
                    <span className="font-mono font-bold text-green-400">
                      Rs. {consumption?.prediction ? Number(consumption.prediction.lifelineRemaining).toFixed(2) : (500 - (Number(meter.balance) < 0 ? Math.abs(Number(meter.balance)) : 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={() => onNavigate?.("payments")}
              className="w-full sm:w-auto bg-amber-400 text-black hover:bg-amber-300 font-bold shrink-0 shadow-md transition-transform hover:scale-105 cursor-pointer text-xs sm:text-sm h-10"
            >
              {t.overview.rechargeClearDebt}
            </Button>
          </div>
        </Card>
      )}

      {/* Success Notification for Month-End Cycle Settlement */}
      {settleSuccessMsg && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-between text-yellow-300 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-yellow-400 shrink-0" />
            <span>{settleSuccessMsg}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSettleSuccessMsg(null)}
            className="text-yellow-300 hover:text-white hover:bg-yellow-400/20 text-xs cursor-pointer"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Low Balance Alert & Lifeline Mode Activation Offer */}
      {!meter?.emergency_credit_active && (
        Number(meter?.balance) <= 100 || (consumption?.prediction && Number(consumption.prediction.projectedNetBalance) <= 100)
      ) && (
        <Card className="bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-black/60 border border-yellow-500/30 shadow-lg text-white p-4 sm:p-5 rounded-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 sm:p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/30 text-yellow-400 shrink-0 mt-0.5">
                <HeartPulse className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-sm sm:text-base text-white">{t.overview.emergencyCreditAvailableTitle}</h4>
                  <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/30 text-xs">{t.overview.lifelineProtection}</Badge>
                </div>
                <p className="text-xs sm:text-sm text-white/70 mt-1 max-w-xl">
                  {t.overview.emergencyCreditAvailableDesc}
                </p>
              </div>
            </div>
            <Button
              onClick={handleActivateEmergency}
              disabled={activatingEmergency}
              className="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-300 text-black font-bold shrink-0 shadow-md transition-transform hover:scale-105 cursor-pointer text-xs sm:text-sm h-10"
            >
              {activatingEmergency ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t.overview.activating}
                </>
              ) : (
                <>
                  <LifeBuoy className="mr-2 h-4 w-4" /> {t.overview.activateCredit}
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Top Section - Balance and Quick Status */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Main Balance Card */}
        <Card className="bg-gradient-to-br from-[#992511] via-[#66180a] to-[#250602] border-0 shadow-2xl text-white lg:col-span-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-15 sm:opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none">
            <Zap size={110} />
          </div>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <CardTitle className="text-white/90 text-sm sm:text-base font-bold">{t.overview.availableBalance}</CardTitle>
                <span className="text-[10px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full font-mono uppercase">
                  {t.overview.prepaidWallet}
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {meter?.emergency_credit_active && (
                  <Badge className="bg-red-500/30 text-red-200 border-red-500/50 text-[10px] sm:text-[11px] font-normal flex items-center gap-1 animate-pulse">
                    <LifeBuoy className="h-3 w-3" />
                    {t.overview.lifelineActive}
                  </Badge>
                )}
                {consumption?.prediction && (
                  <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/30 text-[10px] sm:text-[11px] font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {consumption.prediction.currentTariffGroup}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              {/* Left Column: Primary Wallet Funds & Lifetime Forecast */}
              <div className="flex flex-col justify-between">
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <div className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight ${Number(meter?.balance) < 0 ? 'text-amber-300' : 'text-white'}`}>
                      {meter ? `Rs. ${Number(meter.balance).toLocaleString('en-US', {minimumFractionDigits: 2})}` : 'Rs. 0.00'}
                    </div>
                  </div>
                  <p className="text-[11px] text-white/60 mb-3">
                    {t.overview.depositedCreditNotice}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-white/80">
                    <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white">
                      <Clock className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                      <span>
                        {consumption?.prediction
                          ? (meter?.emergency_credit_active && Number(meter.balance) < 0
                              ? `≈ ~${consumption.prediction.estimatedDaysRemaining} ${t.overview.daysRemainingBuffer}`
                              : `≈ ~${consumption.prediction.estimatedDaysRemaining} ${t.overview.daysRemaining}`)
                          : meter && meter.daily_average > 0
                          ? `≈ ${Math.floor(meter.balance / meter.daily_average)} ${t.overview.daysRemaining}`
                          : t.overview.calculating}
                      </span>
                    </div>
                    {consumption?.prediction && (
                      <span className="text-[11px] text-white/60">
                        ({consumption.prediction.estimatedMinDays}–{consumption.prediction.estimatedMaxDays}d range)
                      </span>
                    )}
                  </div>
                </div>

                {/* Projected Net Remaining at Cycle Close */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-white/70">{t.overview.projectedNetAfterSettlement}:</span>
                  <span className={`font-mono font-bold ${
                    consumption?.prediction && consumption.prediction.projectedNetBalance <= 0 
                      ? 'text-red-300 animate-pulse' 
                      : consumption?.prediction && consumption.prediction.projectedNetBalance <= 300
                      ? 'text-amber-300'
                      : 'text-green-300'
                  }`}>
                    Rs. {consumption?.prediction 
                      ? Number(consumption.prediction.projectedNetBalance).toLocaleString('en-US', {minimumFractionDigits: 2}) 
                      : Number(meter?.balance || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                  </span>
                </div>
              </div>

              {/* Right Column: Dedicated Current Month Accrued Bill Box */}
              <div className="bg-black/40 p-3.5 sm:p-4 rounded-2xl border border-white/10 flex flex-col justify-between backdrop-blur-md">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-yellow-300">
                      <Calendar className="h-3.5 w-3.5 text-yellow-400" />
                      <span>{t.overview.currentMonthAccruedBill}</span>
                    </div>
                    <span className="text-[10px] text-white/50 uppercase tracking-wider font-mono">
                      {t.overview.pucslTariff}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-mono">
                      Rs. {consumption?.prediction 
                        ? Number(consumption.prediction.currentCycleLiability).toLocaleString('en-US', {minimumFractionDigits: 2})
                        : '0.00'}
                    </span>
                    <span className="text-xs text-white/60">
                      ({consumption?.prediction ? consumption.prediction.billingCycleConsumptionKwh : '0.0'} kWh)
                    </span>
                  </div>

                  <div className="text-[11px] text-white/60 mt-2.5 flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span>{t.overview.energyCharge}:</span>
                      <span className="text-white font-mono">Rs. {consumption?.prediction ? Number(consumption.prediction.energyCharge || 0).toFixed(2) : '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t.overview.fixedCharge}:</span>
                      <span className="text-white font-mono">Rs. {consumption?.prediction ? Number(consumption.prediction.fixedCharge || 0).toFixed(2) : '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-yellow-200/80 pt-1 border-t border-white/5">
                      <span>{t.overview.tariffGroup}:</span>
                      <span className="font-semibold">{consumption?.prediction ? consumption.prediction.currentTariffGroup : 'Group A'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-white/10 flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => onNavigate?.("payments")}
                    className="flex-1 bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg hover:scale-[1.02] transition-transform h-8 text-xs cursor-pointer"
                  >
                    {t.overview.rechargeNow}
                  </Button>
                  <Button
                    onClick={handleSettleCycle}
                    disabled={settlingCycle}
                    variant="outline"
                    className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-8 text-xs font-semibold cursor-pointer"
                    title="Deducts the accrued monthly bill from prepaid balance"
                  >
                    {settlingCycle ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Receipt className="h-3 w-3 mr-1 text-yellow-400" />}
                    {t.overview.settleCycle}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Status Card */}
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-white/10 shadow-xl text-white hover:scale-[1.02] transition-transform duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t.overview.meterStatus}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-white/60">{t.overview.connection}</span>
              <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/50">
                {meter ? meter.status : 'Active'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">{t.overview.tariffPlan}</span>
              <span className="text-xs font-semibold text-yellow-400">{t.overview.domesticBlock}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">{t.overview.meterNo}</span>
              <span className="font-mono text-sm">{meter ? meter.meter_number : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">{t.overview.accountNo}</span>
              <span className="font-mono text-sm">{meter ? meter.account_number : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center mt-1 pt-2 border-t border-white/10 text-xs text-white/40">
              <span>{t.overview.billingCycle}</span>
              <span className="text-green-400">{t.overview.pucslStandard}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Electricity Consumption (Full Width) */}
      <Card className="bg-[#0f0f11] border border-white/10 shadow-lg text-white hover:border-white/20 transition-colors duration-300">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
            {t.overview.electricityConsumption}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-6">
            <div className="bg-[#18181b] p-4 sm:p-5 rounded-xl border border-white/5 shadow-inner">
              <div className="text-white/50 text-[11px] uppercase tracking-wider font-semibold mb-1 sm:mb-2">{t.overview.todayNet}</div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight">
                {consumption ? (parseFloat(consumption.today) - parseFloat(consumption.exportToday)).toFixed(1) : '0.0'} 
                <span className="text-xs sm:text-sm font-normal text-white/50 ml-1">kWh</span>
              </div>
              <div className="text-xs mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                <span className="text-red-400 font-medium">{t.overview.inFlow}: {consumption?.today || '0.0'}</span>
                <span className="text-green-400 font-medium">{t.overview.outFlow}: {consumption?.exportToday || '0.0'}</span>
              </div>
            </div>
            <div className="bg-[#18181b] p-4 sm:p-5 rounded-xl border border-white/5 shadow-inner">
              <div className="text-white/50 text-[11px] uppercase tracking-wider font-semibold mb-1 sm:mb-2">{t.overview.thisWeekNet}</div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight">
                {consumption ? (parseFloat(consumption.thisWeek) - parseFloat(consumption.exportThisWeek)).toFixed(1) : '0.0'} 
                <span className="text-xs sm:text-sm font-normal text-white/50 ml-1">kWh</span>
              </div>
              <div className="text-xs mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                <span className="text-red-400 font-medium">{t.overview.inFlow}: {consumption?.thisWeek || '0.0'}</span>
                <span className="text-green-400 font-medium">{t.overview.outFlow}: {consumption?.exportThisWeek || '0.0'}</span>
              </div>
            </div>
            <div className="bg-[#18181b] p-4 sm:p-5 rounded-xl border border-white/5 border-b-2 border-b-blue-500 shadow-inner relative overflow-hidden sm:col-span-2 lg:col-span-1">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Zap size={64} />
              </div>
              <div className="text-white/50 text-[11px] uppercase tracking-wider font-semibold mb-1 sm:mb-2">{t.overview.livePowerNet}</div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-blue-400">
                {consumption ? (parseFloat(consumption.currentPower) - parseFloat(consumption.currentExport)).toFixed(2) : '0.00'} 
                <span className="text-xs sm:text-sm font-normal text-blue-400/50 ml-1">kW</span>
              </div>
              <div className="text-xs mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                <span className="text-red-400 font-medium">{t.overview.inFlow}: {consumption?.currentPower || '0.00'}</span>
                <span className="text-green-400 font-medium">{t.overview.outFlow}: {consumption?.currentExport || '0.00'}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-xs sm:text-sm font-medium text-white/80">{t.overview.usageComparison}</h4>
            <div className="flex flex-col xs:flex-row justify-between xs:items-center text-xs sm:text-sm border-b border-white/10 pb-2 gap-1">
              <span className="text-white/60">{t.overview.todayVsYesterday}</span>
              <span className="font-semibold text-white">
                {consumption ? (parseFloat(consumption.today) - parseFloat(consumption.exportToday)).toFixed(1) : '0.0'} kWh 
                {consumption && (
                  <span className={`text-xs ml-2 font-mono ${
                    (parseFloat(consumption.today) - parseFloat(consumption.exportToday)) > 
                    (parseFloat(consumption.yesterday) - parseFloat(consumption.exportYesterday)) 
                      ? 'text-red-400' 
                      : 'text-green-400'
                  }`}>
                    {(parseFloat(consumption.today) - parseFloat(consumption.exportToday)) > (parseFloat(consumption.yesterday) - parseFloat(consumption.exportYesterday)) ? '↑' : '↓'} 
                    {Math.abs(
                      (parseFloat(consumption.today) - parseFloat(consumption.exportToday)) - 
                      (parseFloat(consumption.yesterday) - parseFloat(consumption.exportYesterday))
                    ).toFixed(1)} kWh
                  </span>
                )}
              </span>
            </div>
            <div className="flex flex-col xs:flex-row justify-between xs:items-center text-xs sm:text-sm border-b border-white/10 pb-2 gap-1">
              <span className="text-white/60">{t.overview.thisWeekVsLastWeek}</span>
              <span className="font-semibold text-white">
                {consumption ? (parseFloat(consumption.thisWeek) - parseFloat(consumption.exportThisWeek)).toFixed(1) : '0.0'} kWh 
                {consumption && (
                  <span className={`text-xs ml-2 font-mono ${
                    (parseFloat(consumption.thisWeek) - parseFloat(consumption.exportThisWeek)) > 
                    (parseFloat(consumption.lastWeek) - parseFloat(consumption.exportLastWeek)) 
                      ? 'text-red-400' 
                      : 'text-green-400'
                  }`}>
                    {(parseFloat(consumption.thisWeek) - parseFloat(consumption.exportThisWeek)) > (parseFloat(consumption.lastWeek) - parseFloat(consumption.exportLastWeek)) ? '↑' : '↓'} 
                    {Math.abs(
                      (parseFloat(consumption.thisWeek) - parseFloat(consumption.exportThisWeek)) - 
                      (parseFloat(consumption.lastWeek) - parseFloat(consumption.exportLastWeek))
                    ).toFixed(1)} kWh
                  </span>
                )}
              </span>
            </div>

            {/* PUCSL Lifetime Prediction Box */}
            <div className="mt-4 p-4 sm:p-5 bg-[#121214] border border-yellow-400/20 rounded-xl text-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-yellow-400/10 text-yellow-400 shrink-0">
                    <Battery className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-white flex items-center gap-2 flex-wrap">
                      <span>{t.overview.tariffLifetimePrediction}</span>
                      {consumption?.prediction && (
                        <Badge className={`text-[9px] uppercase font-semibold ${
                          consumption.prediction.predictionConfidence === 'HIGH' 
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }`}>
                          {consumption.prediction.predictionConfidence}
                        </Badge>
                      )}
                    </h4>
                    <p className="text-[11px] text-white/50">{t.overview.simulationNotice}</p>
                  </div>
                </div>
                {consumption?.prediction && (
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider block">{t.overview.daysRemaining}</span>
                    <span className="text-xl sm:text-2xl font-black text-yellow-400">
                      ~{consumption.prediction.estimatedDaysRemaining} {t.overview.daysRemaining}
                    </span>
                  </div>
                )}
              </div>

              {consumption?.prediction ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-3 text-xs">
                  <div className="bg-black/30 p-2 sm:p-2.5 rounded-lg border border-white/5">
                    <span className="text-white/50 text-[10px] block">{t.overview.expectedRange}</span>
                    <span className="font-bold text-white mt-0.5 block text-xs">
                      {consumption.prediction.estimatedMinDays}–{consumption.prediction.estimatedMaxDays} {t.overview.daysRemaining}
                    </span>
                  </div>
                  <div className="bg-black/30 p-2 sm:p-2.5 rounded-lg border border-white/5">
                    <span className="text-white/50 text-[10px] block">{t.overview.currentTariff}</span>
                    <span className="font-bold text-yellow-300 mt-0.5 block text-xs truncate">
                      {consumption.prediction.currentTariffGroup}
                    </span>
                  </div>
                  <div className="bg-black/30 p-2 sm:p-2.5 rounded-lg border border-white/5">
                    <span className="text-white/50 text-[10px] block">Cycle Usage</span>
                    <span className="font-bold text-white mt-0.5 block text-xs">
                      {consumption.prediction.billingCycleConsumptionKwh} kWh / 30d
                    </span>
                  </div>
                  <div className="bg-black/30 p-2 sm:p-2.5 rounded-lg border border-white/5">
                    <span className="text-white/50 text-[10px] block">Avg Burn Rate</span>
                    <span className="font-bold text-white mt-0.5 block text-xs">
                      {consumption.prediction.averageDailyUsageKwh} kWh/day
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-white/60 pt-2">
                  Calculating non-linear tariff simulation...
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Analytical Trends Chart */}
        <Card className="bg-[#0f0f11] border border-white/10 shadow-lg text-white lg:col-span-2 hover:border-white/20 transition-colors duration-300">
          <CardHeader className="pb-3 sm:pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/5">
            <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2 text-white/90">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              7-Day Power: In &amp; Out
            </CardTitle>
            <div className="flex items-center gap-3 sm:gap-4 text-xs flex-wrap">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3.5 rounded-full bg-red-400"></span><span className="text-white/50">In (grid)</span></span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3.5 rounded-full bg-green-400"></span><span className="text-white/50">Out (solar)</span></span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 h-[250px] sm:h-[300px]">
            {consumption?.chartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={consumption.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorImport" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExport" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ade80" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis dataKey="date" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${value} kWh`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#141416', borderColor: '#333', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ color: '#aaa', marginBottom: '2px', fontSize: '11px' }}
                    formatter={((value: any) => [`${Number(value || 0).toFixed(2)} kWh`]) as any}
                  />
                  <Area type="monotone" dataKey="import" name="In (from grid)" stroke="#f87171" strokeWidth={2} fillOpacity={1} fill="url(#colorImport)" dot={false} />
                  <Area type="monotone" dataKey="export" name="Out (to grid)" stroke="#4ade80" strokeWidth={2} fillOpacity={1} fill="url(#colorExport)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-white/50 text-xs">No trend data available</div>
            )}
          </CardContent>
        </Card>

        {/* Alerts & Recent Activity */}
        <div className="flex flex-col gap-6">
          <Card className="bg-[#0f0f11] border border-white/10 shadow-lg text-white hover:border-white/20 transition-colors duration-300">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white/90">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {notifications.filter(n => n.type === 'alert').length === 0 ? (
                <div className="text-sm text-white/50 text-center py-2">No active alerts</div>
              ) : (
                notifications.filter(n => n.type === 'alert').slice(0, 3).map(alert => (
                  <div key={alert.id} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="text-sm font-medium text-red-400">{alert.title}</div>
                    <div className="text-xs text-red-400/70 mt-1">{alert.message}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#0f0f11] border border-white/10 shadow-lg text-white hover:border-white/20 transition-colors duration-300 flex-1">
            <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-white/90">
                <HistoryIcon className="h-4 w-4 text-white/50" />
                Recent Activity
              </CardTitle>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate("history")}
                  className="text-xs text-yellow-400/80 hover:text-yellow-400 hover:underline cursor-pointer"
                >
                  View All History →
                </button>
              )}
            </CardHeader>
            <CardContent>
              <div className="relative border-l border-white/10 ml-3 space-y-6">
                {notifications.filter(n => n.type !== 'alert').length === 0 ? (
                  <div className="text-sm text-white/50 pl-4 py-2">No recent activity</div>
                ) : (
                  notifications.filter(n => n.type !== 'alert').slice(0, 5).map(activity => (
                    <div key={activity.id} className="relative pl-6">
                      <span className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full ring-4 ring-[#1a1a1a] ${activity.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-white/70 mt-1">{activity.message}</p>
                      <p className="text-[10px] text-white/40 mt-1">{new Date(activity.created_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
