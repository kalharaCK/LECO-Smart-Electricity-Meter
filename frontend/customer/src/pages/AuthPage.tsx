import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Zap, Loader2 } from "lucide-react"

export default function AuthPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    
    const endpoint = isLogin ? "/api/login" : "/api/signup"
    const body = isLogin 
      ? { email, password } 
      : { email, password, role: "customer" }

    try {
      const res = await fetch(`http://localhost:3000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong")
      }
      
      if (isLogin) {
        // Store user and token in localStorage for cross-port client authorization
        localStorage.setItem("user", JSON.stringify(data.user))
        if (data.token) {
          localStorage.setItem("token", data.token)
        }
        
        setMessage({ type: "success", text: "Login successful! Redirecting to dashboard..." })
        
        // Navigate to dashboard after short delay
        setTimeout(() => {
          navigate("/dashboard")
        }, 600)
      } else {
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user))
        }
        if (data.token) {
          localStorage.setItem("token", data.token)
        }
        setMessage({ type: "success", text: "Signup successful! You can now sign in." })
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#110302] via-[#09090b] to-black p-3.5 sm:p-6">
      <Card className="w-full max-w-md bg-gradient-to-br from-[#992511] via-[#521308] to-[#240602] border border-white/10 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <Tabs 
          value={isLogin ? "login" : "signup"} 
          onValueChange={(val) => {
            setIsLogin(val === "login")
            setMessage(null)
            setEmail("")
            setPassword("")
          }}
        >
          <CardHeader className="p-5 sm:p-7 pb-2 sm:pb-3 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-yellow-400 text-black flex items-center justify-center font-black shadow-lg shadow-yellow-400/20">
                <Zap className="h-5 w-5 fill-current" />
              </div>
              <span className="font-bold tracking-wider text-xs uppercase text-yellow-400">LECO Smart AMI</span>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-black text-white tracking-tight">Customer Portal</CardTitle>
            <CardDescription className="text-white/70 text-xs sm:text-sm mt-1">
              Real-time balance monitoring, instant online top-up & energy management.
            </CardDescription>
            <div className="mt-4 sm:mt-5">
              <TabsList className="w-full bg-black/40 p-1 h-11 rounded-xl border border-white/10">
                <TabsTrigger value="login" className="flex-1 h-9 rounded-lg text-xs font-bold data-[state=active]:bg-yellow-400 data-[state=active]:text-black transition-all">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1 h-9 rounded-lg text-xs font-bold data-[state=active]:bg-yellow-400 data-[state=active]:text-black transition-all">
                  Register Account
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>

          <TabsContent value="login" className="m-0">
            <form onSubmit={handleSubmit}>
              <CardContent className="flex flex-col gap-4 p-5 sm:p-7 pt-2 sm:pt-3">
                {message && isLogin && (
                  <Alert variant={message.type === "error" ? "destructive" : "default"} className={`rounded-xl text-xs py-2.5 ${message.type === "success" ? "border-green-500/50 bg-green-950/80 text-green-200" : "bg-red-950/80 border-red-500/50 text-red-200"}`}>
                    <AlertTitle className="text-xs font-bold">{message.type === "error" ? "Error" : "Success"}</AlertTitle>
                    <AlertDescription className="text-[11px] leading-tight mt-0.5">{message.text}</AlertDescription>
                  </Alert>
                )}
                <FieldGroup className="space-y-3.5">
                  <Field>
                    <FieldLabel htmlFor="login-email" className="text-white text-xs font-semibold uppercase tracking-wider">Email Address</FieldLabel>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="customer@leco.lk"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="bg-black/30 border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-yellow-400 mt-1"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="login-password" className="text-white text-xs font-semibold uppercase tracking-wider">Password</FieldLabel>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      placeholder="••••••••"
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="bg-black/30 border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-yellow-400 mt-1"
                      required
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter className="p-5 sm:p-7 pt-0 border-none bg-transparent">
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-sm shadow-xl hover:shadow-yellow-400/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    "Sign In to Customer Portal"
                  )}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="m-0">
            <form onSubmit={handleSubmit}>
              <CardContent className="flex flex-col gap-4 p-5 sm:p-7 pt-2 sm:pt-3">
                {message && !isLogin && (
                  <Alert variant={message.type === "error" ? "destructive" : "default"} className={`rounded-xl text-xs py-2.5 ${message.type === "success" ? "border-green-500/50 bg-green-950/80 text-green-200" : "bg-red-950/80 border-red-500/50 text-red-200"}`}>
                    <AlertTitle className="text-xs font-bold">{message.type === "error" ? "Error" : "Success"}</AlertTitle>
                    <AlertDescription className="text-[11px] leading-tight mt-0.5">{message.text}</AlertDescription>
                  </Alert>
                )}
                <FieldGroup className="space-y-3.5">
                  <Field>
                    <FieldLabel htmlFor="signup-email" className="text-white text-xs font-semibold uppercase tracking-wider">Email Address</FieldLabel>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="customer@leco.lk"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="bg-black/30 border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-yellow-400 mt-1"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="signup-password" className="text-white text-xs font-semibold uppercase tracking-wider">Create Password</FieldLabel>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="bg-black/30 border-white/15 placeholder:text-white/30 text-white h-11 text-sm rounded-xl focus-visible:ring-yellow-400 mt-1"
                      required
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter className="p-5 sm:p-7 pt-0 border-none bg-transparent">
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-sm shadow-xl hover:shadow-yellow-400/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    "Create Customer Account"
                  )}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
