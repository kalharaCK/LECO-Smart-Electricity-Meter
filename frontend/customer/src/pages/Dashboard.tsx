import { API_BASE_URL } from "@/lib/api"
import React, { useEffect, useState, Component, type ErrorInfo } from "react"
import { useNavigate } from "react-router-dom"
import { 
  LayoutDashboard, 
  PlusCircle, 
  History as HistoryIcon, 
  CreditCard, 
  MessageSquareWarning, 
  Settings,
  LogOut,
  Bell,
  AlertTriangle,
  RotateCcw
} from "lucide-react"
import { Button } from "@/components/ui/button"

import OverviewSection from "../components/dashboard/OverviewSection"
import AddMeterSection from "../components/dashboard/AddMeterSection"
import PaymentsSection from "../components/dashboard/PaymentsSection"
import ComplaintsSection from "../components/dashboard/ComplaintsSection"
import PaymentHistorySection from "../components/dashboard/PaymentHistorySection"
import SettingsSection from "../components/dashboard/SettingsSection"
import EnergyAssistantBot from "../components/chat/EnergyAssistantBot"
import MeterSwitcherDropdown from "../components/dashboard/MeterSwitcherDropdown"
import { LanguageSelector } from "@/components/LanguageSelector"
import { 
  DashboardI18nProvider, 
  useDashboardI18n,
  getDashboardTranslations 
} from "@/lib/dashboardI18n"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  useSidebar
} from "@/components/ui/sidebar"

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class SectionErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Dashboard section crashed:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const savedLang = (typeof window !== "undefined" ? localStorage.getItem("customer_lang") : "en") || "en"
      const t = getDashboardTranslations(savedLang === "si" || savedLang === "ta" ? savedLang : "en")

      return (
        <div className="p-6 sm:p-8 rounded-2xl bg-[#180806] border border-red-500/30 text-white space-y-4 max-w-2xl mx-auto mt-6 shadow-2xl">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <h3 className="text-base sm:text-lg font-bold">{t.errorBoundary.title}</h3>
          </div>
          <p className="text-xs text-white/70 leading-relaxed">
            {this.state.error?.message || t.errorBoundary.genericDesc}
          </p>
          <div className="pt-2">
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t.errorBoundary.reloadBtn}
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Inner component to access useSidebar hook for mobile drawer control
function DashboardInner() {
  const navigate = useNavigate()
  const { setOpenMobile, isMobile } = useSidebar()
  const { language, setLanguage, t } = useDashboardI18n()
  const [user, setUser] = useState<{ email: string; role: string } | null>(null)
  const [activeSection, setActiveSection] = useState("overview")
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    localStorage.removeItem("token")
    const initializeSession = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" })
        if (!res.ok) throw new Error("Session expired")
        const { user: sessionUser } = await res.json()
        if (sessionUser.role !== "customer" && sessionUser.role !== "user") throw new Error("Customer session required")
        setUser(sessionUser)
        localStorage.setItem("user", JSON.stringify(sessionUser))

        const notifRes = await fetch(`${API_BASE_URL}/api/notifications`, { credentials: "include" })
        if (notifRes.ok) setNotifications(await notifRes.json())
      } catch (error) {
        localStorage.removeItem("user")
        navigate("/")
      }
    }
    void initializeSession()
  }, [navigate])

  const handleSelectSection = (sectionId: string) => {
    setActiveSection(sectionId)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const markAsRead = async (id: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: "PUT",
        credentials: "include"
      })
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (e) {
      console.error(e)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/logout`, {
        method: "POST",
        credentials: "include"
      })
    } catch (e) {
      console.error(e)
    } finally {
      localStorage.removeItem("user")
      navigate("/")
    }
  }

  // Active section title in current language
  const getActiveSectionTitle = () => {
    switch (activeSection) {
      case "overview": return t.nav.overview
      case "add-meter": return t.nav.addMeter
      case "payments": return t.nav.payments
      case "history": return t.nav.history
      case "complaints": return t.nav.complaints
      case "settings": return t.nav.settings
      default: return activeSection.replace('-', ' ')
    }
  }

  const navItems = [
    { id: "overview", title: t.nav.overview, icon: LayoutDashboard },
    { id: "add-meter", title: t.nav.addMeter, icon: PlusCircle },
    { id: "payments", title: t.nav.payments, icon: CreditCard },
    { id: "history", title: t.nav.history, icon: HistoryIcon },
    { id: "complaints", title: t.nav.complaints, icon: MessageSquareWarning },
    { id: "settings", title: t.nav.settings, icon: Settings },
  ]

  // Key items for mobile bottom navigation dock
  const mobileDockItems = [
    { id: "overview", label: t.dock.overview, icon: LayoutDashboard },
    { id: "payments", label: t.dock.recharge, icon: CreditCard },
    { id: "history", label: t.dock.history, icon: HistoryIcon },
    { id: "complaints", label: t.dock.help, icon: MessageSquareWarning },
    { id: "settings", label: t.dock.settings, icon: Settings },
  ]

  if (!user) return null

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return <OverviewSection refreshKey={refreshKey} onNavigate={handleSelectSection} />
      case "add-meter":
        return (
          <AddMeterSection
            onMeterAdded={() => setRefreshKey((k) => k + 1)}
            onNavigateOverview={() => handleSelectSection("overview")}
          />
        )
      case "payments":
        return (
          <PaymentsSection
            onSuccess={() => setRefreshKey((k) => k + 1)}
            onNavigateOverview={() => handleSelectSection("overview")}
            onNavigateHistory={() => handleSelectSection("history")}
          />
        )
      case "history":
        return (
          <PaymentHistorySection
            refreshKey={refreshKey}
            onNavigateRecharge={() => handleSelectSection("payments")}
          />
        )
      case "complaints":
        return <ComplaintsSection />
      case "settings":
        return <SettingsSection onLogout={handleLogout} />
      default:
        return <div>Select a section</div>
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-[#09090b] text-white selection:bg-[#992511]/30">
      {/* Desktop & Mobile Drawer Sidebar */}
      <Sidebar variant="inset" className="border-r border-white/5 bg-[#0f0f11]">
        <SidebarHeader className="border-b border-white/5 pb-2">
          <div className="flex h-14 items-center justify-between px-3">
            <div className="flex items-center gap-2.5 font-bold tracking-tight text-white">
              <img src="/leco-logo.png" alt="LECO Self Care" className="h-9 w-auto object-contain shrink-0" />
              <div className="flex flex-col leading-tight">
                <span className="font-extrabold text-sm text-white">LECO Self Care</span>
                <span className="text-[10px] text-white/50 font-medium">Customer Portal</span>
              </div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-white/40 text-[11px] uppercase tracking-wider">{t.nav.navigationLabel}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton 
                      isActive={activeSection === item.id}
                      onClick={() => handleSelectSection(item.id)}
                      className={`transition-all rounded-xl py-2.5 text-xs font-medium cursor-pointer ${
                        activeSection === item.id 
                          ? "bg-[#992511]/25 text-[#ff6b52] font-semibold border border-[#992511]/40 shadow-sm" 
                          : "text-white/70 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-white/5 pt-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={handleLogout} 
                variant="outline" 
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>{t.nav.logout}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#09090b] flex flex-col flex-1 min-w-0">
        {/* Sticky Header with Adaptive Mobile & Desktop Layout */}
        <header className="flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-white/5 px-3 sm:px-6 bg-[#09090b]/85 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-2.5 min-w-0">
            <SidebarTrigger className="text-white/70 hover:text-white h-9 w-9 flex items-center justify-center rounded-lg hover:bg-white/5 cursor-pointer shrink-0" />
            
            {/* Desktop Breadcrumbs */}
            <div className="hidden md:flex items-center text-xs font-medium text-white/50">
              <div className="flex items-center gap-2 mr-1">
                <img src="/leco-logo.png" alt="LECO Logo" className="h-5 w-auto object-contain" />
                <span className="font-bold text-white/90">LECO Self Care</span>
              </div>
              <span className="mx-2">/</span>
              <span className="text-white capitalize font-semibold">{getActiveSectionTitle()}</span>
            </div>

            {/* Mobile Header Title */}
            <div className="flex md:hidden items-center gap-1.5 min-w-0">
              <img src="/leco-logo.png" alt="LECO Logo" className="h-5 w-auto object-contain shrink-0" />
              <span className="font-bold text-xs text-white tracking-tight">LECO Self Care</span>
              <span className="text-white/30 text-xs">•</span>
              <span className="text-xs text-white/80 font-medium capitalize truncate max-w-[120px]">
                {getActiveSectionTitle()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3.5 relative shrink-0">
            {/* Multi-Premises / Meter Switcher */}
            <MeterSwitcherDropdown
              onSelectMeter={() => setRefreshKey((k) => k + 1)}
              onAddMeter={() => handleSelectSection("add-meter")}
            />

            {/* Standard Language Selector */}
            <LanguageSelector 
              currentLanguage={language} 
              onLanguageChange={setLanguage} 
            />

            {/* Notifications Button */}
            <button 
              className="relative p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label={t.header.notifications}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-black">
                  {unreadCount}
                </span>
              )}
            </button>
            
            {/* Mobile-Safe Notifications Dropdown */}
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs sm:hidden"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:top-11 sm:right-0 w-auto sm:w-84 max-w-sm mx-auto sm:mx-0 bg-[#121214]/98 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                  <div className="p-3.5 border-b border-white/10 flex justify-between items-center bg-black/30">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-yellow-400" />
                      <h4 className="font-semibold text-sm text-white">{t.header.notifications}</h4>
                    </div>
                    {unreadCount > 0 && (
                      <span className="text-[11px] font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20">
                        {unreadCount} {t.header.unread}
                      </span>
                    )}
                  </div>
                  <div className="max-h-[340px] overflow-y-auto divide-y divide-white/5">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-white/50">{t.header.noNotifications}</div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`p-3.5 hover:bg-white/5 transition-colors cursor-pointer ${!n.is_read ? 'bg-white/[0.04]' : ''}`}
                          onClick={() => {
                            if (!n.is_read) markAsRead(n.id)
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${n.type === 'alert' ? 'bg-red-500 animate-pulse' : n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`} />
                            <span className="font-medium text-xs text-white line-clamp-1">{n.title}</span>
                          </div>
                          <p className="text-xs text-white/70 leading-relaxed pl-4">{n.message}</p>
                          <p className="text-[10px] text-white/40 mt-1 pl-4">{new Date(n.created_at).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {/* User Profile Pill */}
            <div className="flex items-center gap-2 text-xs font-medium bg-white/5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/10 max-w-[140px] sm:max-w-none">
              <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-[#992511] to-yellow-500 flex items-center justify-center text-white shrink-0 font-bold text-[10px]">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline text-white/90 truncate max-w-[160px]">{user.email}</span>
            </div>
          </div>
        </header>

        {/* Main Content Area: Safe Bottom Spacing for Mobile Dock & Floating Assistant */}
        <main className="flex-1 p-3 sm:p-5 lg:p-8 pb-28 md:pb-10 max-w-7xl w-full mx-auto">
          {activeSection !== "overview" && (
            <div className="mb-4 sm:mb-6 animate-in fade-in slide-in-from-left-4 duration-500">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight capitalize text-white">
                {getActiveSectionTitle()}
              </h1>
            </div>
          )}
          <div key={activeSection} className="animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500 fill-mode-both">
            <SectionErrorBoundary key={activeSection}>
              {renderContent()}
            </SectionErrorBoundary>
          </div>
        </main>
      </SidebarInset>

      {/* Floating AI Energy Assistant Bot (Auto adjusts on mobile) */}
      <EnergyAssistantBot />

      {/* Native-Style Mobile Bottom Navigation Bar (Dock) */}
      <nav 
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c0c0e]/95 backdrop-blur-2xl border-t border-white/10 px-1.5 py-1 flex items-center justify-around shadow-[0_-4px_30px_rgba(0,0,0,0.8)]"
      >
        {mobileDockItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <button
              key={item.id}
              onClick={() => handleSelectSection(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-200 cursor-pointer min-h-[48px] ${
                isActive 
                  ? "text-[#ff6b52]" 
                  : "text-white/50 hover:text-white/80 active:scale-95"
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${
                isActive ? "bg-[#992511]/30 shadow-[0_0_12px_rgba(255,107,82,0.4)]" : ""
              }`}>
                <Icon className={`h-5 w-5 ${isActive ? "text-[#ff6b52] stroke-[2.25]" : "stroke-[1.75]"}`} />
              </div>
              <span className={`text-[10px] tracking-tight mt-0.5 ${isActive ? "font-bold text-white" : "font-normal"}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default function Dashboard() {
  return (
    <SectionErrorBoundary>
      <DashboardI18nProvider>
        <SidebarProvider>
          <DashboardInner />
        </SidebarProvider>
      </DashboardI18nProvider>
    </SectionErrorBoundary>
  )
}
