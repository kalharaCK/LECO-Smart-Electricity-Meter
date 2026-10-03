import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Battery, Zap, AlertTriangle, Activity, Clock, CheckCircle, History as HistoryIcon, Loader2, TrendingUp } from "lucide-react"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"

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
        const res = await fetch('http://localhost:3000/api/meters', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            setMeter(data[0]);
            
            // Fetch consumption stats for this meter
            const consRes = await fetch(`http://localhost:3000/api/meters/${data[0].id}/consumption`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (consRes.ok) {
              setConsumption(await consRes.json());
            }
            // Fetch notifications
            const notifRes = await fetch("http://localhost:3000/api/notifications", {
              headers: { 'Authorization': `Bearer ${token}` }
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
            <CardTitle className="text-white/80">Available Prepaid Balance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-5xl font-bold mb-2">
                {meter ? `Rs. ${Number(meter.balance).toLocaleString('en-US', {minimumFractionDigits: 2})}` : 'Rs. 0.00'}
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <Clock className="h-4 w-4" />
                <span>≈ {meter && meter.daily_average > 0 ? Math.floor(meter.balance / meter.daily_average) : 0} days remaining</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 min-w-[200px]">
              <div className="text-sm text-white/70">
                Daily average: {meter ? `Rs. ${meter.daily_average}` : 'Rs. 0.00'}
              </div>
              <Button
                onClick={() => onNavigate?.("payments")}
                className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg hover:scale-105 transition-transform"
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
              <span className="text-white/60">Meter No.</span>
              <span className="font-mono">{meter ? meter.meter_number : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">Account No.</span>
              <span className="font-mono">{meter ? meter.account_number : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10 text-xs text-white/40">
              <span>Last updated: Just now</span>
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
              <div className="mt-4 p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-lg text-sm text-yellow-200 flex gap-3 items-start">
                <Battery className="h-5 w-5 shrink-0 mt-0.5" />
                <p>At your current consumption rate, your balance may last approximately <strong>{meter && meter.daily_average > 0 ? Math.floor(meter.balance / meter.daily_average) : 0} days</strong>.</p>
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
                    formatter={(value: number) => [`${Number(value).toFixed(2)} kWh`]}
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
