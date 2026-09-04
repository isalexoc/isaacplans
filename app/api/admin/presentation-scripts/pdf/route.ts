import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  isScriptLob,
  isScriptPdfLanguage,
  isScriptPdfVariant,
  presentationScriptFilename,
  type ScriptLanguage,
} from "@/lib/presentation-scripts/format";
import {
  blocksToPrint,
  buildScriptPdfPayload,
  fetchScriptPdfSource,
  isEmptyPayload,
  loadScriptImages,
} from "@/lib/presentation-scripts/pdf-content";
import { renderScriptPdf } from "@/lib/presentation-scripts/pdf";

// @react-pdf/renderer needs the Node runtime (it is not edge-compatible), and a long Final Expense
// script with inline images takes a few seconds to fetch, lay out and paginate.
export const runtime = "nodejs";
export const maxDuration = 60;

// Security: /api/admin/* is admin-gated by middleware; auth() here is defense-in-depth.

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    const lob = body?.lineOfBusiness;
    if (!isScriptLob(lob)) {
      return NextResponse.json(
        { success: false, error: "Unknown line of business" },
        { status: 400 }
      );
    }

    const language = isScriptPdfLanguage(body?.language) ? body.language : "en";
    const variant = isScriptPdfVariant(body?.variant) ? body.variant : "full";

    // One Sanity read serves both languages of a bilingual export.
    const source = await fetchScriptPdfSource(lob);

    const languages: ScriptLanguage[] = language === "both" ? ["en", "es"] : [language];
    const payloads = languages
      .map((lang) => buildScriptPdfPayload(source, lob, lang))
      .filter((payload) => !isEmptyPayload(payload, variant));

    if (payloads.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "There is nothing published to print for that product yet. Add the script in Sanity Studio first.",
        },
        { status: 404 }
      );
    }

    const images = await loadScriptImages(blocksToPrint(payloads, variant));
    const pdf = await renderScriptPdf({ payloads, variant, images });
    const filename = presentationScriptFilename(lob, language, variant);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // attachment, not inline: the ask is a file to keep and print later, not a print dialog.
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin/presentation-scripts/pdf] POST", error);
    return NextResponse.json(
      { success: false, error: "Failed to build the PDF" },
      { status: 500 }
    );
  }
}
