import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseUrl, supabaseAnonKey } from "./config";

/**
 * Supabase client for Server Components, Server Actions, and Route
 * Handlers. Reads/writes the session via Next's cookie store so auth
 * state stays in sync between server and browser.
 *
 * Must be created fresh per request (never module-level/singleton) -
 * `cookies()` is request-scoped.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll was called from a Server Component, which can't set
            // cookies directly. Harmless as long as middleware.ts is also
            // refreshing the session on every request - which it is.
          }
        },
      },
    }
  );
}
