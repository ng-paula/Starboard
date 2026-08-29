import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Server-only helper. Never import this from a Client Component —
 * it reads GEMINI_API_KEY, which must stay off the browser bundle.
 * Every file that touches process.env.GEMINI_API_KEY lives under
 * app/api/**\/route.ts (Route Handlers run only on the server).
 */
export function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local locally, or to your " +
        "hosting provider's Environment Variables for deployed builds."
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });
}

/**
 * Gemini sometimes wraps JSON in ```json fences even when
 * responseMimeType is set. Strip defensively before JSON.parse.
 */
export function cleanJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
}
