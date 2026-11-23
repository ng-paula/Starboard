import { NextResponse } from "next/server";

// Per-visitor cap on AI requests (brain dump, Optimize Flow, "Stuck?"
// tips combined), so one person can't use up the shared Gemini quota or
// run up the bill.
//
// Kept in server memory: simple and free, but each Vercel server instance
// counts separately and the counts reset when an instance restarts. That
// makes it a speed bump against heavy use, not a hard guarantee - the
// Google Cloud budget alert is the real backstop.
const LIMIT = 10; // requests
const WINDOW_MS = 60 * 60 * 1000; // per hour

// Stored on globalThis so the three AI routes share one counter per
// server instance (and dev hot-reloads don't reset it).
const g = globalThis as typeof globalThis & { __starboardAiHits?: Map<string, number[]> };
const hits = (g.__starboardAiHits ??= new Map<string, number[]>());

function visitorKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
}

// Returns a 429 response if this visitor is over the limit, otherwise
// records the request and returns null.
export function checkAiRateLimit(req: Request): NextResponse | null {
  const now = Date.now();
  const key = visitorKey(req);
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= LIMIT) {
    const waitMin = Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 60000));
    hits.set(key, recent);
    return NextResponse.json(
      {
        error: `you've used the AI ${LIMIT} times in the last hour. Try again in about ${waitMin} minute${
          waitMin === 1 ? "" : "s"
        } - you can still add tasks normally.`,
      },
      { status: 429, headers: { "Retry-After": String(waitMin * 60) } }
    );
  }

  recent.push(now);
  hits.set(key, recent);

  // Occasional cleanup so the map doesn't grow forever.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return null;
}
