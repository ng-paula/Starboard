import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseAnonKey } from "./config";

/**
 * Supabase client for Client Components ("use client" files - anything
 * running in the browser). Safe to call repeatedly; @supabase/ssr handles
 * the underlying singleton itself. Never throws, even if Supabase isn't
 * configured (see ./config).
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
