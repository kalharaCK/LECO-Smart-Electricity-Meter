export type Language = "en" | "si" | "ta"

export interface LanguageOption {
  code: Language
  label: string
  shortLabel: string
  nativeName: string
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", shortLabel: "EN", nativeName: "English" },
  { code: "si", label: "Sinhala", shortLabel: "සිං", nativeName: "සිංහල" },
  { code: "ta", label: "Tamil", shortLabel: "தம", nativeName: "தமிழ்" },
]

export const translations = {
  en: {
    brand: "LECO Self Care",
    portalTitle: "LECO Self Care",
    portalDesc: "Real-time balance monitoring, instant online top-up & energy management.",
    tabs: {
      login: "Sign In",
      register: "Register Account",
    },
    fields: {
      emailLabel: "Email Address",
      emailPlaceholder: "customer@leco.lk",
      passwordLabel: "Password",
      passwordPlaceholder: "••••••••",
      createPasswordLabel: "Create Password",
      createPasswordPlaceholder: "Minimum 6 characters",
    },
    buttons: {
      signIn: "Sign In to Customer Portal",
      signingIn: "Signing In...",
      register: "Create Customer Account",
      registering: "Creating Account...",
      viewAds: "View Ads",
      close: "Close",
    },
    alerts: {
      errorTitle: "Error",
      successTitle: "Success",
      loginSuccess: "Login successful! Redirecting to dashboard...",
      signupSuccess: "Signup successful! You can now sign in.",
      genericError: "Something went wrong",
    },
    adsBar: {
      title: "Ads",
      subtitle: "Smart meter awareness & offers",
    },
    carousel: {
      close: "Close",
      slideCounter: "of",
      previous: "Previous",
      next: "Next",
      tag: "AMI Notice",
    },
  },
  si: {
    brand: "LECO Self Care",
    portalTitle: "LECO Self Care",
    portalDesc: "ගිණුමේ ශේෂය එසැණින් පරීක්ෂා කිරීම, ක්ෂණිකව රීචාජ් කිරීම සහ ඔබේ විදුලි පරිභෝජනය කළමනාකරණය කිරීම.",
    tabs: {
      login: "පිවිසෙන්න",
      register: "ලියාපදිංචි වන්න",
    },
    fields: {
      emailLabel: "ඊමේල් ලිපිනය",
      emailPlaceholder: "customer@leco.lk",
      passwordLabel: "මුරපදය",
      passwordPlaceholder: "••••••••",
      createPasswordLabel: "නව මුරපදයක් සාදන්න",
      createPasswordPlaceholder: "අවම වශයෙන් අක්ෂර 6ක්",
    },
    buttons: {
      signIn: "පාරිභෝගික පියසට පිවිසෙන්න",
      signingIn: "පිවිසෙමින් පවතී...",
      register: "පාරිභෝගික ගිණුමක් සාදන්න",
      registering: "ගිණුම සකසමින් පවතී...",
      viewAds: "දැන්වීම් බලන්න",
      close: "වසන්න",
    },
    alerts: {
      errorTitle: "දෝෂයකි!",
      successTitle: "සාර්ථකයි!",
      loginSuccess: "පිවිසීම සාර්ථකයි! ඔබව පාලක පුවරුව වෙත යොමු කරමින් පවතී...",
      signupSuccess: "ලියාපදිංචි වීම සාර්ථකයි! දැන් ඔබට ගිණුමට පිවිසිය හැක.",
      genericError: "කිසියම් දෝෂයක් සිදුවී ඇත, කරුණාකර නැවත උත්සාහ කරන්න.",
    },
    adsBar: {
      title: "දැන්වීම්",
      subtitle: "ස්මාර්ට් මීටරය පිළිබඳ දැනුවත් කිරීම් සහ දීමනා",
    },
    carousel: {
      close: "වසන්න",
      slideCounter: "/",
      previous: "පෙර",
      next: "මීළඟ",
      tag: "AMI නිවේදනය",
    },
  },
  ta: {
    brand: "LECO Self Care",
    portalTitle: "LECO Self Care",
    portalDesc: "நிகழ்நேர மீதி கண்காணிப்பு, உடனடி ரீசார்ஜ் மற்றும் மின்சார பயன்பாட்டு மேலாண்மை.",
    tabs: {
      login: "உள்நுழைக",
      register: "பதிவு செய்க",
    },
    fields: {
      emailLabel: "மின்னஞ்சல் முகவரி",
      emailPlaceholder: "customer@leco.lk",
      passwordLabel: "கடவுச்சொல்",
      passwordPlaceholder: "••••••••",
      createPasswordLabel: "புதிய கடவுச்சொல்",
      createPasswordPlaceholder: "குறைந்தது 6 எழுத்துகள்",
    },
    buttons: {
      signIn: "வாடிக்கையாளர் தளத்தில் உள்நுழைக",
      signingIn: "உள்நுழைகிறது...",
      register: "வாடிக்கையாளர் கணக்கை உருவாக்குக",
      registering: "கணக்கு உருவாக்கப்படுகிறது...",
      viewAds: "விளம்பரங்களை காண்க",
      close: "மூடுக",
    },
    alerts: {
      errorTitle: "பிழை",
      successTitle: "வெற்றி",
      loginSuccess: "வெற்றிகரமாக உள்நுழைந்துள்ளீர்கள்! டாஷ்போர்டுக்கு செல்கிறது...",
      signupSuccess: "பதிவு வெற்றிகரமாக முடிந்தது! இப்போது நீங்கள் உள்நுழையலாம்.",
      genericError: "ஒரு பிழை ஏற்பட்டுள்ளது, தயவுசெய்து மீண்டும் முயற்சிக்கவும்.",
    },
    adsBar: {
      title: "விளம்பரங்கள்",
      subtitle: "ஸ்மார்ட் மீட்டர் விழிப்புணர்வு & சலுகைகள்",
    },
    carousel: {
      close: "மூடுக",
      slideCounter: "/",
      previous: "முந்தையது",
      next: "அடுத்தது",
      tag: "லெகோ அறிவிப்பு",
    },
  },
} as const

export function getTranslations(lang: Language) {
  return translations[lang] || translations.en
}