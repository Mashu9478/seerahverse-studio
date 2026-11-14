"use client";

import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Animated number that counts up to `value` when it scrolls into view (and on later changes). */
export function CountUp({ value, duration = 1.1, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(v),
    });
    from.current = value;
    return () => ctrl.stop();
  }, [value, inView, duration]);
  return <span ref={ref}>{format ? format(shown) : Math.round(shown).toLocaleString()}</span>;
}
