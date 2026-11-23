"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { motion } from "framer-motion";
import { Loader2, X, Download } from "lucide-react";
import type { Task } from "@/lib/types";

interface ReceiptExportProps {
  tasks: Task[];
  onClose: () => void;
  title?: string;
}

export default function ReceiptExport({ tasks, onClose, title = "Starboard" }: ReceiptExportProps) {
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
        pixelRatio: 2,
        backgroundColor: "#FFFDF8",
      });
      const link = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "starboard";
      link.download = `${slug}-${today}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Export failed silently — the button just re-enables so the user can retry
    } finally {
      setExporting(false);
    }
  }

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt preview"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -60, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        exit={{ opacity: 0, y: 40, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 180, damping: 18 }}
        className="relative flex max-h-[90vh] w-full max-w-sm flex-col items-center"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="absolute -top-3 -right-3 z-10 rounded-full bg-white p-2 text-ink shadow-md transition-transform duration-300 hover:rotate-90"
        >
          <X size={16} />
        </button>

        {/* Scrollable receipt card */}
        <div className="w-full overflow-y-auto rounded-2xl shadow-[0_30px_80px_-20px_rgba(45,36,64,0.5)] scroll-thin">
          <div
            ref={receiptRef}
            className="w-full bg-[#FFFDF8] px-6 py-8 font-mono text-slate-800"
          >
            <p className="text-center text-3xl font-bold tracking-tighter">
              {title}
            </p>
            <p className="mt-1 text-center text-xs text-slate-500">{dateLabel}</p>
            <div className="my-4 border-t border-dashed border-slate-300" />
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2 text-sm">
                  <span className="text-slate-400">{t.completed ? "☑" : "☐"}</span>
                  <span className={t.completed ? "line-through text-slate-400" : ""}>{t.title}</span>
                </li>
              ))}
            </ul>
            <div className="my-4 border-t border-dashed border-slate-300" />
            <p className="text-center text-xs text-slate-500">
              {tasks.filter((t) => t.completed).length} / {tasks.length} untangled ✨
            </p>
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={exporting}
          className="btn-primary mt-4 w-full px-4 py-3 text-sm"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {exporting ? "Printing..." : "Download Receipt"}
        </button>
      </motion.div>
    </motion.div>
  );
}