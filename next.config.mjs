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
  outputFileTracingIncludes: {
    "/api/sale-sticker/animate": ["./node_modules/**/ffmpeg-static/ffmpeg"],
    "/api/cron/kixie-call-summary": ["./node_modules/**/ffmpeg-static/ffmpeg"],
    "/api/queue/kixie-call-summary": ["./node_modules/**/ffmpeg-static/ffmpeg"],
  },
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