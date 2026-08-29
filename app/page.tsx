"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Landing from "@/components/Landing";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [isInDashboard, setIsInDashboard] = useState(false);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#e8f3fc]">
      <AnimatePresence mode="wait">
        {!isInDashboard ? (
          <motion.div
            key="landing"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="w-full h-full"
          >
            <Landing onStartListing={() => setIsInDashboard(true)} />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full h-full"
          >
            <Dashboard onBackToLanding={() => setIsInDashboard(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}