"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Slide {
  id: number;
  content: React.ReactNode;
}

interface IULPresentationSlidesProps {
  slides: Slide[];
  className?: string;
}

export default function IULPresentationSlides({
  slides,
  className,
}: IULPresentationSlidesProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

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
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      {/* Slide Content */}
      <div className="relative w-full h-full [&:fullscreen]:h-screen [&:fullscreen]:w-screen overflow-y-auto overflow-x-hidden">
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

