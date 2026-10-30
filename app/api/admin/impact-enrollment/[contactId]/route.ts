import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { impactEnrollmentInputSchema } from "@/lib/impact-enrollment/format";
import {
  getImpactEnrollmentDetail,
  sendImpactWelcome,
  type ImpactCardUpload,
} from "@/lib/impact-enrollment/server";

type RouteContext = { params: Promise<{ contactId: string }> };

const CONTACT_ID = /^[A-Za-z0-9_-]{1,64}$/;
// Vercel caps a request body at 4.5 MB; the real card PDF is ~190 KB and its JPG a few hundred.
const MAX_PDF_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

async function startsWith(file: Blob, magic: number[]): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, magic.length).arrayBuffer());
  return magic.every((byte, i) => head[i] === byte);
}

/** Both files or neither (reuse the stored card). Checked by content, not by the name or type sent. */
async function readCard(form: FormData): Promise<ImpactCardUpload | string> {
  const pdf = form.get("cardPdf");
  const image = form.get("cardImage");
  if (!pdf && !image) return null;
  if (!(pdf instanceof Blob) || !(image instanceof Blob)) return "Upload the member ID card again.";
  if (pdf.size > MAX_PDF_BYTES) return "That PDF is too large (3 MB max).";
  if (image.size > MAX_IMAGE_BYTES) return "The card image is too large.";
  if (!(await startsWith(pdf, [0x25, 0x50, 0x44, 0x46, 0x2d]))) return "The member ID card must be a PDF.";
  if (!(await startsWith(image, [0xff, 0xd8, 0xff]))) return "The card image could not be read. Upload the PDF again.";
  return { pdf, image };
}

/** Admin gate shared by both verbs. Returns the Clerk user id, or the response to send back. */
async function requireAdmin(): Promise<string | NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!(await getIsAdmin())) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  return userId;
}

// GET /api/admin/impact-enrollment/[contactId] — admin only: the contact as the CRM has it, what was last
// sent, and which language workflows are configured.
export async function GET(_request: NextRequest, context: RouteContext) {
  const { contactId } = await context.params;
  try {
    const userId = await requireAdmin();
    if (userId instanceof NextResponse) return userId;
    if (!CONTACT_ID.test(contactId)) {
      return NextResponse.json({ success: false, error: "Invalid contact" }, { status: 400 });
    }

    const result = await getImpactEnrollmentDetail(contactId);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, ...result.data });
  } catch (error) {
    console.error("[impact-enrollment/:contactId] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load the enrollment" }, { status: 500 });
  }
}

// POST /api/admin/impact-enrollment/[contactId] — admin only, multipart: `data` (JSON input) plus
// `cardPdf` + `cardImage` (omit both to reuse the stored card). Sends the welcome email with the
// card attached and/or fires the texts/WhatsApp workflow, records the send, notes the contact.
export async function POST(request: NextRequest, context: RouteContext) {
  const { contactId } = await context.params;
  try {
    const userId = await requireAdmin();
    if (userId instanceof NextResponse) return userId;
    if (!CONTACT_ID.test(contactId)) {
      return NextResponse.json({ success: false, error: "Invalid contact" }, { status: 400 });
    }

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    const rawData = form.get("data");
    let json: unknown = null;
    try {
      json = typeof rawData === "string" ? JSON.parse(rawData) : null;
    } catch {
      /* falls through to the schema error */
    }
    const parsed = impactEnrollmentInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const card = await readCard(form);
    if (typeof card === "string") return NextResponse.json({ success: false, error: card }, { status: 400 });

    const user = await currentUser();
    const agentName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

    const result = await sendImpactWelcome({ contactId, input: parsed.data, card, userId, agentName });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, ...result.data });
  } catch (error) {
    console.error("[impact-enrollment/:contactId] POST", error);
    return NextResponse.json({ success: false, error: "Failed to send the welcome" }, { status: 500 });
  }
}
