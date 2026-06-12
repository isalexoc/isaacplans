import { ImageResponse } from "next/og";
import cloudinary from "@/config/cloudinary";

// Replace insurance-specific words in headlines so the word "insurance"
// never appears on generated social media cards (EN or ES).
function sanitizeHeadline(text: string): string {
  return text
    // English — order matters: longer phrases first
    .replace(/\bfinal expense insurance\b/gi, "final expense plan")
    .replace(/\blife insurance\b/gi, "life protection plan")
    .replace(/\bhealth insurance\b/gi, "health plan")
    .replace(/\bdental insurance\b/gi, "dental benefits plan")
    .replace(/\bvision insurance\b/gi, "vision benefits plan")
    .replace(/\bhospital indemnity insurance\b/gi, "hospital benefits plan")
    .replace(/\bcancer insurance\b/gi, "cancer protection plan")
    .replace(/\bheart (?:and|&) stroke insurance\b/gi, "heart & stroke plan")
    .replace(/\bterm life insurance\b/gi, "life protection plan")
    .replace(/\bshort-term (?:health )?insurance\b/gi, "short-term health plan")
    .replace(/\baca insurance\b/gi, "ACA health plan")
    .replace(/\binsurance\b/gi, "plan")
    // Spanish
    .replace(/\bseguro de gastos finales\b/gi, "plan de gastos finales")
    .replace(/\bseguro de vida\b/gi, "plan de protección de vida")
    .replace(/\bseguro médico\b/gi, "plan de salud")
    .replace(/\bseguro dental\b/gi, "plan dental")
    .replace(/\bseguro\b/gi, "plan");
}

// ─── Font cache ────────────────────────────────────────────────────────────────
// iOS 7 Safari UA → Google Fonts returns WOFF (accepted by satori's opentype.js)
// Modern UA returns WOFF2, IE6 returns EOT — both rejected by satori

let cachedFontBold: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
  if (cachedFontBold) return cachedFontBold;

  const cssRes = await fetch(
    "https://fonts.googleapis.com/css2?family=Inter:wght@900&display=swap",
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 7_0 like Mac OS X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11A465 Safari/9537.53",
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

// ─── Category display labels ───────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  "final-expense":              "Final Expense Plans",
  "aca":                        "ACA Health Plans",
  "temporary-health-insurance": "Short-Term Health Plans",
  "dental-vision":              "Dental & Vision Plans",
  "hospital-indemnity":         "Hospital Benefits",
  "iul":                        "Life & Wealth Plans",
  "cancer-plans":               "Cancer Protection Plans",
  "heart-stroke":               "Heart & Stroke Plans",
  "tips-guides":                "Planning Tips",
  "news":                       "Benefits Update",
  "general":                    "Isaac Plans",
};

const LOGO_URL =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,h_80/isaacplanslogo_tkraak.png";

function getCategoryLabel(category: string): string {
  return (CATEGORY_LABELS[category] ?? "Isaac Plans").toUpperCase();
}

// ─── Card JSX templates ────────────────────────────────────────────────────────

function SocialSquareCard({
  headline,
  backgroundUrl,
  categoryLabel,
}: {
  headline: string;
  backgroundUrl: string;
  categoryLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        width: 1080,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter",
      }}
    >
      {/* Full-bleed background photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={backgroundUrl}
        alt=""
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1080,
          height: 1080,
          objectFit: "cover",
        }}
      />

      {/* Bottom gradient overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1080,
          height: 1080,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, transparent 30%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.92) 100%)",
        }}
      />

      {/* Top-right watermark: logo + brand name */}
      <div
        style={{
          position: "absolute",
          top: 32,
          right: 40,
          display: "flex",
          alignItems: "center",
          gap: 12,
          backgroundColor: "rgba(0,0,0,0.35)",
          borderRadius: 100,
          padding: "8px 20px 8px 10px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_URL} alt="logo" style={{ width: 36, height: 36, borderRadius: 100, objectFit: "cover" }} />
        <span
          style={{
            color: "rgba(255,255,255,0.90)",
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: 0.5,
          }}
        >
          Isaac Plans
        </span>
      </div>

      {/* Bottom content */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          padding: "0 64px 60px 64px",
        }}
      >
        {/* Category pill */}
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            backgroundColor: "#0077B6",
            borderRadius: 100,
            padding: "10px 24px",
            marginBottom: 20,
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 2,
            }}
          >
            {categoryLabel}
          </span>
        </div>

        {/* Headline */}
        <span
          style={{
            color: "white",
            fontSize: 68,
            fontWeight: 900,
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          {headline}
        </span>

        {/* Domain */}
        <span
          style={{
            color: "#00B4D8",
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          isaacplans.com
        </span>
      </div>
    </div>
  );
}

function SocialVerticalCard({
  headline,
  backgroundUrl,
  categoryLabel,
}: {
  headline: string;
  backgroundUrl: string;
  categoryLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        width: 1080,
        height: 1920,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter",
      }}
    >
      {/* Full-bleed background photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={backgroundUrl}
        alt=""
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1080,
          height: 1920,
          objectFit: "cover",
        }}
      />

      {/* Scrim 1 — narrow top vignette (y=0–380) so the watermark pill is
          readable against any photo without darkening the whole image */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1080,
          height: 380,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, transparent 100%)",
        }}
      />

      {/* Scrim 2 — focused content band (y=500–1120, i.e. bottom of safe zone).
          Photo is 100% clear above y=500 and below y=1120 (unsafe zone).
          Fades in from transparent → full dark in the first 28% of its height. */}
      <div
        style={{
          position: "absolute",
          top: 500,
          left: 0,
          width: 1080,
          height: 620,
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.88) 28%, rgba(0,0,0,0.92) 100%)",
        }}
      />

      {/* Watermark pill — top-right inside the top vignette zone */}
      <div
        style={{
          position: "absolute",
          top: 244,
          right: 52,
          display: "flex",
          alignItems: "center",
          gap: 14,
          backgroundColor: "rgba(0,0,0,0.40)",
          borderRadius: 100,
          padding: "10px 24px 10px 12px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_URL} alt="logo" style={{ width: 42, height: 42, borderRadius: 100, objectFit: "cover" }} />
        <span
          style={{
            color: "rgba(255,255,255,0.92)",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 0.5,
          }}
        >
          Isaac Plans
        </span>
      </div>

      {/* Content block — sits inside the focused content scrim (safe zone bottom).
          Starts at y=648 where the scrim is already ~90% dark; ends ≈y=1110,
          comfortably inside the safe zone before the platform-UI zone at y≈1120. */}
      <div
        style={{
          position: "absolute",
          top: 648,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          padding: "0 72px",
        }}
      >
        {/* Category pill */}
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            backgroundColor: "#0077B6",
            borderRadius: 100,
            padding: "12px 28px",
            marginBottom: 28,
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: 2,
            }}
          >
            {categoryLabel}
          </span>
        </div>

        {/* Headline */}
        <span
          style={{
            color: "white",
            fontSize: 74,
            fontWeight: 900,
            lineHeight: 1.1,
            marginBottom: 28,
          }}
        >
          {headline}
        </span>

        {/* Domain */}
        <span
          style={{
            color: "#00B4D8",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 2,
            textTransform: "uppercase",
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

export async function renderSocialImages(
  headline: string,
  sourceImageUrl: string,
  category: string,
  folder: string,
  ts: number
): Promise<{ square: string; vertical: string }> {
  const fontData      = await loadFont();
  const categoryLabel = getCategoryLabel(category);
  const cleanHeadline = sanitizeHeadline(headline);

  const [squareBuffer, verticalBuffer] = await Promise.all([
    renderCardToBuffer(
      <SocialSquareCard
        headline={cleanHeadline}
        backgroundUrl={sourceImageUrl}
        categoryLabel={categoryLabel}
      />,
      1080,
      1080,
      fontData
    ),
    renderCardToBuffer(
      <SocialVerticalCard
        headline={cleanHeadline}
        backgroundUrl={sourceImageUrl}
        categoryLabel={categoryLabel}
      />,
      1080,
      1920,
      fontData
    ),
  ]);

  const [square, vertical] = await Promise.all([
    uploadBufferToCloudinary(squareBuffer, folder, `square-${ts}`),
    uploadBufferToCloudinary(verticalBuffer, folder, `vertical-${ts}`),
  ]);

  return { square, vertical };
}
