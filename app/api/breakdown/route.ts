import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = body.text || body.prompt;

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "A valid task prompt is required." },
        { status: 400 }
      );
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an AI task organizer for Starboard. The user provided an unstructured brain dump. Parse it into clear, concise, actionable task items.\n\nInput: "${input}"`,
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
                  title: {
                    type: Type.STRING,
                    description: "Actionable, clear task name.",
                  },
                  priority: {
                    type: Type.STRING,
                    enum: ["low", "medium", "high"],
                  },
                },
                required: ["title"],
              },
              description: "List of cleanly separated task items.",
            },
          },
          required: ["tasks"],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{"tasks":[]}');
    return NextResponse.json(parsedData);
  } catch (error) {
    console.error("Gemini parse error:", error);
    return NextResponse.json(
      { error: "Failed to process brain dump." },
      { status: 500 }
    );
  }
}