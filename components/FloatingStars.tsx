"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

interface StarItem {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

export default function FloatingStars() {
  const [stars, setStars] = useState<StarItem[]>([]);

  useEffect(() => {
    // sb_star.png now carries a real alpha channel (see git history —
    // it used to be flattened onto black and relied on mix-blend-screen,
    // which made every star invisible on the white landing-page stripes).
    // 60 stars on desktop, 30 on mobile keeps the same scattered feel
    // without mounting 160 animated layers.
    const count = typeof window !== "undefined" && window.innerWidth < 640 ? 30 : 60;
    const generated = Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: Math.random() * 98,
      y: Math.random() * 98,
      size: Math.random() * 22 + 10, // 10px to 32px
      duration: Math.random() * 4 + 2.5,
      delay: Math.random() * 3,
    }));
    setStars(generated);
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
          }}
          animate={{
            y: [0, -16, 0],
            opacity: [0.45, 1, 0.45],
            rotate: [0, 10, -10, 0],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Image
            src="/sb_star.png"
            alt=""
            fill
            sizes="32px"
            className="object-contain pointer-events-none select-none"
          />
        </motion.div>
      ))}
    </div>
  );
}