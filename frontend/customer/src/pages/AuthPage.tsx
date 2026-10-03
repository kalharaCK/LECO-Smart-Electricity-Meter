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

export default function AuthPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isLogin, setIsLogin] = useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    
    const endpoint = isLogin ? "/api/login" : "/api/signup"
    const body = isLogin 
      ? { email, password } 
      : { email, password, role: "customer" }

    try {
      const res = await fetch(`http://localhost:3000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong")
      }
      
      if (isLogin) {
        // Store token in localStorage
        localStorage.setItem("token", data.token)
        localStorage.setItem("user", JSON.stringify(data.user))
        
        setMessage({ type: "success", text: "Login successful! Redirecting..." })
        
        // Navigate to dashboard after short delay
        setTimeout(() => {
          navigate("/dashboard")
        }, 1000)
      } else {
        setMessage({ type: "success", text: "Signup successful! You can now log in." })
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md bg-gradient-to-br from-[#992511] to-[#3a0b04] border-0 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
        <Tabs 
          value={isLogin ? "login" : "signup"} 
          onValueChange={(val) => {
            setIsLogin(val === "login")
            setMessage(null)
            setEmail("")
            setPassword("")
          }}
        >
          <CardHeader>
            <CardTitle>Welcome to E-Meter</CardTitle>
            <CardDescription className="text-white/70">
              Sign in to manage your smart meters or create a new account.
            </CardDescription>
            <div className="mt-4">
              <TabsList className="w-full bg-black/40">
                <TabsTrigger value="login" className="flex-1 data-[state=active]:bg-black/60 data-[state=active]:text-white">
                  Login
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1 data-[state=active]:bg-black/60 data-[state=active]:text-white">
                  Sign up
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>

          <TabsContent value="login" className="m-0">
            <form onSubmit={handleSubmit}>
              <CardContent className="flex flex-col gap-5 pt-4">
                {message && isLogin && (
                  <Alert variant={message.type === "error" ? "destructive" : "default"} className={message.type === "success" ? "border-green-500 bg-green-50 text-green-900" : ""}>
                    <AlertTitle>{message.type === "error" ? "Error" : "Success"}</AlertTitle>
                    <AlertDescription>{message.text}</AlertDescription>
                  </Alert>
                )}
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="login-email" className="text-white">Email</FieldLabel>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="customer@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="bg-black/20 border-white/10 placeholder:text-white/30 text-white"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="login-password" className="text-white">Password</FieldLabel>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="bg-black/20 border-white/10 placeholder:text-white/30 text-white"
                      required
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter className="pt-4 border-none bg-transparent">
                <Button type="submit" className="w-full font-semibold shadow-lg hover:scale-105 transition-transform duration-300">
                  Sign in
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="m-0">
            <form onSubmit={handleSubmit}>
              <CardContent className="flex flex-col gap-5 pt-4">
                {message && !isLogin && (
                  <Alert variant={message.type === "error" ? "destructive" : "default"} className={message.type === "success" ? "border-green-500 bg-green-50 text-green-900" : ""}>
                    <AlertTitle>{message.type === "error" ? "Error" : "Success"}</AlertTitle>
                    <AlertDescription>{message.text}</AlertDescription>
                  </Alert>
                )}
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="signup-email" className="text-white">Email</FieldLabel>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="customer@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="bg-black/20 border-white/10 placeholder:text-white/30 text-white"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="signup-password" className="text-white">Password</FieldLabel>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="bg-black/20 border-white/10 placeholder:text-white/30 text-white"
                      required
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter className="pt-4 border-none bg-transparent">
                <Button type="submit" className="w-full font-semibold shadow-lg hover:scale-105 transition-transform duration-300">
                  Create account
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
