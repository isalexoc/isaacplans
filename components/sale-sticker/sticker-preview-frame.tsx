"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SALE_STICKER_RENDER_SIZE } from "@/lib/sale-sticker-assets";

/**
 * Displays a fixed-size (540px) sticker node scaled down to fit its container.
 * The child keeps its native pixel size (so html2canvas captures at full
 * resolution); only the on-screen presentation is scaled via CSS transform.
 */
export function StickerPreviewFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / SALE_STICKER_RENDER_SIZE);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", aspectRatio: "1 / 1" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: SALE_STICKER_RENDER_SIZE,
          height: SALE_STICKER_RENDER_SIZE,
          transformOrigin: "top left",
          transform: `scale(${scale || 0.0001})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
