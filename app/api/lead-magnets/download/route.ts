import { NextRequest, NextResponse } from "next/server";

import { processLeadMagnetDownload } from "@/lib/lead-magnets/download";
import { gateFrontDoor } from "@/lib/lead-guard/server";

/**
 * POST /api/lead-magnets/download — lead-magnet-form.tsx asks for a guide PDF.
 *
 * Lead Guard judges the browser's request first. A blocked or held submission still gets the PDF
 * (public content) but nothing reaches the CRM — no contact, workflow, CAPI Lead or download count;
 * a held one is replayed through `processLeadMagnetDownload` when Isaac releases it.
 */

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  const rawBody = await request.text().catch(() => "");
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, error: "Request too large." }, { status: 413 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
  const input = parsed as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const name = str(input.name).trim();

  const gate = await gateFrontDoor(request, input, {
    surface: "lead_magnet_download",
    route: "/api/lead-magnets/download",
    contact: {
      firstName: str(input.firstName).trim() || name.split(/\s+/)[0] || "",
      lastName: str(input.lastName).trim() || name.split(/\s+/).slice(1).join(" "),
      email: input.email,
      phone: input.phone,
      language: input.locale,
      smsConsent: input.smsConsent,
      marketingConsent: input.marketingConsent,
    },
  });

  if (gate.kind === "unavailable") {
    return NextResponse.json({ success: false, error: "We couldn't save your request. Please try again." }, { status: 503 });
  }

  const result = await processLeadMagnetDownload(gate.body, {
    visitor: gate.kind === "proceed" ? gate.visitor : null,
    leadAllowed: gate.kind === "proceed",
  });
  return NextResponse.json(result.body, { status: result.status });
}
