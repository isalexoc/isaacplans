export type ShareLeaveBehindImageResult = "shared" | "downloaded" | "cancelled";

export function canAttemptWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * Share a PNG via the Web Share API when possible; otherwise trigger a file download.
 */
export async function shareLeaveBehindPng(options: {
  blob: Blob;
  filename: string;
  title: string;
  text: string;
  downloadFallback: () => void;
}): Promise<ShareLeaveBehindImageResult> {
  const file = new File([options.blob], options.filename, { type: "image/png" });

  if (canAttemptWebShare()) {
    const payloads: ShareData[] = [
      { files: [file], title: options.title, text: options.text },
      { files: [file], title: options.title },
      { files: [file] },
    ];

    for (const payload of payloads) {
      try {
        if (navigator.canShare && !navigator.canShare(payload)) {
          continue;
        }
        await navigator.share(payload);
        return "shared";
      } catch (error) {
        const name = (error as Error).name;
        if (name === "AbortError") return "cancelled";
        if (name === "NotAllowedError") break;
      }
    }

    // Some browsers report canShare=false but still accept share — try once without canShare.
    try {
      await navigator.share({ files: [file], title: options.title, text: options.text });
      return "shared";
    } catch (error) {
      const name = (error as Error).name;
      if (name === "AbortError") return "cancelled";
    }
  }

  options.downloadFallback();
  return "downloaded";
}
