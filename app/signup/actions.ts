"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, friendlyAuthError } from "@/lib/supabase/config";

// The site's own address (localhost in dev, the Vercel domain in
// production), so confirmation emails link back to wherever the person
// actually signed up - not to a hard-coded URL.
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(friendlyAuthError(error.message))}`);
  }

  // If the Supabase project requires email confirmation, signUp succeeds
  // but returns no session yet - send them to login with an explanation
  // instead of pretending they're in.
  if (!data.session) {
    redirect(
      `/login?message=${encodeURIComponent(
        "Almost there! We sent you a confirmation link. Open it to finish creating your account."
      )}&pending=1`
    );
  }

  redirect("/");
}

// "Didn't get the email?" - sends the confirmation link again.
export async function resendConfirmation(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) {
    redirect(`/login?error=${encodeURIComponent("Enter the email you signed up with.")}&pending=1`);
  }
  if (!isSupabaseConfigured) {
    redirect(`/login?error=${encodeURIComponent("Accounts aren't available right now.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(friendlyAuthError(error.message))}&pending=1`);
  }
  redirect(
    `/login?message=${encodeURIComponent("Sent again. Check your inbox and spam folder in a minute or two.")}&pending=1`
  );
}
