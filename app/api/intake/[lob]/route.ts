import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { forbidden, notFound, resolveConfig, unauthorized } from "@/lib/intake-core/route-helpers";
import {
  createIntakeSession,
  listIntakeSessionsForOwner,
  countIntakeSessionsForOwner,
  syncIntakeLinkToCrm,
  toIntakeSummary,
  INTAKE_PAGE_SIZE,
  INTAKE_SPANISH_TAG,
  INTAKE_ENGLISH_TAG,
} from "@/lib/intake-core/server";
import {
  agentCrmEnsureContact,
  agentCrmGetBaseCredentials,
  agentCrmGetContactNative,
  agentCrmAddContactTags,
  agentCrmSearchContacts,
} from "@/lib/agent-crm-contacts";
import { titleCaseName, isValidEmail, isValidPhone } from "@/lib/intake-core/validation";
import type { IntakeData, IntakeStatus } from "@/lib/intake-core/types";

type RouteContext = { params: Promise<{ lob: string }> };

const STATUSES: IntakeStatus[] = ["draft", "in_progress", "completed"];

function parseStatus(value: string | null): IntakeStatus | undefined {
  return STATUSES.find((s) => s === value);
}

// GET /api/intake/[lob] — dashboard list, OR ?contactSearch=… to search the CRM for contacts
export async function GET(request: NextRequest, context: RouteContext) {
  const { lob } = await context.params;
  try {
    const { userId } = await auth();
    if (!userId) return unauthorized();
    if (!(await getIsAdmin())) return forbidden();

    const config = resolveConfig(lob);
    if (!config) return notFound();

    const logTag = `[${config.slugPrefix.toUpperCase()}_INTAKE]`;
    const { searchParams } = new URL(request.url);

    const contactSearch = searchParams.get("contactSearch");
    if (contactSearch !== null) {
      const creds = agentCrmGetBaseCredentials();
      if (!creds) return NextResponse.json({ success: true, contacts: [] });
      const contacts = await agentCrmSearchContacts(
        contactSearch,
        creds.locationId,
        creds.token,
        logTag
      );
      return NextResponse.json({ success: true, contacts });
    }

    const filters = {
      search: searchParams.get("search") ?? undefined,
      status: parseStatus(searchParams.get("status")),
    };
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.max(
      1,
      Math.min(
        parseInt(searchParams.get("limit") ?? String(INTAKE_PAGE_SIZE), 10) || INTAKE_PAGE_SIZE,
        100
      )
    );

    const [rows, total] = await Promise.all([
      listIntakeSessionsForOwner(config, userId, { ...filters, page, limit }),
      countIntakeSessionsForOwner(config, userId, filters),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return NextResponse.json({
      success: true,
      sessions: rows.map(toIntakeSummary),
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    });
  } catch (error) {
    console.error(`[intake/${lob}] GET`, error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}

// POST /api/intake/[lob] — create a session from an existing CRM contact id, or a new contact
export async function POST(request: NextRequest, context: RouteContext) {
  const { lob } = await context.params;
  try {
    const { userId } = await auth();
    if (!userId) return unauthorized();
    if (!(await getIsAdmin())) return forbidden();

    const config = resolveConfig(lob);
    if (!config) return notFound();

    const logTag = `[${config.slugPrefix.toUpperCase()}_INTAKE]`;
    const body = await request.json().catch(() => ({}));
    const crmContactIdInput = typeof body?.crmContactId === "string" ? body.crmContactId.trim() : "";
    // Normalize: email lowercased, phone digits-only, names title-cased.
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body?.phone === "string" ? body.phone.replace(/\D/g, "") : "";
    const firstNameInput = typeof body?.firstName === "string" ? titleCaseName(body.firstName) : "";
    const lastNameInput = typeof body?.lastName === "string" ? titleCaseName(body.lastName) : "";
    const nameInput = typeof body?.name === "string" ? titleCaseName(body.name) : "";
    const name = [firstNameInput, lastNameInput].filter(Boolean).join(" ") || nameInput;
    const locale = body?.locale === "es" ? "es" : "en";

    // Validate contact details before creating a new contact.
    if (!crmContactIdInput) {
      if (email && !isValidEmail(email)) {
        return NextResponse.json(
          { success: false, error: "Enter a valid email address." },
          { status: 400 }
        );
      }
      if (phone && !isValidPhone(phone)) {
        return NextResponse.json(
          { success: false, error: "Enter a valid 10-digit phone number." },
          { status: 400 }
        );
      }
    }

    const creds = agentCrmGetBaseCredentials();
    let crmContactId: string | null = null;
    let contactName = name || null;
    let contactEmail = email || null;
    let contactPhone = phone || null;
    // For a brand-new contact we know the chosen language → use it for the saved link. For an
    // existing contact, let the link locale follow the contact's Spanish tag (no override).
    let linkLocaleOverride: "en" | "es" | undefined;
    const prefill: IntakeData = {};

    if (crmContactIdInput) {
      // Start from an existing CRM contact — pre-fill native fields from it.
      crmContactId = crmContactIdInput;
      if (creds) {
        const c = await agentCrmGetContactNative(crmContactIdInput, creds.token);
        if (c) {
          if (c.firstName) prefill.firstName = c.firstName;
          if (c.lastName) prefill.lastName = c.lastName;
          if (c.email) prefill.email = c.email;
          if (c.phone) prefill.phone = c.phone;
          if (c.dateOfBirth) prefill.dateOfBirth = c.dateOfBirth.slice(0, 10);
          if (c.address1) prefill.address1 = c.address1;
          if (c.city) prefill.city = c.city;
          if (c.state) prefill.state = c.state;
          if (c.postalCode) prefill.postalCode = c.postalCode;
          contactName = [c.firstName, c.lastName].filter(Boolean).join(" ") || contactName;
          contactEmail = c.email || contactEmail;
          contactPhone = c.phone || contactPhone;
        }
      }
    } else {
      if (!email && !phone && !name) {
        return NextResponse.json(
          { success: false, error: "Provide a name, email, or phone to start an intake." },
          { status: 400 }
        );
      }
      // Prefer explicit first/last; fall back to splitting a combined name.
      let firstName = firstNameInput;
      let lastName = lastNameInput;
      if (!firstName && !lastName && name) {
        const [first, ...rest] = name.split(/\s+/).filter(Boolean);
        firstName = first ?? "";
        lastName = rest.join(" ");
      }
      if (firstName) prefill.firstName = firstName;
      if (lastName) prefill.lastName = lastName;
      if (email) prefill.email = email;
      if (phone) prefill.phone = phone;

      linkLocaleOverride = locale;
      if (creds) {
        crmContactId = await agentCrmEnsureContact(
          // Explicit source: without it the shared helper stamps every new contact "iul_intake",
          // which would make this client match source-filtered IUL workflows.
          { email, phone, firstName, lastName, source: `${config.slugPrefix}_intake` },
          creds.locationId,
          creds.token,
          logTag
        );
        // Tag the contact's language — the saved link locale + your workflows branch on it.
        if (crmContactId) {
          await agentCrmAddContactTags(
            crmContactId,
            [locale === "es" ? INTAKE_SPANISH_TAG : INTAKE_ENGLISH_TAG],
            creds.token,
            logTag
          );
        }
      } else {
        console.warn(`[${config.lob}-intake] Agent CRM credentials missing; unlinked session.`);
      }
    }

    const row = await createIntakeSession(config, {
      ownerUserId: userId,
      crmContactId,
      contactName,
      contactEmail,
      contactPhone,
      locale,
      data: prefill,
    });

    // Seed the CRM link field so it's ready for the "Send link" workflow.
    await syncIntakeLinkToCrm(config, row, linkLocaleOverride);

    return NextResponse.json({ success: true, session: toIntakeSummary(row) });
  } catch (error) {
    console.error(`[intake/${lob}] POST`, error);
    return NextResponse.json({ success: false, error: "Failed to create session" }, { status: 500 });
  }
}
