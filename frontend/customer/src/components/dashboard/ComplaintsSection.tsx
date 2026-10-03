import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Phone, Paperclip, Send, CheckCircle2, Clock, AlertTriangle } from "lucide-react"

export default function ComplaintsSection() {
  const [step, setStep] = useState<"form" | "submitted">("form")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setStep("submitted")
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      <div className="flex-1 flex flex-col gap-6">
        <Card className="bg-gradient-to-br from-[#992511] to-[#3a0b04] border-0 shadow-xl text-white">
          <CardHeader>
            <CardTitle>Create Complaint</CardTitle>
            <CardDescription className="text-white/70">
              Submit a support ticket regarding your smart meter or account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "form" && (
              <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-500">
                <div className="space-y-3">
                  <Label className="text-white text-base">Complaint Type</Label>
                  <RadioGroup defaultValue="meter" className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      "Meter Issue", 
                      "Incorrect Balance", 
                      "Recharge Problem", 
                      "Power Interruption", 
                      "High Consumption",
                      "Payment Problem",
                      "Connection Problem",
                      "Other"
                    ].map((type) => (
                      <div key={type} className="flex items-center space-x-2 border border-white/10 p-3 rounded-lg bg-black/20 hover:bg-black/30 transition-colors">
                        <RadioGroupItem value={type.toLowerCase().replace(' ', '-')} id={type} className="border-white/50 text-yellow-400" />
                        <Label htmlFor={type} className="flex-1 cursor-pointer">{type}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-white">Subject</Label>
                  <Input id="subject" placeholder="Brief description of the issue" className="bg-black/20 border-white/10 text-white" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-white">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Provide as much detail as possible..." 
                    className="bg-black/20 border-white/10 text-white min-h-[120px]" 
                    required 
                  />
                </div>

                <div className="space-y-2 border-t border-white/10 pt-4">
                  <Label className="text-white">Attachments</Label>
                  <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center bg-black/10 hover:bg-black/20 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2">
                    <Paperclip className="h-6 w-6 text-white/50" />
                    <span className="text-sm text-white/70">Click to upload photos or documents</span>
                  </div>
                </div>

                <Button type="submit" className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg mt-4 h-11 hover:scale-[1.02] transition-transform">
                  <Send className="mr-2 h-4 w-4" />
                  Submit Complaint
                </Button>
              </form>
            )}

            {step === "submitted" && (
              <div className="text-center py-12 animate-in zoom-in-95 duration-500">
                <div className="mx-auto w-20 h-20 bg-green-500/20 text-green-400 flex items-center justify-center rounded-full mb-6">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Complaint Submitted</h3>
                <p className="text-white/70 mb-6">Your ticket <span className="font-mono text-yellow-400">#CMP-28492</span> has been created successfully.</p>
                
                <div className="max-w-xs mx-auto space-y-3">
                  <Button onClick={() => setStep("form")} variant="outline" className="w-full bg-transparent border-white/20 text-white hover:bg-white/10">
                    Track Complaint
                  </Button>
                  <Button onClick={() => setStep("form")} className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-bold shadow-lg">
                    Create New Complaint
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="xl:w-[350px] flex flex-col gap-6">
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-white/10 shadow-xl text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Complaint Tracking
            </CardTitle>
            <CardDescription className="text-white/60">
              Track your active support tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-yellow-400 text-sm font-medium">#CMP-28491</span>
                <span className="text-xs text-white/50">01 Oct 2026</span>
              </div>
              <p className="text-sm font-medium mb-4">Recharge deducted but balance not updated</p>
              
              <div className="relative pl-6 space-y-4 before:absolute before:inset-y-1 before:left-[11px] before:w-[2px] before:bg-white/10">
                <div className="relative">
                  <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-green-500 ring-4 ring-[#1a1a1a]"></span>
                  <p className="text-sm font-medium text-white/90">Submitted</p>
                </div>
                <div className="relative">
                  <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-yellow-400 ring-4 ring-[#1a1a1a] animate-pulse"></span>
                  <p className="text-sm font-medium text-yellow-400">Under Investigation</p>
                  <p className="text-xs text-white/50 mt-1">Updated 01 Oct 2026</p>
                </div>
                <div className="relative">
                  <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-white/20 ring-4 ring-[#1a1a1a]"></span>
                  <p className="text-sm font-medium text-white/40">Resolved</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-red-500/30 shadow-xl text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Emergency / Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white/70 mb-4">For immediate power breakdowns or life-threatening emergencies, please contact the CEB Call Centre.</p>
            <a href="tel:1987" className="flex items-center justify-center gap-2 bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 text-red-400 font-bold p-4 rounded-xl transition-colors text-2xl">
              <Phone className="h-6 w-6" />
              1987
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
