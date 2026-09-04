"use client";

import Image from "next/image";
import { PortableText } from "@portabletext/react";
import type { PortableTextComponents } from "@portabletext/react";
import { urlFor } from "@/sanity/lib/image";

export { PortableText };

// Portable Text rendering for sales scripts, shared by the script accordion and the objection
// answer dialog so both surfaces render the same vocabulary identically.
//
// Call it inside a useMemo keyed on (language, scale). PortableText memoizes its merged component
// map by identity, so building a fresh object on every render defeats that.
//
// Every style and mark declared in sanity/schemaTypes/scriptPortableText.tsx
// MUST have an entry here. A custom style with no entry falls back to bare
// unstyled text; there is no safety net, since the `prose` classes on the
// wrappers are inert (@tailwindcss/typography is not installed).
export type ScriptLang = "en" | "es";
export type TextScale = "default" | "large";

const pillLabels = {
  verbatim: { en: "Word for word", es: "Palabra por palabra" },
  askPause: { en: "Ask — then stop", es: "Pregunta — luego calla" },
  agentNote: { en: "Don't read", es: "No leer" },
  clientSays: { en: "Client says", es: "El cliente dice" },
} as const;

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`mb-1 block text-[10px] font-bold uppercase tracking-wider ${className}`}>
      {label}
    </span>
  );
}

export function buildScriptComponents(
  language: ScriptLang,
  scale: TextScale = "default"
): PortableTextComponents {
  const label = (key: keyof typeof pillLabels) => pillLabels[key][language];

  // Objection answers are read at arm's length mid-call, so they get a bigger body size. Tailwind
  // sizes live on the children here, so a parent class cannot override them - it has to be a
  // parameter.
  const body =
    scale === "large"
      ? "text-[17px] md:text-[19px] leading-8"
      : "text-[15px] md:text-base leading-7";

  return {
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
      // --- Sales-script styles ---

      // Read exactly as written (compliance / disclosure wording).
      verbatim: ({ children }: any) => (
        <div className="my-4 rounded-r-md border-l-4 border-[#0077B6] bg-[#0077B6]/[0.06] dark:bg-[#0077B6]/20 px-4 py-3">
          <Pill label={label('verbatim')} className="text-[#0077B6] dark:text-[#4FC3E8]" />
          <span className={`block font-medium text-slate-900 dark:text-slate-50 ${body}`}>
            {children}
          </span>
        </div>
      ),

      // The question you ask before going silent — the loudest thing on the page.
      askPause: ({ children }: any) => (
        <div className="my-4 rounded-lg border-2 border-dashed border-[#00B4D8] bg-[#00B4D8]/10 px-4 py-3">
          <Pill label={label('askPause')} className="text-cyan-700 dark:text-[#7FDCF0]" />
          <span className="block text-base md:text-lg font-semibold leading-7 text-slate-900 dark:text-slate-50">
            {children}
          </span>
        </div>
      ),

      // An instruction to the agent, never spoken. Deliberately the quietest
      // thing on the page so the eye skips it mid-call.
      agentNote: ({ children }: any) => (
        <div className="my-3 rounded-r-md border-l-4 border-slate-300 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-800/50 px-3 py-2">
          <Pill label={label('agentNote')} className="text-slate-500 dark:text-slate-400" />
          <span className="block text-[13px] italic leading-6 text-slate-600 dark:text-slate-400">
            {children}
          </span>
        </div>
      ),

      // An objection, in the client's own words — the moment that needs
      // attention, so it is an alert rather than the faint italic whisper the
      // built-in quote style used to be.
      clientSays: ({ children }: any) => (
        <div className="my-3 rounded-r-md border-l-4 border-rose-400 dark:border-rose-500 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5">
          <Pill label={label('clientSays')} className="text-rose-600 dark:text-rose-300" />
          <span className={`block not-italic text-rose-950 dark:text-rose-100 ${body}`}>
            {children}
          </span>
        </div>
      ),

      // The built-in quote style, left deliberately neutral. The only
      // blockquote in live content is an agent stage direction ("(Slow down
      // here. Pause often. Let them answer.)"), so giving this the "Client
      // says" treatment would attribute it to the client.
      blockquote: ({ children }: any) => (
        <blockquote className={`my-3 rounded-r border-l-4 border-slate-300 dark:border-slate-600 pl-3 py-2 italic text-muted-foreground ${body}`}>
          {children}
        </blockquote>
      ),

      // --- Headings ---
      h2: ({ children }: any) => (
        <h2 className="mt-6 mb-2 border-b border-[#0077B6]/25 pb-1 text-lg md:text-xl font-bold text-[#0077B6] dark:text-[#4FC3E8]">
          {children}
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="mt-4 mb-1.5 text-base md:text-lg font-semibold text-foreground">
          {children}
        </h3>
      ),
      // h1/h4 are legacy — the AI generator emits them and existing scripts
      // contain 29 h1 blocks.
      h1: ({ children }: any) => (
        <h1 className="mt-5 mb-2 text-xl md:text-2xl font-bold text-foreground">
          {children}
        </h1>
      ),
      h4: ({ children }: any) => (
        <h4 className="mt-3 mb-1 text-sm md:text-base font-semibold text-foreground">
          {children}
        </h4>
      ),

      // The spoken line — bumped up from text-sm, this is read at arm's length
      // during a live call.
      normal: ({ children }: any) => (
        <p className={`mb-3 text-foreground ${body}`}>
          {children}
        </p>
      ),
    },
    list: {
      // list-outside + padding so nested levels actually indent; list-inside
      // rendered a sub-bullet identically to a top-level one.
      bullet: ({ children }: any) => (
        <ul className="list-disc list-outside space-y-1.5 my-3 pl-6 marker:text-[#0077B6] dark:marker:text-[#4FC3E8]">
          {children}
        </ul>
      ),
      number: ({ children }: any) => (
        <ol className="list-decimal list-outside space-y-1.5 my-3 pl-6 marker:font-semibold marker:text-[#0077B6] dark:marker:text-[#4FC3E8]">
          {children}
        </ol>
      ),
    },
    listItem: {
      bullet: ({ children }: any) => (
        <li className={`text-foreground ${body}`}>{children}</li>
      ),
      number: ({ children }: any) => (
        <li className={`text-foreground ${body}`}>{children}</li>
      ),
    },
    marks: {
      strong: ({ children }: any) => (
        <strong className="font-bold text-foreground">{children}</strong>
      ),
      em: ({ children }: any) => (
        <em className="italic text-foreground">{children}</em>
      ),
      // 57 existing underlines rendered unstyled before this entry existed.
      underline: ({ children }: any) => (
        <span className="underline underline-offset-2 decoration-2 decoration-[#0077B6]/60">
          {children}
        </span>
      ),

      // --- Highlighters. box-decoration-clone keeps the padding and rounding
      // on every line when a highlighted phrase wraps. ---
      highlight: ({ children }: any) => (
        <mark className="box-decoration-clone rounded-[3px] bg-amber-200/90 px-1 py-[1px] text-slate-900 dark:bg-amber-300/90 dark:text-slate-900">
          {children}
        </mark>
      ),
      highlightGood: ({ children }: any) => (
        <mark className="box-decoration-clone rounded-[3px] bg-emerald-200/90 px-1 py-[1px] text-emerald-950 dark:bg-emerald-300/90 dark:text-emerald-950">
          {children}
        </mark>
      ),
      highlightCareful: ({ children }: any) => (
        <mark className="box-decoration-clone rounded-[3px] bg-rose-200/90 px-1 py-[1px] text-rose-950 dark:bg-rose-300/90 dark:text-rose-950">
          {children}
        </mark>
      ),

      // Substitute-live placeholders: client name, state, premium.
      fill: ({ children }: any) => (
        <span className="box-decoration-clone rounded border border-dashed border-[#0077B6] bg-[#0077B6]/10 px-1 font-semibold text-[#0077B6] dark:border-[#00B4D8] dark:bg-[#00B4D8]/15 dark:text-[#7FDCF0]">
          {children}
        </span>
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
    // Fallbacks so content authored with a tool that has no entry here still
    // reads, instead of silently losing its text.
    unknownMark: ({ children }: any) => <>{children}</>,
    unknownBlockStyle: ({ children }: any) => (
      <p className={`mb-3 text-foreground ${body}`}>{children}</p>
    ),
  };
}
