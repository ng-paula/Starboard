import { create } from 'zustand';
import type { Task } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// The DB row shape matches the client Task shape almost 1:1 (this app
// already named fields snake_case) - the only differences are user_id,
// created_at, and sort_order, none of which the client needs to carry
// around locally.
function rowToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    completed_at: row.completed_at,
    priority: row.priority,
    energy_level: row.energy_level,
    estimated_minutes: row.estimated_minutes,
    category: row.category,
    due_date: row.due_date,
    subtasks: row.subtasks || [],
  };
}

interface TaskState {
  tasks: Task[];
  // Categories only exist implicitly via tasks.category, except for a
  // still-empty folder created via "+ New" that no task uses yet - those
  // live in their own table and end up here after loadTasks().
  customCategories: string[];
  userId: string | null;
  isLoading: boolean;
  // Sync failures don't roll back the optimistic local update (that would
  // yank a task out from under someone mid-click) - they surface here for
  // the UI to toast, since the store itself has no toast system of its
  // own.
  syncError: string | null;
  clearSyncError: () => void;
  loadTasks: () => Promise<void>;
  // Actions
  addTask: (task: Task) => void;
  addMultipleTasks: (tasks: Task[]) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  clearCompleted: () => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addSubtaskManual: (taskId: string, title: string) => void;
  moveCategory: (taskId: string, newCategory: string) => void;
  setDueDate: (taskId: string, dueDate: string | null) => void;
  addCategory: (name: string) => void;
  renameCategory: (oldName: string, newName: string) => void;
  updateTaskTitle: (taskId: string, title: string) => void;
  setEstimatedMinutes: (taskId: string, minutes: number) => void;
  reorderTasks: (sortedTasks: Task[]) => void;
}

// Every mutation below is optimistic: local state updates immediately via
// set(), and the matching Supabase call fires in the background. This
// function is what a failed background call reports through - logged for
// debugging, surfaced to the store's syncError for the UI to toast.
function reportSyncError(
  set: (partial: Partial<TaskState>) => void,
  action: string,
  error: unknown
) {
  console.error(`[Supabase] ${action} failed:`, error);
  set({ syncError: `Couldn't save "${action}" - it may not survive a refresh.` });
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  customCategories: [],
  userId: null,
  isLoading: false,
  syncError: null,

  clearSyncError: () => set({ syncError: null }),

  loadTasks: async () => {
    set({ isLoading: true, syncError: null });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      set({ isLoading: false });
      return;
    }

    const [tasksRes, categoriesRes] = await Promise.all([
      supabase.from('tasks').select('*').order('sort_order', { ascending: true }),
      supabase.from('categories').select('name'),
    ]);

    if (tasksRes.error) {
      reportSyncError(set, 'loading your tasks', tasksRes.error);
      set({ isLoading: false });
      return;
    }

    set({
      userId: user.id,
      tasks: (tasksRes.data || []).map(rowToTask),
      customCategories: (categoriesRes.data || []).map((c: any) => c.name),
      isLoading: false,
    });
  },

  reorderTasks: (sortedTasks) => {
    set({ tasks: sortedTasks });
    supabase
      .from('tasks')
      .upsert(
        sortedTasks.map((t, i) => ({ id: t.id, sort_order: i })),
        { onConflict: 'id' }
      )
      .then(({ error }) => {
        if (error) reportSyncError(set, 'reordering tasks', error);
      });
  },

  addTask: (task) => {
    const sortOrder = get().tasks.length;
    set((state) => ({ tasks: [...state.tasks, task] }));

    const userId = get().userId;
    if (!userId) return;
    supabase
      .from('tasks')
      .insert({
        id: task.id,
        user_id: userId,
        title: task.title,
        completed: task.completed,
        completed_at: task.completed_at ?? null,
        priority: task.priority,
        energy_level: task.energy_level,
        estimated_minutes: task.estimated_minutes,
        category: task.category ?? 'Inbox',
        due_date: task.due_date ?? null,
        subtasks: task.subtasks ?? [],
        sort_order: sortOrder,
      })
      .then(({ error }) => {
        if (error) reportSyncError(set, 'adding task', error);
      });
  },

  addMultipleTasks: (newTasks) => {
    const startingSortOrder = get().tasks.length;
    set((state) => ({ tasks: [...state.tasks, ...newTasks] }));

    const userId = get().userId;
    if (!userId) return;
    supabase
      .from('tasks')
      .insert(
        newTasks.map((task, i) => ({
          id: task.id,
          user_id: userId,
          title: task.title,
          completed: task.completed,
          completed_at: task.completed_at ?? null,
          priority: task.priority,
          energy_level: task.energy_level,
          estimated_minutes: task.estimated_minutes,
          category: task.category ?? 'Inbox',
          due_date: task.due_date ?? null,
          subtasks: task.subtasks ?? [],
          sort_order: startingSortOrder + i,
        }))
      )
      .then(({ error }) => {
        if (error) reportSyncError(set, 'adding tasks from brain dump', error);
      });
  },

  toggleTask: (id) => {
    let completed = false;
    let completedAt: string | null = null;
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== id) return t;
        completed = !t.completed;
        completedAt = completed ? new Date().toISOString() : null;
        return { ...t, completed, completed_at: completedAt };
      }),
    }));
    supabase
      .from('tasks')
      .update({ completed, completed_at: completedAt })
      .eq('id', id)
      .then(({ error }) => {
        if (error) reportSyncError(set, 'checking off task', error);
      });
  },

  deleteTask: (id) => {
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) reportSyncError(set, 'deleting task', error);
      });
  },

  clearCompleted: () => {
    set((state) => ({ tasks: state.tasks.filter((t) => !t.completed) }));
    supabase
      .from('tasks')
      .delete()
      .eq('completed', true)
      .then(({ error }) => {
        if (error) reportSyncError(set, 'clearing completed tasks', error);
      });
  },

  toggleSubtask: (taskId, subtaskId) => {
    let nextSubtasks: Task['subtasks'] | null = null;
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== taskId) return t;
        nextSubtasks = t.subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s));
        return { ...t, subtasks: nextSubtasks };
      }),
    }));
    if (!nextSubtasks) return;
    supabase
      .from('tasks')
      .update({ subtasks: nextSubtasks })
      .eq('id', taskId)
      .then(({ error }) => {
        if (error) reportSyncError(set, 'checking off step', error);
      });
  },

  addSubtaskManual: (taskId, title) => {
    let nextSubtasks: Task['subtasks'] | null = null;
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== taskId) return t;
        nextSubtasks = [...(t.subtasks || []), { id: crypto.randomUUID(), title, completed: false }];
        return { ...t, subtasks: nextSubtasks };
      }),
    }));
    if (!nextSubtasks) return;
    supabase
      .from('tasks')
      .update({ subtasks: nextSubtasks })
      .eq('id', taskId)
      .then(({ error }) => {
        if (error) reportSyncError(set, 'adding step', error);
      });
  },

  moveCategory: (taskId, newCategory) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, category: newCategory } : t)),
    }));
    supabase
      .from('tasks')
      .update({ category: newCategory })
      .eq('id', taskId)
      .then(({ error }) => {
        if (error) reportSyncError(set, 'moving task to folder', error);
      });
  },

  setDueDate: (taskId, dueDate) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, due_date: dueDate } : t)),
    }));
    supabase
      .from('tasks')
      .update({ due_date: dueDate })
      .eq('id', taskId)
      .then(({ error }) => {
        if (error) reportSyncError(set, 'scheduling task', error);
      });
  },

  addCategory: (name) => {
    const alreadyExists = get().customCategories.includes(name) || get().tasks.some((t) => t.category === name);
    if (alreadyExists) return;
    set((state) => ({ customCategories: [...state.customCategories, name] }));

    const userId = get().userId;
    if (!userId) return;
    supabase
      .from('categories')
      .insert({ id: crypto.randomUUID(), user_id: userId, name })
      .then(({ error }) => {
        if (error) reportSyncError(set, 'creating folder', error);
      });
  },

  renameCategory: (oldName, newName) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.category === oldName ? { ...t, category: newName } : t)),
      customCategories: state.customCategories.map((c) => (c === oldName ? newName : c)),
    }));

    Promise.all([
      supabase.from('tasks').update({ category: newName }).eq('category', oldName),
      // No-ops harmlessly if this folder never had an empty-folder row
      // (i.e. it only ever existed because tasks used it).
      supabase.from('categories').update({ name: newName }).eq('name', oldName),
    ]).then(([tasksRes, categoriesRes]) => {
      const error = tasksRes.error || categoriesRes.error;
      if (error) reportSyncError(set, 'renaming folder', error);
    });
  },

  updateTaskTitle: (taskId, title) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, title } : t)),
    }));
    supabase
      .from('tasks')
      .update({ title })
      .eq('id', taskId)
      .then(({ error }) => {
        if (error) reportSyncError(set, 'renaming task', error);
      });
  },

  setEstimatedMinutes: (taskId, minutes) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, estimated_minutes: minutes } : t)),
    }));
    supabase
      .from('tasks')
      .update({ estimated_minutes: minutes })
      .eq('id', taskId)
      .then(({ error }) => {
        if (error) reportSyncError(set, 'updating estimated time', error);
      });
  },
}));
