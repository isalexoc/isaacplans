"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SALE_STICKER_RENDER_SIZE } from "@/lib/sale-sticker-assets";

/**
 * Displays a fixed-width sticker node (natural height) scaled to fit its
 * container width. The child keeps its native pixel size (so html2canvas
 * captures at full resolution); only the on-screen presentation is scaled.
 */
export function StickerPreviewFrame({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      const s = outer.clientWidth / SALE_STICKER_RENDER_SIZE;
      setScale(s);
      setHeight(inner.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} style={{ position: "relative", width: "100%", height }}>
      <div
        ref={innerRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: SALE_STICKER_RENDER_SIZE,
          transformOrigin: "top left",
          transform: `scale(${scale || 0.0001})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
