import React, { useRef, useState, useEffect } from "react"
import { RefreshCw, Loader2, CheckCircle2 } from "lucide-react"

interface OtpInputBoxesProps {
  length?: number
  value: string
  onChange: (otp: string) => void
  onComplete?: (otp: string) => void
  disabled?: boolean
  onResend?: () => Promise<void> | void
  isResending?: boolean
  initialSeconds?: number
}

export function OtpInputBoxes({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  onResend,
  isResending = false,
  initialSeconds = 60
}: OtpInputBoxesProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)
  const [resendSuccess, setResendSuccess] = useState(false)

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [secondsLeft])

  // Convert incoming string value to digits array
  const digits = Array.from({ length }, (_, i) => value[i] || "")

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawChar = e.target.value
    // Extract only the latest entered digit
    const char = rawChar.replace(/\D/g, "").slice(-1)
    
    const newDigits = [...digits]
    newDigits[index] = char
    const newOtp = newDigits.join("")
    onChange(newOtp)

    if (char && index < length - 1) {
      inputsRef.current[index + 1]?.focus()
    }

    if (newOtp.length === length && onComplete) {
      onComplete(newOtp)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus()
        const newDigits = [...digits]
        newDigits[index - 1] = ""
        onChange(newDigits.join(""))
      } else {
        const newDigits = [...digits]
        newDigits[index] = ""
        onChange(newDigits.join(""))
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
    if (!pastedData) return

    onChange(pastedData)
    const focusIndex = Math.min(pastedData.length, length - 1)
    inputsRef.current[focusIndex]?.focus()

    if (pastedData.length === length && onComplete) {
      onComplete(pastedData)
    }
  }

  const handleTriggerResend = async () => {
    if (secondsLeft > 0 || isResending || !onResend) return
    try {
      await onResend()
      setSecondsLeft(initialSeconds)
      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 3000)
    } catch (err) {
      console.error("Error resending OTP:", err)
    }
  }

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60)
    const remainder = sec % 60
    return `${mins.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
  }

  return (
    <div className="w-full space-y-3.5">
      {/* 6 Individual Square Input Boxes */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2.5">
        {Array.from({ length }).map((_, index) => {
          const isFilled = !!digits[index]
          return (
            <input
              key={index}
              ref={(el) => { inputsRef.current[index] = el }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digits[index]}
              onChange={(e) => handleChange(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={disabled}
              className={`w-10 h-12 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-bold rounded-xl transition-all outline-none select-none cursor-text ${
                isFilled
                  ? "bg-yellow-400/10 border-2 border-yellow-400 text-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.2)]"
                  : "bg-black/40 border border-white/20 text-white hover:border-white/35 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              autoFocus={index === 0}
            />
          )
        })}
      </div>

      {/* Countdown Timer & Resend Button */}
      <div className="flex items-center justify-between text-xs pt-1 px-1">
        <div className="text-white/60 flex items-center gap-1.5">
          {secondsLeft > 0 ? (
            <span>
              Expires in: <strong className="font-mono text-yellow-400 font-bold">{formatTimer(secondsLeft)}</strong>
            </span>
          ) : (
            <span className="text-red-400 font-medium">Verification code expired</span>
          )}
        </div>

        <div>
          {secondsLeft > 0 ? (
            <span className="text-white/40 text-[11px]">Resend available after countdown</span>
          ) : (
            <button
              type="button"
              onClick={handleTriggerResend}
              disabled={isResending}
              className="text-yellow-400 hover:text-yellow-300 font-bold underline underline-offset-2 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            >
              {isResending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Sending code...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Resend OTP</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {resendSuccess && (
        <div className="p-2 rounded-lg bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
          <span>New verification code dispatched to your mobile.</span>
        </div>
      )}
    </div>
  )
}
