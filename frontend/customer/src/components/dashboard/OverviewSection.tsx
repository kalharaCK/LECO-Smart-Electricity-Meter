import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Battery, Zap, AlertTriangle, Activity, Clock, History as HistoryIcon, Loader2, TrendingUp, Sparkles } from "lucide-react"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

export default function OverviewSection({ refreshKey, onNavigate }: { refreshKey?: number; onNavigate?: (section: string) => void }) {
  const [meter, setMeter] = useState<any>(null)
  const [consumption, setConsumption] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  const user = JSON.parse(localStorage.getItem('user') || '{"email": "User"}')

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchMeters = async () => {
      setLoading(true);
      setMeter(null);
      setConsumption(null);
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('http://localhost:3000/api/meters', {
          credentials: 'include',
          headers
        });
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            setMeter(data[0]);
            
            // Fetch consumption stats for this meter
            const consRes = await fetch(`http://localhost:3000/api/meters/${data[0].id}/consumption`, {
              credentials: 'include',
              headers
            });
            if (consRes.ok) {
              setConsumption(await consRes.json());
            }
            // Fetch notifications
            const notifRes = await fetch("http://localhost:3000/api/notifications", {
              credentials: 'include',
              headers
            });
            if (notifRes.ok) {
              setNotifications(await notifRes.json());
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchMeters();
  }, [refreshKey]);

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
            Welcome back, <span className="text-[#992511]">{user.email.split('@')[0]}</span>
          </h2>
          <p className="text-white/60">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            <span className="mx-2">•</span>
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <Button
          onClick={() => onNavigate?.("payments")}
          className="bg-[#992511] hover:bg-[#992511]/80 text-white shadow-lg transition-transform hover:scale-105"
        >
          Quick Recharge Now
        </Button>
      </div>

      {/* Top Section - Balance and Quick Status */}
      {/* Top Section - Balance and Quick Status */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Main Balance Card */}
        <Card className="bg-gradient-to-br from-[#992511] to-[#3a0b04] border-0 shadow-xl text-white lg:col-span-2 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300">
          <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-30 transition-opacity">
            <Zap size={120} />
          </div>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-white/80">Available Prepaid Balance</CardTitle>
              {consumption?.prediction && (
                <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/30 text-[11px] font-normal flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {consumption.prediction.currentTariffGroup}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-5xl font-bold mb-2">
                {meter ? `Rs. ${Number(meter.balance).toLocaleString('en-US', {minimumFractionDigits: 2})}` : 'Rs. 0.00'}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-white/80">
                <div className="flex items-center gap-1.5 bg-black/30 px-2.5 py-1 rounded-full border border-white/10 text-xs text-white">
                  <Clock className="h-3.5 w-3.5 text-yellow-400" />
                  <span>
                    {consumption?.prediction
                      ? `≈ ~${consumption.prediction.estimatedDaysRemaining} days remaining`
                      : meter && meter.daily_average > 0
                      ? `≈ ${Math.floor(meter.balance / meter.daily_average)} days remaining`
                      : 'Calculating...'}
                  </span>
                </div>
                {consumption?.prediction && (
                  <span className="text-xs text-white/60">
                    ({consumption.prediction.estimatedMinDays}–{consumption.prediction.estimatedMaxDays} days range)
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 min-w-[210px] bg-black/20 p-3 rounded-xl border border-white/5">
              <div className="text-xs text-white/70 flex justify-between">
                <span>Avg Daily Usage:</span>
                <span className="font-semibold text-white">
                  {consumption?.prediction ? `${consumption.prediction.averageDailyUsageKwh} kWh/day` : '0.0 kWh'}
                </span>
              </div>
              <div className="text-xs text-white/70 flex justify-between">
                <span>Tariff System:</span>
                <span className="font-semibold text-yellow-300">PUCSL Block</span>
              </div>
              <Button
                onClick={() => onNavigate?.("payments")}
                className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg hover:scale-105 transition-transform mt-1 h-9 text-xs"
              >
                Recharge Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Current Status Card */}
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-white/10 shadow-xl text-white hover:scale-[1.02] transition-transform duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Meter Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-white/60">Connection</span>
              <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/50">
                {meter ? meter.status : 'No Meter'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">Tariff Plan</span>
              <span className="text-xs font-semibold text-yellow-400">Domestic Block</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">Meter No.</span>
              <span className="font-mono text-sm">{meter ? meter.meter_number : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">Account No.</span>
              <span className="font-mono text-sm">{meter ? meter.account_number : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center mt-1 pt-2 border-t border-white/10 text-xs text-white/40">
              <span>Billing Cycle: 30-day</span>
              <span className="text-green-400">PUCSL Standard</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Electricity Consumption (Full Width) */}
      <Card className="bg-[#0f0f11] border border-white/10 shadow-lg text-white hover:border-white/20 transition-colors duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Electricity Consumption
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-[#18181b] p-5 rounded-xl border border-white/5 shadow-inner">
                <div className="text-white/50 text-xs uppercase tracking-wider font-semibold mb-2">Today — Net (In − Out)</div>
                <div className="text-3xl font-bold tracking-tight">
                  {consumption ? (parseFloat(consumption.today) - parseFloat(consumption.exportToday)).toFixed(1) : '0.0'} 
                  <span className="text-sm font-normal text-white/50 ml-1">kWh</span>
                </div>
                <div className="text-xs mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                  <span className="text-red-400 font-medium">In: {consumption?.today || '0.0'}</span>
                  <span className="text-green-400 font-medium">Out: {consumption?.exportToday || '0.0'}</span>
                </div>
              </div>
              <div className="bg-[#18181b] p-5 rounded-xl border border-white/5 shadow-inner">
                <div className="text-white/50 text-xs uppercase tracking-wider font-semibold mb-2">This Week — Net (In − Out)</div>
                <div className="text-3xl font-bold tracking-tight">
                  {consumption ? (parseFloat(consumption.thisWeek) - parseFloat(consumption.exportThisWeek)).toFixed(1) : '0.0'} 
                  <span className="text-sm font-normal text-white/50 ml-1">kWh</span>
                </div>
                <div className="text-xs mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                  <span className="text-red-400 font-medium">In: {consumption?.thisWeek || '0.0'}</span>
                  <span className="text-green-400 font-medium">Out: {consumption?.exportThisWeek || '0.0'}</span>
                </div>
              </div>
              <div className="bg-[#18181b] p-5 rounded-xl border border-white/5 border-b-2 border-b-blue-500 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Zap size={64} />
                </div>
                <div className="text-white/50 text-xs uppercase tracking-wider font-semibold mb-2">Live Power — Net (In − Out)</div>
                <div className="text-3xl font-bold tracking-tight text-blue-400">
                  {consumption ? (parseFloat(consumption.currentPower) - parseFloat(consumption.currentExport)).toFixed(2) : '0.00'} 
                  <span className="text-sm font-normal text-blue-400/50 ml-1">kW</span>
                </div>
                <div className="text-xs mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                  <span className="text-red-400 font-medium">In: {consumption?.currentPower || '0.00'}</span>
                  <span className="text-green-400 font-medium">Out: {consumption?.currentExport || '0.00'}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-white/80">Net Usage Comparison — In − Out (vs Previous Period)</h4>
              <div className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
                <span className="text-white/60">Today vs Yesterday</span>
                <span className="font-medium">
                  {consumption ? (parseFloat(consumption.today) - parseFloat(consumption.exportToday)).toFixed(1) : '0.0'} kWh 
                  {consumption && (
                    <span className={`text-xs ml-2 ${
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
              <div className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
                <span className="text-white/60">This week vs Last week</span>
                <span className="font-medium">
                  {consumption ? (parseFloat(consumption.thisWeek) - parseFloat(consumption.exportThisWeek)).toFixed(1) : '0.0'} kWh 
                  {consumption && (
                    <span className={`text-xs ml-2 ${
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
              <div className="mt-4 p-5 bg-[#121214] border border-yellow-400/20 rounded-xl text-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-yellow-400/10 text-yellow-400">
                      <Battery className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        PUCSL Tariff-Aware Wallet Lifetime Prediction
                        {consumption?.prediction && (
                          <Badge className={`text-[10px] uppercase font-semibold ${
                            consumption.prediction.predictionConfidence === 'HIGH' 
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          }`}>
                            {consumption.prediction.predictionConfidence} Confidence
                          </Badge>
                        )}
                      </h4>
                      <p className="text-xs text-white/50">Nonlinear day-by-day simulation under official Sri Lankan domestic electricity tariffs</p>
                    </div>
                  </div>
                  {consumption?.prediction && (
                    <div className="text-right sm:text-right">
                      <span className="text-xs text-white/50 uppercase tracking-wider block">Estimated Days</span>
                      <span className="text-2xl font-black text-yellow-400">
                        ~{consumption.prediction.estimatedDaysRemaining} Days
                      </span>
                    </div>
                  )}
                </div>

                {consumption?.prediction ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                    <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <span className="text-white/50 block">Expected Range</span>
                      <span className="font-bold text-white mt-0.5 block">
                        {consumption.prediction.estimatedMinDays} to {consumption.prediction.estimatedMaxDays} Days
                      </span>
                    </div>
                    <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <span className="text-white/50 block">Current Tariff Slab</span>
                      <span className="font-bold text-yellow-300 mt-0.5 block">
                        {consumption.prediction.currentTariffGroup}
                      </span>
                    </div>
                    <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <span className="text-white/50 block">Cycle Usage</span>
                      <span className="font-bold text-white mt-0.5 block">
                        {consumption.prediction.billingCycleConsumptionKwh} kWh / 30d
                      </span>
                    </div>
                    <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <span className="text-white/50 block">Avg Burn Rate</span>
                      <span className="font-bold text-white mt-0.5 block">
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
          <CardHeader className="pb-4 flex flex-row items-center justify-between border-b border-white/5">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-white/90">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              7-Day Power: In &amp; Out
            </CardTitle>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-full bg-red-400"></span><span className="text-white/50">In (from grid)</span></span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-full bg-green-400"></span><span className="text-white/50">Out (to grid)</span></span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 h-[300px]">
            {consumption?.chartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={consumption.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value} kWh`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                    labelStyle={{ color: '#aaa', marginBottom: '4px' }}
                    formatter={((value: any) => [`${Number(value || 0).toFixed(2)} kWh`]) as any}
                  />
                  <Area type="monotone" dataKey="import" name="In (from grid)" stroke="#f87171" strokeWidth={2.5} fillOpacity={1} fill="url(#colorImport)" dot={false} />
                  <Area type="monotone" dataKey="export" name="Out (to grid)" stroke="#4ade80" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExport)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-white/50">No trend data available</div>
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
