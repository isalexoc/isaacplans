import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Headphones } from "lucide-react";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="mx-auto w-full max-w-md text-center space-y-6">
        {/* 404 badge */}
        <div className="inline-flex select-none items-center justify-center rounded-full border px-4 py-1 text-xs text-muted-foreground">
          {t("badge")}
        </div>

        {/* Big number */}
        <h1
          className="text-6xl font-extrabold text-transparent bg-clip-text
                     bg-gradient-to-r from-[#0ea5e9] to-[#2563eb] tracking-tight"
          aria-label="404"
        >
          404
        </h1>

        {/* Headline & copy */}
        <h2 className="text-2xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground">{t("description")}</p>

        {/* Actions */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link href="/">
            <Button className="w-full">
              <Home className="mr-2 h-4 w-4" />
              {t("backHome")}
            </Button>
          </Link>

          <Link href="/contact">
            <Button variant="secondary" className="w-full">
              <Headphones className="mr-2 h-4 w-4" />
              {t("contact")}
            </Button>
          </Link>
        </div>

        {/* Small hint */}
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
    </main>
  );
}
