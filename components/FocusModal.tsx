"use client";

import React, { useState, useEffect } from "react";
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
  const circumference = 2 * Math.PI * 110;
  const strokeDashoffset = circumference - progress * circumference;

  const handleSetPreset = (mins: number) => {
    setIsRunning(false);
    setTotalSeconds(mins * 60);
    setTimeLeft(mins * 60);
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
    <div className="fixed inset-0 z-50 bg-[#e4f0fa]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white/95 border border-pink-100 rounded-[2rem] shadow-[0_10px_40px_rgba(236,72,153,0.1)] p-6 sm:p-8 space-y-6 relative overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-pink-50">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pink-100 text-pink-600 flex items-center gap-1.5">
              <Zap size={12} className="text-pink-500" />
              Focus Mode
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 text-[#8c7682] hover:text-pink-500 hover:bg-pink-50 rounded-xl transition">
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button onClick={onClose} className="p-1.5 text-[#8c7682] hover:text-pink-500 hover:bg-pink-50 rounded-xl transition">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Task Title & AI Reason */}
        <div className="text-center space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 leading-snug">{task.title}</h2>
          {reason && (
            <p className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 inline-block px-3 py-1 rounded-full animate-in slide-in-from-bottom-2">
              ✨ {reason}
            </p>
          )}
        </div>

        {/* Minimal Circular Timer Ring */}
        <div className="flex flex-col items-center justify-center relative my-4">
          <div className="relative w-56 h-56 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="112" cy="112" r="100" stroke="#fdf2f8" strokeWidth="8" fill="transparent" />
              <circle
                cx="112" cy="112" r="100" stroke="#f472b6" strokeWidth="8" fill="transparent"
                strokeDasharray={2 * Math.PI * 100}
                strokeDashoffset={2 * Math.PI * 100 - progress * (2 * Math.PI * 100)}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-5xl font-bold tracking-tight text-gray-800 font-mono">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center gap-3 mt-6">
            <button onClick={() => handleSetPreset(totalSeconds / 60)} className="p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-500 transition">
              <RotateCcw size={18} />
            </button>

            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-8 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition shadow-sm active:scale-95 ${
                isRunning ? "bg-pink-400 hover:bg-pink-500 text-white" : "bg-[#bce0fd] hover:bg-[#a6d3fc] text-[#2E6A82]"
              }`}
            >
              {isRunning ? <><Pause size={16} className="fill-current" /> Pause</> : <><Play size={16} className="fill-current" /> Start Focus</>}
            </button>

            <button onClick={() => setTimeLeft((prev) => prev + 300)} className="px-3 py-2.5 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold transition">
              +5m
            </button>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2 mt-4 text-xs">
            {[15, 25, 45, 60].map((m) => (
              <button
                key={m} onClick={() => handleSetPreset(m)}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  totalSeconds === m * 60 ? "bg-pink-100 text-pink-600" : "bg-gray-50 hover:bg-gray-100 text-gray-500"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        {/* AI "Feeling Stuck?" Helper */}
        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <Sparkles size={14} className="text-amber-500" /> AI Momentum Assistant
            </div>
            <button
              onClick={handleFeelingStuck} disabled={isStuckLoading}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition"
            >
              {isStuckLoading ? "Thinking..." : "Feeling Stuck?"}
            </button>
          </div>
          {stuckTip && (
            <div className="mt-3 p-3 bg-white border border-amber-100 rounded-xl text-xs text-amber-900 font-medium animate-in fade-in">
              {stuckTip}
            </div>
          )}
        </div>

        {/* Subtask Checklist */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Steps</span>
            {task.subtasks.map((sub) => (
              <div key={sub.id} onClick={() => onToggleSubtask(task.id, sub.id)} className="flex items-center gap-2 p-2 rounded-xl hover:bg-pink-50/30 text-xs cursor-pointer transition border border-transparent hover:border-pink-100">
                <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${sub.completed ? "bg-emerald-400 border-emerald-400 text-white" : "border-pink-200 bg-white"}`}>
                  {sub.completed && <Check size={10} strokeWidth={3} />}
                </div>
                <span className={`flex-1 ${sub.completed ? "line-through text-gray-400" : "text-gray-700 font-medium"}`}>{sub.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Complete Task Button */}
        <div className="pt-4 border-t border-pink-50 flex items-center justify-between">
          <span className="text-xs text-gray-400 font-medium">Finished your focus session?</span>
          <button
            onClick={() => onCompleteTask(task.id)}
            className="px-5 py-2.5 bg-emerald-400 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition flex items-center gap-2 active:scale-95"
          >
            <CheckCircle2 size={16} /> Complete Task
          </button>
        </div>

      </div>
    </div>
  );
}