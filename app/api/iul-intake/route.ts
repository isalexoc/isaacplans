import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  createIntakeSession,
  listIntakeSessionsForOwner,
  toIntakeSummary,
  type IntakeStatus,
} from "@/lib/iul-intake/server";
import {
  agentCrmEnsureContact,
  agentCrmGetBaseCredentials,
  agentCrmGetContactNative,
  agentCrmSearchContacts,
} from "@/lib/agent-crm-contacts";
import { getIsAdmin } from "@/lib/auth/admin";
import { titleCaseName, isValidEmail, isValidPhone } from "@/lib/iul-intake/validation";
import type { IntakeData } from "@/lib/iul-intake/schema";

const STATUSES: IntakeStatus[] = ["draft", "in_progress", "completed"];

function parseStatus(value: string | null): IntakeStatus | undefined {
  return STATUSES.find((s) => s === value);
}

// GET /api/iul-intake — dashboard list, OR ?contactSearch=… to search the CRM for contacts
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
      const contacts = await agentCrmSearchContacts(contactSearch, creds.locationId, creds.token, "[IUL_INTAKE]");
      return NextResponse.json({ success: true, contacts });
    }

    const rows = await listIntakeSessionsForOwner(userId, {
      search: searchParams.get("search") ?? undefined,
      status: parseStatus(searchParams.get("status")),
    });
    return NextResponse.json({ success: true, sessions: rows.map(toIntakeSummary) });
  } catch (error) {
    console.error("[iul-intake] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}

// POST /api/iul-intake — create a session from an existing CRM contact id, or a new contact
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
    // Normalize: email lowercased, phone digits-only, names title-cased.
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body?.phone === "string" ? body.phone.replace(/\D/g, "") : "";
    const firstNameInput = typeof body?.firstName === "string" ? titleCaseName(body.firstName) : "";
    const lastNameInput = typeof body?.lastName === "string" ? titleCaseName(body.lastName) : "";
    // Back-compat: a single "name" still works (split on whitespace, title-cased).
    const nameInput = typeof body?.name === "string" ? titleCaseName(body.name) : "";
    const name = [firstNameInput, lastNameInput].filter(Boolean).join(" ") || nameInput;
    const locale = body?.locale === "es" ? "es" : "en";

    // Validate contact details before creating a new contact.
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

      if (creds) {
        crmContactId = await agentCrmEnsureContact(
          { email, phone, firstName, lastName },
          creds.locationId,
          creds.token,
          "[IUL_INTAKE]"
        );
      } else {
        console.warn("[iul-intake] Agent CRM credentials missing; creating unlinked session.");
      }
    }

    const row = await createIntakeSession({
      ownerUserId: userId,
      crmContactId,
      contactName,
      contactEmail,
      contactPhone,
      locale,
      data: prefill,
    });

    return NextResponse.json({ success: true, session: toIntakeSummary(row) });
  } catch (error) {
    console.error("[iul-intake] POST", error);
    return NextResponse.json({ success: false, error: "Failed to create session" }, { status: 500 });
  }
}
