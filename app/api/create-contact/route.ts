import { NextRequest, NextResponse } from "next/server";

import { createContactCore } from "@/lib/create-contact/core";
import { gateCreateContact } from "@/lib/lead-guard/server";

/**
 * POST /api/create-contact — the website's browser lead funnels (final expense, IUL, ACA, life,
 * health alternative, IUL guía, LegalShield, consumer guides) post here.
 *
 * Lead Guard (lib/lead-guard) judges the browser's request first; a held or blocked submission
 * gets the normal success shape with a stand-in contactId and never reaches the CRM. Everything
 * else runs `createContactCore` (lib/create-contact/core.ts), which our own server code (the lead
 * server actions, lead magnets, referral partners, Release) calls in-process instead of over HTTP.
 */

/** Real lead bodies are a few KB; anything this big is not a form. */
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, error: "Request too large" }, { status: 413 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const gate = await gateCreateContact(request, parsed as Record<string, unknown>);
  if (gate.kind === "unavailable") {
    // A held lead that neither the database nor the CRM could take: the funnel shows its error.
    return NextResponse.json({ success: false, error: "We couldn't save your request. Please try again." }, { status: 503 });
  }
  if (gate.kind === "fake_success") {
    return NextResponse.json({
      success: true,
      message: "Contact created successfully!",
      contactId: gate.contactId,
      isExisting: false,
      capiDispatched: false,
    });
  }

  const result = await createContactCore(gate.body, { visitor: gate.visitor, extraTags: gate.extraTags });
  return NextResponse.json(result.body, { status: result.status });
}
