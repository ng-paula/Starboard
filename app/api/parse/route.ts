import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrors";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

const TaskSchema = z.object({
  title: z.string(),
  category: z.string().default("Inbox"),
  priority: z.enum(["urgent_important", "important", "low_priority"]),
  energy_level: z.enum(["high_focus", "quick_admin", "low_energy"]),
  estimated_minutes: z.number(),
  due_hint: z.enum(["Today", "Tomorrow", "Later"]).nullable().optional(),
});

const AIResponseSchema = z.object({
  tasks: z.array(TaskSchema),
});

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });

    const ai = new GoogleGenAI({ apiKey });
    const { prompt, folders } = await req.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // The user's existing folders, so the AI files tasks into them instead
    // of inventing near-duplicates ("Personal" vs "Life" vs "Home stuff").
    // Sanitised: strings only, trimmed, capped in count and length.
    const existingFolders: string[] = Array.isArray(folders)
      ? Array.from(
          new Set(
            folders
              .filter((f: unknown): f is string => typeof f === "string")
              .map((f) => f.trim().slice(0, 50))
              .filter(Boolean)
          )
        ).slice(0, 60)
      : [];

    const folderRules =
      existingFolders.length > 0
        ? `The user already has these folders: ${JSON.stringify(existingFolders)}.
      For each task's category, use one of these existing folder names EXACTLY as written whenever the task reasonably fits one.
      Only create a new category when none of the existing folders fit at all; keep new names short (1-2 words) and general (e.g. "Fitness", not "Gym on Tuesday").
      Use "Inbox" only if nothing fits and no sensible new folder exists.`
        : `The user has no folders yet. Give each task a short, general category (1-2 words, e.g. "Work", "School", "Personal", "Errands"), reusing the same category for related tasks.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `You are a productivity assistant. Extract tasks from this text: "${prompt}".
      Determine their priority, energy level, a category, and an estimated time in minutes. If they mention doing it today or tonight, set due_hint to "Today". If tomorrow, "Tomorrow". Otherwise "Later".
      ${folderRules}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ["urgent_important", "important", "low_priority"] },
                  energy_level: { type: Type.STRING, enum: ["high_focus", "quick_admin", "low_energy"] },
                  estimated_minutes: { type: Type.INTEGER },
                  due_hint: { type: Type.STRING, enum: ["Today", "Tomorrow", "Later"] },
                },
                required: ["title", "category", "priority", "energy_level", "estimated_minutes"],
              },
            },
          },
          required: ["tasks"],
        },
      },
    });

    let responseText = response.text || "{}";
    responseText = responseText.replace(/```json/gi, "").replace(/```/gi, "").trim();
    
    const rawJson = JSON.parse(responseText);
    const validatedData = AIResponseSchema.parse(rawJson);

    return NextResponse.json(validatedData);
  } catch (error: any) {
    console.error("Parse Error:", error);
    return aiErrorResponse(error, "Failed to parse tasks.");
  }
}