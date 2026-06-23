/**
 * Media slot for the public IUL apply page. Renders the Cloudinary recording when
 * NEXT_PUBLIC_IUL_APPLY_VIDEO_URL is set; otherwise shows a locale-specific Cloudinary image
 * placeholder (passed in by the page), falling back to a "coming soon" tile.
 */
import { Film } from "lucide-react";

export default function IulApplyVideo({
  comingSoonLabel,
  imageUrl,
  imageAlt,
}: {
  comingSoonLabel: string;
  imageUrl?: string;
  imageAlt?: string;
}) {
  const src = process.env.NEXT_PUBLIC_IUL_APPLY_VIDEO_URL;

  if (src) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-gray-900 shadow-xl shadow-black/10">
        <video controls playsInline preload="metadata" poster={imageUrl} className="h-full w-full">
          <source src={src} />
        </video>
      </div>
    );
  }

  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imageUrl}
        alt={imageAlt ?? ""}
        className="w-full rounded-2xl border shadow-xl shadow-black/10"
      />
    );
  }

  return (
    <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br from-gray-900 to-gray-700 text-gray-300 shadow-xl shadow-black/10">
      <Film className="h-12 w-12 opacity-70" />
      <span className="text-sm font-medium">{comingSoonLabel}</span>
    </div>
  );
}
