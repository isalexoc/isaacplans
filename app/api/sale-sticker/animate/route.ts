import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const maxDuration = 60;

const execFileAsync = promisify(execFile);

const MAX_FRAMES = 30;
const MIN_FRAMES = 2;
const MAX_FRAME_BYTES = 1.5 * 1024 * 1024;
const WHATSAPP_ANIM_MAX_BYTES = 500 * 1024;

async function getFfmpegPath(): Promise<string> {
  const mod = await import("ffmpeg-static");
  const ffmpegPath = mod.default as string | null;
  if (!ffmpegPath) throw new Error("ffmpeg-static binary not available for this platform");
  await fs.access(ffmpegPath);
  return ffmpegPath;
}

async function encodeAnimatedWebp(
  ffmpeg: string,
  dir: string,
  fps: number,
  quality: number
): Promise<Buffer> {
  const out = join(dir, "out.webp");
  await execFileAsync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-framerate",
      String(fps),
      "-i",
      join(dir, "frame_%03d.png"),
      "-c:v",
      "libwebp_anim",
      "-loop",
      "0",
      "-lossless",
      "0",
      "-q:v",
      String(quality),
      "-compression_level",
      "6",
      "-an",
      out,
    ],
    { maxBuffer: 20 * 1024 * 1024 }
  );
  return fs.readFile(out);
}

async function encodeAnimatedGif(ffmpeg: string, dir: string, fps: number): Promise<Buffer> {
  const out = join(dir, "out.gif");
  // Two-pass palette in one graph for clean colors; -loop 0 = infinite loop.
  await execFileAsync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-framerate",
      String(fps),
      "-i",
      join(dir, "frame_%03d.png"),
      "-vf",
      "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a",
      "-loop",
      "0",
      out,
    ],
    { maxBuffer: 40 * 1024 * 1024 }
  );
  return fs.readFile(out);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const frames = formData.getAll("frames").filter((f): f is File => f instanceof File);
  const fpsRaw = Number(formData.get("fps"));
  const fps = Number.isFinite(fpsRaw) && fpsRaw >= 4 && fpsRaw <= 30 ? Math.round(fpsRaw) : 14;
  const format = formData.get("format") === "gif" ? "gif" : "webp";

  if (frames.length < MIN_FRAMES || frames.length > MAX_FRAMES) {
    return NextResponse.json(
      { success: false, error: `Provide ${MIN_FRAMES}–${MAX_FRAMES} frames` },
      { status: 400 }
    );
  }
  for (const frame of frames) {
    if (frame.type !== "image/png" || frame.size > MAX_FRAME_BYTES) {
      return NextResponse.json(
        { success: false, error: "Frames must be PNG images under 1.5 MB each" },
        { status: 400 }
      );
    }
  }

  const dir = join(tmpdir(), `sale-sticker-${nanoid()}`);

  try {
    await fs.mkdir(dir, { recursive: true });
    await Promise.all(
      frames.map(async (frame, i) => {
        const buffer = Buffer.from(await frame.arrayBuffer());
        const name = `frame_${String(i).padStart(3, "0")}.png`;
        await fs.writeFile(join(dir, name), buffer);
      })
    );

    const ffmpeg = await getFfmpegPath();

    if (format === "gif") {
      const gif = await encodeAnimatedGif(ffmpeg, dir, fps);
      return new NextResponse(new Uint8Array(gif), {
        status: 200,
        headers: {
          "Content-Type": "image/gif",
          "Content-Length": String(gif.byteLength),
          "Cache-Control": "no-store",
        },
      });
    }

    // WebP sticker; if the WhatsApp 500 KB animated limit is exceeded, retry lossier.
    let webp = await encodeAnimatedWebp(ffmpeg, dir, fps, 60);
    if (webp.byteLength > WHATSAPP_ANIM_MAX_BYTES) {
      webp = await encodeAnimatedWebp(ffmpeg, dir, fps, 40);
    }

    return new NextResponse(new Uint8Array(webp), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(webp.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[sale-sticker/animate]", error);
    return NextResponse.json(
      { success: false, error: "Failed to build animated sticker" },
      { status: 500 }
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
