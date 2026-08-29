import { create } from 'zustand';
import type { Task } from '@/lib/types';

interface TaskState {
  tasks: Task[];
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
  reorderTasks: (sortedTasks: Task[]) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  // We'll start with an empty array. You can paste your dummy tasks here if you want to keep them!
  tasks: [], 

  reorderTasks: (sortedTasks) => set({ tasks: sortedTasks }),

  addTask: (task) => set((state) => ({ 
    tasks: [...state.tasks, task] 
  })),

  addMultipleTasks: (newTasks) => set((state) => ({ 
    tasks: [...state.tasks, ...newTasks] 
  })),

  toggleTask: (id) => set((state) => ({
    tasks: state.tasks.map((t) => t.id === id ? { ...t, completed: !t.completed } : t)
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

  
}));