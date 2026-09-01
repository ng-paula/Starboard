"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import Landing from "@/components/Landing";
import Dashboard from "@/components/Dashboard";
import { createClient } from "@/lib/supabase/client";

// A shared, pre-made Supabase account (not a secret - anyone clicking "Try
// Demo" is meant to land in it) that lets a visitor explore the app with
// zero signup friction. Create this user once in the Supabase dashboard
// (Authentication -> Users -> Add User, with "Auto Confirm User" checked)
// before this button will work.
const DEMO_EMAIL = "demo@starboard.app";
const DEMO_PASSWORD = "StarboardDemo2026!";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isInDashboard, setIsInDashboard] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

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

  const handleTryDemo = async () => {
    setDemoError(null);
    setIsDemoLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    setIsDemoLoading(false);
    if (error) {
      setDemoError("Demo is temporarily unavailable - please try again shortly.");
      return;
    }
    setIsInDashboard(true);
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
            <Landing
              onStartListing={handleStartListing}
              onTryDemo={handleTryDemo}
              isDemoLoading={isDemoLoading}
              demoError={demoError}
            />
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
