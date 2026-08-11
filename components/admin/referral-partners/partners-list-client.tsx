"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, TrendingUp, Users } from "lucide-react";
import {
  bpsToPercentLabel,
  formatCents,
  slugifyPartnerName,
  type ReferralPartnerRecord,
  type ReferralPartnerSummary,
} from "@/lib/referral-partners/types";

type Row = { partner: ReferralPartnerRecord; summary: ReferralPartnerSummary };

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white";

export default function PartnersListClient({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(initialRows.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    companyName: "",
    slug: "",
    contactName: "",
    contactTitle: "",
    email: "",
    phone: "",
    website: "",
    logoUrl: "",
    accentColor: "#0077B6",
    commissionPercent: "5",
    defaultLocale: "es" as "en" | "es",
  });

  // Slug mirrors the company name until the admin edits it by hand, then it stops following.
  const [slugTouched, setSlugTouched] = useState(false);
  const effectiveSlug = slugTouched ? slugifyPartnerName(form.slug) : slugifyPartnerName(form.companyName);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const percent = Number(form.commissionPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setError("Commission must be a percentage between 0 and 100.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/referral-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          slug: effectiveSlug,
          commissionBps: Math.round(percent * 100),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        partner?: ReferralPartnerRecord;
      };
      if (!response.ok || !data.success) {
        setError(data.error || "Could not create the partner.");
        return;
      }
      router.push(`/en/admin/referral-partners/${data.partner!.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Partners</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {initialRows.length} {initialRows.length === 1 ? "partner" : "partners"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Add partner"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">New partner</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The email is how they sign in — they use it to create a Clerk account at{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/partner</code> and their
            dashboard loads automatically. Page copy is editable after you create them.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Company name *
              </label>
              <input
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Sin Fronteras USA"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                URL slug
              </label>
              <input
                value={slugTouched ? form.slug : effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm({ ...form, slug: e.target.value });
                }}
                placeholder="sin-fronteras"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-500">
                /partners/{effectiveSlug || "…"} · /socios/{effectiveSlug || "…"}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Contact name
              </label>
              <input
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                placeholder="Josarih Basantes"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Contact title
              </label>
              <input
                value={form.contactTitle}
                onChange={(e) => setForm({ ...form, contactTitle: e.target.value })}
                placeholder="CEO"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Login email *
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="info@sinfronterasusa.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Phone
              </label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (832) 429-2848"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Website
              </label>
              <input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://sinfronterasusa.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Logo URL
              </label>
              <input
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                placeholder="https://…/logo.png"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Commission %
              </label>
              <input
                value={form.commissionPercent}
                onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
                inputMode="decimal"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Page language
              </label>
              <select
                value={form.defaultLocale}
                onChange={(e) =>
                  setForm({ ...form, defaultLocale: e.target.value === "en" ? "en" : "es" })
                }
                className={inputClass}
              >
                <option value="es">Spanish</option>
                <option value="en">English</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Accent color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700"
                />
                <input
                  value={form.accentColor}
                  onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create partner
          </button>
        </form>
      )}

      {initialRows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {initialRows.map(({ partner, summary }) => (
            <a
              key={partner.id}
              href={`/en/admin/referral-partners/${partner.id}`}
              className="group rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900 group-hover:text-primary dark:text-white">
                    {partner.companyName}
                  </h3>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                    /partners/{partner.slug} · {bpsToPercentLabel(partner.commissionBps)}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    partner.status === "active"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {partner.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Users className="h-3 w-3" /> Referrals
                  </p>
                  <p className="mt-0.5 font-bold tabular-nums text-slate-900 dark:text-white">
                    {summary.totalLeads}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <TrendingUp className="h-3 w-3" /> Clients
                  </p>
                  <p className="mt-0.5 font-bold tabular-nums text-slate-900 dark:text-white">
                    {summary.activeClients}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Owed / mo</p>
                  <p className="mt-0.5 font-bold tabular-nums text-primary">
                    {formatCents(summary.monthlyCommissionCents)}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
