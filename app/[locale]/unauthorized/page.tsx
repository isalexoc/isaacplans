import { auth, currentUser } from "@clerk/nextjs/server";
import { isPlatformAdminMetadata } from "@/lib/tenancy/agent-linking";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import {
  ogLocaleOf,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { BlogUserAuth } from "@/components/blog-user-auth";

/* ───────── SEO ───────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "unauthorized.meta" });

  const title = t("title", { defaultValue: "Access Denied" });
  const description = t("description", { defaultValue: "You don't have permission to access this page." });

  const canonical = `/${locale}/unauthorized`;
  const ogLocale = ogLocaleOf(locale);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        "en-US": "/en/unauthorized",
        "es-ES": "/es/unauthorized",
        "x-default": "/en/unauthorized",
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      alternateLocale: ogLocale === "en_US" ? ["es_ES"] : ["en_US"],
      type: "website",
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function UnauthorizedPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const { userId } = await auth();
  
  // If user is authenticated, check if they're admin
  if (userId) {
    const user = await currentUser();
    const isAdmin = isPlatformAdminMetadata(user?.publicMetadata);
    
    // If admin, redirect to presentations page
    if (isAdmin) {
      redirect(`/${locale}/presentations`);
    }
  }
  
  const t = await getTranslations({ locale, namespace: "unauthorized" });
  
  return (
    <div className="container mx-auto px-4 py-16 min-h-screen">
      {/* User Auth Component */}
      <div className="flex justify-end mb-6">
        <BlogUserAuth />
      </div>

      <div className="text-center flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="max-w-md mx-auto">
          <div className="mb-6">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              {t("title", { defaultValue: "Access Denied" })}
            </h1>
            <p className="text-muted-foreground mb-8">
              {t("message", { defaultValue: "You don't have permission to access this page." })}
            </p>
          </div>
          
          <div className="space-y-4">
            <Button asChild className="w-full">
              <Link href={`/${locale}`}>
                {t("backToHome", { defaultValue: "Return to Home" })}
              </Link>
            </Button>
            
            <p className="text-sm text-muted-foreground">
              {t("helpText", { defaultValue: "If you believe this is an error, please contact support." })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

