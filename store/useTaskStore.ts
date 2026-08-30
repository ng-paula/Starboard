import { create } from 'zustand';
import type { Task } from '@/lib/types';

interface TaskState {
  tasks: Task[];
  // Categories only exist implicitly via tasks.category. This lets a
  // freshly-created, still-empty folder show up in the rail before any
  // task uses it - same in-memory-only lifetime as everything else here.
  customCategories: string[];
  // Actions
  addTask: (task: Task) => void;
  addMultipleTasks: (tasks: Task[]) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  clearCompleted: () => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addSubtaskManual: (taskId: string, title: string) => void;
  setTasksBreakingDown: (id: string, isBreakingDown: boolean) => void;
  updateTaskSubtasks: (id: string, subtasks: any[]) => void;
  moveCategory: (taskId: string, newCategory: string) => void;
  setDueDate: (taskId: string, dueDate: string | null) => void;
  addCategory: (name: string) => void;
  renameCategory: (oldName: string, newName: string) => void;
  reorderTasks: (sortedTasks: Task[]) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  // We'll start with an empty array. You can paste your dummy tasks here if you want to keep them!
  tasks: [],
  customCategories: [],

  reorderTasks: (sortedTasks) => set({ tasks: sortedTasks }),

  addTask: (task) => set((state) => ({ 
    tasks: [...state.tasks, task] 
  })),

  addMultipleTasks: (newTasks) => set((state) => ({ 
    tasks: [...state.tasks, ...newTasks] 
  })),

  toggleTask: (id) => set((state) => ({
    tasks: state.tasks.map((t) => {
      if (t.id !== id) return t;
      const completed = !t.completed;
      // Powers the Archive's day-grouping and streak/personal-best stats -
      // reset on un-complete so a re-finished task gets a fresh timestamp.
      return { ...t, completed, completed_at: completed ? new Date().toISOString() : null };
    })
  })),

  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== id)
  })),

  clearCompleted: () => set((state) => ({
    tasks: state.tasks.filter((t) => !t.completed)
  })),

  toggleSubtask: (taskId, subtaskId) => set((state) => ({
    tasks: state.tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        subtasks: t.subtasks.map((s) => s.id === subtaskId ? { ...s, completed: !s.completed } : s)
      };
    })
  })),

  addSubtaskManual: (taskId, title) => set((state) => ({
    tasks: state.tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        subtasks: [...(t.subtasks || []), { id: crypto.randomUUID(), title, completed: false }]
      };
    })
  })),

  setTasksBreakingDown: (id, isBreakingDown) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, isBreakingDown } : t))
  })),

  updateTaskSubtasks: (id, subtasks) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, subtasks, isBreakingDown: false } : t))
  })),

  moveCategory: (taskId, newCategory) => set((state) => ({
    tasks: state.tasks.map((t) => t.id === taskId ? { ...t, category: newCategory } : t)
  })),

  setDueDate: (taskId, dueDate) => set((state) => ({
    tasks: state.tasks.map((t) => t.id === taskId ? { ...t, due_date: dueDate } : t)
  })),

  addCategory: (name) => set((state) =>
    state.customCategories.includes(name) || state.tasks.some((t) => t.category === name)
      ? state
      : { customCategories: [...state.customCategories, name] }
  ),

  renameCategory: (oldName, newName) => set((state) => ({
    tasks: state.tasks.map((t) => t.category === oldName ? { ...t, category: newName } : t),
    customCategories: state.customCategories.map((c) => c === oldName ? newName : c),
  })),
}));