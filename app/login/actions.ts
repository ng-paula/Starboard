"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, friendlyAuthError } from "@/lib/supabase/config";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Email and password are required.")}`);
  }

  if (!isSupabaseConfigured) {
    redirect(`/login?error=${encodeURIComponent("Accounts aren't available right now. You can keep using Starboard as a guest.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Signed up but never clicked the confirmation link: show the
    // "check your inbox" panel (with its resend option) instead of a
    // bare error.
    if (/not confirmed/i.test(error.message)) {
      redirect(
        `/login?error=${encodeURIComponent("Please confirm your email first - use the link we sent you, or resend it below.")}&pending=1`
      );
    }
    redirect(`/login?error=${encodeURIComponent(friendlyAuthError(error.message))}`);
  }

  redirect("/");
}
