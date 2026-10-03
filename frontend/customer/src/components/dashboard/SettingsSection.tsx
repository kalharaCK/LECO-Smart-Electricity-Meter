import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  Bell,
  Sliders,
  Shield,
  Zap,
  Phone,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  Moon,
  LifeBuoy,
  Flame,
  Radio,
  Clock,
  Eye,
  EyeOff,
  RefreshCw,
  LogOut,
  Building2,
  Cpu
} from "lucide-react"

interface Meter {
  id: number
  meter_number: string
  account_number: string
  name: string
  balance: string | number
  status: string
  emergency_credit_limit?: string | number
  emergency_credit_active?: boolean
}

interface UserProfile {
  id: number
  email: string
  role: string
  created_at: string
}

interface UserSettings {
  phone_number: string
  low_balance_threshold: number
  daily_kwh_budget: number
  auto_emergency_credit: boolean
  night_curfew_enabled: boolean
  email_notifications: boolean
  sms_notifications: boolean
  weekly_report: boolean
  tariff_type: string
  updated_at?: string
}

interface SettingsSectionProps {
  onLogout?: () => void
}

export default function SettingsSection({ onLogout }: SettingsSectionProps) {
  const [activeTab, setActiveTab] = useState<"alerts" | "notifications" | "security">("alerts")

  // Data states
  const [loading, setLoading] = useState(true)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [meters, setMeters] = useState<Meter[]>([])
  const [user, setUser] = useState<UserProfile | null>(null)

  // Settings State
  const [phoneNumber, setPhoneNumber] = useState("+94 77 123 4567")
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState<number>(300)
  const [dailyKwhBudget, setDailyKwhBudget] = useState<number>(12)
  const [autoEmergencyCredit, setAutoEmergencyCredit] = useState(true)
  const [nightCurfewEnabled, setNightCurfewEnabled] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(true)
  const [weeklyReport, setWeeklyReport] = useState(true)
  const [tariffType, setTariffType] = useState("Domestic D-1 (PUCSL Block Tariff)")

  // Security / Password State
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
    const token = localStorage.getItem("token")
    const headers: Record<string, string> = { ...extraHeaders }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
    return headers
  }

  // Fetch all settings and user profile
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("http://localhost:3000/api/settings", {
        headers: getAuthHeaders(),
        credentials: "include"
      })

      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          setPhoneNumber(data.settings.phone_number || "+94 77 123 4567")
          setLowBalanceThreshold(data.settings.low_balance_threshold ?? 300)
          setDailyKwhBudget(data.settings.daily_kwh_budget ?? 12)
          setAutoEmergencyCredit(data.settings.auto_emergency_credit ?? true)
          setNightCurfewEnabled(data.settings.night_curfew_enabled ?? true)
          setEmailNotifications(data.settings.email_notifications ?? true)
          setSmsNotifications(data.settings.sms_notifications ?? true)
          setWeeklyReport(data.settings.weekly_report ?? true)
          setTariffType(data.settings.tariff_type || "Domestic D-1 (PUCSL Block Tariff)")
        }
        if (data.user) {
          setUser(data.user)
        }
        if (data.meters && Array.isArray(data.meters)) {
          setMeters(data.meters)
        }
      }
    } catch (err) {
      console.error("Error loading settings:", err)
      showToast("Failed to load settings from server", "error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Save General Preferences
  const handleSavePreferences = async () => {
    setSavingPreferences(true)
    try {
      const res = await fetch("http://localhost:3000/api/settings", {
        method: "PATCH",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          phone_number: phoneNumber,
          low_balance_threshold: lowBalanceThreshold,
          daily_kwh_budget: dailyKwhBudget,
          auto_emergency_credit: autoEmergencyCredit,
          night_curfew_enabled: nightCurfewEnabled,
          email_notifications: emailNotifications,
          sms_notifications: smsNotifications,
          weekly_report: weeklyReport
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast("Settings and alert thresholds saved successfully!", "success")
      } else {
        showToast(data.message || "Failed to save settings", "error")
      }
    } catch (err) {
      console.error("Error saving preferences:", err)
      showToast("Network error saving preferences", "error")
    } finally {
      setSavingPreferences(false)
    }
  }

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword) {
      showToast("Current password and new password are required", "error")
      return
    }

    if (newPassword.length < 6) {
      showToast("New password must be at least 6 characters long", "error")
      return
    }

    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", "error")
      return
    }

    setSavingPassword(true)
    try {
      const res = await fetch("http://localhost:3000/api/settings/password", {
        method: "PATCH",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast("Account password updated successfully!", "success")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        showToast(data.message || "Failed to change password", "error")
      }
    } catch (err) {
      console.error("Error changing password:", err)
      showToast("Network error changing password", "error")
    } finally {
      setSavingPassword(false)
    }
  }

  const selectedMeter = meters.find((m) => m.id === selectedMeterId) || meters[0]

  return (
    <div className="space-y-6">
      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 text-sm font-semibold ${
            toastMessage.type === "success"
              ? "bg-green-950/90 border-green-500/40 text-green-200 shadow-green-500/10"
              : "bg-red-950/90 border-red-500/40 text-red-200 shadow-red-500/10"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#1f0704] via-[#3a0b04] to-[#120302] border border-white/10 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                <Settings className="h-3.5 w-3.5 mr-1" />
                System Configuration
              </span>
              <span className="text-white/40 text-sm">•</span>
              <span className="text-white/60 text-xs">LECO Smart AMI Settings</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Account & Smart Meter Settings</h1>
            <p className="text-white/70 text-sm mt-1 max-w-2xl">
              Configure alert thresholds, Lifeline mode automation, notification channels, and account security.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSavePreferences}
              disabled={savingPreferences}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold h-11 px-5 rounded-xl shadow-lg hover:shadow-yellow-400/20 transition-all flex items-center gap-2"
            >
              {savingPreferences ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "alerts"
                ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white"
            }`}
          >
            <Sliders className="h-4 w-4" />
            Smart Alerts & Thresholds
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "notifications"
                ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white"
            }`}
          >
            <Bell className="h-4 w-4" />
            Alert Channels & SMS
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "security"
                ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white"
            }`}
          >
            <Shield className="h-4 w-4" />
            Security & Profile
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-white/50 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
          <span className="text-xs">Loading configuration settings...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* TAB 1: Smart Alerts & Thresholds */}
          {activeTab === "alerts" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card 1: Threshold Controls */}
              <Card className="bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a] border-white/10 shadow-2xl text-white">
                <CardHeader className="border-b border-white/10 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-yellow-400" />
                    Consumption & Wallet Triggers
                  </CardTitle>
                  <CardDescription className="text-white/60 text-xs">
                    Fine-tune automated triggers for low balance and heavy power usage
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Low Balance Warning Threshold */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="low-balance-input" className="text-xs font-semibold text-white uppercase tracking-wider">
                        Low Balance Warning Alert (Rs.)
                      </Label>
                      <span className="text-sm font-bold text-yellow-400">Rs. {lowBalanceThreshold.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Input
                        id="low-balance-input"
                        type="number"
                        min="50"
                        max="5000"
                        step="50"
                        value={lowBalanceThreshold}
                        onChange={(e) => setLowBalanceThreshold(parseFloat(e.target.value) || 0)}
                        className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl w-36"
                      />
                      <div className="flex gap-2">
                        {[200, 300, 500, 1000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setLowBalanceThreshold(preset)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              lowBalanceThreshold === preset
                                ? "bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20"
                                : "bg-black/30 border-white/10 text-white/70 hover:bg-black/50 hover:text-white"
                            }`}
                          >
                            Rs. {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      Sends an instant SMS and push alert when your wallet dips below this amount to avoid unexpected disconnections.
                    </p>
                  </div>

                  <div className="border-t border-white/10 pt-5 space-y-3">
                    {/* Daily kWh Quota Warning */}
                    <div className="flex justify-between items-center">
                      <Label htmlFor="kwh-quota-input" className="text-xs font-semibold text-white uppercase tracking-wider">
                        Daily Energy Usage Quota (kWh/Day)
                      </Label>
                      <span className="text-sm font-bold text-yellow-400">{dailyKwhBudget} kWh / day</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Input
                        id="kwh-quota-input"
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={dailyKwhBudget}
                        onChange={(e) => setDailyKwhBudget(parseFloat(e.target.value) || 1)}
                        className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl w-36"
                      />
                      <div className="flex gap-2">
                        {[8, 12, 18, 25].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDailyKwhBudget(preset)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              dailyKwhBudget === preset
                                ? "bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20"
                                : "bg-black/30 border-white/10 text-white/70 hover:bg-black/50 hover:text-white"
                            }`}
                          >
                            {preset} kWh
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      Flags abnormal surges in power consumption to prevent stepping into higher PUCSL tariff tiers.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Protection & Curfew Automation */}
              <Card className="bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a] border-white/10 shadow-2xl text-white">
                <CardHeader className="border-b border-white/10 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <LifeBuoy className="h-5 w-5 text-yellow-400" />
                    Automated Protection Policies
                  </CardTitle>
                  <CardDescription className="text-white/60 text-xs">
                    Regulatory consumer safeguards and emergency power rules
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  {/* Auto-Lifeline Toggle */}
                  <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Automatic Lifeline Mode (-Rs. 500 Buffer)</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-yellow-400/20 text-yellow-300">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed">
                        When balance hits Rs. 0.00, automatically activate the Rs. 500 emergency buffer so your home stays powered until your next recharge.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAutoEmergencyCredit(!autoEmergencyCredit)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        autoEmergencyCredit ? "bg-yellow-400" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                          autoEmergencyCredit ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Night Curfew Friendly Disconnect */}
                  <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Friendly Disconnect Curfew (10 PM – 6 AM)</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300">
                          PUCSL Rule
                        </span>
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed">
                        Under PUCSL utility guidelines, physical meter relay will never disconnect your power overnight between 10:00 PM and 6:00 AM or on Poya holidays, even if prepaid balance reaches zero.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setNightCurfewEnabled(!nightCurfewEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        nightCurfewEnabled ? "bg-yellow-400" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                          nightCurfewEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Alert Phone Number Input */}
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="alert-phone-input" className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-yellow-400" />
                      SMS Alert Mobile Number
                    </Label>
                    <Input
                      id="alert-phone-input"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+94 77 123 4567"
                      className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl"
                    />
                    <p className="text-[10px] text-white/40">
                      LECO automated gateway will dispatch recharge receipts and critical power alerts to this number.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: Alert Channels & Notifications */}
          {activeTab === "notifications" && (
            <Card className="bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a] border-white/10 shadow-2xl text-white max-w-3xl mx-auto">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Bell className="h-5 w-5 text-yellow-400" />
                  Dispatch Channels & Preferences
                </CardTitle>
                <CardDescription className="text-white/60 text-xs">
                  Choose how and when LECO contacts you regarding your smart electricity meter
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* SMS Channel */}
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 shrink-0">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Instant SMS Notifications</div>
                      <div className="text-[11px] text-white/50">
                        Dispatches SMS for low balance warnings, power reconnections, and recharge tokens
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSmsNotifications(!smsNotifications)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      smsNotifications ? "bg-yellow-400" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                        smsNotifications ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Email Statements */}
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Monthly Electronic Bill Statements</div>
                      <div className="text-[11px] text-white/50">
                        Detailed PDF monthly statement sent to {user?.email} with PUCSL tier breakdown
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEmailNotifications(!emailNotifications)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      emailNotifications ? "bg-yellow-400" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                        emailNotifications ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Weekly Report */}
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 shrink-0">
                      <Radio className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Weekly Energy Efficiency Digest</div>
                      <div className="text-[11px] text-white/50">
                        In-depth 7-day consumption comparison with AI conservation tips from our energy engine
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setWeeklyReport(!weeklyReport)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      weeklyReport ? "bg-yellow-400" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                        weeklyReport ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleSavePreferences}
                    disabled={savingPreferences}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold h-11 rounded-xl shadow-lg"
                  >
                    {savingPreferences ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Alert Preferences"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: Security & Profile */}
          {activeTab === "security" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Change Password Card */}
              <Card className="bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a] border-white/10 shadow-2xl text-white">
                <CardHeader className="border-b border-white/10 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-yellow-400" />
                    Change Account Password
                  </CardTitle>
                  <CardDescription className="text-white/60 text-xs">
                    Update your web portal login credentials
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="current-pw" className="text-xs text-white">
                        Current Password
                      </Label>
                      <Input
                        id="current-pw"
                        type={showPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="new-pw" className="text-xs text-white">
                        New Password (minimum 6 characters)
                      </Label>
                      <Input
                        id="new-pw"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-pw" className="text-xs text-white">
                        Confirm New Password
                      </Label>
                      <Input
                        id="confirm-pw"
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-white/60 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPassword}
                          onChange={(e) => setShowPassword(e.target.checked)}
                          className="rounded bg-black/40 border-white/20 text-yellow-400 focus:ring-0"
                        />
                        <span>Show Passwords</span>
                      </label>
                    </div>

                    <Button
                      type="submit"
                      disabled={savingPassword || !currentPassword || !newPassword}
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold h-10 rounded-xl text-xs shadow-lg mt-2"
                    >
                      {savingPassword ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Profile & Session Overview */}
              <Card className="bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a] border-white/10 shadow-2xl text-white">
                <CardHeader className="border-b border-white/10 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-yellow-400" />
                    Account & Session Overview
                  </CardTitle>
                  <CardDescription className="text-white/60 text-xs">
                    Registered LECO profile & current browser session
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-white/50">Registered Email:</span>
                      <span className="font-semibold text-white">{user?.email}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/50">Account Role:</span>
                      <Badge variant="outline" className="bg-yellow-400/10 text-yellow-300 border-yellow-400/30 text-[10px] uppercase font-bold">
                        {user?.role || "Customer"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/50">Linked Meters Count:</span>
                      <span className="font-semibold text-white">{meters.length} smart meters</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/50">Account Member Since:</span>
                      <span className="text-white/70">
                        {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "Active"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/50">Active Session:</span>
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        httpOnly Cookie + Bearer JWT
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <Button
                      onClick={onLogout}
                      variant="outline"
                      className="w-full bg-red-500/10 border-red-500/30 hover:bg-red-500/20 text-red-300 font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out of LECO Portal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
