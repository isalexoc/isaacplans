import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireLineOperator } from "@/lib/auth/access";
import { notFound, resolveConfig } from "@/lib/intake-core/route-helpers";
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
  agentCrmGetContactTags,
  agentCrmAddContactTags,
  agentCrmSearchContacts,
} from "@/lib/agent-crm-contacts";
import { ensureScopedContact, hasAnyTag } from "@/lib/intake-core/contact-scope";
import { titleCaseName, isValidEmail, isValidPhone } from "@/lib/intake-core/validation";
import type { IntakeData, IntakeLobConfig, IntakeStatus, IntakeSummary } from "@/lib/intake-core/types";

type RouteContext = { params: Promise<{ lob: string }> };

const STATUSES: IntakeStatus[] = ["draft", "in_progress", "completed"];

function parseStatus(value: string | null): IntakeStatus | undefined {
  return STATUSES.find((s) => s === value);
}

/**
 * Who may see a contact in this line's search and start from it. An admin sees the whole CRM, as
 * always. Anyone else (a scoped role like Legal Shield's associate) sees only contacts carrying the
 * line's tags, and only on a line that names them: Isaac's insurance clients stay out of reach.
 */
function contactScope(config: IntakeLobConfig, isAdmin: boolean): string[] | "all" | "none" {
  if (isAdmin) return "all";
  return config.contactSearchTags?.length ? config.contactSearchTags : "none";
}

/** First and last names of the owners on an oversight list, one Clerk call per page. */
async function ownerNames(userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!userIds.length) return names;
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ userId: userIds, limit: userIds.length });
    for (const user of data) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
      if (name) names.set(user.id, name);
    }
  } catch (error) {
    console.warn("[intake] owner names unavailable:", error);
  }
  return names;
}

// GET /api/intake/[lob] — dashboard list, OR ?contactSearch=… to search the CRM for contacts
export async function GET(request: NextRequest, context: RouteContext) {
  const { lob } = await context.params;
  try {
    const gate = await requireLineOperator(lob);
    if ("error" in gate) return gate.error;
    const { access } = gate;

    const config = resolveConfig(lob);
    if (!config) return notFound();

    const logTag = `[${config.slugPrefix.toUpperCase()}_INTAKE]`;
    const { searchParams } = new URL(request.url);

    const contactSearch = searchParams.get("contactSearch");
    if (contactSearch !== null) {
      const scope = contactScope(config, access.isAdmin);
      const creds = agentCrmGetBaseCredentials();
      if (scope === "none" || !creds) return NextResponse.json({ success: true, contacts: [] });
      const found = await agentCrmSearchContacts(contactSearch, creds.locationId, creds.token, logTag);
      // Unreadable tags count as no tags: a scoped search denies when unsure.
      const allowed = scope === "all" ? found : found.filter((c) => hasAnyTag(c.tags, scope));
      // Tags were only needed for the check; the browser gets what it always got.
      const contacts = allowed.map(({ tags: _tags, ...c }) => c);
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

    // An admin on an oversight line sees every owner's sessions (Isaac helping his dad); everyone
    // else, and every other line, stays owner-scoped.
    const oversight = access.isAdmin && Boolean(config.adminOversight);
    const owner = oversight ? null : access.userId;
    const [rows, total] = await Promise.all([
      listIntakeSessionsForOwner(config, owner, { ...filters, page, limit }),
      countIntakeSessionsForOwner(config, owner, filters),
    ]);

    let sessions: IntakeSummary[] = rows.map(toIntakeSummary);
    if (oversight) {
      const others = Array.from(new Set(rows.map((r) => r.ownerUserId).filter((id) => id !== access.userId)));
      const names = await ownerNames(others);
      sessions = rows.map((row) => ({
        ...toIntakeSummary(row),
        ownerUserId: row.ownerUserId,
        ownedByCaller: row.ownerUserId === access.userId,
        ownerName: row.ownerUserId === access.userId ? null : (names.get(row.ownerUserId) ?? null),
      }));
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return NextResponse.json({
      success: true,
      sessions,
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
    const gate = await requireLineOperator(lob);
    if ("error" in gate) return gate.error;
    const { access } = gate;
    const userId = access.userId;

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
    const locale = config.fixedLocale ?? (body?.locale === "es" ? "es" : "en");
    const scope = contactScope(config, access.isAdmin);

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
      if (scope === "none") {
        return NextResponse.json({ success: false, error: "Start with a name, email or phone." }, { status: 400 });
      }
      // A scoped operator may only start from one of the line's own contacts, checked on the
      // server (the search filter alone would be a suggestion), and denied when tags can't be read.
      if (scope !== "all") {
        const tags = creds ? await agentCrmGetContactTags(crmContactIdInput, creds.token) : null;
        if (!hasAnyTag(tags, scope)) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
      // Start from an existing CRM contact — pre-fill native fields from it.
      crmContactId = crmContactIdInput;
      if (creds) {
        const c = await agentCrmGetContactNative(crmContactIdInput, creds.token);
        if (c) {
          if (c.firstName) prefill.firstName = c.firstName;
          if (c.lastName) prefill.lastName = c.lastName;
          if (c.email) prefill.email = c.email;
          if (c.phone) prefill.phone = c.phone;
          // Date of birth and home address only for an admin: a scoped operator gets what the
          // search already showed them, so a tag on the wrong contact can never leak more.
          if (scope === "all") {
            if (c.dateOfBirth) prefill.dateOfBirth = c.dateOfBirth.slice(0, 10);
            if (c.address1) prefill.address1 = c.address1;
            if (c.city) prefill.city = c.city;
            if (c.state) prefill.state = c.state;
            if (c.postalCode) prefill.postalCode = c.postalCode;
          }
          contactName = [c.firstName, c.lastName].filter(Boolean).join(" ") || contactName;
          contactEmail = c.email || contactEmail;
          contactPhone = c.phone || contactPhone;
        }
      }
      if (creds && config.contactTags?.length) {
        await agentCrmAddContactTags(crmContactIdInput, config.contactTags, creds.token, logTag);
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
        const source = `${config.slugPrefix}_intake`;
        if (config.contactSearchTags?.length) {
          // A scoped line reuses a contact only on an exact email or phone match, and the language
          // tag only goes on a contact it created (Isaac's existing contacts keep theirs).
          const result = await ensureScopedContact(
            { email, phone, firstName, lastName, source },
            creds.locationId,
            creds.token,
            logTag
          );
          crmContactId = result.id;
          if (crmContactId) {
            const tags = [...(config.contactTags ?? [])];
            if (result.created) tags.push(locale === "es" ? INTAKE_SPANISH_TAG : INTAKE_ENGLISH_TAG);
            if (tags.length) await agentCrmAddContactTags(crmContactId, tags, creds.token, logTag);
          }
        } else {
          crmContactId = await agentCrmEnsureContact(
            // Explicit source: without it the shared helper stamps every new contact "iul_intake",
            // which would make this client match source-filtered IUL workflows.
            { email, phone, firstName, lastName, source },
            creds.locationId,
            creds.token,
            logTag
          );
          // Tag the contact's language — the saved link locale + your workflows branch on it.
          if (crmContactId) {
            await agentCrmAddContactTags(
              crmContactId,
              [locale === "es" ? INTAKE_SPANISH_TAG : INTAKE_ENGLISH_TAG, ...(config.contactTags ?? [])],
              creds.token,
              logTag
            );
          }
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

    // Seed the CRM link field so it's ready for the "Send link" workflow (a line that sends its
    // links by WhatsApp has no such field, and this quietly does nothing).
    await syncIntakeLinkToCrm(config, row, linkLocaleOverride);

    return NextResponse.json({ success: true, session: toIntakeSummary(row) });
  } catch (error) {
    console.error(`[intake/${lob}] POST`, error);
    return NextResponse.json({ success: false, error: "Failed to create session" }, { status: 500 });
  }
}
