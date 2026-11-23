# Starboard

An AI-powered to-do list. Dump your messy brain into one box and Starboard
sorts it into tasks, folders and time estimates, then helps you work through
them with a weekly timeline and a focus timer.

**Live:** [starboard-neon.vercel.app](https://starboard-neon.vercel.app) — no sign-up needed to try it.

## Features

- **No sign-up required.** The app opens straight to the dashboard. As a guest,
  tasks are saved in your browser; sign in whenever you want them synced, and
  anything you made as a guest moves into your account automatically.
- **AI brain dump.** Type everything on your mind; Gemini splits it into tasks
  with priority, energy level, a time estimate, and Today / Tomorrow dates when
  you mention them. It files tasks into your existing folders and only creates
  a new one when nothing fits. Inside a folder, everything lands in that folder.
- **Timeline.** Overdue / Today / Tomorrow / Later / Unscheduled groups, a week
  strip, and a date picker with quick picks plus a month calendar.
- **Folders.** Colour-coded folder cards with progress, drag-and-drop filing,
  rename and delete (tasks move to Inbox), and a folder dropdown on every task.
- **Focus mode.** "What should I do now?" picks your next task; a timer with
  presets, steps checklist, and a "Stuck?" button that suggests a tiny first move.
- **Optimize flow.** AI reorders a day's (or folder's) tasks into a sensible
  sequence — it only changes the order, never the task data.
- **Completed.** Streak for the current week, weekly stats, personal best, and
  grouping by day, week or folder.
- **Receipt export.** Download any list as a clean PNG "receipt".

## Tech stack

- [Next.js 14](https://nextjs.org) (App Router) + React 18 + TypeScript
- Tailwind CSS + Framer Motion
- [Zustand](https://github.com/pmndrs/zustand) for state (optimistic updates)
- [Supabase](https://supabase.com) for auth and Postgres (row-level security)
- [Gemini API](https://ai.google.dev) via `@google/genai` (server-side only)
- Deployed on [Vercel](https://vercel.com)

## Project structure

```
app/
  page.tsx                 # Entry: dashboard for guests and signed-in users
  login/, signup/          # Auth pages (server actions)
  auth/callback/route.ts   # Email-confirmation link handler
  api/
    parse/route.ts         # Brain dump -> structured tasks
    optimize/route.ts      # Reorder tasks into a better flow
    stuck/route.ts         # One tiny next step for a task
    keepalive/route.ts     # Daily ping so the Supabase free tier doesn't pause
  icon.svg                 # Favicon
components/
  Dashboard.tsx            # Sidebar layout and the Timeline / Folders / Completed views
  TaskCard.tsx             # Task card + compact row, date picker, folder menu
  FocusModal.tsx           # Focus timer
  ReceiptExport.tsx        # PNG export
  AuthShell.tsx            # Shared login/signup layout
  ui/                      # MiniCalendar, ProgressRing, AnimatedNumber, FadeIn
store/useTaskStore.ts      # Tasks + folders; localStorage for guests, Supabase when signed in
hooks/useBrainDump.ts      # Calls /api/parse and adds the results
lib/
  supabase/                # Browser/server clients; safe fallback if env vars are missing
  aiErrors.ts, aiRateLimit.ts
  dates.ts, types.ts
supabase/schema.sql        # Tables + row-level security policies
vercel.json                # Daily cron for /api/keepalive
```

## Run it locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from the example and fill in your keys:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where to get it |
   | --- | --- |
   | `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey). Server-only, never sent to the browser. |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page (the public "anon" key — never the `service_role` key) |

   Without the Supabase variables the app still runs, in guest-only mode.

3. Set up the database: in the Supabase dashboard open **SQL Editor**, paste
   in `supabase/schema.sql`, and run it.

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Import the GitHub repo in Vercel.
2. Add the three environment variables above (Production and Preview).
   Optionally add `CRON_SECRET` (any long random string) to protect `/api/keepalive`.
3. Deploy. Pushes to `main` deploy automatically.
4. In Supabase → **Authentication → URL Configuration**, set the Site URL to
   your Vercel address and add it (plus `http://localhost:3000/**`) to the
   Redirect URLs.

## Notes

- **AI limits.** On Gemini's free tier the API allows a small number of
  requests per day, shared by all visitors. Each visitor is also limited to
  10 AI requests per hour. When either limit is hit, the app shows a clear
  message and everything else keeps working.
- **Supabase free tier.** Projects pause after about a week without activity;
  the daily `/api/keepalive` cron prevents that. If it ever pauses anyway,
  the app falls back to guest mode until the project is restored.
- **Email confirmation** is optional. If it's on in Supabase, sign-up shows a
  "check your inbox" screen with a resend option.
