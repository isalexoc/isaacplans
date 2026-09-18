/** @type {import('next').NextConfig} */
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();
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
  async redirects() {
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