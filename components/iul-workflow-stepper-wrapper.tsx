"use client";

import { useRouter } from "@/i18n/navigation";
import IULWorkflowStepper from "@/components/iul-workflow-stepper";

interface Step {
  id: string;
  label: string;
  completed?: boolean;
}

interface IULWorkflowStepperWrapperProps {
  steps: Step[];
  currentStep: number;
}

export default function IULWorkflowStepperWrapper({ 
  steps, 
  currentStep 
}: IULWorkflowStepperWrapperProps) {
  const router = useRouter();
  
  const handleStepClick = (index: number) => {
    const routes: ("/iul/presentation" | "/iul/application" | "/iul/referrals")[] = [
      "/iul/presentation", 
      "/iul/application", 
      "/iul/referrals"
    ];
    
    if (routes[index] && routes[index] !== undefined) {
      try {
        router.push(routes[index] as any);
      } catch (error) {
        console.error("Navigation error:", error);
        // Fallback to window.location if router.push fails
        window.location.href = routes[index];
      }
    }
  };
  
  return <IULWorkflowStepper steps={steps} currentStep={currentStep} onStepClick={handleStepClick} />;
}

