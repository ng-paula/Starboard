import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrors";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });

    const { title } = await req.json();

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "A task title is required." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `The user is procrastinating on this task and needs to get moving right now: "${title}".

Give ONE concrete, physical 30-second micro-action that gets them started immediately - not advice, not a restatement of the task, not a plan. A tiny first move they could do right this second (e.g. "Open the file and type one sentence" or "Pick up the phone and dial the first three digits").

Reply with just that one sentence, under 20 words, no quotation marks, no preamble.`,
    });

    const tip = (response.text || "").trim().replace(/^["']|["']$/g, "");

    if (!tip) {
      return NextResponse.json({ error: "No tip generated." }, { status: 502 });
    }

    return NextResponse.json({ tip });
  } catch (error) {
    console.error("Feeling-stuck tip error:", error);
    return aiErrorResponse(error, "Failed to get a tip.");
  }
}
