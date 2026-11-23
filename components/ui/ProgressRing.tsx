"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber";

// Gradient progress ring whose stroke springs to the new percentage, with
// a counting number in the middle.
export default function ProgressRing({
  percent,
  size = 84,
  stroke = 9,
  showLabel = true,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
}) {
  const gradId = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F27BA6" />
            <stop offset="100%" stopColor="#F27BA6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#F3EFEA" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (clamped / 100) * c }}
          transition={{ type: "spring", stiffness: 60, damping: 16 }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatedNumber value={clamped} suffix="%" className="text-sm font-bold text-ink tabular-nums" />
        </div>
      )}
    </div>
  );
}
