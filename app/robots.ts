// app/robots.ts
import type { MetadataRoute } from "next";
import { isProductSurface } from "@/lib/tenancy/surface";

const HOST = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  // The product domain (APP_SURFACE=product): crawlers may fetch its pages, so they can read the
  // noindex every response carries; nothing there is listed, and nothing of Isaac's is named.
  if (isProductSurface()) {
    return { rules: [{ userAgent: "*", allow: "/" }] };
  }

  const isProd = process.env.NODE_ENV === "production";

  return {
    // Crawl rules
    rules: isProd
      ? [
          {
            userAgent: "*",
            allow: "/",
            // Keep low-value/system routes out of the index
            disallow: [
              "/_next/", // framework internals
              "/api/", // API endpoints
              "/404",
              "/500", // error pages
            ],
          },
        ]
      : [
          // On non-prod, block everything so staging/dev never gets indexed
          { userAgent: "*", disallow: "/" },
        ],

    // Point bots to your sitemap (prod only)
    sitemap: isProd ? [`${HOST}/sitemap.xml`] : [],

    // (Optional) Host directive used by some crawlers
    host: HOST,
  };
}
