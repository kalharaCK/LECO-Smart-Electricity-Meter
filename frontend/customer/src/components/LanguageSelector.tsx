import { Globe } from "lucide-react"
import { LANGUAGES, type Language } from "@/lib/i18n"

interface LanguageSelectorProps {
  currentLanguage: Language
  onLanguageChange: (lang: Language) => void
}

export function LanguageSelector({
  currentLanguage,
  onLanguageChange,
}: LanguageSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Select Language"
      className="inline-flex items-center gap-1 p-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 shadow-lg select-none"
    >
      <div className="flex items-center gap-1.5 pl-2 pr-1 text-white/50 text-xs">
        <Globe className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
        <span className="hidden sm:inline text-[11px] font-medium text-white/60">Language:</span>
      </div>

      <div className="flex items-center gap-1">
        {LANGUAGES.map((lang) => {
          const isActive = currentLanguage === lang.code
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => onLanguageChange(lang.code)}
              aria-pressed={isActive}
              title={`${lang.label} (${lang.nativeName})`}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-yellow-400 text-black shadow-md shadow-yellow-400/20"
                  : "text-white/70 hover:text-white hover:bg-white/10 active:scale-95"
              }`}
            >
              <span className="hidden sm:inline">{lang.nativeName}</span>
              <span className="sm:hidden">{lang.shortLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
