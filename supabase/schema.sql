-- Starboard database schema.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste
-- this whole file -> Run. Safe to re-run (uses IF NOT EXISTS / OR REPLACE
-- throughout), but it will NOT retroactively add Row Level Security to a
-- table that already has rows from before RLS existed - always verify RLS
-- is enabled (see the confirmation query at the bottom).

-- ── tasks ───────────────────────────────────────────────────────────────
-- id is a client-generated uuid (the app already does crypto.randomUUID()
-- for every task) rather than a server default, so no code path needs to
-- wait on the database to learn a new task's id before using it locally.
create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  priority text not null default 'important'
    check (priority in ('urgent_important', 'important', 'low_priority')),
  energy_level text not null default 'high_focus'
    check (energy_level in ('high_focus', 'quick_admin', 'low_energy')),
  estimated_minutes integer not null default 25,
  category text default 'Inbox',
  due_date date,
  subtasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- CREATE TABLE IF NOT EXISTS won't retroactively add a column to a table
-- that already exists (from an earlier run of this file) - this line is
-- what actually adds sort_order if you ran this schema before Phase 3.
-- Persists the order Optimize Flow (and everyday drag/reordering) puts
-- tasks in, so a refresh doesn't silently reset everything back to
-- whatever order the database happens to return rows in.
alter table public.tasks add column if not exists sort_order integer not null default 0;

create index if not exists tasks_user_id_idx on public.tasks(user_id);

-- ── categories ──────────────────────────────────────────────────────────
-- Only needed for folders that exist before any task uses them (created
-- via the "+ New" button in the Folder Rail). A folder with at least one
-- task doesn't need a row here at all - it's derived from tasks.category
-- on the client - this table exists purely so an empty folder isn't lost.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists categories_user_id_idx on public.categories(user_id);

-- ── Row Level Security ─────────────────────────────────────────────────
-- Without this, the publishable/anon key (which is meant to be public,
-- shipped to every browser) would let anyone read or write every user's
-- rows. These policies are what actually enforce "your data is yours" -
-- not secrecy of the key.
alter table public.tasks enable row level security;
alter table public.categories enable row level security;

drop policy if exists "Users manage their own tasks" on public.tasks;
create policy "Users manage their own tasks"
  on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own categories" on public.categories;
create policy "Users manage their own categories"
  on public.categories
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Confirm RLS is actually on (should return true for both rows) ───────
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relname in ('tasks', 'categories');
