"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BriefcaseMedical,
  Shield,
  Hospital,
  Users,
  TriangleAlert,
  Heart,
  Phone,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PresentationScriptsContent from "@/components/presentation-scripts-content";
import ObjectionLibraryPanel from "@/components/objections/objection-library-panel";
import ObjectionAnswerDialog from "@/components/objections/objection-answer-dialog";
import ObjectionCommandPalette from "@/components/objections/objection-command-palette";
import { appliesToLob, visibleIn, type Objection } from "@/lib/objections/types";
import { isTypingTarget } from "@/lib/objections/search";
import type { ScriptLang } from "@/components/presentation-scripts/script-portable-text";

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
    name: "Temporary health insurance",
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
  /** Flat, unbucketed: a universal objection would otherwise cross the wire once per product. */
  objections?: Objection[];
}

export default function PresentationsDashboard({
  scripts = {},
  objections = [],
}: PresentationsDashboardProps) {
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState("iul");
  // Owned here, not per tab. Each PresentationScriptsContent used to hold its own copy, so
  // switching to Spanish and then changing product silently dropped back to English.
  const [language, setLanguage] = useState<ScriptLang>(locale === "es" ? "es" : "en");
  const [openObjectionId, setOpenObjectionId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const visibleIdsRef = useRef<string[]>([]);

  const forLob = useCallback(
    (lob: string, lang: ScriptLang) =>
      objections.filter((o) => appliesToLob(o, lob) && visibleIn(o, lang)),
    [objections]
  );

  const activeObjections = useMemo(
    () => forLob(activeTab, language),
    [forLob, activeTab, language]
  );
  const otherLanguageCount = useMemo(
    () => forLob(activeTab, language === "en" ? "es" : "en").length,
    [forLob, activeTab, language]
  );

  const openObjection = useMemo(
    () => objections.find((o) => o._id === openObjectionId) ?? null,
    [objections, openObjectionId]
  );

  const handleVisibleChange = useCallback((ids: string[]) => {
    visibleIdsRef.current = ids;
  }, []);

  const step = useCallback(
    (delta: number) => {
      const ids = visibleIdsRef.current;
      const current = openObjectionId ? ids.indexOf(openObjectionId) : -1;
      if (current === -1) return;
      const next = ids[current + delta];
      if (next) setOpenObjectionId(next);
    },
    [openObjectionId]
  );

  const openIndex = openObjectionId ? visibleIdsRef.current.indexOf(openObjectionId) : -1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // toLowerCase because Shift or a non-US layout yields "K".
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        // Without this, Chrome and Firefox move focus to the address bar instead.
        event.preventDefault();
        // Never stack two overlays: two focus traps fight and Escape only closes the top one.
        setOpenObjectionId(null);
        setPaletteOpen((wasOpen) => !wasOpen);
        return;
      }
      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        setOpenObjectionId(null);
        setPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

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

          {/* One toggle for the whole dashboard, so the choice survives switching product tabs. */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <Languages className="hidden h-4 w-4 text-muted-foreground sm:block" />
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <Button
                variant={language === "en" ? "default" : "ghost"}
                size="sm"
                onClick={() => setLanguage("en")}
                className="h-7 px-3 text-xs"
              >
                English
              </Button>
              <Button
                variant={language === "es" ? "default" : "ghost"}
                size="sm"
                onClick={() => setLanguage("es")}
                className="h-7 px-3 text-xs"
              >
                Español
              </Button>
            </div>
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

              {/* Objections come first: they are what gets reached for mid-call. */}
              {lob.id === activeTab && activeObjections.length > 0 && (
                <ObjectionLibraryPanel
                  objections={activeObjections}
                  language={language}
                  onOpen={setOpenObjectionId}
                  onOpenPalette={() => setPaletteOpen(true)}
                  otherLanguageCount={otherLanguageCount}
                  onSwitchLanguage={() => setLanguage(language === "en" ? "es" : "en")}
                  onVisibleChange={handleVisibleChange}
                />
              )}

              {/* Content Sections - Fetch from Sanity */}
              <PresentationScriptsContent
                script={scripts[lob.id] || null}
                language={language}
                hideObjectionHandling={forLob(lob.id, language).length > 0}
              />
            </TabsContent>
          );
        })}
      </Tabs>

      <ObjectionCommandPalette
        objections={activeObjections}
        language={language}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelect={(id) => {
          setPaletteOpen(false);
          setOpenObjectionId(id);
        }}
      />

      <ObjectionAnswerDialog
        objection={openObjection}
        language={language}
        onClose={() => setOpenObjectionId(null)}
        onPrev={openIndex > 0 ? () => step(-1) : undefined}
        onNext={
          openIndex >= 0 && openIndex < visibleIdsRef.current.length - 1
            ? () => step(1)
            : undefined
        }
        position={
          openIndex >= 0
            ? { index: openIndex + 1, total: visibleIdsRef.current.length }
            : undefined
        }
      />
    </div>
  );
}

