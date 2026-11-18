import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { NO_STORE, apiError, requireAdminUser } from "@/lib/aca-confirmation/route-helpers";
import { runAdminAction, type AdminActionInput } from "@/lib/ai-setter/actions";
import { createAiSetterLogger } from "@/lib/ai-setter/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ActionResult = Awaited<ReturnType<typeof runAdminAction>>;

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,80}$/;
const MAX_BODY_CHARS = 16_000;
/** Remembered (user, key) pairs: a repeated key gets the first result back instead of acting twice. */
const RECENT_KEYS_LIMIT = 200;

const log = createAiSetterLogger();

// ─── Body schema: mirrors AdminActionInput. The schedule is checked strictly in actions. ──────

const messageId = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/);
const contactId = z.string().regex(/^[A-Za-z0-9]{10,40}$/);
const templateId = z.string().regex(/^[a-z0-9_]{2,64}$/);
const dayWindows = z
  .array(z.object({ start: z.string().regex(/^\d{1,2}:\d{2}$/), end: z.string().regex(/^\d{1,2}:\d{2}$/) }))
  .max(12);
const schedule = z.object({
  timeZone: z.string().min(1).max(64),
  days: z.object({ 0: dayWindows, 1: dayWindows, 2: dayWindows, 3: dayWindows, 4: dayWindows, 5: dayWindows, 6: dayWindows }),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), messageId }),
  z.object({ action: z.literal("edit_approve"), messageId, text: z.string().min(1).max(1600) }),
  z.object({ action: z.literal("reject"), messageId }),
  z.object({ action: z.literal("regenerate"), messageId }),
  z.object({ action: z.literal("take_over"), contactId }),
  z.object({ action: z.literal("resume"), contactId }),
  z.object({ action: z.literal("pause_lead"), contactId }),
  z.object({ action: z.literal("pause_all") }),
  z.object({ action: z.literal("resume_all") }),
  z.object({ action: z.literal("set_busy"), minutes: z.number().int().min(0).max(1440) }),
  z.object({ action: z.literal("save_schedule"), schedule }),
  z.object({ action: z.literal("approve_template"), templateId }),
  z.object({ action: z.literal("revoke_template"), templateId }),
]);

// ─── Double-tap / retry safety ─────────────────────────────────────────────────────────────

type RememberedAction = { fingerprint: string; result: Promise<ActionResult> };

/**
 * Per server instance (best effort, no DB): the actions themselves are conditional transitions,
 * this only spares a duplicate the round trip. The promise is stored before it settles, so a
 * duplicate that arrives while the first is still running waits for that same result.
 */
const recentActions = new Map<string, RememberedAction>();

function remember(key: string, entry: RememberedAction): void {
  recentActions.set(key, entry);
  for (const oldest of recentActions.keys()) {
    if (recentActions.size <= RECENT_KEYS_LIMIT) break;
    recentActions.delete(oldest);
  }
}

function fingerprintOf(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

// ─── Guards ────────────────────────────────────────────────────────────────────────────────

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

/** CSRF: the browser's Origin must be this host (Host, the proxy's forwarded host, or the URL's). */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const originHost = origin && origin !== "null" ? hostOf(origin) : null;
  if (!originHost) return false;
  const hosts = [
    request.headers.get("host"),
    request.headers.get("x-forwarded-host")?.split(",")[0],
    request.nextUrl.host,
  ];
  return hosts.some((host) => typeof host === "string" && host.trim().toLowerCase() === originHost);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function runSafely(input: AdminActionInput, userId: string): Promise<ActionResult> {
  try {
    return await runAdminAction(input, userId);
  } catch (error) {
    log.error("Admin action threw", { action: input.action, error: error instanceof Error ? error.name : "unknown" });
    return { ok: false, error: "Error interno" };
  }
}

function actionResponse(result: ActionResult): NextResponse {
  return NextResponse.json(
    {
      success: result.ok,
      ...(result.error ? { error: result.error } : {}),
      ...(result.data !== undefined ? { data: result.data } : {}),
    },
    { status: result.ok ? 200 : 409, headers: NO_STORE }
  );
}

/**
 * POST /api/admin/ai-setter/action — one panel action (approve, edit, reject, pause, hours,
 * templates…). Admin only; same-origin only; requires an `Idempotency-Key` header (8–80 chars).
 * 200 when the action ran, 409 when it was refused (already changed, expired, not configured…).
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return apiError(403, "Origen no permitido.");
  const userId = await requireAdminUser();
  if (userId instanceof NextResponse) return userId;

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!IDEMPOTENCY_KEY_RE.test(idempotencyKey)) return apiError(400, "Falta el encabezado Idempotency-Key.");

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return apiError(413, "La solicitud es demasiado grande.");
  const parsed = actionSchema.safeParse(parseJson(raw));
  if (!parsed.success) return apiError(400, "Acción inválida.");

  const cacheKey = `${userId}:${idempotencyKey}`;
  const fingerprint = fingerprintOf(raw);
  const previous = recentActions.get(cacheKey);
  if (previous) {
    if (previous.fingerprint !== fingerprint) return apiError(422, "Esa Idempotency-Key ya se usó con otra acción.");
    return actionResponse(await previous.result);
  }

  const input: AdminActionInput = parsed.data;
  const result = runSafely(input, userId);
  remember(cacheKey, { fingerprint, result });
  const settled = await result;
  log.info("Admin action", { action: input.action, ok: settled.ok });
  return actionResponse(settled);
}
