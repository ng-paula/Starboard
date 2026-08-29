import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().default("Inbox"),
  priority: z.enum(["urgent_important", "important", "low_priority"]),
  energy_level: z.enum(["high_focus", "quick_admin", "low_energy"]),
  estimated_minutes: z.number(),
  due_date: z.string().nullable().optional(),
  completed: z.boolean().default(false),
  subtasks: z.array(z.any()).optional().default([]),
});

const OptimizeResponseSchema = z.object({
  tasks: z.array(TaskSchema),
});

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });

    const ai = new GoogleGenAI({ apiKey });
    const { tasks } = await req.json();

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: "No tasks provided to optimize." }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `You are an expert productivity coach. Take this list of tasks and reorder them into the most psychologically optimal flow sequence. 
      Rules for sequencing:
      1. Put urgent/important tasks first, but group a quick warm-up admin task at the very beginning to build momentum.
      2. Place high_focus tasks during peak mental momentum.
      3. Place low_energy or quick_admin tasks near the end.
      Return the exact same task objects, just sorted in this optimal order.
      Do not invent or modify due_date - copy it through unchanged (including null) for every task.

      Tasks: ${JSON.stringify(tasks)}`,
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
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ["urgent_important", "important", "low_priority"] },
                  energy_level: { type: Type.STRING, enum: ["high_focus", "quick_admin", "low_energy"] },
                  estimated_minutes: { type: Type.INTEGER },
                  due_date: { type: Type.STRING, nullable: true },
                  completed: { type: Type.BOOLEAN },
                },
                required: ["id", "title", "category", "priority", "energy_level", "estimated_minutes", "completed"],
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
    const validatedData = OptimizeResponseSchema.parse(rawJson);

    return NextResponse.json(validatedData);
  } catch (error: any) {
    console.error("Optimizer Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to optimize flow." }, { status: 500 });
  }
}