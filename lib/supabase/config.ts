// Supabase settings, read once. If they're missing (e.g. env vars not set
// on a deployment), the app must still load in guest mode instead of
// crashing: createBrowserClient / createServerClient throw on an empty
// URL, so a harmless placeholder is used and every call simply fails,
// which the app already treats as "not signed in".
//
// NEXT_PUBLIC_ variables must be referenced literally like this so Next
// can inline them into the browser bundle.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured && typeof window === "undefined") {
  console.warn(
    "[Starboard] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set - running in guest-only mode."
  );
}

export const supabaseUrl = url || "http://127.0.0.1:54321";
export const supabaseAnonKey = anonKey || "supabase-not-configured";

// Turns low-level auth errors into something a person can act on. A
// network failure (Supabase down, paused, or unreachable) surfaces as
// "fetch failed" or similar, which means nothing to a user.
export function friendlyAuthError(message: string): string {
  if (/fetch|network|ENOTFOUND|ECONNREFUSED|timed? ?out/i.test(message)) {
    return "Can't reach the account server right now. Your tasks are still saved on this device - try signing in again later.";
  }
  return message;
}
