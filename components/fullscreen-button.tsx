"use client";

import { useState, useEffect, useRef } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** iOS/iPadOS uses native fullscreen and shows "Swipe down to exit" — we use CSS fullscreen instead so only our button exits. */
function isIOSOrIPad(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}

const CUSTOM_FULLSCREEN_CLASS = "presentation-fullscreen-custom";
const CUSTOM_FULLSCREEN_EVENT = "presentation-fullscreen-change";

interface FullscreenButtonProps {
  targetId?: string;
  className?: string;
  label?: string;
  exitLabel?: string;
}

export default function FullscreenButton({
  targetId,
  className,
  label = "Enter Fullscreen",
  exitLabel = "Exit Fullscreen",
}: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const useCustomFullscreen = useRef(false);

  useEffect(() => {
    useCustomFullscreen.current = isIOSOrIPad() && !!targetId;
  }, [targetId]);

  useEffect(() => {
    const checkFullscreen = () => {
      const nativeFs = !!(
        document.fullscreenElement ??
        (document as any).webkitFullscreenElement ??
        (document as any).mozFullScreenElement ??
        (document as any).msFullscreenElement
      );
      const customFs = document.body.classList.contains(CUSTOM_FULLSCREEN_CLASS);
      setIsFullscreen(nativeFs || customFs);
      if (nativeFs) {
        document.body.classList.add("presentation-fullscreen");
      } else if (!customFs) {
        document.body.classList.remove("presentation-fullscreen");
      }
    };

    checkFullscreen();
    document.addEventListener("fullscreenchange", checkFullscreen);
    document.addEventListener("webkitfullscreenchange", checkFullscreen);
    document.addEventListener("mozfullscreenchange", checkFullscreen);
    document.addEventListener("MSFullscreenChange", checkFullscreen);
    document.addEventListener(CUSTOM_FULLSCREEN_EVENT, checkFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", checkFullscreen);
      document.removeEventListener("webkitfullscreenchange", checkFullscreen);
      document.removeEventListener("mozfullscreenchange", checkFullscreen);
      document.removeEventListener("MSFullscreenChange", checkFullscreen);
      document.removeEventListener(CUSTOM_FULLSCREEN_EVENT, checkFullscreen);
      document.body.classList.remove("presentation-fullscreen", CUSTOM_FULLSCREEN_CLASS);
    };
  }, []);

  // Inject CSS for custom fullscreen (iOS) so target fills viewport without native fullscreen API
  useEffect(() => {
    if (!targetId || !isIOSOrIPad()) return;
    const id = targetId.startsWith("#") ? targetId.slice(1) : targetId;
    const style = document.createElement("style");
    style.setAttribute("data-presentation-custom-fullscreen", "true");
    style.textContent = `
      body.${CUSTOM_FULLSCREEN_CLASS} { overflow: hidden !important; }
      body.${CUSTOM_FULLSCREEN_CLASS} #${id} {
        position: fixed !important;
        inset: 0 !important;
        z-index: 99999 !important;
        width: 100vw !important;
        height: 100vh !important;
        min-height: 100vh !important;
        max-height: 100vh !important;
        border-radius: 0 !important;
        background: var(--background, #f8fafc) !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      const s = document.querySelector("[data-presentation-custom-fullscreen=true]");
      if (s) s.remove();
    };
  }, [targetId]);

  const toggleFullscreen = async () => {
    const useCustom = useCustomFullscreen.current;
    const element = targetId ? document.getElementById(targetId) : document.documentElement;
    if (!element) return;

    if (useCustom) {
      if (!isFullscreen) {
        document.body.classList.add(CUSTOM_FULLSCREEN_CLASS, "presentation-fullscreen");
        document.dispatchEvent(new CustomEvent(CUSTOM_FULLSCREEN_EVENT));
        setIsFullscreen(true);
      } else {
        document.body.classList.remove(CUSTOM_FULLSCREEN_CLASS, "presentation-fullscreen");
        document.dispatchEvent(new CustomEvent(CUSTOM_FULLSCREEN_EVENT));
        setIsFullscreen(false);
      }
      return;
    }

    try {
      if (!isFullscreen) {
        if (element.requestFullscreen) await element.requestFullscreen();
        else if ((element as any).webkitRequestFullscreen) await (element as any).webkitRequestFullscreen();
        else if ((element as any).mozRequestFullScreen) await (element as any).mozRequestFullScreen();
        else if ((element as any).msRequestFullscreen) await (element as any).msRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen();
        else if ((document as any).mozCancelFullScreen) await (document as any).mozCancelFullScreen();
        else if ((document as any).msExitFullscreen) await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error);
    }
  };

  return (
    <Button
      ref={buttonRef}
      onClick={toggleFullscreen}
      variant="outline"
      size="default"
      className={cn("relative gap-2", className)}
      aria-label={isFullscreen ? exitLabel : label}
      title={isFullscreen ? exitLabel : label}
    >
      {isFullscreen ? (
        <>
          <Minimize2 className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium whitespace-nowrap">{exitLabel}</span>
        </>
      ) : (
        <>
          <Maximize2 className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium whitespace-nowrap">{label}</span>
        </>
      )}
    </Button>
  );
}

