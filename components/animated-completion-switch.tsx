"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimatedCompletionSwitchProps {
  label?: string;
  completedLabel?: string;
  incompleteLabel?: string;
  description?: string;
  onToggle?: (completed: boolean) => void;
  defaultChecked?: boolean;
  className?: string;
  completedText?: string;
  pendingText?: string;
}

export default function AnimatedCompletionSwitch({
  label,
  completedLabel,
  incompleteLabel,
  description,
  onToggle,
  defaultChecked = false,
  className,
  completedText = "✓ Completed",
  pendingText = "Click to Complete",
}: AnimatedCompletionSwitchProps) {
  const [isCompleted, setIsCompleted] = useState(defaultChecked);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Use dynamic label based on state, or fallback to static label
  const displayLabel = isCompleted 
    ? (completedLabel || label || "Completed")
    : (incompleteLabel || label || "Incomplete");

  const handleToggle = () => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    const newValue = !isCompleted;
    setIsCompleted(newValue);
    onToggle?.(newValue);
    
    setTimeout(() => setIsAnimating(false), 1000);
  };

  return (
    <div className={cn("w-full max-w-2xl mx-auto", className)}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "relative p-8 rounded-2xl shadow-2xl border-4 transition-all duration-500 cursor-pointer",
          isCompleted
            ? "bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-green-400"
            : "bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 border-gray-300"
        )}
        onClick={handleToggle}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Background Animation */}
        <AnimatePresence>
          {isCompleted && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-400/20 to-emerald-400/20"
            />
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Switch Circle */}
          <motion.div
            className={cn(
              "relative w-32 h-32 rounded-full flex items-center justify-center mb-6 transition-all duration-500",
              isCompleted
                ? "bg-gradient-to-br from-green-500 to-emerald-600 shadow-2xl shadow-green-500/50"
                : "bg-gradient-to-br from-gray-300 to-gray-400 shadow-lg"
            )}
            animate={{
              scale: isCompleted ? [1, 1.1, 1] : 1,
              rotate: isCompleted ? [0, 5, -5, 0] : 0,
            }}
            transition={{
              duration: 0.6,
              ease: "easeOut",
            }}
          >
            {/* Sparkles Animation */}
            <AnimatePresence>
              {isCompleted && (
                <>
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0],
                        x: Math.cos((i * Math.PI * 2) / 8) * 80,
                        y: Math.sin((i * Math.PI * 2) / 8) * 80,
                      }}
                      transition={{
                        duration: 1,
                        delay: i * 0.1,
                        repeat: Infinity,
                        repeatDelay: 2,
                      }}
                      className="absolute"
                    >
                      <Sparkles className="h-4 w-4 text-yellow-400" />
                    </motion.div>
                  ))}
                </>
              )}
            </AnimatePresence>

            {/* Check Icon */}
            <AnimatePresence mode="wait">
              {isCompleted ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                  }}
                >
                  <Check className="h-16 w-16 text-white" strokeWidth={4} />
                </motion.div>
              ) : (
                <motion.div
                  key="circle"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="w-12 h-12 rounded-full bg-white/30"
                />
              )}
            </AnimatePresence>

            {/* Ripple Effect */}
            <AnimatePresence>
              {isCompleted && (
                <>
                  {[0, 1].map((i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, opacity: 0.8 }}
                      animate={{
                        scale: [1, 2],
                        opacity: [0.8, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        delay: i * 0.3,
                        repeat: Infinity,
                        repeatDelay: 2,
                      }}
                      className="absolute inset-0 rounded-full border-4 border-white/50"
                    />
                  ))}
                </>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Label */}
          <motion.h3
            key={displayLabel}
            className={cn(
              "text-3xl md:text-4xl font-bold mb-4 transition-colors duration-500",
              isCompleted ? "text-green-700" : "text-gray-700"
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              scale: isCompleted ? [1, 1.05, 1] : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            {displayLabel}
          </motion.h3>

          {/* Description */}
          {description && (
            <motion.p
              className={cn(
                "text-lg md:text-xl transition-colors duration-500 max-w-md",
                isCompleted ? "text-green-600" : "text-gray-600"
              )}
            >
              {description}
            </motion.p>
          )}

          {/* Status Text */}
          <AnimatePresence mode="wait">
            {isCompleted ? (
              <motion.div
                key="completed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 px-6 py-3 bg-green-500 text-white rounded-full font-semibold text-lg shadow-lg"
              >
                {completedText}
              </motion.div>
            ) : (
              <motion.div
                key="pending"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 px-6 py-3 bg-gray-300 text-gray-700 rounded-full font-semibold text-lg"
              >
                {pendingText}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

