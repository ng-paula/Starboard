"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import Landing from "@/components/Landing";
import Dashboard from "@/components/Dashboard";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isInDashboard, setIsInDashboard] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setIsInDashboard(!!data.user);
      setCheckedAuth(true);
    });

    // Keeps this in sync if the session changes in another tab, or after
    // the sign-out button below clears it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleStartListing = () => {
    if (user) {
      setIsInDashboard(true);
    } else {
      router.push("/login");
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsInDashboard(false);
  };

  // Avoids a flash of the Landing page for an already-logged-in user
  // whose session just hasn't been checked yet.
  if (!checkedAuth) {
    return <div className="min-h-screen w-full bg-[#e8f3fc]" />;
  }

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
            <Landing onStartListing={handleStartListing} />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full h-full"
          >
            <Dashboard onBackToLanding={() => setIsInDashboard(false)} onSignOut={handleSignOut} userEmail={user?.email ?? null} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
