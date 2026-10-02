\# IronLog



\## What this is

Personal hypertrophy tracking app. Replaces a prior Excel system. 

Deployed on Vercel, used daily at the gym on mobile.

Ashslay also uses it for calisthenics skill tracking.



\## Tech stack

\- React (single-file architecture — everything lives in src/App.jsx)

\- Supabase (database + email/password auth, project ID: qijapjafswogmjxxsbhw). `Root` in App.jsx gates the app on a session. RLS policy `app_user_all` lets `authenticated` users in `private.app_users` (allowlist by email, checked by `private.is_app_user()`) read/write every table. Add a person: `insert into private.app_users(email) values ('...')`. Personal tables (`workout_sessions`, `workout_sets`, `session_readiness`, `meal_log`, `measurements`, `macro_targets`) have `user_id uuid default auth.uid()` and policy `own_rows` (each user sees only their own rows); everything else (programs, exercises, foods, skills, cali) is shared via `app_user_all`. Inserts don't need to set `user_id`. The `/api` functions require the user's Supabase token (`requireAppUser`).

\- Vercel (auto-deploys from GitHub on push to main)

\- Gemini API (ai-parse.js and meal-plan.js serverless functions in api/)



\## Critical constraints

\- App.jsx MUST remain a single file — do not split into components

\- Never change the dark minimal color scheme (#111113 background)

\- Never modify Supabase schema without explicit discussion

\- Never add npm packages without asking first

\- Confirm DB columns exist in Supabase before writing code that depends on them

\- SQL fixes are preferred over code changes where possible



\## Architecture patterns

\- Debounced auto-save (800ms on input + onBlur)

\- imageUrl-based muscle diagrams (no mix-blend-mode)

\- Exercise lookups use slugs, not name strings

\- Rest timers persist outside component state (survive exercise navigation)

\- weekType and key state persisted to localStorage



\## Domain context

\- Users log sets with weight and reps using double progression

\- Hit top of rep range across all sets → weight increases next session

\- Active program: APEX v2 (program\_id=2, since 2026-09-30): Lower A (Mon, stays first), Upper A, Lower B, Upper B are the core 4 days; Arms \& Delts is an optional Saturday pump day (its focus starts with "Optional", which excludes it from weekly completion %). Pre-v2 layout is backed up in the `backup` schema. 2026-10-02: Upper B now leads with Low Incline DB Press (4 sets) and adds Pec Deck after the single-arm pulldown (chest 10 -> 14 weekly sets, Chest priority HIGH); Arms & Delts adds Overhead Triceps Extension (6 biceps / 6 triceps). Prior layout in `backup.training_day_exercises_2026_10_02`.

\- Week number is derived on load: last logged session's week, +1 once you train in a new Mon-Sun calendar week (`syncWeek`)

\- "Last time" / logbook targets come from the most recent session containing each exercise, any day (`loadLast`)

\- Nutrition tracking with Gemini-powered food parsing and AI meal plans

\- "Send to IronLog" links (used by FlavorFold): `https://iron-lung-tawny.vercel.app/?add=<name>&p=<g>&c=<g>&f=<g>&kcal=<n>&servings=<n>&src=<app>`, macros per serving. `parseAddLink` / `AddFromLink` show a confirm sheet, reuse or create the food (category Meal), and log it for today

\- Body measurement logging and progressive overload management



\## Known gotchas

\- Stale closures in React event handlers can cause sets to save with 0 reps

\- Progression triggers require ALL sets to hit repMax, not average

\- Supabase new tables have RLS enabled by default. There are no `anon` policies (the app requires login): give new tables `create policy app_user_all on public.<t> for all to authenticated using (private.is_app_user()) with check (private.is_app_user())`

\- supabase-js returns `{error}` instead of throwing: check `error` on every write and throw it so the offline queue (`addPending` / `addPendingSet`) catches it

\- Writes to `workout_sets` use upsert with `onConflict: "session_id,exercise_id,set_number"`

\- PostgREST returns max 1,000 rows per request: use `fetchAll()` for anything that reads full history

\- three.js / @react-three/fiber are dynamically imported inside `make3D()`; do not add static imports of them

\- Weekly volume counts fractionally via `muscleCredits()`: 1.0 for `primary_muscle`, 0.5 for each `exercises.secondary_muscles` entry, and Upper Chest also counts toward Chest

\- Stall detection (`exposuresFromSets` / `stallCheck`): best e1RM of the last 3 non-deload sessions vs the best before them; a 3+ week gap marks it "rebuilding" instead

\- Bodyweight: one `measurements` row per day for weigh-ins; trend = 10%/day EWMA, rate = 21-day regression (`weightTrend`); maintenance estimate = avg fully-logged intake minus slope x 3,500 (`estimateMaintenance`)

\- Service worker (public/sw.js) never caches Supabase or /api responses (private per-user data); hashed /assets are cache-first, the app shell network-first. Bump CACHE when changing it. Sign-out clears caches and il_* localStorage. Offline data lives in the app's own il_* localStorage cache: program days, per-day sessions, foods, measurements, and `il_last_sets` (recent sets for every program exercise, refreshed on each online launch by `warmLastSets`, used by `buildLast` when offline)

\- Offline-first startup: `Root` trusts the stored session when a token refresh fails (no signal), and Supabase reads go through `net()` (rejects instantly when `navigator.onLine` is false, else races a timeout) so they fall back to the `il_*` cache instead of hanging on supabase-js refresh retries. Wrap new reads in `net()`; don't wrap inserts that aren't idempotent (a timed-out insert may still land), guard them with the `navigator.onLine` check instead
- Progress photos: private Storage bucket `progress-photos`, files under `<user id>/...` (storage policies check the folder), rows in `public.progress_photos` (own_rows). Images are resized client-side to 1280px JPEG before upload

\- Deload suggestion is driven by stalls (3+ stalled lifts, `computeStalls`), not the calendar. Priority carryover banner appears after 3+ sessions in a week when a HIGH-priority muscle is under its weekly minimum

\- Multiline SQL via type action strips newlines — use clipboard or REST API

\- Python3 via bash is more reliable than sed for JSX string replacements



\## What NOT to do

\- Don't split App.jsx into multiple component files

\- Don't add HIIT, cardio, or features not explicitly requested

\- Don't reformat unrelated code

\- Don't rename existing state variables or functions without asking

