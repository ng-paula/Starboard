export type Priority = "urgent_important" | "important" | "low_priority";
export type EnergyLevel = "high_focus" | "quick_admin" | "low_energy";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  completed_at?: string | null; // full ISO datetime — when it was marked done, set/cleared by toggleTask
  priority: Priority;
  energy_level: EnergyLevel;
  estimated_minutes: number;
  category?: string; // <-- ADD THIS LINE
  due_date?: string | null; // ISO "YYYY-MM-DD" — the actual scheduled day, or null if unscheduled
  subtasks: Subtask[];
}