import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from "@/lib/supabase/config";

// Refreshes the Supabase auth session cookie on every request. Without
// this, a session nearing expiry could go stale between visits even
// though the user never explicitly logged out - Supabase's server client
// needs a chance to rotate the token, and middleware is the one place
// guaranteed to run before every request reaches a page or route handler.
//
// It must never take the site down: if Supabase isn't configured or
// can't be reached, the request goes through untouched and the app runs
// in guest mode.
export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    // Touching getUser() is what actually triggers the refresh - it's not
    // just a read, it validates and rotates the token against Supabase.
    await supabase.auth.getUser();
  } catch (error) {
    console.error("[middleware] Supabase session refresh failed:", error);
    return NextResponse.next({ request });
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets and image optimization
    // requests - those never need a session refresh.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
