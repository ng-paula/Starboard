"use client";

import React, { useState } from "react";
import { Check, Sparkles, Play, Trash2, Clock, Zap, ChevronDown, ChevronUp, Plus, Calendar, Folder } from "lucide-react";
import type { Task } from "@/lib/types";
import { useTaskStore } from "@/store/useTaskStore";

interface TaskCardProps {
  task: Task;
  onStartFocus: (task: Task) => void;
}

export default function TaskCard({ task, onStartFocus }: TaskCardProps) {
  // 1. Grab all our actions directly from the Zustand store!
  const { 
    toggleTask, 
    deleteTask, 
    toggleSubtask, 
    addSubtaskManual, 
    moveCategory, 
    setTasksBreakingDown, 
    updateTaskSubtasks 
  } = useTaskStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState(task.category || "Inbox");

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

  // 2. We moved the Breakdown API call here to keep the Dashboard clean
  const handleBreakdown = async () => {
    setTasksBreakingDown(task.id, true);
    try {
      const res = await fetch("/api/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: task.title }),
      });
      const data = await res.json();
      
      if (data.subtasks && Array.isArray(data.subtasks)) {
        const formattedSubtasks = data.subtasks.map((sub: any) => ({
          id: crypto.randomUUID(),
          title: typeof sub === "string" ? sub : sub.title,
          completed: false,
        }));
        updateTaskSubtasks(task.id, formattedSubtasks);
        setIsExpanded(true); // Auto-expand to show the new steps
      } else {
        setTasksBreakingDown(task.id, false);
      }
    } catch (err) {
      console.error("Breakdown failed:", err);
      setTasksBreakingDown(task.id, false);
    }
  };

  return (
    <div
      className={`group relative rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] border-2 border-dashed p-4 transition-all ${
        task.completed
          ? "border-pink-50 bg-pink-50/30 opacity-70"
          : isUrgent
          ? "border-rose-200 hover:border-rose-300"
          : "border-pink-100 hover:border-pink-300"
      }`}
    >
      {isUrgent && (
        <div
          aria-hidden="true"
          className="absolute -top-2.5 left-6 h-4 w-11 bg-amber-200/80 rounded-[2px] -rotate-6 pointer-events-none"
        />
      )}

      <div className="flex items-start gap-3">
        
        <button
          onClick={() => toggleTask(task.id)}
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            task.completed ? "border-emerald-400 bg-emerald-400 text-white" : "border-pink-200 text-transparent hover:border-emerald-300"
          }`}
        >
          <Check size={12} strokeWidth={3} />
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          <span className={`block text-sm sm:text-base font-medium ${task.completed ? "text-gray-400 line-through" : "text-gray-700"}`}>
            {task.title}
          </span>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {isEditingCategory ? (
              <form onSubmit={handleCategorySubmit} className="inline-flex">
                <input 
                  autoFocus
                  type="text"
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  onBlur={handleCategorySubmit}
                  className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-700 outline-none focus:border-slate-400 w-24"
                  placeholder="New tab..."
                />
              </form>
            ) : (
              <button 
                onClick={() => !task.completed && setIsEditingCategory(true)}
                disabled={task.completed}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
                title="Move to another folder"
              >
                <Folder size={10} /> {task.category || "Inbox"}
              </button>
            )}

            {isUrgent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 border border-rose-100">
                <div className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Urgent
              </span>
            )}
            
            {task.energy_level === "high_focus" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 border border-amber-100">
                <Zap size={10} /> Deep Focus
              </span>
            )}

            <span className="inline-flex items-center gap-1 rounded-full bg-pink-50/50 px-2 py-0.5 text-[10px] font-medium text-pink-500 border border-pink-100">
              <Clock size={10} /> {task.estimated_minutes}m
            </span>

            {task.due_hint && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-600 border border-sky-100">
                <Calendar size={10} /> {task.due_hint}
              </span>
            )}
          </div>

          {/* Subtasks Section */}
          {totalSubtasks > 0 && (
            <div className="pt-3 mt-2 border-t border-pink-50">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-pink-400 hover:text-pink-600 transition-colors"
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Steps ({completedSubtasks}/{totalSubtasks})
                </button>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-pink-50 rounded-full overflow-hidden">
                    <div className="h-full bg-pink-400 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2 space-y-1.5 pl-1">
                  {task.subtasks.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 p-1.5 hover:bg-pink-50/50 rounded-lg transition-colors">
                      <button
                        onClick={() => toggleSubtask(task.id, sub.id)}
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                          sub.completed ? "border-emerald-400 bg-emerald-400 text-white" : "border-pink-200 bg-white"
                        }`}
                      >
                        {sub.completed && <Check size={10} strokeWidth={3} />}
                      </button>
                      <span className={`text-xs ${sub.completed ? "text-gray-400 line-through" : "text-gray-600"}`}>
                        {sub.title}
                      </span>
                    </div>
                  ))}
                  
                  {isAddingSubtask ? (
                    <form onSubmit={handleManualSubtaskSubmit} className="flex items-center gap-2 mt-1">
                      <input
                        autoFocus
                        type="text"
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        placeholder="New step..."
                        className="flex-1 rounded-lg border border-pink-200 bg-white px-2 py-1 text-xs outline-none focus:border-pink-400"
                      />
                      <button type="submit" className="text-xs font-semibold text-pink-500 hover:text-pink-700">Add</button>
                    </form>
                  ) : (
                    <button onClick={() => setIsAddingSubtask(true)} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-pink-500 mt-1 pl-1">
                      <Plus size={12} /> Add step
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Icons */}
        <div className="flex shrink-0 flex-col sm:flex-row items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
          {!task.completed && (
            <button
              onClick={() => onStartFocus(task)}
              className="flex items-center gap-1 rounded-xl bg-[#bce0fd] p-2 text-[#2E6A82] hover:bg-[#a6d3fc] transition-colors"
              title="Focus Timer"
            >
              <Play size={14} className="fill-current" />
            </button>
          )}
          {!task.completed && (
            <button
              onClick={handleBreakdown}
              className="p-2 text-pink-400 hover:bg-pink-50 rounded-xl transition-colors"
              title="AI Breakdown"
            >
              <Sparkles size={14} className={task.isBreakingDown ? "animate-spin" : ""} />
            </button>
          )}
          <button
            onClick={() => deleteTask(task.id)}
            className="p-2 text-gray-300 hover:bg-rose-50 hover:text-rose-400 rounded-xl transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}