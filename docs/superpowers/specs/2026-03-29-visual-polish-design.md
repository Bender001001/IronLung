# Visual Polish — Design Spec
**Date:** 2026-03-29
**Scope:** `src/App.jsx` — all tabs including SkillsSection and CaliWorkoutsSection
**Approach:** Layered polish (Approach B) — new style constants + full sweep
**Constraints:** Inline styles only · No new packages · No component splits · Dark scheme (#111113) stays

---

## 1. New Style Constants

Add four new constants directly below the existing `hlbl` declaration:

```js
const lbl  = {fontSize:12, fontWeight:600, color:C.tx2, textTransform:"uppercase", letterSpacing:"0.06em"};
const lbl2 = {fontSize:10, fontWeight:500, color:C.mt,  textTransform:"uppercase", letterSpacing:"0.06em"};
const card2 = {...card, border:`1px solid ${C.bd2}`};
```

**Usage rules:**
- `lbl` — section headings inside cards and panels ("Bodyweight", "Week phase", "Log a session", "Recent logs", "Weight progression", "Today's weight")
- `lbl2` — field labels above inputs ("Goal weight (lb)", "Sets", "Hold time", "Pro/Carb/Fat/Cal")
- `hlbl` — retained at 9px for column headers (PRs table, sets grid) and inline micro-labels
- `card2` — primary action cards that need slightly more visual weight than `card`

---

## 2. Typography Scale

### Page titles
- All non-logo section titles: `fontSize:20, fontWeight:700` (Body, Stats, Skills, Cali Workouts)
- IRONLOG wordmark in DaySelect: stays `fontSize:22, fontWeight:800` — it's a logo, not a heading

### Section labels
- Replace all ad-hoc inline label styles with `lbl`
- Affects: every named sub-section inside cards and panels across all tabs

### Field labels
- Replace all ad-hoc input label styles (`{color:"#666", fontSize:11}`, `{color:C.mt, fontSize:11}`, `hlbl` used as field label) with `lbl2`
- Affects: all form fields in DaySelect, Session, Fuel, Body, Skills, Cali

### Data values (big mono numbers)
- Hero stats (BW and BF% cards in Body tab): stay `fontSize:28, fontWeight:800`
- Secondary stats (session completion %, stats cards): `fontSize:20, fontWeight:700, fontFamily:mono`
- Inline data values on inputs: unchanged (16px mono)

---

## 3. Token Unification — SkillsSection & CaliWorkoutsSection

Replace all hardcoded hex in `sc` and `wc` style objects:

| Hardcoded value | Replacement |
|---|---|
| `#161616` (card backgrounds) | `C.sf` |
| `#1e1e1e` (input backgrounds) | `C.sf2` |
| `#2a2a2a` (borders) | `C.bd` |
| `#242424` (lighter borders) | `C.bd` |
| `#3a3a3a` (hover borders) | `C.bd2` |
| `#222` (back button bg) | `C.sf` |
| `#888` (back button text) | `C.mt` |
| `#666`, `#555` (description/dim text) | `C.mt` |
| `#444` (empty state text) | `C.mt` |
| `#bbb`, `#aaa` (body text) | `C.tx2` |
| `#fff` (heading text) | `C.tx` |
| Toast ok: `#1e3a1e`, `#3a6a3a`, `#6fcf6f` | `${C.gn}12`, `${C.gn}33`, `C.gn` |
| Toast err: `#3a1e1e`, `#6a3a3a`, `#f97070` | `${C.rd}12`, `${C.rd}33`, `C.rd` |
| Scale box: `#1a1a0a`, `#2a2a18` | `${C.am}08`, `${C.am}22` |
| Log row dividers: `#1e1e1e` | `C.bd` |

**Exceptions (intentional identity colors, not theme):**
- `pillYou` (blue tones) and `pillAshslay` (purple tones) — kept as-is
- `focusColor` push/pull/core accents in CaliWorkouts — kept as-is

### Input unification
- `sc.inputStyle` and `wc.inputStyle` replaced with `inpL` directly (eliminates the divergent input style)
- Back buttons in both sections unified to `btnGhost` style

---

## 4. Button & Input Polish

### Buttons
| Constant | Change |
|---|---|
| `btnP` | `fontSize:15`, add `letterSpacing:"0.02em"` |
| `btnS` | `fontSize:14, fontWeight:600` |
| `btnGhost` | `fontSize:13`, padding `"9px 16px"` |
| `sbtn` | `borderRadius:10` |

### Inputs
| Constant | Change |
|---|---|
| `inp` | padding `"11px 10px"` (was `"10px 8px"`), add `transition:"border-color 0.15s"` |
| `inpL` | same padding update, `fontSize:14` (was 16 — too large for prose/text inputs) |

---

## 5. Card & Section Separation + Spacing

### Card upgrades
- Session "Today's weight" block (the `pg` recommendation card): use `card2` instead of inline bg/border styles
- Fuel AI meal plan macro cells: add `border:\`1px solid ${C.bd}\`` to each of the 4 stat cells

### Section dividers
- CaliWorkouts list divider (`height:1, background:"#1e1e1e"`): update to `background:C.bd`
- Skills `sc.logRow` and Cali `wc.logRow` `borderBottom`: update to `\`1px solid ${C.bd}\``

### Spacing standardization
- All section page padding: `"20px 16px"` (Skills/Cali move up from `"16px"`; DaySelect/Body/Stats drop from `"24px 16px"`)
- `marginBottom` between list cards: `8px` (exercise cards, food rows, measurement rows, skill cards, cali workout cards)
- `marginBottom` between distinct card sections: `12px`
- Page title → first content gap: `marginBottom:16` everywhere

---

## What This Does NOT Change
- Color scheme — all C.* token values stay identical
- Component structure — no splits, no new files
- Supabase queries or data logic
- The IRONLOG wordmark treatment
- Person-color pills (You/Ashslay identity colors)
- Rest timer, progression logic, offline banner
- Any functionality whatsoever
