"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Slide {
  id: number;
  content: React.ReactNode;
}

const SWIPE_THRESHOLD = 50;
const SWIPE_HORIZONTAL_MIN = 20;

interface IULPresentationSlidesProps {
  slides: Slide[];
  className?: string;
  /** Label for exit fullscreen button shown when in fullscreen (e.g. "Exit Fullscreen") */
  exitFullscreenLabel?: string;
}

export default function IULPresentationSlides({
  slides,
  className,
  exitFullscreenLabel = "Exit Fullscreen",
}: IULPresentationSlidesProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeIntentRef = useRef<"horizontal" | "vertical" | null>(null);

  // Detect when we're inside the fullscreen element
  useEffect(() => {
    const checkFullscreen = () => {
      const el = document.fullscreenElement ?? (document as any).webkitFullscreenElement ?? (document as any).mozFullScreenElement ?? (document as any).msFullscreenElement;
      const weAreFullscreen = !!el && containerRef.current?.closest("#presentation-content")
        ? el === document.getElementById("presentation-content")
        : !!el;
      setIsFullscreen(weAreFullscreen);
    };
    checkFullscreen();
    document.addEventListener("fullscreenchange", checkFullscreen);
    document.addEventListener("webkitfullscreenchange", checkFullscreen);
    document.addEventListener("mozfullscreenchange", checkFullscreen);
    document.addEventListener("MSFullscreenChange", checkFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", checkFullscreen);
      document.removeEventListener("webkitfullscreenchange", checkFullscreen);
      document.removeEventListener("mozfullscreenchange", checkFullscreen);
      document.removeEventListener("MSFullscreenChange", checkFullscreen);
    };
  }, []);

  const handleExitFullscreen = useCallback(() => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
  }, []);

  // Touch swipe: horizontal = change slide, vertical = scroll content
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swipeIntentRef.current = null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    if (swipeIntentRef.current === null) {
      if (Math.abs(dx) > SWIPE_HORIZONTAL_MIN || Math.abs(dy) > SWIPE_HORIZONTAL_MIN) {
        swipeIntentRef.current = Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical";
      }
    }
    if (swipeIntentRef.current === "horizontal" && Math.abs(dx) > 5) {
      e.preventDefault();
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - touchStartRef.current.x;
    const dy = endY - touchStartRef.current.y;
    if (swipeIntentRef.current === "horizontal" && Math.abs(dx) >= SWIPE_THRESHOLD) {
      if (dx > 0) prevSlide();
      else nextSlide();
    }
    touchStartRef.current = null;
    swipeIntentRef.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        if (currentSlide < slides.length - 1) {
          setDirection(1);
          setCurrentSlide((prev) => prev + 1);
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        if (currentSlide > 0) {
          setDirection(-1);
          setCurrentSlide((prev) => prev - 1);
        }
      } else if (e.key === "Home") {
        setDirection(-1);
        setCurrentSlide(0);
      } else if (e.key === "End") {
        setDirection(1);
        setCurrentSlide(slides.length - 1);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentSlide, slides.length]);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setDirection(1);
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const goToSlide = (index: number) => {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 120 : -120,
      opacity: 0,
      scale: 0.98,
      filter: "blur(4px)",
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 120 : -120,
      opacity: 0,
      scale: 0.98,
      filter: "blur(4px)",
    }),
  };

  const slideTransition = {
    x: { type: "spring" as const, stiffness: 320, damping: 32 },
    opacity: { duration: 0.35 },
    scale: { duration: 0.35 },
    filter: { duration: 0.25 },
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full h-full overflow-hidden touch-pan-y", className)}
      style={{ touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* Exit fullscreen button when in fullscreen - avoids needing to swipe up on tablet */}
      {isFullscreen && (
        <div className="absolute top-4 left-4 z-50">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExitFullscreen}
            className="gap-2 bg-white/95 backdrop-blur-md shadow-lg border border-gray-200 hover:bg-white"
            aria-label={exitFullscreenLabel}
          >
            <Minimize2 className="h-4 w-4" />
            <span className="font-medium">{exitFullscreenLabel}</span>
          </Button>
        </div>
      )}

      {/* Slide Content - vertical scroll allowed (swipe down/up for content), horizontal = slide change */}
      <div
        className="relative w-full h-full [&:fullscreen]:h-screen [&:fullscreen]:w-screen overflow-y-auto overflow-x-hidden overscroll-contain"
        style={{ overscrollBehavior: "contain" }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="min-h-full w-full flex items-center justify-center p-8 md:p-12 py-12 md:py-16"
          >
            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              className="w-full max-w-6xl"
            >
              {slides[currentSlide]?.content}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
        <Button
          variant="ghost"
          size="icon"
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className={cn(
            "pointer-events-auto ml-4 h-12 w-12 rounded-full bg-white/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:bg-white hover:scale-105 transition-all duration-200 border border-gray-200/50",
            currentSlide === 0 && "opacity-50 cursor-not-allowed"
          )}
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={nextSlide}
          disabled={currentSlide === slides.length - 1}
          className={cn(
            "pointer-events-auto mr-4 h-12 w-12 rounded-full bg-white/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:bg-white hover:scale-105 transition-all duration-200 border border-gray-200/50",
            currentSlide === slides.length - 1 && "opacity-50 cursor-not-allowed"
          )}
          aria-label="Next slide"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Slide Indicator */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              index === currentSlide
                ? "w-8 bg-[#003366] shadow-md"
                : "w-2 bg-gray-300 hover:bg-gray-400"
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Slide Counter */}
      <div className="absolute top-6 right-6 bg-[#003366]/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
        {currentSlide + 1} / {slides.length}
      </div>
    </div>
  );
}

