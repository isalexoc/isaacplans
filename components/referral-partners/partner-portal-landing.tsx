"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  BarChart3,
  Handshake,
  Link2,
  LogIn,
  Mail,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const SUPPORT_EMAIL = "isaac@isaacplans.com";
const CRM_PHONE_TEL = "tel:+15404261804";
const CRM_PHONE_DISPLAY = "540-426-1804";

/** Positional icons for `partnerPortal.features.items`. */
const FEATURE_ICONS: LucideIcon[] = [Link2, Users, Handshake, Wallet];

/**
 * The signed-out face of /partner (ES: /socio).
 *
 * Every partner gets a per-company referral page at /partners/<slug>, but that one is aimed at
 * their CLIENTS. This is the one address a partner themselves can be told once and remember —
 * it explains the program, shows what the dashboard holds, and gets them signed in.
 *
 * Sign-in is a Clerk modal rather than a link: this app has no /sign-in route, and bouncing a
 * partner to a dead URL is exactly the failure this page exists to prevent.
 */
export default function PartnerPortalLanding() {
  const t = useTranslations("partnerPortal");
  const features = t.raw("features.items") as { title: string; body: string }[];
  const steps = t.raw("steps.items") as { title: string; body: string }[];

  return (
    <main className="bg-white dark:bg-slate-950">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-white to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary sm:text-sm">
              <Handshake className="h-4 w-4 flex-shrink-0" />
              {t("badge")}
            </span>

            <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
              {t("title")}
            </h1>

            <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
              {t("subtitle")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-bold text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
                >
                  <LogIn className="h-4 w-4" />
                  {t("signIn")}
                </button>
              </SignInButton>
              <a
                href="#how"
                className="inline-flex items-center justify-center rounded-xl border-2 border-slate-300 px-6 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t("howCta")}
              </a>
            </div>

            {/* The single most common support question this page can pre-empt. */}
            <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">{t("signInNote")}</p>
          </div>

          {/* A mocked dashboard rather than a stock photo — it shows what they actually get.
              Explicitly labelled as an example so the numbers are never mistaken for theirs. */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {t("preview.heading")}
              </p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {t("preview.badge")}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                  {t("preview.earnings")}
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">$162.00</p>
                <p className="text-xs text-white/75">{t("preview.perMonth")}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t("preview.clients")}
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                  8
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("preview.people", { count: 21 })}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {[
                { name: "María R.", members: 4, amount: "$24.00" },
                { name: "Juan P.", members: 1, amount: "$7.75" },
                { name: "Familia G.", members: 5, amount: "$30.50" },
              ].map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-200">{row.name}</span>
                  <span className="text-xs text-slate-400">
                    {t("preview.members", { count: row.members })}
                  </span>
                  <span className="font-semibold tabular-nums text-primary">{row.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── What's inside ── */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            {t("features.label")}
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {t("features.title")}
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = FEATURE_ICONS[index] ?? BarChart3;
            return (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {feature.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How the partnership works ── */}
      <section
        id="how"
        className="scroll-mt-8 border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40"
      >
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              {t("steps.label")}
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {t("steps.title")}
            </h2>
          </div>

          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
                  {index + 1}
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Two doors: sign in, or ask to become a partner ── */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-7 text-white">
            <h3 className="text-xl font-extrabold">{t("existing.title")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/90">{t("existing.body")}</p>
            <SignInButton mode="modal">
              <button
                type="button"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary shadow-sm transition-transform hover:scale-[1.02]"
              >
                <LogIn className="h-4 w-4" />
                {t("signIn")}
              </button>
            </SignInButton>
            <p className="mt-3 text-xs text-white/75">
              {t("existing.noAccount")}{" "}
              <SignUpButton mode="modal">
                <button type="button" className="font-semibold underline underline-offset-2">
                  {t("existing.createAccount")}
                </button>
              </SignUpButton>
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {t("prospective.title")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t("prospective.body")}
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-slate-900"
              >
                <Mail className="h-4 w-4" />
                {t("prospective.cta")}
              </a>
              <a
                href={CRM_PHONE_TEL}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {CRM_PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {t("footerNote")}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </section>
    </main>
  );
}
