import { useState, useEffect } from "react"
import { X, ChevronLeft, Check } from "lucide-react"

type Language = "en" | "si" | "ta"
type ViewMode = "banner" | "preferences" | "policy"

interface CookieConsentProps {
  onConsentChange?: (consent: string) => void
}

const translations = {
  en: {
    title: "Cookies Settings",
    descPrefix:
      "We use cookies and similar technologies to help personalize content, tailor and measure telemetry, and provide a better experience. By clicking accept, you agree to this, as outlined in our ",
    cookiePolicy: "Cookie Policy",
    descSuffix: ".",
    accept: "Accept",
    preferences: "Preferences",
    // Preferences View
    prefsTitle: "Preferences",
    prefsDesc: "Customize your cookie preferences for LECO Self Care services.",
    essentialTitle: "Strictly Necessary Cookies",
    essentialDesc: "Required for secure user authentication, active sessions, and language settings.",
    essentialStatus: "Always Active",
    telemetryTitle: "Telemetry & Cache",
    telemetryDesc: "Stores cached consumption meters and network state for responsive dashboard loading.",
    savePreferences: "Save Preferences",
    backBtn: "Back",
    // Policy View
    policyTitle: "Cookie Policy",
    policyP1:
      "Lanka Electricity Company (Pvt) Ltd. (LECO) uses essential cookies and browser local storage strictly for operational, security, and smart metering purposes under the Sri Lanka Personal Data Protection Act No. 9 of 2022.",
    policyP2:
      "Stored items include encrypted session tokens ('token'), customer language preferences ('customer_lang'), and privacy consent records ('leco_cookie_consent'). No third-party commercial marketing or external tracking cookies are deployed."
  },
  si: {
    title: "කුකීස් සැකසීම්",
    descPrefix:
      "ඔබගේ ගිණුමේ සැසිය සුරක්ෂිතව පවත්වා ගැනීමට, භාෂා මනාපයන් මතක තබා ගැනීමට සහ සජීවී ස්මාර්ට් විදුලි මීටර් දත්ත සැපයීමට අපි අත්‍යවශ්‍ය කුකීස් භාවිත කරමු. පිළිගැනීම ක්ලික් කිරීමෙන් අපගේ ",
    cookiePolicy: "කුකී ප්‍රතිපත්තිය",
    descSuffix: "ට ඔබ එකඟ වේ.",
    accept: "පිළිගන්න",
    preferences: "මනාපයන්",
    prefsTitle: "කුකී මනාපයන්",
    prefsDesc: "LECO Self Care පද්ධතිය සඳහා ඔබගේ කුකී මනාපයන් සකසන්න.",
    essentialTitle: "අත්‍යවශ්‍ය කුකීස්",
    essentialDesc: "ආරක්ෂිත පරිශීලක පිවිසුම, සැසිය සහ භාෂා මනාපයන් සඳහා අනිවාර්ය වේ.",
    essentialStatus: "සැමවිටම සක්‍රියයි",
    telemetryTitle: "මීටර් හැඹිලි මතකය",
    telemetryDesc: "නොබැඳි අවස්ථාවලදී දත්ත ඉක්මනින් පෙන්වීම සඳහා හැඹිලි මතකය භාවිත කරයි.",
    savePreferences: "මනාපයන් සුරකින්න",
    backBtn: "ආපසු",
    policyTitle: "කුකී ප්‍රතිපත්තිය",
    policyP1:
      "ලංකා විදුලි පුද්ගලික සමාගම (LECO) 2022 අංක 09 දරන ශ්‍රී ලංකා පුද්ගලික දත්ත ආරක්ෂණ පනතට අනුකූලව අත්‍යවශ්‍ය කුකීස් සහ බ්‍රවුසර මතකය පමණක් ආරක්ෂිතව භාවිතා කරයි.",
    policyP2:
      "ආරක්ෂිත පිවිසුම් යතුර (token), භාෂා මනාපය (customer_lang) සහ එකඟතාව පමණක් ගබඩා කරනු ලැබේ. කිසිදු තෙවන පාර්ශවීය දැන්වීම් කුකීස් මෙහි අඩංගු නොවේ."
  },
  ta: {
    title: "குக்கீ அமைப்புகள்",
    descPrefix:
      "உங்கள் கணக்கை பாதுகாப்பாக வைத்திருக்கவும், மொழி விருப்பங்களை சேமிக்கவும், நேரடி ஸ்மார்ட் மின்சார அளவீடுகளை வழங்கவும் அத்தியாவசிய குக்கீகளை பயன்படுத்துகிறோம். ஏற்பதை கிளிக் செய்வதன் மூலம் எங்களின் ",
    cookiePolicy: "குக்கீ கொள்கை",
    descSuffix: "யை ஏற்கிறீர்கள்.",
    accept: "ஏற்கவும்",
    preferences: "விருப்பங்கள்",
    prefsTitle: "குக்கீ விருப்பங்கள்",
    prefsDesc: "LECO Self Care தளத்திற்கான உங்கள் குக்கீ விருப்பங்களை நிர்வகிக்கவும்.",
    essentialTitle: "அத்தியாவசிய குக்கீகள்",
    essentialDesc: "பாதுகாப்பான உள்நுழைவு, அமர்வு மற்றும் மொழி அமைப்புகளுக்கு அவசியமானது.",
    essentialStatus: "எப்போதும் செயலில்",
    telemetryTitle: "மீட்டர் நினைவகம்",
    telemetryDesc: "டாஷ்போர்டு விரைவாக செயல்பட தற்காலிக நினைவகத்தை சேமிக்கிறது.",
    savePreferences: "சேமிக்கவும்",
    backBtn: "பின்செல்லவும்",
    policyTitle: "குக்கீ கொள்கை",
    policyP1:
      "இலங்கை மின்சார தனியார் நிறுவனம் (LECO) 2022 ஆம் ஆண்டின் 09 ஆம் இலக்க தனிநபர் தரவு பாதுகாப்பு சட்டத்தின் கீழ் அத்தியாவசிய குக்கீகளை மட்டுமே பயன்படுத்துகிறது.",
    policyP2:
      "பாதுகாப்பான உள்நுழைவு டோக்கன், மொழி விருப்பம் மற்றும் ஒப்புதல் மட்டுமே சேமிக்கப்படும். விளம்பர குக்கீகள் எதுவும் பயன்படுத்தப்படுவதில்லை."
  }
}

export function CookieConsentModal({ onConsentChange }: CookieConsentProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [view, setView] = useState<ViewMode>("banner")
  const [telemetryEnabled, setTelemetryEnabled] = useState(true)
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window === "undefined") return "en"
    const saved = localStorage.getItem("customer_lang") as Language
    return saved === "si" || saved === "ta" || saved === "en" ? saved : "en"
  })

  // Synchronize language with localStorage and window events
  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem("customer_lang") as Language
      if (saved === "si" || saved === "ta" || saved === "en") {
        setLang(saved)
      }
    }
    window.addEventListener("storage", handleStorage)
    const interval = setInterval(handleStorage, 1000)
    return () => {
      window.removeEventListener("storage", handleStorage)
      clearInterval(interval)
    }
  }, [])

  // Check if consent has already been recorded
  useEffect(() => {
    const consent = localStorage.getItem("leco_cookie_consent")
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 400)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang)
    try {
      localStorage.setItem("customer_lang", newLang)
      window.dispatchEvent(new Event("storage"))
    } catch (e) {
      console.error(e)
    }
  }

  const handleConsent = (mode: "accepted" | "essential" | "custom") => {
    try {
      localStorage.setItem("leco_cookie_consent", mode)
      localStorage.setItem("leco_cookie_consent_timestamp", new Date().toISOString())
      localStorage.setItem("leco_cookie_telemetry", telemetryEnabled ? "true" : "false")
      if (!localStorage.getItem("customer_lang")) {
        localStorage.setItem("customer_lang", lang)
      }
      window.dispatchEvent(new Event("cookie_consent_updated"))
      onConsentChange?.(mode)
    } catch (e) {
      console.error("Failed to store cookie consent:", e)
    }
    setIsVisible(false)
    setView("banner")
  }

  const t = translations[lang] || translations.en

  if (!isVisible) return null

  return (
    <aside
      role="dialog"
      aria-labelledby="cookie-settings-title"
      className="fixed bottom-4 left-4 right-4 mx-auto max-w-sm sm:left-auto sm:right-6 sm:bottom-6 sm:mx-0 sm:w-[420px] sm:max-w-[420px] z-50 bg-[#141416]/95 backdrop-blur-2xl text-white rounded-3xl p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.85)] border border-white/15 animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans"
    >
      {/* MAIN VIEW: Minimal Cookies Settings Card */}
      {view === "banner" && (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3.5">
            <h3
              id="cookie-settings-title"
              className="font-bold text-base sm:text-lg text-white tracking-tight"
            >
              {t.title}
            </h3>

            <div className="flex items-center gap-2.5">
              {/* Minimal inline language selector */}
              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/50 bg-white/5 border border-white/10 px-1.5 py-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleLanguageChange("en")}
                  className={`transition-colors cursor-pointer px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${
                    lang === "en" ? "bg-yellow-400 text-black shadow-sm" : "text-white/60 hover:text-white"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("si")}
                  className={`transition-colors cursor-pointer px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${
                    lang === "si" ? "bg-yellow-400 text-black shadow-sm" : "text-white/60 hover:text-white"
                  }`}
                >
                  සිං
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("ta")}
                  className={`transition-colors cursor-pointer px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${
                    lang === "ta" ? "bg-yellow-400 text-black shadow-sm" : "text-white/60 hover:text-white"
                  }`}
                >
                  தம
                </button>
              </div>

              {/* Close X */}
              <button
                type="button"
                onClick={() => handleConsent("essential")}
                className="text-white/40 hover:text-white hover:bg-white/10 p-1.5 rounded-xl transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="text-zinc-300 text-xs sm:text-[13px] leading-relaxed mb-5">
            {t.descPrefix}
            <button
              type="button"
              onClick={() => setView("policy")}
              className="text-yellow-400 font-semibold underline underline-offset-2 hover:text-yellow-300 cursor-pointer transition-colors"
            >
              {t.cookiePolicy}
            </button>
            {t.descSuffix}
          </p>

          {/* Action Buttons: Accept & Preferences */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => handleConsent("accepted")}
              className="w-full bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] text-black font-extrabold text-xs sm:text-sm h-10 sm:h-11 rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-md shadow-yellow-500/10"
            >
              {t.accept}
            </button>
            <button
              type="button"
              onClick={() => setView("preferences")}
              className="w-full bg-white/10 hover:bg-white/15 active:scale-[0.98] text-white border border-white/15 font-bold text-xs sm:text-sm h-10 sm:h-11 rounded-xl transition-all cursor-pointer flex items-center justify-center"
            >
              {t.preferences}
            </button>
          </div>
        </div>
      )}

      {/* PREFERENCES VIEW: Minimal category management */}
      {view === "preferences" && (
        <div className="animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setView("banner")}
                className="text-white/50 hover:text-white p-1 -ml-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h4 className="font-bold text-base text-white">
                {t.prefsTitle}
              </h4>
            </div>

            <button
              type="button"
              onClick={() => handleConsent("essential")}
              className="text-white/40 hover:text-white hover:bg-white/10 p-1.5 rounded-xl transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 mb-5 max-h-[260px] overflow-y-auto pr-1">
            {/* Category 1: Strictly Necessary */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs sm:text-[13px] text-white">
                  {t.essentialTitle}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-300 bg-yellow-400/15 border border-yellow-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="h-2.5 w-2.5 stroke-[3] text-yellow-400" /> {t.essentialStatus}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-normal">
                {t.essentialDesc}
              </p>
            </div>

            {/* Category 2: Telemetry Cache */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs sm:text-[13px] text-white">
                  {t.telemetryTitle}
                </span>
                <button
                  type="button"
                  onClick={() => setTelemetryEnabled(!telemetryEnabled)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                    telemetryEnabled ? "bg-yellow-400" : "bg-white/20"
                  }`}
                  aria-label="Toggle telemetry cache"
                >
                  <div
                    className={`w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                      telemetryEnabled ? "translate-x-4 bg-black" : "translate-x-0 bg-white"
                    }`}
                  />
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 leading-normal">
                {t.telemetryDesc}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setView("banner")}
              className="w-full bg-white/10 hover:bg-white/15 active:scale-[0.98] text-white border border-white/15 font-bold text-xs h-10 rounded-xl transition-all cursor-pointer"
            >
              {t.backBtn}
            </button>
            <button
              type="button"
              onClick={() => handleConsent("custom")}
              className="w-full bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] text-black font-extrabold text-xs h-10 rounded-xl transition-all cursor-pointer shadow-md"
            >
              {t.savePreferences}
            </button>
          </div>
        </div>
      )}

      {/* POLICY VIEW: Compact Policy text */}
      {view === "policy" && (
        <div className="animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setView("banner")}
                className="text-white/50 hover:text-white p-1 -ml-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h4 className="font-bold text-base text-white">
                {t.policyTitle}
              </h4>
            </div>

            <button
              type="button"
              onClick={() => handleConsent("essential")}
              className="text-white/40 hover:text-white hover:bg-white/10 p-1.5 rounded-xl transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2.5 text-xs text-zinc-300 leading-relaxed mb-5 max-h-[240px] overflow-y-auto pr-1">
            <p>{t.policyP1}</p>
            <p>{t.policyP2}</p>
          </div>

          <button
            type="button"
            onClick={() => setView("banner")}
            className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/15 font-bold text-xs h-10 rounded-xl transition-colors cursor-pointer"
          >
            {t.backBtn}
          </button>
        </div>
      )}
    </aside>
  )
}

export default CookieConsentModal
