import { useState } from "react";
import { useTaskStore } from "@/store/useTaskStore";
import { addDays, toISODate } from "@/lib/dates";

// The AI only ever classifies loosely ("Today" / "Tomorrow" / "Later") -
// we don't trust an LLM to do reliable date arithmetic. The actual
// calendar date is computed here from the browser's real clock, then
// stored as due_date so the weekly Timeline view can place it correctly.
// "Later" becomes unscheduled (null) rather than a vague catch-all bucket
// the user can't act on.
function dueHintToDate(hint: string | null | undefined): string | null {
  const today = new Date();
  if (hint === "Today") return toISODate(today);
  if (hint === "Tomorrow") return toISODate(addDays(today, 1));
  return null;
}

// Gemini reliably returns { tasks: [] } for input with nothing actionable
// in it (gibberish, "asdf", whitespace) rather than fabricating a task -
// verified directly against the live endpoint. So "valid response, zero
// tasks" is a real, expected outcome, not a failure - but it's also not
// the same thing as success, and the caller needs to tell them apart:
// clearing the input and showing a success toast for a no-op response
// would be actively misleading.
export type ParseTextResult =
  | { status: "success"; count: number }
  | { status: "empty" }
  | { status: "error"; message: string };

export function useBrainDump() {
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const addMultipleTasks = useTaskStore((state) => state.addMultipleTasks);

  // `category`: put every parsed task in this folder (used when brain
  // dumping from inside a folder) instead of the folder the AI picked.
  const parseText = async (rawText: string, options?: { category?: string }): Promise<ParseTextResult> => {
    setIsLoadingAi(true);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: rawText }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { status: "error", message: data.error || "Failed to parse that." };
      }

      if (!data.tasks || !Array.isArray(data.tasks)) {
        return { status: "error", message: "Got back something unexpected." };
      }

      // Defensive filter: the schema allows an empty string title, and a
      // blank task card helps no one - drop anything with no real title
      // rather than silently add it.
      const formatted = data.tasks
        .filter((t: any) => typeof t.title === "string" && t.title.trim().length > 0)
        .map((t: any) => ({
          id: crypto.randomUUID(),
          title: t.title.trim(),
          completed: false,
          priority: t.priority,
          energy_level: t.energy_level,
          estimated_minutes: t.estimated_minutes,
          category: options?.category || t.category,
          due_date: dueHintToDate(t.due_hint),
          subtasks: []
        }));

      if (formatted.length === 0) {
        return { status: "empty" };
      }

      addMultipleTasks(formatted);
      return { status: "success", count: formatted.length };
    } catch (err: any) {
      return { status: "error", message: err?.message || "Couldn't reach the AI right now." };
    } finally {
      setIsLoadingAi(false);
    }
  };

  return { parseText, isLoadingAi };
}