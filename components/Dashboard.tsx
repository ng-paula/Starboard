"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Sparkles,
  Plus,
  Zap,
  Calendar,
  Folder,
  CheckSquare,
  Trash2,
  LayoutGrid,
  Receipt,
  Flame,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useTaskStore } from "@/store/useTaskStore";
import { useBrainDump } from "@/hooks/useBrainDump";
import { getWeekDates, toISODate, addDays, formatDayLabel, formatWeekRangeLabel, formatMonthDay } from "@/lib/dates";
import type { Task } from "@/lib/types";
import TaskCard from "./TaskCard";
import FocusModal from "./FocusModal";
import ReceiptExport from "./ReceiptExport";

const UNSCHEDULED = "unscheduled" as const;

// A folder's dot color is picked by its position in the order folders
// first appeared - stable as long as folders aren't reordered, which
// they never are (there's no reorder UI for folders).
const FOLDER_COLORS = [
  "#F2A6B0", // washi pink
  "#8FC4DE", // deep stripe blue
  "#E8C170", // warm tan
  "#7BA98A", // button green
  "#A78BC4", // soft purple
  "#C08552", // warm brown
  "#E98A7A", // coral
  "#6FA8A0", // teal
];

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

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
    id: "Timeline",
    label: "Timeline",
    icon: Calendar,
    activeClasses: "bg-ink text-white shadow-sm",
    ringClass: "focus-visible:ring-ink/40",
  },
  {
    id: "Categories",
    label: "Folders",
    icon: Folder,
    activeClasses: "bg-ink text-white shadow-sm",
    ringClass: "focus-visible:ring-ink/40",
  },
  {
    id: "Completed",
    label: "Completed",
    icon: CheckSquare,
    activeClasses: "bg-ink text-white shadow-sm",
    ringClass: "focus-visible:ring-ink/40",
  },
];

export default function Dashboard({ onBackToLanding }: DashboardProps) {
  const {
    tasks,
    customCategories,
    addTask,
    clearCompleted,
    toggleTask,
    reorderTasks,
    toggleSubtask,
    moveCategory,
    renameCategory,
    addCategory,
  } = useTaskStore();
  const { parseText, isLoadingAi } = useBrainDump();

  const [inputVal, setInputVal] = useState("");
  const [isSparkleMode, setIsSparkleMode] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [focusReason, setFocusReason] = useState<string | null>(null);
  const [receiptPayload, setReceiptPayload] = useState<{ tasks: Task[]; title: string } | null>(null);

  // Timeline is the default landing view - its functionality (what's due
  // today, quick scheduling) is more immediately useful than browsing
  // folders when the dashboard first opens.
  const [activeView, setActiveView] = useState<ViewMode>("Timeline");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Folder Rail (Categories view) - renaming a folder, creating a new
  // (possibly still-empty) one, and the folder-scoped "Add a task to X"
  // field shown in that folder's own panel.
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState("");
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState("");
  const [folderTaskInput, setFolderTaskInput] = useState("");

  // Weekly Timeline: a real Mon-Sun week of dates instead of a vague
  // Today/Tomorrow/Later enum, so tasks land on the actual day they're
  // scheduled for. selectedDay === null means "overview" - the main
  // panel groups tasks into Overdue/Today/Tomorrow/Later/Unscheduled
  // sections instead of filtering to one day. The side calendar lets
  // the user drill into a specific day (or Unscheduled) on demand.
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const changeWeek = (delta: number) => setWeekOffset((prev) => prev + delta);

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

  // Folder names come from whatever tasks currently use them, plus any
  // still-empty folders someone created via "+ New" that no task has
  // touched yet.
  const folderNames = useMemo(() => {
    const fromTasks = Array.from(new Set(tasks.map((t) => t.category).filter(Boolean) as string[]));
    return Array.from(new Set([...fromTasks, ...customCategories]));
  }, [tasks, customCategories]);

  const getFolderColor = (cat: string) => {
    const idx = folderNames.indexOf(cat);
    return idx === -1 ? FOLDER_COLORS[0] : FOLDER_COLORS[idx % FOLDER_COLORS.length];
  };

  const categoryMinutes = useMemo(() => {
    const sums = new Map<string, number>();
    for (const t of tasks) {
      if (t.completed) continue;
      const key = t.category || "Inbox";
      sums.set(key, (sums.get(key) || 0) + (t.estimated_minutes || 0));
    }
    return sums;
  }, [tasks]);

  const pendingTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);

  // Progress card: scoped to whichever folder is open, so it answers
  // "how am I doing on THIS folder" instead of always showing the global
  // total. "All tasks" (or any other view) still shows the global figure.
  const progressScope = useMemo(
    () => (activeView === "Categories" && activeCategory !== "All" ? tasks.filter((t) => t.category === activeCategory) : tasks),
    [tasks, activeView, activeCategory]
  );
  const progressScopeCompleted = progressScope.filter((t) => t.completed).length;
  const progressScopePct = progressScope.length === 0 ? 0 : Math.round((progressScopeCompleted / progressScope.length) * 100);
  const isFolderScopedProgress = activeView === "Categories" && activeCategory !== "All";

  const todayIso = toISODate(new Date());
  const tomorrowIso = toISODate(addDays(new Date(), 1));

  // Per-date totals (including completed) drive the sidebar calendar dots,
  // the Today/Tomorrow tab badges, and the day-header "X tasks - Y done"
  // line - all sourced from one place so they can't drift out of sync.
  const dateStats = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      const key = t.due_date || UNSCHEDULED;
      const entry = map.get(key) || { total: 0, done: 0 };
      entry.total++;
      if (t.completed) entry.done++;
      map.set(key, entry);
    }
    return map;
  }, [tasks]);

  const displayedTasks = useMemo(() => {
    if (activeView === "Completed") {
      return tasks.filter((t) => t.completed);
    }
    if (activeView === "Categories") {
      return activeCategory === "All" ? pendingTasks : pendingTasks.filter((t) => t.category === activeCategory);
    }
    if (activeView === "Timeline") {
      if (selectedDay === null) return pendingTasks; // overview mode - grouped rendering, but Print Agenda still exports everything shown
      // A specific day's agenda shows completed tasks too (struck through),
      // not just outstanding ones - unlike overview mode, which is
      // deliberately pending-only since it's about what's left to do.
      return tasks.filter((t) => (selectedDay === UNSCHEDULED ? !t.due_date : t.due_date === selectedDay));
    }
    return tasks;
  }, [tasks, pendingTasks, activeView, activeCategory, selectedDay]);

  // Today/Tomorrow/Later agenda used when no specific day is selected.
  // Real due_date means we can now separate a genuine "Overdue" group
  // instead of quietly mislabeling a missed task as "Later".
  const timelineGroups = useMemo(() => {
    if (activeView !== "Timeline" || selectedDay !== null) return null;

    const groups: { key: string; label: string; tasks: typeof pendingTasks }[] = [
      { key: "overdue", label: "Overdue", tasks: [] },
      { key: "today", label: "Today", tasks: [] },
      { key: "tomorrow", label: "Tomorrow", tasks: [] },
      { key: "later", label: "Later", tasks: [] },
      { key: "unscheduled", label: "Unscheduled", tasks: [] },
    ];
    const [overdue, today, tomorrow, later, unscheduled] = groups;

    for (const t of pendingTasks) {
      if (!t.due_date) unscheduled.tasks.push(t);
      else if (t.due_date < todayIso) overdue.tasks.push(t);
      else if (t.due_date === todayIso) today.tasks.push(t);
      else if (t.due_date === tomorrowIso) tomorrow.tasks.push(t);
      else later.tasks.push(t);
    }

    return groups.filter((g) => g.tasks.length > 0);
  }, [activeView, selectedDay, pendingTasks, todayIso, tomorrowIso]);

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
        // Most brain-dumped tasks land Unscheduled (the AI only assigns
        // Today/Tomorrow when the text says so explicitly) - jump straight
        // there instead of Folders, since that's exactly where the
        // one-click "Schedule" control lives to finish the job.
        setActiveView("Timeline");
        setSelectedDay(UNSCHEDULED);
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
        due_date: activeView === "Timeline" && selectedDay && selectedDay !== UNSCHEDULED ? selectedDay : null,
        subtasks: [],
      });
      setInputVal("");
    }
  };

  // Folder Rail: the "Add a task to {folder}..." field scoped to
  // whichever folder is currently open in the main panel.
  const handleAddTaskToFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderTaskInput.trim()) return;
    addTask({
      id: crypto.randomUUID(),
      title: folderTaskInput.trim(),
      completed: false,
      priority: "important",
      energy_level: "high_focus",
      estimated_minutes: 25,
      category: activeCategory === "All" ? "Inbox" : activeCategory,
      due_date: null,
      subtasks: [],
    });
    setFolderTaskInput("");
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = folderNameInput.trim();
    if (trimmed && trimmed !== activeCategory) {
      renameCategory(activeCategory, trimmed);
      setActiveCategory(trimmed);
    }
    setIsRenamingFolder(false);
  };

  const handleAddFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderInput.trim();
    if (trimmed) {
      addCategory(trimmed);
      setActiveCategory(trimmed);
    }
    setNewFolderInput("");
    setIsAddingFolder(false);
  };

  // Drag-and-drop filing: dropping a task (dragged from anywhere in the
  // Folder Rail) onto a folder row or the in-panel drop zone refiles it.
  const handleDropOnCategory = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) moveCategory(taskId, category);
  };

  const handleOptimizeFlow = async () => {
    // Optimizing from inside a specific folder only reorders that
    // folder's own tasks, matching the per-folder "Optimize Flow"
    // button shown in the Folder Rail header.
    const optimizeScope =
      activeView === "Categories" && activeCategory !== "All"
        ? pendingTasks.filter((t) => t.category === activeCategory)
        : pendingTasks;

    if (optimizeScope.length <= 1) {
      pushToast("Add a few more tasks first to optimize your flow!", "info");
      return;
    }

    setIsOptimizing(true);
    try {
      // Only the in-scope tasks need reordering - anything outside that
      // scope (completed tasks, or other folders' tasks when scoped) has
      // nothing to gain from the round trip and would just be an
      // unnecessary chunk of the request payload.
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: optimizeScope }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.tasks) {
        // reorderTasks fully replaces the store's task array, so anything
        // left out of the request has to be reattached here or it vanishes.
        const optimizedIds = new Set(data.tasks.map((t: Task) => t.id));
        const rest = tasks.filter((t) => !optimizedIds.has(t.id));
        reorderTasks([...data.tasks, ...rest]);
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
      if (selectedDay === null) {
        return {
          title: "Nothing scheduled yet.",
          sub: "Give a task a day using the calendar on the left.",
          icon: Calendar,
        };
      }
      return {
        title:
          selectedDay === UNSCHEDULED
            ? "Nothing unscheduled right now."
            : `No tasks for ${formatDayLabel(selectedDay)} yet.`,
        sub: "Add one on the left, or pick another day.",
        icon: Calendar,
      };
    }
    if (activeView === "Categories") {
      if (activeCategory !== "All") {
        return { title: `Nothing in ${activeCategory} yet.`, sub: "Add a task above, or drag one in from another folder.", icon: Folder };
      }
      return {
        title: "No tasks yet.",
        sub: "Add one above, or head to Timeline to brain-dump with AI.",
        icon: LayoutGrid,
      };
    }
    return {
      title: "Nothing to see here right now.",
      sub: "Use the AI Brain Dump on the left to organize your thoughts.",
      icon: LayoutGrid,
    };
  }, [activeView, selectedDay, activeCategory]);

  const EmptyIcon = emptyStateCopy.icon;

  const emptyStateBlock = (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-folder-pink/60">
      <EmptyIcon size={32} className="text-folder-pink mb-3" />
      <p className="text-sm font-medium text-ink">{emptyStateCopy.title}</p>
      <p className="text-xs text-ink/80 mt-1">{emptyStateCopy.sub}</p>
    </div>
  );

  const renderTaskCard = (task: (typeof pendingTasks)[number]) => (
    <TaskCard
      key={task.id}
      task={task}
      onStartFocus={(t) => {
        setFocusReason(null);
        setFocusedTaskId(t.id);
      }}
    />
  );

  // Single-day (or Unscheduled) agenda: heading, done-count, and a peek at
  // whatever's scheduled the day right after this one.
  const isTimelineDayMode = activeView === "Timeline" && selectedDay !== null;
  let dayHeading = "";
  let peek: { iso: string; label: string; count: number } | null = null;
  const dayStats = selectedDay !== null ? dateStats.get(selectedDay) : undefined;

  if (isTimelineDayMode && selectedDay !== null) {
    if (selectedDay === UNSCHEDULED) {
      dayHeading = "Unscheduled";
    } else {
      const isRelative = selectedDay === todayIso || selectedDay === tomorrowIso;
      dayHeading = isRelative
        ? `${selectedDay === todayIso ? "Today" : "Tomorrow"} · ${formatDayLabel(selectedDay)}`
        : formatDayLabel(selectedDay);

      const [y, m, d] = selectedDay.split("-").map(Number);
      const nextIso = toISODate(addDays(new Date(y, m - 1, d), 1));
      const nextStats = dateStats.get(nextIso);
      if (nextStats && nextStats.total > 0) {
        peek = {
          iso: nextIso,
          label: nextIso === tomorrowIso ? `Tomorrow, ${formatMonthDay(nextIso)}` : formatDayLabel(nextIso),
          count: nextStats.total,
        };
      }
    }
  }

  return (
    <div
      className="min-h-screen w-full relative paper-grain"
      style={{
        backgroundColor: "#FDF7EE",
        backgroundImage:
          "radial-gradient(circle, rgba(233,169,194,0.35) 2px, transparent 2px), radial-gradient(circle, rgba(233,169,194,0.35) 2px, transparent 2px)",
        backgroundSize: "48px 48px, 48px 48px",
        backgroundPosition: "0 0, 24px 24px",
      }}
    >
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full bg-stripe-blue/90 backdrop-blur-md border-b border-folder-pinkDark/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button
            onClick={onBackToLanding}
            aria-label="Back to landing page"
            className="flex items-center shrink-0 -ml-1 rounded-xl transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folder-pinkDeep/40"
          >
            <Image src="/sb_logo.png" alt="Starboard" width={1640} height={500} priority sizes="140px" className="h-14 w-auto" />
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
                    isActive ? view.activeClasses : "text-ink hover:bg-white"
                  }`}
                >
                  <Icon size={14} /> {view.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-ink bg-white/60 px-3 py-1.5 rounded-full">
              <Sparkles size={12} className="text-folder-pinkDeep" />
              {pendingTasks.length} left
            </span>
            <button
              onClick={handleWhatNow}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-button-greenDeep hover:bg-button-greenDark text-white text-xs font-bold shadow-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button-greenDeep/50"
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
                  isActive ? view.activeClasses : "bg-white/60 text-ink"
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
              t.tone === "error" ? "bg-danger" : t.tone === "success" ? "bg-button-greenDeep" : "bg-ink"
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
            {activeView !== "Categories" && (
              <div className="bg-white rounded-3xl p-5 shadow-[0_6px_24px_rgba(233,169,194,0.18)] border-2 border-folder-pink/50 flex flex-col gap-2">
                <form onSubmit={handleAddTask} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/80">Add task</span>
                    <button
                      type="button"
                      onClick={() => setIsSparkleMode(!isSparkleMode)}
                      aria-pressed={isSparkleMode}
                      aria-label="Toggle AI brain-dump mode"
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folder-pinkDeep/40 ${
                        isSparkleMode ? "bg-folder-pinkDeep text-white" : "bg-folder-pink/25 text-ink hover:bg-folder-pink/40"
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
                        className="w-full p-3.5 pr-12 rounded-xl border-2 border-folder-pink/50 focus:border-folder-pinkDeep focus:outline-none min-h-[100px] text-sm resize-none text-ink bg-folder-pink/10 transition-all duration-200"
                      />
                    ) : (
                      <input
                        type="text"
                        value={inputVal}
                        onChange={(e) => setInputVal(e.target.value)}
                        placeholder="Quick task title..."
                        aria-label="Quick task title"
                        className="w-full p-3.5 pr-12 rounded-xl border-2 border-ink/10 focus:border-ink/30 focus:outline-none text-sm text-ink bg-ink/5 transition-all duration-200"
                      />
                    )}
                    <button
                      type="submit"
                      disabled={isLoadingAi || !inputVal.trim()}
                      aria-label={isSparkleMode ? "Parse brain dump into tasks" : "Add task"}
                      className="absolute right-2 bottom-2 p-2 bg-ink text-white rounded-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
                    >
                      {isLoadingAi ? <Sparkles size={14} className="animate-spin text-folder-pinkDeep" /> : <Plus size={14} />}
                    </button>
                  </div>

                  <p
                    className={`text-xs text-folder-pinkDeep font-medium px-1 min-h-[1rem] transition-opacity duration-300 ${
                      isLoadingAi ? "opacity-100" : "opacity-0"
                    }`}
                    aria-live="polite"
                  >
                    {isLoadingAi ? AI_LOADING_MESSAGES[aiMessageIndex] : ""}
                  </p>
                </form>
              </div>
            )}

            {activeView === "Categories" && (
              <div className="bg-white rounded-3xl p-5 shadow-[0_6px_24px_rgba(233,169,194,0.18)] border-2 border-folder-pink/50 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/80">Folders</span>
                  <button
                    onClick={() => setIsAddingFolder(true)}
                    className="text-[11px] font-semibold text-folder-pinkDeep hover:text-ink transition-colors"
                  >
                    + New
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setActiveCategory("All")}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnCategory(e, "Inbox")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      activeCategory === "All" ? "bg-ink text-white" : "text-ink hover:bg-ink/8"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${activeCategory === "All" ? "bg-white" : "bg-ink/60"}`} />
                    <span className="flex-1 text-left truncate">All tasks</span>
                    <span className={activeCategory === "All" ? "opacity-80" : "text-ink/50"}>{pendingTasks.length}</span>
                  </button>

                  {folderNames.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropOnCategory(e, cat)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        activeCategory === cat ? "bg-ink text-white" : "text-ink/80 hover:bg-ink/8"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: activeCategory === cat ? "#fff" : getFolderColor(cat) }}
                      />
                      <span className="flex-1 text-left truncate">{cat}</span>
                      <span className={activeCategory === cat ? "opacity-80" : "text-ink/50"}>{categoryCounts.get(cat) || 0}</span>
                    </button>
                  ))}

                  {isAddingFolder && (
                    <form onSubmit={handleAddFolderSubmit} className="flex items-center gap-1.5 px-1 pt-1">
                      <input
                        autoFocus
                        value={newFolderInput}
                        onChange={(e) => setNewFolderInput(e.target.value)}
                        onBlur={() => {
                          if (!newFolderInput.trim()) setIsAddingFolder(false);
                        }}
                        placeholder="Folder name..."
                        className="flex-1 rounded-lg border border-folder-pink/50 bg-white px-2 py-1 text-xs outline-none focus:border-folder-pinkDeep"
                      />
                      <button type="submit" className="text-xs font-semibold text-folder-pinkDeep hover:text-ink">
                        Add
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {activeView === "Timeline" && (
              <div className="bg-white rounded-3xl p-5 shadow-[0_6px_24px_rgba(233,169,194,0.18)] border-2 border-folder-pink/50 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/80">Calendar</span>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="text-[11px] font-semibold text-folder-pinkDeep hover:text-ink transition-colors"
                  >
                    Overview
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => changeWeek(-1)}
                    aria-label="Previous week"
                    className="p-1.5 rounded-lg text-ink/70 hover:bg-ink/10 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-semibold text-ink/70">{formatWeekRangeLabel(weekDates)}</span>
                  <button
                    onClick={() => changeWeek(1)}
                    aria-label="Next week"
                    className="p-1.5 rounded-lg text-ink/70 hover:bg-ink/10 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1" role="tablist" aria-label="Pick a day">
                  {weekDates.map((day) => {
                    const hasTasks = (dateStats.get(day.iso)?.total || 0) > 0;
                    const isSelected = selectedDay === day.iso;
                    return (
                      <button
                        key={day.iso}
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => setSelectedDay(day.iso)}
                        className={`flex flex-col items-center rounded-xl py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
                          isSelected
                            ? "bg-ink text-white"
                            : day.isToday
                            ? "bg-folder-pink/25 text-ink"
                            : "text-ink/80 hover:bg-ink/10"
                        }`}
                      >
                        <span className="text-[9px] font-semibold uppercase opacity-80">{day.weekdayShort.charAt(0)}</span>
                        <span className="text-xs font-bold leading-none mt-0.5">{day.dayNum}</span>
                        <span
                          className={`mt-1 h-1 w-1 rounded-full ${
                            hasTasks ? (isSelected ? "bg-white" : "bg-folder-pinkDeep") : "bg-transparent"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setSelectedDay(UNSCHEDULED)}
                  className={`text-xs font-semibold transition-colors ${
                    selectedDay === UNSCHEDULED ? "text-ink" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  Unscheduled {(dateStats.get(UNSCHEDULED)?.total || 0) > 0 && `(${dateStats.get(UNSCHEDULED)!.total})`}
                </button>
              </div>
            )}

            {progressScope.length > 0 && (
              <div className="bg-white rounded-3xl p-5 shadow-[0_6px_24px_rgba(233,169,194,0.18)] border-2 border-folder-pink/50 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/80">
                    <Flame size={12} className="text-folder-pinkDeep" />
                    {isFolderScopedProgress ? `${activeCategory} progress` : "Today's progress"}
                  </span>
                  <span className="text-2xl font-bold text-folder-pinkDeep leading-none">{progressScopePct}%</span>
                </div>
                <div className="h-3 w-full bg-folder-pink/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-folder-pink to-folder-pinkDeep rounded-full transition-all duration-500"
                    style={{ width: `${progressScopePct}%` }}
                  />
                </div>
                <p className="text-xs text-ink/80">
                  {progressScopeCompleted === 0
                    ? isFolderScopedProgress
                      ? `Finish your first ${activeCategory} task to get the ball rolling.`
                      : "Finish your first task to get the ball rolling."
                    : `${progressScopeCompleted} of ${progressScope.length} done — keep going!`}
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN: Workspace */}
        <main className="flex-1 flex flex-col gap-4 lg:gap-6 min-w-0">
          <div className="relative bg-white rounded-3xl p-5 shadow-[0_6px_24px_rgba(233,169,194,0.18)] border-2 border-folder-pink/50 flex flex-col gap-4">
            <div className="absolute -top-2.5 left-8 w-16 h-3 bg-stripe-blue rounded-t-lg" aria-hidden="true" />
            <div className="flex items-center justify-between flex-wrap gap-3">
              {activeView === "Categories" ? (
                isRenamingFolder ? (
                  <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: getFolderColor(activeCategory) }} />
                    <input
                      autoFocus
                      value={folderNameInput}
                      onChange={(e) => setFolderNameInput(e.target.value)}
                      onBlur={handleRenameSubmit}
                      className="text-2xl font-bold text-ink bg-transparent border-b-2 border-folder-pinkDeep outline-none w-40"
                    />
                  </form>
                ) : (
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className="h-3 w-3 rounded-full shrink-0 self-center"
                      style={{ backgroundColor: activeCategory === "All" ? "#5B4B45" : getFolderColor(activeCategory) }}
                    />
                    <h1 className="text-2xl font-bold text-ink">{activeCategory === "All" ? "All Tasks" : activeCategory}</h1>
                    <span className="text-xs text-ink/50 font-medium">
                      {(activeCategory === "All" ? pendingTasks.length : categoryCounts.get(activeCategory) || 0)} task
                      {(activeCategory === "All" ? pendingTasks.length : categoryCounts.get(activeCategory) || 0) === 1 ? "" : "s"} ·{" "}
                      {formatMinutes(activeCategory === "All" ? pendingTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0) : categoryMinutes.get(activeCategory) || 0)} planned
                    </span>
                  </div>
                )
              ) : (
                <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
                  {activeView === "Timeline" && (
                    <>
                      <Calendar className="text-[#2E6A82]" /> Schedule
                    </>
                  )}
                  {activeView === "Completed" && (
                    <>
                      <CheckSquare className="text-button-greenDark" /> Archive
                    </>
                  )}
                </h1>
              )}

              <div className="flex items-center gap-2">
                {activeView === "Categories" && activeCategory !== "All" && !isRenamingFolder && (
                  <button
                    onClick={() => {
                      setFolderNameInput(activeCategory);
                      setIsRenamingFolder(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-ink/15 hover:bg-ink/5 text-ink rounded-xl text-xs font-semibold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
                  >
                    Rename
                  </button>
                )}
                {activeView === "Categories" && (
                  <button
                    onClick={() =>
                      setReceiptPayload({
                        tasks: activeCategory === "All" ? tasks : tasks.filter((t) => t.category === activeCategory),
                        title: activeCategory === "All" ? "All Tasks" : activeCategory,
                      })
                    }
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-ink/15 hover:bg-ink/5 text-ink rounded-xl text-xs font-semibold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
                  >
                    <Receipt size={14} /> Print
                  </button>
                )}
                {activeView === "Timeline" && (
                  <button
                    onClick={() => setReceiptPayload({ tasks: displayedTasks, title: "Starboard" })}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-ink/15 hover:bg-ink/5 text-ink rounded-xl text-xs font-semibold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
                  >
                    <Receipt size={14} /> Print Agenda
                  </button>
                )}
                {activeView !== "Completed" && (
                  <button
                    onClick={handleOptimizeFlow}
                    disabled={
                      isOptimizing ||
                      (activeView === "Categories" && activeCategory !== "All"
                        ? (categoryCounts.get(activeCategory) || 0) <= 1
                        : pendingTasks.length <= 1)
                    }
                    aria-label="Optimize task flow order"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-folder-pink/20 hover:bg-folder-pink/35 text-ink rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 disabled:hover:bg-folder-pink/20 border border-folder-pink/50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folder-pinkDeep/40"
                  >
                    <Sparkles size={14} className={isOptimizing ? "animate-spin" : ""} />
                    {isOptimizing ? "Optimizing Flow..." : "Optimize Flow"}
                  </button>
                )}
              </div>
            </div>

            {activeView === "Categories" && (
              <form onSubmit={handleAddTaskToFolder} className="relative">
                <input
                  value={folderTaskInput}
                  onChange={(e) => setFolderTaskInput(e.target.value)}
                  placeholder={`Add a task to ${activeCategory === "All" ? "Inbox" : activeCategory}...`}
                  aria-label={`Add a task to ${activeCategory === "All" ? "Inbox" : activeCategory}`}
                  className="w-full p-3.5 pr-12 rounded-xl border-2 border-folder-pink/40 bg-folder-pink/10 focus:border-folder-pinkDeep focus:outline-none text-sm text-ink transition-all duration-200"
                />
                <button
                  type="submit"
                  disabled={!folderTaskInput.trim()}
                  aria-label="Add task"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-ink text-white rounded-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
                >
                  <Plus size={14} />
                </button>
              </form>
            )}

            {activeView === "Timeline" && (
              <div className="flex items-center gap-1 rounded-full bg-ink/8 p-1" role="tablist" aria-label="Timeline shortcuts">
                <button
                  role="tab"
                  aria-selected={selectedDay === null}
                  onClick={() => setSelectedDay(null)}
                  className={`flex-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
                    selectedDay === null ? "bg-ink text-white" : "text-ink/80 hover:bg-white"
                  }`}
                >
                  Overview
                </button>
                <button
                  role="tab"
                  aria-selected={selectedDay === todayIso}
                  onClick={() => setSelectedDay(todayIso)}
                  className={`flex-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
                    selectedDay === todayIso ? "bg-ink text-white" : "text-ink/80 hover:bg-white"
                  }`}
                >
                  Today {(dateStats.get(todayIso)?.total ?? 0) > 0 && dateStats.get(todayIso)!.total}
                </button>
                <button
                  role="tab"
                  aria-selected={selectedDay === tomorrowIso}
                  onClick={() => setSelectedDay(tomorrowIso)}
                  className={`flex-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
                    selectedDay === tomorrowIso ? "bg-ink text-white" : "text-ink/80 hover:bg-white"
                  }`}
                >
                  Tomorrow {(dateStats.get(tomorrowIso)?.total ?? 0) > 0 && dateStats.get(tomorrowIso)!.total}
                </button>
                {selectedDay !== null && (
                  <span className="flex-1 px-3 py-1.5 text-center text-xs font-semibold text-ink/60">
                    {selectedDay === UNSCHEDULED ? "Unscheduled" : formatDayLabel(selectedDay)}
                  </span>
                )}
              </div>
            )}

            {activeView === "Completed" && (
              <div className="flex items-center justify-between bg-ink/5 p-3 rounded-2xl border border-ink/10">
                <span className="text-sm font-medium text-ink/80">
                  You've finished {displayedTasks.length} task{displayedTasks.length === 1 ? "" : "s"}!
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReceiptPayload({ tasks: displayedTasks, title: "Starboard" })}
                    disabled={displayedTasks.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-ink/15 text-ink hover:bg-ink/5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
                  >
                    <Receipt size={14} /> Export Receipt
                  </button>
                  <button
                    onClick={handleClearCompleted}
                    disabled={displayedTasks.length === 0}
                    aria-label={confirmingClear ? "Confirm clear all completed tasks" : "Clear all completed tasks"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 ${
                      confirmingClear
                        ? "bg-danger text-white border border-danger"
                        : "bg-white border border-danger/30 text-danger hover:bg-danger/10"
                    }`}
                  >
                    <Trash2 size={14} /> {confirmingClear ? "Confirm Clear?" : "Clear All"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 pb-20">
            {timelineGroups ? (
              timelineGroups.length === 0 ? (
                emptyStateBlock
              ) : (
                <div className="flex flex-col gap-5">
                  {timelineGroups.map((group) => (
                    <div key={group.key} className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 px-1">
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wide ${
                            group.key === "overdue" ? "text-danger" : "text-ink/70"
                          }`}
                        >
                          {group.label}
                        </span>
                        <span className="text-[11px] text-ink/40 font-medium">{group.tasks.length}</span>
                        <div className={`flex-1 h-px ${group.key === "overdue" ? "bg-danger/20" : "bg-folder-pink/25"}`} />
                      </div>
                      <div className="flex flex-col gap-3">{group.tasks.map(renderTaskCard)}</div>
                    </div>
                  ))}
                </div>
              )
            ) : isTimelineDayMode ? (
              displayedTasks.length === 0 ? (
                emptyStateBlock
              ) : (
                <div className="bg-white rounded-3xl p-5 shadow-[0_6px_24px_rgba(233,169,194,0.18)] border-2 border-folder-pink/50 flex flex-col">
                  <div className="flex items-baseline justify-between px-1 pb-2">
                    <h2 className="text-base font-bold text-ink">{dayHeading}</h2>
                    <span className="text-xs text-ink/50 font-medium shrink-0 ml-3">
                      {dayStats?.total ?? displayedTasks.length} task{(dayStats?.total ?? displayedTasks.length) === 1 ? "" : "s"}
                      {(dayStats?.done ?? 0) > 0 && ` · ${dayStats!.done} done`}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">{displayedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      compact
                      emphasizeSchedule={selectedDay === UNSCHEDULED}
                      onStartFocus={(t) => {
                        setFocusReason(null);
                        setFocusedTaskId(t.id);
                      }}
                    />
                  ))}</div>
                  {peek && (
                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-folder-pink/20 px-1">
                      <span className="text-xs text-ink/60">
                        {peek.label} · {peek.count} task{peek.count === 1 ? "" : "s"}
                      </span>
                      <button
                        onClick={() => setSelectedDay(peek!.iso)}
                        className="text-xs font-semibold text-folder-pinkDeep hover:text-ink transition-colors"
                      >
                        Peek →
                      </button>
                    </div>
                  )}
                </div>
              )
            ) : activeView === "Categories" ? (
              <>
                {displayedTasks.length === 0
                  ? emptyStateBlock
                  : displayedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        draggable
                        onStartFocus={(t) => {
                          setFocusReason(null);
                          setFocusedTaskId(t.id);
                        }}
                      />
                    ))}
                {activeCategory !== "All" && (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnCategory(e, activeCategory)}
                    className="flex items-center justify-center p-6 text-center rounded-2xl border-2 border-dashed border-folder-pink/50 text-xs font-medium text-ink/50"
                  >
                    Drag tasks here to file them under {activeCategory}
                  </div>
                )}
              </>
            ) : displayedTasks.length === 0 ? (
              emptyStateBlock
            ) : (
              displayedTasks.map(renderTaskCard)
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

      {receiptPayload && (
        <ReceiptExport tasks={receiptPayload.tasks} title={receiptPayload.title} onClose={() => setReceiptPayload(null)} />
      )}
    </div>
  );
}