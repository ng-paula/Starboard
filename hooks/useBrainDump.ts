import { useState } from "react";
import { useTaskStore } from "@/store/useTaskStore";

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
          due_hint: t.due_hint || null,
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