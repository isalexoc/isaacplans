import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  createMailingLabel,
  deleteMailingLabels,
  listMailingLabels,
  setMailingLabelsStatus,
} from "@/lib/mailing-labels/server";
import { getMailingLabelSettings } from "@/lib/mailing-labels/settings";
import {
  MAILING_LABEL_SOURCES,
  MAILING_LABEL_STATUSES,
  type MailingLabelSource,
  type MailingLabelStatus,
} from "@/lib/mailing-labels/types";

// Security: /api/admin/* is enforced by middleware (401 signed-out, 403 non-admin) — the auth()
// checks below are defense-in-depth.

function parseStatus(value: string | null): MailingLabelStatus | "all" {
  if (value && (MAILING_LABEL_STATUSES as readonly string[]).includes(value)) {
    return value as MailingLabelStatus;
  }
  return "all";
}

function parseSource(value: string | null): MailingLabelSource | "all" {
  if (value && (MAILING_LABEL_SOURCES as readonly string[]).includes(value)) {
    return value as MailingLabelSource;
  }
  return "all";
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const [labels, settings] = await Promise.all([
      listMailingLabels({
        status: parseStatus(params.get("status")),
        source: parseSource(params.get("source")),
        q: params.get("q") ?? undefined,
      }),
      getMailingLabelSettings(),
    ]);

    return NextResponse.json({ success: true, labels, settings });
  } catch (error) {
    console.error("[admin/mailing-labels] GET", error);
    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load labels. If this is the first use, apply the database migration (pnpm db:migrate).",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const label = await createMailingLabel(body?.label ?? {}, userId);
    if (!label) {
      return NextResponse.json(
        {
          success: false,
          error: "A street address, city, state, and ZIP code are all required to print a label.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, label });
  } catch (error) {
    console.error("[admin/mailing-labels] POST", error);
    return NextResponse.json({ success: false, error: "Failed to save label" }, { status: 500 });
  }
}

/** Bulk status change / delete, so the queue's multi-select actions are one round trip. */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === "string")
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: "No labels selected" }, { status: 400 });
    }

    if (body?.action === "delete") {
      const deleted = await deleteMailingLabels(ids);
      return NextResponse.json({ success: true, affected: deleted });
    }

    const status = body?.status;
    if (!(MAILING_LABEL_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { success: false, error: "Unknown action" },
        { status: 400 }
      );
    }

    const affected = await setMailingLabelsStatus(ids, status as MailingLabelStatus);
    return NextResponse.json({ success: true, affected });
  } catch (error) {
    console.error("[admin/mailing-labels] PATCH", error);
    return NextResponse.json(
      { success: false, error: "Failed to update labels" },
      { status: 500 }
    );
  }
}
