"use client";

/**
 * Plantillas: Isaac approves each fixed message once (its content hash is stored); from then on it
 * goes out on its own. A wording change in code needs a new approval. Compliance templates (HELP,
 * opt-out) always go out and have no button.
 */

import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TemplateItem } from "./api-types";
import { BusyIcon, EmptyRow, FilterChip, Pill } from "./ui-bits";
import type { RunAction } from "./use-ai-setter-api";

/** Anchor the inbox's "Revisar plantillas" scrolls to. */
export const TEMPLATES_ANCHOR_ID = "ai-setter-templates";

const PLACEHOLDER_SPLIT = /(\{\w+\})/g;

function variantLabel(variant: TemplateItem["variants"][number]): string {
  if (variant.lang === "en") return "EN";
  return variant.register === "tu" ? "ES tú" : "ES usted";
}

/** The raw text with its {placeholders} set apart (they are filled in when sent). */
function TemplateText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {text.split(PLACEHOLDER_SPLIT).map((part, index) =>
        /^\{\w+\}$/.test(part) ? (
          <span key={index} className="rounded bg-primary/10 px-1 font-mono text-[0.8em] text-primary">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </p>
  );
}

function TemplateBadge({ template }: { template: TemplateItem }) {
  if (template.compliance) {
    return (
      <Pill tone="blue">
        <ShieldCheck className="mr-1 h-3 w-3" /> Siempre automática (cumplimiento)
      </Pill>
    );
  }
  if (template.approved) return <Pill tone="green">Aprobada</Pill>;
  if (template.approvalOutdated) return <Pill tone="amber">Cambió el texto: apruébala de nuevo</Pill>;
  return <Pill tone="slate">Sin aprobar</Pill>;
}

function TemplateRow({ template, busyKey, run }: { template: TemplateItem; busyKey: string | null; run: RunAction }) {
  const approveKey = `approve_template:${template.id}`;
  const revokeKey = `revoke_template:${template.id}`;
  const disabled = busyKey !== null;
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{template.description.es}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{template.id}</p>
        </div>
        <TemplateBadge template={template} />
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        {template.variants.map((variant) => (
          <div key={`${variant.lang}-${variant.register}`} className="rounded-md bg-muted/50 p-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{variantLabel(variant)}</p>
            <TemplateText text={variant.text} />
          </div>
        ))}
      </div>
      {!template.compliance && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!template.approved && (
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() => void run(approveKey, { action: "approve_template", templateId: template.id }, "Plantilla aprobada")}
            >
              <BusyIcon busy={busyKey === approveKey} icon={<Check />} /> Aprobar
            </Button>
          )}
          {(template.approved || template.approvalOutdated) && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => void run(revokeKey, { action: "revoke_template", templateId: template.id }, "Aprobación revocada")}
            >
              <BusyIcon busy={busyKey === revokeKey} icon={<X />} /> Revocar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function TemplatesPanel({ templates, busyKey, run }: { templates: TemplateItem[]; busyKey: string | null; run: RunAction }) {
  const reviewable = templates.filter((t) => !t.compliance);
  const pending = reviewable.filter((t) => !t.approved);
  const [onlyPending, setOnlyPending] = useState(pending.length > 0);
  const shown = onlyPending ? pending : templates;

  return (
    <Card id={TEMPLATES_ANCHOR_ID} className="scroll-mt-24">
      <CardHeader className="space-y-2 p-4">
        <CardTitle className="text-base">Plantillas</CardTitle>
        <CardDescription>
          Apruebas cada plantilla una vez y desde entonces sale sola, al instante. Si su texto cambia, vuelve a pedir tu OK.
          {` ${reviewable.length - pending.length} de ${reviewable.length} aprobadas.`}
        </CardDescription>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={onlyPending} onClick={() => setOnlyPending(true)}>
            Sin aprobar ({pending.length})
          </FilterChip>
          <FilterChip active={!onlyPending} onClick={() => setOnlyPending(false)}>
            Todas ({templates.length})
          </FilterChip>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {shown.length === 0 ? (
          <EmptyRow>Todas las plantillas están aprobadas.</EmptyRow>
        ) : (
          shown.map((template) => <TemplateRow key={template.id} template={template} busyKey={busyKey} run={run} />)
        )}
      </CardContent>
    </Card>
  );
}
