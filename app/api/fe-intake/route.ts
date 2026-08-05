import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  createFeIntakeSession,
  listFeIntakeSessionsForOwner,
  countFeIntakeSessionsForOwner,
  syncFeIntakeLinkToCrm,
  toFeIntakeSummary,
  FE_INTAKE_PAGE_SIZE,
  FE_SPANISH_TAG,
  FE_ENGLISH_TAG,
  type FeIntakeStatus,
} from "@/lib/fe-intake/server";
import {
  agentCrmEnsureContact,
  agentCrmGetBaseCredentials,
  agentCrmGetContactNative,
  agentCrmAddContactTags,
  agentCrmSearchContacts,
} from "@/lib/agent-crm-contacts";
import { getIsAdmin } from "@/lib/auth/admin";
import { titleCaseName, isValidEmail, isValidPhone } from "@/lib/fe-intake/validation";
import type { FeIntakeData } from "@/lib/fe-intake/schema";

const STATUSES: FeIntakeStatus[] = ["draft", "in_progress", "completed"];

function parseStatus(value: string | null): FeIntakeStatus | undefined {
  return STATUSES.find((s) => s === value);
}

// GET /api/fe-intake — dashboard list, OR ?contactSearch=… to search the CRM for contacts
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await getIsAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);

    const contactSearch = searchParams.get("contactSearch");
    if (contactSearch !== null) {
      const creds = agentCrmGetBaseCredentials();
      if (!creds) return NextResponse.json({ success: true, contacts: [] });
      const contacts = await agentCrmSearchContacts(contactSearch, creds.locationId, creds.token, "[FE_INTAKE]");
      return NextResponse.json({ success: true, contacts });
    }

    const filters = {
      search: searchParams.get("search") ?? undefined,
      status: parseStatus(searchParams.get("status")),
    };
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.max(1, Math.min(parseInt(searchParams.get("limit") ?? String(FE_INTAKE_PAGE_SIZE), 10) || FE_INTAKE_PAGE_SIZE, 100));

    const [rows, total] = await Promise.all([
      listFeIntakeSessionsForOwner(userId, { ...filters, page, limit }),
      countFeIntakeSessionsForOwner(userId, filters),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return NextResponse.json({
      success: true,
      sessions: rows.map(toFeIntakeSummary),
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    });
  } catch (error) {
    console.error("[fe-intake] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}

// POST /api/fe-intake — create a session from an existing CRM contact id, or a new contact
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await getIsAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const crmContactIdInput = typeof body?.crmContactId === "string" ? body.crmContactId.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body?.phone === "string" ? body.phone.replace(/\D/g, "") : "";
    const firstNameInput = typeof body?.firstName === "string" ? titleCaseName(body.firstName) : "";
    const lastNameInput = typeof body?.lastName === "string" ? titleCaseName(body.lastName) : "";
    const name = [firstNameInput, lastNameInput].filter(Boolean).join(" ");
    const locale = body?.locale === "es" ? "es" : "en";

    if (!crmContactIdInput) {
      if (email && !isValidEmail(email)) {
        return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
      }
      if (phone && !isValidPhone(phone)) {
        return NextResponse.json({ success: false, error: "Enter a valid 10-digit phone number." }, { status: 400 });
      }
    }

    const creds = agentCrmGetBaseCredentials();
    let crmContactId: string | null = null;
    let contactName = name || null;
    let contactEmail = email || null;
    let contactPhone = phone || null;
    let linkLocaleOverride: "en" | "es" | undefined;
    const prefill: FeIntakeData = {};

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
      if (firstNameInput) prefill.firstName = firstNameInput;
      if (lastNameInput) prefill.lastName = lastNameInput;
      if (email) prefill.email = email;
      if (phone) prefill.phone = phone;

      linkLocaleOverride = locale;
      if (creds) {
        crmContactId = await agentCrmEnsureContact(
          { email, phone, firstName: firstNameInput, lastName: lastNameInput, source: "fe_intake" },
          creds.locationId,
          creds.token,
          "[FE_INTAKE]"
        );
        if (crmContactId) {
          await agentCrmAddContactTags(
            crmContactId,
            [locale === "es" ? FE_SPANISH_TAG : FE_ENGLISH_TAG],
            creds.token,
            "[FE_INTAKE]"
          );
        }
      } else {
        console.warn("[fe-intake] Agent CRM credentials missing; creating unlinked session.");
      }
    }

    const row = await createFeIntakeSession({
      ownerUserId: userId,
      crmContactId,
      contactName,
      contactEmail,
      contactPhone,
      locale,
      data: prefill,
    });

    // Seed the CRM link field so it's ready for the "Send link" workflow.
    await syncFeIntakeLinkToCrm(row, linkLocaleOverride);

    return NextResponse.json({ success: true, session: toFeIntakeSummary(row) });
  } catch (error) {
    console.error("[fe-intake] POST", error);
    return NextResponse.json({ success: false, error: "Failed to create session" }, { status: 500 });
  }
}
