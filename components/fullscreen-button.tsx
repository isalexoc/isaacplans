"use client";

import { useState, useEffect, useRef } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreenNow = !!document.fullscreenElement;
      setIsFullscreen(isFullscreenNow);
      
      // Add/remove class to body for fullscreen styling
      if (isFullscreenNow) {
        document.body.classList.add("presentation-fullscreen");
      } else {
        document.body.classList.remove("presentation-fullscreen");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      document.body.classList.remove("presentation-fullscreen");
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      const element = targetId
        ? document.getElementById(targetId)
        : document.documentElement;

      if (!element) return;

      if (!isFullscreen) {
        // Enter fullscreen
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if ((element as any).webkitRequestFullscreen) {
          await (element as any).webkitRequestFullscreen();
        } else if ((element as any).mozRequestFullScreen) {
          await (element as any).mozRequestFullScreen();
        } else if ((element as any).msRequestFullscreen) {
          await (element as any).msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
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
      size="icon"
      className={cn("relative", className)}
      aria-label={isFullscreen ? exitLabel : label}
      title={isFullscreen ? exitLabel : label}
    >
      {isFullscreen ? (
        <Minimize2 className="h-5 w-5" />
      ) : (
        <Maximize2 className="h-5 w-5" />
      )}
    </Button>
  );
}

