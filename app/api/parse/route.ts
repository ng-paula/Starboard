import { NextResponse } from "next/server";
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
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `You are a productivity assistant. Extract tasks from this text: "${prompt}".
      Determine their priority, energy level, a category (e.g., SIKAPTala, Research, Personal), and an estimated time in minutes. If they mention doing it today or tonight, set due_hint to "Today". If tomorrow, "Tomorrow". Otherwise "Later".`,
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
    return NextResponse.json({ error: "Failed to parse tasks." }, { status: 500 });
  }
}