"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  state: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  smsConsent: boolean;
}

const TOTAL_STEPS = 6;

// Step names mapping for comprehensive tracking
const STEP_NAMES: Record<number, string> = {
  1: "Retirement Timeline",
  2: "Current Investments",
  3: "Monthly Savings",
  4: "State",
  5: "Name",
  6: "Contact Info",
};

// Step hash mapping for URL tracking (like competitor)
const STEP_HASHES: Record<number, string> = {
  1: "#retirement-timeline",
  2: "#current-investments",
  3: "#monthly-savings",
  4: "#state",
  5: "#name",
  6: "#contact-info",
};

// Generate screen ID for a step
function generateStepScreenId(step: number): string {
  const stepName = STEP_NAMES[step].toLowerCase().replace(/\s+/g, "-");
  return `id-${stepName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default function IULLeadGenForm() {
  const t = useTranslations("iulQuote.form");
  const tFooter = useTranslations("footer.links");
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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  
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
    step4?: string;
  }>({});
  
  // Time tracking for analytics
  const [formStartTime] = useState(Date.now());
  const [stepStartTimes, setStepStartTimes] = useState<Record<number, number>>({});
  
  const [formData, setFormData] = useState<FormData>({
    retirementTimeline: "",
    investments: [],
    monthlySavings: "",
    state: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    smsConsent: false,
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
  
  // Track values when arriving at auto-advance steps to prevent auto-advance if value already existed
  useEffect(() => {
    if (currentStep === 1) {
      setValuesOnArrival((prev) => ({ ...prev, step1: formData.retirementTimeline }));
    } else if (currentStep === 3) {
      setValuesOnArrival((prev) => ({ ...prev, step3: formData.monthlySavings }));
    } else if (currentStep === 4) {
      setValuesOnArrival((prev) => ({ ...prev, step4: formData.state }));
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
      if (error && currentStep === 6) {
        trackValidationError(6, 'email', 'invalid_format');
      }
      // Clear validation errors when user starts typing
      if (showValidationErrors && value) {
        setShowValidationErrors(false);
      }
    }
    
    // Real-time validation for phone
    if (field === "phone") {
      const error = validatePhone(value);
      setPhoneError(error);
      // Track validation error if it exists
      if (error && currentStep === 6) {
        trackValidationError(6, 'phone', 'invalid_format');
      }
      // Clear validation errors when user starts typing
      if (showValidationErrors && value) {
        setShowValidationErrors(false);
      }
    }
    
    // Clear validation errors when user makes any change
    if (showValidationErrors) {
      setShowValidationErrors(false);
    }
    
    // Reset previousStep when user changes a value on auto-advance steps
    // This allows auto-advance to work again if they change their selection
    if ((field === "retirementTimeline" && currentStep === 1) ||
        (field === "monthlySavings" && currentStep === 3) ||
        (field === "state" && currentStep === 4)) {
      setPreviousStep(currentStep);
      // Update valuesOnArrival to the old value so that the new value triggers auto-advance
      if (field === "retirementTimeline") {
        setValuesOnArrival((prev) => ({ ...prev, step1: formData.retirementTimeline }));
      } else if (field === "monthlySavings") {
        setValuesOnArrival((prev) => ({ ...prev, step3: formData.monthlySavings }));
      } else if (field === "state") {
        setValuesOnArrival((prev) => ({ ...prev, step4: formData.state }));
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
        return !!formData.state;
      case 5:
        return !!formData.firstName && !!formData.lastName;
      case 6:
        return !!formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && !emailError &&
               !!formData.phone && formData.phone.replace(/\D/g, "").length >= 10 && !phoneError &&
               formData.smsConsent;
      default:
        return false;
    }
  }, [currentStep, formData, emailError, phoneError]);

  // Validate all form fields and return specific errors
  const validateAllFields = useCallback((): string[] => {
    const errors: string[] = [];
    
    if (!formData.retirementTimeline) {
      errors.push(t("errors.retirementTimelineRequired"));
    }
    if (formData.investments.length === 0) {
      errors.push(t("errors.investmentRequired"));
    }
    if (!formData.monthlySavings) {
      errors.push(t("errors.monthlySavingsRequired"));
    }
    if (!formData.state) {
      errors.push(t("errors.stateRequired"));
    }
    if (!formData.firstName) {
      errors.push(t("errors.firstNameRequired"));
    }
    if (!formData.lastName) {
      errors.push(t("errors.lastNameRequired"));
    }
    if (!formData.email) {
      errors.push(t("errors.emailRequired"));
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.push(t("errors.emailInvalid"));
    }
    if (!formData.phone) {
      errors.push(t("errors.phoneRequired"));
    } else if (formData.phone.replace(/\D/g, "").length < 10) {
      errors.push(t("errors.phoneInvalid"));
    }
    if (!formData.smsConsent) {
      errors.push(t("errors.smsConsentRequired"));
    }
    
    return errors;
  }, [formData, t]);

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
      // Clear validation errors when moving forward
      setShowValidationErrors(false);
      setValidationErrors([]);
      
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
      
      // Clear validation errors when going back
      setShowValidationErrors(false);
      setValidationErrors([]);
      
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
    } else if (currentStep === 4 && formData.state && canProceed()) {
      // Only auto-advance if value changed (was empty or different when we arrived)
      if (formData.state !== valuesOnArrival.step4) {
        timer = setTimeout(() => {
          trackStepCompletion(currentStep, true);
          handleNext(true); // Pass true to skip duplicate tracking
        }, 500);
      }
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [formData.retirementTimeline, formData.monthlySavings, formData.state, currentStep, canProceed, handleNext, trackStepCompletion, isNavigatingBack, previousStep, valuesOnArrival]);

  const handleSubmit = async () => {
    // Validate all fields first
    const errors = validateAllFields();
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationErrors(true);
      
      // Scroll to top of form to show errors
      const formCard = document.querySelector('[class*="max-w-2xl"]');
      if (formCard) {
        formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      // Focus on first missing field if on step 6
      if (currentStep === 6) {
        setTimeout(() => {
          if (!formData.email) {
            document.getElementById('email')?.focus();
          } else if (!formData.phone) {
            document.getElementById('phone')?.focus();
          } else if (!formData.smsConsent) {
            document.getElementById('sms-consent')?.focus();
          }
        }, 100);
      }
      
      // Track validation error
      sendGAEvent('event', 'form_validation_error', {
        step_number: currentStep,
        step_name: STEP_NAMES[currentStep],
        error_count: errors.length,
        form_type: 'IUL Lead Generation',
        form_id: 'iul_lead_gen',
        error_type: 'submit_attempt_with_errors',
      });
      
      return;
    }

    // Clear any previous validation errors
    setValidationErrors([]);
    setShowValidationErrors(false);
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
            state: formData.state,
            language: locale, // Include the language/locale
            smsConsent: formData.smsConsent,
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
        {/* Validation Errors Summary */}
        {showValidationErrors && validationErrors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg"
          >
            <div className="flex items-start gap-2 mb-2">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">
                  {t("errors.validationSummaryTitle")}
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-400">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {/* Submit Error Message */}
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

            {/* Step 4: State */}
            {currentStep === 4 && (
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

            {/* Step 5: Name */}
            {currentStep === 5 && (
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
                        className={`h-12 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-transparent focus:bg-transparent focus:outline-none active:bg-transparent ${
                          showValidationErrors && !formData.firstName ? "border-red-500 border-2" : ""
                        }`}
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
                        className={`h-12 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-transparent focus:bg-transparent focus:outline-none active:bg-transparent ${
                          showValidationErrors && !formData.lastName ? "border-red-500 border-2" : ""
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Email, Phone, and Consent */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">
                    {t("steps.7.title") || "Contact Information"}
                  </Label>
                  
                  {/* Email */}
                  <div className="mb-4">
                    <Label htmlFor="email" className="mb-2 block text-sm font-medium">
                      {t("steps.7.title") || "Email"}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormData("email", e.target.value)}
                      placeholder={t("steps.7.placeholder") || "Enter your email"}
                      className={`h-12 text-base focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-transparent focus:bg-transparent focus:outline-none active:bg-transparent ${
                        emailError || (showValidationErrors && (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))) 
                          ? "border-red-500 border-2" : ""
                      }`}
                    />
                    {emailError && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <span>⚠️</span>
                        <span>{emailError}</span>
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="mb-6">
                    <Label htmlFor="phone" className="mb-2 block text-sm font-medium">
                      {t("steps.8.title") || "Phone"}
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        updateFormData("phone", formatted);
                      }}
                      placeholder={t("steps.8.placeholder") || "Enter your phone number"}
                      className={`h-12 text-base focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-transparent focus:bg-transparent focus:outline-none active:bg-transparent ${
                        phoneError || (showValidationErrors && (!formData.phone || formData.phone.replace(/\D/g, "").length < 10)) 
                          ? "border-red-500 border-2" : ""
                      }`}
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
                        {t("errors.phoneValid")}
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="mb-6">
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-[#0284c7] to-[#2563eb] hover:from-[#0369a1] hover:to-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? t("buttons.submitting") : t("buttons.submit")}
                    </Button>
                  </div>

                  {/* SMS Consent Checkbox */}
                  <div className={`mb-6 p-3 rounded-lg ${
                    showValidationErrors && !formData.smsConsent ? "bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700" : ""
                  }`}>
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <Checkbox
                        id="sms-consent"
                        checked={formData.smsConsent}
                        onCheckedChange={(checked) => updateFormData("smsConsent", checked === true)}
                        className={`mt-1 ${
                          showValidationErrors && !formData.smsConsent ? "border-red-500" : ""
                        }`}
                      />
                      <span className={`text-sm ${
                        showValidationErrors && !formData.smsConsent 
                          ? "text-red-700 dark:text-red-400 font-medium" 
                          : "text-muted-foreground"
                      }`}>
                        {t("smsConsent.text")}
                      </span>
                    </label>
                  </div>

                  {/* Privacy Policy and Terms Links */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-muted-foreground text-center mb-2">
                      {t("legal.agreeText")}
                    </p>
                    <div className="flex justify-center items-center gap-4 text-xs">
                      <Link
                        href={`/${locale}/privacy-policy`}
                        className="text-[#0284c7] hover:text-[#0369a1] underline transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {tFooter("privacy")}
                      </Link>
                      <span className="text-muted-foreground">•</span>
                      <Link
                        href={`/${locale}/terms-of-service`}
                        className="text-[#0284c7] hover:text-[#0369a1] underline transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {tFooter("terms")}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        {currentStep < TOTAL_STEPS && (
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

            <Button
              onClick={() => {
                if (canProceed()) {
                  handleNext();
                } else {
                  // Show helpful message for current step
                  let message = "";
                  switch (currentStep) {
                    case 1:
                      message = t("errors.retirementTimelineRequired");
                      break;
                    case 2:
                      message = t("errors.investmentRequired");
                      break;
                    case 3:
                      message = t("errors.monthlySavingsRequired");
                      break;
                    case 4:
                      message = t("errors.stateRequired");
                      break;
                    case 5:
                      message = t("errors.nameRequired");
                      break;
                  }
                  if (message) {
                    setValidationErrors([message]);
                    setShowValidationErrors(true);
                    setTimeout(() => setShowValidationErrors(false), 3000);
                  }
                }
              }}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-gradient-to-r from-[#0284c7] to-[#2563eb] hover:from-[#0369a1] hover:to-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("buttons.next")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Back Button for Step 6 */}
        {currentStep === TOTAL_STEPS && (
          <div className="flex justify-start mt-8">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("buttons.back")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
