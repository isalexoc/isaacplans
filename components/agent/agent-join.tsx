"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import type { AgentAreaLocale } from "@/lib/tenancy/agent-area-routes";

const WORDS = {
  en: {
    title: "Create your agent account",
    body: "Your invitation is ready. Create your sign-in with the email it was sent to.",
    signInTitle: "Sign in to your agent account",
  },
  es: {
    title: "Cree su cuenta de agente",
    body: "Su invitación está lista. Cree su acceso con el correo al que llegó.",
    signInTitle: "Entre a su cuenta de agente",
  },
} as const;

/**
 * The one page the agent area shows signed out: a Clerk invitation landing on /{l}/agent with its
 * `__clerk_ticket`. Clerk's own sign-up reads the ticket from the address (the invited email comes
 * filled in, and the invitation's `publicMetadata.agentId` lands on the new account), then sends the
 * agent back to the dashboard, which links the account on first use. `status` is Clerk's
 * `__clerk_status`: "sign_in" when an account already exists for the ticket.
 */
export default function AgentJoin({
  locale,
  status,
  redirectUrl,
}: {
  locale: AgentAreaLocale;
  status: string | null;
  redirectUrl: string;
}) {
  const w = WORDS[locale];
  const signIn = status === "sign_in";
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-10">
      <h1 className="text-center text-2xl font-bold text-[#0b2a4a] dark:text-white">{signIn ? w.signInTitle : w.title}</h1>
      {!signIn && <p className="mt-2 text-center text-sm text-[#56657a] dark:text-gray-400">{w.body}</p>}
      <div className="mt-6">
        {signIn ? (
          <SignIn routing="hash" forceRedirectUrl={redirectUrl} />
        ) : (
          <SignUp routing="hash" forceRedirectUrl={redirectUrl} signInForceRedirectUrl={redirectUrl} />
        )}
      </div>
    </div>
  );
}
