import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { 
  LayoutDashboard, 
  PlusCircle, 
  History as HistoryIcon, 
  CreditCard, 
  MessageSquareWarning, 
  Settings,
  LogOut,
  User,
  Bell
} from "lucide-react"

import OverviewSection from "../components/dashboard/OverviewSection"
import AddMeterSection from "../components/dashboard/AddMeterSection"
import PaymentsSection from "../components/dashboard/PaymentsSection"
import ComplaintsSection from "../components/dashboard/ComplaintsSection"
import PaymentHistorySection from "../components/dashboard/PaymentHistorySection"
import SettingsSection from "../components/dashboard/SettingsSection"
import EnergyAssistantBot from "../components/chat/EnergyAssistantBot"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  SidebarFooter
} from "@/components/ui/sidebar"

const navItems = [
  { id: "overview", title: "Overview", icon: LayoutDashboard },
  { id: "add-meter", title: "Add Meter", icon: PlusCircle },
  { id: "payments", title: "Payments", icon: CreditCard },
  { id: "history", title: "Payment History", icon: HistoryIcon },
  { id: "complaints", title: "Complaints", icon: MessageSquareWarning },
  { id: "settings", title: "Settings", icon: Settings },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState<{ email: string; role: string } | null>(null)
  const [activeSection, setActiveSection] = useState("overview")
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    // Check if user session data exists
    const userData = localStorage.getItem("user")
    
    if (!userData) {
      navigate("/")
      return
    }

    try {
      setUser(JSON.parse(userData))
      
      const fetchNotifications = async () => {
        try {
          const res = await fetch("http://localhost:3000/api/notifications", {
            credentials: "include"
          })
          if (res.ok) {
            setNotifications(await res.json())
          }
        } catch (e) {
          console.error(e)
        }
      }
      fetchNotifications()
      
    } catch (e) {
      navigate("/")
    }
  }, [navigate])

  const markAsRead = async (id: number) => {
    try {
      await fetch(`http://localhost:3000/api/notifications/${id}/read`, {
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
      await fetch("http://localhost:3000/api/logout", {
        method: "POST",
        credentials: "include"
      })
    } catch (e) {
      console.error(e)
    } finally {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      navigate("/")
    }
  }

  if (!user) return null

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return <OverviewSection refreshKey={refreshKey} onNavigate={setActiveSection} />
      case "add-meter":
        return (
          <AddMeterSection
            onMeterAdded={() => setRefreshKey((k) => k + 1)}
            onNavigateOverview={() => setActiveSection("overview")}
          />
        )
      case "payments":
        return (
          <PaymentsSection
            onSuccess={() => setRefreshKey((k) => k + 1)}
            onNavigateOverview={() => setActiveSection("overview")}
            onNavigateHistory={() => setActiveSection("history")}
          />
        )
      case "history":
        return (
          <PaymentHistorySection
            refreshKey={refreshKey}
            onNavigateRecharge={() => setActiveSection("payments")}
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#09090b] text-white selection:bg-[#992511]/30">
        <Sidebar variant="inset" className="border-r border-white/5 bg-[#0f0f11]">
          <SidebarHeader>
            <div className="flex h-12 items-center px-4 font-bold text-xl tracking-tight text-primary">
              E-Meter
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton 
                        isActive={activeSection === item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`transition-colors ${
                          activeSection === item.id 
                            ? "bg-[#992511]/20 text-[#ff6b52] hover:bg-[#992511]/30" 
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="font-medium">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                  <LogOut />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="bg-[#09090b]">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-white/5 px-4 lg:px-6 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-40">
            <SidebarTrigger className="text-white/70 hover:text-white" />
            <div className="ml-4 hidden md:flex items-center text-sm font-medium text-white/50">
              <span>E-Meter Dashboard</span>
              <span className="mx-2">/</span>
              <span className="text-white capitalize">{activeSection.replace('-', ' ')}</span>
            </div>
            <div className="ml-auto flex items-center gap-6 relative">
              <button 
                className="relative text-foreground hover:text-primary transition-colors"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-background">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute top-10 right-10 w-80 bg-black/90 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                  <div className="p-3 border-b border-white/10 flex justify-between items-center">
                    <h4 className="font-semibold text-white">Notifications</h4>
                    {unreadCount > 0 && <span className="text-xs text-yellow-400">{unreadCount} unread</span>}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-sm text-white/50">No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`p-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!n.is_read ? 'bg-white/5' : ''}`}
                          onClick={() => !n.is_read && markAsRead(n.id)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`h-2 w-2 rounded-full ${n.type === 'alert' ? 'bg-red-500' : n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`} />
                            <span className="font-medium text-sm text-white">{n.title}</span>
                          </div>
                          <p className="text-xs text-white/70">{n.message}</p>
                          <p className="text-[10px] text-white/40 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4" />
                {user.email}
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-8">
            <div className="mb-6 animate-in fade-in slide-in-from-left-4 duration-500">
              <h1 className="text-3xl font-bold tracking-tight capitalize">
                {activeSection.replace('-', ' ')}
              </h1>
            </div>
            <div key={activeSection} className="animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500 fill-mode-both">
              {renderContent()}
            </div>
          </main>
        </SidebarInset>
      </div>

      {/* Floating AI Energy Assistant Bot */}
      <EnergyAssistantBot />
    </SidebarProvider>
  )
}
