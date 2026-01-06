"use client";

import React, { useState } from "react";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScriptSection {
  contentEn?: string;
  contentEs?: string;
  tipsEn?: string;
  tipsEs?: string;
}

interface PresentationScript {
  _id: string;
  title?: string;
  description?: string;
  lineOfBusiness: string;
  openingIntroduction?: ScriptSection;
  discoveryQuestions?: ScriptSection;
  productPresentation?: ScriptSection;
  psychologySalesTips?: ScriptSection;
  closingTechniques?: ScriptSection;
  objectionHandling?: ScriptSection;
}

interface PresentationScriptsContentProps {
  script: PresentationScript | null;
}

const sectionConfig = [
  {
    key: 'openingIntroduction',
    titleEn: 'Opening & Introduction',
    titleEs: 'Apertura e Introducción',
  },
  {
    key: 'discoveryQuestions',
    titleEn: 'Discovery Questions & Qualification',
    titleEs: 'Preguntas de Descubrimiento y Calificación',
  },
  {
    key: 'productPresentation',
    titleEn: 'Product Presentation',
    titleEs: 'Presentación del Producto',
  },
  {
    key: 'closingTechniques',
    titleEn: 'Closing - Three Options',
    titleEs: 'Cierre - Tres Opciones',
  },
  {
    key: 'objectionHandling',
    titleEn: 'Objection Handling',
    titleEs: 'Manejo de Objeciones',
  },
  {
    key: 'psychologySalesTips',
    titleEn: 'Psychology & Sales Tips',
    titleEs: 'Psicología y Consejos de Ventas',
  },
] as const;

export default function PresentationScriptsContent({ script }: PresentationScriptsContentProps) {
  const locale = useLocale();
  const [language, setLanguage] = useState<"en" | "es">(locale === "es" ? "es" : "en");
  const [expandedSection, setExpandedSection] = useState<string | null>(sectionConfig[0]?.key || null);

  const toggleSection = (sectionKey: string) => {
    setExpandedSection(expandedSection === sectionKey ? null : sectionKey);
  };

  const formatContent = (text: string | undefined) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    
    lines.forEach((line, idx) => {
      if (line.trim() === '') {
        elements.push(<br key={idx} />);
      } else if (line.startsWith('**') && line.endsWith('**')) {
        elements.push(
          <strong key={idx} className="font-bold text-foreground block mb-2">
            {line.replace(/\*\*/g, '')}
          </strong>
        );
      } else {
        elements.push(<p key={idx} className="mb-2">{line}</p>);
      }
    });
    
    return elements;
  };

  if (!script) {
    return (
      <div className="w-full p-8 text-center">
        <p className="text-muted-foreground">
          No script content available for this line of business. Please add content in Sanity Studio.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Language Toggle */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <Languages className="h-4 w-4 text-muted-foreground" />
        <div className="flex gap-1 bg-muted rounded-lg p-1">
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

      {/* Script Sections */}
      <div className="space-y-3">
        {sectionConfig.map((config) => {
          const section = script[config.key as keyof PresentationScript] as ScriptSection | undefined;
          
          if (!section) return null;

          const content = language === "en" ? section.contentEn : section.contentEs;
          const tips = language === "en" ? section.tipsEn : section.tipsEs;
          const title = language === "en" ? config.titleEn : config.titleEs;

          return (
            <div
              key={config.key}
              className="bg-card rounded-lg border overflow-hidden"
            >
              <button
                onClick={() => toggleSection(config.key)}
                className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <h4 className="font-semibold text-sm md:text-base">
                  {title}
                </h4>
                <span className="text-muted-foreground text-xs">
                  {expandedSection === config.key ? "−" : "+"}
                </span>
              </button>
              
              {expandedSection === config.key && (
                <div className="p-4 pt-0 space-y-4 border-t">
                  {content ? (
                    <div className="prose prose-sm max-w-none text-xs md:text-sm leading-relaxed whitespace-pre-wrap">
                      {formatContent(content)}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic text-sm">
                      Content not available in {language === "en" ? "English" : "Spanish"}.
                    </p>
                  )}
                  
                  {tips && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                      <div className="prose prose-sm max-w-none text-xs md:text-sm">
                        {formatContent(tips)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

