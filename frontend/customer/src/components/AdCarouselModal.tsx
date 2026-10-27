import { useState, useEffect, useCallback } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { getTranslations, type Language } from "@/lib/i18n"

export const AD_IMAGES = [
  "/ads/1.jpg",
  "/ads/2.jpg",
  "/ads/3.jpg",
  "/ads/4.jpg",
]

interface AdCarouselModalProps {
  isOpen: boolean
  onClose: () => void
  images?: string[]
  autoPlayInterval?: number
  lang?: Language
}

export function AdCarouselModal({
  isOpen,
  onClose,
  images = AD_IMAGES,
  autoPlayInterval = 4500,
  lang = "en",
}: AdCarouselModalProps) {
  const t = getTranslations(lang).carousel
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0)

  // Preload all ad images for smooth instant transitions
  useEffect(() => {
    images.forEach((src) => {
      const img = new Image()
      img.src = src
    })
  }, [images])

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  const goToSlide = (idx: number) => {
    setCurrentIndex(idx)
  }

  // Auto-play interval
  useEffect(() => {
    if (!isOpen || isPaused) return

    const interval = window.setInterval(() => {
      nextSlide()
    }, autoPlayInterval)

    return () => window.clearInterval(interval)
  }, [isOpen, isPaused, autoPlayInterval, nextSlide])

  // Keyboard navigation (Esc to close, Arrow keys to navigate)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowLeft") {
        prevSlide()
      } else if (e.key === "ArrowRight") {
        nextSlide()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose, prevSlide, nextSlide])

  // Mobile touch gestures (swipe left / right)
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true)
    setTouchStartX(e.touches[0].clientX)
    setTouchDeltaX(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    setTouchDeltaX(e.touches[0].clientX - touchStartX)
  }

  const handleTouchEnd = () => {
    setIsPaused(false)
    if (touchStartX === null) return

    const swipeThreshold = 45
    if (touchDeltaX < -swipeThreshold) {
      nextSlide()
    } else if (touchDeltaX > swipeThreshold) {
      prevSlide()
    }

    setTouchStartX(null)
    setTouchDeltaX(0)
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Advertisements"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={(e) => {
        // Dismiss when clicking on the outer backdrop
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      {/* Modal Container: Focused 100% on the image with a Clear Close button */}
      <div
        className="relative w-full max-w-[390px] sm:max-w-[460px] md:max-w-[500px] flex flex-col items-center animate-in zoom-in-95 duration-200 select-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Top Floating Control Bar: Smaller, subtle Close button and slide counter */}
        <div className="w-full flex items-center justify-between pb-2 px-1">
          {/* Subtle slide counter */}
          <div className="px-2.5 py-0.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/60 text-[11px] font-medium">
            {currentIndex + 1} / {images.length}
          </div>

          {/* Smaller, subtle, non-highlighted Close Button */}
          <button
            type="button"
            id="close-ad-button"
            onClick={onClose}
            aria-label={t.close}
            title={`${t.close} (Esc)`}
            className="group flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/75 hover:text-white border border-white/15 text-xs font-medium transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-white/30"
          >
            <X className="w-3.5 h-3.5 stroke-[2] transition-transform group-hover:rotate-90" />
            <span>{t.close}</span>
          </button>
        </div>

        {/* The Advertisement Image Frame */}
        <div
          className="relative w-full aspect-square rounded-2xl sm:rounded-3xl overflow-hidden bg-black/80 border-2 border-white/15 shadow-2xl shadow-black/80"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Image */}
          <img
            key={images[currentIndex]}
            src={images[currentIndex]}
            alt={`Advertisement ${currentIndex + 1}`}
            className="w-full h-full object-contain transition-opacity duration-300 pointer-events-none"
            loading="eager"
          />

          {/* Left Arrow Navigation Button */}
          <button
            type="button"
            onClick={prevSlide}
            aria-label={t.previous}
            title={t.previous}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/45 hover:bg-black/75 text-white/75 hover:text-white border border-white/15 hover:border-white/30 flex items-center justify-center backdrop-blur-md transition-all cursor-pointer active:scale-95"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2]" />
          </button>

          {/* Right Arrow Navigation Button */}
          <button
            type="button"
            onClick={nextSlide}
            aria-label={t.next}
            title={t.next}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/45 hover:bg-black/75 text-white/75 hover:text-white border border-white/15 hover:border-white/30 flex items-center justify-center backdrop-blur-md transition-all cursor-pointer active:scale-95"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2]" />
          </button>
        </div>

        {/* Bottom Pagination Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-2.5">
          {images.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goToSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`transition-all rounded-full cursor-pointer h-1.5 ${
                currentIndex === idx
                  ? "w-5 bg-yellow-400 shadow-sm shadow-yellow-400/50"
                  : "w-1.5 bg-white/25 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
