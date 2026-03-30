\# IronLog



\## What this is

Personal hypertrophy tracking app. Replaces a prior Excel system. 

Deployed on Vercel, used daily at the gym on mobile.

Ashslay also uses it for calisthenics skill tracking.



\## Tech stack

\- React (single-file architecture — everything lives in src/App.jsx)

\- Supabase (database + auth, project ID: qijapjafswogmjxxsbhw)

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

\- Active program: APEX (program\_id=2), structured as Upper A/B, Lower A/B, Arms \& Delts

\- Nutrition tracking with Gemini-powered food parsing and AI meal plans

\- Body measurement logging and progressive overload management



\## Known gotchas

\- Stale closures in React event handlers can cause sets to save with 0 reps

\- Progression triggers require ALL sets to hit repMax, not average

\- Supabase new tables have RLS enabled by default — must disable for anon key

\- Multiline SQL via type action strips newlines — use clipboard or REST API

\- Python3 via bash is more reliable than sed for JSX string replacements



\## What NOT to do

\- Don't split App.jsx into multiple component files

\- Don't add HIIT, cardio, or features not explicitly requested

\- Don't reformat unrelated code

\- Don't rename existing state variables or functions without asking

