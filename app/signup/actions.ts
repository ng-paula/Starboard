"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, friendlyAuthError } from "@/lib/supabase/config";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect(`/signup?error=${encodeURIComponent("Email and password are required.")}`);
  }
  if (password.length < 6) {
    redirect(`/signup?error=${encodeURIComponent("Password must be at least 6 characters.")}`);
  }

  if (!isSupabaseConfigured) {
    redirect(`/signup?error=${encodeURIComponent("Accounts aren't available right now. You can keep using Starboard as a guest.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(friendlyAuthError(error.message))}`);
  }

  // If the Supabase project requires email confirmation, signUp succeeds
  // but returns no session yet - send them to login with an explanation
  // instead of pretending they're in.
  if (!data.session) {
    redirect(`/login?message=${encodeURIComponent("Check your email to confirm your account, then log in.")}`);
  }

  redirect("/");
}
