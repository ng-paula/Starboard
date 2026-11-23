import { create } from 'zustand';
import type { Task } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// Guests (not signed in) keep their tasks in this browser's localStorage.
// When they sign in, whatever they made as a guest is copied into their
// account and the local copy is cleared - so nothing is lost by trying
// the app first and creating an account later.
const GUEST_KEY = 'starboard:guest:v1';

interface GuestData {
  tasks: Task[];
  customCategories: string[];
}

function readGuest(): GuestData {
  if (typeof window === 'undefined') return { tasks: [], customCategories: [] };
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    if (!raw) return { tasks: [], customCategories: [] };
    const parsed = JSON.parse(raw);
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      customCategories: Array.isArray(parsed.customCategories) ? parsed.customCategories : [],
    };
  } catch {
    return { tasks: [], customCategories: [] };
  }
}

function writeGuest(data: GuestData) {
  try {
    window.localStorage.setItem(GUEST_KEY, JSON.stringify(data));
  } catch {
    // Private mode / storage full - the session still works, it just
    // won't survive a refresh.
  }
}

function clearGuest() {
  try {
    window.localStorage.removeItem(GUEST_KEY);
  } catch {
    /* ignore */
  }
}

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

function taskToRow(task: Task, userId: string, sortOrder: number) {
  return {
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
  };
}

interface TaskState {
  tasks: Task[];
  // Categories only exist implicitly via tasks.category, except for a
  // still-empty folder created via "+ New" that no task uses yet - those
  // live in their own table (or guest storage) and end up here after
  // loadTasks().
  customCategories: string[];
  userId: string | null;
  // True once loadTasks() has decided between guest and account mode -
  // guest data is only persisted after that, so an empty initial state
  // can never overwrite what's already saved.
  hasLoaded: boolean;
  isLoading: boolean;
  // Sync failures don't roll back the optimistic local update (that would
  // yank a task out from under someone mid-click) - they surface here for
  // the UI to toast, since the store itself has no toast system of its
  // own.
  syncError: string | null;
  clearSyncError: () => void;
  // Non-error messages for the UI to toast (e.g. guest tasks imported).
  notice: string | null;
  clearNotice: () => void;
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
// set(), and - only for signed-in users - the matching Supabase call fires
// in the background. Guests are persisted to localStorage by the
// subscription at the bottom of this file instead.
function reportSyncError(
  set: (partial: Partial<TaskState>) => void,
  action: string,
  error: unknown
) {
  console.error(`[Supabase] ${action} failed:`, error);
  set({ syncError: `Couldn't save "${action}" - it may not survive a refresh.` });
}

export const useTaskStore = create<TaskState>((set, get) => {
  // Runs a Supabase write only when signed in, reporting failures.
  const remote = (action: string, run: (userId: string) => PromiseLike<{ error: unknown }>) => {
    const userId = get().userId;
    if (!userId) return;
    run(userId).then(({ error }) => {
      if (error) reportSyncError(set, action, error);
    });
  };

  return {
    tasks: [],
    customCategories: [],
    userId: null,
    hasLoaded: false,
    isLoading: false,
    syncError: null,
    notice: null,

    clearSyncError: () => set({ syncError: null }),
    clearNotice: () => set({ notice: null }),

    loadTasks: async () => {
      set({ isLoading: true, syncError: null });

      // If Supabase can't be reached at all, getUser() resolves with an
      // error rather than throwing - either way the app falls back to
      // guest mode and stays usable.
      let user: { id: string } | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        user = data.user;
      } catch {
        user = null;
      }

      if (!user) {
        const guest = readGuest();
        set({
          userId: null,
          tasks: guest.tasks,
          customCategories: guest.customCategories,
          isLoading: false,
          hasLoaded: true,
        });
        return;
      }

      const [tasksRes, categoriesRes] = await Promise.all([
        supabase.from('tasks').select('*').order('sort_order', { ascending: true }),
        supabase.from('categories').select('name'),
      ]);

      if (tasksRes.error) {
        reportSyncError(set, 'loading your tasks', tasksRes.error);
        set({ isLoading: false, hasLoaded: true, userId: user.id });
        return;
      }

      let tasks = (tasksRes.data || []).map(rowToTask);
      let customCategories: string[] = (categoriesRes.data || []).map((c: any) => c.name);

      // First load after signing in: move anything made as a guest into
      // the account, appended after the account's existing tasks.
      const guest = readGuest();
      if (guest.tasks.length > 0 || guest.customCategories.length > 0) {
        const existingIds = new Set(tasks.map((t) => t.id));
        const toImport = guest.tasks.filter((t) => !existingIds.has(t.id));
        const newCategories = guest.customCategories.filter((c) => !customCategories.includes(c));

        const [insertTasks, insertCategories] = await Promise.all([
          toImport.length > 0
            ? supabase.from('tasks').insert(toImport.map((t, i) => taskToRow(t, user!.id, tasks.length + i)))
            : Promise.resolve({ error: null }),
          newCategories.length > 0
            ? supabase
                .from('categories')
                .insert(newCategories.map((name) => ({ id: crypto.randomUUID(), user_id: user!.id, name })))
            : Promise.resolve({ error: null }),
        ]);

        if (insertTasks.error || insertCategories.error) {
          // Keep the guest copy so nothing is lost; try again next load.
          reportSyncError(set, 'moving your guest tasks into your account', insertTasks.error || insertCategories.error);
        } else {
          clearGuest();
          tasks = [...tasks, ...toImport];
          customCategories = [...customCategories, ...newCategories];
          if (toImport.length > 0) {
            set({
              notice: `Saved ${toImport.length} task${toImport.length === 1 ? '' : 's'} from this device to your account.`,
            });
          }
        }
      }

      set({ userId: user.id, tasks, customCategories, isLoading: false, hasLoaded: true });
    },

    reorderTasks: (sortedTasks) => {
      set({ tasks: sortedTasks });
      remote('reordering tasks', () =>
        supabase.from('tasks').upsert(
          sortedTasks.map((t, i) => ({ id: t.id, sort_order: i })),
          { onConflict: 'id' }
        )
      );
    },

    addTask: (task) => {
      const sortOrder = get().tasks.length;
      set((state) => ({ tasks: [...state.tasks, task] }));
      remote('adding task', (userId) => supabase.from('tasks').insert(taskToRow(task, userId, sortOrder)));
    },

    addMultipleTasks: (newTasks) => {
      const start = get().tasks.length;
      set((state) => ({ tasks: [...state.tasks, ...newTasks] }));
      remote('adding tasks from brain dump', (userId) =>
        supabase.from('tasks').insert(newTasks.map((task, i) => taskToRow(task, userId, start + i)))
      );
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
      remote('checking off task', () =>
        supabase.from('tasks').update({ completed, completed_at: completedAt }).eq('id', id)
      );
    },

    deleteTask: (id) => {
      set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
      remote('deleting task', () => supabase.from('tasks').delete().eq('id', id));
    },

    clearCompleted: () => {
      set((state) => ({ tasks: state.tasks.filter((t) => !t.completed) }));
      remote('clearing completed tasks', () => supabase.from('tasks').delete().eq('completed', true));
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
      remote('checking off step', () => supabase.from('tasks').update({ subtasks: nextSubtasks }).eq('id', taskId));
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
      remote('adding step', () => supabase.from('tasks').update({ subtasks: nextSubtasks }).eq('id', taskId));
    },

    moveCategory: (taskId, newCategory) => {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, category: newCategory } : t)),
      }));
      remote('moving task to folder', () => supabase.from('tasks').update({ category: newCategory }).eq('id', taskId));
    },

    setDueDate: (taskId, dueDate) => {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, due_date: dueDate } : t)),
      }));
      remote('scheduling task', () => supabase.from('tasks').update({ due_date: dueDate }).eq('id', taskId));
    },

    addCategory: (name) => {
      const alreadyExists = get().customCategories.includes(name) || get().tasks.some((t) => t.category === name);
      if (alreadyExists) return;
      set((state) => ({ customCategories: [...state.customCategories, name] }));
      remote('creating folder', (userId) =>
        supabase.from('categories').insert({ id: crypto.randomUUID(), user_id: userId, name })
      );
    },

    renameCategory: (oldName, newName) => {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.category === oldName ? { ...t, category: newName } : t)),
        customCategories: state.customCategories.map((c) => (c === oldName ? newName : c)),
      }));
      remote('renaming folder', () =>
        Promise.all([
          supabase.from('tasks').update({ category: newName }).eq('category', oldName),
          // No-ops harmlessly if this folder never had an empty-folder row
          // (i.e. it only ever existed because tasks used it).
          supabase.from('categories').update({ name: newName }).eq('name', oldName),
        ]).then(([a, b]) => ({ error: a.error || b.error }))
      );
    },

    updateTaskTitle: (taskId, title) => {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, title } : t)),
      }));
      remote('renaming task', () => supabase.from('tasks').update({ title }).eq('id', taskId));
    },

    setEstimatedMinutes: (taskId, minutes) => {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, estimated_minutes: minutes } : t)),
      }));
      remote('updating estimated time', () =>
        supabase.from('tasks').update({ estimated_minutes: minutes }).eq('id', taskId)
      );
    },
  };
});

// Persist guest work to this browser on every change. Signed-in users are
// saved to Supabase by the actions above instead.
if (typeof window !== 'undefined') {
  useTaskStore.subscribe((state, prev) => {
    if (!state.hasLoaded || state.userId) return;
    if (state.tasks === prev.tasks && state.customCategories === prev.customCategories) return;
    writeGuest({ tasks: state.tasks, customCategories: state.customCategories });
  });
}
