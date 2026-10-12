"use client";

import { useEffect, useRef } from "react";

/**
 * A one-shot confetti burst, drawn on a throwaway canvas.
 *
 * Hand-rolled rather than pulling in `canvas-confetti`: this is the only place on the site that
 * needs it, the effect is ~70 lines, and a dependency for one screen is a dependency to upgrade
 * forever.
 *
 * Fires once on mount and cleans itself up. The canvas is `pointer-events-none` and `aria-hidden`
 * so it never sits between a thumb and the option the visitor is trying to tap — which matters,
 * because this renders on the exact screen we are trying to get people to finish.
 *
 * Honours `prefers-reduced-motion`: the component renders nothing at all for anyone who has asked
 * the OS for less animation. Vestibular triggers are not a style preference.
 */

const COLORS = ["#0077B6", "#00B4D8", "#48CAE4", "#C8A96E", "#FFFFFF", "#FFD166"];
const PARTICLE_COUNT = 90;
const DURATION_MS = 2600;
const GRAVITY = 0.00042;
const DRAG = 0.0006;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  rotation: number;
  spin: number;
};

export default function QuizConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // Two origins rather than one, so the burst reads as a celebration rather than a fountain.
    // Kept near the top edge and out at the sides: a burst centred on the card detonates over the
    // headline, and the headline is the thing this screen most needs read.
    const origins = [
      { x: width * 0.14, y: height * 0.08 },
      { x: width * 0.86, y: height * 0.08 },
    ];

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const origin = origins[i % origins.length];
      // Spread biased upward: straight-down confetti looks like something fell, not like a burst.
      const angle = (-Math.PI / 2) + (i / PARTICLE_COUNT - 0.5) * Math.PI * 1.35;
      const speed = 0.35 + ((i * 37) % 100) / 100 * 0.42;
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed + (((i * 53) % 21) - 10) / 90,
        vy: Math.sin(angle) * speed,
        w: 6 + ((i * 17) % 5),
        h: 9 + ((i * 29) % 7),
        color: COLORS[i % COLORS.length],
        rotation: ((i * 61) % 360) * (Math.PI / 180),
        spin: (((i * 13) % 11) - 5) / 220,
      };
    });

    let raf = 0;
    let start: number | null = null;
    let last: number | null = null;

    const frame = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      if (elapsed > DURATION_MS) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      // Frame-rate independent: a 120Hz phone should not run the burst at double speed, and a
      // backgrounded tab should not resume with one enormous step.
      const dt = last === null ? 16 : Math.min(now - last, 32);
      last = now;

      ctx.clearRect(0, 0, width, height);
      const fade = elapsed > DURATION_MS * 0.6 ? 1 - (elapsed - DURATION_MS * 0.6) / (DURATION_MS * 0.4) : 1;

      for (const p of particles) {
        p.vy += GRAVITY * dt;
        p.vx -= p.vx * DRAG * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;

        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
    />
  );
}
