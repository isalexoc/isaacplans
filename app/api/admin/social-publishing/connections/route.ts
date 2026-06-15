import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listConnections, deleteConnection } from "@/lib/social-publishing/connection-manager";
import type { SocialPlatform } from "@/lib/social-publishing/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connections = await listConnections(userId);

  // Strip decrypted tokens before sending to client
  const safe = connections.map(({ accessToken: _a, refreshToken: _r, ...c }) => c);
  return NextResponse.json({ success: true, data: safe });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform } = await req.json() as { platform: SocialPlatform };
  if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });

  await deleteConnection(userId, platform);
  return NextResponse.json({ success: true });
}
