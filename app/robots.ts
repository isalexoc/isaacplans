// app/robots.ts
import type { MetadataRoute } from "next";

const HOST = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
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
