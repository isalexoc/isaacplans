"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { trackInitiateCheckout, trackLead, updateAdvancedMatching, trackCustomEvent } from "@/lib/facebook-pixel";
import { getFacebookCookies } from "@/lib/meta-capi";
import { sendGAEvent } from '@next/third-parties/google';

import { ArrowLeft, ArrowRight, Check, ChevronsUpDown } from "lucide-react";

// Generate event ID for CAPI deduplication (client-side safe)
function generateEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// All US states
const ALL_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
];

interface FormData {
  retirementTimeline: string;
  investments: string[];
  monthlySavings: string;
  age: number;
  state: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const TOTAL_STEPS = 8;

// Step names mapping for comprehensive tracking
const STEP_NAMES: Record<number, string> = {
  1: "Retirement Timeline",
  2: "Current Investments",
  3: "Monthly Savings",
  4: "Age",
  5: "State",
  6: "Name",
  7: "Email",
  8: "Phone",
};

// Step hash mapping for URL tracking (like competitor)
const STEP_HASHES: Record<number, string> = {
  1: "#retirement-timeline",
  2: "#current-investments",
  3: "#monthly-savings",
  4: "#age",
  5: "#state",
  6: "#name",
  7: "#email",
  8: "#phone",
};

// Generate screen ID for a step
function generateStepScreenId(step: number): string {
  const stepName = STEP_NAMES[step].toLowerCase().replace(/\s+/g, "-");
  return `id-${stepName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default function IULLeadGenForm() {
  const t = useTranslations("iulQuote.form");
  const locale = useLocale();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Validation errors
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  
  // State combobox
  const [stateOpen, setStateOpen] = useState(false);
  const [stateSearch, setStateSearch] = useState("");
  
  // Track navigation direction to prevent auto-advance when going back
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  // Track the previous step to detect back navigation
  const [previousStep, setPreviousStep] = useState<number>(1);
  // Track values when arriving at auto-advance steps to prevent auto-advance if value already existed
  const [valuesOnArrival, setValuesOnArrival] = useState<{
    step1?: string;
    step3?: string;
    step5?: string;
  }>({});
  
  // Local state for age input to allow empty input
  const [ageInputValue, setAgeInputValue] = useState<string>("");
  
  // Time tracking for analytics
  const [formStartTime] = useState(Date.now());
  const [stepStartTimes, setStepStartTimes] = useState<Record<number, number>>({});
  
  const [formData, setFormData] = useState<FormData>({
    retirementTimeline: "",
    investments: [],
    monthlySavings: "",
    age: 29,
    state: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // Helper function to get UTM parameters from URL
  const getUTMParams = useCallback(() => {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || "",
    };
  }, []);

  // Track form start with a custom event (more accurate than InitiateCheckout for lead gen)
  useEffect(() => {
    if (currentStep === 1) {
      // Initialize step start time for step 1
      setStepStartTimes({ [1]: Date.now() });
      
      trackCustomEvent("StartForm", {
        form_type: "IUL Lead Generation",
        form_id: "iul_lead_gen",
        source: "iul_lead_gen",
      }, false); // Don't include comprehensive params for this simple event
      
      // Track form start in GA4
      sendGAEvent('event', 'form_start', {
        form_type: 'IUL Lead Generation',
        form_id: 'iul_lead_gen',
        language: locale,
      });
    }
  }, [currentStep, locale]);
  
  // Sync age input value with formData.age when step changes or formData changes externally (slider)
  useEffect(() => {
    if (currentStep === 4) {
      setAgeInputValue(formData.age === 0 ? "" : formData.age.toString());
    }
  }, [formData.age, currentStep]);

  // Track values when arriving at auto-advance steps to prevent auto-advance if value already existed
  useEffect(() => {
    if (currentStep === 1) {
      setValuesOnArrival((prev) => ({ ...prev, step1: formData.retirementTimeline }));
    } else if (currentStep === 3) {
      setValuesOnArrival((prev) => ({ ...prev, step3: formData.monthlySavings }));
    } else if (currentStep === 5) {
      setValuesOnArrival((prev) => ({ ...prev, step5: formData.state }));
    }
  }, [currentStep]); // Only run when step changes, not when values change
  
  // Reset state search when popover closes
  useEffect(() => {
    if (!stateOpen) {
      setStateSearch("");
    }
  }, [stateOpen]);

  // Track time spent on each step
  useEffect(() => {
    // Record start time for current step
    const currentTime = Date.now();
    setStepStartTimes(prev => {
      const newTimes = {
        ...prev,
        [currentStep]: currentTime
      };
      
      // If we have a previous step and it's different, calculate time spent
      if (previousStep !== currentStep && prev[previousStep]) {
        const timeSpent = Math.round((currentTime - prev[previousStep]) / 1000);
        
        // Only track if time is reasonable (not a quick back/forward)
        if (timeSpent > 0 && timeSpent < 3600) { // Less than 1 hour
          sendGAEvent('event', 'form_step_time', {
            step_number: previousStep,
            step_name: STEP_NAMES[previousStep],
            time_spent_seconds: timeSpent,
            form_type: 'IUL Lead Generation',
            form_id: 'iul_lead_gen',
          });
        }
      }
      
      return newTimes;
    });
  }, [currentStep, previousStep]);

  // Track form abandonment (when user leaves without completing)
  useEffect(() => {
    // Track abandonment when user leaves the page
    const handleBeforeUnload = () => {
      if (currentStep > 1 && currentStep < TOTAL_STEPS && !isComplete) {
        const timeOnForm = Math.round((Date.now() - formStartTime) / 1000);
        sendGAEvent('event', 'form_abandon', {
          step_abandoned: currentStep,
          step_name: STEP_NAMES[currentStep],
          progress_percentage: Math.round((currentStep / TOTAL_STEPS) * 100),
          form_type: 'IUL Lead Generation',
          form_id: 'iul_lead_gen',
          time_on_form: timeOnForm,
          abandon_type: 'page_unload',
        });
      }
    };

    // Track when page becomes hidden (user switches tabs, closes, etc.)
    const handleVisibilityChange = () => {
      if (document.hidden && currentStep > 1 && currentStep < TOTAL_STEPS && !isComplete) {
        const timeOnForm = Math.round((Date.now() - formStartTime) / 1000);
        sendGAEvent('event', 'form_abandon', {
          step_abandoned: currentStep,
          step_name: STEP_NAMES[currentStep],
          progress_percentage: Math.round((currentStep / TOTAL_STEPS) * 100),
          form_type: 'IUL Lead Generation',
          form_id: 'iul_lead_gen',
          time_on_form: timeOnForm,
          abandon_type: 'visibility_change',
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentStep, isComplete, formStartTime]);

  // Phone formatting function
  const formatPhoneNumber = (value: string): string => {
    const phoneNumber = value.replace(/\D/g, "");
    if (phoneNumber.length === 0) return "";
    if (phoneNumber.length <= 3) return `(${phoneNumber}`;
    if (phoneNumber.length <= 6) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  // Email validation
  const validateEmail = (email: string): string | null => {
    if (!email) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (email.includes("@") && !email.includes(".")) {
        return t("errors.invalidEmailIncomplete", { defaultValue: "Please enter a valid email address (e.g., example@gmail.com)" });
      }
      return t("errors.invalidEmail", { defaultValue: "Please enter a valid email address (e.g., example@gmail.com)" });
    }
    return null;
  };

  // Phone validation
  const validatePhone = (phone: string): string | null => {
    if (!phone) return null;
    const phoneNumber = phone.replace(/\D/g, "");
    if (phoneNumber.length < 10) {
      return t("errors.invalidPhone", { defaultValue: "Please enter a valid 10-digit phone number" });
    }
    if (phoneNumber.length > 10) {
      return t("errors.invalidPhoneLength", { defaultValue: "Phone number is too long. Please enter a valid 10-digit number" });
    }
    return null;
  };

  // Track validation errors
  const trackValidationError = useCallback((step: number, field: string, errorType: string) => {
    sendGAEvent('event', 'form_validation_error', {
      step_number: step,
      step_name: STEP_NAMES[step],
      field_name: field,
      error_type: errorType,
      form_type: 'IUL Lead Generation',
      form_id: 'iul_lead_gen',
    });
  }, []);

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Real-time validation for email
    if (field === "email") {
      const error = validateEmail(value);
      setEmailError(error);
      // Track validation error if it exists
      if (error && currentStep === 7) {
        trackValidationError(7, 'email', 'invalid_format');
      }
    }
    
    // Real-time validation for phone
    if (field === "phone") {
      const error = validatePhone(value);
      setPhoneError(error);
      // Track validation error if it exists
      if (error && currentStep === 8) {
        trackValidationError(8, 'phone', 'invalid_format');
      }
    }
    
    // Reset previousStep when user changes a value on auto-advance steps
    // This allows auto-advance to work again if they change their selection
    if ((field === "retirementTimeline" && currentStep === 1) ||
        (field === "monthlySavings" && currentStep === 3) ||
        (field === "state" && currentStep === 5)) {
      setPreviousStep(currentStep);
      // Update valuesOnArrival to the old value so that the new value triggers auto-advance
      if (field === "retirementTimeline") {
        setValuesOnArrival((prev) => ({ ...prev, step1: formData.retirementTimeline }));
      } else if (field === "monthlySavings") {
        setValuesOnArrival((prev) => ({ ...prev, step3: formData.monthlySavings }));
      } else if (field === "state") {
        setValuesOnArrival((prev) => ({ ...prev, step5: formData.state }));
      }
    }
    
    // Note: Removed individual option tracking to reduce event noise
    // Step completion tracking below provides sufficient funnel analytics
  };

  const handleInvestmentToggle = (investment: string) => {
    const isAdding = !formData.investments.includes(investment);
    
    setFormData((prev) => {
      const investments = isAdding
        ? [...prev.investments, investment]
        : prev.investments.filter((i) => i !== investment);
      return { ...prev, investments };
    });
    
    // Note: Removed individual investment tracking to reduce event noise
    // Step completion tracking provides sufficient funnel analytics
  };

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 1:
        return !!formData.retirementTimeline;
      case 2:
        return formData.investments.length > 0;
      case 3:
        return !!formData.monthlySavings;
      case 4:
        return formData.age >= 0 && formData.age <= 80;
      case 5:
        return !!formData.state;
      case 6:
        return !!formData.firstName && !!formData.lastName;
      case 7:
        return !!formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && !emailError;
      case 8:
        return !!formData.phone && formData.phone.replace(/\D/g, "").length >= 10 && !phoneError;
      default:
        return false;
    }
  }, [currentStep, formData]);

  // Track step completion with consolidated event (reduces noise vs individual events per step)
  const trackStepCompletion = useCallback((step: number, autoAdvanced: boolean = false) => {
    const progress = (step / TOTAL_STEPS) * 100;
    const nextStep = step + 1;
    const stepName = STEP_NAMES[step];
    
    // Get selected value for this step (for context)
    let selectedValue: string | null = null;
    switch (step) {
      case 1:
        selectedValue = formData.retirementTimeline || null;
        break;
      case 2:
        selectedValue = formData.investments.join(", ") || null;
        break;
      case 3:
        selectedValue = formData.monthlySavings || null;
        break;
      case 4:
        selectedValue = formData.age.toString();
        break;
      case 5:
        selectedValue = formData.state || null;
        break;
    }

    // Calculate time spent on this step
    const timeOnStep = stepStartTimes[step] 
      ? Math.round((Date.now() - stepStartTimes[step]) / 1000)
      : 0;
    const totalTimeOnForm = Math.round((Date.now() - formStartTime) / 1000);

    // ✅ Use ONE event name with parameters (cleaner than unique event names per step)
    trackCustomEvent("FormStep", {
      step_number: step,
      step_name: stepName,
      selected_value: selectedValue,
      progress_percentage: Math.round(progress),
      steps_completed: step,
      total_steps: TOTAL_STEPS,
      form_type: "IUL Lead Generation",
      form_id: "iul_lead_gen",
      auto_advanced: autoAdvanced,
    }, false); // Don't include comprehensive params to reduce noise
    
    // Track form progress in GA4 with enhanced metrics
    sendGAEvent('event', 'form_progress', {
      step_number: step,
      step_name: stepName,
      progress_percentage: Math.round(progress),
      form_type: 'IUL Lead Generation',
      form_id: 'iul_lead_gen',
      selected_value: selectedValue,
      time_on_step: timeOnStep,
      total_time_on_form: totalTimeOnForm,
      is_auto_advanced: autoAdvanced,
    });
  }, [formData, stepStartTimes, formStartTime]);

  const handleNext = useCallback((skipTracking: boolean = false) => {
    if (canProceed() && currentStep < TOTAL_STEPS) {
      // Track step completion before advancing (unless already tracked by auto-advance)
      if (!skipTracking) {
        trackStepCompletion(currentStep, false);
      }
      setPreviousStep(currentStep);
      setCurrentStep((prev) => prev + 1);
    }
  }, [canProceed, currentStep, trackStepCompletion]);

  const handleBack = () => {
    if (currentStep > 1) {
      setIsNavigatingBack(true);
      
      // Track back navigation
      sendGAEvent('event', 'form_step_back', {
        from_step: currentStep,
        to_step: currentStep - 1,
        step_name: STEP_NAMES[currentStep],
        form_type: 'IUL Lead Generation',
        form_id: 'iul_lead_gen',
      });
      
      setPreviousStep(currentStep);
      setCurrentStep((prev) => prev - 1);
      // Reset the flag after a longer delay to prevent auto-advance when going back
      setTimeout(() => setIsNavigatingBack(false), 1000);
    }
  };

  // Auto-advance for single-select steps (1, 3, 5) after selection
  // Only auto-advance if not navigating back, not coming from a higher step, and value was just changed
  useEffect(() => {
    // Don't auto-advance when going back or if we came from a higher step
    if (isNavigatingBack || previousStep > currentStep) return;
    
    let timer: NodeJS.Timeout | null = null;
    
    // Only auto-advance if the value exists AND is different from when we arrived
    // This prevents auto-advance when navigating to a step that already has a value
    if (currentStep === 1 && formData.retirementTimeline && canProceed()) {
      // Only auto-advance if value changed (was empty or different when we arrived)
      if (formData.retirementTimeline !== valuesOnArrival.step1) {
        timer = setTimeout(() => {
          // Track step completion before auto-advancing (skip tracking in handleNext)
          trackStepCompletion(currentStep, true);
          handleNext(true); // Pass true to skip duplicate tracking
        }, 500); // 500ms delay for better UX
      }
    } else if (currentStep === 3 && formData.monthlySavings && canProceed()) {
      // Only auto-advance if value changed (was empty or different when we arrived)
      if (formData.monthlySavings !== valuesOnArrival.step3) {
        timer = setTimeout(() => {
          trackStepCompletion(currentStep, true);
          handleNext(true); // Pass true to skip duplicate tracking
        }, 500);
      }
    } else if (currentStep === 5 && formData.state && canProceed()) {
      // Only auto-advance if value changed (was empty or different when we arrived)
      if (formData.state !== valuesOnArrival.step5) {
        timer = setTimeout(() => {
          trackStepCompletion(currentStep, true);
          handleNext(true); // Pass true to skip duplicate tracking
        }, 500);
      }
    }
    // Note: Step 4 (age) doesn't auto-advance - user needs to confirm with Next button
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [formData.retirementTimeline, formData.monthlySavings, formData.state, currentStep, canProceed, handleNext, trackStepCompletion, isNavigatingBack, previousStep, valuesOnArrival]);

  const handleSubmit = async () => {
    if (!canProceed()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Generate event ID for CAPI deduplication (must be same for Pixel and CAPI)
      const eventId = generateEventId();
      
      // Get Facebook cookies for better matching
      const { fbp, fbc } = getFacebookCookies();
      
      // Submit to Agent CRM with CAPI metadata
      const phoneNumber = `+1${formData.phone.replace(/\D/g, "")}`;
      const response = await fetch("/api/create-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: phoneNumber,
          // IUL Lead Gen form data
          iulLeadGenData: {
            retirementTimeline: formData.retirementTimeline,
            investments: formData.investments,
            monthlySavings: formData.monthlySavings,
            age: formData.age,
            state: formData.state,
            language: locale, // Include the language/locale
          },
          // CAPI metadata for deduplication
          meta: {
            eventId,
            fbp,
            fbc,
            eventSourceUrl: window.location.href,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit form");
      }

      const data = await response.json();

      // Only track Lead for NEW contacts (not duplicates)
      // This prevents inflating conversion counts
      if (!data.isExisting) {
        // Prepare user data for advanced matching (stored for future page loads)
        const userData = {
          em: formData.email?.toLowerCase().trim(),
          fn: formData.firstName?.toLowerCase().trim(),
          ln: formData.lastName?.toLowerCase().trim(),
          ph: phoneNumber,
        };

        // Update advanced matching (stores in localStorage for next page load)
        updateAdvancedMatching(userData);

        // Track Lead event with eventID for CAPI deduplication
        // Note: PII is NOT passed in event params - it's handled via init/CAPI
        trackLead(
          {
            contentName: "IUL Lead Generation Campaign",
            source: "iul_lead_gen",
            value: 100,
          },
          eventId // Pass eventID so Pixel and CAPI can deduplicate
        );

        // Get UTM parameters for GA4 tracking
        const utmParams = getUTMParams();
        
        // Calculate completion metrics
        const totalTimeSeconds = Math.round((Date.now() - formStartTime) / 1000);
        const averageTimePerStep = Math.round(totalTimeSeconds / TOTAL_STEPS);
        
        // Track Lead in GA4 with completion metrics
        sendGAEvent('event', 'generate_lead', {
          ...utmParams,
          currency: 'USD',
          value: 100,
          source: 'iul_lead_gen',
          form_type: 'IUL Lead Generation',
          form_id: 'iul_lead_gen',
          language: locale,
          total_time_seconds: totalTimeSeconds,
          average_time_per_step: averageTimePerStep,
          total_steps: TOTAL_STEPS,
        });
      } else {
        // For existing contacts, optionally track a different event (or skip)
        // This helps you understand repeat submissions without inflating Lead count
        if (process.env.NODE_ENV === "development") {
          console.log("[Facebook Pixel] Skipping Lead event for existing contact");
        }
      }

      setIsComplete(true);
    } catch (error) {
      console.error("Error submitting form:", error);
      setSubmitError(
        error instanceof Error ? error.message : t("errors.submitFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = (currentStep / TOTAL_STEPS) * 100;

  // Helper function to build calendar URL
  const getCalendarUrl = useCallback(() => {
    const calendarPath = locale === "es" ? "/iul/calendario" : "/iul/calendar";
    const queryParams = new URLSearchParams({
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone.replace(/\D/g, ""), // Remove formatting for phone
    });
    return `/${locale}${calendarPath}?${queryParams.toString()}`;
  }, [locale, formData]);

  // Countdown and redirect to calendar page after 5 seconds when form is complete
  useEffect(() => {
    if (!isComplete) return;
    
    setCountdown(5);
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          router.push(getCalendarUrl());
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [isComplete, getCalendarUrl, router]);

  // Handle manual redirect (when user clicks the link)
  const handleScheduleNow = () => {
    router.push(getCalendarUrl());
  };

  // Render completion screen or form
  if (isComplete) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Check className="w-8 h-8 text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold mb-2">{t("completion.title")}</h2>
          <p className="text-muted-foreground mb-4">
            {t("completion.message")}
          </p>
          {countdown !== null && countdown > 0 && (
            <motion.p
              key={countdown}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-lg font-semibold text-[#0284c7] mb-4"
            >
              {t("completion.redirectCountdown", { 
                seconds: countdown
              }) || `You'll be redirected to schedule an appointment in ${countdown}...`}
            </motion.p>
          )}
          <Button
            onClick={handleScheduleNow}
            className="bg-gradient-to-r from-[#0284c7] to-[#2563eb] hover:from-[#0369a1] hover:to-[#1d4ed8]"
          >
            {t("completion.scheduleNow")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Render form
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6 md:p-8">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium" id="progress-label">
              {t("progress.step", { current: currentStep, total: TOTAL_STEPS })}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("progress.percent", { percent: Math.round(progress) })}
            </span>
          </div>
          <Progress 
            value={progress} 
            className="h-2" 
            aria-labelledby="progress-label"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {/* Error Message */}
        {submitError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
          </div>
        )}

        {/* Form Steps */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Step 1: Retirement Timeline */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">
                    {t("steps.1.title")}
                  </Label>
                  <RadioGroup
                    value={formData.retirementTimeline}
                    onValueChange={(value) => updateFormData("retirementTimeline", value)}
                    className="space-y-3"
                  >
                    <label
                      htmlFor="within-10"
                      className="flex items-center space-x-2 p-4 border rounded-md bg-transparent hover:bg-transparent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="within-10" id="within-10" />
                      <span className="flex-1">{t("steps.1.options.within-10")}</span>
                    </label>
                    <label
                      htmlFor="within-20"
                      className="flex items-center space-x-2 p-4 border rounded-md bg-transparent hover:bg-transparent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="within-20" id="within-20" />
                      <span className="flex-1">{t("steps.1.options.within-20")}</span>
                    </label>
                    <label
                      htmlFor="within-30"
                      className="flex items-center space-x-2 p-4 border rounded-md bg-transparent hover:bg-transparent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="within-30" id="within-30" />
                      <span className="flex-1">{t("steps.1.options.within-30")}</span>
                    </label>
                    <label
                      htmlFor="retired"
                      className="flex items-center space-x-2 p-4 border rounded-md bg-transparent hover:bg-transparent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="retired" id="retired" />
                      <span className="flex-1">{t("steps.1.options.retired")}</span>
                    </label>
                  </RadioGroup>
                </div>
              </div>
            )}

            {/* Step 2: Current Investments */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">
                    {t("steps.2.title")}
                  </Label>
                  <p className="text-sm text-muted-foreground mb-4">{t("steps.2.subtitle")}</p>
                  <div className="space-y-3">
                    {[
                      { key: "401k", value: "401(k)" },
                      { key: "ira", value: "IRA" },
                      { key: "cashSavings", value: "Cash Savings" },
                      { key: "activeTrading", value: "Active Trading" },
                      { key: "selfDirected", value: "Self Directed Brokerage Account" },
                      { key: "none", value: "No current investments" },
                    ].map(({ key, value }) => {
                      const investmentId = `investment-${key}`;
                      return (
                        <label
                          key={key}
                          htmlFor={investmentId}
                          className="flex items-center space-x-2 p-4 border rounded-md bg-transparent hover:bg-transparent cursor-pointer transition-colors"
                        >
                          <Checkbox
                            id={investmentId}
                            checked={formData.investments.includes(value)}
                            onCheckedChange={() => handleInvestmentToggle(value)}
                          />
                          <span className="flex-1">{t(`steps.2.options.${key}`)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Monthly Savings */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">
                    {t("steps.3.title")}
                  </Label>
                  <RadioGroup
                    value={formData.monthlySavings}
                    onValueChange={(value) => updateFormData("monthlySavings", value)}
                    className="space-y-3"
                  >
                    <label
                      htmlFor="less-300"
                      className="flex items-center space-x-2 p-4 border rounded-md bg-transparent hover:bg-transparent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="less-300" id="less-300" />
                      <span className="flex-1">{t("steps.3.options.less-300")}</span>
                    </label>
                    <label
                      htmlFor="300-500"
                      className="flex items-center space-x-2 p-4 border rounded-md bg-transparent hover:bg-transparent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="300-500" id="300-500" />
                      <span className="flex-1">{t("steps.3.options.300-500")}</span>
                    </label>
                    <label
                      htmlFor="500-1000"
                      className="flex items-center space-x-2 p-4 border rounded-md bg-transparent hover:bg-transparent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="500-1000" id="500-1000" />
                      <span className="flex-1">{t("steps.3.options.500-1000")}</span>
                    </label>
                    <label
                      htmlFor="more-1000"
                      className="flex items-center space-x-2 p-4 border rounded-md bg-transparent hover:bg-transparent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="more-1000" id="more-1000" />
                      <span className="flex-1">{t("steps.3.options.more-1000")}</span>
                    </label>
                  </RadioGroup>
                </div>
              </div>
            )}

            {/* Step 4: Age */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">
                    {t("steps.4.title")}
                  </Label>
                  <div className="space-y-4">
                    <div className="px-2">
                      <Slider
                        value={[formData.age]}
                        onValueChange={(value) => updateFormData("age", value[0])}
                        min={0}
                        max={80}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div className="text-center space-y-3">
                      <div className="flex items-center justify-center gap-4">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={ageInputValue}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            // Update local state immediately for responsive UI
                            setAgeInputValue(inputValue);
                            
                            // Allow empty input
                            if (inputValue === "") {
                              return; // Keep input empty, don't update formData yet
                            }
                            
                            // Only allow digits
                            const digitsOnly = inputValue.replace(/\D/g, "");
                            if (digitsOnly === "") {
                              setAgeInputValue("");
                              return;
                            }
                            
                            const value = parseInt(digitsOnly, 10);
                            if (!isNaN(value)) {
                              const clampedValue = Math.min(Math.max(0, value), 80);
                              updateFormData("age", clampedValue);
                              // Update local state to match clamped value
                              setAgeInputValue(clampedValue.toString());
                            }
                          }}
                          onBlur={(e) => {
                            // Ensure we have a valid age on blur
                            const inputValue = e.target.value.trim();
                            if (inputValue === "") {
                              // If empty, restore to current formData age or default to 29
                              const ageToUse = formData.age > 0 ? formData.age : 29;
                              updateFormData("age", ageToUse);
                              setAgeInputValue(ageToUse.toString());
                            } else {
                              const value = parseInt(inputValue, 10);
                              if (isNaN(value) || value < 0) {
                                const ageToUse = formData.age > 0 ? formData.age : 29;
                                updateFormData("age", ageToUse);
                                setAgeInputValue(ageToUse.toString());
                              } else {
                                const clampedValue = Math.min(Math.max(0, value), 80);
                                updateFormData("age", clampedValue);
                                setAgeInputValue(clampedValue.toString());
                              }
                            }
                          }}
                          min={0}
                          max={80}
                          className="w-24 h-12 text-center text-2xl font-bold text-[#0284c7] border-2 border-[#0284c7] focus:outline-none focus:ring-0 focus:bg-transparent active:bg-transparent"
                        />
                        <span className="text-2xl font-semibold text-muted-foreground">{t("steps.4.yearsOld")}</span>
                      </div>
                      {formData.age >= 18 && (
                        <p className="text-sm text-muted-foreground">
                          {t("steps.4.retirementMessage", { years: Math.max(0, 65 - formData.age) })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: State */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">
                    {t("steps.5.title")}
                  </Label>
                  <Popover open={stateOpen} onOpenChange={setStateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={stateOpen}
                        className="w-full h-12 justify-between text-base font-normal"
                      >
                        {formData.state
                          ? ALL_STATES.find((state) => state.code === formData.state)?.name
                          : t("steps.5.placeholder")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder={t("steps.5.searchPlaceholder", { defaultValue: "Search state..." })}
                          value={stateSearch}
                          onValueChange={setStateSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {t("steps.5.noResults", { defaultValue: "No state found." })}
                          </CommandEmpty>
                          <CommandGroup>
                            {(() => {
                              const searchLower = stateSearch.toLowerCase().trim();
                              
                              // Filter states based on search
                              const filteredStates = ALL_STATES.filter((state) => {
                                if (!searchLower) return true;
                                
                                const nameLower = state.name.toLowerCase();
                                const codeLower = state.code.toLowerCase();
                                
                                // Priority 1: Exact match or starts with (e.g., "co" -> Colorado, Connecticut)
                                if (nameLower.startsWith(searchLower) || codeLower.startsWith(searchLower)) {
                                  return true;
                                }
                                
                                // Priority 2: Check if any word in the state name starts with the search term
                                const nameWords = nameLower.split(/\s+/);
                                if (nameWords.some(word => word.startsWith(searchLower))) {
                                  return true;
                                }
                                
                                // Priority 3: Fuzzy match for partial word matches (e.g., "vigin" -> "virginia")
                                // Check if search term appears as a sequence of characters in state name
                                let searchIndex = 0;
                                for (let i = 0; i < nameLower.length && searchIndex < searchLower.length; i++) {
                                  if (nameLower[i] === searchLower[searchIndex]) {
                                    searchIndex++;
                                  }
                                }
                                if (searchIndex === searchLower.length) {
                                  return true;
                                }
                                
                                // Priority 4: Contains match (only for 3+ characters to avoid too many results)
                                if (searchLower.length >= 3) {
                                  if (nameLower.includes(searchLower) || codeLower.includes(searchLower)) {
                                    return true;
                                  }
                                }
                                
                                return false;
                              });
                              
                              // Sort filtered states
                              const sortedStates = filteredStates.sort((a, b) => {
                                if (!searchLower) return a.name.localeCompare(b.name);
                                
                                const searchLowerSort = searchLower;
                                const aName = a.name.toLowerCase();
                                const bName = b.name.toLowerCase();
                                const aCode = a.code.toLowerCase();
                                const bCode = b.code.toLowerCase();
                                
                                // Priority 1: States that start with search term (name or code)
                                const aStarts = aName.startsWith(searchLowerSort) || aCode.startsWith(searchLowerSort);
                                const bStarts = bName.startsWith(searchLowerSort) || bCode.startsWith(searchLowerSort);
                                
                                if (aStarts && !bStarts) return -1;
                                if (!aStarts && bStarts) return 1;
                                
                                // Priority 2: States where any word starts with search term
                                const aWordsStart = aName.split(/\s+/).some(word => word.startsWith(searchLowerSort));
                                const bWordsStart = bName.split(/\s+/).some(word => word.startsWith(searchLowerSort));
                                
                                if (aWordsStart && !bWordsStart) return -1;
                                if (!aWordsStart && bWordsStart) return 1;
                                
                                // Priority 3: Alphabetical order
                                return a.name.localeCompare(b.name);
                              });
                              
                              return sortedStates.map((state) => (
                                <CommandItem
                                  key={state.code}
                                  value={`${state.name} ${state.code}`}
                                  onSelect={() => {
                                    updateFormData("state", state.code);
                                    setStateOpen(false);
                                    setStateSearch("");
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      formData.state === state.code ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  {state.name}
                                </CommandItem>
                              ));
                            })()}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Step 6: Name */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">{t("steps.6.title")}</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" className="mb-2 block">
                        {t("steps.6.firstName.label")}
                      </Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => updateFormData("firstName", e.target.value)}
                        placeholder={t("steps.6.firstName.placeholder")}
                        className="h-12 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-transparent focus:bg-transparent focus:outline-none active:bg-transparent"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="mb-2 block">
                        {t("steps.6.lastName.label")}
                      </Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => updateFormData("lastName", e.target.value)}
                        placeholder={t("steps.6.lastName.placeholder")}
                        className="h-12 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-transparent focus:bg-transparent focus:outline-none active:bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 7: Email */}
            {currentStep === 7 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">
                    {t("steps.7.title")}
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                    placeholder={t("steps.7.placeholder")}
                    className={`h-12 text-base focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-transparent focus:bg-transparent focus:outline-none active:bg-transparent ${emailError ? "border-red-500" : ""}`}
                  />
                  {emailError && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <span>⚠️</span>
                      <span>{emailError}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 8: Phone */}
            {currentStep === 8 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">
                    {t("steps.8.title")}
                  </Label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      updateFormData("phone", formatted);
                    }}
                    placeholder={t("steps.8.placeholder")}
                    className={`h-12 text-base focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-transparent focus:bg-transparent focus:outline-none active:bg-transparent ${phoneError ? "border-red-500" : ""}`}
                    maxLength={14}
                  />
                  {phoneError && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <span>⚠️</span>
                      <span>{phoneError}</span>
                    </p>
                  )}
                  {!phoneError && formData.phone && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                      ✓ Valid phone number
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    {t("steps.8.subtitle")}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className={`flex ${currentStep === 1 ? "justify-end" : "justify-between"} mt-8`}>
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("buttons.back")}
            </Button>
          )}

          {currentStep < TOTAL_STEPS ? (
            <Button
              onClick={() => handleNext()}
              disabled={!canProceed() || isSubmitting}
              className="flex items-center gap-2 bg-gradient-to-r from-[#0284c7] to-[#2563eb] hover:from-[#0369a1] hover:to-[#1d4ed8]"
            >
              {t("buttons.next")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="flex items-center gap-2 bg-gradient-to-r from-[#0284c7] to-[#2563eb] hover:from-[#0369a1] hover:to-[#1d4ed8]"
            >
              {isSubmitting ? t("buttons.submitting") : t("buttons.submit")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
