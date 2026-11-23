"use client";

import React from "react";
import { motion } from "framer-motion";

// Small client wrapper so server components (login / signup) can still
// get a springy entrance animation.
export default function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 18, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
