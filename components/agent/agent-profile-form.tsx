"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import type { AgentAreaLocale } from "@/lib/tenancy/agent-area-routes";
import { profileErrorsText } from "@/lib/tenancy/agent-profile-errors";
import type { AgentProfileForm as ProfileValues, ProfileErrors, ProfileField } from "@/lib/tenancy/agent-profile-input";

type StateOption = { code: string; name: string };

const WORDS = {
  en: {
    firstName: "First name",
    lastName: "Last name",
    photoUrl: "Photo link",
    photoHelp: "An https:// link to a square photo of you on a public site (no upload yet).",
    whatsapp: "WhatsApp",
    whatsappHelp: "With the country code, e.g. +1 540 555 0100. Clients reach you here.",
    contactEmail: "Email shown to clients",
    languages: "Languages you serve clients in",
    licensed: "I hold an insurance license",
    licensedStates: "Licensed states",
    licensedStatesHelp: "Shown only as a count on your presentation.",
    iboNumber: "IBO number",
    iboHelp: "Your own ACN Business ID. It appears on your presentation.",
    impactReferralUrl: "Impact link",
    impactHelp: "Your referral link on impacthealthsharing.com or mysharable.com.",
    defaultLocale: "Your language",
    alertEmail: "Email for alerts",
    alertHelp: "Where the platform tells you about new activity. Alerts never carry client details.",
    save: "Save",
    saved: "Saved",
    error: "Couldn't save. Check the highlighted fields.",
    english: "English",
    spanish: "Español",
  },
  es: {
    firstName: "Nombre",
    lastName: "Apellido",
    photoUrl: "Enlace a su foto",
    photoHelp: "Un enlace https:// a una foto cuadrada suya en un sitio público (aún no se pueden subir fotos).",
    whatsapp: "WhatsApp",
    whatsappHelp: "Con el código de país, p. ej. +1 540 555 0100. Sus clientes le escriben aquí.",
    contactEmail: "Correo que ven sus clientes",
    languages: "Idiomas en que atiende a sus clientes",
    licensed: "Tengo licencia de seguros",
    licensedStates: "Estados con licencia",
    licensedStatesHelp: "Solo se muestra la cantidad en su presentación.",
    iboNumber: "Número de IBO",
    iboHelp: "Su propio número de negocio de ACN. Aparece en su presentación.",
    impactReferralUrl: "Enlace de Impact",
    impactHelp: "Su enlace de referido en impacthealthsharing.com o mysharable.com.",
    defaultLocale: "Su idioma",
    alertEmail: "Correo para avisos",
    alertHelp: "Donde la plataforma le avisa de nueva actividad. Los avisos nunca llevan datos de clientes.",
    save: "Guardar",
    saved: "Guardado",
    error: "No se pudo guardar. Revise los campos marcados.",
    english: "English",
    spanish: "Español",
  },
} as const;

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white";

/**
 * The agent's own profile (/agent/profile): what clients see on the guide, the deck and the quote
 * images. Saved through PATCH /api/agent/profile, which checks every field again; the page then
 * reloads so the preview and the frame show the saved profile.
 */
export default function AgentProfileForm({
  locale,
  initial,
  states,
}: {
  locale: AgentAreaLocale;
  initial: ProfileValues;
  states: StateOption[];
}) {
  const w = WORDS[locale];
  const [values, setValues] = useState<ProfileValues>(initial);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function toggleLanguage(code: "en" | "es") {
    set("languages", values.languages.includes(code) ? values.languages.filter((c) => c !== code) : [...values.languages, code]);
  }

  function toggleState(code: string) {
    set(
      "licensedStates",
      values.licensedStates.includes(code) ? values.licensedStates.filter((c) => c !== code) : [...values.licensedStates, code]
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await fetch("/api/agent/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; fields?: Record<string, unknown>; error?: string };
      if (res.ok && json.success) {
        setSaved(true);
        // The preview and the frame's name and photo are drawn on the server: show the saved ones.
        window.location.reload();
        return;
      }
      // The API names each refused field's reason as a code; the words are this page's language.
      setErrors(profileErrorsText(json.fields, locale) as ProfileErrors);
      setError(w.error);
    } catch {
      setError(w.error);
    }
    setBusy(false);
  }

  const field = (key: ProfileField, label: string, input: ReactNode, help?: string) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
      {input}
      {errors[key] ? (
        <p className="mt-1 text-xs text-red-600">{errors[key]}</p>
      ) : help ? (
        <p className="mt-1 text-xs text-slate-500">{help}</p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={save} className="rounded-2xl border border-[#e6e9ef] bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("firstName", w.firstName, <input className={inputClass} value={values.firstName} onChange={(e) => set("firstName", e.target.value)} />)}
        {field("lastName", w.lastName, <input className={inputClass} value={values.lastName} onChange={(e) => set("lastName", e.target.value)} />)}
        {field(
          "photoUrl",
          w.photoUrl,
          <input className={inputClass} inputMode="url" placeholder="https://…" value={values.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} />,
          w.photoHelp
        )}
        {field(
          "whatsapp",
          w.whatsapp,
          <input className={inputClass} type="tel" inputMode="tel" value={values.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />,
          w.whatsappHelp
        )}
        {field(
          "contactEmail",
          w.contactEmail,
          <input className={inputClass} type="email" inputMode="email" value={values.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        )}
        {field(
          "alertEmail",
          w.alertEmail,
          <input className={inputClass} type="email" inputMode="email" value={values.alertEmail} onChange={(e) => set("alertEmail", e.target.value)} />,
          w.alertHelp
        )}
        {field(
          "iboNumber",
          w.iboNumber,
          <input className={inputClass} value={values.iboNumber} onChange={(e) => set("iboNumber", e.target.value)} />,
          w.iboHelp
        )}
        {field(
          "impactReferralUrl",
          w.impactReferralUrl,
          <input className={inputClass} inputMode="url" placeholder="https://…" value={values.impactReferralUrl} onChange={(e) => set("impactReferralUrl", e.target.value)} />,
          w.impactHelp
        )}
        {field(
          "defaultLocale",
          w.defaultLocale,
          <select className={inputClass} value={values.defaultLocale} onChange={(e) => set("defaultLocale", e.target.value === "es" ? "es" : "en")}>
            <option value="en">{w.english}</option>
            <option value="es">{w.spanish}</option>
          </select>
        )}
        {field(
          "languages",
          w.languages,
          <div className="flex gap-4 py-2 text-sm">
            {(["es", "en"] as const).map((code) => (
              <label key={code} className="flex items-center gap-2">
                <input type="checkbox" checked={values.languages.includes(code)} onChange={() => toggleLanguage(code)} />
                {code === "es" ? w.spanish : w.english}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={values.licensed} onChange={(e) => set("licensed", e.target.checked)} />
          {w.licensed}
        </label>
        {values.licensed && (
          <div className="mt-3">
            <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">{w.licensedStates}</p>
            <div className="grid max-h-56 grid-cols-3 gap-x-3 gap-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700 sm:grid-cols-5">
              {states.map((s) => (
                <label key={s.code} className="flex items-center gap-1.5" title={s.name}>
                  <input type="checkbox" checked={values.licensedStates.includes(s.code)} onChange={() => toggleState(s.code)} />
                  {s.code}
                </label>
              ))}
            </div>
            {errors.licensedStates ? (
              <p className="mt-1 text-xs text-red-600">{errors.licensedStates}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">{w.licensedStatesHelp}</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0b2a4a] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? w.saved : w.save}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}
