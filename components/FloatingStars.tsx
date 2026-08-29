"use client";

import { motion } from "framer-motion";
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
    // 160 stars on desktop, 80 on mobile
    const count = typeof window !== "undefined" && window.innerWidth < 640 ? 80 : 160;
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
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
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
          <img
            src="/sb_star.png"
            alt="star"
            className="w-full h-full object-contain mix-blend-screen pointer-events-none select-none"
          />
        </motion.div>
      ))}
    </div>
  );
}