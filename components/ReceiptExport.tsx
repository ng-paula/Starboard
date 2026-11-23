"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { motion } from "framer-motion";
import { Loader2, X, Download, Check } from "lucide-react";
import type { Task } from "@/lib/types";

interface ReceiptExportProps {
  tasks: Task[];
  onClose: () => void;
  title?: string;
  // Folder dot colour, so the receipt matches the app.
  folderColor?: (category: string) => string;
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Torn-paper edge along the bottom of the receipt (pure CSS, so it
// survives the PNG export).
const zigzag = {
  backgroundImage:
    "linear-gradient(135deg, #ffffff 6px, transparent 0), linear-gradient(225deg, #ffffff 6px, transparent 0)",
  backgroundSize: "12px 12px",
  backgroundPosition: "left top",
  backgroundRepeat: "repeat-x",
};

export default function ReceiptExport({ tasks, onClose, title = "Starboard", folderColor }: ReceiptExportProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDownload() {
    if (!receiptRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        pixelRatio: 3,
        backgroundColor: "#F6F3EE",
      });
      const link = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "starboard";
      link.download = `${slug}-${today}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Export failed silently - the button just re-enables so the user can retry
    } finally {
      setExporting(false);
    }
  }

  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const timeLabel = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const todo = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);
  const plannedMins = todo.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
  const doneMins = done.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
  const pct = tasks.length === 0 ? 0 : Math.round((done.length / tasks.length) * 100);

  const row = (t: Task) => (
    <li key={t.id} className="flex items-start gap-2.5 py-1.5">
      <span
        className={`mt-[3px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${
          t.completed ? "border-ink bg-ink text-white" : "border-ink/30 bg-white"
        }`}
      >
        {t.completed && <Check size={10} strokeWidth={3.5} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] font-semibold leading-snug ${t.completed ? "text-ink/40 line-through" : "text-ink"}`}>
          {t.title}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: folderColor?.(t.category || "Inbox") || "#A1A1AA" }} />
          {t.category || "Inbox"}
        </span>
      </span>
      <span className="shrink-0 pt-px text-[12px] font-semibold tabular-nums text-ink/60">{formatMinutes(t.estimated_minutes || 0)}</span>
    </li>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt preview"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="relative flex max-h-full w-full max-w-[380px] flex-col"
      >
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="absolute -right-2 -top-2 z-10 rounded-full border border-line bg-white p-1.5 text-ink shadow-card transition-colors hover:bg-canvas"
        >
          <X size={15} />
        </button>

        <div className="min-h-0 overflow-y-auto scroll-thin rounded-t-2xl">
          {/* Everything inside receiptRef ends up in the PNG */}
          <div ref={receiptRef} className="bg-canvas p-3">
            <div className="rounded-t-2xl bg-white px-6 pb-5 pt-6 text-ink">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink">
                    {/* Plain <img> so html-to-image can inline it */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/sb_star.png" alt="" className="h-4 w-4 object-contain" />
                  </span>
                  <span className="text-[15px] font-extrabold tracking-tight">Starboard</span>
                </span>
                <span className="rounded-md bg-canvas px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {tasks.length} task{tasks.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-5">
                <p className="text-[22px] font-extrabold leading-tight tracking-tight">{title}</p>
                <p className="mt-1 text-xs text-muted">
                  {dateLabel} · {timeLabel}
                </p>
              </div>

              {/* Progress */}
              <div className="mt-5 rounded-xl bg-canvas px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-ink/70">Progress</span>
                  <span className="text-xs font-bold tabular-nums">
                    {done.length}/{tasks.length} done · {pct}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-pink" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Lists */}
              {todo.length > 0 && (
                <div className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">To do · {todo.length}</p>
                  <ul className="mt-1.5">{todo.map(row)}</ul>
                </div>
              )}
              {done.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Done · {done.length}</p>
                  <ul className="mt-1.5">{done.map(row)}</ul>
                </div>
              )}
              {tasks.length === 0 && <p className="mt-6 text-center text-sm text-muted">Nothing on this list yet.</p>}

              {/* Totals */}
              <div className="mt-5 border-t border-dashed border-ink/15 pt-4 text-[12px]">
                <div className="flex justify-between py-0.5">
                  <span className="text-muted">Time planned</span>
                  <span className="font-semibold tabular-nums">{formatMinutes(plannedMins)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted">Time completed</span>
                  <span className="font-semibold tabular-nums">{formatMinutes(doneMins)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-dashed border-ink/15 pt-2.5 text-[13px]">
                  <span className="font-bold">Total tasks</span>
                  <span className="font-extrabold tabular-nums">{tasks.length}</span>
                </div>
              </div>

              <p className="mt-5 text-center text-[11px] font-medium text-muted">
                {pct === 100 && tasks.length > 0 ? "All untangled. Nice work." : "One thing at a time. You've got this."}
              </p>
            </div>
            {/* Torn edge */}
            <div className="h-3 w-full" style={zigzag} />
          </div>
        </div>

        <button onClick={handleDownload} disabled={exporting} className="btn-primary mt-4 w-full py-3 text-sm">
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {exporting ? "Saving image..." : "Download as image"}
        </button>
      </motion.div>
    </motion.div>
  );
}
