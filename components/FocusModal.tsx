"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, RotateCcw, Sparkles, CheckCircle2, Check, Zap, Volume2, VolumeX } from "lucide-react";
import type { Task } from "@/lib/types";

interface FocusModalProps {
  task: Task;
  onClose: () => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  reason?: string | null; // Added reason prop
}

export default function FocusModal({
  task,
  onClose,
  onToggleSubtask,
  onCompleteTask,
  reason,
}: FocusModalProps) {
  const initialDuration = (task.estimated_minutes || 25) * 60;
  const [timeLeft, setTimeLeft] = useState<number>(initialDuration);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [totalSeconds, setTotalSeconds] = useState<number>(initialDuration);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isStuckLoading, setIsStuckLoading] = useState<boolean>(false);
  const [stuckTip, setStuckTip] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Escape-to-close, a basic focus trap, and focus restore on close —
  // brings this modal up to the same a11y baseline as ReceiptExport,
  // which already had Escape/backdrop-click/role="dialog".
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  // Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      if (soundEnabled) playChime();
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, soundEnabled]);

  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      console.log("Audio not allowed yet");
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;

  const handleSetPreset = (mins: number) => {
    setIsRunning(false);
    setTotalSeconds(mins * 60);
    setTimeLeft(mins * 60);
  };

  // Extending the timer must grow totalSeconds too, or progress goes
  // negative once timeLeft exceeds the original total and the ring
  // renders past a full circle.
  const handleAddFiveMinutes = () => {
    setTotalSeconds((prev) => prev + 300);
    setTimeLeft((prev) => prev + 300);
  };

  const handleFeelingStuck = async () => {
    setIsStuckLoading(true);
    setStuckTip(null);
    try {
      const res = await fetch("/api/stuck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: task.title }),
      });

      const data = await res.json();
      if (res.ok && data.tip) {
        setStuckTip(`👉 ${data.tip}`);
      } else {
        setStuckTip(`👉 Open your tools and write down just the very first sentence without judging quality.`);
      }
    } catch (err) {
      setStuckTip(`👉 Open your workspace and take 1 small action right now.`);
    } finally {
      setIsStuckLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, y: 40, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="w-full max-w-lg bg-white border border-line rounded-3xl shadow-pop p-6 sm:p-8 space-y-6 relative overflow-hidden focus:outline-none my-auto"
      >

        {/* Top Header */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-[0.08em] bg-canvas text-ink flex items-center gap-1.5">
              <Zap size={12} className="text-amber-deep" />
              Focus Mode
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setSoundEnabled(!soundEnabled)} aria-label={soundEnabled ? "Mute chime" : "Unmute chime"} className="p-2 text-muted hover:text-ink hover:bg-canvas rounded-lg transition">
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button onClick={onClose} aria-label="Close focus mode" className="p-2 text-muted hover:text-ink hover:bg-canvas rounded-lg transition">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Task Title & AI Reason */}
        <div className="relative text-center space-y-2">
          <h2 id={titleId} className="text-xl sm:text-2xl font-extrabold tracking-tight text-ink leading-snug">{task.title}</h2>
          {reason && (
            <p className="text-xs font-medium text-mint-deep bg-mint-soft inline-block px-3 py-1 rounded-lg">
              ✨ {reason}
            </p>
          )}
        </div>

        {/* Minimal Circular Timer Ring */}
        <div className="flex flex-col items-center justify-center relative my-4">
          <div className="relative w-56 h-56 flex items-center justify-center">
            {/* Gentle breathing disc while the timer is running */}
            <motion.div
              aria-hidden="true"
              className="absolute inset-6 rounded-full bg-amber-soft"
              animate={isRunning ? { scale: [0.96, 1.02, 0.96] } : { scale: 0.96 }}
              transition={isRunning ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
            />
            <svg className="relative w-full h-full transform -rotate-90">
              <defs>
                <linearGradient id="focus-ring-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#18181B" />
                  <stop offset="100%" stopColor="#18181B" />
                </linearGradient>
              </defs>
              <circle cx="112" cy="112" r="100" stroke="#ECE8E2" strokeWidth="8" fill="transparent" />
              <circle
                cx="112" cy="112" r="100" stroke="url(#focus-ring-grad)" strokeWidth="8" fill="transparent"
                strokeDasharray={2 * Math.PI * 100}
                strokeDashoffset={2 * Math.PI * 100 - progress * (2 * Math.PI * 100)}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-5xl font-extrabold tracking-tight text-ink tabular-nums">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center gap-3 mt-6">
            <button onClick={() => handleSetPreset(totalSeconds / 60)} aria-label="Reset timer" className="p-3 rounded-xl border border-line bg-white hover:bg-canvas text-ink/80 transition">
              <RotateCcw size={18} />
            </button>

            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-8 py-3.5 text-sm ${
                isRunning
                  ? "inline-flex items-center gap-2 rounded-xl font-semibold bg-white text-ink border-2 border-ink transition active:scale-95"
                  : "btn-primary"
              }`}
            >
              {isRunning ? <><Pause size={16} className="fill-current" /> Pause</> : <><Play size={16} className="fill-current" /> Start Focus</>}
            </button>

            <button onClick={handleAddFiveMinutes} className="px-3.5 py-3 rounded-xl border border-line bg-white hover:bg-canvas text-ink/80 text-xs font-semibold transition">
              +5m
            </button>
          </div>

          {/* Presets */}
          <div className="relative flex items-center gap-1 mt-4 text-xs rounded-xl bg-canvas border border-line p-1">
            {[15, 25, 45, 60].map((m) => (
              <button
                key={m} onClick={() => handleSetPreset(m)}
                className={`relative px-3.5 py-1 rounded-lg font-semibold transition-colors ${
                  totalSeconds === m * 60 ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {/* Static highlight on purpose: a layoutId (sliding) highlight
                    here kept the modal's exit animation from ever finishing,
                    leaving an invisible overlay that blocked the whole app. */}
                {totalSeconds === m * 60 && (
                  <span className="absolute inset-0 rounded-lg bg-white border border-line shadow-card" />
                )}
                <span className="relative">{m}m</span>
              </button>
            ))}
          </div>
        </div>

        {/* AI "Feeling Stuck?" Helper */}
        <div className="relative bg-lilac-soft rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <Sparkles size={14} className="text-lilac-deep" /> Stuck? Get a nudge
            </div>
            <button
              onClick={handleFeelingStuck} disabled={isStuckLoading}
              className="text-xs font-semibold text-ink bg-white px-3 py-1.5 rounded-lg border border-line hover:border-ink/30 transition disabled:opacity-60"
            >
              {isStuckLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Sparkles size={12} className="animate-spin" /> Thinking...
                </span>
              ) : (
                "Feeling Stuck?"
              )}
            </button>
          </div>
          <AnimatePresence>
            {stuckTip && (
              <motion.div
                key={stuckTip}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 p-3 bg-white rounded-xl text-sm text-ink"
              >
                {stuckTip}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Subtask Checklist */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="relative space-y-1.5 max-h-36 overflow-y-auto pr-1 scroll-thin">
            <span className="eyebrow block">Steps</span>
            {task.subtasks.map((sub) => (
              <div key={sub.id} onClick={() => onToggleSubtask(task.id, sub.id)} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-canvas text-sm cursor-pointer transition">
                <div className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center border-2 transition ${sub.completed ? "bg-ink border-ink text-white" : "border-ink/25 bg-white"}`}>
                  {sub.completed && <Check size={10} strokeWidth={3} />}
                </div>
                <span className={`flex-1 ${sub.completed ? "line-through text-ink/50" : "text-ink font-medium"}`}>{sub.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Complete Task Button */}
        <div className="relative pt-4 border-t border-line flex items-center justify-between gap-3">
          <span className="text-xs text-ink/70 font-medium">Finished your focus session?</span>
          <button
            onClick={() => onCompleteTask(task.id)}
            className="btn-primary px-4 py-2.5 text-xs"
          >
            <CheckCircle2 size={16} /> Complete Task
          </button>
        </div>

      </motion.div>
    </motion.div>
  );
}