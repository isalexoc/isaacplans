"use client";

import React, { useMemo, useState } from "react";
import {
  PortableText,
  buildScriptComponents,
  type ScriptLang,
} from "@/components/presentation-scripts/script-portable-text";

interface ScriptSection {
  contentEn?: any[];
  contentEs?: any[];
  tipsEn?: any[];
  tipsEs?: any[];
}

interface PresentationScript {
  _id: string;
  title?: string;
  description?: string;
  lineOfBusiness: string;
  completeScript?: {
    contentEn?: any[];
    contentEs?: any[];
  };
  openingIntroduction?: ScriptSection;
  discoveryQuestions?: ScriptSection;
  productPresentation?: ScriptSection;
  psychologySalesTips?: ScriptSection;
  closingTechniques?: ScriptSection;
  objectionHandling?: ScriptSection;
}

interface PresentationScriptsContentProps {
  script: PresentationScript | null;
  /** Owned by the dashboard so the choice survives switching product tabs. */
  language: ScriptLang;
  /**
   * True when the objection library has cards for this product and language, so the old
   * free-text section would be a duplicate. Products with no library entries (IUL) keep it.
   */
  hideObjectionHandling?: boolean;
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
    key: 'objectionHandling',
    titleEn: 'Objection Handling',
    titleEs: 'Manejo de Objeciones',
  },
  {
    key: 'closingTechniques',
    titleEn: 'Closing — Three Options',
    titleEs: 'Cierre — Tres Opciones',
  },
  {
    key: 'psychologySalesTips',
    titleEn: 'Psychology & Sales Tips',
    titleEs: 'Psicología y Consejos de Ventas',
  },
] as const;

export default function PresentationScriptsContent({
  script,
  language,
  hideObjectionHandling = false,
}: PresentationScriptsContentProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(sectionConfig[0]?.key || null);

  const toggleSection = (sectionKey: string) => {
    setExpandedSection(expandedSection === sectionKey ? null : sectionKey);
  };

  // Rebuilt only when the language toggle changes, so PortableText's
  // internal component-map memo stays effective.
  const portableTextComponents = useMemo(
    () => buildScriptComponents(language),
    [language]
  );

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
      {/* Complete Script Section - Show first if available */}
      {script?.completeScript && (
        <div className="mb-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20 overflow-hidden">
          <div className="p-4 border-b border-primary/20 bg-primary/5">
            <h3 className="font-bold text-base md:text-lg flex items-center gap-2">
              <span className="text-primary">📄</span>
              {language === "en" ? "Complete Script (All-in-One)" : "Guión Completo (Todo en Uno)"}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              {language === "en" 
                ? "Full script compressed into one document for quick reference" 
                : "Guión completo comprimido en un solo documento para referencia rápida"}
            </p>
          </div>
          <div className="p-4 md:p-6">
            {(() => {
              const completeContent = language === "en" 
                ? script.completeScript.contentEn 
                : script.completeScript.contentEs;
              const safeCompleteContent = Array.isArray(completeContent) && completeContent.length > 0 
                ? completeContent 
                : null;
              
              return safeCompleteContent ? (
                <div className="max-w-none">
                  <PortableText value={safeCompleteContent} components={portableTextComponents} />
                </div>
              ) : (
                <p className="text-muted-foreground italic text-sm">
                  {language === "en" 
                    ? "Complete script not available in English." 
                    : "Guión completo no disponible en español."}
                </p>
              );
            })()}
          </div>
        </div>
      )}

      {/* Script Sections */}
      <div className="space-y-3">
        {sectionConfig
          .filter((config) => !(config.key === "objectionHandling" && hideObjectionHandling))
          .map((config) => {
          const section = script[config.key as keyof PresentationScript] as ScriptSection | undefined;
          
          if (!section) return null;

          const content = language === "en" ? section.contentEn : section.contentEs;
          const tips = language === "en" ? section.tipsEn : section.tipsEs;
          const title = language === "en" ? config.titleEn : config.titleEs;
          
          // Safety check: ensure content is an array (handle legacy string data or query issues)
          const safeContent = Array.isArray(content) ? content : null;
          const safeTips = Array.isArray(tips) ? tips : null;

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
                  {safeContent && safeContent.length > 0 ? (
                    <div className="max-w-none">
                      <PortableText value={safeContent} components={portableTextComponents} />
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic text-sm">
                      Content not available in {language === "en" ? "English" : "Spanish"}.
                    </p>
                  )}
                  
                  {safeTips && safeTips.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                      <div className="max-w-none">
                        <PortableText value={safeTips} components={portableTextComponents} />
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

