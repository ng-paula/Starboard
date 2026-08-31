"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Check, Play, Trash2, Clock, Zap, ChevronDown, ChevronUp, Plus, Calendar, Folder } from "lucide-react";
import type { Task } from "@/lib/types";
import { useTaskStore } from "@/store/useTaskStore";
import { formatShortDate, toISODate, addDays } from "@/lib/dates";

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
  // Lets the Folder Rail's drag-and-drop filing work - only passed true
  // from views that have a drop target for it (see Dashboard.tsx).
  draggable?: boolean;
}

export default function TaskCard({ task, onStartFocus, compact = false, emphasizeSchedule = false, draggable = false }: TaskCardProps) {
  // 1. Grab all our actions directly from the Zustand store!
  const {
    toggleTask,
    deleteTask,
    toggleSubtask,
    addSubtaskManual,
    moveCategory,
    setDueDate,
    updateTaskTitle,
    setEstimatedMinutes,
  } = useTaskStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState(task.category || "Inbox");

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(task.title);

  const [isEditingMinutes, setIsEditingMinutes] = useState(false);
  const [minutesInput, setMinutesInput] = useState(String(task.estimated_minutes));

  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const todayIso = toISODate(new Date());
  const tomorrowIso = toISODate(addDays(new Date(), 1));
  // The next 5 days after tomorrow, generated directly rather than
  // derived from a Mon-Sun week array - deriving it from "whatever's
  // left of this calendar week" went empty every Saturday/Sunday, since
  // there's nothing left in a Mon-Sun week once you're on its last day.
  // This always offers a full run of upcoming days regardless of what
  // day of the week today is, rolling into next week when needed.
  const upcomingDays = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => {
      const date = addDays(new Date(), i + 2);
      return {
        iso: toISODate(date),
        weekdayShort: date.toLocaleDateString(undefined, { weekday: "short" }),
        dayNum: date.getDate(),
      };
    });
  }, [todayIso]);

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

  const handleManualSubtaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    addSubtaskManual(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle("");
    setIsAddingSubtask(false);
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryInput.trim()) {
      moveCategory(task.id, categoryInput.trim());
    }
    setIsEditingCategory(false);
  };

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

  // Real dropdown (Today / Tomorrow / rest of this week / clear) instead
  // of a row of day buttons - used by both the full and compact layouts.
  const dueDateDropdown = (
    <div
      ref={dueDateRef}
      className="absolute z-20 top-full right-0 mt-1 w-36 rounded-xl bg-white border border-folder-pink/40 shadow-lg py-1 flex flex-col"
    >
      <button
        type="button"
        onClick={() => pickDueDate(todayIso)}
        className="flex items-center justify-between px-3 py-1.5 text-left text-xs font-medium text-ink hover:bg-folder-pink/15 transition-colors"
      >
        Today {task.due_date === todayIso && <Check size={12} />}
      </button>
      <button
        type="button"
        onClick={() => pickDueDate(tomorrowIso)}
        className="flex items-center justify-between px-3 py-1.5 text-left text-xs font-medium text-ink hover:bg-folder-pink/15 transition-colors"
      >
        Tomorrow {task.due_date === tomorrowIso && <Check size={12} />}
      </button>
      <div className="my-1 border-t border-folder-pink/20" />
      <span className="px-3 pt-0.5 pb-1 text-[9px] font-bold uppercase tracking-wide text-ink/40">Upcoming</span>
      {upcomingDays.map((day) => (
        <button
          key={day.iso}
          type="button"
          onClick={() => pickDueDate(day.iso)}
          className="flex items-center justify-between px-3 py-1.5 text-left text-xs font-medium text-ink hover:bg-folder-pink/15 transition-colors"
        >
          {day.weekdayShort} {day.dayNum} {task.due_date === day.iso && <Check size={12} />}
        </button>
      ))}
      <div className="my-1 border-t border-folder-pink/20" />
      <button
        type="button"
        onClick={() => pickDueDate(null)}
        className="px-3 py-1.5 text-left text-xs font-medium text-danger hover:bg-danger/10 transition-colors"
      >
        No date
      </button>
    </div>
  );

  if (compact) {
    const showScheduleControl = emphasizeSchedule || !task.due_date;
    return (
      <div
        className={`group flex items-center gap-2.5 py-2 px-2.5 rounded-xl transition-colors ${
          task.completed ? "bg-button-green/10 hover:bg-button-green/15" : "bg-folder-pink/8 hover:bg-folder-pink/15"
        }`}
      >
        <button
          onClick={() => toggleTask(task.id)}
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            task.completed ? "border-button-greenDeep bg-button-greenDeep text-white" : "border-folder-pink/50 text-transparent hover:border-button-greenDeep/60"
          }`}
        >
          <Check size={9} strokeWidth={3} />
        </button>

        {isEditingTitle ? (
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
              className="w-full bg-transparent text-sm text-ink outline-none border-b border-folder-pinkDeep"
            />
          </form>
        ) : (
          <span
            onDoubleClick={() => {
              if (task.completed) return;
              setTitleInput(task.title);
              setIsEditingTitle(true);
            }}
            title="Double-click to edit"
            className={`flex-1 min-w-0 truncate text-sm ${task.completed ? "text-ink/50 line-through" : "text-ink cursor-text"}`}
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
                className="inline-flex items-center gap-1 rounded-full bg-stripe-blue/20 px-2 py-0.5 text-[10px] font-semibold text-[#2E6A82] border border-stripe-blue/50 hover:bg-stripe-blue/35 transition-colors"
                title="Schedule this task"
              >
                <Calendar size={10} /> {task.due_date ? formatShortDate(task.due_date) : "Schedule"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingDueDate((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-ink/70 border border-ink/10 hover:bg-ink/10 transition-colors"
                title="Reschedule this task"
              >
                <Folder size={9} /> {task.category || "Inbox"}
              </button>
            )}
            {isEditingDueDate && dueDateDropdown}
          </div>
        )}

        <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!task.completed && (
            <button
              onClick={() => onStartFocus(task)}
              className="p-1.5 rounded-lg bg-[#bce0fd] text-[#2E6A82] hover:bg-[#a6d3fc] transition-colors"
              title="Focus Timer"
            >
              <Play size={11} className="fill-current" />
            </button>
          )}
          <button
            onClick={handleDeleteClick}
            aria-label={confirmingDelete ? `Confirm delete "${task.title}"` : `Delete "${task.title}"`}
            className={`p-1.5 rounded-lg transition-colors ${
              confirmingDelete ? "bg-danger text-white" : "text-ink/40 hover:bg-danger/10 hover:text-danger"
            }`}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable={draggable && !task.completed}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      className={`group relative rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] border-2 p-4 transition-all ${
        draggable && !task.completed ? "cursor-grab active:cursor-grabbing" : ""
      } ${
        task.completed
          ? "border-folder-pink/30 bg-folder-pink/10 opacity-70"
          : isUrgent
          ? "border-danger/30 hover:border-danger/50"
          : "border-folder-pink/40 hover:border-folder-pink/70"
      }`}
    >
      {isUrgent && (
        <div
          aria-hidden="true"
          className="absolute -top-2.5 left-6 h-4 w-11 bg-star/80 rounded-[2px] -rotate-6 pointer-events-none"
        />
      )}

      <div className="flex items-start gap-3">
        
        <button
          onClick={() => toggleTask(task.id)}
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            task.completed ? "border-button-greenDeep bg-button-greenDeep text-white" : "border-folder-pink/50 text-transparent hover:border-button-greenDeep/60"
          }`}
        >
          <Check size={12} strokeWidth={3} />
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          {isEditingTitle ? (
            <form onSubmit={handleTitleSubmit}>
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
                className="block w-full text-sm sm:text-base font-medium text-ink bg-transparent outline-none border-b-2 border-folder-pinkDeep"
              />
            </form>
          ) : (
            <span
              onDoubleClick={() => {
                if (task.completed) return;
                setTitleInput(task.title);
                setIsEditingTitle(true);
              }}
              title="Double-click to edit"
              className={`block text-sm sm:text-base font-medium ${task.completed ? "text-ink/50 line-through" : "text-ink cursor-text"}`}
            >
              {task.title}
            </span>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {isEditingCategory ? (
              <form onSubmit={handleCategorySubmit} className="inline-flex">
                <input
                  autoFocus
                  type="text"
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  onBlur={handleCategorySubmit}
                  className="rounded-full bg-ink/8 border border-ink/15 px-2 py-0.5 text-[10px] text-ink outline-none focus:border-ink/40 w-24"
                  placeholder="New tab..."
                />
              </form>
            ) : (
              <button
                onClick={() => !task.completed && setIsEditingCategory(true)}
                disabled={task.completed}
                className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-ink/80 border border-ink/15 hover:bg-ink/10 transition-colors disabled:opacity-50"
                title="Move to another folder"
              >
                <Folder size={10} /> {task.category || "Inbox"}
              </button>
            )}

            {isUrgent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-ink border border-danger/30">
                <div className="h-1.5 w-1.5 rounded-full bg-danger" /> Urgent
              </span>
            )}

            {task.energy_level === "high_focus" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-star/30 px-2 py-0.5 text-[10px] font-semibold text-ink border border-star/60">
                <Zap size={10} /> Deep Focus
              </span>
            )}

            {isEditingMinutes ? (
              <form
                onSubmit={handleMinutesSubmit}
                className="inline-flex items-center gap-1 rounded-full bg-folder-pink/20 border border-folder-pinkDeep px-2 py-0.5"
              >
                <Clock size={10} className="text-ink shrink-0" />
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
                  className="w-8 bg-transparent text-[10px] font-medium text-ink outline-none [appearance:textfield]"
                />
                <span className="text-[10px] font-medium text-ink">m</span>
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
                className="inline-flex items-center gap-1 rounded-full bg-folder-pink/20 px-2 py-0.5 text-[10px] font-medium text-ink border border-folder-pink/40 hover:bg-folder-pink/30 transition-colors disabled:opacity-50"
              >
                <Clock size={10} /> {task.estimated_minutes}m
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => !task.completed && setIsEditingDueDate((v) => !v)}
                disabled={task.completed}
                className="inline-flex items-center gap-1 rounded-full bg-stripe-blue/25 px-2 py-0.5 text-[10px] font-medium text-ink border border-stripe-blue/50 hover:bg-stripe-blue/40 transition-colors disabled:opacity-50"
                title="Schedule this task"
              >
                <Calendar size={10} /> {task.due_date ? formatShortDate(task.due_date) : "No date"}
              </button>
              {isEditingDueDate && dueDateDropdown}
            </div>
          </div>

          {/* Subtasks Section - reachable even at zero subtasks for an active
              task, since manually adding the first step is now the only way
              to get one. A completed task with no subtasks shows nothing,
              same as before; one with existing subtasks still shows them. */}
          {(totalSubtasks > 0 || !task.completed) && (
            <div className={totalSubtasks > 0 ? "pt-3 mt-2 border-t border-folder-pink/25" : "pt-1"}>
              {totalSubtasks > 0 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-folder-pinkDeep hover:text-ink transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    Steps ({completedSubtasks}/{totalSubtasks})
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-folder-pink/20 rounded-full overflow-hidden">
                      <div className="h-full bg-folder-pinkDeep transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {(isExpanded || totalSubtasks === 0) && (
                <div className={totalSubtasks > 0 ? "mt-2 space-y-1.5 pl-1" : "space-y-1.5"}>
                  {task.subtasks.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 p-1.5 hover:bg-folder-pink/10 rounded-lg transition-colors">
                      <button
                        onClick={() => toggleSubtask(task.id, sub.id)}
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                          sub.completed ? "border-button-greenDeep bg-button-greenDeep text-white" : "border-folder-pink/50 bg-white"
                        }`}
                      >
                        {sub.completed && <Check size={10} strokeWidth={3} />}
                      </button>
                      <span className={`text-xs ${sub.completed ? "text-ink/50 line-through" : "text-ink/80"}`}>
                        {sub.title}
                      </span>
                    </div>
                  ))}

                  {!task.completed &&
                    (isAddingSubtask ? (
                      <form onSubmit={handleManualSubtaskSubmit} className="flex items-center gap-2 mt-1">
                        <input
                          autoFocus
                          type="text"
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          placeholder="New step..."
                          className="flex-1 rounded-lg border border-folder-pink/50 bg-white px-2 py-1 text-xs outline-none focus:border-folder-pinkDeep"
                        />
                        <button type="submit" className="text-xs font-semibold text-folder-pinkDeep hover:text-ink">Add</button>
                      </form>
                    ) : (
                      <button onClick={() => setIsAddingSubtask(true)} className="flex items-center gap-1 text-[11px] text-ink/60 hover:text-folder-pinkDeep mt-1 pl-1">
                        <Plus size={12} /> Add step
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Icons */}
        <div
          className={`flex shrink-0 flex-col sm:flex-row items-center gap-1 transition-opacity ${
            confirmingDelete ? "opacity-100" : "opacity-100 sm:opacity-0 group-hover:opacity-100"
          }`}
        >
          {!task.completed && (
            <button
              onClick={() => onStartFocus(task)}
              className="flex items-center gap-1 rounded-xl bg-[#bce0fd] p-2 text-[#2E6A82] hover:bg-[#a6d3fc] transition-colors"
              title="Focus Timer"
            >
              <Play size={14} className="fill-current" />
            </button>
          )}
          <button
            onClick={handleDeleteClick}
            aria-label={confirmingDelete ? `Confirm delete "${task.title}"` : `Delete "${task.title}"`}
            className={`flex items-center gap-1 rounded-xl p-2 transition-colors ${
              confirmingDelete ? "bg-danger text-white" : "text-ink/40 hover:bg-danger/10 hover:text-danger"
            }`}
          >
            <Trash2 size={14} />
            {confirmingDelete && <span className="text-[11px] font-semibold pr-0.5">Confirm?</span>}
          </button>
        </div>
      </div>
    </div>
  );
}