"use client";

import { useRouter } from "@/i18n/navigation";
import IULWorkflowStepper from "@/components/iul-workflow-stepper";

interface Step {
  id: string;
  label: string;
  completed?: boolean;
}

interface FinalExpenseWorkflowStepperWrapperProps {
  steps: Step[];
  currentStep: number;
}

const FE_ROUTES = [
  "/final-expense/presentation",
  "/final-expense/qualification",
  "/final-expense/referrals",
] as const;

export default function FinalExpenseWorkflowStepperWrapper({
  steps,
  currentStep,
}: FinalExpenseWorkflowStepperWrapperProps) {
  const router = useRouter();

  const handleStepClick = (index: number) => {
    const route = FE_ROUTES[index];
    if (route != null) {
      try {
        router.push(route);
      } catch (error) {
        console.error("Navigation error:", error);
        window.location.href = route;
      }
    }
  };

  return (
    <IULWorkflowStepper
      steps={steps}
      currentStep={currentStep}
      onStepClick={handleStepClick}
    />
  );
}
