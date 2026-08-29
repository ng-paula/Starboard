export type Priority = "urgent_important" | "important" | "low_priority";
export type EnergyLevel = "high_focus" | "quick_admin" | "low_energy";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  estimated_minutes?: number;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  energy_level: EnergyLevel;
  estimated_minutes: number;
  category?: string; // <-- ADD THIS LINE
  due_hint?: string | null;
  scheduled_time?: string | null;
  starter_tip?: string | null;
  subtasks: Subtask[];
  isBreakingDown?: boolean;
}