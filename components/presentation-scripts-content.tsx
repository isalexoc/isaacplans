"use client";

import React, { useState } from "react";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortableText } from "@portabletext/react";
import Image from "next/image";
import { urlFor } from "@/sanity/lib/image";

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

  // Portable text components for presentation scripts (compact styling)
  const portableTextComponents = {
    types: {
      image: ({ value }: any) => {
        if (!value?.asset) return null;
        const imageUrl = urlFor(value).width(500).fit('max').url();
        return (
          <div className="my-4 flex justify-center">
            <div className="w-full" style={{ maxWidth: '500px' }}>
              <Image
                src={imageUrl}
                alt={value.alt || "Presentation script image"}
                width={500}
                height={600}
                className="rounded-lg w-full h-auto shadow-md"
                style={{ objectFit: 'contain', maxWidth: '500px', height: 'auto' }}
              />
              {value.caption && (
                <p className="text-xs text-muted-foreground text-center mt-2 italic">
                  {value.caption}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    block: {
      h1: ({ children }: any) => (
        <h1 className="text-xl font-bold text-foreground mt-4 mb-2">
          {children}
        </h1>
      ),
      h2: ({ children }: any) => (
        <h2 className="text-lg font-semibold text-foreground mt-3 mb-2">
          {children}
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="text-base font-semibold text-foreground mt-3 mb-2">
          {children}
        </h3>
      ),
      h4: ({ children }: any) => (
        <h4 className="text-sm font-semibold text-foreground mt-2 mb-1">
          {children}
        </h4>
      ),
      blockquote: ({ children }: any) => (
        <blockquote className="border-l-4 border-blue-500 pl-3 py-2 my-3 bg-blue-50 dark:bg-blue-900/20 rounded-r text-sm italic text-muted-foreground">
          {children}
        </blockquote>
      ),
      normal: ({ children }: any) => (
        <p className="mb-2 text-sm leading-relaxed text-foreground">
          {children}
        </p>
      ),
    },
    list: {
      bullet: ({ children }: any) => (
        <ul className="list-disc list-inside space-y-1 my-2 text-sm">
          {children}
        </ul>
      ),
      number: ({ children }: any) => (
        <ol className="list-decimal list-inside space-y-1 my-2 text-sm">
          {children}
        </ol>
      ),
    },
    listItem: {
      bullet: ({ children }: any) => (
        <li className="text-sm text-foreground">{children}</li>
      ),
      number: ({ children }: any) => (
        <li className="text-sm text-foreground">{children}</li>
      ),
    },
    marks: {
      strong: ({ children }: any) => (
        <strong className="font-bold text-foreground">{children}</strong>
      ),
      em: ({ children }: any) => (
        <em className="italic text-foreground">{children}</em>
      ),
      link: ({ value, children }: any) => {
        const target = (value?.href || "").startsWith("http") ? "_blank" : undefined;
        return (
          <a
            href={value?.href || "#"}
            target={target}
            rel={target === "_blank" ? "noopener noreferrer" : undefined}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {children}
          </a>
        );
      },
    },
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
                <div className="prose prose-sm max-w-none text-xs md:text-sm leading-relaxed">
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
        {sectionConfig.map((config) => {
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
                    <div className="prose prose-sm max-w-none text-xs md:text-sm leading-relaxed">
                      <PortableText value={safeContent} components={portableTextComponents} />
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic text-sm">
                      Content not available in {language === "en" ? "English" : "Spanish"}.
                    </p>
                  )}
                  
                  {safeTips && safeTips.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                      <div className="prose prose-sm max-w-none text-xs md:text-sm">
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

