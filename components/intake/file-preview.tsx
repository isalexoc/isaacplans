"use client";

import { useState } from "react";
import { FileText, File as FileIcon, ImageOff } from "lucide-react";
import type { FileRef } from "@/lib/intake-core/types";

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic|heif|tiff?)$/i;
const PDF_EXT_RE = /\.pdf$/i;

/** Extension test against the filename, falling back to the URL path (query stripped). */
function matches(re: RegExp, file: FileRef): boolean {
  if (re.test(file.name ?? "")) return true;
  const path = (file.url ?? "").split("?")[0].split("#")[0];
  return re.test(path);
}

export function isImageFile(file: FileRef): boolean {
  return matches(IMAGE_EXT_RE, file);
}

export function isPdfFile(file: FileRef): boolean {
  return matches(PDF_EXT_RE, file);
}

/**
 * Square thumbnail for an uploaded file.
 *
 * Images render inline; anything else (and anything the browser fails to decode — HEIC is
 * the common one, since iPhones upload it happily but few browsers display it) falls back to
 * a type icon, so a client always sees *something* confirming their upload landed.
 *
 * Uses a plain <img> rather than next/image on purpose: these are arbitrary Agent CRM CDN
 * URLs, and next/image would need every possible storage host in next.config remotePatterns
 * or it throws at render time.
 */
export default function FilePreview({
  file,
  size = 48,
}: {
  file: FileRef;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  const showImage = !!file.url && isImageFile(file) && !failed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={file.url}
        alt={file.name || "Uploaded file"}
        loading="lazy"
        style={box}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-md border border-border bg-muted object-cover"
      />
    );
  }

  const Icon = isPdfFile(file) ? FileText : failed ? ImageOff : FileIcon;
  return (
    <span
      style={box}
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}
