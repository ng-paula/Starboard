"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Loader2 } from "lucide-react";
import type { ParsedTask } from "@/lib/types";

export default function SparkleInput({
  onAddSimple,
  onAddParsed,
}: {
  onAddSimple: (title: string) => void;
  onAddParsed: (tasks: ParsedTask[]) => void;
}) {
  const [sparkleMode, setSparkleMode] = useState(false);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;

    if (!sparkleMode) {
      onAddSimple(value);
      setValue("");
      return;
    }

    setLoading(true);
    setError(null);
try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      if (!data.tasks?.length) {
        setError("Didn't find any tasks in there — try adding a bit more detail.");
        return;
      }

      // FIX: Manually attach an ID and status to each task so the Dashboard doesn't crash
      const formattedTasks = data.tasks.map((task: any) => ({
        id: crypto.randomUUID(),
        title: task.title,
        completed: false
      }));

      onAddParsed(formattedTasks as ParsedTask[]);
      setValue("");
      setSparkleMode(false);
    } catch (err) {
// ...

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!sparkleMode && e.key === "Enter") {
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex items-end gap-2 rounded-2xl bg-dash-card p-2 shadow-card">
        <button
          type="button"
          onClick={() => setSparkleMode((s) => !s)}
          aria-pressed={sparkleMode}
          className={`focus-ring flex shrink-0 items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
            sparkleMode
              ? "bg-dash-accent text-ink"
              : "bg-dash-bg text-ink/60 hover:text-ink"
          }`}
          title="Toggle brain-dump mode"
        >
          <Sparkles size={16} />
          Sparkle
        </button>

        <AnimatePresence mode="wait" initial={false}>
          {sparkleMode ? (
            <motion.textarea
              key="textarea"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Dump everything on your mind — Starboard will sort it out..."
              rows={3}
              className="focus-ring w-full resize-none rounded-xl bg-transparent px-2 py-2 font-body text-ink placeholder:text-ink/40 outline-none"
            />
          ) : (
            <motion.input
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a task and hit Enter..."
              className="focus-ring w-full rounded-xl bg-transparent px-2 py-2.5 font-body text-ink placeholder:text-ink/40 outline-none"
            />
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="focus-ring flex shrink-0 items-center justify-center rounded-xl bg-button-green p-2.5 text-white transition-colors hover:bg-button-greenDark disabled:opacity-40"
          aria-label="Add"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
      {error && <p className="mt-2 pl-2 text-sm text-[#9C4A55]">{error}</p>}
    </form>
  );
}}}
