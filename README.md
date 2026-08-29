# Starboard ✨

A whimsical, AI-powered to-do list. Land on a Y2K-scrapbook folder, hit
**Start Listing**, and untangle your to-dos — either one at a time, or by
dumping your whole messy brain into the ✨ Sparkle box and letting Gemini
sort it into structured, prioritized tasks.

## Project structure

```
starboard-app/
├── app/
│   ├── page.tsx              # Landing ⇄ Dashboard, crossfaded with Framer Motion
│   ├── layout.tsx            # Root layout, loads Chewy (logo) + Quicksand (body)
│   ├── globals.css
│   └── api/
│       ├── parse/route.ts    # POST { text } → { tasks: ParsedTask[] }
│       └── breakdown/route.ts# POST { title } → { steps: string[] }
├── components/
│   ├── Landing.tsx            # Striped background, pink folder, decorations
│   ├── Dashboard.tsx          # Minimalist task workspace
│   ├── TaskCard.tsx           # Checklist item + "✨ Break Down" on hover
│   ├── SparkleInput.tsx       # Dual-mode input: Enter-to-add / brain-dump textarea
│   ├── ReceiptExport.tsx      # "Receipt" PNG export via html-to-image
│   └── ScrapbookDecor.tsx     # Inline SVG binder clip, sewing button, star field
├── hooks/
│   └── useTasks.ts            # localStorage-backed task state (guest-first)
├── lib/
│   ├── gemini.ts               # Server-only Gemini client (never imported client-side)
│   └── types.ts
└── .env.local.example
```

No external image assets are required — the binder clip, sewing button, washi
tape, and stars are all inline SVG components in `ScrapbookDecor.tsx`, so
there's nothing to source or drop into `public/` before it runs.

## 1. Install

```bash
npx create-next-app@latest starboard-app # if starting from scratch — skip if you already have this folder
cd starboard-app
npm install
```

(This folder already has `package.json` wired up with `framer-motion`,
`@google/generative-ai`, `html-to-image`, and `lucide-react` — `npm install`
is all you need.)

## 2. Add your Gemini API key

```bash
cp .env.local.example .env.local
```

Open `.env.local` and paste in your real key:

```
GEMINI_API_KEY=your_actual_key_here
```

`.env.local` is already in `.gitignore`. Because the variable is **not**
prefixed with `NEXT_PUBLIC_`, Next.js keeps it server-only — it's read in
`lib/gemini.ts`, which is only ever imported from files under `app/api/**`
(Route Handlers), never from a Client Component. That's what keeps the key
out of the browser bundle.

Get a key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
if you don't have one yet.

## 3. Run it locally

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). Click **Start Listing**, add a
task normally, or toggle **✨ Sparkle** and paste something like:

> call the dentist tomorrow, finish the slide deck before Friday's review,
> maybe reorganize the garage this weekend

Hover a task card to reveal **✨ Break Down** for AI-generated sub-steps, and
use **Export receipt** to download the day's list as a sticky-note PNG.

## 4. Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Before clicking **Deploy**, open **Environment Variables** and add:
   - Name: `GEMINI_API_KEY`
   - Value: your real key
4. Click **Deploy**.

Because the key is set as a Vercel environment variable (not baked into the
repo), it stays private in the deployed build too.

## Notes on the two AI routes

- **`/api/parse`** — takes a raw brain-dump string, prompts
  `gemini-2.5-flash` with `responseMimeType: "application/json"`, and
  returns an array of `{ title, priority, estimated_minutes }`.
- **`/api/breakdown`** — takes one task title and returns
  `{ steps: string[] }`, 3–5 concrete sub-steps.

Both routes: validate the request body, catch a missing `GEMINI_API_KEY`
and report it as a clear 500 (rather than a confusing crash), and catch
malformed JSON from the model and report it as a 502 so the UI can show a
friendly retry message instead of hanging.
