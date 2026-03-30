"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export type UhoneProductFaqItem = { q: string; a: string };

export type UhoneProductFaqProps = {
  title: string;
  items: UhoneProductFaqItem[];
  sectionId: string;
};

export default function UhoneProductFaq({
  title,
  items,
  sectionId,
}: UhoneProductFaqProps) {
  return (
    <section
      className="border-b border-border/60 bg-muted/15 py-14 sm:py-16"
      aria-labelledby={sectionId}
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2
          id={sectionId}
          className="text-center text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {title}
        </h2>
        <Accordion type="single" collapsible className="mt-8 w-full">
          {items.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-border/80">
              <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
