import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import AiSetterClient from "@/components/admin/ai-setter/ai-setter-client";

export const metadata: Metadata = {
  title: "Asistente de Citas (IA) | Isaac Plans",
  description: "Bandeja de aprobación, leads y ajustes del asistente que responde y agenda.",
  robots: { index: false, follow: false },
};

/** Same shape as the store's message ids ("aim_<nanoid>"): anything else is ignored. */
const MESSAGE_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

type AiSetterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Isaac's panel for the AI Setter. `?m=<messageId>` (the Telegram card's "Abrir") scrolls to that
 * draft in the inbox and highlights it.
 */
export default async function AiSetterPage({ searchParams }: AiSetterPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  const { m } = await searchParams;
  const focusMessageId = typeof m === "string" && MESSAGE_ID_RE.test(m) ? m : null;

  return <AiSetterClient focusMessageId={focusMessageId} />;
}
