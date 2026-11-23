import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from "@/lib/supabase/config";

// Called once a day by Vercel Cron (see vercel.json). Supabase pauses
// free-tier projects after ~7 days without database activity; one tiny
// read a day keeps the project awake so sign-in and sync keep working.
//
// If CRON_SECRET is set in Vercel, Vercel sends it as a Bearer token and
// anyone else is turned away. Without it the endpoint stays open, which
// is harmless: it only runs a one-row read that RLS returns empty.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const started = Date.now();
  const { error } = await supabase.from("tasks").select("id").limit(1);

  if (error) {
    console.error("[keepalive] Supabase query failed:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, ms: Date.now() - started, at: new Date().toISOString() });
}
