import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Where the "confirm your email" link lands. Supabase sends either a
// one-time `code` (PKCE flow, the default for @supabase/ssr) or a
// `token_hash` + `type` (custom email templates). Either way we trade it
// for a session cookie, then send the person to their dashboard - where
// any tasks they made as a guest get moved into the new account.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let error: unknown = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = new Error("missing code");
  }

  if (error) {
    const msg = "That confirmation link is invalid or has expired. Sign in, or request a new link below.";
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);
  }

  return NextResponse.redirect(`${origin}/`);
}
