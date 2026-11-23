"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

// Counts smoothly from its previous value to the new one whenever `value`
// changes (e.g. a progress % ticking up when a task is checked off).
export default function AnimatedNumber({
  value,
  suffix = "",
  className,
  duration = 0.8,
}: {
  value: number;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = `${value}${suffix}`;
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        node.textContent = `${Math.round(v)}${suffix}`;
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, suffix, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {`${value}${suffix}`}
    </span>
  );
}
