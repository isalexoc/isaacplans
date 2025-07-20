/* app/_components/fade-up.client.tsx */
"use client";

import { useRef, useEffect } from "react";

/**
 * Adds `animate-fade-up` once the element is ~20 % in view.
 * No Framer Motion; only 700 ms of CSS.
 */
export default function FadeUp({
  delay = 0,
  children,
}: {
  delay?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.animationDelay = `${delay}s`;
          el.classList.add("animate-fade-up");
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className="opacity-0">
      {children}
    </div>
  );
}
