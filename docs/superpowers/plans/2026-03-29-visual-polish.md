# Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a layered visual polish to App.jsx — type scale, token unification, button/input polish, card separation, and spacing consistency — without changing any functionality.

**Architecture:** All changes are in `src/App.jsx` (single-file constraint). New style constants (`lbl`, `lbl2`, `card2`) are added near the top and referenced throughout. SkillsSection and CaliWorkoutsSection local style objects (`sc`, `wc`) are migrated to `C.*` tokens and unified inputs. No logic, data, or component structure changes.

**Tech Stack:** React 18, inline styles, Supabase, Vite

---

## Files

- Modify: `src/App.jsx` (all changes in this one file)

---

### Task 1: Add new style constants

**Files:**
- Modify: `src/App.jsx` (line 23, after `hlbl`)

- [ ] **Step 1: Add `lbl`, `lbl2`, `card2` after the `hlbl` line**

Find this line (line 23):
```js
const hlbl={fontSize:9,fontWeight:600,color:C.mt,textTransform:"uppercase",letterSpacing:"0.08em"};
```

Replace with:
```js
const hlbl={fontSize:9,fontWeight:600,color:C.mt,textTransform:"uppercase",letterSpacing:"0.08em"};
const lbl={fontSize:12,fontWeight:600,color:C.tx2,textTransform:"uppercase",letterSpacing:"0.06em"};
const lbl2={fontSize:10,fontWeight:500,color:C.mt,textTransform:"uppercase",letterSpacing:"0.06em"};
const card2={...card,border:`1px solid ${C.bd2}`};
```

- [ ] **Step 2: Verify diff**

```bash
git diff src/App.jsx | head -30
```

Expected: 3 new `const` lines after `hlbl`, nothing else changed.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "style: add lbl, lbl2, card2 constants"
```

---

### Task 2: Update global style constants

**Files:**
- Modify: `src/App.jsx` (lines 15–21)

- [ ] **Step 1: Replace `inp`, `inpL`, `sbtn`, `btnP`, `btnS`, `btnGhost`**

Find and replace these 6 lines (lines 15–21):

```js
const inp={width:"100%",padding:"10px 8px",background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,color:C.tx,fontSize:16,fontFamily:mono,fontWeight:500,outline:"none",textAlign:"center",boxSizing:"border-box"};
const inpL={...inp,textAlign:"left",paddingLeft:12,fontSize:16};
const sbtn={background:C.sf,border:`1px solid ${C.bd}`,borderRadius:8,color:C.mt,fontSize:14,cursor:"pointer",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0};
const tbtn={background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:6,color:C.mt,fontSize:14,cursor:"pointer",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center"};
const btnP={width:"100%",padding:"12px",background:C.ac,border:"none",borderRadius:10,color:C.bg,fontSize:14,fontWeight:700,cursor:"pointer"};
const btnS={width:"100%",padding:"11px",background:`${C.ac}12`,border:`1px solid ${C.ac}30`,borderRadius:10,color:C.ac,fontSize:13,fontWeight:600,cursor:"pointer"};
const btnGhost={padding:"8px 14px",background:C.sf,border:`1px solid ${C.bd}`,borderRadius:8,color:C.mt,fontSize:12,fontWeight:500,cursor:"pointer"};
```

Replace with:
```js
const inp={width:"100%",padding:"11px 10px",background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,color:C.tx,fontSize:16,fontFamily:mono,fontWeight:500,outline:"none",textAlign:"center",boxSizing:"border-box",transition:"border-color 0.15s"};
const inpL={...inp,textAlign:"left",paddingLeft:12,fontSize:14};
const sbtn={background:C.sf,border:`1px solid ${C.bd}`,borderRadius:10,color:C.mt,fontSize:14,cursor:"pointer",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0};
const tbtn={background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:6,color:C.mt,fontSize:14,cursor:"pointer",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center"};
const btnP={width:"100%",padding:"12px",background:C.ac,border:"none",borderRadius:10,color:C.bg,fontSize:15,fontWeight:700,cursor:"pointer",letterSpacing:"0.02em"};
const btnS={width:"100%",padding:"11px",background:`${C.ac}12`,border:`1px solid ${C.ac}30`,borderRadius:10,color:C.ac,fontSize:14,fontWeight:600,cursor:"pointer"};
const btnGhost={padding:"9px 16px",background:C.sf,border:`1px solid ${C.bd}`,borderRadius:8,color:C.mt,fontSize:13,fontWeight:500,cursor:"pointer"};
```

- [ ] **Step 2: Verify diff**

```bash
git diff src/App.jsx
```

Expected: 7 lines changed, only the constants listed above. `tbtn` is unchanged (no diff on that line).

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "style: polish global button and input constants"
```

---

### Task 3: SkillsSection — token unification + typography

**Files:**
- Modify: `src/App.jsx` (lines 166–187, the `sc` object, plus JSX at lines 189–296)

- [ ] **Step 1: Replace the `sc` style object**

Find the entire `sc` object (starts `const sc = {`, ends `};` before `if (view === 'list')`). Replace with:

```js
const sc={
  page:{padding:"20px 16px",maxWidth:600,margin:"0 auto"},
  toast:{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:"10px 20px",borderRadius:8,fontSize:13,fontWeight:600,whiteSpace:"nowrap"},
  toastOk:{background:`${C.gn}12`,border:`1px solid ${C.gn}33`,color:C.gn},
  toastErr:{background:`${C.rd}12`,border:`1px solid ${C.rd}33`,color:C.rd},
  exCard:{background:C.sf,border:`1px solid ${C.bd}`,borderRadius:10,padding:"14px 16px",marginBottom:8,cursor:"pointer",transition:"border-color 0.15s"},
  pill:{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,marginRight:6},
  pillYou:{background:"#0d1e33",color:"#7ab8f5",border:"1px solid #1a3a5c"},
  pillAshslay:{background:"#1e0d2e",color:"#c9a0dc",border:"1px solid #3c1a5c"},
  btn:{padding:"8px 16px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:600},
  stageBlock:{background:C.sf,border:`1px solid ${C.bd}`,borderRadius:10,padding:"14px 16px",marginBottom:12},
  instructions:{color:C.tx2,fontSize:12,lineHeight:1.7,marginTop:10,paddingTop:10,borderTop:`1px solid ${C.bd}`},
  progressBanner:{background:`${C.gn}08`,border:`1px solid ${C.gn}22`,borderRadius:8,padding:"12px 14px",marginBottom:10},
  logBox:{background:C.sf,border:`1px solid ${C.bd}`,borderRadius:10,padding:"14px 16px",marginBottom:16},
  logRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.bd}`},
  empty:{color:C.mt,fontSize:13,textAlign:"center",padding:"32px 0"},
};
```

- [ ] **Step 2: Update JSX in SkillsSection list view**

Find:
```jsx
<div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Skills</div>
```
Replace with:
```jsx
<div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Skills</div>
```
(format only, value unchanged)

Find the exercise card title:
```jsx
<div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{ex.name}</div>
<div style={{ color: '#666', fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>{ex.description}</div>
```
Replace with:
```jsx
<div style={{color:C.tx,fontSize:14,fontWeight:600,marginBottom:4}}>{ex.name}</div>
{ex.description&&<div style={{color:C.mt,fontSize:12,lineHeight:1.5,marginBottom:8}}>{ex.description}</div>}
```

- [ ] **Step 3: Update JSX in SkillsSection detail view**

Find the section label:
```jsx
<div style={sc.sectionLabel}>{person}</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:8}}>{person}</div>
```

Find the back button:
```jsx
<button style={{ ...sc.btn, ...sc.btnBack }} onClick={() => setView('list')}>← Back</button>
```
Replace with:
```jsx
<button style={btnGhost} onClick={()=>setView('list')}>← Back</button>
```

Find the exercise title inside stageBlock:
```jsx
<div style={{ fontSize: 13, fontWeight: 700, color: nameColor, marginBottom: 3 }}>Stage {stage.stage_number} — {stage.name}</div>
<div style={{ color: '#555', fontSize: 12 }}>Target: {stage.target_value} {stage.target_unit} × {stage.target_sets} sets</div>
```
Replace with:
```jsx
<div style={{fontSize:13,fontWeight:700,color:nameColor,marginBottom:3}}>Stage {stage.stage_number} — {stage.name}</div>
<div style={{color:C.mt,fontSize:12}}>Target: {stage.target_value} {stage.target_unit} × {stage.target_sets} sets</div>
```

Find the "How to" toggle button:
```jsx
<button style={{ ...sc.btn, ...sc.btnGhost }} onClick={...}>
```
Replace with:
```jsx
<button style={btnGhost} onClick={...}>
```

Find the progress banner content:
```jsx
<div style={{ color: '#6fcf6f', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>✓ Target hit — ready to level up</div>
<div style={{ color: '#888', fontSize: 12, marginBottom: 10 }}>Next: <span style={{ color: '#ddd' }}>{next.name}</span></div>
<button onClick={() => advanceStage(person)} style={{ ...sc.btn, background: '#1a3a1a', color: '#6fcf6f', fontSize: 12, padding: '7px 14px' }}>Advance →</button>
```
Replace with:
```jsx
<div style={{color:C.gn,fontSize:12,fontWeight:700,marginBottom:4}}>✓ Target hit — ready to level up</div>
<div style={{color:C.mt,fontSize:12,marginBottom:10}}>Next: <span style={{color:C.tx}}>{next.name}</span></div>
<button onClick={()=>advanceStage(person)} style={{...sc.btn,background:`${C.gn}14`,color:C.gn,border:`1px solid ${C.gn}33`,fontSize:12,padding:"7px 14px"}}>Advance →</button>
```

Find the final stage banner:
```jsx
<div style={{ ...sc.progressBanner, background: '#1a1a0a', borderColor: '#3a3a1a' }}><div style={{ color: '#f5c842', fontSize: 12, fontWeight: 700 }}>🏆 Final stage</div></div>
```
Replace with:
```jsx
<div style={{background:`${C.am}08`,border:`1px solid ${C.am}22`,borderRadius:8,padding:"12px 14px",marginBottom:10}}><div style={{color:C.am,fontSize:12,fontWeight:700}}>Final stage</div></div>
```

- [ ] **Step 4: Update log form in SkillsSection**

Find the "Log a session" label:
```jsx
<div style={{ ...sc.sectionLabel, marginBottom: 14 }}>Log a session</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:14}}>Log a session</div>
```

Find the current stage hint line:
```jsx
<div style={{ color: '#444', fontSize: 11, marginBottom: 12 }}>Stage {s.stage_number}...
```
Replace with:
```jsx
<div style={{color:C.mt,fontSize:11,marginBottom:12}}>Stage {s.stage_number}...
```

Find the two input label divs ("Hold time (sec)" / "Reps" and "Sets"):
```jsx
<div style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>{...}</div>
<div style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>Sets</div>
```
Replace each with:
```jsx
<div style={{...lbl2,marginBottom:4}}>{...}</div>
<div style={{...lbl2,marginBottom:4}}>Sets</div>
```

Find both `sc.inputStyle` usages and replace with `inpL`:
```jsx
style={sc.inputStyle}
```
→
```jsx
style={inpL}
```
(two occurrences — the value input and notes input)

Find the Log Session button:
```jsx
style={{ ...sc.btn, width: '100%', background: saving || !logForm.value ? '#1a1a1a' : '#1a3a1a', color: saving || !logForm.value ? '#444' : '#6fcf6f', border: `1px solid ${saving || !logForm.value ? '#2a2a2a' : '#2a4a2a'}` }}
```
Replace with:
```jsx
style={{...btnS,background:saving||!logForm.value?C.sf2:`${C.gn}12`,color:saving||!logForm.value?C.mt:C.gn,border:`1px solid ${saving||!logForm.value?C.bd:`${C.gn}33`}`}}
```

Find "Recent logs" label:
```jsx
<div style={sc.sectionLabel}>Recent logs</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:8}}>Recent logs</div>
```

- [ ] **Step 5: Verify diff is confined to SkillsSection**

```bash
git diff src/App.jsx
```

Confirm all changes are between lines 91 and 297. No functional logic changed.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "style: unify SkillsSection to C.* tokens and apply type scale"
```

---

### Task 4: CaliWorkoutsSection — token unification + typography

**Files:**
- Modify: `src/App.jsx` (lines 344–362, the `wc` object, plus JSX at lines 364–463)

- [ ] **Step 1: Replace the `wc` style object**

Find the entire `wc` object. Replace with:

```js
const wc={
  page:{padding:"20px 16px",maxWidth:600,margin:"0 auto"},
  toast:{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:"10px 20px",borderRadius:8,fontSize:13,fontWeight:600,whiteSpace:"nowrap"},
  toastOk:{background:`${C.gn}12`,border:`1px solid ${C.gn}33`,color:C.gn},
  toastErr:{background:`${C.rd}12`,border:`1px solid ${C.rd}33`,color:C.rd},
  card:{background:C.sf,border:`1px solid ${C.bd}`,borderRadius:10,padding:"14px 16px",marginBottom:8,cursor:"pointer",transition:"border-color 0.15s"},
  pill:{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700},
  btn:{padding:"8px 16px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:600},
  exCard:{background:C.sf,border:`1px solid ${C.bd}`,borderRadius:9,padding:"13px 15px",marginBottom:8},
  exNotes:{color:C.tx2,fontSize:12,lineHeight:1.65,marginTop:9,paddingTop:9,borderTop:`1px solid ${C.bd}`},
  scaledBox:{background:`${C.am}08`,border:`1px solid ${C.am}22`,borderRadius:6,padding:"9px 12px",marginTop:8},
  logBox:{background:C.sf,border:`1px solid ${C.bd}`,borderRadius:10,padding:"14px 16px",marginTop:8,marginBottom:16},
  personBtn:(active,isYou)=>({flex:1,padding:"8px",borderRadius:7,cursor:"pointer",fontSize:13,fontWeight:600,border:`1px solid ${active?(isYou?"#1a3a5c":"#3c1a5c"):C.bd}`,background:active?(isYou?"#0d1e33":"#1e0d2e"):C.sf2,color:active?(isYou?"#7ab8f5":"#c9a0dc"):C.mt}),
  logRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.bd}`},
  empty:{color:C.mt,fontSize:13,textAlign:"center",padding:"32px 0"},
};
```

- [ ] **Step 2: Update list view JSX**

Find the page title and subtitle:
```jsx
<div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Cali Workouts</div>
<div style={{ color: '#444', fontSize: 12, marginBottom: 16 }}>Push → Pull → Core → repeat. 20–25 min each.</div>
```
Replace with:
```jsx
<div style={{fontSize:20,fontWeight:700,marginBottom:6}}>Cali Workouts</div>
<div style={{color:C.mt,fontSize:12,marginBottom:16}}>Push → Pull → Core → repeat. 20–25 min each.</div>
```

Find workout card content:
```jsx
<div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{t.name}</div>
<div style={{ color: '#666', fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>{t.description}</div>
```
Replace with:
```jsx
<div style={{color:C.tx,fontSize:15,fontWeight:700,marginBottom:4}}>{t.name}</div>
<div style={{color:C.mt,fontSize:12,lineHeight:1.5,marginBottom:8}}>{t.description}</div>
```

Find "You — date" and "Ashslay — date" spans:
```jsx
{youLast && <span style={{ color: '#7ab8f5', fontSize: 11 }}>You — {youLast}</span>}
{AshslayLast && <span style={{ color: '#c9a0dc', fontSize: 11 }}>Ashslay — {AshslayLast}</span>}
{!youLast && !AshslayLast && <span style={{ color: '#333', fontSize: 11 }}>Not done yet</span>}
```
Replace with:
```jsx
{youLast&&<span style={{color:"#7ab8f5",fontSize:11}}>You — {youLast}</span>}
{AshslayLast&&<span style={{color:"#c9a0dc",fontSize:11}}>Ashslay — {AshslayLast}</span>}
{!youLast&&!AshslayLast&&<span style={{color:C.mt,fontSize:11}}>Not done yet</span>}
```

Find the section divider before "Recent sessions":
```jsx
<div style={{ height: 1, background: '#1e1e1e', margin: '16px 0' }} />
<div style={wc.lbl}>Recent sessions</div>
```
Replace with:
```jsx
<div style={{height:1,background:C.bd,margin:"16px 0"}}/>
<div style={{...lbl,marginBottom:8}}>Recent sessions</div>
```

Find log row date text:
```jsx
<div style={{ color: '#444', fontSize: 11 }}>{l.logged_date}</div>
```
Replace with:
```jsx
<div style={{color:C.mt,fontSize:11}}>{l.logged_date}</div>
```

- [ ] **Step 3: Update detail view JSX**

Find the back button:
```jsx
<button style={{ ...wc.btn, ...wc.btnBack }} onClick={() => setView('list')}>← Back</button>
```
Replace with:
```jsx
<button style={btnGhost} onClick={()=>setView('list')}>← Back</button>
```

Find the description text:
```jsx
<div style={{ color: '#555', fontSize: 12, marginBottom: 16 }}>{selected.description}</div>
```
Replace with:
```jsx
<div style={{color:C.mt,fontSize:12,marginBottom:16}}>{selected.description}</div>
```

Find exercise card titles (warmup/normal/last):
```jsx
<div style={{ color: isWarmup || isLast ? '#666' : '#fff', fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{i + 1}. {ex.name}</div>
<div style={{ color: '#555', fontSize: 12 }}>{ex.sets} sets · ...</div>
```
Replace with:
```jsx
<div style={{color:isWarmup||isLast?C.mt:C.tx,fontSize:13,fontWeight:700,marginBottom:3}}>{i+1}. {ex.name}</div>
<div style={{color:C.mt,fontSize:12}}>{ex.sets} sets · ...</div>
```

Find the Scale button:
```jsx
style={{ ...wc.btn, padding: '4px 10px', fontSize: 11, background: scaled ? '#1a1a0a' : '#1e1e1e', color: scaled ? '#c8a84b' : '#555', border: `1px solid ${scaled ? '#2a2a18' : '#2a2a2a'}` }}
```
Replace with:
```jsx
style={{...btnGhost,padding:"4px 10px",fontSize:11,background:scaled?`${C.am}08`:C.sf2,color:scaled?C.am:C.mt,borderColor:scaled?`${C.am}22`:C.bd}}
```

Find the SCALING OPTIONS label:
```jsx
<div style={{ color: '#c8a84b', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>SCALING OPTIONS</div>
<div style={{ color: '#bbb', fontSize: 12, lineHeight: 1.6 }}>{ex.scaled_notes}</div>
```
Replace with:
```jsx
<div style={{...lbl2,color:C.am,marginBottom:4}}>Scaling options</div>
<div style={{color:C.tx2,fontSize:12,lineHeight:1.6}}>{ex.scaled_notes}</div>
```

- [ ] **Step 4: Update log form in CaliWorkoutsSection**

Find "Log this workout" label:
```jsx
<div style={{ ...wc.lbl, marginBottom: 14 }}>Log this workout</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:14}}>Log this workout</div>
```

Find `wc.inputStyle` on the notes input:
```jsx
style={wc.inputStyle}
```
Replace with:
```jsx
style={{...inpL,marginBottom:10}}
```

Find the Log button:
```jsx
style={{ ...wc.btn, width: '100%', background: logging ? '#1a1a1a' : '#1a3a1a', color: logging ? '#444' : '#6fcf6f', border: `1px solid ${logging ? '#2a2a2a' : '#2a4a2a'}` }}
```
Replace with:
```jsx
style={{...btnS,background:logging?C.sf2:`${C.gn}12`,color:logging?C.mt:C.gn,border:`1px solid ${logging?C.bd:`${C.gn}33`}`}}
```

- [ ] **Step 5: Verify diff**

```bash
git diff src/App.jsx
```

Confirm all changes are between lines 299 and 464. No functional logic changed.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "style: unify CaliWorkoutsSection to C.* tokens and apply type scale"
```

---

### Task 5: DaySelect — typography + spacing

**Files:**
- Modify: `src/App.jsx` (lines 594–807, the `DaySelect` function)

- [ ] **Step 1: Fix page padding**

Find:
```jsx
<div style={{padding:"24px 16px"}}>
```
(the outermost div of DaySelect)

Replace with:
```jsx
<div style={{padding:"20px 16px"}}>
```

- [ ] **Step 2: Apply `lbl` to section headings inside cards**

Find (inside the config card, week phase section):
```jsx
<div style={{...hlbl,marginBottom:10}}>Week phase</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:10}}>Week phase</div>
```

Find (rest timer section):
```jsx
<div style={{...hlbl,marginBottom:10}}>Rest timer</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:10}}>Rest timer</div>
```

Find (week recap card title):
```jsx
<div style={{...hlbl,marginBottom:12}}>Week {week} recap — {PROGRAMS.find(p=>p.id===activeProgram)?.name}</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:12}}>Week {week} recap — {PROGRAMS.find(p=>p.id===activeProgram)?.name}</div>
```

Find (volume by muscle label):
```jsx
<div style={{...hlbl,marginBottom:7}}>Volume by muscle</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:7}}>Volume by muscle</div>
```

- [ ] **Step 3: Apply `lbl` to bodyweight section heading and `lbl2` to field labels**

Find (bodyweight card label):
```jsx
<div style={{...hlbl,marginBottom:3}}>Bodyweight</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:3}}>Bodyweight</div>
```

Find (cut progress label):
```jsx
<span style={{...hlbl,color:C.ac}}>Cut progress</span>
```
Replace with:
```jsx
<span style={{...lbl,color:C.ac}}>Cut progress</span>
```

Find (Set your goal label):
```jsx
<div style={{...hlbl,marginBottom:8,color:C.ac}}>Set your goal</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:8,color:C.ac}}>Set your goal</div>
```

Find (goal weight and goal BF% field labels, two instances):
```jsx
<div style={{...hlbl,marginBottom:4}}>Goal weight (lb)</div>
...
<div style={{...hlbl,marginBottom:4}}>Goal BF%</div>
```
Replace each with:
```jsx
<div style={{...lbl2,marginBottom:4}}>Goal weight (lb)</div>
...
<div style={{...lbl2,marginBottom:4}}>Goal BF%</div>
```

- [ ] **Step 4: Standardize card `marginBottom` in DaySelect**

All top-level cards in DaySelect (bodyweight card, cut progress card, deload nudge card, config card, week recap card) should use `marginBottom:12`. Scan for `marginBottom:14` and `marginBottom:16` on these cards and update to `marginBottom:12`.

Specific instances:
```jsx
// Bodyweight card
<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,...}}
```
→ `marginBottom:12`

```jsx
// Cut progress card
<div style={{background:C.sf,border:...,borderRadius:10,padding:"10px 14px",marginBottom:14}}>
```
→ `marginBottom:12`

```jsx
// Deload nudge card
<div style={{...,...,marginBottom:14,...}}>
```
→ `marginBottom:12`

```jsx
// Config card (showCfg)
<div style={{...card,marginBottom:14}}>
```
→ `<div style={{...card,marginBottom:12}}>`

```jsx
// Week recap card (showSum)
<div style={{...card,marginBottom:14}}>
```
→ `<div style={{...card,marginBottom:12}}>`

- [ ] **Step 5: Fix page title → content gap**

Find the week phase pill + progress bar row:
```jsx
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
```
Replace with:
```jsx
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
```

- [ ] **Step 6: Verify diff**

```bash
git diff src/App.jsx
```

Confirm changes are in DaySelect (lines ~594–807). No logic changed.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "style: DaySelect typography and spacing polish"
```

---

### Task 6: Session — typography + card2

**Files:**
- Modify: `src/App.jsx` (lines 809–990, the `Session` function)

- [ ] **Step 1: Apply `lbl` and `lbl2` to section labels**

Find the sets grid column headers:
```jsx
<div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>{["Set","Weight","Reps",""].map(h=><span key={h} style={hlbl}>{h}</span>)}</div>
```
These are column headers — `hlbl` (9px) is correct. No change needed here.

Find "Today's weight" label inside the `pg` recommendation block:
```jsx
<div style={{...hlbl,marginBottom:4}}>Today's weight</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:4}}>Today's weight</div>
```

Find "Weight progression" label in history block:
```jsx
<div style={{...hlbl,marginBottom:8}}>Weight progression</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:8}}>Weight progression</div>
```

- [ ] **Step 2: Apply `card2` to the "Today's weight" recommendation block**

Find the `pg` block wrapper (inside `isE` expanded section):
```jsx
<div style={{padding:"10px 12px",marginBottom:10,background:pg.deload?`${C.am}08`:pg.up?`${C.gn}08`:C.sf2,border:`1px solid ${pg.deload?`${C.am}22`:pg.up?`${C.gn}22`:C.bd}`,borderRadius:10}}>
```
Replace with:
```jsx
<div style={{...card2,marginBottom:10,background:pg.deload?`${C.am}08`:pg.up?`${C.gn}08`:C.sf2,borderColor:pg.deload?`${C.am}44`:pg.up?`${C.gn}44`:C.bd2}}>
```

- [ ] **Step 3: Verify diff**

```bash
git diff src/App.jsx
```

Confirm all changes are in Session (lines ~809–990).

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "style: Session typography and card2 for weight recommendation block"
```

---

### Task 7: Fuel — typography

**Files:**
- Modify: `src/App.jsx` (the `Fuel` function, lines ~990–1055)

- [ ] **Step 1: Apply `lbl` to section labels**

Find "Today" label:
```jsx
<div style={{...hlbl,marginBottom:8}}>Today</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:8}}>Today</div>
```

Find "Custom food" label:
```jsx
<div style={{...hlbl,marginBottom:10}}>Custom food</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:10}}>Custom food</div>
```

Find "AI meal plan" label:
```jsx
<span style={{...hlbl,color:C.ac}}>AI meal plan</span>
```
Replace with:
```jsx
<span style={{...lbl,color:C.ac}}>AI meal plan</span>
```

- [ ] **Step 2: Apply `lbl2` to macro field labels (Pro/Carb/Fat/Cal)**

Find in the custom food form:
```jsx
{[{k:"protein_g",l:"Pro"},{k:"carbs_g",l:"Carb"},{k:"fat_g",l:"Fat"},{k:"calories",l:"Cal"}].map(f=><div key={f.k}><div style={{...hlbl,marginBottom:3}}>{f.l}</div>...
```
Replace `{...hlbl,marginBottom:3}` with `{...lbl2,marginBottom:3}`.

- [ ] **Step 3: Add border to AI meal plan macro cells**

Find the macro cell style in the plan display (the 4-column grid with Pro/Carb/Fat/Cal):
```jsx
<div key={m.l} style={{background:C.sf2,borderRadius:8,padding:"8px 4px",textAlign:"center"}}>
```
Replace with:
```jsx
<div key={m.l} style={{background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,padding:"8px 4px",textAlign:"center"}}>
```

- [ ] **Step 4: Apply `lbl` to meal plan slot labels (breakfast/lunch/dinner/snacks)**

Find:
```jsx
<div style={{...hlbl,marginBottom:5,color:slotColors[slot],textTransform:"capitalize"}}>{slot}</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:5,color:slotColors[slot],textTransform:"capitalize"}}>{slot}</div>
```

- [ ] **Step 5: Verify diff**

```bash
git diff src/App.jsx
```

Confirm changes are in Fuel function only.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "style: Fuel typography and AI meal plan macro cell borders"
```

---

### Task 8: Body — typography + spacing

**Files:**
- Modify: `src/App.jsx` (the `Body` function, lines ~1055–1130)

- [ ] **Step 1: Fix page padding and title gap**

Find:
```jsx
<div style={{padding:"24px 16px"}}>
  <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Body</div>
```
Replace with:
```jsx
<div style={{padding:"20px 16px"}}>
  <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Body</div>
```

- [ ] **Step 2: Apply `lbl` to card section labels**

Find (bodyweight card):
```jsx
<div style={{...hlbl,marginBottom:6}}>Bodyweight</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:6}}>Bodyweight</div>
```

Find (body fat card):
```jsx
<div style={{...hlbl,marginBottom:6}}>Body fat</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:6}}>Body fat</div>
```

Find (lean mass card):
```jsx
<div style={{...hlbl,marginBottom:4,color:C.gn}}>Lean mass</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:4,color:C.gn}}>Lean mass</div>
```

Find (measurements card):
```jsx
<div style={{...hlbl,marginBottom:12}}>Measurements</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:12}}>Measurements</div>
```

Find (history label):
```jsx
<div style={{...hlbl,marginBottom:8}}>History</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:8}}>History</div>
```

- [ ] **Step 3: Apply `lbl2` to measurement grid field labels**

Find in measurements grid:
```jsx
<div style={{fontSize:8,color:C.mt,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.l}</div>
```
Replace with:
```jsx
<div style={lbl2}>{s.l}</div>
```

- [ ] **Step 4: Standardize card `marginBottom` to 8px for measurement rows**

Find history row cards:
```jsx
<div key={m.id} style={{background:C.sf,borderRadius:10,border:`1px solid ${C.bd}`,padding:"10px 14px",marginBottom:5,...}}>
```
Replace `marginBottom:5` with `marginBottom:8`.

- [ ] **Step 5: Verify diff**

```bash
git diff src/App.jsx
```

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "style: Body typography and spacing polish"
```

---

### Task 9: Stats — typography + spacing

**Files:**
- Modify: `src/App.jsx` (the `Stats` function, lines ~1130–1201)

- [ ] **Step 1: Fix page padding**

Find the outermost div of Stats:
```jsx
<div style={{padding:"24px 16px"}}>
```
Replace with:
```jsx
<div style={{padding:"20px 16px"}}>
```

- [ ] **Step 2: Apply `lbl` to section labels**

Find (top E1RM card):
```jsx
<div style={{...hlbl,color:C.gn,marginBottom:5}}>Top E1RM</div>
```
Replace with:
```jsx
<div style={{...lbl,color:C.gn,marginBottom:5}}>Top E1RM</div>
```

Find (heaviest set card):
```jsx
<div style={{...hlbl,color:C.ac,marginBottom:5}}>Heaviest set</div>
```
Replace with:
```jsx
<div style={{...lbl,color:C.ac,marginBottom:5}}>Heaviest set</div>
```

Find (volume section):
```jsx
<div style={{...hlbl,marginBottom:12}}>Sets vs target — W{week}</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:12}}>Sets vs target — W{week}</div>
```

Find (bodyweight trend label):
```jsx
<div style={{...hlbl}}>Bodyweight trend</div>
```
Replace with:
```jsx
<div style={lbl}>Bodyweight trend</div>
```

Find (body fat trend label):
```jsx
<div style={hlbl}>Body fat trend</div>
```
Replace with:
```jsx
<div style={lbl}>Body fat trend</div>
```

Find (muscle trend label):
```jsx
<div style={{...hlbl,marginBottom:10}}>Max weight by muscle — all weeks</div>
```
Replace with:
```jsx
<div style={{...lbl,marginBottom:10}}>Max weight by muscle — all weeks</div>
```

- [ ] **Step 3: Bump secondary stat values to 20px**

Find the stats card values (Top E1RM and Heaviest set):
```jsx
<div style={{fontSize:18,fontWeight:700,fontFamily:mono,color:C.gn}}>{Math.round(topPR.est1rm)}...
<div style={{fontSize:18,fontWeight:700,fontFamily:mono,color:C.ac}}>{topRaw.weight}...
```
Replace both `fontSize:18` with `fontSize:20`.

Find (PRs table column headers — these stay as `hlbl`):
```jsx
{["Exercise","Best","Reps","E1RM"].map(h=><div key={h} style={hlbl}>{h}</div>)}
```
No change — `hlbl` is correct for column headers.

- [ ] **Step 4: Verify diff**

```bash
git diff src/App.jsx
```

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "style: Stats typography polish"
```

---

### Task 10: Final verification pass

**Files:**
- Modify: `src/App.jsx` (any remaining hardcoded hex or inconsistent styles missed in earlier tasks)

- [ ] **Step 1: Scan for remaining hardcoded hex**

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" src/App.jsx | grep -v "C\." | grep -v "pillYou\|pillAshslay\|pillYou\|focusColor\|7ab8f5\|c9a0dc\|0d1e33\|1e0d2e\|1a3a5c\|3c1a5c\|bf5b9b\|a07aff\|5bc4a8\|ff7aaa\|ff9f5b"
```

Review the output. Any remaining hardcoded hex outside the intentional identity-color exceptions should be replaced with the nearest `C.*` token.

- [ ] **Step 2: Scan for remaining `hlbl` used as field label**

```bash
grep -n "hlbl" src/App.jsx
```

Review each instance. If `hlbl` appears on a label above an input or on a named section, replace with `lbl` or `lbl2` as appropriate. Column headers and micro-labels keep `hlbl`.

- [ ] **Step 3: Verify the app builds**

```bash
cd C:/Users/alexo/IronLung && npm run build 2>&1 | tail -20
```

Expected: build completes with no errors.

- [ ] **Step 4: Commit any fixes, then push**

```bash
git add src/App.jsx
git commit -m "style: final visual polish cleanup"
git push
```

---

## Summary of Commits

1. `style: add lbl, lbl2, card2 constants`
2. `style: polish global button and input constants`
3. `style: unify SkillsSection to C.* tokens and apply type scale`
4. `style: unify CaliWorkoutsSection to C.* tokens and apply type scale`
5. `style: DaySelect typography and spacing polish`
6. `style: Session typography and card2 for weight recommendation block`
7. `style: Fuel typography and AI meal plan macro cell borders`
8. `style: Body typography and spacing polish`
9. `style: Stats typography polish`
10. `style: final visual polish cleanup`
