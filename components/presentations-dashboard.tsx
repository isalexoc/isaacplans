"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BriefcaseMedical,
  Shield,
  Hospital,
  Users,
  TriangleAlert,
  Heart,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PresentationScriptsContent from "@/components/presentation-scripts-content";

interface LineOfBusiness {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const linesOfBusiness: LineOfBusiness[] = [
  {
    id: "iul",
    name: "IUL - Indexed Universal Life",
    icon: Users,
    description: "Life insurance with cash value growth potential",
  },
  {
    id: "aca",
    name: "ACA Health Insurance",
    icon: BriefcaseMedical,
    description: "Affordable Care Act marketplace plans",
  },
  {
    id: "dentalVision",
    name: "Dental & Vision",
    icon: Shield,
    description: "Dental and vision insurance plans",
  },
  {
    id: "hospitalIndemnity",
    name: "Hospital Indemnity",
    icon: Hospital,
    description: "Cash benefits during hospital stays",
  },
  {
    id: "finalExpense",
    name: "Final Expense",
    icon: TriangleAlert,
    description: "Burial and final expense insurance",
  },
  {
    id: "shortTermMedical",
    name: "Short Term Medical",
    icon: Heart,
    description: "Temporary health insurance coverage",
  },
];

interface PresentationScript {
  _id: string;
  title?: string;
  description?: string;
  lineOfBusiness: string;
  openingIntroduction?: any;
  discoveryQuestions?: any;
  productPresentation?: any;
  closingTechniques?: any;
  objectionHandling?: any;
  psychologySalesTips?: any;
}

interface PresentationsDashboardProps {
  scripts?: Record<string, PresentationScript | null>;
}

export default function PresentationsDashboard({ scripts = {} }: PresentationsDashboardProps) {
  const [activeTab, setActiveTab] = useState("iul");

  return (
    <div className="w-full">
      {/* Header Section */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg flex-shrink-0">
            <Phone className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl md:text-2xl font-bold leading-tight">
              Sales Scripts & Presentation Guide
            </h2>
            <p className="text-muted-foreground text-xs md:text-sm mt-1">
              Expert scripts and strategies for phone sales conversations
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Component */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tabs List - Responsive Design with Smooth Scrolling */}
        <style dangerouslySetInnerHTML={{__html: `
          .tabs-scroll-container::-webkit-scrollbar {
            display: none;
          }
          .tabs-scroll-container {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}} />
        <div 
          className="tabs-scroll-container overflow-x-auto mb-4 md:mb-6 -mx-3 sm:-mx-4 px-3 sm:px-4 md:mx-0 md:px-0"
        >
          <TabsList className="inline-flex h-auto w-max min-w-full md:min-w-0 bg-muted/50 p-1 md:p-1.5 rounded-lg">
            {linesOfBusiness.map((lob) => {
              const Icon = lob.icon;
              return (
                <TabsTrigger
                  key={lob.id}
                  value={lob.id}
                  className={cn(
                    "flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-md transition-all",
                    "data-[state=active]:bg-background data-[state=active]:shadow-sm",
                    "hover:bg-muted/80 active:bg-muted/90",
                    "min-w-fit touch-manipulation",
                    "text-xs md:text-sm"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline whitespace-nowrap">{lob.name}</span>
                  <span className="sm:hidden whitespace-nowrap">{lob.name.split(" ")[0]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Tab Content */}
        {linesOfBusiness.map((lob) => {
          const Icon = lob.icon;
          return (
            <TabsContent
              key={lob.id}
              value={lob.id}
              className="mt-4 md:mt-6 space-y-4 md:space-y-6"
            >
              {/* Tab Header */}
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 md:p-6 border border-primary/20">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-primary/10 rounded-lg flex-shrink-0">
                    <Icon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg md:text-2xl font-bold mb-1 md:mb-2 leading-tight">{lob.name}</h3>
                    <p className="text-muted-foreground text-sm md:text-base">{lob.description}</p>
                  </div>
                </div>
              </div>

              {/* Content Sections - Fetch from Sanity */}
              <PresentationScriptsContent script={scripts[lob.id] || null} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

