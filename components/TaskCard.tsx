"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Play, Trash2, Clock, Zap, ChevronDown, Plus, Calendar, ListChecks, FolderPlus } from "lucide-react";
import type { Task } from "@/lib/types";
import { useTaskStore } from "@/store/useTaskStore";
import { formatDueDate, toISODate, addDays } from "@/lib/dates";
import MiniCalendar from "./ui/MiniCalendar";

interface TaskCardProps {
  task: Task;
  onStartFocus: (task: Task) => void;
  // Single-line agenda row used by the Timeline day view, instead of the
  // full card with every badge. emphasizeSchedule makes the due-date
  // control the prominent "+ Schedule" affordance rather than a category
  // chip - used for the Unscheduled bucket, where getting a date onto the
  // task is the whole point of the row.
  compact?: boolean;
  emphasizeSchedule?: boolean;
  // Lets the Folder drag-and-drop filing work - only passed true from
  // views that have a drop target for it (see Dashboard.tsx).
  draggable?: boolean;
  // Dot colour for the folder label, so cards match the sidebar.
  folderColor?: string;
  // Colour for any folder (used by the "move to folder" menu).
  folderColorOf?: (category: string) => string;
}

// Square checkbox (as in the reference design) with a small pop + ring
// when it gets checked.
function CheckBox({
  checked,
  onToggle,
  label,
  size = "md",
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  size?: "sm" | "md";
}) {
  const [pulse, setPulse] = useState(0);
  const box = size === "sm" ? "h-[18px] w-[18px] rounded-[5px]" : "h-5 w-5 rounded-md";
  return (
    <span className="relative flex shrink-0">
      <motion.button
        type="button"
        onClick={() => {
          if (!checked) setPulse((p) => p + 1);
          onToggle();
        }}
        whileTap={{ scale: 0.82 }}
        aria-label={label}
        aria-pressed={checked}
        className={`flex items-center justify-center border-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25 ${box} ${
          checked ? "border-ink bg-ink text-white" : "border-ink/25 bg-white text-transparent hover:border-ink/60"
        }`}
      >
        <AnimatePresence initial={false}>
          {checked && (
            <motion.span
              key="tick"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 22 }}
              className="flex"
            >
              <Check size={size === "sm" ? 11 : 13} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      {pulse > 0 && (
        <motion.span
          key={pulse}
          aria-hidden="true"
          initial={{ scale: 1, opacity: 0.45 }}
          animate={{ scale: 2.1, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`pointer-events-none absolute inset-0 border-2 border-mint-deep ${box}`}
        />
      )}
    </span>
  );
}

export default function TaskCard({
  task,
  onStartFocus,
  compact = false,
  emphasizeSchedule = false,
  draggable = false,
  folderColor,
  folderColorOf,
}: TaskCardProps) {
  const {
    toggleTask,
    deleteTask,
    toggleSubtask,
    addSubtaskManual,
    moveCategory,
    setDueDate,
    updateTaskTitle,
    setEstimatedMinutes,
    addCategory,
    tasks: allTasks,
    customCategories,
  } = useTaskStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  // "Move to folder" menu: pick an existing folder, or explicitly create
  // a new one (typing a name used to create a folder on every typo).
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const folderOptions = useMemo(() => {
    const fromTasks = allTasks.map((t) => t.category).filter(Boolean) as string[];
    return Array.from(new Set(["Inbox", ...fromTasks, ...customCategories]));
  }, [allTasks, customCategories]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(task.title);

  const [isEditingMinutes, setIsEditingMinutes] = useState(false);
  const [minutesInput, setMinutesInput] = useState(String(task.estimated_minutes));

  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const todayIso = toISODate(new Date());
  const tomorrowIso = toISODate(addDays(new Date(), 1));
  // "Next week" = the coming Monday (always 1-7 days away).
  const nextMondayIso = toISODate(addDays(new Date(), ((8 - new Date().getDay()) % 7) || 7));

  const dueDateRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isEditingDueDate) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dueDateRef.current && !dueDateRef.current.contains(e.target as Node)) {
        setIsEditingDueDate(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditingDueDate]);

  const pickDueDate = (iso: string | null) => {
    setDueDate(task.id, iso);
    setIsEditingDueDate(false);
  };

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
    };
  }, []);

  const handleDeleteClick = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      confirmDeleteTimeoutRef.current = setTimeout(() => setConfirmingDelete(false), 3000);
      return;
    }
    if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
    deleteTask(task.id);
  };

  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const isUrgent = task.priority === "urgent_important" && !task.completed;
  const isOverdue = !task.completed && !!task.due_date && task.due_date < todayIso;

  // One status, like the reference's "New / In progress / Done" tag.
  const status = task.completed
    ? { label: "Done", dot: "bg-mint-deep" }
    : isOverdue
    ? { label: "Overdue", dot: "bg-danger" }
    : isUrgent
    ? { label: "Urgent", dot: "bg-pink" }
    : task.due_date === todayIso
    ? { label: "Today", dot: "bg-amber" }
    : null;

  const handleManualSubtaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    addSubtaskManual(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle("");
    setIsAddingSubtask(false);
  };

  const closeFolderMenu = () => {
    setIsFolderMenuOpen(false);
    setIsCreatingFolder(false);
    setNewFolderName("");
  };

  const pickFolder = (name: string) => {
    if (name !== (task.category || "Inbox")) moveCategory(task.id, name);
    closeFolderMenu();
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    // Reuse an existing folder that only differs in capitalisation
    // ("work" vs "Work") instead of creating a near-duplicate.
    const existing = folderOptions.find((f) => f.toLowerCase() === name.toLowerCase());
    if (!existing) addCategory(name);
    pickFolder(existing || name);
  };

  useEffect(() => {
    if (!isFolderMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) closeFolderMenu();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFolderMenu();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isFolderMenuOpen]);

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = titleInput.trim();
    if (trimmed) {
      updateTaskTitle(task.id, trimmed);
    } else {
      setTitleInput(task.title);
    }
    setIsEditingTitle(false);
  };

  const handleMinutesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(minutesInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setEstimatedMinutes(task.id, parsed);
    } else {
      setMinutesInput(String(task.estimated_minutes));
    }
    setIsEditingMinutes(false);
  };

  const quickDates = [
    { iso: todayIso, label: "Today" },
    { iso: tomorrowIso, label: "Tomorrow" },
    { iso: nextMondayIso, label: "Next week" },
  ];

  // Quick picks + a month calendar for any future day. Compact rows sit
  // near the right edge, so their menu opens leftwards.
  const dueDateDropdown = (
    <motion.div
      ref={dueDateRef}
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.1 } }}
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      className={`absolute z-30 top-full mt-1.5 w-64 rounded-xl bg-white border border-line shadow-pop p-1.5 flex flex-col ${
        compact ? "right-0 origin-top-right" : "left-0 origin-top-left"
      }`}
    >
      <div className="grid grid-cols-3 gap-1 pb-1.5">
        {quickDates.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => pickDueDate(opt.iso)}
            className={`rounded-lg px-1 py-1.5 text-[11px] font-semibold transition-colors ${
              task.due_date === opt.iso ? "bg-ink text-white" : "bg-canvas text-ink hover:bg-line"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="border-t border-line pt-1.5">
        <MiniCalendar value={task.due_date} onPick={pickDueDate} />
      </div>
      {task.due_date && (
        <button
          type="button"
          onClick={() => pickDueDate(null)}
          className="mt-1 rounded-lg border-t border-line px-2.5 pt-2 pb-1 text-left text-xs font-medium text-danger hover:bg-danger/5 transition-colors"
        >
          Remove date
        </button>
      )}
    </motion.div>
  );

  const metaBtn =
    "inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 -mx-0.5 text-xs font-medium text-muted hover:bg-canvas hover:text-ink transition-colors disabled:pointer-events-none";

  const motionWrapper = {
    layout: "position" as const,
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.25, delay: 0.2 } },
    transition: { type: "spring" as const, stiffness: 320, damping: 30 },
    className: `relative ${isEditingDueDate || isFolderMenuOpen ? "z-30" : "z-0"}`,
  };

  const actionButtons = (size: number) => (
    <>
      {!task.completed && (
        <button
          onClick={() => onStartFocus(task)}
          className="flex items-center justify-center rounded-lg p-1.5 text-muted hover:bg-ink hover:text-white transition-colors"
          title="Start focus timer"
          aria-label={`Start focus timer for "${task.title}"`}
        >
          <Play size={size} className="fill-current" />
        </button>
      )}
      <button
        onClick={handleDeleteClick}
        aria-label={confirmingDelete ? `Confirm delete "${task.title}"` : `Delete "${task.title}"`}
        className={`flex items-center gap-1 rounded-lg p-1.5 transition-colors ${
          confirmingDelete ? "bg-danger text-white" : "text-muted hover:bg-danger/10 hover:text-danger"
        }`}
      >
        <Trash2 size={size} />
        {confirmingDelete && <span className="text-[11px] font-semibold pr-0.5">Delete?</span>}
      </button>
    </>
  );

  const titleEditor = (
    <form onSubmit={handleTitleSubmit} className="flex-1 min-w-0">
      <input
        autoFocus
        value={titleInput}
        onChange={(e) => setTitleInput(e.target.value)}
        onBlur={handleTitleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setTitleInput(task.title);
            setIsEditingTitle(false);
          }
        }}
        className="w-full bg-transparent text-sm font-semibold text-ink outline-none border-b-2 border-ink/30 focus:border-ink"
      />
    </form>
  );

  const startTitleEdit = () => {
    if (task.completed) return;
    setTitleInput(task.title);
    setIsEditingTitle(true);
  };

  if (compact) {
    const showScheduleControl = emphasizeSchedule || !task.due_date;
    return (
      <motion.div {...motionWrapper}>
        <div
          className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
            task.completed ? "bg-canvas/60" : "hover:bg-canvas"
          }`}
        >
          <CheckBox
            size="sm"
            checked={task.completed}
            onToggle={() => toggleTask(task.id)}
            label={task.completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          />

          {isEditingTitle ? (
            titleEditor
          ) : (
            <span
              onDoubleClick={startTitleEdit}
              title="Double-click to edit"
              className={`flex-1 min-w-0 truncate text-sm font-medium transition-colors ${
                task.completed ? "text-ink/40 line-through" : "text-ink cursor-text"
              }`}
            >
              {task.title}
            </span>
          )}

          {!task.completed && (
            <div className="relative shrink-0">
              {showScheduleControl ? (
                <button
                  type="button"
                  onClick={() => setIsEditingDueDate((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-ink/25 px-2 py-0.5 text-[11px] font-semibold text-ink/70 hover:border-ink/50 hover:text-ink transition-colors"
                  title="Schedule this task"
                >
                  <Calendar size={11} /> {task.due_date ? formatDueDate(task.due_date) : "Schedule"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingDueDate((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-medium text-muted hover:bg-white hover:text-ink transition-colors"
                  title="Reschedule this task"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: folderColor || "#A1A1AA" }} />
                  {task.category || "Inbox"}
                </button>
              )}
              <AnimatePresence>{isEditingDueDate && dueDateDropdown}</AnimatePresence>
            </div>
          )}

          <span className="shrink-0 text-[11px] font-medium text-muted tabular-nums">{task.estimated_minutes}m</span>

          <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {actionButtons(12)}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...motionWrapper}>
      <div
        draggable={draggable && !task.completed}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
        className={`panel group p-4 transition-all duration-200 hover:border-ink/15 hover:shadow-lift ${
          draggable && !task.completed ? "cursor-grab active:cursor-grabbing" : ""
        } ${task.completed ? "bg-white/70" : ""}`}
      >
        {/* Top line: folder · status · checkbox */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={folderMenuRef}>
            <button
              onClick={() => !task.completed && (isFolderMenuOpen ? closeFolderMenu() : setIsFolderMenuOpen(true))}
              disabled={task.completed}
              aria-haspopup="menu"
              aria-expanded={isFolderMenuOpen}
              className={`inline-flex items-center gap-1.5 rounded-md px-1 -mx-1 py-0.5 text-xs font-medium transition-colors disabled:pointer-events-none ${
                isFolderMenuOpen ? "bg-canvas text-ink" : "text-muted hover:bg-canvas hover:text-ink"
              }`}
              title="Move to another folder"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: folderColor || "#A1A1AA" }} />
              Folder: <span className="text-ink/80">{task.category || "Inbox"}</span>
              {!task.completed && <ChevronDown size={12} className={`transition-transform ${isFolderMenuOpen ? "rotate-180" : ""}`} />}
            </button>

            <AnimatePresence>
              {isFolderMenuOpen && (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.1 } }}
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  className="absolute left-0 top-full z-30 mt-1.5 w-56 origin-top-left rounded-xl border border-line bg-white p-1.5 shadow-pop"
                >
                  <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Move to folder</p>
                  <div className="max-h-56 overflow-y-auto scroll-thin">
                    {folderOptions.map((name) => {
                      const isCurrent = name === (task.category || "Inbox");
                      return (
                        <button
                          key={name}
                          role="menuitem"
                          type="button"
                          onClick={() => pickFolder(name)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                            isCurrent ? "bg-canvas font-semibold text-ink" : "font-medium text-ink/80 hover:bg-canvas hover:text-ink"
                          }`}
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: folderColorOf?.(name) || "#A1A1AA" }} />
                          <span className="min-w-0 flex-1 truncate">{name}</span>
                          {isCurrent && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1 border-t border-line pt-1">
                    {isCreatingFolder ? (
                      <form onSubmit={handleCreateFolder} className="flex items-center gap-1.5 p-1">
                        <input
                          autoFocus
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="New folder name..."
                          aria-label="New folder name"
                          className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-ink/30"
                        />
                        <button type="submit" disabled={!newFolderName.trim()} className="btn-primary px-2.5 py-1.5 text-[11px]">
                          Create
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsCreatingFolder(true)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-ink/70 hover:bg-canvas hover:text-ink"
                      >
                        <FolderPlus size={13} /> New folder
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {status && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/80">
                <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            )}
            <CheckBox
              checked={task.completed}
              onToggle={() => toggleTask(task.id)}
              label={task.completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
            />
          </div>
        </div>

        {/* Title */}
        <div className="mt-1.5 flex">
          {isEditingTitle ? (
            titleEditor
          ) : (
            <span
              onDoubleClick={startTitleEdit}
              title="Double-click to edit"
              className={`text-[15px] font-semibold leading-snug transition-colors ${
                task.completed ? "text-ink/40 line-through" : "text-ink cursor-text"
              }`}
            >
              {task.title}
            </span>
          )}
        </div>

        {/* Meta line: time · date · focus · steps · actions */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          {isEditingMinutes ? (
            <form onSubmit={handleMinutesSubmit} className="inline-flex items-center gap-1 rounded-lg border border-ink/30 px-1.5 py-0.5">
              <Clock size={13} className="text-muted shrink-0" />
              <input
                autoFocus
                type="number"
                min={1}
                value={minutesInput}
                onChange={(e) => setMinutesInput(e.target.value)}
                onBlur={handleMinutesSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setMinutesInput(String(task.estimated_minutes));
                    setIsEditingMinutes(false);
                  }
                }}
                className="w-9 bg-transparent text-xs font-medium text-ink outline-none [appearance:textfield]"
              />
              <span className="text-xs text-muted">min</span>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (task.completed) return;
                setMinutesInput(String(task.estimated_minutes));
                setIsEditingMinutes(true);
              }}
              disabled={task.completed}
              title="Edit estimated time"
              className={metaBtn}
            >
              <Clock size={13} /> {task.estimated_minutes} min
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => !task.completed && setIsEditingDueDate((v) => !v)}
              disabled={task.completed}
              className={`${metaBtn} ${isOverdue ? "!text-danger" : ""}`}
              title="Schedule this task"
            >
              <Calendar size={13} /> {task.due_date ? formatDueDate(task.due_date) : "No date"}
            </button>
            <AnimatePresence>{isEditingDueDate && dueDateDropdown}</AnimatePresence>
          </div>

          {task.energy_level === "high_focus" && !task.completed && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
              <Zap size={13} className="text-amber-deep" /> Deep focus
            </span>
          )}

          {totalSubtasks > 0 ? (
            <button onClick={() => setIsExpanded(!isExpanded)} className={metaBtn}>
              <ListChecks size={13} />
              {completedSubtasks}/{totalSubtasks} steps
              <span className="h-1 w-10 overflow-hidden rounded-full bg-line">
                <motion.span
                  className="block h-full rounded-full bg-ink"
                  initial={false}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ type: "spring", stiffness: 160, damping: 22 }}
                />
              </span>
              <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} className="flex">
                <ChevronDown size={13} />
              </motion.span>
            </button>
          ) : (
            !task.completed && (
              <button
                onClick={() => {
                  setIsExpanded(true);
                  setIsAddingSubtask(true);
                }}
                className={`${metaBtn} sm:opacity-0 sm:group-hover:opacity-100`}
              >
                <Plus size={13} /> Add step
              </button>
            )
          )}

          <div
            className={`ml-auto flex items-center gap-0.5 transition-opacity duration-150 ${
              confirmingDelete ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            }`}
          >
            {actionButtons(14)}
          </div>
        </div>

        {/* Steps */}
        <AnimatePresence initial={false}>
          {isExpanded && (totalSubtasks > 0 || isAddingSubtask) && (
            <motion.div
              key="subtasks"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 border-t border-line pt-2.5 space-y-0.5">
                {task.subtasks.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-canvas transition-colors">
                    <CheckBox
                      size="sm"
                      checked={sub.completed}
                      onToggle={() => toggleSubtask(task.id, sub.id)}
                      label={sub.completed ? `Mark step "${sub.title}" as not done` : `Mark step "${sub.title}" as done`}
                    />
                    <span className={`text-sm ${sub.completed ? "text-ink/40 line-through" : "text-ink/80"}`}>{sub.title}</span>
                  </div>
                ))}

                {!task.completed &&
                  (isAddingSubtask ? (
                    <form onSubmit={handleManualSubtaskSubmit} className="flex items-center gap-2 px-1.5 pt-1">
                      <input
                        autoFocus
                        type="text"
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onBlur={() => {
                          if (!newSubtaskTitle.trim()) setIsAddingSubtask(false);
                        }}
                        placeholder="New step..."
                        className="flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-ink/30"
                      />
                      <button type="submit" className="btn-primary px-3 py-1.5 text-xs">
                        Add
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsAddingSubtask(true)}
                      className="flex items-center gap-1.5 px-1.5 py-1.5 text-xs font-semibold text-muted hover:text-ink"
                    >
                      <Plus size={13} /> Add step
                    </button>
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
