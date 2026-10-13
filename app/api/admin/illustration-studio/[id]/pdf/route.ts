import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { summaryPdfFilename } from "@/lib/illustration-studio/format";
import { renderSummaryPdf } from "@/lib/illustration-studio/pdf-render";
import { getIllustrationSummary } from "@/lib/illustration-studio/store";

// @react-pdf/renderer needs the Node runtime; two pages with two images render in well under a
// second once the images are cached, a few seconds cold.
export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

// Security: /api/admin/* is enforced by middleware; auth() here is defense-in-depth.

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const summary = await getIllustrationSummary(id);
    if (!summary) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const pdf = await renderSummaryPdf(summary.presentation);
    const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${summaryPdfFilename(summary.presentation)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin/illustration-studio/:id/pdf] GET", error);
    return NextResponse.json({ success: false, error: "Couldn't build the PDF." }, { status: 500 });
  }
}
