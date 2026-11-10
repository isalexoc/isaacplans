import { NextRequest, NextResponse } from "next/server";
import { SAFE_ID_RE } from "@/lib/aca-confirmation/format";
import { renderSignedConfirmationPdf, signedPdfFilename } from "@/lib/aca-confirmation/finalize";
import { apiError, requireAdminUser } from "@/lib/aca-confirmation/route-helpers";
import { fetchStoredConfirmationPdf } from "@/lib/aca-confirmation/storage";
import { getConfirmationRow } from "@/lib/aca-confirmation/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/aca-confirmation/requests/[id]/pdf[?download=1] — admin only: the signed PDF.
 *
 * Serves the archived copy whenever there is one: that is the file whose hash is on the row and
 * the one CMS would get. Only before the archive step has run does it render one on the fly from
 * the same snapshot (not stored). The bytes are streamed from here, so the signed Cloudinary URL
 * never reaches the browser.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const userId = await requireAdminUser();
    if (userId instanceof NextResponse) return userId;
    if (!SAFE_ID_RE.test(id)) return apiError(400, "Invalid confirmation.");

    const row = await getConfirmationRow(id);
    if (!row || row.status !== "signed") return apiError(404, "There is no signed PDF for this confirmation.");

    // Once archived, only the archived file is ever served: a re-render is a different file with a
    // different hash, and handing it over as "the signed PDF" (to CMS, say) would be wrong.
    let pdf: Buffer;
    if (row.pdfPublicId) {
      const stored = await fetchStoredConfirmationPdf(row.pdfPublicId);
      if (!stored) return apiError(502, "The archived PDF couldn't be fetched right now. Try again in a minute.");
      pdf = stored;
    } else {
      pdf = await renderSignedConfirmationPdf(row);
    }
    const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${signedPdfFilename(row)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[aca-confirmation/requests/:id/pdf] GET", error);
    return apiError(500, "Failed to load the PDF.");
  }
}
