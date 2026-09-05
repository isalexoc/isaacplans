import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { callPdfFilename, renderCallPdf } from "@/lib/call-study/pdf";
import { getRecording } from "@/lib/call-study/store";

/**
 * The annotated transcript as a PDF.
 *
 * GET rather than POST so the browser can open it in a new tab and the agent can print or save it
 * with the viewer's own controls — there is nothing to submit, and every input is in the URL.
 *
 * @react-pdf/renderer needs the Node runtime (it is not edge-compatible), and a two-hour call is
 * 40-60 pages of layout.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await getIsAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const row = await getRecording(id);
    if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    if (row.ownerUserId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!row.turns || row.turns.length === 0) {
      return NextResponse.json(
        { success: false, error: "This call has not been transcribed yet." },
        { status: 400 }
      );
    }

    const pdf = await renderCallPdf({
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      durationSeconds: row.durationSeconds,
      outcome: row.outcome as never,
      lineOfBusiness: row.lineOfBusiness,
      languageCode: row.languageCode,
      turns: row.turns,
      speakerMap: row.speakerMap ?? null,
      metrics: row.metrics ?? null,
      analysis: row.analysis ?? null,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${callPdfFilename(row.title)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[call-study/recordings/:id/pdf] GET", error);
    return NextResponse.json({ success: false, error: "Failed to build the PDF" }, { status: 500 });
  }
}
