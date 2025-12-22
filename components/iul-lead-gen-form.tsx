"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { trackInitiateCheckout, trackLead, updateAdvancedMatching } from "@/lib/facebook-pixel";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

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

export default function IULLeadGenForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  
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

  // Track InitiateCheckout when form starts
  useEffect(() => {
    if (currentStep === 1) {
      trackInitiateCheckout({
        contentName: "IUL Lead Generation Form",
        value: 50,
      });
    }
  }, []);

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };


  const handleInvestmentToggle = (investment: string) => {
    setFormData((prev) => {
      const investments = prev.investments.includes(investment)
        ? prev.investments.filter((i) => i !== investment)
        : [...prev.investments, investment];
      return { ...prev, investments };
    });
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
        return !!formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
      case 8:
        return !!formData.phone && formData.phone.replace(/\D/g, "").length >= 10;
      default:
        return false;
    }
  }, [currentStep, formData]);

  const handleNext = useCallback(() => {
    if (canProceed() && currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [canProceed, currentStep]);

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Auto-advance for single-select steps (1, 3, 5) after selection
  useEffect(() => {
    if (currentStep === 1 && formData.retirementTimeline && canProceed()) {
      const timer = setTimeout(() => {
        handleNext();
      }, 500); // 500ms delay for better UX
      return () => clearTimeout(timer);
    }
    if (currentStep === 3 && formData.monthlySavings && canProceed()) {
      const timer = setTimeout(() => {
        handleNext();
      }, 500);
      return () => clearTimeout(timer);
    }
    if (currentStep === 5 && formData.state && canProceed()) {
      const timer = setTimeout(() => {
        handleNext();
      }, 500);
      return () => clearTimeout(timer);
    }
    // Note: Step 4 (age) doesn't auto-advance - user needs to confirm with Next button
  }, [formData.retirementTimeline, formData.monthlySavings, formData.state, currentStep, canProceed, handleNext]);

  const handleSubmit = async () => {
    if (!canProceed()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Submit to Agent CRM
      const phoneNumber = `+1${formData.phone.replace(/\D/g, "")}`;
      const response = await fetch("/api/create-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: phoneNumber,
          guideName: "IUL Lead Generation Campaign",
          leadMagnet: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit form");
      }

      // Prepare user data for advanced matching
      const userData = {
        em: formData.email?.toLowerCase().trim(),
        fn: formData.firstName?.toLowerCase().trim(),
        ln: formData.lastName?.toLowerCase().trim(),
        ph: phoneNumber,
      };

      // Update advanced matching
      updateAdvancedMatching(userData);

      // Track Lead event
      trackLead(
        {
          contentName: "IUL Lead Generation Campaign",
          source: "iul_lead_gen",
          value: 100,
        },
        userData
      );

      setIsComplete(true);
    } catch (error) {
      console.error("Error submitting form:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to submit form. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = (currentStep / TOTAL_STEPS) * 100;

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
          <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
          <p className="text-muted-foreground">
            We've received your information. Our team will contact you shortly to discuss your IUL
            options.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6 md:p-8">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">
              Step {currentStep} of {TOTAL_STEPS}
            </span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
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
                    How soon are you planning to retire? *
                  </Label>
                  <RadioGroup
                    value={formData.retirementTimeline}
                    onValueChange={(value) => updateFormData("retirementTimeline", value)}
                    className="space-y-3"
                  >
                    <label
                      htmlFor="within-10"
                      className="flex items-center space-x-2 p-4 border rounded-md hover:bg-accent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="within-10" id="within-10" />
                      <span className="flex-1">Within 10 Years</span>
                    </label>
                    <label
                      htmlFor="within-20"
                      className="flex items-center space-x-2 p-4 border rounded-md hover:bg-accent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="within-20" id="within-20" />
                      <span className="flex-1">Within 20 Years</span>
                    </label>
                    <label
                      htmlFor="within-30"
                      className="flex items-center space-x-2 p-4 border rounded-md hover:bg-accent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="within-30" id="within-30" />
                      <span className="flex-1">Within 30 Years</span>
                    </label>
                    <label
                      htmlFor="retired"
                      className="flex items-center space-x-2 p-4 border rounded-md hover:bg-accent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="retired" id="retired" />
                      <span className="flex-1">I'm Currently Retired</span>
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
                    What are your current investments?
                  </Label>
                  <p className="text-sm text-muted-foreground mb-4">Select all that apply</p>
                  <div className="space-y-3">
                    {[
                      "401(k)",
                      "IRA",
                      "Cash Savings",
                      "Active Trading",
                      "Self Directed Brokerage Account",
                      "No current investments",
                    ].map((investment) => {
                      const investmentId = `investment-${investment.toLowerCase().replace(/\s+/g, "-")}`;
                      return (
                        <label
                          key={investment}
                          htmlFor={investmentId}
                          className="flex items-center space-x-2 p-4 border rounded-md hover:bg-accent cursor-pointer transition-colors"
                        >
                          <Checkbox
                            id={investmentId}
                            checked={formData.investments.includes(investment)}
                            onCheckedChange={() => handleInvestmentToggle(investment)}
                          />
                          <span className="flex-1">{investment}</span>
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
                    How much do you set aside in savings each month?
                  </Label>
                  <RadioGroup
                    value={formData.monthlySavings}
                    onValueChange={(value) => updateFormData("monthlySavings", value)}
                    className="space-y-3"
                  >
                    <label
                      htmlFor="less-300"
                      className="flex items-center space-x-2 p-4 border rounded-md hover:bg-accent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="less-300" id="less-300" />
                      <span className="flex-1">Less than $300</span>
                    </label>
                    <label
                      htmlFor="300-500"
                      className="flex items-center space-x-2 p-4 border rounded-md hover:bg-accent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="300-500" id="300-500" />
                      <span className="flex-1">$300 - $500</span>
                    </label>
                    <label
                      htmlFor="500-1000"
                      className="flex items-center space-x-2 p-4 border rounded-md hover:bg-accent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="500-1000" id="500-1000" />
                      <span className="flex-1">$500 - $1,000</span>
                    </label>
                    <label
                      htmlFor="more-1000"
                      className="flex items-center space-x-2 p-4 border rounded-md hover:bg-accent cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value="more-1000" id="more-1000" />
                      <span className="flex-1">More than $1,000</span>
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
                    What is your current age? (This helps us determine how long you have to fund
                    the IUL) *
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
                    <div className="text-center">
                      <div className="text-4xl font-bold text-[#0ea5e9] mb-2">{formData.age}</div>
                      {formData.age >= 18 && (
                        <p className="text-sm text-muted-foreground">
                          You have approximately {Math.max(0, 65 - formData.age)} years until
                          retirement age.
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
                    What state do you live in?
                  </Label>
                  <Select value={formData.state} onValueChange={(value) => updateFormData("state", value)}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Select your state" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 6: Name */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">What is your name?</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" className="mb-2 block">
                        First name
                      </Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => updateFormData("firstName", e.target.value)}
                        placeholder="First name"
                        className="h-12"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="mb-2 block">
                        Last name
                      </Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => updateFormData("lastName", e.target.value)}
                        placeholder="Last name"
                        className="h-12"
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
                    What's your best email address?
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                    placeholder="Your email address"
                    className="h-12 text-base"
                  />
                </div>
              </div>
            )}

            {/* Step 8: Phone */}
            {currentStep === 8 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">
                    What's your best phone number?
                  </Label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateFormData("phone", e.target.value)}
                    placeholder="(555) 123-4567"
                    className="h-12 text-base"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    United States phone number
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
              Back
            </Button>
          )}

          {currentStep < TOTAL_STEPS ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
              className="flex items-center gap-2 bg-gradient-to-r from-[#0ea5e9] to-[#2563eb] hover:from-[#3b82f6] hover:to-[#1d4ed8]"
            >
              Next Step
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="flex items-center gap-2 bg-gradient-to-r from-[#0ea5e9] to-[#2563eb] hover:from-[#3b82f6] hover:to-[#1d4ed8]"
            >
              {isSubmitting ? "Submitting..." : "Confirm My Phone"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
