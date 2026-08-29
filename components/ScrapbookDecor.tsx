"use client";

import { motion } from "framer-motion";

/** Yellow polka-dot binder clip, pinned to the top-left of the folder. */
export function BinderClip({ className = "" }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 120 90"
      className={className}
      style={{ ["--tilt" as any]: "-8deg" }}
      animate={{ rotate: [-8, -5, -8] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden="true"
    >
      <defs>
        <pattern id="clipDots" width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="#FDE896" />
          <circle cx="7" cy="7" r="2.4" fill="#5B4B45" fillOpacity="0.55" />
        </pattern>
      </defs>
      <rect x="8" y="8" width="104" height="74" rx="14" fill="url(#clipDots)" stroke="#5B4B45" strokeOpacity="0.25" strokeWidth="2" />
      <rect x="20" y="20" width="80" height="50" rx="8" fill="none" stroke="#FFFDF8" strokeWidth="6" />
      <circle cx="60" cy="45" r="5" fill="#5B4B45" fillOpacity="0.35" />
    </motion.svg>
  );
}

/** Green sewing button held down with a strip of dotted washi tape. */
export function SewingButton({ className = "" }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 110 110"
      className={className}
      style={{ ["--tilt" as any]: "6deg" }}
      animate={{ rotate: [6, 9, 6] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      aria-hidden="true"
    >
      {/* washi tape strip */}
      <g transform="rotate(-18 55 30)">
        <rect x="10" y="14" width="90" height="26" rx="3" fill="#F2A6B0" fillOpacity="0.9" />
        {Array.from({ length: 10 }).map((_, i) => (
          <circle key={i} cx={18 + i * 8.5} cy={27} r="2" fill="#FFFDF8" fillOpacity="0.85" />
        ))}
      </g>
      {/* button */}
      <circle cx="55" cy="62" r="30" fill="#7BA98A" stroke="#5C8A6C" strokeWidth="3" />
      <circle cx="55" cy="62" r="30" fill="url(#buttonShade)" />
      <circle cx="46" cy="53" r="4" fill="#3F5E48" />
      <circle cx="64" cy="53" r="4" fill="#3F5E48" />
      <circle cx="46" cy="71" r="4" fill="#3F5E48" />
      <circle cx="64" cy="71" r="4" fill="#3F5E48" />
      <path d="M46 53 L64 71 M64 53 L46 71" stroke="#3F5E48" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <radialGradient id="buttonShade" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </motion.svg>
  );
}

/** A single soft yellow four-point star. */
function Star({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="absolute text-star animate-twinkle"
      style={style}
      aria-hidden="true"
    >
      <path
        d="M12 0 C12 6.5 14 9.5 24 12 C14 14.5 12 17.5 12 24 C12 17.5 10 14.5 0 12 C10 9.5 12 6.5 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

const STAR_POSITIONS = [
  { top: "6%", left: "10%", size: 18, delay: "0s" },
  { top: "14%", left: "82%", size: 24, delay: "0.6s" },
  { top: "30%", left: "4%", size: 14, delay: "1.1s" },
  { top: "22%", left: "50%", size: 12, delay: "0.3s" },
  { top: "68%", left: "88%", size: 20, delay: "0.9s" },
  { top: "78%", left: "6%", size: 16, delay: "1.4s" },
  { top: "88%", left: "45%", size: 14, delay: "0.2s" },
  { top: "48%", left: "92%", size: 12, delay: "1.7s" },
  { top: "58%", left: "18%", size: 10, delay: "1s" },
  { top: "8%", left: "35%", size: 10, delay: "0.5s" },
];

/** Scattered soft-yellow stars over the striped background. */
export function StarField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {STAR_POSITIONS.map((s, i) => (
        <Star
          key={i}
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}
