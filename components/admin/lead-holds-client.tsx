"use client";

/**
 * Review queue for website leads Lead Guard kept out of the CRM (lib/lead-guard).
 *
 * "Soltar" replays the lead exactly as it was sent: the contact is created, tagged and enrolled
 * like any other website lead (the automatic email/SMS go out then), and any step-2 answers the
 * funnel saved are applied. "Descartar" erases the held data. Spanish, like the Telegram alert.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, Loader2, ShieldAlert, Trash2 } from "lucide-react";

import { discardLeadHoldAction, releaseLeadHoldAction } from "@/app/actions/lead-holds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type LeadHoldView = {
  id: string;
  createdAt: string;
  surface: string;
  reasons: string[];
  status: string;
  releaseError: string | null;
  releasedAt: string | null;
  crmUrl: string | null;
  preview: { firstName: string | null; phoneLast4: string | null; emailDomain: string | null; language: string | null } | null;
  details: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    language: string | null;
    source: string | null;
    smsConsent: boolean;
    marketingConsent: boolean;
  } | null;
  stepTwoCount: number;
};

export type LeadGuardStatRow = {
  surface: string;
  allowedDay: number;
  heldDay: number;
  allowedWeek: number;
  heldWeek: number;
};

const STATUS_LABELS: Record<string, string> = {
  held: "Retenido",
  releasing: "Soltando…",
  released: "Soltado",
  discarded: "Descartado",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("es-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function HoldCard({ hold }: { hold: LeadHoldView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const d = hold.details;
  const name = d ? [d.firstName, d.lastName].filter(Boolean).join(" ") : hold.preview?.firstName ?? "(sin nombre)";

  const run = (op: "release" | "discard") =>
    startTransition(async () => {
      setMessage(null);
      if (op === "discard" && !window.confirm("¿Descartar este lead? Se borran sus datos.")) return;
      const result = op === "release" ? await releaseLeadHoldAction(hold.id) : await discardLeadHoldAction(hold.id);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error ?? "No se pudo." });
        return;
      }
      const list: string[] = op === "release" && "warnings" in result && Array.isArray(result.warnings) ? result.warnings : [];
      const warnings = list.length > 0 ? ` (${list.join("; ")})` : "";
      setMessage({ kind: "ok", text: op === "release" ? `Soltado al CRM${warnings}` : "Descartado" });
      router.refresh();
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{name || "(sin nombre)"}</CardTitle>
            <CardDescription>
              {hold.surface} · {when(hold.createdAt)}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1">
            {hold.reasons.map((r) => (
              <Badge key={r} variant="secondary">
                {r}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {d ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            <div>
              <dt className="inline text-muted-foreground">Teléfono: </dt>
              <dd className="inline">{d.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Correo: </dt>
              <dd className="inline break-all">{d.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Idioma: </dt>
              <dd className="inline">{d.language ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Origen: </dt>
              <dd className="inline">{d.source ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Consentimiento SMS / marketing: </dt>
              <dd className="inline">
                {d.smsConsent ? "Sí" : "No"} / {d.marketingConsent ? "Sí" : "No"}
              </dd>
            </div>
            {hold.stepTwoCount > 0 && (
              <div>
                <dt className="inline text-muted-foreground">Pasos siguientes guardados: </dt>
                <dd className="inline">{hold.stepTwoCount}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-muted-foreground">Datos no disponibles.</p>
        )}
        {hold.releaseError && <p className="text-red-600">Último intento: {hold.releaseError}</p>}
        {message && <p className={message.kind === "ok" ? "text-green-700" : "text-red-600"}>{message.text}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => run("release")} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Es real: soltar al CRM
          </Button>
          <Button variant="outline" onClick={() => run("discard")} disabled={pending}>
            <Trash2 className="mr-2 h-4 w-4" />
            Descartar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LeadHoldsClient({
  holds,
  recent,
  stats,
  loadError,
}: {
  holds: LeadHoldView[];
  recent: LeadHoldView[];
  stats: LeadGuardStatRow[];
  loadError: string | null;
}) {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
          Leads retenidos del sitio web
        </h1>
        <p className="text-sm text-muted-foreground">
          Envíos dudosos que el sitio no mandó al CRM: no recibieron el email ni el SMS automático. La
          persona vio la pantalla normal de “gracias”. Si es real, suéltelo y entra al CRM como cualquier
          lead. Los bots seguros (sin JavaScript, firmas falsas) ni siquiera llegan aquí. Se borran solos a
          los 30 días.
        </p>
      </header>

      {loadError && (
        <Card className="border-red-300">
          <CardContent className="pt-6 text-sm text-red-700">
            No se pudo leer la base de datos ({loadError}). ¿Falta aplicar la migración 0047 (
            <code>pnpm db:migrate 0047</code>)?
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Por revisar ({holds.length})</h2>
        {holds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada retenido ahora mismo.</p>
        ) : (
          holds.map((h) => <HoldCard key={h.id} hold={h} />)
        )}
      </section>

      {stats.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Leads del sitio por formulario</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1 pr-4 font-medium">Formulario</th>
                  <th className="py-1 pr-4 font-medium">Pasaron (24 h)</th>
                  <th className="py-1 pr-4 font-medium">Retenidos (24 h)</th>
                  <th className="py-1 pr-4 font-medium">Pasaron (7 d)</th>
                  <th className="py-1 font-medium">Retenidos (7 d)</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.surface} className="border-t">
                    <td className="py-1 pr-4">{s.surface}</td>
                    <td className="py-1 pr-4">{s.allowedDay}</td>
                    <td className="py-1 pr-4">{s.heldDay}</td>
                    <td className="py-1 pr-4">{s.allowedWeek}</td>
                    <td className="py-1">{s.heldWeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Los bloqueados (bots seguros) no se guardan; aparecen solo en los logs de Vercel como “[lead-guard]”.
          </p>
        </section>
      )}

      {recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Revisados recientemente</h2>
          <ul className="divide-y rounded-md border text-sm">
            {recent.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  {h.preview?.firstName ?? "(sin nombre)"} · {h.surface} · {when(h.createdAt)}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={h.status === "released" ? "default" : "outline"}>{STATUS_LABELS[h.status] ?? h.status}</Badge>
                  {h.crmUrl && (
                    <a href={h.crmUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
                      CRM <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </span>
                {h.releaseError && <span className="w-full text-xs text-amber-700">{h.releaseError}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
