import { ImageResponse } from "next/og";
import cloudinary from "@/config/cloudinary";
import type { LeadMagnetOutline, PromoImages } from "./types";

// ─── Font cache (persists across requests in the same process) ────────────────
// satori requires TTF/OTF — not WOFF2. Use an old IE UA so Google Fonts
// returns a truetype URL instead of woff2.

let cachedFontBold: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
  if (cachedFontBold) return cachedFontBold;

  const cssRes = await fetch(
    "https://fonts.googleapis.com/css2?family=Inter:wght@900&display=swap",
    {
      headers: {
        "User-Agent": "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)",
      },
    }
  );
  if (!cssRes.ok) throw new Error(`Google Fonts CSS fetch failed: ${cssRes.status}`);
  const css = await cssRes.text();

  const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!fontUrl) throw new Error("Could not parse font URL from Google Fonts CSS response");

  const fontRes = await fetch(fontUrl);
  if (!fontRes.ok) throw new Error(`Font file fetch failed: ${fontRes.status}`);
  cachedFontBold = await fontRes.arrayBuffer();
  return cachedFontBold;
}

// ─── Locale labels ─────────────────────────────────────────────────────────────

const ACCENT_LABELS: Record<"en" | "es", string> = {
  en: "FREE GUIDE",
  es: "GUÍA GRATUITA",
};

// ─── Card JSX templates ────────────────────────────────────────────────────────

function SquareCard({
  title,
  coverUrl,
  accentLabel,
}: {
  title: string;
  coverUrl: string;
  accentLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 1080,
        height: 1080,
        backgroundColor: "#0e1a2b",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter",
      }}
    >
      {/* Blue diagonal stripe — right edge accent */}
      <div
        style={{
          position: "absolute",
          right: -120,
          top: -50,
          width: 380,
          height: 1200,
          backgroundColor: "#0077B6",
          transform: "skewX(-8deg)",
          opacity: 0.9,
        }}
      />

      {/* Subtle secondary stripe for depth */}
      <div
        style={{
          position: "absolute",
          right: 180,
          top: -50,
          width: 24,
          height: 1200,
          backgroundColor: "#00B4D8",
          transform: "skewX(-8deg)",
          opacity: 0.6,
        }}
      />

      {/* Top header: FREE GUIDE / GUÍA GRATUITA */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          paddingTop: 56,
          paddingBottom: 44,
          zIndex: 1,
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 88,
            fontWeight: 900,
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          {accentLabel}
        </span>
      </div>

      {/* Main content row */}
      <div
        style={{
          display: "flex",
          flex: 1,
          paddingLeft: 60,
          paddingRight: 70,
          gap: 48,
          alignItems: "center",
          zIndex: 1,
        }}
      >
        {/* Cover image panel */}
        <div
          style={{
            display: "flex",
            width: 490,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt="guide cover"
            style={{
              width: 430,
              height: 570,
              objectFit: "cover",
              borderRadius: 14,
              transform: "rotate(-4deg)",
              boxShadow: "0 24px 72px rgba(0,0,0,0.65)",
            }}
          />
        </div>

        {/* Title panel */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <span
            style={{
              color: "#C8A96E",
              fontSize: 62,
              fontWeight: 900,
              lineHeight: 1.1,
              textTransform: "uppercase",
            }}
          >
            {title}
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            isaacplans.com
          </span>
        </div>
      </div>

      {/* Bottom spacer */}
      <div style={{ display: "flex", height: 60 }} />
    </div>
  );
}

function LandscapeCard({
  title,
  coverUrl,
  accentLabel,
}: {
  title: string;
  coverUrl: string;
  accentLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        width: 1200,
        height: 630,
        backgroundColor: "#0e1a2b",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter",
        alignItems: "center",
      }}
    >
      {/* Blue diagonal stripe */}
      <div
        style={{
          position: "absolute",
          right: -80,
          top: -50,
          width: 300,
          height: 800,
          backgroundColor: "#0077B6",
          transform: "skewX(-8deg)",
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 160,
          top: -50,
          width: 18,
          height: 800,
          backgroundColor: "#00B4D8",
          transform: "skewX(-8deg)",
          opacity: 0.6,
        }}
      />

      {/* Cover image */}
      <div
        style={{
          display: "flex",
          width: 480,
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          paddingLeft: 48,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt="guide cover"
          style={{
            width: 340,
            height: 450,
            objectFit: "cover",
            borderRadius: 12,
            transform: "rotate(-3deg)",
            boxShadow: "0 16px 56px rgba(0,0,0,0.65)",
          }}
        />
      </div>

      {/* Right panel: label + title */}
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          gap: 16,
          paddingRight: 72,
          zIndex: 1,
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 38,
            fontWeight: 900,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          {accentLabel}
        </span>
        <span
          style={{
            color: "#C8A96E",
            fontSize: 52,
            fontWeight: 900,
            lineHeight: 1.1,
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        <span
          style={{
            color: "rgba(255,255,255,0.35)",
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginTop: 8,
          }}
        >
          isaacplans.com
        </span>
      </div>
    </div>
  );
}

// ─── Render + upload helpers ───────────────────────────────────────────────────

async function renderCardToBuffer(
  element: React.ReactElement,
  width: number,
  height: number,
  fontData: ArrayBuffer
): Promise<Buffer> {
  const response = new ImageResponse(element, {
    width,
    height,
    fonts: [{ name: "Inter", data: fontData, weight: 900, style: "normal" }],
  });
  return Buffer.from(await response.arrayBuffer());
}

async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId: string
): Promise<string> {
  const b64 = buffer.toString("base64");
  const uploaded = await cloudinary.uploader.upload(`data:image/png;base64,${b64}`, {
    folder,
    public_id: publicId,
    resource_type: "image",
  });
  return uploaded.secure_url;
}

// ─── Public export ─────────────────────────────────────────────────────────────

export async function generatePromoImages(
  outline: LeadMagnetOutline,
  coverUrl: string,
  locale: "en" | "es"
): Promise<PromoImages> {
  const fontData = await loadFont();
  const accentLabel = ACCENT_LABELS[locale];
  const { title, category } = outline;
  const ts = Date.now();
  const folder = `lead-magnets/${category}/promo/${locale}`;

  const [squareBuffer, landscapeBuffer] = await Promise.all([
    renderCardToBuffer(
      <SquareCard title={title} coverUrl={coverUrl} accentLabel={accentLabel} />,
      1080,
      1080,
      fontData
    ),
    renderCardToBuffer(
      <LandscapeCard title={title} coverUrl={coverUrl} accentLabel={accentLabel} />,
      1200,
      630,
      fontData
    ),
  ]);

  const [squareUrl, landscapeUrl] = await Promise.all([
    uploadBufferToCloudinary(squareBuffer, folder, `square-${ts}`),
    uploadBufferToCloudinary(landscapeBuffer, folder, `landscape-${ts}`),
  ]);

  return { square: squareUrl, landscape: landscapeUrl };
}
