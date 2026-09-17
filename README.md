# FocusOS

[![CI](https://github.com/shankha007/focusos/actions/workflows/ci.yml/badge.svg)](https://github.com/shankha007/focusos/actions/workflows/ci.yml)

**Live at [focusos.pro](https://focusos.pro)** — no sign-up, works offline, installable as an app.

A premium, offline-first Pomodoro workspace — not just a timer, but the whole focus workflow:
plan the day, run deep-focus sessions, log what pulls you away, and get real analysis back.

Everything runs locally. Your data lives in your browser's IndexedDB, insights are computed
on-device with rule-based logic (no AI API, no account, no network), and ambient sound is
synthesized in the browser rather than downloaded.

---

## Installation

### Prerequisites

- **Node.js 18 or newer** (built and tested on v22.20.0)
- **npm 9 or newer** (comes with Node; tested on 10.9.3)

Check what you have:

```bash
node -v && npm -v
```

If Node is missing, install it from [nodejs.org](https://nodejs.org) (LTS build).

### 1. Install dependencies

From the project directory:

```bash
npm install
```

### 2. Start the dev server

```bash
npm run dev
```

Open **http://localhost:5173** in your browser. That's it — there's no database to provision, no
`.env` file, and no API keys. The app creates its local storage on first load.

`/` is the landing page; the workspace itself lives at **/dashboard**, which is also where the
installed PWA starts.

### 3. Build for production (optional)

```bash
npm run build
```

Outputs a static, deployable site to `dist/`. Preview the production build locally with:

```bash
npm run preview
```

Because it's fully static with no backend, `dist/` can be dropped on any static host
(Vercel, Netlify, GitHub Pages, S3, or your own nginx). [focusos.pro](https://focusos.pro) is
deployed on Vercel from `main`; [vercel.json](vercel.json) carries the SPA fallback, asset
caching, and security headers.

### All commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server at http://localhost:5173 |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only, no output |
| `npm test` | Run the engine unit tests (66 tests) |
| `npm run test:watch` | Tests in watch mode |

### Installing as an app (PWA)

FocusOS is a Progressive Web App. Open [focusos.pro](https://focusos.pro) (or your local dev
server) and your browser will offer an **Install** option (address-bar icon in Chrome/Edge, or
*Share → Add to Dock/Home Screen* in Safari). Installed, it opens in its own window without browser
chrome and works with no internet connection.

---

## The tabs

The app has five sections, in the left sidebar on desktop and the bottom bar on mobile.

### 🏠 Dashboard — `⌘1`

Your daily command center and the screen you'll live on.

- **Four stat cards** — sessions today (against your goal), total focus time, current streak, and
  your focus score
- **Current session card** — the live timer with start/pause, plus a jump into Deep Focus
- **Today's plan** — an auto-generated running order for your tasks, with the reasoning behind it
- **Daily reflection** — a written end-of-day debrief (see below)
- **Up next** — your top open tasks, each with a one-click start button
- **Recent activity** — a feed of completed sessions, breaks, and logged distractions

### ✅ Tasks — `⌘2`

- Create, edit, and delete tasks
- Four priority levels (low / medium / high / urgent), shown as a colored dot
- Categories (Deep Work, Writing, Learning, Admin) and free-form tags
- Session estimates with a progress bar against sessions actually completed
- **Drag to reorder** — the order drives your daily plan
- Filter by Open / Done / All, and by category

### 📊 Analytics — `⌘3`

Switchable across **Day / Week / Month / Year**.

- Summary cards: focus time, sessions, completion rate, average session, distractions per session
- **Focus over time** — an area chart of daily focus hours
- **When you focus best** — focus minutes by hour of day, with your peak hour named
- **Mood and productivity** — how your pre-session mood correlates with your post-session rating
- **Distraction patterns** — what interrupts you, how often, and *where in a session* it hits
- **Sessions per day** bar chart
- **Focus history** — a GitHub-style contribution heatmap of the past year
- **Exports** — CSV (raw sessions), JSON (full backup), PDF (formatted report)

### 🏆 Progress — `⌘4`

- **Level and XP** — earn XP per session, scaled by length, with a bonus for distraction-free ones
- **13 achievements** across bronze/silver/gold/platinum, each showing live progress
- Stats for badges earned, current and longest streak, total focus, and clean sessions

### ⚙️ Settings — `⌘,`

- **Timer** — focus, short break, and long break lengths; sessions until a long break; daily goal;
  auto-start behavior for breaks and focus
- **Appearance** — nine themes plus system matching
- **Ambient sound** — pick a soundscape, set volume, toggle the completion chime
- **Session check-ins** — turn the mood and productivity prompts on or off, and toggle adaptive
  recommendations
- **Notifications** — browser notifications when a session ends
- **Accessibility** — reduce motion and high contrast
- **Your data** — export everything, or reset it (behind a typed confirmation)

---

## Features

### Deep Focus Mode

A full-screen, distraction-free view with a large animated countdown ring, a slowly drifting
ambient background, and the current task title. It opens automatically when a session starts.

- **Picture-in-picture** — floats the timer over every other window, so it stays visible while you
  work in another app
- **Browser notifications** when a session or break ends
- **One-tap distraction logging** without leaving the screen
- **Break activities** shown during breaks, including a guided 4-7-8 breathing animation

### Adaptive engine

After roughly ten sessions, FocusOS starts reading your own history to suggest:

- **Optimal session length** — weighted toward what you actually *finish*, not just what you rate
  highly. A 60-minute session you abandon half the time is worse than a 25-minute one that lands.
- **Optimal break length** — inferred from how productive the session *after* each break was
- **Peak hours** — the three-hour window where your focus is strongest, worth defending
- **Task estimates** — adjusted by how long similar tasks actually took you
- **A daily plan** — your highest-priority work scheduled into your peak window

Every recommendation shows its reasoning and a confidence level. With thin data these are rough
guesses, and the interface says so rather than pretending otherwise.

### Daily reflection

A written debrief assembled from rules rather than a language model — so it works offline and never
invents a fact. Every sentence traces back to a number in your session log: what you accomplished,
your best focus window, what interrupted you most, and concrete suggestions for tomorrow.

### Ambient soundscapes

Eight soundscapes — **rain, forest, ocean, coffee shop, white noise, brown noise, fireplace, wind** —
all synthesized live in the browser from filtered noise and oscillators. Nothing is downloaded, so
they work offline, add nothing to the bundle, and never loop audibly.

### Session check-ins

A two-tap mood and energy check before each session, and a productivity rating plus a one-line
"what did you get done" after. These are what make the analytics and adaptive suggestions possible —
but both can be switched off in Settings if you'd rather not be prompted.

### Themes

Nine themes: **Light, Minimal White, Lavender, Dark, Midnight, AMOLED, Forest, Ocean, Sunset** —
plus **System**, which follows your OS light/dark preference automatically and switches live.

### Accessibility

Full keyboard navigation, visible focus rings, ARIA labels and live regions on the timer, a
high-contrast mode, and a reduce-motion mode. Your OS-level `prefers-reduced-motion` setting is
honored automatically, without you having to find the toggle.

---

## Keyboard shortcuts

### Anywhere

| Shortcut | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Open the command palette |
| `⌘⇧F` / `Ctrl+Shift+F` | Enter Deep Focus Mode |
| `⌘1` … `⌘4` | Dashboard / Tasks / Analytics / Progress |
| `⌘,` | Settings |

### In Deep Focus Mode

| Key | Action |
| --- | --- |
| `Space` | Start / pause |
| `N` | Skip to the next interval |
| `R` | Reset the timer |
| `D` | Log a distraction |
| `S` | Toggle the sound panel |
| `P` | Toggle picture-in-picture |
| `Esc` | Exit Deep Focus |

The **command palette** (`⌘K`) is the fastest route to anything: start a session, pick a task to
focus on, switch themes, toggle sound, or jump between tabs — all without touching the mouse.

---

## A typical workflow

Here's what an ordinary morning looks like.

**1. Add what you're working on.** Open **Tasks**, hit *New task*, and enter
"Draft the Q3 proposal". Set it to **high** priority, category *Writing*, and estimate **3
sessions**. A specific title focuses better than a vague one — "Draft intro section" beats
"writing".

**2. Check the plan.** Back on the **Dashboard**, *Today's plan* has already ordered your tasks and
slotted the proposal first, with a note explaining why — either it's high priority, or it lands in
your most productive window.

**3. Start focusing.** Click **Start focusing** (or press `⌘K` → *Focus on a task*). A quick
check-in asks how you're feeling and your energy level — two taps, and it's what makes the
mood-vs-productivity analysis work later. Hit **Start session**.

**4. Work.** Deep Focus Mode takes over the screen: a 25-minute ring counting down, your task title
above it, and ambient rain if you've turned sound on. Press `P` to float the timer over your editor
while you write.

**5. Something pulls you away.** Your phone buzzes. Press `D`, tap **Phone**, and you're back in
under two seconds. FocusOS records not just *what* interrupted you but *how far into the session* it
happened — that's how it later tells you things like "your phone tends to get you 60% of the way in".

**6. The session ends.** A chime plays and a notification fires. You're asked how productive that
felt and what you got done — "Finished the problem statement and two of three case studies". A
5-minute break auto-starts, suggesting you look at something 20 feet away for 20 seconds.

**7. Repeat.** After four focus sessions, FocusOS gives you a 15-minute long break instead and
suggests actually getting up and walking.

**8. Wind down.** By evening the **Dashboard** shows 6 sessions, 2h 30m of focus, a 4-day streak,
and a focus score of 78. The **daily reflection** reads back something like:

> *Solid day — 2h 30m of focused work. You completed 6 of 7 sessions you started. That clears your
> goal of 6 sessions. You rated these sessions 4.2/5 — you were in a good groove. 9am–10am was your
> deepest stretch. Phone pulled you away 4 times — 57% of today's interruptions.
> **For tomorrow:** leave your phone in another room for your first session, and schedule your
> hardest task at 9am.*

**9. Over weeks.** Once you've got history, **Analytics** fills in — your contribution heatmap, the
hours you actually work best, which moods predict good sessions — and the adaptive engine starts
tuning your session length to what you genuinely finish rather than what you optimistically planned.

---

## Architecture

```
src/
  engine/      Pure, testable logic — no React. Timer math, adaptive
               recommendations, analytics rollups, reflection, achievements.
  db/          Dexie (IndexedDB) schema + repositories
  store/       Zustand slices (orchestration only)
  features/    dashboard · focus · tasks · analytics · achievements · settings
  components/  Shared UI primitives
  hooks/       Timer tick, hotkeys, picture-in-picture, session start
  themes/      Theme tokens as CSS custom properties
```

`engine/` operates on plain data and holds all the real logic, which is why it can be unit-tested
without a DOM. Stores orchestrate; components render.

**On the timer:** it never counts down by accumulating ticks. Intervals drift, and browsers throttle
or suspend them in background tabs — a tick-counting timer silently loses minutes. Instead the state
is `startedAt` + `durationMs` + accumulated pause time, and every reading derives from `Date.now()`.
Ticks only drive repaints. A session survives a refresh, a sleeping tab, or a closed laptop with its
real remaining time intact.

**Stack:** React 18 · TypeScript (strict) · Vite · Tailwind CSS · Radix UI · Zustand · Framer Motion
· Dexie · Recharts · jsPDF · Web Audio API · vite-plugin-pwa

---

## Branching

Work lands on **`uat`** first, and reaches **`main`** only through a pull request — `main` is what
[focusos.pro](https://focusos.pro) deploys. CI runs on both branches.

GitHub branch protection would enforce this, but it needs GitHub Pro on a private repository, so
two lighter guards stand in for it:

- **A pre-push hook** refuses a push straight to `main`. Hooks are not installed by cloning, so turn
  it on once per clone:

  ```bash
  git config core.hooksPath .githooks
  ```

  To push to `main` deliberately — restoring it after a bad merge, say — prefix the push with
  `FOCUSOS_ALLOW_MAIN_PUSH=1`.

- **The [Guard main](.github/workflows/guard-main.yml) workflow** fails whenever a commit reaches
  `main` without a merged pull request. It cannot prevent the push, only make it impossible to miss.

## Your data

Everything stays in this browser. Nothing is sent anywhere, there's no account, and there's no
telemetry.

That does mean your history is tied to this browser on this device. To move it, use
**Settings → Export everything** for a full JSON backup. Clearing your browser's site data will
erase it, so export periodically if the history matters to you.

## Not included

Cloud sync and music-service integrations (Spotify and similar) are deliberately out of scope in
this build — both require a backend and OAuth credentials. The JSON export covers moving your
history between devices.
