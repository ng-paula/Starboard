import { NextResponse } from "next/server";

// Turns a Gemini failure into a response the UI can show as-is. The free
// tier has a small daily request quota shared by every visitor, so "limit
// reached" is an expected state, not a crash - say so plainly instead of
// a vague "failed" (or Google's raw JSON error).
export function aiErrorResponse(error: unknown, fallback: string) {
  const status = (error as { status?: number })?.status;
  const message = String((error as { message?: string })?.message ?? "");
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) {
    return NextResponse.json(
      { error: "the AI has hit its usage limit for now. Try again in a little while - you can still add tasks normally." },
      { status: 429 }
    );
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}
