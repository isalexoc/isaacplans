import { randomUUID } from "crypto";
import { ImageResponse } from "next/og";
import cloudinary from "@/config/cloudinary";
import { loadInterFont } from "@/lib/og/inter-font";
import { fetchAgentLicenseImageDataUri } from "@/lib/agent-license-image";
import { getAgentLicenseStates } from "@/lib/agent-licenses";
import { getIulPresentation, mapIulPresentation, type IulLocale } from "@/lib/iul-presentation";
import { publishJob } from "@/lib/qstash/client";

/**
 * Server-side generation of a shareable "agent credentials" card for the IUL
 * presentation, built for automation (e.g. a GoHighLevel workflow calls the
 * secret-guarded /api/iul/credentials-image endpoint with a client's state).
 *
 * The state + driver's-license source images live in Cloudinary with
 * `authenticated` delivery and are fetched server-side (signed) — the composed
 * card is uploaded as a normal public asset with an unguessable ID so a client
 * can load it with no login. A QStash-delayed cleanup job deletes it after a
 * TTL (default 48h) so the ID documents are not left permanently public.
 */

const CARD_W = 1080;
const CARD_H = 1620;

// Brand palette (tailwind.config.ts: blue #0077B6, accent #00B4D8).
const BRAND_BLUE = "#0077B6";
const BRAND_ACCENT = "#00B4D8";

type SupportedLocale = "en" | "es";

/**
 * Normalize whatever a caller (e.g. a GHL contact-language field) sends into a
 * supported locale. Anything Spanish-ish ("es", "Spanish", "español") → es;
 * everything else → en.
 */
function normalizeLocale(locale?: string): SupportedLocale {
  const l = (locale ?? "").trim().toLowerCase();
  if (l === "es" || l.startsWith("spa") || l.startsWith("esp")) return "es";
  return "en";
}

const CARD_LABELS: Record<SupportedLocale, {
  stateLicense: string;
  driversLicense: string;
  tagline: string;
}> = {
  en: {
    stateLicense: "STATE LICENSE",
    driversLicense: "DRIVER'S LICENSE",
    tagline: "Licensed insurance agent",
  },
  es: {
    stateLicense: "LICENCIA ESTATAL",
    driversLicense: "LICENCIA DE CONDUCIR",
    tagline: "Agente de seguros licenciado",
  },
};

export type CredentialsShareErrorCode =
  | "unknown_state"
  | "missing_state_image"
  | "missing_drivers_image"
  | "render_failed";

export class CredentialsShareError extends Error {
  code: CredentialsShareErrorCode;
  constructor(code: CredentialsShareErrorCode, message: string) {
    super(message);
    this.name = "CredentialsShareError";
    this.code = code;
  }
}

export interface GenerateCredentialsResult {
  url: string;
  publicId: string;
  state: { code: string; name: string };
  locale: SupportedLocale;
  ttlHours: number;
  cleanupScheduled: boolean;
}

interface AgentCardProfile {
  name: string;
  role: string;
  phone: string;
  email: string;
  website: string;
  headshotUrl: string;
}

// ─── State resolution ────────────────────────────────────────────────────────

/**
 * Match a free-form state input ("FL", "florida", "Florida") against the states
 * that actually have an active license in Sanity. Only licensed states resolve,
 * since we can't produce a license image for anything else.
 */
function resolveLicensedState(
  input: string,
  states: { code: string; name: string }[]
): { code: string; name: string } | null {
  const q = String(input ?? "").trim().toLowerCase();
  if (!q) return null;
  return (
    states.find((s) => s.code.toLowerCase() === q || s.name.toLowerCase() === q) ?? null
  );
}

// ─── Agent profile (reused from the presentation's agent slide) ──────────────

async function getAgentCardProfile(locale: SupportedLocale): Promise<AgentCardProfile> {
  const fallback: AgentCardProfile = {
    name: "Isaac Orraiz",
    role: "",
    phone: "",
    email: "",
    website: "",
    headshotUrl: "",
  };

  const doc = await getIulPresentation();
  if (!doc) return fallback;

  const pres = mapIulPresentation(doc, locale as IulLocale);
  const agent = pres.slides.find((s) => s.type === "agent");
  const data = (agent?.data ?? {}) as Record<string, any>;
  const contact = (data.contact ?? {}) as Record<string, any>;
  const headshot = (data.headshot ?? {}) as Record<string, any>;

  return {
    name: contact.name || fallback.name,
    role: data.role || "",
    phone: contact.phone || "",
    email: contact.email || "",
    website: contact.website || "",
    headshotUrl: headshot.url || "",
  };
}

/**
 * Fetch the headshot as a data URI for embedding. Satori decodes PNG/JPEG only,
 * so we normalize Sanity CDN images to PNG and bail (→ initials fallback) on
 * WebP/SVG we can't reliably decode.
 */
async function fetchHeadshotDataUri(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    let fetchUrl = url;
    if (url.includes("cdn.sanity.io")) {
      const sep = url.includes("?") ? "&" : "?";
      fetchUrl = `${url}${sep}w=240&h=240&fit=crop&fm=png`;
    }
    const res = await fetch(fetchUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    if (contentType.includes("webp") || contentType.includes("svg")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Card template ───────────────────────────────────────────────────────────

function LicensePanel({
  label,
  imageUri,
}: {
  label: string;
  imageUri: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: "20px 40px",
      }}
    >
      <span
        style={{
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: 3,
          color: BRAND_BLUE,
          marginBottom: 14,
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f1f5f9",
          border: "2px solid #e2e8f0",
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUri}
          alt={label}
          width={960}
          height={470}
          style={{ width: 960, height: 470, objectFit: "contain" }}
        />
      </div>
    </div>
  );
}

function CredentialsCard({
  profile,
  headshotUri,
  stateName,
  stateImageUri,
  driversImageUri,
  labels,
}: {
  profile: AgentCardProfile;
  headshotUri: string | null;
  stateName: string;
  stateImageUri: string;
  driversImageUri: string;
  labels: (typeof CARD_LABELS)[SupportedLocale];
}) {
  const contactLines = [profile.phone, profile.email, profile.website].filter(Boolean);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: CARD_W,
        height: CARD_H,
        backgroundColor: "#ffffff",
        fontFamily: "Inter",
      }}
    >
      {/* Header band */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32,
          padding: "44px 56px",
          backgroundImage: `linear-gradient(120deg, ${BRAND_BLUE} 0%, ${BRAND_ACCENT} 100%)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: "rgba(255,255,255,0.22)",
            border: "5px solid #ffffff",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {headshotUri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={headshotUri}
              alt={profile.name}
              width={150}
              height={150}
              style={{ width: 150, height: 150, objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: 56, fontWeight: 700, color: "#ffffff" }}>
              {initialsOf(profile.name)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span style={{ fontSize: 52, fontWeight: 700, color: "#ffffff", lineHeight: 1.1 }}>
            {profile.name}
          </span>
          {profile.role ? (
            <span style={{ fontSize: 27, fontWeight: 400, color: "rgba(255,255,255,0.92)", marginTop: 4 }}>
              {profile.role}
            </span>
          ) : (
            <span style={{ fontSize: 27, fontWeight: 400, color: "rgba(255,255,255,0.92)", marginTop: 4 }}>
              {labels.tagline}
            </span>
          )}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
            {contactLines.map((line) => (
              <span
                key={line}
                style={{ fontSize: 24, fontWeight: 400, color: "#ffffff", lineHeight: 1.5 }}
              >
                {line}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* License panels */}
      <LicensePanel label={`${labels.stateLicense}  ·  ${stateName}`} imageUri={stateImageUri} />
      <LicensePanel label={labels.driversLicense} imageUri={driversImageUri} />

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 84,
          backgroundColor: "#0e1a2b",
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, color: "#ffffff" }}>
          isaacplans.com
        </span>
      </div>
    </div>
  );
}

// ─── Render + upload + cleanup ───────────────────────────────────────────────

async function renderCardToBuffer(
  element: React.ReactElement,
  font400: ArrayBuffer,
  font700: ArrayBuffer
): Promise<Buffer> {
  const response = new ImageResponse(element, {
    width: CARD_W,
    height: CARD_H,
    fonts: [
      { name: "Inter", data: font400, weight: 400, style: "normal" },
      { name: "Inter", data: font700, weight: 700, style: "normal" },
    ],
  });
  return Buffer.from(await response.arrayBuffer());
}

async function uploadCredentialsImage(
  buffer: Buffer,
  stateCode: string,
  locale: SupportedLocale
): Promise<{ url: string; publicId: string }> {
  const b64 = buffer.toString("base64");
  const publicId = `iul-credentials/${stateCode.toLowerCase()}-${locale}-${randomUUID().replace(/-/g, "")}`;
  const uploaded = await cloudinary.uploader.upload(`data:image/png;base64,${b64}`, {
    public_id: publicId,
    type: "upload",
    resource_type: "image",
    overwrite: false,
  });
  return { url: uploaded.secure_url, publicId: uploaded.public_id };
}

function getTtlHours(): number {
  const raw = Number(process.env.IUL_CREDENTIALS_TTL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : 48;
}

/**
 * Schedule deletion of the generated card after the TTL via QStash. Returns true
 * when a job was published; false when QStash is disabled (the asset then
 * persists until a manual/scheduled sweep — see IUL_CREDENTIALS_SHARE_SETUP.md).
 */
async function scheduleCredentialsCleanup(
  publicId: string,
  ttlHours: number,
  requestOrigin?: string
): Promise<boolean> {
  const messageId = await publishJob({
    path: "/api/queue/iul-credentials-cleanup",
    body: { publicId },
    delaySeconds: Math.round(ttlHours * 3600),
    requestOrigin,
  });
  return Boolean(messageId);
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export async function generateCredentialsImage({
  stateInput,
  locale,
  requestOrigin,
}: {
  stateInput: string;
  locale?: string;
  requestOrigin?: string;
}): Promise<GenerateCredentialsResult> {
  const normalizedLocale = normalizeLocale(locale);
  const labels = CARD_LABELS[normalizedLocale];

  const states = await getAgentLicenseStates();
  const state = resolveLicensedState(stateInput, states);
  if (!state) {
    throw new CredentialsShareError(
      "unknown_state",
      `No active license found for state "${stateInput}". Send a licensed 2-letter code or full state name.`
    );
  }

  const [stateImageUri, driversImageUri, profile] = await Promise.all([
    fetchAgentLicenseImageDataUri(state.code, { width: 1400, height: 1000 }),
    fetchAgentLicenseImageDataUri("drivers", { width: 1400, height: 1000 }),
    getAgentCardProfile(normalizedLocale),
  ]);

  if (!stateImageUri) {
    throw new CredentialsShareError(
      "missing_state_image",
      `No license image is on file for ${state.name}.`
    );
  }
  if (!driversImageUri) {
    throw new CredentialsShareError(
      "missing_drivers_image",
      "No driver's license image is on file."
    );
  }

  const headshotUri = await fetchHeadshotDataUri(profile.headshotUrl);

  let buffer: Buffer;
  try {
    const [font400, font700] = await Promise.all([loadInterFont(400), loadInterFont(700)]);
    buffer = await renderCardToBuffer(
      <CredentialsCard
        profile={profile}
        headshotUri={headshotUri}
        stateName={state.name}
        stateImageUri={stateImageUri}
        driversImageUri={driversImageUri}
        labels={labels}
      />,
      font400,
      font700
    );
  } catch (err) {
    throw new CredentialsShareError(
      "render_failed",
      err instanceof Error ? err.message : "Failed to render credentials card"
    );
  }

  const { url, publicId } = await uploadCredentialsImage(buffer, state.code, normalizedLocale);
  const ttlHours = getTtlHours();
  const cleanupScheduled = await scheduleCredentialsCleanup(publicId, ttlHours, requestOrigin);

  return { url, publicId, state, locale: normalizedLocale, ttlHours, cleanupScheduled };
}
