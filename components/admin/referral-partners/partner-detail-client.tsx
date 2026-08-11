"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  bpsToPercentLabel,
  commissionCents,
  formatCents,
  parsePremiumToCents,
  summarize,
  type ReferralClientRecord,
  type ReferralClientStatus,
  type ReferralLeadRecord,
  type ReferralLeadStatus,
  type ReferralPartnerRecord,
} from "@/lib/referral-partners/types";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white";

const LEAD_STATUSES: ReferralLeadStatus[] = ["new", "contacted", "closed", "lost"];
const CLIENT_STATUSES: ReferralClientStatus[] = ["active", "pending", "cancelled"];

type Props = {
  partner: ReferralPartnerRecord;
  leads: ReferralLeadRecord[];
  clients: ReferralClientRecord[];
  /** Absolute origin for building the shareable partner link. */
  siteUrl: string;
};

type ClientDraft = {
  firstName: string;
  lastName: string;
  memberCount: string;
  monthlyPremium: string;
  status: ReferralClientStatus;
  effectiveDate: string;
  leadId: string;
  notes: string;
};

const EMPTY_CLIENT: ClientDraft = {
  firstName: "",
  lastName: "",
  memberCount: "1",
  monthlyPremium: "",
  status: "active",
  effectiveDate: "",
  leadId: "",
  notes: "",
};

export default function PartnerDetailClient({ partner, leads, clients, siteUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [settings, setSettings] = useState({
    companyName: partner.companyName,
    slug: partner.slug,
    contactName: partner.contactName,
    contactTitle: partner.contactTitle,
    email: partner.email,
    phone: partner.phone,
    website: partner.website,
    logoUrl: partner.logoUrl,
    heroImageUrl: partner.heroImageUrl,
    sectionImageUrl: partner.sectionImageUrl,
    accentColor: partner.accentColor,
    commissionPercent: String(partner.commissionBps / 100),
    defaultLocale: partner.defaultLocale,
    audienceKind: partner.audienceKind,
    status: partner.status,
    headlineEs: partner.headlineEs,
    headlineEn: partner.headlineEn,
    introEs: partner.introEs,
    introEn: partner.introEn,
    audienceEs: partner.audienceEs,
    audienceEn: partner.audienceEn,
    notes: partner.notes,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [clientDraft, setClientDraft] = useState<ClientDraft>(EMPTY_CLIENT);
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  const summary = useMemo(() => summarize(leads, clients), [leads, clients]);
  const rateLabel = bpsToPercentLabel(partner.commissionBps);
  const partnerUrl = `${siteUrl}/${partner.defaultLocale}/${
    partner.defaultLocale === "es" ? "socios" : "partners"
  }/${partner.slug}`;

  // Live preview of what this row will pay, so a typo in the premium is obvious before saving.
  const draftPremiumCents = parsePremiumToCents(clientDraft.monthlyPremium);
  const draftCommission =
    draftPremiumCents === null ? null : commissionCents(draftPremiumCents, partner.commissionBps);

  const openLeads = leads.filter((lead) => lead.status === "new" || lead.status === "contacted");

  async function call(key: string, url: string, init: RequestInit): Promise<boolean> {
    setBusy(key);
    setError("");
    try {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!response.ok || !data.success) {
        setError(data.error || "Something went wrong.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    const percent = Number(settings.commissionPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setError("Commission must be a percentage between 0 and 100.");
      return;
    }
    const ok = await call("settings", `/api/admin/referral-partners/${partner.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...settings, commissionBps: Math.round(percent * 100) }),
    });
    if (ok) setSettingsOpen(false);
  }

  async function submitClient(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      firstName: clientDraft.firstName,
      lastName: clientDraft.lastName,
      memberCount: Number(clientDraft.memberCount),
      monthlyPremium: clientDraft.monthlyPremium,
      status: clientDraft.status,
      effectiveDate: clientDraft.effectiveDate,
      notes: clientDraft.notes,
      ...(editingClientId ? {} : { leadId: clientDraft.leadId }),
    };
    const ok = await call(
      "client",
      editingClientId
        ? `/api/admin/referral-partners/${partner.id}/clients/${editingClientId}`
        : `/api/admin/referral-partners/${partner.id}/clients`,
      { method: editingClientId ? "PATCH" : "POST", body: JSON.stringify(payload) }
    );
    if (ok) {
      setClientDraft(EMPTY_CLIENT);
      setShowClientForm(false);
      setEditingClientId(null);
    }
  }

  function startEditClient(client: ReferralClientRecord) {
    setEditingClientId(client.id);
    setClientDraft({
      firstName: client.firstName,
      lastName: client.lastName,
      memberCount: String(client.memberCount),
      monthlyPremium: (client.monthlyPremiumCents / 100).toFixed(2),
      status: client.status,
      effectiveDate: client.effectiveDate ?? "",
      leadId: client.leadId ?? "",
      notes: client.notes,
    });
    setShowClientForm(true);
  }

  /** Prefill the client form from a referral, so converting is one click plus the premium. */
  function convertLead(lead: ReferralLeadRecord) {
    setEditingClientId(null);
    setClientDraft({
      ...EMPTY_CLIENT,
      firstName: lead.firstName,
      lastName: lead.lastName,
      leadId: lead.id,
    });
    setShowClientForm(true);
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Shareable link */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Their shareable link
            </p>
            <code className="mt-1 block truncate text-sm text-slate-700 dark:text-slate-200">
              {partnerUrl}
            </code>
          </div>
          <a
            href={partnerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ExternalLink className="h-4 w-4" />
            Preview
          </a>
        </div>
      </section>

      {/* Headline numbers */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Referrals", value: String(summary.totalLeads), hint: `${summary.openLeads} open` },
          {
            label: "Active clients",
            value: String(summary.activeClients),
            hint: `${summary.totalMembers} people covered`,
          },
          {
            label: "Monthly premium",
            value: formatCents(summary.monthlyPremiumCents),
            hint: `${summary.conversionRate}% conversion`,
          },
          {
            label: `Owed at ${rateLabel}`,
            value: formatCents(summary.monthlyCommissionCents),
            hint: `${formatCents(summary.annualCommissionCents)} / yr`,
            highlight: true,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border p-4 ${
              stat.highlight
                ? "border-primary/30 bg-primary/5"
                : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {stat.label}
            </p>
            <p
              className={`mt-1 text-xl font-extrabold tabular-nums ${
                stat.highlight ? "text-primary" : "text-slate-900 dark:text-white"
              }`}
            >
              {stat.value}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{stat.hint}</p>
          </div>
        ))}
      </section>

      {/* Clients */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Credited clients</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Add a client once the policy is issued. They earn {rateLabel} of the monthly premium.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingClientId(null);
              setClientDraft(EMPTY_CLIENT);
              setShowClientForm((prev) => !prev);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add client
          </button>
        </div>

        {showClientForm && (
          <form onSubmit={submitClient} className="border-b border-slate-200 p-5 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {editingClientId ? "Edit client" : "New client"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowClientForm(false);
                  setEditingClientId(null);
                  setClientDraft(EMPTY_CLIENT);
                }}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  First name *
                </label>
                <input
                  required
                  value={clientDraft.firstName}
                  onChange={(e) => setClientDraft({ ...clientDraft, firstName: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Last name *
                </label>
                <input
                  required
                  value={clientDraft.lastName}
                  onChange={(e) => setClientDraft({ ...clientDraft, lastName: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Members *
                </label>
                <input
                  required
                  inputMode="numeric"
                  value={clientDraft.memberCount}
                  onChange={(e) => setClientDraft({ ...clientDraft, memberCount: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Monthly premium *
                </label>
                <input
                  required
                  inputMode="decimal"
                  placeholder="485.00"
                  value={clientDraft.monthlyPremium}
                  onChange={(e) =>
                    setClientDraft({ ...clientDraft, monthlyPremium: e.target.value })
                  }
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {draftCommission === null
                    ? `Their cut: — (${rateLabel})`
                    : `Their cut: ${formatCents(draftCommission)} / mo (${rateLabel})`}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Status
                </label>
                <select
                  value={clientDraft.status}
                  onChange={(e) =>
                    setClientDraft({
                      ...clientDraft,
                      status: e.target.value as ReferralClientStatus,
                    })
                  }
                  className={inputClass}
                >
                  {CLIENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Coverage start
                </label>
                <input
                  type="date"
                  value={clientDraft.effectiveDate}
                  onChange={(e) =>
                    setClientDraft({ ...clientDraft, effectiveDate: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Internal notes
              </label>
              <input
                value={clientDraft.notes}
                onChange={(e) => setClientDraft({ ...clientDraft, notes: e.target.value })}
                placeholder="Carrier, policy number, anything you want to remember"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={busy === "client"}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy === "client" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingClientId ? "Save changes" : "Add client"}
            </button>
          </form>
        )}

        {clients.length === 0 ? (
          <p className="p-5 text-sm text-slate-500 dark:text-slate-400">
            No credited clients yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 text-center font-semibold">Members</th>
                  <th className="px-5 py-3 text-right font-semibold">Premium</th>
                  <th className="px-5 py-3 text-right font-semibold">Their cut</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Start</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                      {client.firstName} {client.lastName}
                      {client.notes && (
                        <span className="block text-xs font-normal text-slate-400">
                          {client.notes}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center tabular-nums">{client.memberCount}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatCents(client.monthlyPremiumCents)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-primary">
                      {client.status === "active"
                        ? formatCents(
                            commissionCents(client.monthlyPremiumCents, client.commissionBps)
                          )
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          client.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : client.status === "pending"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {client.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{client.effectiveDate ?? "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEditClient(client)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                          aria-label={`Edit ${client.firstName}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busy === `del-${client.id}`}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Remove ${client.firstName} ${client.lastName} from this partner's credited clients? This does not touch your CRM.`
                              )
                            ) {
                              return;
                            }
                            void call(
                              `del-${client.id}`,
                              `/api/admin/referral-partners/${partner.id}/clients/${client.id}`,
                              { method: "DELETE" }
                            );
                          }}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                          aria-label={`Remove ${client.firstName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Referrals */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Referrals ({openLeads.length} open of {leads.length})
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Everyone who submitted the form on their page. Also in your CRM, tagged{" "}
            <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">
              referral_{partner.slug.replace(/-/g, "_")}
            </code>
            .
          </p>
        </div>

        {leads.length === 0 ? (
          <p className="p-5 text-sm text-slate-500 dark:text-slate-400">No referrals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Contact</th>
                  <th className="px-5 py-3 font-semibold">Received</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                      {lead.firstName} {lead.lastName}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      <span className="block">{lead.phone || "—"}</span>
                      <span className="block text-xs text-slate-400">{lead.email || "—"}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={lead.status}
                        disabled={busy === `lead-${lead.id}`}
                        onChange={(e) =>
                          void call(
                            `lead-${lead.id}`,
                            `/api/admin/referral-partners/${partner.id}/leads/${lead.id}`,
                            { method: "PATCH", body: JSON.stringify({ status: e.target.value }) }
                          )
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        {LEAD_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        {lead.status !== "closed" && (
                          <button
                            type="button"
                            onClick={() => convertLead(lead)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Credit as client
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy === `dell-${lead.id}`}
                          onClick={() => {
                            if (!window.confirm(`Delete this referral? It stays in your CRM.`)) {
                              return;
                            }
                            void call(
                              `dell-${lead.id}`,
                              `/api/admin/referral-partners/${partner.id}/leads/${lead.id}`,
                              { method: "DELETE" }
                            );
                          }}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                          aria-label="Delete referral"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Settings */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setSettingsOpen((prev) => !prev)}
          className="flex w-full items-center justify-between p-5 text-left"
        >
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Partner settings</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Login email, commission rate, branding, and the copy on their landing page
            </p>
          </div>
          <span className="text-sm font-medium text-primary">
            {settingsOpen ? "Close" : "Edit"}
          </span>
        </button>

        {settingsOpen && (
          <form onSubmit={saveSettings} className="border-t border-slate-200 p-5 dark:border-slate-800">
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["companyName", "Company name"],
                  ["slug", "URL slug"],
                  ["contactName", "Contact name"],
                  ["contactTitle", "Contact title"],
                  ["email", "Login email"],
                  ["phone", "Phone"],
                  ["website", "Website"],
                  ["logoUrl", "Logo URL"],
                  ["heroImageUrl", "Hero image URL (blank = placeholder)"],
                  ["sectionImageUrl", "Section image URL (blank = placeholder)"],
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    {label}
                  </label>
                  <input
                    value={settings[field]}
                    onChange={(e) => setSettings({ ...settings, [field]: e.target.value })}
                    className={inputClass}
                  />
                </div>
              ))}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Commission %
                </label>
                <input
                  inputMode="decimal"
                  value={settings.commissionPercent}
                  onChange={(e) =>
                    setSettings({ ...settings, commissionPercent: e.target.value })
                  }
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Applies to clients added from now on. Existing rows keep the rate they were
                  saved with.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Page language
                </label>
                <select
                  value={settings.defaultLocale}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultLocale: e.target.value === "en" ? "en" : "es",
                    })
                  }
                  className={inputClass}
                >
                  <option value="es">Spanish</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Status
                </label>
                <select
                  value={settings.status}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      status: e.target.value === "paused" ? "paused" : "active",
                    })
                  }
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused (page returns 404)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Audience
                </label>
                <select
                  value={settings.audienceKind}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      audienceKind: e.target.value === "immigration" ? "immigration" : "general",
                    })
                  }
                  className={inputClass}
                >
                  <option value="general">General</option>
                  <option value="immigration">Immigration clients</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  &quot;Immigration clients&quot; adds two sections to their page: when coverage
                  matters during a case, and what going uninsured actually costs.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Accent color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700"
                  />
                  <input
                    value={settings.accentColor}
                    onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <h3 className="mt-6 text-sm font-semibold text-slate-900 dark:text-white">
              Landing page copy
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Leave any field blank to use the generic default. The audience paragraph is the one
              worth writing by hand — it is what makes the page feel built for their clients.
            </p>

            <div className="mt-4 space-y-4">
              {(
                [
                  ["headlineEs", "Headline (Spanish)", 2],
                  ["headlineEn", "Headline (English)", 2],
                  ["introEs", "Intro (Spanish)", 3],
                  ["introEn", "Intro (English)", 3],
                  ["audienceEs", "Why their clients need this (Spanish)", 4],
                  ["audienceEn", "Why their clients need this (English)", 4],
                ] as const
              ).map(([field, label, rows]) => (
                <div key={field}>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    {label}
                  </label>
                  <textarea
                    rows={rows}
                    value={settings[field]}
                    onChange={(e) => setSettings({ ...settings, [field]: e.target.value })}
                    className={inputClass}
                  />
                </div>
              ))}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Internal notes (never shown to the partner)
                </label>
                <textarea
                  rows={2}
                  value={settings.notes}
                  onChange={(e) => setSettings({ ...settings, notes: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy === "settings"}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {busy === "settings" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save settings
              </button>

              <button
                type="button"
                disabled={busy === "delete-partner"}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Delete ${partner.companyName}? This permanently removes their page, their ${leads.length} referral(s), and their ${clients.length} credited client(s). Your CRM is not affected.`
                    )
                  ) {
                    return;
                  }
                  const ok = await call(
                    "delete-partner",
                    `/api/admin/referral-partners/${partner.id}`,
                    { method: "DELETE" }
                  );
                  if (ok) router.push("/en/admin/referral-partners");
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4" />
                Delete partner
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
