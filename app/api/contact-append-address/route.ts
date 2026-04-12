import { NextRequest, NextResponse } from "next/server";

/**
 * Append / update mailing address on an existing CRM contact (after initial lead capture).
 * Verifies `email` and/or `phone` match the contact before updating.
 */

function unwrapContactRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const c = r.contact;
  if (c && typeof c === "object") return c as Record<string, unknown>;
  const d = r.data;
  if (d && typeof d === "object") {
    const dc = (d as Record<string, unknown>).contact;
    if (dc && typeof dc === "object") return dc as Record<string, unknown>;
    return d as Record<string, unknown>;
  }
  return r as Record<string, unknown>;
}

function extractCrmEmail(contact: Record<string, unknown>): string {
  for (const key of ["email", "primaryEmail", "primary_email"] as const) {
    const e = contact[key];
    if (typeof e === "string" && e.includes("@")) {
      return e.toLowerCase().trim();
    }
  }
  const additional = contact.additionalEmails;
  if (Array.isArray(additional)) {
    for (const item of additional) {
      if (typeof item === "string" && item.includes("@")) {
        return item.toLowerCase().trim();
      }
      if (item && typeof item === "object" && "email" in item) {
        const em = (item as { email?: string }).email;
        if (typeof em === "string" && em.includes("@")) {
          return em.toLowerCase().trim();
        }
      }
    }
  }
  return "";
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function last10(s: string): string {
  const d = digitsOnly(s);
  return d.length >= 10 ? d.slice(-10) : d;
}

function phonesMatch(a: string, b: string): boolean {
  return last10(a) === last10(b) && last10(a).length === 10;
}

/**
 * LeadConnector accepts standard address fields on the contact model.
 * Do not send `locationId` in the JSON body (PUT updates in this repo omit it);
 * scope with `?locationId=` on the URL like other contact endpoints.
 */
export async function POST(request: NextRequest) {
  try {
    const piToken = process.env.AGENT_CRM_PI;
    const locationId = process.env.AGENT_CRM_LOCATION_ID;

    if (!piToken || !locationId) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      contactId,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    } = body as Record<string, string | undefined>;

    if (
      !contactId ||
      !email?.trim() ||
      !addressLine1?.trim() ||
      !city?.trim() ||
      !state?.trim() ||
      !postalCode?.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          required: [
            "contactId",
            "email",
            "addressLine1",
            "city",
            "state",
            "postalCode",
          ],
        },
        { status: 400 }
      );
    }

    const zipNorm = postalCode.replace(/\D/g, "");
    if (zipNorm.length < 5) {
      return NextResponse.json(
        { success: false, error: "Invalid postal code" },
        { status: 400 }
      );
    }

    const baseUrl = "https://services.leadconnectorhq.com";
    const q = new URLSearchParams({ locationId });

    const getRes = await fetch(
      `${baseUrl}/contacts/${encodeURIComponent(contactId)}?${q}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${piToken}`,
          Version: "2021-07-28",
        },
      }
    );

    if (!getRes.ok) {
      const errTxt = await getRes.text();
      console.error("[contact-append-address] GET contact failed:", getRes.status, errTxt);
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }

    const raw = await getRes.json();
    const contact = unwrapContactRecord(raw);
    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }
    // When `id` is present it must match; some responses omit `id` on nested `contact`.
    if (
      contact.id != null &&
      String(contact.id) !== String(contactId)
    ) {
      console.error("[contact-append-address] Contact id mismatch:", {
        requested: contactId,
        got: contact.id,
      });
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }

    const requestedEmail = email.toLowerCase().trim();
    const crmEmail = extractCrmEmail(contact);
    const crmPhone = typeof contact.phone === "string" ? contact.phone : "";
    const emailOk = Boolean(crmEmail) && crmEmail === requestedEmail;
    const phoneOk =
      Boolean(phone?.trim()) &&
      Boolean(crmPhone) &&
      phonesMatch(phone!, crmPhone);

    if (!emailOk && !phoneOk) {
      console.warn("[contact-append-address] Auth mismatch:", {
        requestedEmail,
        crmEmailPresent: Boolean(crmEmail),
        crmEmailMasked: crmEmail ? `${crmEmail.slice(0, 2)}***` : "",
        phoneOkAttempted: Boolean(phone?.trim()),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          hint: "Email or phone did not match this contact.",
        },
        { status: 403 }
      );
    }

    const addressPayload: Record<string, string> = {
      address1: addressLine1.trim(),
      city: city.trim(),
      state:
        state.trim().length === 2
          ? state.trim().toUpperCase()
          : state.trim(),
      postalCode: postalCode.trim(),
    };
    if (addressLine2?.trim()) {
      addressPayload.address2 = addressLine2.trim();
    }
    const ctry = (country || "US").trim().toUpperCase();
    if (ctry) {
      addressPayload.country = ctry;
    }

    const putUrl = `${baseUrl}/contacts/${encodeURIComponent(contactId)}?${q}`;

    let putRes = await fetch(putUrl, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${piToken}`,
        Version: "2021-07-28",
      },
      body: JSON.stringify(addressPayload),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      console.error(
        "[contact-append-address] CRM PUT failed:",
        putRes.status,
        errText
      );

      // Some workspaces reject `country`; retry without it.
      if (addressPayload.country) {
        const { country: _c, ...withoutCountry } = addressPayload;
        putRes = await fetch(putUrl, {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${piToken}`,
            Version: "2021-07-28",
          },
          body: JSON.stringify(withoutCountry),
        });
      }

      if (!putRes.ok) {
        const err2 = await putRes.text();
        console.error(
          "[contact-append-address] CRM PUT retry failed:",
          putRes.status,
          err2
        );
        return NextResponse.json(
          {
            success: false,
            error: "Failed to save address",
            details:
              process.env.NODE_ENV === "development" ? err2.slice(0, 500) : undefined,
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[contact-append-address]", e);
    return NextResponse.json(
      { success: false, error: "Unexpected error" },
      { status: 500 }
    );
  }
}
