"use client";

import { SignOutButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { LogOut, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";

type Props = {
  /** The address they actually signed in with — the whole point of this screen. */
  email: string;
  name: string;
  imageUrl: string;
  /** Where Clerk returns them after signing out: back here, ready to sign in as someone else. */
  redirectUrl: string;
};

/**
 * Shown when a signed-in Clerk account does not match any partner record.
 *
 * The likeliest cause by far is the partner having two addresses and picking the wrong one, so
 * this screen has to do more than explain — it has to show WHICH account they are currently in
 * and give them a one-click way out. Without that they are stuck: the site looks signed-in,
 * nothing tells them how to switch, and the only visible fix is emailing us.
 */
export default function PartnerNoAccess({ email, name, imageUrl, redirectUrl }: Props) {
  const t = useTranslations("partnerDashboard.noAccess");

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
        <ShieldAlert className="h-7 w-7 text-amber-600 dark:text-amber-400" />
      </div>

      <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">{t("title")}</h1>

      {/* The account they're in, shown rather than described — this is what makes the mistake
          obvious at a glance. Plain <img>: Clerk's CDN isn't in next.config remotePatterns. */}
      <div className="mt-6 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left dark:border-slate-800 dark:bg-slate-900">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
            {(name || email).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          {name && (
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
          )}
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{email}</p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {t("body", { email })}
      </p>

      <p className="mt-3 text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200">
        {t("wrongAccount")}
      </p>

      <div className="mt-6 flex w-full flex-col gap-3">
        <SignOutButton redirectUrl={redirectUrl}>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            {t("signOut")}
          </button>
        </SignOutButton>

        <Link
          href="/"
          className="inline-flex w-full items-center justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {t("cta")}
        </Link>
      </div>
    </main>
  );
}
