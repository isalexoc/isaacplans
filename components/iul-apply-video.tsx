/**
 * Video for the public IUL apply page. Renders the Cloudinary recording when
 * NEXT_PUBLIC_IUL_APPLY_VIDEO_URL is set; otherwise shows a "coming soon" placeholder so the
 * page builds and works before the agent uploads their recording.
 */
import { Film } from "lucide-react";

export default function IulApplyVideo({ comingSoonLabel }: { comingSoonLabel: string }) {
  const src = process.env.NEXT_PUBLIC_IUL_APPLY_VIDEO_URL;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-gray-900 shadow-xl shadow-black/10">
      {src ? (
        <video controls playsInline preload="metadata" className="h-full w-full">
          <source src={src} />
        </video>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-gray-900 to-gray-700 text-gray-300">
          <Film className="h-12 w-12 opacity-70" />
          <span className="text-sm font-medium">{comingSoonLabel}</span>
        </div>
      )}
    </div>
  );
}
