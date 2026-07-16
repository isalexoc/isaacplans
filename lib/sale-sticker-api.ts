import type { SaleStickerData, SaleStickerRecord } from "@/lib/sale-sticker";

async function parseJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      res.status === 401
        ? "Please sign in to continue."
        : "Server returned an unexpected response. Try refreshing the page."
    );
  }
  const data = await res.json();
  if (!res.ok) {
    const message =
      typeof data === "object" && data && "error" in data && typeof data.error === "string"
        ? data.error
        : "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export async function fetchSaleStickers(): Promise<SaleStickerRecord[]> {
  const data = await parseJson<{ success: boolean; stickers: SaleStickerRecord[] }>(
    await fetch("/api/sale-sticker/stickers", { credentials: "same-origin" })
  );
  return data.stickers;
}

export async function saveSaleSticker(input: {
  id?: string | null;
  saleDate: string;
  data: SaleStickerData;
}): Promise<SaleStickerRecord> {
  const isUpdate = Boolean(input.id);
  const url = isUpdate
    ? `/api/sale-sticker/stickers/${input.id}`
    : "/api/sale-sticker/stickers";
  const data = await parseJson<{ success: boolean; sticker: SaleStickerRecord }>(
    await fetch(url, {
      method: isUpdate ? "PATCH" : "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saleDate: input.saleDate, data: input.data }),
    })
  );
  return data.sticker;
}

export async function deleteSaleSticker(id: string): Promise<void> {
  await parseJson(
    await fetch(`/api/sale-sticker/stickers/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    })
  );
}

/** Send PNG frames to the server and get back an animated WebP sticker or GIF. */
export async function requestAnimatedSticker(
  frames: Blob[],
  fps: number,
  format: "webp" | "gif" = "webp"
): Promise<Blob> {
  const formData = new FormData();
  frames.forEach((frame, i) => formData.append("frames", frame, `frame_${i}.png`));
  formData.append("fps", String(fps));
  formData.append("format", format);
  const res = await fetch("/api/sale-sticker/animate", {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });
  if (!res.ok) {
    let message = "Failed to build animated sticker";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // non-JSON error
    }
    throw new Error(message);
  }
  return res.blob();
}

export async function uploadSaleStickerExtraImage(
  file: File
): Promise<{ url: string; publicId: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/sale-sticker/upload", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? "Failed to upload image");
  }
  return { url: data.url as string, publicId: data.publicId as string };
}
