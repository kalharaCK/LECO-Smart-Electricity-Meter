import { useState, useRef, useEffect } from "react"
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
  ShieldAlert
} from "lucide-react"

interface Message {
  id: string
  role: "user" | "bot"
  text: string
  timestamp: string
}

const SUGGESTED_PROMPTS = [
  { label: "How many days will my top-up last?", icon: Calendar },
  { label: "What was my last top-up?", icon: CreditCard },
  { label: "Compare my weekly electricity usage", icon: TrendingUp },
  { label: "Is Lifeline Mode active?", icon: ShieldAlert },
]

export default function EnergyAssistantBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      text: "Hello! I am your **LECO Smart Energy Assistant**.\n\nI can analyze your live meter telemetry, check how many days your balance will last, explain your PUCSL tariff tiers, or review past top-ups. How can I help you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      const token = localStorage.getItem("token")
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      }
      if (token) headers["Authorization"] = `Bearer ${token}`

      // History mapping
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.text
      }))

      const res = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          message: userMessage.text,
          history
        })
      })

      const data = await res.json()
      const botReply = data.reply || "I am currently unable to process your request. Please try again shortly."

      const botMessage: Message = {
        id: "bot-" + Date.now(),
        role: "bot",
        text: botReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
          text: "I encountered a network issue connecting to the energy database. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setIsTyping(false)
    }
  }

  // Simple safe markdown formatter for bolding, code spans, lists
  const renderFormattedText = (text: string) => {
    const lines = text.split("\n")
    return lines.map((line, idx) => {
      // Bullet list items
      if (line.trim().startsWith("- ")) {
        const itemContent = line.trim().substring(2)
        return (
          <li key={idx} className="ml-4 list-disc my-0.5 text-white/90">
            {formatSpans(itemContent)}
          </li>
        )
      }
      if (line.trim() === "") {
        return <div key={idx} className="h-1.5" />
      }
      return (
        <p key={idx} className="my-0.5 leading-relaxed">
          {formatSpans(line)}
        </p>
      )
    })
  }

  const formatSpans = (text: string) => {
    // Matches **bold** and `code`
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g)
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={i} className="bg-white/10 text-yellow-300 px-1 py-0.5 rounded font-mono text-[11px]">
            {part.slice(1, -1)}
          </code>
        )
      }
      return part
    })
  }

  return (
    <>
      {/* Floating Chat Bubble Trigger */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {!isOpen && (
          <div 
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-[#18181b]/95 border border-white/15 shadow-2xl py-2 px-3.5 rounded-full text-xs text-white/90 cursor-pointer hover:border-yellow-400/50 hover:bg-[#202025] transition-all animate-in fade-in slide-in-from-right-3 duration-300"
          >
            <Sparkles className="h-3.5 w-3.5 text-yellow-400 animate-pulse" />
            <span>Ask LECO Energy AI</span>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-3.5 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center ${
            isOpen
              ? "bg-[#1f1f23] text-white border border-white/20"
              : "bg-gradient-to-r from-[#992511] via-[#c13018] to-[#ea381e] text-white shadow-[0_0_20px_rgba(234,56,30,0.4)]"
          }`}
          aria-label="Toggle LECO AI Chatbot"
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <>
              <Bot className="h-6 w-6 animate-pulse" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-black font-bold text-[10px] h-5 w-5 rounded-full flex items-center justify-center border-2 border-[#0a0a0c]">
                  {unreadCount}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* Floating Chat Window Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] sm:w-[420px] h-[580px] max-h-[85vh] bg-[#0c0c0e]/95 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-3xl flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-[#992511]/40 via-[#18181b] to-black border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#992511] to-[#601206] text-white border border-white/15 shadow-inner">
                  <Bot className="h-5 w-5 text-yellow-300" />
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-black" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm text-white tracking-tight">LECO Energy Assistant</h3>
                  <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/30 text-[9px] px-1.5 py-0 font-mono">
                    AI Agent
                  </Badge>
                </div>
                <p className="text-[11px] text-white/50">Online • Live Database Connected</p>
              </div>
            </div>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs scrollbar-thin scrollbar-thumb-white/10">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"} animate-in fade-in duration-200`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-[#992511] to-[#c13018] text-white rounded-br-none shadow-md"
                      : "bg-[#18181b] text-white/90 border border-white/10 rounded-bl-none shadow-sm"
                  }`}
                >
                  {renderFormattedText(m.text)}
                </div>
                <span className="text-[9px] text-white/40 mt-1 px-1">{m.timestamp}</span>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-2 text-white/50 text-xs py-1 animate-in fade-in">
                <div className="bg-[#18181b] border border-white/10 px-3.5 py-2.5 rounded-2xl rounded-bl-none flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-bounce" />
                </div>
                <span className="text-[10px] text-white/40">Querying energy engine...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-2 border-t border-white/5 bg-black/30 overflow-x-auto flex gap-1.5 scrollbar-none">
            {SUGGESTED_PROMPTS.map((p, idx) => {
              const Icon = p.icon
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(p.label)}
                  disabled={isTyping}
                  className="whitespace-nowrap px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[11px] text-white/80 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  <Icon className="h-3 w-3 text-yellow-400" />
                  <span>{p.label}</span>
                </button>
              )
            })}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-[#111114] border-t border-white/10">
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
                placeholder="Ask about days left, usage, tariffs..."
                disabled={isTyping}
                className="bg-black/50 border-white/15 text-white placeholder:text-white/40 text-xs h-10 rounded-xl focus-visible:ring-yellow-400/50"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isTyping}
                size="icon"
                className="bg-yellow-400 hover:bg-yellow-300 text-black h-10 w-10 shrink-0 rounded-xl font-bold shadow-md transition-transform hover:scale-105"
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
