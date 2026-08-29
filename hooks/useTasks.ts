"use client";

import { useCallback, useEffect, useState } from "react";
import type { ParsedTask, Priority, Task } from "@/lib/types";

const STORAGE_KEY = "starboard.tasks.v1";

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Guest-first task store. Everything lives in localStorage for now;
 * swap the load/persist internals for a Supabase-backed fetch later
 * without touching the component API.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load once on mount (guarded so SSR never touches window)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setTasks(JSON.parse(raw));
    } catch {
      // Corrupt or blocked storage — start fresh rather than crash the app
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist on every change, after initial hydration
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // Storage full or unavailable (private browsing) — fail silently
    }
  }, [tasks, hydrated]);

  const addTask = useCallback(
    (title: string, priority: Priority = "medium", estimated_minutes: number | null = null) => {
      if (!title.trim()) return;
      setTasks((prev) => [
        {
          id: makeId(),
          title: title.trim(),
          done: false,
          priority,
          estimated_minutes,
          createdAt: Date.now(),
        },
        ...prev,
      ]);
    },
    []
  );

  const addParsedTasks = useCallback((parsed: ParsedTask[]) => {
    const now = Date.now();
    setTasks((prev) => [
      ...parsed.map((p, i) => ({
        id: makeId(),
        title: p.title,
        done: false,
        priority: p.priority ?? "medium",
        estimated_minutes: p.estimated_minutes ?? null,
        createdAt: now - i, // preserve parse order in the list
      })),
      ...prev,
    ]);
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setSubSteps = useCallback((id: string, subSteps: string[]) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, subSteps } : t))
    );
  }, []);

  return {
    tasks,
    hydrated,
    addTask,
    addParsedTasks,
    toggleTask,
    removeTask,
    setSubSteps,
  };
}
