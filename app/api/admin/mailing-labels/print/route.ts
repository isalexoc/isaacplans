import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveMailingLabelAgent } from "@/lib/mailing-labels/agent";
import {
  DEFAULT_TAGLINES,
  isCompleteSenderAddress,
  mailingLabelFilename,
  missingSenderFields,
} from "@/lib/mailing-labels/format";
import { renderLabels } from "@/lib/mailing-labels/pdf";
import {
  clampStartOffset,
  getLabelPreset,
  isLabelPresetId,
  isShippingPreset,
} from "@/lib/mailing-labels/presets";
import { getMailingLabelsByIds, setMailingLabelsStatus } from "@/lib/mailing-labels/server";
import { getMailingLabelSettings } from "@/lib/mailing-labels/settings";
import type { LabelAgentContact, LabelSheetOptions } from "@/lib/mailing-labels/types";

// @react-pdf/renderer needs the Node runtime (it is not edge-compatible), and a large sheet of
// labels can take a few seconds to lay out.
export const runtime = "nodejs";
export const maxDuration = 60;

// Security: /api/admin/* is enforced by middleware; auth() here is defense-in-depth.

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const presetId = body?.preset;
    if (!isLabelPresetId(presetId)) {
      return NextResponse.json({ success: false, error: "Unknown label size" }, { status: 400 });
    }
    const preset = getLabelPreset(presetId);

    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === "string")
      : [];
    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Select at least one prospect to print." },
        { status: 400 }
      );
    }

    const labels = await getMailingLabelsByIds(ids);
    if (labels.length === 0) {
      return NextResponse.json(
        { success: false, error: "Those labels no longer exist." },
        { status: 404 }
      );
    }

    const settings = await getMailingLabelSettings();

    // Priority Mail is unmailable without a real return address, so fail loudly and early
    // rather than printing a label the post office will reject.
    if (isShippingPreset(preset) && !isCompleteSenderAddress(settings.sender)) {
      const missing = missingSenderFields(settings.sender);
      return NextResponse.json(
        {
          success: false,
          error: `Add your sender address in Settings before printing a Priority Mail label. Missing: ${missing.join(", ")}.`,
          code: "sender_incomplete",
        },
        { status: 400 }
      );
    }

    const requested = (body?.options ?? {}) as Partial<LabelSheetOptions>;
    const options: LabelSheetOptions = {
      startOffset: clampStartOffset(preset, Number(requested.startOffset ?? 0)),
      showLogo:
        typeof requested.showLogo === "boolean"
          ? requested.showLogo
          : settings.defaults.showLogo,
      showAgentContact:
        typeof requested.showAgentContact === "boolean"
          ? requested.showAgentContact
          : settings.defaults.showAgentContact,
      taglines: {
        en: requested.taglines?.en?.trim() || settings.defaults.taglines.en || DEFAULT_TAGLINES.en,
        es: requested.taglines?.es?.trim() || settings.defaults.taglines.es || DEFAULT_TAGLINES.es,
      },
    };

    // Settings override first, then the shared leave-behind profile.
    const agent: LabelAgentContact | null = options.showAgentContact
      ? await resolveMailingLabelAgent(userId)
      : null;

    const pdf = await renderLabels({
      labels,
      preset,
      options,
      agent,
      sender: settings.sender,
    });

    // Printing is the point of no return for a physical label, so the queue is marked here.
    // "Reset to pending" in the UI undoes it.
    if (body?.markPrinted !== false) {
      await setMailingLabelsStatus(
        labels.map((l) => l.id),
        "printed"
      );
    }

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${mailingLabelFilename(presetId, labels.length)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin/mailing-labels/print] POST", error);
    return NextResponse.json(
      { success: false, error: "Failed to build the PDF" },
      { status: 500 }
    );
  }
}
