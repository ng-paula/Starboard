"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Sparkles,
  Plus,
  ArrowLeft,
  Zap,
  Calendar,
  Folder,
  CheckSquare,
  Trash2,
  LayoutGrid,
  Receipt,
  Flame,
  type LucideIcon,
} from "lucide-react";
import { useTaskStore } from "@/store/useTaskStore";
import { useBrainDump } from "@/hooks/useBrainDump";
import TaskCard from "./TaskCard";
import FocusModal from "./FocusModal";
import ReceiptExport from "./ReceiptExport";

interface DashboardProps {
  onBackToLanding: () => void;
}

type ViewMode = "Categories" | "Timeline" | "Completed";

interface Toast {
  id: string;
  message: string;
  tone: "info" | "error" | "success";
}

const AI_LOADING_MESSAGES = [
  "Reading your thoughts...",
  "Sorting into categories...",
  "Estimating effort...",
  "Almost there...",
];

const VIEWS: {
  id: ViewMode;
  label: string;
  icon: LucideIcon;
  activeClasses: string;
  ringClass: string;
}[] = [
  {
    id: "Categories",
    label: "Folders",
    icon: Folder,
    activeClasses: "bg-pink-500 text-white shadow-sm",
    ringClass: "focus-visible:ring-pink-300",
  },
  {
    id: "Timeline",
    label: "Timeline",
    icon: Calendar,
    activeClasses: "bg-sky-500 text-white shadow-sm",
    ringClass: "focus-visible:ring-sky-300",
  },
  {
    id: "Completed",
    label: "Completed",
    icon: CheckSquare,
    activeClasses: "bg-emerald-500 text-white shadow-sm",
    ringClass: "focus-visible:ring-emerald-300",
  },
];

export default function Dashboard({ onBackToLanding }: DashboardProps) {
  const { tasks, addTask, clearCompleted, toggleTask, reorderTasks, toggleSubtask } = useTaskStore();
  const { parseText, isLoadingAi } = useBrainDump();

  const [inputVal, setInputVal] = useState("");
  const [isSparkleMode, setIsSparkleMode] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [focusReason, setFocusReason] = useState<string | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const [activeView, setActiveView] = useState<ViewMode>("Categories");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeTimeline, setActiveTimeline] = useState<string>("Today");

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [aiMessageIndex, setAiMessageIndex] = useState(0);

  const focusedTask = tasks.find((t) => t.id === focusedTaskId) || null;

  // --- Memoized derived state ---
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (t.completed) continue;
      const key = t.category || "Inbox";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [tasks]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(tasks.map((t) => t.category).filter(Boolean) as string[]))],
    [tasks]
  );

  const timelineFilters = ["Today", "Tomorrow", "Later"];

  const pendingTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const completedCount = tasks.length - pendingTasks.length;
  const progressPct = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  const displayedTasks = useMemo(() => {
    if (activeView === "Completed") {
      return tasks.filter((t) => t.completed);
    }
    if (activeView === "Categories") {
      return activeCategory === "All" ? pendingTasks : pendingTasks.filter((t) => t.category === activeCategory);
    }
    if (activeView === "Timeline") {
      return pendingTasks.filter((t) => {
        const hint = t.due_hint?.toLowerCase() || "";
        if (activeTimeline === "Today") return hint.includes("today") || hint.includes("tonight");
        if (activeTimeline === "Tomorrow") return hint.includes("tomorrow");
        return !hint.includes("today") && !hint.includes("tonight") && !hint.includes("tomorrow");
      });
    }
    return tasks;
  }, [tasks, pendingTasks, activeView, activeCategory, activeTimeline]);

  // --- Toast helpers ---
  const pushToast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // --- Cycle AI loading messages while parsing ---
  useEffect(() => {
    if (!isLoadingAi) {
      setAiMessageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setAiMessageIndex((i) => (i + 1) % AI_LOADING_MESSAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [isLoadingAi]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    if (isSparkleMode) {
      const success = await parseText(inputVal);
      if (success) {
        setInputVal("");
        setIsSparkleMode(false);
        setActiveView("Categories");
        setActiveCategory("All");
        pushToast("Tasks organized from your brain dump.", "success");
      } else {
        pushToast("Couldn't parse that — try rephrasing.", "error");
      }
    } else {
      addTask({
        id: crypto.randomUUID(),
        title: inputVal.trim(),
        completed: false,
        priority: "important",
        energy_level: "high_focus",
        estimated_minutes: 25,
        category: activeCategory !== "All" ? activeCategory : "Inbox",
        due_hint: activeTimeline === "Today" ? "Today" : null,
        subtasks: [],
      });
      setInputVal("");
    }
  };

  const handleOptimizeFlow = async () => {
    if (pendingTasks.length <= 1) {
      pushToast("Add a few more tasks first to optimize your flow!", "info");
      return;
    }

    setIsOptimizing(true);
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.tasks) {
        reorderTasks(data.tasks);
        pushToast("Flow optimized.", "success");
      }
    } catch (err: any) {
      pushToast(`Optimization error: ${err.message}`, "error");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleWhatNow = () => {
    if (pendingTasks.length === 0) {
      pushToast("All done! Time to relax.", "success");
      return;
    }
    const urgent = pendingTasks.find((t) => t.priority === "urgent_important");
    if (urgent) {
      setFocusReason("Picked because it's urgent and important.");
      setFocusedTaskId(urgent.id);
      return;
    }
    const quick = pendingTasks.find((t) => t.energy_level === "quick_admin");
    if (quick) {
      setFocusReason("Picked because it's quick — a fast win.");
      setFocusedTaskId(quick.id);
      return;
    }
    setFocusReason("Picked because it's next on your list.");
    setFocusedTaskId(pendingTasks[0].id);
  };

  const handleClearCompleted = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      confirmTimeoutRef.current = setTimeout(() => setConfirmingClear(false), 3000);
      return;
    }
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    setConfirmingClear(false);
    clearCompleted();
    pushToast("Completed tasks cleared.", "success");
  };

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    };
  }, []);

  const emptyStateCopy = useMemo(() => {
    if (activeView === "Completed") {
      return { title: "Nothing completed yet.", sub: "Finish a task and it'll land here.", icon: CheckSquare };
    }
    if (activeView === "Timeline") {
      return {
        title: `No tasks for ${activeTimeline.toLowerCase()} yet.`,
        sub: "Add one on the left, or switch timelines.",
        icon: Calendar,
      };
    }
    if (activeView === "Categories" && activeCategory !== "All") {
      return { title: `Nothing in ${activeCategory} yet.`, sub: "Add a task or pick another folder.", icon: Folder };
    }
    return {
      title: "Nothing to see here right now.",
      sub: "Use the AI Brain Dump on the left to organize your thoughts.",
      icon: LayoutGrid,
    };
  }, [activeView, activeTimeline, activeCategory]);

  const EmptyIcon = emptyStateCopy.icon;

  return (
    <div
      className="min-h-screen w-full relative"
      style={{
        backgroundColor: "#ffffff",
        backgroundImage:
          "radial-gradient(circle, rgba(236,72,153,0.18) 2px, transparent 2px), radial-gradient(circle, rgba(236,72,153,0.18) 2px, transparent 2px)",
        backgroundSize: "48px 48px, 48px 48px",
        backgroundPosition: "0 0, 24px 24px",
      }}
    >
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full bg-[#BFE3F2]/90 backdrop-blur-md border-b border-[#8FC4DE]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button
            onClick={onBackToLanding}
            aria-label="Back to landing page"
            className="flex items-center shrink-0 -ml-1 rounded-xl transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
          >
            <img src="/sb_logo.png" alt="Starboard" className="h-14 w-auto" />
          </button>

          <nav
            className="hidden sm:flex items-center gap-1 bg-white/60 rounded-full p-1"
            role="tablist"
            aria-label="Dashboard views"
          >
            {VIEWS.map((view) => {
              const Icon = view.icon;
              const isActive = activeView === view.id;
              return (
                <button
                  key={view.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveView(view.id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 ${view.ringClass} ${
                    isActive ? view.activeClasses : "text-slate-600 hover:bg-white"
                  }`}
                >
                  <Icon size={14} /> {view.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white/60 px-3 py-1.5 rounded-full">
              <Sparkles size={12} className="text-pink-400" />
              {pendingTasks.length} left
            </span>
            <button
              onClick={handleWhatNow}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-400 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <Zap size={14} className="fill-current" /> <span className="hidden sm:inline">What Now?</span>
            </button>
          </div>
        </div>

        {/* Mobile view tabs */}
        <div
          className="sm:hidden flex items-center gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hide"
          role="tablist"
          aria-label="Dashboard views"
        >
          {VIEWS.map((view) => {
            const Icon = view.icon;
            const isActive = activeView === view.id;
            return (
              <button
                key={view.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveView(view.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 ${view.ringClass} ${
                  isActive ? view.activeClasses : "bg-white/60 text-slate-600"
                }`}
              >
                <Icon size={13} /> {view.label}
              </button>
            );
          })}
        </div>      
      </header>

      {/* Toasts — sit below the navbar so they never cover it */}
      <div
        className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-[min(90vw,320px)]"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-in fade-in slide-in-from-top-2 ${
              t.tone === "error" ? "bg-rose-500" : t.tone === "success" ? "bg-emerald-500" : "bg-slate-800"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 xl:gap-10 px-4 py-6 sm:py-8">
        {/* LEFT COLUMN: Add task + progress */}
        <aside className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
          <div className="flex flex-col gap-5 sticky top-24">
            <div className="bg-white rounded-3xl p-5 shadow-[0_6px_24px_rgba(233,169,194,0.18)] border-2 border-dashed border-pink-200 flex flex-col gap-2">
              <form onSubmit={handleAddTask} className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Add task</span>
                  <button
                    type="button"
                    onClick={() => setIsSparkleMode(!isSparkleMode)}
                    aria-pressed={isSparkleMode}
                    aria-label="Toggle AI brain-dump mode"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 ${
                      isSparkleMode ? "bg-pink-400 text-white" : "bg-pink-50 text-pink-500 hover:bg-pink-100"
                    }`}
                  >
                    <Sparkles size={12} /> AI Mode
                  </button>
                </div>

                <div className="relative">
                  {isSparkleMode ? (
                    <textarea
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      placeholder="Dump chaotic thoughts here..."
                      aria-label="Brain dump input"
                      className="w-full p-3.5 pr-12 rounded-xl border-2 border-pink-100 focus:border-pink-400 focus:outline-none min-h-[100px] text-sm resize-none text-slate-700 bg-pink-50/30 transition-all duration-200"
                    />
                  ) : (
                    <input
                      type="text"
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      placeholder="Quick task title..."
                      aria-label="Quick task title"
                      className="w-full p-3.5 pr-12 rounded-xl border-2 border-slate-100 focus:border-slate-300 focus:outline-none text-sm text-slate-700 bg-slate-50/50 transition-all duration-200"
                    />
                  )}
                  <button
                    type="submit"
                    disabled={isLoadingAi || !inputVal.trim()}
                    aria-label={isSparkleMode ? "Parse brain dump into tasks" : "Add task"}
                    className="absolute right-2 bottom-2 p-2 bg-slate-900 text-white rounded-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    {isLoadingAi ? <Sparkles size={14} className="animate-spin text-pink-400" /> : <Plus size={14} />}
                  </button>
                </div>

                <p
                  className={`text-xs text-pink-400 font-medium px-1 min-h-[1rem] transition-opacity duration-300 ${
                    isLoadingAi ? "opacity-100" : "opacity-0"
                  }`}
                  aria-live="polite"
                >
                  {isLoadingAi ? AI_LOADING_MESSAGES[aiMessageIndex] : ""}
                </p>
              </form>
            </div>

            {tasks.length > 0 && (
              <div className="bg-white rounded-3xl p-5 shadow-[0_6px_24px_rgba(233,169,194,0.18)] border-2 border-dashed border-pink-200 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <Flame size={12} className="text-pink-400" /> Today's progress
                  </span>
                  <span className="text-2xl font-bold text-pink-500 leading-none">{progressPct}%</span>
                </div>
                <div className="h-3 w-full bg-pink-50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-300 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {completedCount === 0
                    ? "Finish your first task to get the ball rolling."
                    : `${completedCount} of ${tasks.length} done — keep going!`}
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN: Workspace */}
        <main className="flex-1 flex flex-col gap-4 lg:gap-6 min-w-0">
          <div className="relative bg-white rounded-3xl p-5 shadow-[0_6px_24px_rgba(233,169,194,0.18)] border-2 border-dashed border-pink-200 flex flex-col gap-4">
            <div className="absolute -top-2.5 left-8 w-16 h-3 bg-[#BFE3F2] rounded-t-lg" aria-hidden="true" />
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {activeView === "Categories" && (
                  <>
                    <Folder className="text-pink-400" /> Task Folders
                  </>
                )}
                {activeView === "Timeline" && (
                  <>
                    <Calendar className="text-sky-400" /> Schedule
                  </>
                )}
                {activeView === "Completed" && (
                  <>
                    <CheckSquare className="text-emerald-400" /> Archive
                  </>
                )}
              </h1>

              <div className="flex items-center gap-2">
                {activeView === "Timeline" && (
                  <button
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    <Receipt size={14} /> Print Agenda
                  </button>
                )}
                {activeView !== "Completed" && (
                  <button
                    onClick={handleOptimizeFlow}
                    disabled={isOptimizing || pendingTasks.length <= 1}
                    aria-label="Optimize task flow order"
                    title={pendingTasks.length <= 1 ? "Add a few more tasks to optimize flow" : undefined}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-600 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 disabled:hover:bg-pink-50 border border-pink-100 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
                  >
                    <Sparkles size={14} className={isOptimizing ? "animate-spin" : ""} />
                    {isOptimizing ? "Optimizing Flow..." : "Optimize Flow"}
                  </button>
                )}
              </div>
            </div>

            {activeView === "Categories" && (
              <div
                className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
                role="tablist"
                aria-label="Filter by category"
              >
                {categories.map((cat) => {
                  const count = cat === "All" ? pendingTasks.length : categoryCounts.get(cat as string) || 0;
                  return (
                    <button
                      key={cat as string}
                      role="tab"
                      aria-selected={activeCategory === cat}
                      onClick={() => setActiveCategory(cat as string)}
                      className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                        activeCategory === cat ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {cat as string} {count > 0 && <span className="opacity-60">({count})</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {activeView === "Timeline" && (
              <div
                className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
                role="tablist"
                aria-label="Filter by timeline"
              >
                {timelineFilters.map((time) => (
                  <button
                    key={time}
                    role="tab"
                    aria-selected={activeTimeline === time}
                    onClick={() => setActiveTimeline(time)}
                    className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                      activeTimeline === time ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}

            {activeView === "Completed" && (
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-sm font-medium text-slate-500">
                  You've finished {displayedTasks.length} task{displayedTasks.length === 1 ? "" : "s"}!
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsReceiptModalOpen(true)}
                    disabled={displayedTasks.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    <Receipt size={14} /> Export Receipt
                  </button>
                  <button
                    onClick={handleClearCompleted}
                    disabled={displayedTasks.length === 0}
                    aria-label={confirmingClear ? "Confirm clear all completed tasks" : "Clear all completed tasks"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${
                      confirmingClear
                        ? "bg-rose-500 text-white border border-rose-500"
                        : "bg-white border border-rose-200 text-rose-500 hover:bg-rose-50"
                    }`}
                  >
                    <Trash2 size={14} /> {confirmingClear ? "Confirm Clear?" : "Clear All"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 pb-20">
            {displayedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-pink-200">
                <EmptyIcon size={32} className="text-pink-200 mb-3" />
                <p className="text-sm font-medium text-slate-500">{emptyStateCopy.title}</p>
                <p className="text-xs text-slate-400 mt-1">{emptyStateCopy.sub}</p>
              </div>
            ) : (
              displayedTasks.map((task) => (
                <TaskCard key={task.id} task={task} onStartFocus={(t) => { setFocusReason(null); setFocusedTaskId(t.id); }} />
              ))
            )}
          </div>
        </main>
      </div>

      {focusedTask && (
        <FocusModal
          task={focusedTask}
          reason={focusReason}
          onClose={() => {
            setFocusedTaskId(null);
            setFocusReason(null);
          }}
          onCompleteTask={(id) => {
            toggleTask(id);
            setFocusedTaskId(null);
            setFocusReason(null);
          }}
          onToggleSubtask={toggleSubtask}
        />
      )}

      {isReceiptModalOpen && (
        <ReceiptExport tasks={displayedTasks} onClose={() => setIsReceiptModalOpen(false)} />
      )}
    </div>
  );
}