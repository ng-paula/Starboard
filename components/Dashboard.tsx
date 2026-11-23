"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Plus,
  Zap,
  Calendar,
  Folder,
  CheckSquare,
  Check,
  Trash2,
  LayoutGrid,
  Receipt,
  Flame,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserCircle,
  AlertCircle,
  CheckCircle2,
  Info,
  ArrowRight,
  Pencil,
  ChevronDown,
  CalendarDays,
  LogIn,
  Cloud,
  CloudOff,
  type LucideIcon,
} from "lucide-react";
import { useTaskStore } from "@/store/useTaskStore";
import { useBrainDump } from "@/hooks/useBrainDump";
import {
  getWeekDates,
  toISODate,
  addDays,
  formatDayLabel,
  formatWeekRangeLabel,
  formatMonthDay,
  formatShortDate,
  formatTime,
  formatShortWeekdayDate,
} from "@/lib/dates";
import type { Task } from "@/lib/types";
import TaskCard from "./TaskCard";
import FocusModal from "./FocusModal";
import ReceiptExport from "./ReceiptExport";
import ProgressRing from "./ui/ProgressRing";
import AnimatedNumber from "./ui/AnimatedNumber";

const UNSCHEDULED = "unscheduled" as const;

// A folder's dot color is picked by its position in the order folders
// first appeared - stable as long as folders aren't reordered, which
// they never are (there's no reorder UI for folders).
const FOLDER_COLORS = [
  "#F27BA6", // pink
  "#F7C35F", // amber
  "#8EC5E8", // sky
  "#A8DB8F", // mint
  "#C9BBF2", // lilac
  "#F49A7A", // coral
  "#7FCFC4", // teal
  "#E3C9A8", // sand
];

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface DashboardProps {
  onSignIn: () => void;
  onSignOut: () => void;
  userEmail: string | null;
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

// Sliding highlight behind the active tab / day / folder. Every Pill with
// the same `id` animates between positions via framer-motion layoutId.
function Pill({ id, className = "bg-ink rounded-full" }: { id: string; className?: string }) {
  return (
    <motion.span
      layoutId={id}
      aria-hidden="true"
      className={`absolute inset-0 shadow-sm ${className}`}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    />
  );
}

// Shared entrance for sidebar / header panels.
const panelMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring" as const, stiffness: 220, damping: 24 },
};

export default function Dashboard({ onSignIn, onSignOut, userEmail }: DashboardProps) {
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
    loadTasks,
    isLoading,
    syncError,
    clearSyncError,
    notice,
    clearNotice,
  } = useTaskStore();
  const { parseText, isLoadingAi } = useBrainDump();

  const [inputVal, setInputVal] = useState("");
  const [isSparkleMode, setIsSparkleMode] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  // Synchronous re-entrancy guard for Optimize Flow. isOptimizing (state)
  // is what disables the button visually, but state updates are async -
  // a ref is checked and set immediately, closing the gap where a second
  // click (e.g. switching to another view and clicking its own Optimize
  // Flow button before the first click's re-render lands) could kick off
  // a second overlapping request.
  const isOptimizingRef = useRef(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [focusReason, setFocusReason] = useState<string | null>(null);
  const [receiptPayload, setReceiptPayload] = useState<{ tasks: Task[]; title: string } | null>(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isProfileOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileOpen]);

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
  // Which drop target (folder row or in-panel zone) a dragged task is
  // currently hovering, so it can light up.
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  // Sidebar "Folders" section collapse.
  const [foldersOpen, setFoldersOpen] = useState(true);

  // Archive (Completed view): how the finished-task list is grouped.
  const [archiveGroupMode, setArchiveGroupMode] = useState<"day" | "week" | "folder">("day");

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

  // Unlike a real date, Unscheduled has nothing left to track once a task is
  // done - so its count is pending-only, unlike dateStats (below) which
  // intentionally includes completed tasks for real dates.
  const unscheduledPendingCount = useMemo(() => pendingTasks.filter((t) => !t.due_date).length, [pendingTasks]);

  const todayIso = toISODate(new Date());
  const tomorrowIso = toISODate(addDays(new Date(), 1));

  // What Optimize Flow actually operates on. For a Folder, that's the
  // folder's own pending tasks (which can legitimately span many due
  // dates - that's what the day-grouping in handleOptimizeFlow is for).
  // For Timeline, this narrows to whatever single day is selected -
  // Today, Tomorrow, Unscheduled, or a picked day - matching what's on
  // screen, instead of silently pulling in every pending task regardless
  // of date. selectedDay === null (Overview) is the one case with no
  // single day to narrow to; the button is hidden there entirely rather
  // than falling back to "everything," since that's exactly the
  // multi-day-fan-out shape that risks bursting the API's per-minute
  // rate limit.
  const optimizeScope = useMemo(() => {
    if (activeView === "Categories" && activeCategory !== "All") {
      return pendingTasks.filter((t) => t.category === activeCategory);
    }
    if (activeView === "Timeline" && selectedDay !== null) {
      return pendingTasks.filter((t) => (selectedDay === UNSCHEDULED ? !t.due_date : t.due_date === selectedDay));
    }
    return pendingTasks;
  }, [pendingTasks, activeView, activeCategory, selectedDay]);

  // Progress card: scoped to whichever folder is open (so it answers "how
  // am I doing on THIS folder"), or to just today's tasks while on
  // Timeline (the card is literally labeled "Today's progress" - it
  // shouldn't silently mean "all tasks, ever" while looking at Timeline).
  // "All tasks" in Categories, or any other view, still shows the global
  // figure.
  const isFolderScopedProgress = activeView === "Categories" && activeCategory !== "All";
  const progressScope = useMemo(() => {
    if (isFolderScopedProgress) return tasks.filter((t) => t.category === activeCategory);
    if (activeView === "Timeline") return tasks.filter((t) => t.due_date === todayIso);
    return tasks;
  }, [tasks, activeView, activeCategory, isFolderScopedProgress, todayIso]);
  const progressScopeCompleted = progressScope.filter((t) => t.completed).length;
  const progressScopePct = progressScope.length === 0 ? 0 : Math.round((progressScopeCompleted / progressScope.length) * 100);

  // --- Archive (Completed view) stats ---
  // completed_at is what makes all of this possible - without a real
  // timestamp there's no way to know which day (or week) a completion
  // belongs to, only that it happened at some point.
  const completedTasks = useMemo(() => tasks.filter((t) => t.completed && t.completed_at), [tasks]);

  const completedDateCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of completedTasks) {
      const iso = toISODate(new Date(t.completed_at!));
      map.set(iso, (map.get(iso) || 0) + 1);
    }
    return map;
  }, [completedTasks]);

  const currentStreak = useMemo(() => {
    let streak = 0;
    let cursor = new Date();
    while (completedDateCounts.has(toISODate(cursor))) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }, [completedDateCounts]);

  const last7Days = useMemo(() => {
    const days: { iso: string; hasActivity: boolean; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const iso = toISODate(addDays(new Date(), -i));
      days.push({ iso, hasActivity: completedDateCounts.has(iso), isToday: i === 0 });
    }
    return days;
  }, [completedDateCounts]);

  // These are deliberately independent of weekOffset (which only moves
  // the Timeline calendar) - Archive stats always mean the real current
  // and previous week.
  const statsThisWeek = useMemo(() => getWeekDates(0), []);
  const statsLastWeek = useMemo(() => getWeekDates(-1), []);

  const thisWeekCompleted = useMemo(() => {
    const isoSet = new Set(statsThisWeek.map((d) => d.iso));
    return completedTasks.filter((t) => isoSet.has(toISODate(new Date(t.completed_at!))));
  }, [completedTasks, statsThisWeek]);

  const lastWeekCompleted = useMemo(() => {
    const isoSet = new Set(statsLastWeek.map((d) => d.iso));
    return completedTasks.filter((t) => isoSet.has(toISODate(new Date(t.completed_at!))));
  }, [completedTasks, statsLastWeek]);

  const weekDelta = thisWeekCompleted.length - lastWeekCompleted.length;

  const focusTimeThisWeek = useMemo(
    () => thisWeekCompleted.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0),
    [thisWeekCompleted]
  );

  const busiestDayThisWeek = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of thisWeekCompleted) {
      const weekday = new Date(t.completed_at!).toLocaleDateString(undefined, { weekday: "long" });
      counts.set(weekday, (counts.get(weekday) || 0) + 1);
    }
    let best: { day: string; count: number } | null = null;
    for (const [day, count] of counts) {
      if (!best || count > best.count) best = { day, count };
    }
    return best;
  }, [thisWeekCompleted]);

  const topFolderThisWeek = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of thisWeekCompleted) {
      const key = t.category || "Inbox";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let best: { folder: string; count: number } | null = null;
    for (const [folder, count] of counts) {
      if (!best || count > best.count) best = { folder, count };
    }
    return best;
  }, [thisWeekCompleted]);

  const personalBest = useMemo(() => {
    let best: { iso: string; count: number } | null = null;
    for (const [iso, count] of completedDateCounts) {
      if (!best || count > best.count) best = { iso, count };
    }
    return best;
  }, [completedDateCounts]);

  const thisWeekBestDayCount = busiestDayThisWeek?.count || 0;
  const archiveTodayCount = completedDateCounts.get(todayIso) || 0;

  // Row meta differs by grouping: Day mode shows the clock time for
  // today's completions (the date is already the section header) and
  // falls back to folder + duration for older days; Week/Folder modes
  // span multiple days per section, so they always show a short date
  // instead of relying on "today" context.
  const archiveRowMeta = (t: Task, mode: "day" | "week" | "folder"): string => {
    if (!t.completed_at) return `${t.estimated_minutes}m`;
    const iso = toISODate(new Date(t.completed_at));
    const category = t.category && t.category !== "Inbox" ? t.category : null;

    if (mode === "day") {
      const tail = iso === todayIso ? formatTime(t.completed_at) : `${t.estimated_minutes}m`;
      return category ? `${category} · ${tail}` : tail;
    }
    if (mode === "week") {
      const tail = `${formatShortDate(iso)} · ${t.estimated_minutes}m`;
      return category ? `${category} · ${tail}` : tail;
    }
    // folder mode - category is already the section header
    return `${formatShortDate(iso)} · ${t.estimated_minutes}m`;
  };

  const archiveGroups = useMemo<{ key: string; label: string; color?: string; tasks: Task[] }[]>(() => {
    if (activeView !== "Completed") return [];

    if (archiveGroupMode === "folder") {
      const map = new Map<string, Task[]>();
      for (const t of completedTasks) {
        const key = t.category || "Inbox";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
      return Array.from(map.entries())
        .map(([key, items]) => ({
          key,
          label: key,
          color: getFolderColor(key),
          tasks: items.sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || "")),
        }))
        .sort((a, b) => b.tasks.length - a.tasks.length);
    }

    if (archiveGroupMode === "week") {
      const map = new Map<string, Task[]>();
      for (const t of completedTasks) {
        const monday = getWeekDates(0, new Date(t.completed_at!))[0].iso;
        if (!map.has(monday)) map.set(monday, []);
        map.get(monday)!.push(t);
      }
      const thisMonday = statsThisWeek[0].iso;
      const lastMonday = statsLastWeek[0].iso;
      return Array.from(map.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([monday, items]) => ({
          key: monday,
          label:
            monday === thisMonday
              ? "This Week"
              : monday === lastMonday
              ? "Last Week"
              : formatWeekRangeLabel(getWeekDates(0, new Date(items[0].completed_at!))),
          tasks: items.sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || "")),
        }));
    }

    // day mode
    const map = new Map<string, Task[]>();
    for (const t of completedTasks) {
      const iso = toISODate(new Date(t.completed_at!));
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso)!.push(t);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([iso, items]) => ({
        key: iso,
        label: iso === todayIso ? `Today · ${formatShortDate(iso)}` : formatShortDate(iso),
        tasks: items.sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || "")),
      }));
  }, [activeView, archiveGroupMode, completedTasks, statsThisWeek, statsLastWeek, todayIso]);

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
      // Unscheduled has no date to "belong to" once done, so it stays
      // pending-only or a finished task would linger there forever.
      return selectedDay === UNSCHEDULED
        ? pendingTasks.filter((t) => !t.due_date)
        : tasks.filter((t) => t.due_date === selectedDay);
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

  // --- Load this user's tasks from Supabase once, on mount ---
  useEffect(() => {
    loadTasks();
    // Deliberately empty deps - loadTasks reads the current session
    // itself and this should only ever run once when the Dashboard first
    // mounts, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Surface background sync failures (the store has no toast system
  // of its own) without letting the same failure toast forever ---
  useEffect(() => {
    if (!syncError) return;
    pushToast(syncError, "error");
    clearSyncError();
  }, [syncError, pushToast, clearSyncError]);

  useEffect(() => {
    if (!notice) return;
    pushToast(notice, "success");
    clearNotice();
  }, [notice, pushToast, clearNotice]);

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
      const result = await parseText(inputVal);
      if (result.status === "success") {
        setInputVal("");
        setIsSparkleMode(false);
        // Most brain-dumped tasks land Unscheduled (the AI only assigns
        // Today/Tomorrow when the text says so explicitly) - jump straight
        // there instead of Folders, since that's exactly where the
        // one-click "Schedule" control lives to finish the job.
        setActiveView("Timeline");
        setSelectedDay(UNSCHEDULED);
        pushToast(`Added ${result.count} task${result.count === 1 ? "" : "s"} from your brain dump.`, "success");
      } else if (result.status === "empty") {
        // A valid, empty response (gibberish, "asdf", pure whitespace) -
        // not an error, but reporting success here would be a lie: nothing
        // was added. Input is deliberately left in place so the user can
        // revise and resubmit instead of losing what they typed.
        pushToast("Didn't find any tasks in that — try describing what you need to do.", "info");
      } else {
        pushToast(`Couldn't parse that — ${result.message}`, "error");
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
    setDragTarget(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) moveCategory(taskId, category);
  };

  const handleOptimizeFlow = async () => {
    // Synchronous guard: closes the race where a second click - possibly
    // the same button clicked twice fast, or a *different* Optimize Flow
    // button after switching from Timeline to Folders (or vice versa)
    // while the first request is still in flight - fires before the
    // isOptimizing state update has re-rendered and disabled the button.
    if (isOptimizingRef.current) return;

    if (optimizeScope.length <= 1) {
      pushToast("Add a few more tasks first to optimize your flow!", "info");
      return;
    }

    // Tasks that already have a scheduled day should only be reordered
    // against other tasks on that SAME day - flattening every day into
    // one sequence and asking the AI to sort it risks it interleaving
    // Tuesday's tasks in among Friday's. Group by due_date (unscheduled
    // tasks form their own group) and optimize each day independently.
    const dayGroups = new Map<string, Task[]>();
    for (const t of optimizeScope) {
      const key = t.due_date || UNSCHEDULED;
      if (!dayGroups.has(key)) dayGroups.set(key, []);
      dayGroups.get(key)!.push(t);
    }
    const groupEntries = Array.from(dayGroups.values());
    const optimizableGroups = groupEntries.filter((g) => g.length > 1);
    const singleTaskLeftovers = groupEntries.filter((g) => g.length <= 1).flat();

    if (optimizableGroups.length === 0) {
      pushToast("Add a few more tasks on the same day to optimize your flow!", "info");
      return;
    }

    isOptimizingRef.current = true;
    setIsOptimizing(true);
    try {
      const results = await Promise.all(
        optimizableGroups.map(async (group) => {
          const res = await fetch("/api/optimize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tasks: group }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Optimization failed");
          return data.tasks as Task[];
        })
      );

      const optimizedFlat = results.flat();
      const handledIds = new Set([...optimizedFlat, ...singleTaskLeftovers].map((t) => t.id));

      // Read the store directly instead of the `tasks` closed over at
      // click time - the request can take a few seconds, and nothing else
      // disables the rest of the UI while it's in flight. If the user
      // added, deleted, or refiled a task in the meantime, merging
      // against a stale snapshot would silently discard that change.
      const latestTasks = useTaskStore.getState().tasks;
      const rest = latestTasks.filter((t) => !handledIds.has(t.id));
      reorderTasks([...optimizedFlat, ...singleTaskLeftovers, ...rest]);
      pushToast("Flow optimized.", "success");
    } catch (err: any) {
      pushToast(`Optimization error: ${err.message}`, "error");
    } finally {
      isOptimizingRef.current = false;
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
          sub: "Add a task above, or pick a day from the calendar.",
          icon: Calendar,
        };
      }
      return {
        title:
          selectedDay === UNSCHEDULED
            ? "Nothing unscheduled right now."
            : `No tasks for ${formatDayLabel(selectedDay)} yet.`,
        sub: "Add one above, or pick another day.",
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
      sub: "Use AI brain dump in the Timeline to organize your thoughts.",
      icon: LayoutGrid,
    };
  }, [activeView, selectedDay, activeCategory]);

  const EmptyIcon = emptyStateCopy.icon;

  const emptyStateBlock = (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink/20 bg-white px-6 py-12 text-center"
    >
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-canvas">
        <EmptyIcon size={22} className="text-ink/60" />
      </span>
      <p className="text-sm font-bold text-ink">{emptyStateCopy.title}</p>
      <p className="text-sm text-muted mt-1">{emptyStateCopy.sub}</p>
    </motion.div>
  );

  const renderTaskCard = (task: (typeof pendingTasks)[number]) => (
    <TaskCard
      key={task.id}
      task={task}
      folderColor={getFolderColor(task.category || "Inbox")}
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
  // Unscheduled has no date to "belong to" once done, so its stats (and the
  // sidebar badge that reads this same map) should only count what's still
  // pending - otherwise a cleared-out Unscheduled list still shows an old
  // total that includes tasks that no longer need scheduling.
  const dayStats =
    selectedDay === UNSCHEDULED
      ? { total: unscheduledPendingCount, done: 0 }
      : selectedDay !== null
      ? dateStats.get(selectedDay)
      : undefined;

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas lg:h-screen lg:p-3">
        <div className="lg:flex lg:h-full lg:rounded-[24px] lg:border lg:border-line lg:bg-white lg:overflow-hidden">
          <div className="hidden lg:flex w-[260px] shrink-0 flex-col gap-3 border-r border-line bg-sidebar p-5">
            <div className="skeleton h-8 w-36 rounded-lg" />
            <div className="skeleton mt-6 h-9 rounded-xl" />
            <div className="skeleton h-9 rounded-xl" />
            <div className="skeleton h-9 rounded-xl" />
          </div>
          <div className="flex-1 p-6 lg:p-8 flex flex-col gap-5">
            <div className="skeleton h-6 w-48 rounded-lg" />
            <div className="skeleton h-40 rounded-3xl" />
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Drop-target props for drag-and-drop filing, with a highlight while a
  // task is being dragged over the target.
  const dropProps = (target: string, category: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragTarget !== target) setDragTarget(target);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragTarget(null);
    },
    onDrop: (e: React.DragEvent) => handleDropOnCategory(e, category),
  });

  const openFolder = (cat: string) => {
    setActiveView("Categories");
    setActiveCategory(cat);
  };

  const listKey = `${activeView}|${selectedDay ?? "overview"}|${activeCategory}|${archiveGroupMode}`;
  const isGuest = !userEmail;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const todayLabel = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long" });
  const todayPending = pendingTasks.filter((t) => t.due_date === todayIso);
  const plannedTodayMins = todayPending.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  const overdueCount = pendingTasks.filter((t) => t.due_date && t.due_date < todayIso).length;

  const folderStats = (cat: string | "All") => {
    const inFolder = cat === "All" ? tasks : tasks.filter((t) => (t.category || "Inbox") === cat);
    const done = inFolder.filter((t) => t.completed).length;
    return {
      total: inFolder.length,
      pending: inFolder.length - done,
      pct: inFolder.length === 0 ? 0 : Math.round((done / inFolder.length) * 100),
    };
  };

  // --- Reusable pieces -------------------------------------------------

  const brand = (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-ink">
        <Image src="/sb_star.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
      </span>
      <span className="text-[17px] font-extrabold tracking-tight text-ink">Starboard</span>
    </span>
  );

  const profileMenu = (
    <div className="relative" ref={profileRef}>
      <motion.button
        onClick={() => setIsProfileOpen((v) => !v)}
        whileTap={{ scale: 0.92 }}
        title={userEmail ?? "Guest"}
        aria-label="Account menu"
        aria-expanded={isProfileOpen}
        className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-canvas transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25"
      >
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold uppercase ${
            isGuest ? "bg-canvas text-ink/60 border border-line" : "bg-amber text-ink"
          }`}
        >
          {isGuest ? <UserCircle size={18} /> : userEmail!.charAt(0)}
        </span>
        <span className="hidden md:flex flex-col items-start leading-tight">
          <span className="text-xs font-semibold text-ink max-w-[140px] truncate">{isGuest ? "Guest" : userEmail!.split("@")[0]}</span>
          <span className="text-[11px] text-muted">{isGuest ? "Saved on this device" : "Synced"}</span>
        </span>
        <ChevronDown size={14} className="hidden md:block text-muted" />
      </motion.button>

      <AnimatePresence>
        {isProfileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="absolute right-0 top-full mt-2 w-64 origin-top-right rounded-2xl bg-white border border-line shadow-pop p-1.5 z-50"
          >
            {isGuest ? (
              <div className="p-2.5 flex flex-col gap-2.5">
                <div>
                  <p className="text-sm font-semibold text-ink">You&apos;re using Starboard as a guest</p>
                  <p className="text-xs text-muted mt-0.5">Your tasks are saved in this browser. Sign in to keep them safe and use them on any device.</p>
                </div>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onSignIn();
                  }}
                  className="btn-primary w-full py-2 text-xs"
                >
                  <LogIn size={14} /> Sign in to save
                </button>
                <a href="/signup" className="text-center text-xs font-semibold text-ink/70 hover:text-ink">
                  Create a free account
                </a>
              </div>
            ) : (
              <>
                <div className="px-3 py-2.5 border-b border-line mb-1">
                  <p className="text-[11px] text-muted">Signed in as</p>
                  <p className="text-xs font-semibold text-ink truncate">{userEmail}</p>
                </div>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-danger hover:bg-danger/5 transition-colors"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const addTaskComposer = (
    <form onSubmit={handleAddTask} className="panel p-2 flex flex-col gap-1">
      <div className="relative flex items-start gap-2">
        <AnimatePresence mode="wait" initial={false}>
          {isSparkleMode ? (
            <motion.textarea
              key="dump"
              initial={{ opacity: 0, height: 44 }}
              animate={{ opacity: 1, height: 104 }}
              exit={{ opacity: 0, height: 44 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Brain dump: type everything on your mind, AI will split it into tasks..."
              aria-label="Brain dump input"
              className="flex-1 resize-none rounded-xl bg-lilac-soft/60 px-3 py-2.5 text-sm text-ink placeholder:text-ink/40 outline-none"
            />
          ) : (
            <motion.input
              key="quick"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={
                activeView === "Timeline" && selectedDay && selectedDay !== UNSCHEDULED
                  ? `Add a task for ${selectedDay === todayIso ? "today" : formatDayLabel(selectedDay)}...`
                  : "Add a new task..."
              }
              aria-label="Quick task title"
              className="flex-1 rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink/40 outline-none"
            />
          )}
        </AnimatePresence>
        <div className={`flex items-center gap-1.5 shrink-0 ${isSparkleMode ? "self-end" : ""}`}>
          <button
            type="button"
            onClick={() => setIsSparkleMode(!isSparkleMode)}
            aria-pressed={isSparkleMode}
            aria-label="Toggle AI brain-dump mode"
            title="AI brain dump"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 ${
              isSparkleMode ? "bg-lilac text-lilac-deep" : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            <Sparkles size={14} /> <span className="hidden sm:inline">AI</span>
          </button>
          <button
            type="submit"
            disabled={isLoadingAi || !inputVal.trim()}
            aria-label={isSparkleMode ? "Parse brain dump into tasks" : "Add task"}
            className="btn-primary h-9 px-3 text-xs"
          >
            {isLoadingAi ? <Sparkles size={14} className="animate-spin" /> : <Plus size={15} />}
            <span className="hidden sm:inline">{isSparkleMode ? "Sort it" : "Add"}</span>
          </button>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {isLoadingAi && (
          <motion.p
            key={aiMessageIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="px-3 pb-1 text-xs font-medium text-lilac-deep"
            aria-live="polite"
          >
            {AI_LOADING_MESSAGES[aiMessageIndex]}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );

  const optimizeButton =
    activeView !== "Completed" && !(activeView === "Timeline" && selectedDay === null) ? (
      <button
        onClick={handleOptimizeFlow}
        disabled={isOptimizing || optimizeScope.length <= 1}
        aria-label="Optimize task flow order"
        className="btn-ghost"
      >
        <Sparkles size={14} className={`text-lilac-deep ${isOptimizing ? "animate-spin" : ""}`} />
        {isOptimizing ? "Optimizing..." : "Optimize flow"}
      </button>
    ) : null;

  const statItem = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-0.5 px-4 first:pl-0 border-l border-line first:border-l-0">
      <span className="text-xs text-muted whitespace-nowrap">{label}</span>
      <span className="text-base font-bold text-ink tabular-nums whitespace-nowrap">{value}</span>
    </div>
  );

  // --- Sidebar ---------------------------------------------------------

  const navItem = (view: ViewMode, label: string, Icon: LucideIcon, count?: number) => {
    const isActive = activeView === view;
    return (
      <button
        key={view}
        onClick={() => setActiveView(view)}
        aria-current={isActive ? "page" : undefined}
        className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 ${
          isActive ? "text-ink" : "text-ink/60 hover:text-ink hover:bg-white/70"
        }`}
      >
        {isActive && <Pill id="side-nav-pill" className="rounded-xl bg-white border border-line shadow-card" />}
        <Icon size={17} className="relative" />
        <span className="relative flex-1 text-left">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="relative text-xs font-semibold text-muted tabular-nums">{count}</span>
        )}
      </button>
    );
  };

  const sidebar = (
    <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border-r border-line bg-sidebar">
      <div className="flex h-16 items-center px-5 shrink-0">
        <button onClick={() => setActiveView("Timeline")} aria-label="Starboard home" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20">
          {brand}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-3 pb-4">
        <nav className="flex flex-col gap-0.5" aria-label="Views">
          {navItem("Timeline", "Timeline", CalendarDays, todayPending.length)}
          {navItem("Categories", "Folders", Folder)}
          {navItem("Completed", "Completed", CheckSquare, completedTasks.length)}
        </nav>

        <div className="mt-6">
          <button
            onClick={() => setFoldersOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-sm font-semibold text-ink"
            aria-expanded={foldersOpen}
          >
            Folders
            <motion.span animate={{ rotate: foldersOpen ? 0 : -90 }} className="flex text-muted">
              <ChevronDown size={16} />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {foldersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-0.5 pt-1">
                  {(["All", ...folderNames] as string[]).map((cat) => {
                    const isActive = activeView === "Categories" && activeCategory === cat;
                    const target = `row:${cat}`;
                    const count = cat === "All" ? pendingTasks.length : categoryCounts.get(cat) || 0;
                    return (
                      <button
                        key={cat}
                        onClick={() => openFolder(cat)}
                        {...dropProps(target, cat === "All" ? "Inbox" : cat)}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-all ${
                          isActive ? "bg-white text-ink font-semibold shadow-card" : "text-ink/65 hover:text-ink hover:bg-white/70"
                        } ${dragTarget === target ? "ring-2 ring-ink/40 bg-white scale-[1.02]" : ""}`}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat === "All" ? "#18181B" : getFolderColor(cat) }}
                        />
                        <span className="flex-1 text-left truncate">{cat === "All" ? "All tasks" : cat}</span>
                        <span className="text-xs text-muted tabular-nums">{count}</span>
                      </button>
                    );
                  })}

                  {isAddingFolder ? (
                    <form onSubmit={handleAddFolderSubmit} className="flex items-center gap-1.5 px-2 pt-1">
                      <input
                        autoFocus
                        value={newFolderInput}
                        onChange={(e) => setNewFolderInput(e.target.value)}
                        onBlur={() => {
                          if (!newFolderInput.trim()) setIsAddingFolder(false);
                        }}
                        placeholder="Folder name..."
                        className="flex-1 min-w-0 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs outline-none focus:border-ink/30"
                      />
                      <button type="submit" className="btn-primary px-2.5 py-1.5 text-xs">
                        Add
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsAddingFolder(true)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink/60 hover:text-ink transition-colors"
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ink text-white">
                        <Plus size={11} strokeWidth={3} />
                      </span>
                      Add a new folder
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Account */}
      <div className="shrink-0 p-3 border-t border-line">
        {isGuest ? (
          <div className="rounded-2xl bg-white border border-line p-3.5 flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-soft text-amber-deep">
                <CloudOff size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Guest mode</p>
                <p className="text-xs text-muted leading-snug">Tasks are saved on this device only.</p>
              </div>
            </div>
            <button onClick={onSignIn} className="btn-primary w-full py-2 text-xs">
              <LogIn size={14} /> Sign in to save
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber text-xs font-bold uppercase text-ink">
              {userEmail!.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink truncate">{userEmail}</p>
              <p className="flex items-center gap-1 text-[11px] text-mint-deep">
                <Cloud size={11} /> Synced
              </p>
            </div>
            <button onClick={onSignOut} aria-label="Sign out" title="Sign out" className="rounded-lg p-1.5 text-muted hover:bg-white hover:text-danger transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  // --- Views -----------------------------------------------------------

  const timelineView = (
    <div className="flex flex-col gap-6">
      {/* Welcome banner */}
      <motion.section
        {...panelMotion}
        className="relative overflow-hidden rounded-3xl bg-mint-soft border border-mint/60 px-6 py-6 sm:px-8 sm:py-7"
      >
        <svg aria-hidden="true" viewBox="0 0 320 180" className="pointer-events-none absolute -right-6 -top-2 h-[120%] w-auto opacity-90 hidden sm:block">
          <motion.path
            d="M40 120 C 80 40, 120 160, 170 70 S 250 40, 280 110"
            stroke="#F27BA6"
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: "easeInOut", delay: 0.2 }}
          />
          <motion.circle
            cx="235"
            cy="135"
            r="28"
            fill="#F7C35F"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.g
            style={{ originX: "120px", originY: "45px" }}
            animate={{ rotate: [0, 12, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <path d="M120 18 l8 18 19 2 -14 13 4 19 -17 -10 -17 10 4 -19 -14 -13 19 -2z" fill="#18181B" />
          </motion.g>
          <rect x="268" y="28" width="26" height="26" rx="7" fill="#8EC5E8" transform="rotate(18 281 41)" />
        </svg>
        <div className="relative max-w-md">
          <p className="text-sm font-medium text-ink/70">{greeting}, welcome back to your</p>
          <h1 className="mt-1 text-2xl sm:text-[28px] font-extrabold tracking-tight text-ink leading-tight">Daily task board</h1>
          <p className="mt-2 text-sm text-ink/70">
            {todayPending.length === 0
              ? overdueCount > 0
                ? `Nothing due today, but ${overdueCount} overdue task${overdueCount === 1 ? "" : "s"} could use a look.`
                : "Nothing due today. Plan something or enjoy the quiet."
              : `${todayPending.length} task${todayPending.length === 1 ? "" : "s"} due today · ${formatMinutes(plannedTodayMins)} planned`}
          </p>
          <button onClick={handleWhatNow} className="btn-primary mt-4 px-4 py-2.5 text-sm">
            <Zap size={15} className="fill-current" /> What should I do now?
          </button>
        </div>
      </motion.section>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-y-3 rounded-2xl border border-line bg-white px-5 py-4">
        {statItem("Planned today", formatMinutes(plannedTodayMins))}
        {statItem("Tasks left", <AnimatedNumber value={pendingTasks.length} />)}
        {statItem("Finished today", <AnimatedNumber value={archiveTodayCount} />)}
        {statItem("Streak", <><AnimatedNumber value={currentStreak} /> day{currentStreak === 1 ? "" : "s"}</>)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
        {/* Task list */}
        <section className="flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-ink">
              {selectedDay === null ? "Schedule" : dayHeading}
              {selectedDay !== null && dayStats && (
                <span className="ml-2 text-sm font-medium text-muted">
                  ({dayStats.total}
                  {dayStats.done > 0 ? ` · ${dayStats.done} done` : ""})
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {optimizeButton}
              <button onClick={() => setReceiptPayload({ tasks: displayedTasks, title: "Starboard" })} className="btn-ghost">
                <Receipt size={14} /> Print
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-canvas p-1 border border-line" role="tablist" aria-label="Timeline shortcuts">
            {[
              { id: null as string | null, label: "Overview", count: 0 },
              { id: todayIso, label: "Today", count: dateStats.get(todayIso)?.total ?? 0 },
              { id: tomorrowIso, label: "Tomorrow", count: dateStats.get(tomorrowIso)?.total ?? 0 },
              { id: UNSCHEDULED as string, label: "Unscheduled", count: unscheduledPendingCount },
            ].map((tab) => {
              const isActive = selectedDay === tab.id;
              return (
                <button
                  key={tab.label}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelectedDay(tab.id)}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 ${
                    isActive ? "text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {isActive && <Pill id="timeline-pill" className="rounded-lg bg-white border border-line shadow-card" />}
                  <span className="relative">{tab.label}</span>
                  {tab.count > 0 && <span className="relative text-[11px] text-muted tabular-nums">{tab.count}</span>}
                </button>
              );
            })}
          </div>

          {addTaskComposer}

          <motion.div
            key={listKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-3"
          >
            {timelineGroups ? (
              timelineGroups.length === 0 ? (
                emptyStateBlock
              ) : (
                <div className="flex flex-col gap-6">
                  <AnimatePresence initial={false}>
                    {timelineGroups.map((group) => (
                      <motion.section
                        key={group.key}
                        layout="position"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, transition: { delay: 0.45, duration: 0.2 } }}
                        className="flex flex-col gap-2.5"
                      >
                        <div className="flex items-center gap-2 px-0.5">
                          <span className={`text-sm font-bold ${group.key === "overdue" ? "text-danger" : "text-ink"}`}>{group.label}</span>
                          <span className="text-sm font-medium text-muted">({group.tasks.length})</span>
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <AnimatePresence initial={false}>{group.tasks.map(renderTaskCard)}</AnimatePresence>
                        </div>
                      </motion.section>
                    ))}
                  </AnimatePresence>
                </div>
              )
            ) : displayedTasks.length === 0 ? (
              emptyStateBlock
            ) : (
              <div className="panel p-2 flex flex-col">
                <div className="flex flex-col gap-0.5">
                  <AnimatePresence initial={false}>
                    {displayedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        compact
                        emphasizeSchedule={selectedDay === UNSCHEDULED}
                        folderColor={getFolderColor(task.category || "Inbox")}
                        onStartFocus={(t) => {
                          setFocusReason(null);
                          setFocusedTaskId(t.id);
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
                {peek && (
                  <div className="flex items-center justify-between mt-1 border-t border-line px-3 pt-2.5 pb-1.5">
                    <span className="text-xs text-muted">
                      {peek.label} · {peek.count} task{peek.count === 1 ? "" : "s"}
                    </span>
                    <button
                      onClick={() => setSelectedDay(peek!.iso)}
                      className="group inline-flex items-center gap-1 text-xs font-semibold text-ink/70 hover:text-ink transition-colors"
                    >
                      Next day <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </section>

        {/* Right column: calendar + progress */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-24">
          <div className="panel p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => changeWeek(-1)}
                aria-label="Previous week"
                className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={weekOffset}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15 }}
                  className="text-sm font-semibold text-ink"
                >
                  {formatWeekRangeLabel(weekDates)}
                </motion.span>
              </AnimatePresence>
              <button
                onClick={() => changeWeek(1)}
                aria-label="Next week"
                className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink transition-colors"
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
                    className={`relative flex flex-col items-center rounded-xl py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 ${
                      isSelected ? "text-white" : day.isToday ? "text-ink" : "text-ink/70 hover:bg-canvas"
                    }`}
                  >
                    {isSelected && <Pill id="day-pill" className="rounded-xl bg-ink" />}
                    {!isSelected && day.isToday && <span className="absolute inset-0 rounded-xl border border-ink/20" />}
                    <span className="relative text-[10px] font-semibold uppercase opacity-70">{day.weekdayShort.charAt(0)}</span>
                    <span className="relative text-sm font-bold leading-none mt-1">{day.dayNum}</span>
                    <span
                      className={`relative mt-1.5 h-1 w-1 rounded-full ${
                        hasTasks ? (isSelected ? "bg-white" : "bg-pink") : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {progressScope.length > 0 && (
            <div className="panel p-4 flex items-center gap-4">
              <ProgressRing percent={progressScopePct} size={64} stroke={7} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">Today&apos;s progress</p>
                <p className="text-xs text-muted mt-0.5">
                  {progressScopeCompleted === 0
                    ? "Finish your first task of the day to get rolling."
                    : `${progressScopeCompleted} of ${progressScope.length} done — keep going!`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const foldersView = (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Folders</h1>
      </div>

      {/* Folder cards, like the reference's project cards */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex sm:grid sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 overflow-x-auto sm:overflow-visible pb-1 scroll-thin">
        {(["All", ...folderNames] as string[]).map((cat, i) => {
          const isActive = activeCategory === cat;
          const stats = folderStats(cat);
          const color = cat === "All" ? "#18181B" : getFolderColor(cat);
          const target = `card:${cat}`;
          return (
            <motion.button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              {...dropProps(target, cat === "All" ? "Inbox" : cat)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, rotate: dragTarget === target ? -2 : 0, scale: dragTarget === target ? 1.04 : 1 }}
              whileHover={{ y: -3 }}
              transition={{ type: "spring", stiffness: 300, damping: 24, delay: i * 0.03 }}
              className={`relative flex h-36 w-44 sm:w-auto shrink-0 flex-col justify-between rounded-2xl p-4 text-left transition-shadow focus-visible:outline-none ${
                isActive ? "ring-2 ring-ink ring-offset-2 ring-offset-white shadow-lift" : "hover:shadow-lift"
              }`}
              style={{ backgroundColor: color, color: cat === "All" ? "#fff" : "#18181B" }}
            >
              <div>
                <p className="text-base font-extrabold leading-tight truncate">{cat === "All" ? "All tasks" : cat}</p>
                <p className="text-xs font-medium opacity-70 mt-0.5">
                  {stats.pending} open · {formatMinutes(cat === "All" ? pendingTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0) : categoryMinutes.get(cat) || 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold opacity-75 mb-1.5">{stats.pct}% done</p>
                <div className={`h-1.5 w-full overflow-hidden rounded-full ${cat === "All" ? "bg-white/20" : "bg-black/10"}`}>
                  <motion.div
                    className={`h-full rounded-full ${cat === "All" ? "bg-white" : "bg-white/90"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.pct}%` }}
                    transition={{ type: "spring", stiffness: 80, damping: 18, delay: 0.1 }}
                  />
                </div>
              </div>
            </motion.button>
          );
        })}

        {isAddingFolder ? (
          <form
            onSubmit={handleAddFolderSubmit}
            className="flex h-36 w-44 sm:w-auto shrink-0 flex-col justify-center gap-2 rounded-2xl border border-dashed border-ink/25 bg-white p-4"
          >
            <input
              autoFocus
              value={newFolderInput}
              onChange={(e) => setNewFolderInput(e.target.value)}
              onBlur={() => {
                if (!newFolderInput.trim()) setIsAddingFolder(false);
              }}
              placeholder="Folder name..."
              className="field py-2 text-sm"
            />
            <button type="submit" className="btn-primary py-2 text-xs">
              Create folder
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingFolder(true)}
            className="flex h-36 w-44 sm:w-auto shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/25 bg-white/50 text-sm font-semibold text-ink/60 hover:border-ink/50 hover:text-ink hover:bg-white transition-colors"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white">
              <Plus size={16} />
            </span>
            New folder
          </button>
        )}
      </div>

      {/* Selected folder */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {isRenamingFolder ? (
            <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: getFolderColor(activeCategory) }} />
              <input
                autoFocus
                value={folderNameInput}
                onChange={(e) => setFolderNameInput(e.target.value)}
                onBlur={handleRenameSubmit}
                className="text-lg font-bold text-ink bg-transparent border-b-2 border-ink outline-none w-48"
              />
            </form>
          ) : (
            <div className="flex items-center gap-3">
              {isFolderScopedProgress && progressScope.length > 0 && <ProgressRing percent={progressScopePct} size={44} stroke={5} showLabel={false} />}
              <div>
                <h2 className="text-lg font-bold text-ink">
                  {activeCategory === "All" ? "All tasks" : activeCategory}
                  <span className="ml-2 text-sm font-medium text-muted">
                    ({activeCategory === "All" ? pendingTasks.length : categoryCounts.get(activeCategory) || 0})
                  </span>
                </h2>
                {isFolderScopedProgress && progressScope.length > 0 && (
                  <p className="text-xs text-muted">
                    {progressScopeCompleted} of {progressScope.length} done · {progressScopePct}%
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {activeCategory !== "All" && !isRenamingFolder && (
              <button
                onClick={() => {
                  setFolderNameInput(activeCategory);
                  setIsRenamingFolder(true);
                }}
                className="btn-ghost"
              >
                <Pencil size={13} /> Rename
              </button>
            )}
            <button
              onClick={() =>
                setReceiptPayload({
                  tasks: activeCategory === "All" ? tasks : tasks.filter((t) => t.category === activeCategory),
                  title: activeCategory === "All" ? "All Tasks" : activeCategory,
                })
              }
              className="btn-ghost"
            >
              <Receipt size={14} /> Print
            </button>
            {optimizeButton}
          </div>
        </div>

        <form onSubmit={handleAddTaskToFolder} className="panel p-2 flex items-center gap-2">
          <input
            value={folderTaskInput}
            onChange={(e) => setFolderTaskInput(e.target.value)}
            placeholder={`Add a task to ${activeCategory === "All" ? "Inbox" : activeCategory}...`}
            aria-label={`Add a task to ${activeCategory === "All" ? "Inbox" : activeCategory}`}
            className="flex-1 rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink/40 outline-none"
          />
          <button type="submit" disabled={!folderTaskInput.trim()} aria-label="Add task" className="btn-primary h-9 px-3 text-xs">
            <Plus size={15} /> <span className="hidden sm:inline">Add</span>
          </button>
        </form>

        <motion.div
          key={listKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-2.5"
        >
          {displayedTasks.length === 0 ? (
            emptyStateBlock
          ) : (
            <AnimatePresence initial={false}>
              {displayedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  draggable
                  folderColor={getFolderColor(task.category || "Inbox")}
                  onStartFocus={(t) => {
                    setFocusReason(null);
                    setFocusedTaskId(t.id);
                  }}
                />
              ))}
            </AnimatePresence>
          )}
          {activeCategory !== "All" && (
            <div
              {...dropProps("zone", activeCategory)}
              className={`flex items-center justify-center gap-2 rounded-2xl border border-dashed p-5 text-xs font-semibold transition-all duration-200 ${
                dragTarget === "zone" ? "border-ink bg-white text-ink scale-[1.01]" : "border-ink/20 text-muted"
              }`}
            >
              <Folder size={14} />
              Drag tasks here to move them into {activeCategory}
            </div>
          )}
        </motion.div>
      </section>
    </div>
  );

  const completedView = (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Completed</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReceiptPayload({ tasks: displayedTasks, title: "Starboard" })}
            disabled={displayedTasks.length === 0}
            className="btn-ghost"
          >
            <Receipt size={14} /> Export receipt
          </button>
          <button
            onClick={handleClearCompleted}
            disabled={displayedTasks.length === 0}
            aria-label={confirmingClear ? "Confirm clear all completed tasks" : "Clear all completed tasks"}
            className={`btn-ghost ${confirmingClear ? "!bg-danger !text-white !border-danger" : "!text-danger"}`}
          >
            <Trash2 size={14} /> {confirmingClear ? "Confirm clear?" : "Clear all"}
          </button>
        </div>
      </div>

      {completedTasks.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-pink-soft p-4">
            <p className="text-xs font-medium text-ink/70">Current streak</p>
            <p className="mt-1 text-2xl font-extrabold text-ink">
              <AnimatedNumber value={currentStreak} /> <span className="text-sm font-semibold">day{currentStreak === 1 ? "" : "s"}</span>
            </p>
            <div className="mt-2 flex gap-1">
              {last7Days.map((d, i) => (
                <motion.span
                  key={d.iso}
                  title={d.iso}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.05 * i, type: "spring", stiffness: 500, damping: 20 }}
                  className={`h-3 flex-1 rounded-[4px] ${d.hasActivity ? (d.isToday ? "bg-ink" : "bg-pink") : "bg-white/80"}`}
                />
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-amber-soft p-4">
            <p className="text-xs font-medium text-ink/70">This week</p>
            <p className="mt-1 text-2xl font-extrabold text-ink">
              <AnimatedNumber value={thisWeekCompleted.length} />
            </p>
            <p className={`mt-1 text-xs font-semibold ${weekDelta >= 0 ? "text-mint-deep" : "text-muted"}`}>
              {weekDelta >= 0 ? "+" : ""}
              {weekDelta} vs last week
            </p>
          </div>
          <div className="rounded-2xl bg-sky-soft p-4">
            <p className="text-xs font-medium text-ink/70">Focus time</p>
            <p className="mt-1 text-2xl font-extrabold text-ink">{formatMinutes(focusTimeThisWeek)}</p>
            <p className="mt-1 text-xs text-ink/60 truncate">
              {busiestDayThisWeek ? `Busiest: ${busiestDayThisWeek.day}` : "—"}
              {topFolderThisWeek ? ` · ${topFolderThisWeek.folder}` : ""}
            </p>
          </div>
          <div className="rounded-2xl bg-mint-soft p-4">
            <p className="text-xs font-medium text-ink/70">Personal best</p>
            {personalBest ? (
              <>
                <p className="mt-1 text-2xl font-extrabold text-ink">
                  {personalBest.count} <span className="text-sm font-semibold">in a day</span>
                </p>
                <p className="mt-1 text-xs text-ink/60 truncate">
                  {formatShortWeekdayDate(personalBest.iso)}
                  {thisWeekBestDayCount < personalBest.count && ` · ${personalBest.count - thisWeekBestDayCount} away`}
                </p>
              </>
            ) : (
              <p className="mt-1 text-2xl font-extrabold text-ink">—</p>
            )}
          </div>
        </div>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted">
            <span className="font-bold text-ink">
              <AnimatedNumber value={completedTasks.length} />
            </span>{" "}
            finished all time · {archiveTodayCount} today
          </p>
          <div className="flex items-center gap-1 rounded-xl bg-canvas p-1 border border-line">
            {(["day", "week", "folder"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setArchiveGroupMode(mode)}
                className={`relative rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  archiveGroupMode === mode ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {archiveGroupMode === mode && <Pill id="archive-pill" className="rounded-lg bg-white border border-line shadow-card" />}
                <span className="relative">By {mode}</span>
              </button>
            ))}
          </div>
        </div>

        <motion.div
          key={listKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-4"
        >
          {archiveGroups.length === 0
            ? emptyStateBlock
            : archiveGroups.map((group) => (
                <div key={group.key} className="panel p-2">
                  <div className="flex items-center gap-2 px-3 pt-2 pb-1.5">
                    {archiveGroupMode === "folder" && (
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    )}
                    <span className="text-sm font-bold text-ink">{group.label}</span>
                    <span className="text-sm text-muted">({group.tasks.length})</span>
                  </div>
                  <AnimatePresence initial={false}>
                    {group.tasks.map((task) => (
                      <motion.div
                        key={task.id}
                        layout="position"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-canvas transition-colors"
                      >
                        <motion.button
                          onClick={() => toggleTask(task.id)}
                          whileTap={{ scale: 0.82 }}
                          title="Mark as not done"
                          aria-label={`Mark "${task.title}" as not done`}
                          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 border-ink bg-ink text-white"
                        >
                          <Check size={11} strokeWidth={3} />
                        </motion.button>
                        <span className="flex-1 min-w-0 truncate text-sm text-ink/45 line-through">{task.title}</span>
                        <span className="shrink-0 text-xs text-muted">{archiveRowMeta(task, archiveGroupMode)}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ))}
        </motion.div>
      </section>
    </div>
  );

  const MOBILE_TABS: { id: ViewMode; label: string; icon: LucideIcon }[] = [
    { id: "Timeline", label: "Timeline", icon: CalendarDays },
    { id: "Categories", label: "Folders", icon: Folder },
    { id: "Completed", label: "Completed", icon: CheckSquare },
  ];

  return (
    <div className="min-h-screen bg-canvas lg:h-screen lg:p-3">
      <div className="lg:flex lg:h-full lg:rounded-[24px] lg:border lg:border-line lg:bg-white lg:shadow-card lg:overflow-hidden">
        {sidebar}

        <div className="flex-1 min-w-0 bg-white lg:h-full lg:overflow-y-auto scroll-thin">
          {/* Top bar */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
            <div className="lg:hidden">{brand}</div>
            <p className="hidden lg:block text-lg font-bold text-ink">Today, {todayLabel}</p>
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={handleWhatNow} className="btn-primary px-3 py-2 text-xs lg:hidden">
                <Zap size={14} className="fill-current" />
              </button>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-pink" />
                <AnimatedNumber value={pendingTasks.length} className="tabular-nums" /> open
              </span>
              {profileMenu}
            </div>
          </header>

          {/* Toasts */}
          <div
            className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-[min(90vw,340px)]"
            aria-live="polite"
            aria-label="Notifications"
          >
            <AnimatePresence initial={false}>
              {toasts.map((t) => {
                const ToastIcon = t.tone === "error" ? AlertCircle : t.tone === "success" ? CheckCircle2 : Info;
                return (
                  <motion.div
                    key={t.id}
                    role="status"
                    layout
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    className="flex items-start gap-2.5 rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink shadow-pop"
                  >
                    <ToastIcon
                      size={17}
                      className={`mt-px shrink-0 ${t.tone === "error" ? "text-danger" : t.tone === "success" ? "text-mint-deep" : "text-ink/60"}`}
                    />
                    <span className="flex-1">{t.message}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeView === "Timeline" ? timelineView : activeView === "Categories" ? foldersView : completedView}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-md px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        aria-label="Views"
      >
        <div className="grid grid-cols-3 gap-1">
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition-colors ${
                  isActive ? "text-ink" : "text-muted"
                }`}
              >
                {isActive && <Pill id="mobile-nav-pill" className="rounded-xl bg-canvas" />}
                <Icon size={19} className="relative" />
                <span className="relative">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>
        {focusedTask && (
          <FocusModal
            key={focusedTask.id}
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
      </AnimatePresence>

      <AnimatePresence>
        {receiptPayload && (
          <ReceiptExport
            key="receipt"
            tasks={receiptPayload.tasks}
            title={receiptPayload.title}
            onClose={() => setReceiptPayload(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
