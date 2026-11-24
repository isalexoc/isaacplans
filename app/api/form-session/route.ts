import { NextResponse } from "next/server";

import { getLeadGuardMode } from "@/lib/lead-guard/config";
import { mintLeadToken } from "@/lib/lead-guard/token";

/**
 * GET /api/form-session — Lead Guard's form token (lib/lead-guard/token.ts). Lead forms fetch it
 * when they mount and send it back on submit. Stateless: no database, no cookies, no PII.
 * Under /api, so the locale/Clerk middleware never runs for it.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const t = getLeadGuardMode() === "off" ? null : mintLeadToken();
  return NextResponse.json(
    { t },
    { headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } }
  );
}
