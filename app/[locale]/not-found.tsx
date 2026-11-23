// app/[locale]/not-found.tsx
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { agentAreaLocale, agentAreaPath, parseShellHeader, SHELL_HEADER } from "@/lib/tenancy/agent-area-routes";
import { isProductSurface } from "@/lib/tenancy/surface";

export default async function NotFoundPage() {
  const t = await getTranslations("NotFoundPage");

  // The product domain has no home or contact page of its own to send anyone to (and none of
  // Isaac's): just say so.
  if (isProductSurface()) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="mx-auto w-full max-w-md space-y-4 text-center">
          <p className="text-6xl font-extrabold text-[#0b2a4a] dark:text-white">404</p>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </main>
    );
  }

  // Inside the agent area's own frame: back to the agent's applications, never to Isaac's pages.
  if (parseShellHeader((await headers()).get(SHELL_HEADER)) !== "site") {
    const locale = agentAreaLocale(await getLocale());
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="mx-auto w-full max-w-md space-y-4 text-center">
          <p className="text-6xl font-extrabold text-[#0b2a4a] dark:text-white">404</p>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
          <a href={agentAreaPath(locale)} className="inline-flex font-semibold text-brand underline underline-offset-2">
            {locale === "es" ? "Volver a sus solicitudes" : "Back to your applications"}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="mx-auto w-full max-w-md text-center space-y-6">
        <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#0ea5e9] to-[#2563eb]">
          404
        </h1>
        <h2 className="text-2xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground">{t("description")}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link href="/">
            <Button className="w-full">
              <Home className="mr-2 h-4 w-4" />
              {t("backHome")}
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="secondary" className="w-full">
              {t("contact")}
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
