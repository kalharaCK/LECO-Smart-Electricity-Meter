import { API_BASE_URL } from "@/lib/api"
import { useState, useEffect, useCallback } from "react"
import {
  Sliders,
  Key,
  Cpu,
  Send,
  CreditCard,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertTriangle,
  Sparkles,
  Zap,
  MessageSquareWarning,
  SunMedium,
  Lock
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import StaffPasswordConfirmModal from "./StaffPasswordConfirmModal"

interface SystemSettingsManagementProps {
  getAuthHeaders: (extra?: Record<string, string>) => Record<string, string>
}

interface SettingItem {
  key: string
  value: string
  hasValue: boolean
  isConfigured: boolean
  source: string
  description: string
  isSecret: boolean
  enabled?: boolean
}

export default function SystemSettingsManagement({ getAuthHeaders }: SystemSettingsManagementProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [alert, setAlert] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // API Key & Gateway Form States
  const [groqKey, setGroqKey] = useState("")
  const [groqModel, setGroqModel] = useState("llama-3.3-70b-versatile")
  const [smsToken, setSmsToken] = useState("")
  const [smsSenderId, setSmsSenderId] = useState("TextLKDemo")
  const [payhereMerchantId, setPayhereMerchantId] = useState("")
  const [payhereMerchantSecret, setPayhereMerchantSecret] = useState("")
  const [payhereSandbox, setPayhereSandbox] = useState(true)

  // Password / Secret visibility toggles
  const [showGroqKey, setShowGroqKey] = useState(false)
  const [showSmsToken, setShowSmsToken] = useState(false)
  const [showPayhereSecret, setShowPayhereSecret] = useState(false)

  // Customer Feature Toggles
  const [featureAiChatbot, setFeatureAiChatbot] = useState(true)
  const [featureOnlineTopup, setFeatureOnlineTopup] = useState(true)
  const [featureMlPrediction, setFeatureMlPrediction] = useState(true)
  const [featureLifelineMode, setFeatureLifelineMode] = useState(true)
  const [featureComplaints, setFeatureComplaints] = useState(true)
  const [featureSolar, setFeatureSolar] = useState(true)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceBanner, setMaintenanceBanner] = useState("")

  // Raw fetched items for reference
  const [rawApiKeys, setRawApiKeys] = useState<Record<string, SettingItem>>({})

  // Fetch settings from backend
  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/system-settings`, {
        headers: getAuthHeaders(),
        credentials: "include"
      })
      if (res.ok) {
        const data = await res.json()
        if (data.data) {
          const { apiKeys, features } = data.data
          setRawApiKeys(apiKeys || {})

          // Populate API Keys
          if (apiKeys.GROQ_API_KEY) setGroqKey(apiKeys.GROQ_API_KEY.value || "")
          if (apiKeys.GROQ_MODEL) setGroqModel(apiKeys.GROQ_MODEL.value || "llama-3.3-70b-versatile")
          if (apiKeys.SMS_API_TOKEN) setSmsToken(apiKeys.SMS_API_TOKEN.value || "")
          if (apiKeys.SMS_SENDER_ID) setSmsSenderId(apiKeys.SMS_SENDER_ID.value || "TextLKDemo")
          if (apiKeys.PAYHERE_MERCHANT_ID) setPayhereMerchantId(apiKeys.PAYHERE_MERCHANT_ID.value || "")
          if (apiKeys.PAYHERE_MERCHANT_SECRET) setPayhereMerchantSecret(apiKeys.PAYHERE_MERCHANT_SECRET.value || "")
          if (apiKeys.PAYHERE_SANDBOX) setPayhereSandbox(apiKeys.PAYHERE_SANDBOX.value !== "false")

          // Populate Feature Toggles
          if (features.feature_ai_chatbot) setFeatureAiChatbot(features.feature_ai_chatbot.enabled ?? true)
          if (features.feature_online_topup) setFeatureOnlineTopup(features.feature_online_topup.enabled ?? true)
          if (features.feature_ml_prediction) setFeatureMlPrediction(features.feature_ml_prediction.enabled ?? true)
          if (features.feature_lifeline_mode) setFeatureLifelineMode(features.feature_lifeline_mode.enabled ?? true)
          if (features.feature_complaints_portal) setFeatureComplaints(features.feature_complaints_portal.enabled ?? true)
          if (features.feature_solar_telemetry) setFeatureSolar(features.feature_solar_telemetry.enabled ?? true)
          if (features.maintenance_mode) setMaintenanceMode(features.maintenance_mode.enabled ?? false)
          if (features.maintenance_banner) setMaintenanceBanner(features.maintenance_banner.value || "")
        }
      }
    } catch (err: any) {
      console.error("Error fetching system settings:", err)
      setAlert({ type: "error", text: "Failed to load system settings from backend." })
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Triggers password confirmation modal
  const handleSavePrompt = (e: React.FormEvent) => {
    e.preventDefault()
    setIsPasswordModalOpen(true)
  }

  // Executes saving once password has been authenticated
  const executeSaveSettings = async () => {
    setSaving(true)
    setAlert(null)

    const payload: Record<string, any> = {
      GROQ_MODEL: groqModel.trim(),
      SMS_SENDER_ID: smsSenderId.trim(),
      PAYHERE_MERCHANT_ID: payhereMerchantId.trim(),
      PAYHERE_SANDBOX: payhereSandbox ? "true" : "false",
      feature_ai_chatbot: featureAiChatbot ? "true" : "false",
      feature_online_topup: featureOnlineTopup ? "true" : "false",
      feature_ml_prediction: featureMlPrediction ? "true" : "false",
      feature_lifeline_mode: featureLifelineMode ? "true" : "false",
      feature_complaints_portal: featureComplaints ? "true" : "false",
      feature_solar_telemetry: featureSolar ? "true" : "false",
      maintenance_mode: maintenanceMode ? "true" : "false",
      maintenance_banner: maintenanceBanner.trim()
    }

    if (groqKey && !groqKey.includes("••••")) {
      payload.GROQ_API_KEY = groqKey.trim()
    }
    if (smsToken && !smsToken.includes("••••")) {
      payload.SMS_API_TOKEN = smsToken.trim()
    }
    if (payhereMerchantSecret && !payhereMerchantSecret.includes("••••")) {
      payload.PAYHERE_MERCHANT_SECRET = payhereMerchantSecret.trim()
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/system-settings`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ settings: payload })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update system settings.")
      }

      setAlert({
        type: "success",
        text: `System settings and feature flags updated successfully (${data.updatedKeys?.length || 0} keys synchronized).`
      })
      fetchSettings()
    } catch (err: any) {
      setAlert({ type: "error", text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Alert */}
      {alert && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-start gap-3 shadow-lg ${
            alert.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {alert.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>{alert.text}</span>
        </div>
      )}

      {/* Global Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Groq AI Status */}
        <Card className="bg-[#0f0f11] border-white/5 shadow-xl rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Groq LLM Engine</p>
              <div className="flex items-center gap-2 mt-1">
                {rawApiKeys.GROQ_API_KEY?.isConfigured ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-sm font-bold text-white">Configured</span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                    <span className="text-sm font-bold text-amber-300">Offline / Fallback</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400">
              <Cpu className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* SMS Gateway Status */}
        <Card className="bg-[#0f0f11] border-white/5 shadow-xl rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">SMS Gateway</p>
              <div className="flex items-center gap-2 mt-1">
                {rawApiKeys.SMS_API_TOKEN?.isConfigured ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                    <span className="text-sm font-bold text-white">Active</span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                    <span className="text-sm font-bold text-amber-300">Not Set</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400">
              <Send className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* PayHere Status */}
        <Card className="bg-[#0f0f11] border-white/5 shadow-xl rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">PayHere Gateway</p>
              <div className="flex items-center gap-2 mt-1">
                {rawApiKeys.PAYHERE_MERCHANT_ID?.isConfigured ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                    <span className="text-sm font-bold text-white">
                      {payhereSandbox ? "Sandbox Mode" : "Production Live"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                    <span className="text-sm font-bold text-amber-300">Unconfigured</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400">
              <CreditCard className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Flag */}
        <Card className="bg-[#0f0f11] border-white/5 shadow-xl rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Maintenance Mode</p>
              <div className="flex items-center gap-2 mt-1">
                {maintenanceMode ? (
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">
                    Maintenance Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                    Normal Operations
                  </Badge>
                )}
              </div>
            </div>
            <div className={`p-3 rounded-2xl ${maintenanceMode ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
              <AlertTriangle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <form onSubmit={handleSavePrompt} className="space-y-6">
        {/* Section 1: API Keys & Payment Credentials */}
        <Card className="bg-[#0f0f11] border-white/5 shadow-xl rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="h-4 w-4 text-yellow-400" />
                  API Keys & Gateway Integrations
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  Dynamically update Groq AI, Text.lk SMS, and PayHere checkout credentials without editing server files or restarting services.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchSettings}
                disabled={loading}
                className="h-8 text-xs border-white/10 hover:bg-white/5 cursor-pointer text-white/70"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Groq API Key */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    Groq API Key (Chatbot LLM)
                  </span>
                  <span className="text-[10px] text-white/40">
                    Source: {rawApiKeys.GROQ_API_KEY?.source || "env"}
                  </span>
                </label>
                <div className="relative">
                  <Input
                    type={showGroqKey ? "text" : "password"}
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="e.g. gsk_..."
                    className="bg-[#141416] border-white/10 pr-10 text-xs h-10 text-white font-mono placeholder:text-white/20 focus-visible:ring-yellow-400/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    className="absolute right-3 top-3 text-white/40 hover:text-white cursor-pointer"
                  >
                    {showGroqKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-white/40">
                  Powers fast natural language inference and tri-lingual reasoning.
                </p>
              </div>

              {/* Groq Model */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
                  <span>Groq Primary Model</span>
                  <span className="text-[10px] text-white/40">Model ID</span>
                </label>
                <Input
                  type="text"
                  value={groqModel}
                  onChange={(e) => setGroqModel(e.target.value)}
                  placeholder="llama-3.3-70b-versatile"
                  className="bg-[#141416] border-white/10 text-xs h-10 text-white font-mono placeholder:text-white/20 focus-visible:ring-yellow-400/30"
                />
                <p className="text-[11px] text-white/40">
                  Recommended: <code className="text-yellow-400/80">llama-3.3-70b-versatile</code> or <code className="text-yellow-400/80">qwen/qwen3.8-27b</code>.
                </p>
              </div>

              {/* SMS API Token */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-blue-400" />
                    Text.lk SMS API Token
                  </span>
                  <span className="text-[10px] text-white/40">
                    Source: {rawApiKeys.SMS_API_TOKEN?.source || "env"}
                  </span>
                </label>
                <div className="relative">
                  <Input
                    type={showSmsToken ? "text" : "password"}
                    value={smsToken}
                    onChange={(e) => setSmsToken(e.target.value)}
                    placeholder="e.g. 5818|VtZe..."
                    className="bg-[#141416] border-white/10 pr-10 text-xs h-10 text-white font-mono placeholder:text-white/20 focus-visible:ring-yellow-400/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmsToken(!showSmsToken)}
                    className="absolute right-3 top-3 text-white/40 hover:text-white cursor-pointer"
                  >
                    {showSmsToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-white/40">
                  Used for trilingual OTP dispatch, low-balance warnings, and payment receipts.
                </p>
              </div>

              {/* SMS Sender ID */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
                  <span>SMS Sender Mask</span>
                  <span className="text-[10px] text-white/40">Alphanumeric ID</span>
                </label>
                <Input
                  type="text"
                  value={smsSenderId}
                  onChange={(e) => setSmsSenderId(e.target.value)}
                  placeholder="TextLKDemo"
                  className="bg-[#141416] border-white/10 text-xs h-10 text-white font-mono placeholder:text-white/20 focus-visible:ring-yellow-400/30"
                />
                <p className="text-[11px] text-white/40">
                  Approved operator mask shown on customer handsets.
                </p>
              </div>

              {/* PayHere Merchant ID */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-purple-400" />
                    PayHere Merchant ID
                  </span>
                  <span className="text-[10px] text-white/40">Account ID</span>
                </label>
                <Input
                  type="text"
                  value={payhereMerchantId}
                  onChange={(e) => setPayhereMerchantId(e.target.value)}
                  placeholder="e.g. 1236689"
                  className="bg-[#141416] border-white/10 text-xs h-10 text-white font-mono placeholder:text-white/20 focus-visible:ring-yellow-400/30"
                />
              </div>

              {/* PayHere Merchant Secret */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
                  <span>PayHere Merchant Secret</span>
                  <span className="text-[10px] text-white/40">Salt for MD5 Hash</span>
                </label>
                <div className="relative">
                  <Input
                    type={showPayhereSecret ? "text" : "password"}
                    value={payhereMerchantSecret}
                    onChange={(e) => setPayhereMerchantSecret(e.target.value)}
                    placeholder="Enter PayHere merchant secret"
                    className="bg-[#141416] border-white/10 pr-10 text-xs h-10 text-white font-mono placeholder:text-white/20 focus-visible:ring-yellow-400/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPayhereSecret(!showPayhereSecret)}
                    className="absolute right-3 top-3 text-white/40 hover:text-white cursor-pointer"
                  >
                    {showPayhereSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* PayHere Sandbox Toggle */}
              <div className="md:col-span-2 pt-2">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#141416] border border-white/10">
                  <div>
                    <p className="text-xs font-bold text-white">PayHere Sandbox Environment</p>
                    <p className="text-[11px] text-white/50">
                      When active, transactions connect to sandbox.payhere.lk for safe testing. Turn off for live real-money collections.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPayhereSandbox(!payhereSandbox)}
                    className="cursor-pointer"
                  >
                    {payhereSandbox ? (
                      <ToggleRight className="h-8 w-8 text-yellow-400" />
                    ) : (
                      <ToggleLeft className="h-8 w-8 text-white/40" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Customer Dashboard Feature Control Switches */}
        <Card className="bg-[#0f0f11] border-white/5 shadow-xl rounded-2xl">
          <CardContent className="p-6">
            <div className="pb-4 border-b border-white/5 mb-6">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-emerald-400" />
                Customer Dashboard Feature Controls & Switches
              </h2>
              <p className="text-xs text-white/50 mt-0.5">
                Staff can toggle features in the customer dashboard on or off in real-time. Changes immediately reflect for all users.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Feature 1: AI Chatbot */}
              <div className="p-4 rounded-xl bg-[#141416] border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                    AI Energy Assistant Bot
                  </p>
                  <p className="text-[10px] text-white/50 mt-0.5">Customer floating chatbot bubble</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatureAiChatbot(!featureAiChatbot)}
                  className="cursor-pointer"
                >
                  {featureAiChatbot ? (
                    <ToggleRight className="h-7 w-7 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-white/30" />
                  )}
                </button>
              </div>

              {/* Feature 2: Online Recharge */}
              <div className="p-4 rounded-xl bg-[#141416] border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-purple-400" />
                    PayHere Online Recharge
                  </p>
                  <p className="text-[10px] text-white/50 mt-0.5">Online card & bank topup buttons</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatureOnlineTopup(!featureOnlineTopup)}
                  className="cursor-pointer"
                >
                  {featureOnlineTopup ? (
                    <ToggleRight className="h-7 w-7 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-white/30" />
                  )}
                </button>
              </div>

              {/* Feature 3: ML Predictions */}
              <div className="p-4 rounded-xl bg-[#141416] border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-blue-400" />
                    ML Forecast & Predictions
                  </p>
                  <p className="text-[10px] text-white/50 mt-0.5">Days remaining & burn rate analytics</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatureMlPrediction(!featureMlPrediction)}
                  className="cursor-pointer"
                >
                  {featureMlPrediction ? (
                    <ToggleRight className="h-7 w-7 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-white/30" />
                  )}
                </button>
              </div>

              {/* Feature 4: Lifeline Mode */}
              <div className="p-4 rounded-xl bg-[#141416] border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    Lifeline Emergency Credit
                  </p>
                  <p className="text-[10px] text-white/50 mt-0.5">Emergency credit buffer up to Rs. 500</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatureLifelineMode(!featureLifelineMode)}
                  className="cursor-pointer"
                >
                  {featureLifelineMode ? (
                    <ToggleRight className="h-7 w-7 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-white/30" />
                  )}
                </button>
              </div>

              {/* Feature 5: Complaints Portal */}
              <div className="p-4 rounded-xl bg-[#141416] border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MessageSquareWarning className="h-3.5 w-3.5 text-red-400" />
                    Complaints & Outage Tickets
                  </p>
                  <p className="text-[10px] text-white/50 mt-0.5">Customer ticketing and issue lodging</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatureComplaints(!featureComplaints)}
                  className="cursor-pointer"
                >
                  {featureComplaints ? (
                    <ToggleRight className="h-7 w-7 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-white/30" />
                  )}
                </button>
              </div>

              {/* Feature 6: Solar Net Metering */}
              <div className="p-4 rounded-xl bg-[#141416] border border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <SunMedium className="h-3.5 w-3.5 text-amber-300" />
                    Rooftop Solar Telemetry
                  </p>
                  <p className="text-[10px] text-white/50 mt-0.5">Bi-directional grid export registers</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatureSolar(!featureSolar)}
                  className="cursor-pointer"
                >
                  {featureSolar ? (
                    <ToggleRight className="h-7 w-7 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-white/30" />
                  )}
                </button>
              </div>
            </div>

            {/* Maintenance Mode & Announcement */}
            <div className="mt-6 pt-5 border-t border-white/5 space-y-4">
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/15 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Global Maintenance Mode
                  </p>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    Display a maintenance banner across the customer dashboard when performing grid or AMI upgrades.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className="cursor-pointer"
                >
                  {maintenanceMode ? (
                    <ToggleRight className="h-8 w-8 text-red-400" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-white/30" />
                  )}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/80">
                  Custom Customer Announcement / Banner Message
                </label>
                <Input
                  type="text"
                  value={maintenanceBanner}
                  onChange={(e) => setMaintenanceBanner(e.target.value)}
                  placeholder="e.g. Scheduled AMI grid maintenance tonight from 01:00 AM to 03:00 AM."
                  className="bg-[#141416] border-white/10 text-xs h-10 text-white placeholder:text-white/20 focus-visible:ring-yellow-400/30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Submit Bar */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0f0f11] border border-white/5 shadow-xl">
          <div className="text-xs text-white/50 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Settings require staff password authentication and take effect immediately across all clients.</span>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-xs h-10 px-8 rounded-xl cursor-pointer shadow-lg shadow-yellow-400/20 flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Save All System Settings
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Staff Password Confirmation Modal */}
      <StaffPasswordConfirmModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={executeSaveSettings}
        title="Authorize System Settings Update"
        description="You are modifying system-level API credentials and customer feature switches. Please confirm your staff account password to authorize."
        confirmButtonText="Authorize & Save Changes"
        getAuthHeaders={getAuthHeaders}
      />
    </div>
  )
}
