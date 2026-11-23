"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MotionConfig } from "framer-motion";
import Dashboard from "@/components/Dashboard";
import { createClient } from "@/lib/supabase/client";
import { useTaskStore } from "@/store/useTaskStore";

// The app opens straight to the dashboard. Anyone can use it right away
// as a guest (tasks live in this browser); signing in is only needed to
// save tasks to an account and use them on other devices.
export default function Home() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => setUserEmail(data.user?.email ?? null))
      .catch(() => setUserEmail(null));

    // Keeps this in sync if the session changes in another tab.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUserEmail(null);
    // Drop the account's tasks from memory and switch back to this
    // device's guest list.
    await useTaskStore.getState().loadTasks();
  };

  return (
    <MotionConfig reducedMotion="user">
      <Dashboard
        userEmail={userEmail}
        onSignIn={() => router.push("/login")}
        onSignOut={handleSignOut}
      />
    </MotionConfig>
  );
}
