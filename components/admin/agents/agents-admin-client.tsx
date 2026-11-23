"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Mail, Pause, Pencil, Play, Plus, X } from "lucide-react";
import type { AdminAgentView } from "@/lib/tenancy/agent-admin";
import type { ProfileErrors } from "@/lib/tenancy/agent-profile-input";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const labelClass = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200";
const smallBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800";

type ApiResult = {
  success?: boolean;
  error?: string;
  warning?: string;
  result?: string;
  agent?: AdminAgentView;
  fields?: ProfileErrors;
};

async function call(url: string, method: string, body?: unknown): Promise<ApiResult & { ok: boolean }> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as ApiResult;
    return { ...json, ok: res.ok && Boolean(json.success) };
  } catch {
    return { ok: false, error: "Network error. Try again." };
  }
}

const STATUS_STYLE: Record<AdminAgentView["status"], string> = {
  invited: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  active: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}

/**
 * Isaac's /admin/agents: the agent platform's agents. Metadata only (who, status, sign-in linked,
 * agreements, a count of applications), never an agent's clients.
 */
export default function AgentsAdminClient({ initialAgents, productHost }: { initialAgents: AdminAgentView[]; productHost: string | null }) {
  const [agents, setAgents] = useState(initialAgents);
  const [showCreate, setShowCreate] = useState(initialAgents.length === 0);

  function replace(agent: AdminAgentView) {
    setAgents((prev) => (prev.some((a) => a.id === agent.id) ? prev.map((a) => (a.id === agent.id ? agent : a)) : [...prev, agent]));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Agents</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {agents.length} {agents.length === 1 ? "agent" : "agents"} · counts only, never their clients
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((s) => !s)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? "Cancel" : "Add agent"}
        </button>
      </div>

      {showCreate && (
        <CreateAgentForm
          productHost={productHost}
          onCreated={(agent) => {
            replace(agent);
            setShowCreate(false);
          }}
        />
      )}

      <ul className="space-y-3">
        {agents.map((agent) => (
          <AgentRowCard key={agent.id} agent={agent} productHost={productHost} onChange={replace} />
        ))}
      </ul>
    </div>
  );
}

function CreateAgentForm({ productHost, onCreated }: { productHost: string | null; onCreated: (agent: AdminAgentView) => void }) {
  const [form, setForm] = useState({ email: "", slug: "", firstName: "", lastName: "", isTest: true, defaultLocale: "es" as "en" | "es" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await call("/api/admin/agents", "POST", form);
    setBusy(false);
    if (result.ok && result.agent) onCreated(result.agent);
    else setError(result.error ?? "Could not create the agent.");
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">New agent</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Starts as <strong>invited</strong>: nothing opens until you activate them. The email is their login; send the
        invitation from the list.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Login email *</label>
          <input required type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Guide address (slug) *</label>
          <input required className={inputClass} placeholder="maria-lopez" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
          <p className="mt-1 text-xs text-slate-500">
            {productHost ?? "<product domain>"}/es/{form.slug || "…"}
          </p>
        </div>
        <div>
          <label className={labelClass}>First name</label>
          <input className={inputClass} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Last name</label>
          <input className={inputClass} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Language (invitation and area)</label>
          <select className={inputClass} value={form.defaultLocale} onChange={(e) => setForm({ ...form, defaultLocale: e.target.value === "en" ? "en" : "es" })}>
            <option value="es">Spanish</option>
            <option value="en">English</option>
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={form.isTest} onChange={(e) => setForm({ ...form, isTest: e.target.checked })} />
          Test agent (fake data only, until ACN approves in writing)
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Create agent
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}

function AgentRowCard({
  agent,
  productHost,
  onChange,
}: {
  agent: AdminAgentView;
  productHost: string | null;
  onChange: (agent: AdminAgentView) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const name = [agent.profile.firstName, agent.profile.lastName].filter(Boolean).join(" ") || agent.slug;

  async function act(key: string, url: string, body: unknown, done: (r: ApiResult) => string) {
    setBusy(key);
    setMessage(null);
    const result = await call(url, "POST", body);
    setBusy(null);
    if (result.agent) onChange(result.agent);
    if (result.ok) setMessage({ tone: result.warning ? "warn" : "ok", text: result.warning ?? done(result) });
    else setMessage({ tone: "error", text: result.error ?? "Something went wrong." });
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">{name}</span>
            <Pill className={STATUS_STYLE[agent.status]}>{agent.status}</Pill>
            {agent.isTest && <Pill className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">test</Pill>}
            <Pill className={agent.linked ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}>
              {agent.linked ? "sign-in linked" : "not linked"}
            </Pill>
            <Pill
              className={
                agent.agreementsAccepted
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }
            >
              {agent.agreementsAccepted === null ? "agreements ?" : agent.agreementsAccepted ? "ToS + DPA accepted" : "agreements pending"}
            </Pill>
          </div>
          <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
            {agent.email} · {productHost ?? "<product>"}/{agent.slug} ·{" "}
            {agent.applications === null ? "applications: ?" : `${agent.applications} ${agent.applications === 1 ? "application" : "applications"}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {agent.status === "active" ? (
            <button
              type="button"
              className={smallBtn}
              disabled={busy !== null}
              onClick={() => act("status", `/api/admin/agents/${agent.id}/status`, { status: "paused" }, () => "Paused.")}
            >
              {busy === "status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />} Pause
            </button>
          ) : (
            <button
              type="button"
              className={smallBtn}
              disabled={busy !== null}
              onClick={() => act("status", `/api/admin/agents/${agent.id}/status`, { status: "active" }, () => "Activated.")}
            >
              {busy === "status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Activate
            </button>
          )}
          {!agent.linked && (
            <button
              type="button"
              className={smallBtn}
              disabled={busy !== null}
              onClick={() =>
                act("invite", `/api/admin/agents/${agent.id}/invite`, { locale: agent.profile.defaultLocale }, (r) =>
                  r.result === "linked" ? "Their existing account is now linked." : `Invitation sent to ${agent.email}.`
                )
              }
            >
              {busy === "invite" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Invite or link
            </button>
          )}
          <button type="button" className={smallBtn} onClick={() => setEditing((e) => !e)}>
            {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />} {editing ? "Close" : "Edit"}
          </button>
        </div>
      </div>
      {message && (
        <p
          className={`mt-2 text-sm ${
            message.tone === "error" ? "text-red-600" : message.tone === "warn" ? "text-amber-700" : "text-green-700"
          }`}
        >
          {message.text}
        </p>
      )}
      {editing && (
        <EditAgentForm
          agent={agent}
          onSaved={(saved) => {
            onChange(saved);
            setEditing(false);
            setMessage({ tone: "ok", text: "Saved." });
          }}
        />
      )}
    </li>
  );
}

function EditAgentForm({ agent, onSaved }: { agent: AdminAgentView; onSaved: (agent: AdminAgentView) => void }) {
  const p = agent.profile;
  const [form, setForm] = useState({
    email: agent.email,
    slug: agent.slug,
    isTest: agent.isTest,
    firstName: p.firstName,
    lastName: p.lastName,
    photoUrl: p.photoUrl,
    whatsapp: p.whatsapp,
    contactEmail: p.contactEmail,
    alertEmail: p.alertEmail,
    iboNumber: p.iboNumber,
    impactReferralUrl: p.impactReferralUrl,
    defaultLocale: p.defaultLocale,
    languages: p.languages.join(", "),
    licensed: p.licensed,
    licensedStates: p.licensedStates.join(", "),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ProfileErrors>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    const list = (value: string) => value.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
    const result = await call(`/api/admin/agents/${agent.id}`, "PATCH", {
      ...form,
      languages: list(form.languages).map((v) => v.toLowerCase()),
      licensedStates: list(form.licensedStates).map((v) => v.toUpperCase()),
    });
    setBusy(false);
    if (result.ok && result.agent) onSaved(result.agent);
    else {
      setFields(result.fields ?? {});
      setError(result.error ?? "Could not save.");
    }
  }

  type TextKey = Exclude<keyof typeof form, "isTest" | "licensed">;
  const text = (key: TextKey, label: string, extra?: { disabled?: boolean; help?: string; placeholder?: string }) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        disabled={extra?.disabled}
        placeholder={extra?.placeholder}
        value={String(form[key])}
        onChange={(e) => {
          const value = e.target.value;
          setForm((prev) => ({ ...prev, [key]: value }) as typeof prev);
        }}
      />
      {(fields as Record<string, string | undefined>)[key] ? (
        <p className="mt-1 text-xs text-red-600">{(fields as Record<string, string | undefined>)[key]}</p>
      ) : extra?.help ? (
        <p className="mt-1 text-xs text-slate-500">{extra.help}</p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="grid gap-4 sm:grid-cols-2">
        {text("email", "Login email", { disabled: agent.linked, help: agent.linked ? "Fixed once a sign-in is linked." : undefined })}
        {text("slug", "Guide address (slug)", { help: "Changing it breaks links already shared." })}
        {text("firstName", "First name")}
        {text("lastName", "Last name")}
        {text("whatsapp", "WhatsApp", { placeholder: "+1 540 555 0100" })}
        {text("contactEmail", "Email shown to clients")}
        {text("alertEmail", "Alert email")}
        {text("photoUrl", "Photo link (https)")}
        {text("iboNumber", "IBO number (their own)")}
        {text("impactReferralUrl", "Impact referral link")}
        {text("languages", "Languages", { help: "es, en" })}
        {text("licensedStates", "Licensed states", { help: "Two-letter codes, comma-separated." })}
        <div>
          <label className={labelClass}>Language</label>
          <select className={inputClass} value={form.defaultLocale} onChange={(e) => setForm({ ...form, defaultLocale: e.target.value === "en" ? "en" : "es" })}>
            <option value="es">Spanish</option>
            <option value="en">English</option>
          </select>
        </div>
        <div className="flex flex-col justify-end gap-2 pb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.licensed} onChange={(e) => setForm({ ...form, licensed: e.target.checked })} />
            Licensed
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isTest} onChange={(e) => setForm({ ...form, isTest: e.target.checked })} />
            Test agent
          </label>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}
