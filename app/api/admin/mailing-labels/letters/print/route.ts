import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { renderProspectLetters } from "@/lib/mailing-labels/letter-pdf";
import { resolveMailingLabelAgent } from "@/lib/mailing-labels/agent";
import { getMailingLabelsByIds } from "@/lib/mailing-labels/server";

// @react-pdf/renderer needs the Node runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

// Security: /api/admin/* is enforced by middleware; auth() here is defense-in-depth.

/** POST { ids } → a PDF with one letter per page, ready to fold into the envelopes. */
export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { success: false, error: "Select at least one letter to print." },
        { status: 400 }
      );
    }

    const agent = await resolveMailingLabelAgent(userId);
    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Set the name that signs your letters in Settings (or fill in the Leave-Behind agent profile).",
        },
        { status: 400 }
      );
    }

    const records = (await getMailingLabelsByIds(ids)).filter((r) => r.letterBody.trim());
    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: "None of those prospects have a letter written yet." },
        { status: 400 }
      );
    }

    const pdf = await renderProspectLetters({ records, agent });
    const noun = records.length === 1 ? "letter" : "letters";

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="prospect-${records.length}-${noun}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin/mailing-labels/letters/print] POST", error);
    return NextResponse.json(
      { success: false, error: "Failed to build the letter PDF" },
      { status: 500 }
    );
  }
}
