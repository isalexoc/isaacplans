/** @type {import('next').NextConfig} */
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// The product domain's deployment (APP_SURFACE=product, the second Vercel project; see
// lib/tenancy/surface.ts): agents' client pages only. Same parsing as surface.ts, so a typo keeps
// Isaac's site as it is. Read at BUILD time too (the page frame below), so the product project
// needs it for its builds as well as at runtime.
const PRODUCT_SURFACE = (process.env.APP_SURFACE ?? "").trim().toLowerCase() === "product";

// The product build's page frame (components/site-shell/active-shell.ts): every import of Isaac's
// frame becomes the product's, so nothing his layout imports is in that build.
const ACTIVE_SHELL_REQUEST = /^@\/components\/site-shell\/active-shell$/;
const PRODUCT_SHELL_FILE = fileURLToPath(new URL("./components/site-shell/product-shell.tsx", import.meta.url));

// The only files with a dot in their path that the product domain serves (its middleware never sees
// such paths: the matcher skips "files"). Next's own assets, Vercel's, the application's API calls
// (checked by the /api rule above it), the neutral icon, robots and the sitemap, and Impact's art by
// name: never the rest of public/ (Isaac's photo, logo, vCard).
const PRODUCT_DOTTED_PATHS_ALLOWED = [
  "_next/",
  "_vercel/",
  "api/",
  "platform-icon\\.svg$",
  "favicon\\.ico$",
  "robots\\.txt$",
  "sitemap\\.xml$",
  "images/impact/impact-health-sharing-logo\\.png$",
  "images/impact/presentation/(?:logo-white\\.png|logo-color\\.png|member-card-front\\.jpg|member-card-back\\.jpg|og-impact\\.jpg|people-helping-people\\.jpg|welcome-mother-daughter\\.jpg)$",
];

// On the product domain every response is unindexed, unframeable and sends no Referer (middleware
// sets the same on the pages it handles: lib/tenancy/product-routes.ts PRODUCT_RESPONSE_HEADERS).
const PRODUCT_HEADERS = [
  { key: "x-private-page", value: "1" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig = {
  // Keep native-binary packages out of the server bundle so their binary paths
  // (computed from __dirname in node_modules) resolve correctly in dev and prod.
  serverExternalPackages: ["ffmpeg-static"],
  // Vercel's file tracing doesn't auto-include the ffmpeg binary (it's referenced
  // as a runtime path string, not an import), so force it into each function that
  // shells out to ffmpeg. The glob covers pnpm's nested node_modules layout.
  //
  // EVERY route that can transitively reach ffmpeg has to be listed, or it fails at
  // runtime with `spawn .../ffmpeg-static/ffmpeg ENOENT` — and only on Vercel, since
  // locally the binary is simply there in node_modules. Three entry points reach it:
  //   lib/whisper-transcribe-long.ts   (via lib/kixie-call-processor.ts)
  //   lib/social-media-studio/chroma-detect.ts (via video-job-processor.ts)
  //   lib/call-study/audio-redact.ts   (via lib/call-study/shareable.ts)
  // When a route starts importing one of those, add it here in the same commit.
  outputFileTracingIncludes: Object.fromEntries(
    [
      // Direct ffmpeg use
      "/api/sale-sticker/animate",
      // Kixie call summaries — Whisper chunking for recordings over the 25 MB API cap
      "/api/cron/kixie-call-summary",
      "/api/queue/kixie-call-summary",
      "/api/cron/queue-reconcile",
      "/api/webhooks/kixie/calls",
      // Social Media Studio — chroma-key detection during video assembly
      "/api/queue/social-video",
      "/api/admin/social-media-studio/history/[id]/aroll",
      "/api/admin/social-media-studio/history/[id]/generate-music",
      "/api/admin/social-media-studio/history/[id]/generate-scene-clip",
      "/api/admin/social-media-studio/history/[id]/generate-video",
      "/api/admin/social-media-studio/history/[id]/generate-video-images",
      // Call Study — beeping the sensitive moments out of a shareable copy
      "/api/queue/call-study-shareable",
      "/api/admin/call-study/recordings/[id]/shareable",
    ].map((route) => [
      route,
      [
        // Both names on purpose. The binary is `ffmpeg` on Linux (which is what Vercel builds and
        // runs) and `ffmpeg.exe` on Windows. With only the Linux name listed, a local build traces
        // nothing and the config looks broken when you check it — which is exactly how a missing
        // route here goes unnoticed until it throws ENOENT in production. A glob that matches
        // nothing is simply ignored, so listing both costs nothing and makes this verifiable on
        // either machine. See scripts/check-ffmpeg-tracing.ts.
        "./node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg",
        "./node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg.exe",
      ],
    ])
  ),
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Browser protections on every response. HTTPS is already forced by Vercel (HSTS, 2 years).
  // Framing is limited only on pages with a client's data (middleware + lib/private-pages.ts), so
  // Sanity's visual editing and any embed of a public page keep working. Nothing on the site uses
  // geolocation, payments or USB; camera and microphone stay available to the site itself.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: PRODUCT_SURFACE ? "no-referrer" : "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
          ...(PRODUCT_SURFACE ? PRODUCT_HEADERS : []),
        ],
      },
    ];
  },
  // The product domain:
  //  - its tab icon is a neutral one (public/platform-icon.svg), also for browsers that ask for
  //    /favicon.ico, which is Isaac's on his site (app/favicon.ico);
  //  - only the client pages' own APIs exist there: the application's (/api/intake/health-alternative/…,
  //    which middleware also checks), the secure link's (/api/intake-capture/…) and the guide's
  //    prices (/api/impact/quote). Every other API route answers 404, including the ones outside the
  //    middleware matcher (webhooks, crons, queues, forms that write to Isaac's CRM);
  //  - any other path with a dot in it is a 404 unless PRODUCT_DOTTED_PATHS_ALLOWED lists it: the
  //    middleware matcher skips such paths, so without this /en/iul/intake/a.b would draw Isaac's
  //    IUL page and /isaac-orraiz.vcf would serve his card.
  async rewrites() {
    return PRODUCT_SURFACE
      ? {
          beforeFiles: [
            { source: "/favicon.ico", destination: "/platform-icon.svg" },
            {
              source: "/api/:path((?!intake/health-alternative/|intake-capture/|impact/quote$).*)",
              destination: "/api/product-not-found",
            },
            {
              source: `/:path((?!${PRODUCT_DOTTED_PATHS_ALLOWED.join("|")}).*\\..*)`,
              destination: "/api/product-not-found",
            },
          ],
          afterFiles: [],
          fallback: [],
        }
      : [];
  },
  // The page frame is picked when the app is built (components/site-shell/active-shell.ts). Isaac's
  // build is untouched; the product build swaps in the product's frame, under its own webpack cache
  // version so it never reuses modules a main build cached on the same machine (and vice versa).
  webpack(config, { webpack }) {
    if (PRODUCT_SURFACE) {
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(ACTIVE_SHELL_REQUEST, PRODUCT_SHELL_FILE));
      if (config.cache && typeof config.cache === "object") {
        config.cache.version = `${config.cache.version ?? ""}|app-surface=product`;
      }
    }
    return config;
  },
  async redirects() {
    // Isaac's old addresses mean nothing on the product domain.
    if (PRODUCT_SURFACE) return [];
    return [
      {
        source: "/:locale/consumer-guides",
        destination: "/:locale/lead-magnets",
        permanent: true,
      },
      {
        source: "/:locale/consumer-guides/:path*",
        destination: "/:locale/lead-magnets",
        permanent: true,
      },
      {
        source: "/:locale/guias-para-consumidores",
        destination: "/:locale/imanes-de-leads",
        permanent: true,
      },
      {
        source: "/:locale/guias-para-consumidores/:path*",
        destination: "/:locale/imanes-de-leads",
        permanent: true,
      },
      // The LegalShield funnel is Spanish-only. Its routing entries carry the same slug in both
      // locales (next-intl requires an entry per locale), so without this an /en/ URL would render
      // Spanish copy under an English prefix — two addresses for one page, splitting the Meta
      // attribution and the analytics. One canonical ad destination instead.
      {
        source: "/en/legal-shield/:path*",
        destination: "/es/legal-shield/:path*",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/isaacdev/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/**',
      },
      // Google reviewer profile photos (Places API authorAttribution.photoUri)
      ...['lh3', 'lh4', 'lh5', 'lh6'].map((sub) => ({
        protocol: 'https',
        hostname: `${sub}.googleusercontent.com`,
        pathname: '/**',
      })),
    ],
  },
};

export default withNextIntl(nextConfig);