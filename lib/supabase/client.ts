import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components ("use client" files - anything
 * running in the browser). Safe to call repeatedly; @supabase/ssr handles
 * the underlying singleton itself.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
