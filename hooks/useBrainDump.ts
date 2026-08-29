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

export function useBrainDump() {
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const addMultipleTasks = useTaskStore((state) => state.addMultipleTasks);

  const parseText = async (rawText: string) => {
    setIsLoadingAi(true);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: rawText }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to parse");

      // Because we are adding Zod on the backend, we can trust this data structure
      if (data.tasks && Array.isArray(data.tasks)) {
        const formatted = data.tasks.map((t: any) => ({
          id: crypto.randomUUID(),
          title: t.title,
          completed: false,
          priority: t.priority,
          energy_level: t.energy_level,
          estimated_minutes: t.estimated_minutes,
          category: t.category,
          due_date: dueHintToDate(t.due_hint),
          subtasks: []
        }));

        addMultipleTasks(formatted);
        return true; // Indicates success
      }
      return false;
    } catch (err: any) {
      alert(`AI Error: ${err.message}`);
      return false;
    } finally {
      setIsLoadingAi(false);
    }
  };

  return { parseText, isLoadingAi };
}