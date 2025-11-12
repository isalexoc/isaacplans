"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  id: string;
  label: string;
  completed?: boolean;
}

interface IULWorkflowStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export default function IULWorkflowStepper({
  steps,
  currentStep,
  onStepClick,
  className,
}: IULWorkflowStepperProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = step.completed || index < currentStep;
          const isClickable = !!onStepClick;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center flex-1">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(index)}
                  disabled={!isClickable}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                    isActive &&
                      "border-blue-600 bg-blue-600 text-white shadow-lg scale-110",
                    isCompleted &&
                      !isActive &&
                      "border-green-600 bg-green-600 text-white",
                    !isCompleted &&
                      !isActive &&
                      "border-gray-300 bg-white text-gray-400",
                    isClickable && "cursor-pointer hover:scale-105",
                    !isClickable && "cursor-not-allowed"
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </button>
                {/* Step Label */}
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(index)}
                  disabled={!isClickable}
                  className={cn(
                    "mt-2 text-xs sm:text-sm font-medium text-center transition-colors",
                    isActive && "text-blue-600 font-semibold",
                    isCompleted && !isActive && "text-green-600",
                    !isCompleted && !isActive && "text-gray-500",
                    isClickable && "cursor-pointer hover:text-blue-600 hover:underline",
                    !isClickable && "cursor-not-allowed"
                  )}
                >
                  {step.label}
                </button>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2 transition-colors",
                    index < currentStep ? "bg-green-600" : "bg-gray-300"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

