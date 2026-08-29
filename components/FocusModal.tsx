"use client";

import React, { useState, useEffect, useRef, useId } from "react";
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
      const prompt = `Give a high-impact, single-sentence 30-second micro-action to overcome procrastination and immediately start working on this task: "${task.title}". Keep it punchy, practical, and under 25 words.`;
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.tasks && data.tasks.length > 0) {
          setStuckTip(`👉 ${data.tasks[0].title}`);
        } else {
          setStuckTip(`👉 Open your tools and write down just the very first sentence without judging quality.`);
        }
      }
    } catch (err) {
      setStuckTip(`👉 Open your workspace and take 1 small action right now.`);
    } finally {
      setIsStuckLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#e4f0fa]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-xl bg-white/95 border border-folder-pink/40 rounded-[2rem] shadow-[0_10px_40px_rgba(233,169,194,0.25)] p-6 sm:p-8 space-y-6 relative overflow-hidden focus:outline-none"
      >

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-folder-pink/25">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-folder-pink/30 text-ink flex items-center gap-1.5">
              <Zap size={12} className="text-folder-pinkDeep" />
              Focus Mode
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 text-ink/70 hover:text-folder-pinkDeep hover:bg-folder-pink/15 rounded-xl transition">
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button onClick={onClose} className="p-1.5 text-ink/70 hover:text-folder-pinkDeep hover:bg-folder-pink/15 rounded-xl transition">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Task Title & AI Reason */}
        <div className="text-center space-y-2">
          <h2 id={titleId} className="text-lg sm:text-xl font-bold text-ink leading-snug">{task.title}</h2>
          {reason && (
            <p className="text-[11px] font-semibold text-ink bg-button-green/20 border border-button-green/40 inline-block px-3 py-1 rounded-full animate-in slide-in-from-bottom-2">
              ✨ {reason}
            </p>
          )}
        </div>

        {/* Minimal Circular Timer Ring */}
        <div className="flex flex-col items-center justify-center relative my-4">
          <div className="relative w-56 h-56 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="112" cy="112" r="100" stroke="#FBEAF0" strokeWidth="8" fill="transparent" />
              <circle
                cx="112" cy="112" r="100" stroke="#E9A9C2" strokeWidth="8" fill="transparent"
                strokeDasharray={2 * Math.PI * 100}
                strokeDashoffset={2 * Math.PI * 100 - progress * (2 * Math.PI * 100)}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-5xl font-bold tracking-tight text-ink font-mono">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center gap-3 mt-6">
            <button onClick={() => handleSetPreset(totalSeconds / 60)} className="p-3 rounded-2xl bg-ink/5 hover:bg-ink/10 text-ink/80 transition">
              <RotateCcw size={18} />
            </button>

            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-8 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition shadow-sm active:scale-95 ${
                isRunning ? "bg-folder-pinkDeep hover:bg-[#9c4767] text-white" : "bg-[#bce0fd] hover:bg-[#a6d3fc] text-[#2E6A82]"
              }`}
            >
              {isRunning ? <><Pause size={16} className="fill-current" /> Pause</> : <><Play size={16} className="fill-current" /> Start Focus</>}
            </button>

            <button onClick={handleAddFiveMinutes} className="px-3 py-2.5 rounded-2xl bg-ink/5 hover:bg-ink/10 text-ink/80 text-xs font-semibold transition">
              +5m
            </button>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2 mt-4 text-xs">
            {[15, 25, 45, 60].map((m) => (
              <button
                key={m} onClick={() => handleSetPreset(m)}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  totalSeconds === m * 60 ? "bg-folder-pink/30 text-ink" : "bg-ink/5 hover:bg-ink/10 text-ink/80"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        {/* AI "Feeling Stuck?" Helper */}
        <div className="bg-star/20 border border-star/45 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <Sparkles size={14} className="text-folder-pinkDeep" /> AI Momentum Assistant
            </div>
            <button
              onClick={handleFeelingStuck} disabled={isStuckLoading}
              className="text-xs font-semibold text-ink hover:text-folder-pinkDeep transition"
            >
              {isStuckLoading ? "Thinking..." : "Feeling Stuck?"}
            </button>
          </div>
          {stuckTip && (
            <div className="mt-3 p-3 bg-white border border-star/40 rounded-xl text-xs text-ink font-medium animate-in fade-in">
              {stuckTip}
            </div>
          )}
        </div>

        {/* Subtask Checklist */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
            <span className="text-[10px] font-bold text-ink/80 uppercase tracking-wider block">Steps</span>
            {task.subtasks.map((sub) => (
              <div key={sub.id} onClick={() => onToggleSubtask(task.id, sub.id)} className="flex items-center gap-2 p-2 rounded-xl hover:bg-folder-pink/10 text-xs cursor-pointer transition border border-transparent hover:border-folder-pink/30">
                <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${sub.completed ? "bg-button-greenDeep border-button-greenDeep text-white" : "border-folder-pink/50 bg-white"}`}>
                  {sub.completed && <Check size={10} strokeWidth={3} />}
                </div>
                <span className={`flex-1 ${sub.completed ? "line-through text-ink/50" : "text-ink font-medium"}`}>{sub.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Complete Task Button */}
        <div className="pt-4 border-t border-folder-pink/25 flex items-center justify-between">
          <span className="text-xs text-ink/80 font-medium">Finished your focus session?</span>
          <button
            onClick={() => onCompleteTask(task.id)}
            className="px-5 py-2.5 bg-button-greenDeep hover:bg-button-greenDark text-white font-semibold text-xs rounded-xl transition flex items-center gap-2 active:scale-95"
          >
            <CheckCircle2 size={16} /> Complete Task
          </button>
        </div>

      </div>
    </div>
  );
}