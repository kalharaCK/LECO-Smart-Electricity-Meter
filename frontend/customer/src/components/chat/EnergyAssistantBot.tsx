import { API_BASE_URL } from "@/lib/api"
import { useState, useRef, useEffect, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  Calendar, 
  CreditCard, 
  TrendingUp, 
  ShieldAlert,
  RotateCcw,
  Zap,
  Clock,
  Coins,
  ArrowRight,
  MessageSquareWarning,
  Settings,
  PlusCircle,
  LayoutDashboard
} from "lucide-react"
import { useDashboardI18n } from "@/lib/dashboardI18n"

export interface ChatAction {
  label: string
  route: string
  variant?: "primary" | "secondary" | "outline"
}

export interface Message {
  id: string
  role: "user" | "bot"
  text: string
  timestamp: string
  actions?: ChatAction[]
  source?: string
}

interface EnergyAssistantBotProps {
  onNavigate?: (route: string) => void
}

export default function EnergyAssistantBot({ onNavigate }: EnergyAssistantBotProps) {
  const { t, language } = useDashboardI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      text: t.bot.welcomeMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: [
        { label: language === 'si' ? "ශේෂය පරීක්ෂා කරන්න" : language === 'ta' ? "இருப்பு பார்க்க" : "Check Balance", route: "overview", variant: "outline" },
        { label: language === 'si' ? "රීචාර්ජ් කරන්න" : language === 'ta' ? "ரீசார்ஜ் செய்க" : "Recharge Now", route: "payments", variant: "primary" }
      ]
    }
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Update initial welcome message if user changes language before sending messages
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id.startsWith("welcome")) {
        return [{
          ...prev[0],
          text: t.bot.welcomeMessage,
          actions: [
            { label: language === 'si' ? "ශේෂය පරීක්ෂා කරන්න" : language === 'ta' ? "இருப்பு பார்க்க" : "Check Balance", route: "overview", variant: "outline" },
            { label: language === 'si' ? "රීචාර්ජ් කරන්න" : language === 'ta' ? "ரீசார்ஜ் செய்க" : "Recharge Now", route: "payments", variant: "primary" }
          ]
        }]
      }
      return prev
    })
  }, [t.bot.welcomeMessage, language])

  const handleResetChat = () => {
    setMessages([
      {
        id: "welcome-" + Date.now(),
        role: "bot",
        text: t.bot.welcomeMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          { label: language === 'si' ? "ශේෂය පරීක්ෂා කරන්න" : language === 'ta' ? "இருப்பு பார்க்க" : "Check Balance", route: "overview", variant: "outline" },
          { label: language === 'si' ? "රීචාර්ජ් කරන්න" : language === 'ta' ? "ரீசார்ஜ் செய்க" : "Recharge Now", route: "payments", variant: "primary" }
        ]
      }
    ])
  }

  const suggestedPrompts = [
    { label: t.bot.promptSavingTips, icon: Zap },
    { label: t.bot.promptDaysLeft, icon: Calendar },
    { label: t.bot.promptLastTopup, icon: CreditCard },
    { label: t.bot.promptCompareUsage, icon: TrendingUp },
    { label: t.bot.promptLifelineActive, icon: ShieldAlert },
  ]

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const handleSendRef = useRef<(text?: string) => Promise<void>>(undefined)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      setUnreadCount(0)
      inputRef.current?.focus()
    }
  }, [isOpen, messages, isTyping])

  // External trigger listener to open and chat from anywhere in the app (e.g. Energy Saving Tips card)
  useEffect(() => {
    const handleOpenEvent = (event: Event) => {
      const customEv = event as CustomEvent<{ prompt?: string; autoSend?: boolean }>
      setIsOpen(true)
      const promptText = customEv.detail?.prompt
      if (promptText) {
        if (customEv.detail?.autoSend !== false) {
          setTimeout(() => {
            handleSendRef.current?.(promptText)
          }, 150)
        } else {
          setInput(promptText)
        }
      }
    }

    window.addEventListener("open-energy-assistant", handleOpenEvent)
    return () => {
      window.removeEventListener("open-energy-assistant", handleOpenEvent)
    }
  }, [])

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input
    if (!textToSend.trim() || isTyping) return

    const userMessage: Message = {
      id: "user-" + Date.now(),
      role: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      }

      // History mapping
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.text
      }))

      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          message: userMessage.text,
          history,
          language
        })
      })

      const data = await res.json()
      const botReply = data.reply || t.bot.fallbackReply
      const actions: ChatAction[] = Array.isArray(data.actions) ? data.actions : []

      const botMessage: Message = {
        id: "bot-" + Date.now(),
        role: "bot",
        text: botReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions,
        source: data.source
      }

      setMessages((prev) => [...prev, botMessage])
      if (!isOpen) {
        setUnreadCount((c) => c + 1)
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          role: "bot",
          text: t.bot.networkError,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions: [
            { label: language === 'si' ? "නැවත උත්සාහ කරන්න" : language === 'ta' ? "மீண்டும் முயல்க" : "Retry", route: "overview", variant: "outline" }
          ]
        }
      ])
    } finally {
      setIsTyping(false)
    }
  }

  handleSendRef.current = handleSend

  const handleActionClick = (route: string) => {
    if (onNavigate) {
      onNavigate(route)
    }
  }

  const getActionIcon = (route: string) => {
    switch (route) {
      case "payments":
        return <CreditCard className="h-3 w-3 shrink-0" />
      case "history":
        return <TrendingUp className="h-3 w-3 shrink-0" />
      case "complaints":
        return <MessageSquareWarning className="h-3 w-3 shrink-0" />
      case "settings":
        return <Settings className="h-3 w-3 shrink-0" />
      case "add-meter":
        return <PlusCircle className="h-3 w-3 shrink-0" />
      case "overview":
      default:
        return <LayoutDashboard className="h-3 w-3 shrink-0" />
    }
  }

  /**
   * Specialized Tokenizer & Highlighting Formatter:
   * 1. Status Badges: [LIFELINE MODE ACTIVE], [CONNECTED], [NOTICE]
   * 2. Currency Values: Rs. 1,450.00, LKR 500, රු. 1,250
   * 3. Energy Units: 14.5 kWh, 2.4 kW, 230V
   * 4. Time & TOU Windows: 18:30 - 22:30, Peak Hours, Off-Peak Hours
   * 5. Tariff Blocks & Days: Block 1-6, Group A-C, ~18 days
   * 6. Interactive Action Links: [Text](action:route)
   */
  const highlightSpecialValues = (text: string): ReactNode[] => {
    // Regex matching all high-value tokens
    const combinedRegex = /(\[(?:LIFELINE MODE ACTIVE|LIFELINE ACTIVE|CONNECTED|DISCONNECTED|NOTICE|ALERT|හදිසි ණය ක්‍රියාත්මකයි|අවවාදයයි|அவசர கடன் செயலில் உள்ளது|அறிவிப்பு)\]|\[[^\]]+\]\(action:[a-z-]+\)|(?:Rs\.|LKR|රු\.|ரூ\.)\s*[\d,]+(?:\.\d{1,2})?|\b\d+(?:\.\d+)?\s*(?:kWh|kW|kVA|V)\b|(?:18:30\s*[-–to]\s*22:30|22:30\s*[-–to]\s*05:30|05:30\s*[-–to]\s*18:30|Peak Hours|Off-Peak Hours|Day Hours|උච්ච වේලාවන්|අවම වේලාවන්|දිවා වේලාවන්|உச்ச நேரம்|குறைந்த நேரம்|பகல் நேரம்)|(?:Block\s*[1-6]|Group\s*[A-C]|~\d+\s*(?:days|දින|நாட்கள்)|\b\d+\s*(?:days|දින|நாட்கள்)\b)|[+-]?\d+%\s*(?:\([+-]?\d+(?:\.\d+)?\s*kWh\))?)/gi

    const parts = text.split(combinedRegex)

    return parts.map((part, index) => {
      if (!part) return null

      // A. Action Link: [Button Text](action:route)
      const actionLinkMatch = part.match(/^\[([^\]]+)\]\(action:([a-z-]+)\)$/i)
      if (actionLinkMatch) {
        const btnText = actionLinkMatch[1]
        const route = actionLinkMatch[2]
        return (
          <button
            key={`act-${index}`}
            type="button"
            onClick={() => handleActionClick(route)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 my-0.5 mx-1 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black font-semibold text-[11px] shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            {getActionIcon(route)}
            <span>{btnText}</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        )
      }

      // B. Status Pills: [LIFELINE MODE ACTIVE], etc.
      if (/^\[(?:LIFELINE MODE ACTIVE|LIFELINE ACTIVE|CONNECTED|DISCONNECTED|NOTICE|ALERT|හදිසි ණය ක්‍රියාත්මකයි|අවවාදයයි|அவசர கடன் செயலில் உள்ளது|அறிவிப்பு)\]$/i.test(part)) {
        const isAlert = /LIFELINE|DISCONNECTED|ALERT|හදිසි|அவசர/i.test(part)
        return (
          <span
            key={`status-${index}`}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 my-0.5 mx-0.5 rounded-full font-bold text-[10px] tracking-wide ${
              isAlert
                ? "bg-red-500/15 border border-red-500/40 text-red-300"
                : "bg-yellow-400/15 border border-yellow-400/40 text-yellow-300"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isAlert ? "bg-red-400 animate-pulse" : "bg-yellow-400"}`} />
            {part.slice(1, -1)}
          </span>
        )
      }

      // C. Currency: Rs. 1,450.00 / LKR / රු. / ரூ.
      if (/^(?:Rs\.|LKR|රු\.|ரூ\.)\s*[\d,]+(?:\.\d{1,2})?$/i.test(part)) {
        return (
          <span
            key={`curr-${index}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-[11px] shadow-[0_0_8px_rgba(16,185,129,0.15)]"
          >
            <Coins className="h-3 w-3 text-emerald-400 shrink-0" />
            <span>{part}</span>
          </span>
        )
      }

      // D. Energy Units: 14.5 kWh, 2.3 kW, 230V
      if (/^\b\d+(?:\.\d+)?\s*(?:kWh|kW|kVA|V)\b$/i.test(part)) {
        return (
          <span
            key={`nrg-${index}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono font-bold text-[11px] shadow-[0_0_8px_rgba(6,182,212,0.15)]"
          >
            <Zap className="h-3 w-3 text-cyan-400 shrink-0" />
            <span>{part}</span>
          </span>
        )
      }

      // E. Time-of-Use & Time Windows
      if (/^(?:18:30\s*[-–to]\s*22:30|22:30\s*[-–to]\s*05:30|05:30\s*[-–to]\s*18:30|Peak Hours|Off-Peak Hours|Day Hours|උච්ච වේලාවන්|අවම වේලාවන්|දිවා වේලාවන්|உச்ச நேரம்|குறைந்த நேரம்|பகல் நேரம்)$/i.test(part)) {
        return (
          <span
            key={`tou-${index}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 font-medium text-[11px] shadow-[0_0_8px_rgba(168,85,247,0.15)]"
          >
            <Clock className="h-3 w-3 text-purple-400 shrink-0" />
            <span>{part}</span>
          </span>
        )
      }

      // F. Tariff Blocks & Days Remaining
      if (/^(?:Block\s*[1-6]|Group\s*[A-C]|~\d+\s*(?:days|දින|நாட்கள்)|\b\d+\s*(?:days|දින|நாட்கள்)\b)$/i.test(part)) {
        return (
          <span
            key={`tier-${index}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium text-[11px] shadow-[0_0_8px_rgba(245,158,11,0.15)]"
          >
            <Calendar className="h-3 w-3 text-amber-400 shrink-0" />
            <span>{part}</span>
          </span>
        )
      }

      // G. Percentage Changes (+15% or -10%)
      if (/^[+-]?\d+%\s*(?:\([+-]?\d+(?:\.\d+)?\s*kWh\))?$/i.test(part)) {
        const isUp = part.startsWith("+")
        return (
          <span
            key={`pct-${index}`}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md font-mono font-medium text-[11px] ${
              isUp
                ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
            }`}
          >
            {part}
          </span>
        )
      }

      // Regular text formatting (markdown bold and inline code)
      return formatMarkdownSpans(part, index)
    })
  }

  const formatMarkdownSpans = (text: string, parentIdx: number): ReactNode => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g)
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={`${parentIdx}-b-${i}`} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={`${parentIdx}-c-${i}`} className="bg-white/10 text-yellow-300 px-1 py-0.5 rounded font-mono text-[11px]">
            {part.slice(1, -1)}
          </code>
        )
      }
      return part
    })
  }

  const renderFormattedText = (text: string) => {
    const lines = text.split("\n")
    return lines.map((line, idx) => {
      if (line.trim().startsWith("- ")) {
        const itemContent = line.trim().substring(2)
        return (
          <li key={idx} className="ml-4 list-disc my-0.5 text-white/90">
            {highlightSpecialValues(itemContent)}
          </li>
        )
      }
      if (line.trim() === "") {
        return <div key={idx} className="h-1.5" />
      }
      return (
        <p key={idx} className="my-0.5 leading-relaxed">
          {highlightSpecialValues(line)}
        </p>
      )
    })
  }

  return (
    <>
      {/* Mobile Backdrop when Chat is Open */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs sm:hidden animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating Chat Bubble Trigger */}
      <div className="fixed bottom-20 right-3.5 sm:bottom-6 sm:right-6 z-40 sm:z-50 flex items-center gap-3">
        {!isOpen && (
          <div 
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-[#18181b]/95 border border-white/15 shadow-2xl py-2 px-3.5 rounded-full text-xs text-white/90 cursor-pointer hover:border-yellow-400/50 hover:bg-[#202025] transition-all animate-in fade-in slide-in-from-right-3 duration-300"
          >
            <Sparkles className="h-3.5 w-3.5 text-yellow-400 animate-pulse" />
            <span>{t.bot.askAi}</span>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-3 sm:p-3.5 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer ${
            isOpen
              ? "bg-[#1f1f23] text-white border border-white/20"
              : "bg-gradient-to-r from-[#992511] via-[#c13018] to-[#ea381e] text-white shadow-[0_0_20px_rgba(234,56,30,0.5)] ring-2 ring-white/10"
          }`}
          aria-label="Toggle LECO AI Chatbot"
        >
          {isOpen ? (
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          ) : (
            <>
              <Bot className="h-5 w-5 sm:h-6 sm:w-6 animate-pulse" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-black font-black text-[10px] h-5 w-5 rounded-full flex items-center justify-center border-2 border-[#0a0a0c]">
                  {unreadCount}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* Responsive Chat Window */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 top-12 z-50 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[440px] sm:h-[600px] sm:max-h-[85vh] bg-[#0c0c0e]/98 backdrop-blur-2xl border-t sm:border border-white/15 shadow-[0_-10px_40px_rgba(0,0,0,0.9)] sm:shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-6 duration-300">
          {/* Mobile Sheet Pull Bar */}
          <div className="sm:hidden pt-2 pb-1 flex justify-center bg-[#18181b]">
            <div className="w-12 h-1 rounded-full bg-white/25" />
          </div>

          {/* Header */}
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-[#992511]/40 via-[#18181b] to-black border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="relative">
                <img src="/leco-logo.png" alt="LECO Self Care" className="h-8 w-auto object-contain" />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-black" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-xs sm:text-sm text-white tracking-tight">{t.bot.title}</h3>
                  <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/30 text-[9px] px-1.5 py-0 font-mono">
                    {t.bot.agentBadge}
                  </Badge>
                </div>
                <p className="text-[10px] sm:text-[11px] text-white/50">{t.bot.statusOnline}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleResetChat}
                title="Restart conversation"
                className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8 rounded-full cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8 rounded-full cursor-pointer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 text-xs scrollbar-thin scrollbar-thumb-white/10">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"} animate-in fade-in duration-200`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[88%] p-3 sm:p-3.5 rounded-2xl text-xs ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-[#992511] to-[#c13018] text-white rounded-br-none shadow-md"
                      : "bg-[#18181b] text-white/90 border border-white/10 rounded-bl-none shadow-sm"
                  }`}
                >
                  {renderFormattedText(m.text)}

                  {/* Mentioned Menu Navigation Actions Deck */}
                  {m.role === "bot" && m.actions && m.actions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-2">
                      {m.actions.map((act, actIdx) => (
                        <button
                          key={actIdx}
                          type="button"
                          onClick={() => handleActionClick(act.route)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ${
                            act.variant === "primary"
                              ? "bg-yellow-400 hover:bg-yellow-300 text-black font-bold shadow-md shadow-yellow-400/20"
                              : "bg-white/10 hover:bg-white/15 border border-white/15 text-white"
                          }`}
                        >
                          {getActionIcon(act.route)}
                          <span>{act.label}</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 px-1">
                  <span className="text-[9px] text-white/40">{m.timestamp}</span>
                  {m.source && (
                    <span className="text-[8px] font-mono text-white/30 uppercase">
                      {m.source.includes('groq') ? 'Groq AI' : 'Live RAG'}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-2 text-white/50 text-xs py-1 animate-in fade-in">
                <div className="bg-[#18181b] border border-white/10 px-3 py-2 rounded-2xl rounded-bl-none flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-bounce" />
                </div>
                <span className="text-[10px] text-white/40">{t.bot.typingNotice}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-2 border-t border-white/5 bg-black/30 overflow-x-auto flex gap-1.5 scrollbar-none">
            {suggestedPrompts.map((p, idx) => {
              const Icon = p.icon
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(p.label)}
                  disabled={isTyping}
                  className="whitespace-nowrap px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[11px] text-white/80 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  <Icon className="h-3 w-3 text-yellow-400 shrink-0" />
                  <span>{p.label}</span>
                </button>
              )
            })}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-[#111114] border-t border-white/10 pb-4 sm:pb-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.bot.inputPlaceholder}
                disabled={isTyping}
                className="bg-black/50 border-white/15 text-white placeholder:text-white/40 text-xs sm:text-xs h-10 rounded-xl focus-visible:ring-yellow-400/50"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isTyping}
                size="icon"
                className="bg-yellow-400 hover:bg-yellow-300 text-black h-10 w-10 shrink-0 rounded-xl font-bold shadow-md transition-transform hover:scale-105 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
