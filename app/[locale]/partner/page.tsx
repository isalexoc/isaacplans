import type { Metadata } from "next";
import Image from "next/image";
import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Users, UserCheck, TrendingUp, Wallet, HandCoins, CalendarClock } from "lucide-react";
import { PartnerShareLinks } from "@/components/referral-partners/partner-link-copy";
import { partnerPortalOgImage } from "@/lib/referral-partners/images";
import PartnerNoAccess from "@/components/referral-partners/partner-no-access";
import PartnerPortalLanding from "@/components/referral-partners/partner-portal-landing";
import { getPartnerByEmail, getPartnerDashboard } from "@/lib/referral-partners/server";
import {
  bpsToPercentLabel,
  commissionCents,
  formatCents,
  type ReferralClientStatus,
  type ReferralLeadStatus,
} from "@/lib/referral-partners/types";
import { routing } from "@/i18n/routing";

const ISAAC_LOGO =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_120,h_120,c_fill,g_auto/isaacplanslogo_tkraak.png";

const SUPPORT_EMAIL = "isaac@isaacplans.com";

/** Reads live partner data on every request — a dashboard showing stale earnings is worse than slow. */
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const { userId } = await auth();

  // Signed out this is a real marketing page for prospective partners, so let it be indexed.
  // Signed in it is somebody's earnings, so it must not be. Same split as the sale-sticker tool.
  const namespace = userId ? "partnerDashboard.metadata" : "partnerPortal.metadata";
  const t = await getTranslations({ locale: safeLocale, namespace });

  const title = t("title");
  const description = t("description");
  // Per-language share card — a partner sending this link to another partner should see a card
  // written in the language the link actually opens in.
  const ogImage = partnerPortalOgImage(safeLocale === "es" ? "es" : "en");

  return {
    title,
    description,
    robots: userId ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      siteName: "Isaac Plans Insurance",
      locale: safeLocale === "es" ? "es_ES" : "en_US",
      type: "website",
      images: [{ url: ogImage, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: ogImage, alt: title }],
    },
  };
}

function resolveSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.isaacplans.com"
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  emphasis = false,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  accent: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        emphasis
          ? "border-transparent text-white shadow-lg"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
      style={emphasis ? { backgroundImage: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` } : undefined}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`h-4 w-4 ${emphasis ? "text-white/80" : ""}`}
          style={emphasis ? undefined : { color: accent }}
        />
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${
            emphasis ? "text-white/80" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {label}
        </span>
      </div>
      <p
        className={`mt-2 text-2xl font-extrabold tabular-nums ${
          emphasis ? "text-white" : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className={`mt-1 text-xs ${emphasis ? "text-white/75" : "text-slate-500 dark:text-slate-400"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export default async function PartnerDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const moneyLocale = safeLocale === "es" ? "es" : "en";
  const t = await getTranslations({ locale: safeLocale, namespace: "partnerDashboard" });

  // This route is intentionally public — see the note in middleware.ts. Signed out, it is the
  // partner portal's front door: what the program is, what the dashboard holds, and a way in.
  const user = await currentUser();
  if (!user) return <PartnerPortalLanding />;

  // Check every verified address on the Clerk account, not just the primary — partners sign up
  // with whatever address they happen to be logged into, and we'd rather match than lock them out.
  const emails = user.emailAddresses.map((e) => e.emailAddress).filter(Boolean);
  let partner = null;
  for (const email of emails) {
    partner = await getPartnerByEmail(email);
    if (partner) break;
  }

  if (!partner) {
    // Almost always the partner signed in with a second address, so this screen shows which
    // account they're in and offers a one-click switch rather than only explaining the problem.
    return (
      <PartnerNoAccess
        email={user.primaryEmailAddress?.emailAddress ?? emails[0] ?? ""}
        name={[user.firstName, user.lastName].filter(Boolean).join(" ")}
        imageUrl={user.imageUrl ?? ""}
        redirectUrl={`/${safeLocale}/${safeLocale === "es" ? "socio" : "partner"}`}
      />
    );
  }

  if (partner.status !== "active") {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("paused.title")}</h1>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{t("paused.body")}</p>
        <p className="mt-6 text-sm text-slate-500">{t("questions", { email: SUPPORT_EMAIL })}</p>
      </main>
    );
  }

  const dashboard = await getPartnerDashboard(partner.id);
  if (!dashboard) redirect(`/${safeLocale}`);

  const { leads, clients, summary } = dashboard;
  const accent = partner.accentColor;
  const rateLabel = bpsToPercentLabel(partner.commissionBps);

  const leadStatusLabel: Record<ReferralLeadStatus, string> = {
    new: t("leads.statusNew"),
    contacted: t("leads.statusContacted"),
    closed: t("leads.statusClosed"),
    lost: t("leads.statusLost"),
  };
  const clientStatusLabel: Record<ReferralClientStatus, string> = {
    active: t("clients.statusActive"),
    pending: t("clients.statusPending"),
    cancelled: t("clients.statusCancelled"),
  };

  const dateFormatter = new Intl.DateTimeFormat(safeLocale === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formatDate = (iso: string | null) => (iso ? dateFormatter.format(new Date(iso)) : "—");

  // Only leads still in play — enrolled ones appear in the clients table with their premium.
  const openLeads = leads.filter((lead) => lead.status === "new" || lead.status === "contacted");

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {partner.logoUrl ? (
              <Image
                src={partner.logoUrl}
                alt={partner.companyName}
                width={120}
                height={48}
                unoptimized
                className="h-12 w-auto max-w-[140px] object-contain"
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-extrabold text-white"
                style={{ backgroundColor: accent }}
              >
                {partner.companyName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                {t("greeting", { name: partner.contactName || partner.companyName })}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>
            </div>
          </div>
          {/* Clerk's own control: avatar, account management, and sign out. A partner who lands
              here on the wrong account needs a way off it from the dashboard too, not only from
              the "not linked" screen. */}
          <div className="flex items-center gap-4">
            <Image
              src={ISAAC_LOGO}
              alt="Isaac Plans Insurance"
              width={44}
              height={44}
              className="hidden h-11 w-11 rounded-lg object-contain sm:block"
            />
            <UserButton
              appearance={{ elements: { avatarBox: "h-10 w-10" } }}
              afterSignOutUrl={`/${safeLocale}/${safeLocale === "es" ? "socio" : "partner"}`}
            />
          </div>
        </div>

        {/* Referral link */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t("yourLink")}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{t("yourLinkHelp")}</p>
          <div className="mt-4">
            <PartnerShareLinks
              slug={partner.slug}
              siteUrl={resolveSiteUrl()}
              accentColor={accent}
              spanishLabel={t("linkSpanish")}
              englishLabel={t("linkEnglish")}
            />
          </div>
        </section>

        {/* Earnings — the number she actually opens this page for, given top billing */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={HandCoins}
            label={t("stats.monthlyCommission")}
            value={formatCents(summary.monthlyCommissionCents, moneyLocale)}
            hint={t("stats.commissionRate", { rate: rateLabel })}
            accent={accent}
            emphasis
          />
          <StatCard
            icon={CalendarClock}
            label={t("stats.annualCommission")}
            value={formatCents(summary.annualCommissionCents, moneyLocale)}
            accent={accent}
          />
          <StatCard
            icon={Wallet}
            label={t("stats.monthlyPremium")}
            value={formatCents(summary.monthlyPremiumCents, moneyLocale)}
            accent={accent}
          />
          <StatCard
            icon={UserCheck}
            label={t("stats.activeClients")}
            value={String(summary.activeClients)}
            hint={`${summary.totalMembers} · ${t("stats.members")}`}
            accent={accent}
          />
          <StatCard
            icon={Users}
            label={t("stats.referrals")}
            value={String(summary.totalLeads)}
            hint={`${summary.openLeads} · ${t("stats.inProgress")}`}
            accent={accent}
          />
          <StatCard
            icon={TrendingUp}
            label={t("stats.conversion")}
            value={`${summary.conversionRate}%`}
            hint={`${summary.closedLeads} · ${t("stats.closed")}`}
            accent={accent}
          />
        </section>

        {/* Enrolled clients */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-6 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t("clients.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t("clients.subtitle", { rate: rateLabel })}
            </p>
          </div>

          {clients.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 dark:text-slate-400">{t("clients.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="px-6 py-3 font-semibold">{t("clients.client")}</th>
                    <th className="px-6 py-3 text-center font-semibold">{t("clients.members")}</th>
                    <th className="px-6 py-3 text-right font-semibold">{t("clients.premium")}</th>
                    <th className="px-6 py-3 text-right font-semibold">{t("clients.commission")}</th>
                    <th className="px-6 py-3 font-semibold">{t("clients.effectiveDate")}</th>
                    <th className="px-6 py-3 font-semibold">{t("clients.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr
                      key={client.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                    >
                      <td className="px-6 py-3.5 font-medium text-slate-900 dark:text-white">
                        {client.firstName} {client.lastName}
                      </td>
                      <td className="px-6 py-3.5 text-center tabular-nums text-slate-600 dark:text-slate-300">
                        {client.memberCount}
                      </td>
                      <td className="px-6 py-3.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatCents(client.monthlyPremiumCents, moneyLocale)}
                      </td>
                      <td
                        className="px-6 py-3.5 text-right font-semibold tabular-nums"
                        style={{ color: accent }}
                      >
                        {client.status === "active"
                          ? formatCents(
                              commissionCents(client.monthlyPremiumCents, client.commissionBps),
                              moneyLocale
                            )
                          : "—"}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">
                        {client.effectiveDate ?? "—"}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            client.status === "active"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : client.status === "pending"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {clientStatusLabel[client.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold dark:border-slate-700 dark:bg-slate-800/50">
                    <td className="px-6 py-4 text-slate-900 dark:text-white">
                      {t("clients.total")}
                    </td>
                    <td className="px-6 py-4 text-center tabular-nums text-slate-900 dark:text-white">
                      {summary.totalMembers}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-slate-900 dark:text-white">
                      {formatCents(summary.monthlyPremiumCents, moneyLocale)}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums" style={{ color: accent }}>
                      {formatCents(summary.monthlyCommissionCents, moneyLocale)}
                    </td>
                    <td className="px-6 py-4" />
                    <td className="px-6 py-4" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Referrals still in progress */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-6 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("leads.title")}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("leads.subtitle")}</p>
          </div>

          {openLeads.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 dark:text-slate-400">{t("leads.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="px-6 py-3 font-semibold">{t("leads.name")}</th>
                    <th className="px-6 py-3 font-semibold">{t("leads.date")}</th>
                    <th className="px-6 py-3 font-semibold">{t("leads.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {openLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                    >
                      <td className="px-6 py-3.5 font-medium text-slate-900 dark:text-white">
                        {lead.firstName} {lead.lastName}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">
                        {formatDate(lead.createdAt)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                          {leadStatusLabel[lead.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {t("questions", { email: SUPPORT_EMAIL })}
        </p>
      </div>
    </main>
  );
}
