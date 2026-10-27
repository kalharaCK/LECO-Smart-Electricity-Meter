import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useDashboardI18n } from "@/lib/dashboardI18n"
import {
  Settings,
  Bell,
  Sliders,
  Shield,
  Phone,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  LifeBuoy,
  Radio,
  LogOut,
  Building2,
  Eye,
  EyeOff
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

export interface UserSettings {
  phone_number: string
  low_balance_threshold: number
  daily_kwh_budget: number
  monthly_budget_lkr?: number
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
  const { t } = useDashboardI18n()
  const [activeTab, setActiveTab] = useState<"alerts" | "notifications" | "security">("alerts")

  // Data states
  const [loading, setLoading] = useState(true)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [meters, setMeters] = useState<Meter[]>([])
  const [user, setUser] = useState<UserProfile | null>(null)

  // Settings State
  const [phoneNumber, setPhoneNumber] = useState("")
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState<number>(300)
  const [dailyKwhBudget, setDailyKwhBudget] = useState<number>(12)
  const [monthlyBudgetLkr, setMonthlyBudgetLkr] = useState<number>(3000)
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
    return { ...extraHeaders }
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
          setPhoneNumber(data.settings.phone_number || "")
          setLowBalanceThreshold(data.settings.low_balance_threshold ?? 300)
          setDailyKwhBudget(data.settings.daily_kwh_budget ?? 12)
          setMonthlyBudgetLkr(data.settings.monthly_budget_lkr ? Number(data.settings.monthly_budget_lkr) : 3000)
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
      showToast(t.payments.networkError, "error")
    } finally {
      setLoading(false)
    }
  }, [t])

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
          monthly_budget_lkr: monthlyBudgetLkr,
          auto_emergency_credit: autoEmergencyCredit,
          night_curfew_enabled: nightCurfewEnabled,
          email_notifications: emailNotifications,
          sms_notifications: smsNotifications,
          weekly_report: weeklyReport
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(t.settings.savedSuccess, "success")
      } else {
        showToast(data.message || t.payments.paymentFailed, "error")
      }
    } catch (err) {
      console.error("Error saving preferences:", err)
      showToast(t.payments.networkError, "error")
    } finally {
      setSavingPreferences(false)
    }
  }

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      showToast(t.settings.passwordsDoNotMatch, "error")
      return
    }
    if (newPassword.length < 10) {
      showToast(t.settings.passwordMinLength, "error")
      return
    }

    setSavingPassword(true)
    try {
      const res = await fetch("http://localhost:3000/api/settings/password", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(t.settings.savedSuccess, "success")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        showToast(data.message || t.payments.paymentFailed, "error")
      }
    } catch (err) {
      console.error("Error changing password:", err)
      showToast(t.payments.networkError, "error")
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
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
                {t.settings.title}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{t.settings.title}</h1>
            <p className="text-white/70 text-sm mt-1 max-w-2xl">
              {t.settings.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              onClick={handleSavePreferences}
              disabled={savingPreferences}
              className="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-500 text-black font-bold h-11 px-5 rounded-xl shadow-lg hover:shadow-yellow-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {savingPreferences ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.settings.saving}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t.settings.savePreferences}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-white/10 overflow-x-auto pb-1.5 -mx-1 px-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === "alerts"
                ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white"
            }`}
          >
            <Sliders className="h-4 w-4" />
            {t.settings.tabAlerts}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === "notifications"
                ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white"
            }`}
          >
            <Bell className="h-4 w-4" />
            {t.settings.tabNotifications}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === "security"
                ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white"
            }`}
          >
            <Shield className="h-4 w-4" />
            {t.settings.tabSecurity}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-white/50 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
          <span className="text-xs">{t.overview.calculating}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* TAB 1: Smart Alerts & Thresholds */}
          {activeTab === "alerts" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a] border-white/10 shadow-2xl text-white">
                <CardHeader className="border-b border-white/10 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-yellow-400" />
                    {t.settings.energyPreferences}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Monthly Budget (LKR) */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="monthly-budget-input" className="text-xs font-semibold text-white uppercase tracking-wider">
                        {t.settings.monthlyBudget}
                      </Label>
                      <span className="text-sm font-bold text-yellow-400">Rs. {monthlyBudgetLkr.toLocaleString()}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                      <Input
                        id="monthly-budget-input"
                        type="number"
                        min="500"
                        max="100000"
                        step="500"
                        value={monthlyBudgetLkr}
                        onChange={(e) => setMonthlyBudgetLkr(parseFloat(e.target.value) || 0)}
                        className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl w-full sm:w-36"
                      />
                      <div className="grid grid-cols-5 sm:flex gap-1.5 sm:gap-2">
                        {[2000, 3000, 5000, 8000, 10000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setMonthlyBudgetLkr(preset)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                              monthlyBudgetLkr === preset
                                ? "bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20"
                                : "bg-black/30 border-white/10 text-white/70 hover:bg-black/50 hover:text-white"
                            }`}
                          >
                            Rs. {preset >= 1000 ? `${preset / 1000}k` : preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="low-balance-input" className="text-xs font-semibold text-white uppercase tracking-wider">
                        {t.settings.lowBalanceThreshold}
                      </Label>
                      <span className="text-sm font-bold text-yellow-400">Rs. {lowBalanceThreshold.toLocaleString()}</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                      <Input
                        id="low-balance-input"
                        type="number"
                        min="50"
                        max="5000"
                        step="50"
                        value={lowBalanceThreshold}
                        onChange={(e) => setLowBalanceThreshold(parseFloat(e.target.value) || 0)}
                        className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl w-full sm:w-36"
                      />
                      <div className="grid grid-cols-4 sm:flex gap-1.5 sm:gap-2">
                        {[200, 300, 500, 1000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setLowBalanceThreshold(preset)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
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
                  </div>

                  <div className="border-t border-white/10 pt-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="kwh-quota-input" className="text-xs font-semibold text-white uppercase tracking-wider">
                        {t.settings.dailyBudget}
                      </Label>
                      <span className="text-sm font-bold text-yellow-400">{dailyKwhBudget} kWh / day</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                      <Input
                        id="kwh-quota-input"
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={dailyKwhBudget}
                        onChange={(e) => setDailyKwhBudget(parseFloat(e.target.value) || 1)}
                        className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl w-full sm:w-36"
                      />
                      <div className="grid grid-cols-4 sm:flex gap-1.5 sm:gap-2">
                        {[8, 12, 18, 25].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDailyKwhBudget(preset)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
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
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Protection & Curfew Automation */}
              <Card className="bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a] border-white/10 shadow-2xl text-white">
                <CardHeader className="border-b border-white/10 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <LifeBuoy className="h-5 w-5 text-yellow-400" />
                    {t.settings.autoEmergencyCredit}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{t.settings.autoEmergencyCredit}</span>
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed">
                        {t.settings.autoEmergencyCreditDesc}
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

                  <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{t.settings.nightCurfew}</span>
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed">
                        {t.settings.nightCurfewDesc}
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

                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="alert-phone-input" className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-yellow-400" />
                      {t.settings.phoneLabel}
                    </Label>
                    <Input
                      id="alert-phone-input"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 0771234567"
                      className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: Notifications */}
          {activeTab === "notifications" && (
            <Card className="bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a] border-white/10 shadow-2xl text-white max-w-3xl mx-auto">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Bell className="h-5 w-5 text-yellow-400" />
                  {t.settings.notificationChannels}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 shrink-0">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{t.settings.smsNotifications}</div>
                      <div className="text-[11px] text-white/50">
                        {t.settings.smsNotificationsDesc}
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

                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{t.settings.emailNotifications}</div>
                      <div className="text-[11px] text-white/50">
                        {t.settings.emailNotificationsDesc}
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

                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 shrink-0">
                      <Radio className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{t.settings.weeklyDigest}</div>
                      <div className="text-[11px] text-white/50">
                        {t.settings.weeklyDigestDesc}
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
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold h-11 rounded-xl shadow-lg cursor-pointer"
                  >
                    {savingPreferences ? <Loader2 className="h-4 w-4 animate-spin" /> : t.settings.savePreferences}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: Security & Profile */}
          {activeTab === "security" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a] border-white/10 shadow-2xl text-white">
                <CardHeader className="border-b border-white/10 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-yellow-400" />
                    {t.settings.changePassword}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="current-pw" className="text-xs text-white">
                        {t.settings.currentPassword}
                      </Label>
                      <div className="relative">
                        <Input
                          id="current-pw"
                          type={showPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="new-pw" className="text-xs text-white">
                        {t.settings.newPassword}
                      </Label>
                      <div className="relative">
                        <Input
                          id="new-pw"
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-pw" className="text-xs text-white">
                        {t.settings.confirmPassword}
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirm-pw"
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="bg-black/30 border-white/15 text-white text-xs h-10 rounded-xl pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-white/60 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPassword}
                          onChange={(e) => setShowPassword(e.target.checked)}
                          className="rounded bg-black/40 border-white/20 text-yellow-400 focus:ring-0"
                        />
                        <span>{t.settings.showPasswords}</span>
                      </label>
                    </div>

                    <Button
                      type="submit"
                      disabled={savingPassword || !currentPassword || !newPassword}
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold h-10 rounded-xl text-xs shadow-lg mt-2 cursor-pointer"
                    >
                      {savingPassword ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t.settings.saving}
                        </>
                      ) : (
                        t.settings.changePassword
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Profile Overview */}
              <Card className="bg-gradient-to-br from-[#181818] via-[#121212] to-[#0a0a0a] border-white/10 shadow-2xl text-white">
                <CardHeader className="border-b border-white/10 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-yellow-400" />
                    {t.settings.accountProfile}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-white/50">{t.settings.emailLabel}:</span>
                      <span className="font-semibold text-white">{user?.email}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/50">{t.settings.roleLabel}:</span>
                      <Badge variant="outline" className="bg-yellow-400/10 text-yellow-300 border-yellow-400/30 text-[10px] uppercase font-bold">
                        {user?.role || t.settings.customerRole}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/50">{t.addMeter.myLinkedMeters}:</span>
                      <span className="font-semibold text-white">{meters.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/50">{t.overview.tariffPlan}:</span>
                      <span className="font-semibold text-yellow-400">{tariffType}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <Button
                      onClick={onLogout}
                      variant="outline"
                      className="w-full bg-red-500/10 border-red-500/30 hover:bg-red-500/20 text-red-300 font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      {t.settings.logoutBtn}
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
