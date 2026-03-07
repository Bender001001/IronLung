import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

const C = {
  bg: "#0a0a0c", surface: "#141418", hover: "#1c1c22", border: "#2a2a32",
  text: "#e8e6e3", muted: "#8a8892", accent: "#c8ff00", accentDim: "#6b8700",
  green: "#34d399", red: "#f87171", amber: "#fbbf24", blue: "#60a5fa", purple: "#a78bfa",
};
const dayColors = { "Lower A": "#3b82f6", "Upper A": "#a78bfa", "Lower B": "#06b6d4", "Upper B": "#f472b6", "Arms & Delts": "#f59e0b" };
const WEEK_ROTATION = ["Lower A", "Upper A", "Rest", "Lower B", "Upper B", "Arms & Delts", "Rest"];
const inputStyle = { width: "100%", padding: "10px 8px", background: "#1c1c22", border: "1px solid #2a2a32", borderRadius: 8, color: "#e8e6e3", fontSize: 15, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, outline: "none", textAlign: "center", boxSizing: "border-box" };
const smallBtn = { background: "#141418", border: "1px solid #2a2a32", borderRadius: 8, color: "#8a8892", fontSize: 14, cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" };
const tinyBtn = { background: "#1c1c22", border: "1px solid #2a2a32", borderRadius: 6, color: "#8a8892", fontSize: 14, cursor: "pointer", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" };
const hdrLabel = { fontSize: 9, fontWeight: 600, color: "#8a8892", textTransform: "uppercase", letterSpacing: "0.08em" };

function RestTimer({ duration, onDismiss }) {
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(true);
  const ref = useRef(null);
  useEffect(() => {
    if (running && remaining > 0) {
      ref.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) { clearInterval(ref.current); setRunning(false); if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]); return 0; }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(ref.current);
  }, [running]);
  const mins = Math.floor(remaining / 60), secs = remaining % 60;
  const pct = ((duration - remaining) / duration) * 100, done = remaining === 0;
  return (
    <div style={{ background: done ? C.green + "15" : C.accent + "08", border: `1px solid ${done ? C.green + "44" : C.accent + "22"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: done ? C.green : C.text }}>{done ? "GO!" : `${mins}:${String(secs).padStart(2, "0")}`}</span>
          <span style={{ fontSize: 11, color: C.muted }}>{done ? "Rest complete" : "resting"}</span>
        </div>
        <div style={{ width: "100%", height: 3, background: C.border, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: done ? C.green : C.accent, borderRadius: 2, transition: "width 1s linear" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {!done && <button onClick={() => setRemaining(r => r + 30)} style={{ padding: "6px 8px", background: C.hover, border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 11, cursor: "pointer" }}>+30s</button>}
        <button onClick={onDismiss} style={{ padding: "6px 10px", background: done ? C.green + "22" : C.hover, border: `1px solid ${done ? C.green + "44" : C.border}`, borderRadius: 6, color: done ? C.green : C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{done ? "Next Set →" : "Skip"}</button>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("workout");
  const [trainingDays, setTrainingDays] = useState([]);
  const [foods, setFoods] = useState([]);
  const [macroTargets, setMacroTargets] = useState({ protein: 174, carbs: 484, fat: 72, calories: 3280 });
  const [measurements, setMeasurements] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(12);
  const [loading, setLoading] = useState(true);
  const [restDuration, setRestDuration] = useState(120);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: days } = await supabase.from("training_days").select("*, training_day_exercises(*, exercises(*))").order("day_order");
      if (days) {
        setTrainingDays(days.map(d => ({ id: d.id, name: d.name, focus: d.focus, dayOrder: d.day_order,
          exercises: (d.training_day_exercises || []).sort((a, b) => a.exercise_order - b.exercise_order).map(tde => ({
            id: tde.exercises.id, name: tde.exercises.name, sets: tde.default_sets,
            repMin: tde.exercises.rep_min, repMax: tde.exercises.rep_max,
            increment: parseFloat(tde.exercises.increment_lb) || 2.5,
            category: tde.exercises.category, cues: tde.exercises.cues,
          })),
        })));
      }
      const { data: foodData } = await supabase.from("foods").select("*").order("name");
      if (foodData) setFoods(foodData);
      const { data: targets } = await supabase.from("macro_targets").select("*").eq("is_active", true).limit(1);
      if (targets?.[0]) setMacroTargets({ protein: targets[0].protein_g_target, carbs: targets[0].carbs_g_target, fat: targets[0].fat_g_target, calories: targets[0].calories_target });
      const { data: mData } = await supabase.from("measurements").select("*").order("measure_date");
      if (mData) setMeasurements(mData);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  if (loading) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center", color: C.muted }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🏋️</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.accent }}>IRONLOG</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Loading your data...</div>
      </div>
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: "0 auto", paddingBottom: 80 }}>
      {tab === "workout" && !selectedDay && <DaySelect trainingDays={trainingDays} onSelect={setSelectedDay} currentWeek={currentWeek} setCurrentWeek={setCurrentWeek} restDuration={restDuration} setRestDuration={setRestDuration} />}
      {tab === "workout" && selectedDay && <WorkoutSession day={selectedDay} onBack={() => setSelectedDay(null)} currentWeek={currentWeek} restDuration={restDuration} />}
      {tab === "nutrition" && <NutritionView foods={foods} macroTargets={macroTargets} />}
      {tab === "measure" && <MeasurementsView measurements={measurements} onAdd={m => setMeasurements(p => [...p, m].sort((a, b) => a.measure_date.localeCompare(b.measure_date)))} />}
      {tab === "progress" && <ProgressView measurements={measurements} />}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 100 }}>
        {[{ id: "workout", icon: "🏋️", label: "Train" }, { id: "nutrition", icon: "🍗", label: "Fuel" }, { id: "measure", icon: "📏", label: "Track" }, { id: "progress", icon: "📈", label: "PRs" }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "workout") setSelectedDay(null); }}
            style={{ flex: 1, padding: "10px 0 8px", background: "none", border: "none", color: tab === t.id ? C.accent : C.muted, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DaySelect({ trainingDays, onSelect, currentWeek, setCurrentWeek, restDuration, setRestDuration }) {
  const [showSettings, setShowSettings] = useState(false);
  return (
    <div style={{ padding: "20px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}><span style={{ color: C.accent }}>IRON</span>LOG</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowSettings(!showSettings)} style={{ ...smallBtn, fontSize: 12 }}>⚙️</button>
          <button onClick={() => setCurrentWeek(w => Math.max(1, w - 1))} style={smallBtn}>←</button>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: C.muted }}>WK {currentWeek}</span>
          <button onClick={() => setCurrentWeek(w => w + 1)} style={smallBtn}>→</button>
        </div>
      </div>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 16px" }}>Select your training day</p>
      {showSettings && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Rest Timer Duration</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[60, 90, 120, 150, 180, 240].map(t => (
              <button key={t} onClick={() => setRestDuration(t)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${restDuration === t ? C.accent : C.border}`, background: restDuration === t ? C.accent + "18" : "transparent", color: restDuration === t ? C.accent : C.muted, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, cursor: "pointer" }}>
                {Math.floor(t / 60)}:{String(t % 60).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {WEEK_ROTATION.map((dayName, i) => {
          if (dayName === "Rest") return <div key={`rest-${i}`} style={{ padding: "12px 16px", background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, opacity: 0.5 }}><span style={{ fontSize: 13, color: C.muted }}>Day {i + 1}</span><span style={{ marginLeft: 12, fontSize: 14, color: C.muted }}>Rest Day</span></div>;
          const day = trainingDays.find(d => d.name === dayName);
          if (!day) return null;
          const dc = dayColors[dayName] || C.accent;
          return (
            <button key={dayName} onClick={() => onSelect(day)} style={{ padding: "14px 16px", background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: dc + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: dc, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 600 }}>{day.name}</div><div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{day.focus} · {day.exercises.length} exercises</div></div>
              <div style={{ color: C.muted, fontSize: 18 }}>›</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorkoutSession({ day, onBack, currentWeek, restDuration }) {
  const [expandedEx, setExpandedEx] = useState(0);
  const [showCues, setShowCues] = useState(null);
  const [setData, setSetData] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showTimer, setShowTimer] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [lastWeekData, setLastWeekData] = useState({});

  useEffect(() => { loadOrCreateSession(); loadLastWeek(); }, [day.id, currentWeek]);

  async function loadLastWeek() {
    const prev = currentWeek - 1;
    if (prev < 1) return;
    const { data: ps } = await supabase.from("workout_sessions").select("id, workout_sets(exercise_id, weight_lb, reps)").eq("week_number", prev).eq("training_day_id", day.id).limit(1);
    if (ps?.[0]) {
      const byEx = {};
      ps[0].workout_sets.forEach(ws => {
        if (!byEx[ws.exercise_id]) byEx[ws.exercise_id] = [];
        byEx[ws.exercise_id].push(ws);
      });
      const prog = {};
      Object.entries(byEx).forEach(([exId, sets]) => {
        const valid = sets.filter(s => s.reps > 0 && s.weight_lb > 0);
        if (!valid.length) return;
        const avgReps = valid.reduce((s, v) => s + v.reps, 0) / valid.length;
        const maxW = Math.max(...valid.map(s => s.weight_lb));
        const ex = day.exercises.find(e => e.id === parseInt(exId));
        const hit = ex && avgReps >= ex.repMax;
        prog[exId] = { lastWeight: maxW, lastAvgReps: avgReps, suggestIncrease: hit, suggestedWeight: hit && ex ? maxW + ex.increment : maxW };
      });
      setLastWeekData(prog);
    }
  }

  async function loadOrCreateSession() {
    const { data: ex } = await supabase.from("workout_sessions").select("id, workout_sets(*)").eq("week_number", currentWeek).eq("training_day_id", day.id).limit(1);
    if (ex?.[0]) {
      setSessionId(ex[0].id);
      const loaded = {};
      ex[0].workout_sets.forEach(ws => { loaded[`${ws.exercise_id}-${ws.set_number}`] = { weight: ws.weight_lb || 0, reps: ws.reps || 0, dbId: ws.id }; });
      setSetData(loaded);
    } else {
      const { data: ns } = await supabase.from("workout_sessions").insert({ week_number: currentWeek, training_day_id: day.id, session_date: new Date().toISOString().split("T")[0] }).select().single();
      if (ns) setSessionId(ns.id);
    }
  }

  function getSet(exId, sn) { return setData[`${exId}-${sn}`] || { weight: 0, reps: 0 }; }
  function updateLocal(exId, sn, field, val) {
    const k = `${exId}-${sn}`;
    setSetData(p => ({ ...p, [k]: { ...p[k], weight: p[k]?.weight || 0, reps: p[k]?.reps || 0, [field]: parseFloat(val) || 0 } }));
  }
  async function saveSet(exId, sn) {
    if (!sessionId) return;
    const k = `${exId}-${sn}`, d = setData[k];
    if (!d || (!d.weight && !d.reps)) return;
    setSaving(true);
    try {
      if (d.dbId) { await supabase.from("workout_sets").update({ weight_lb: d.weight, reps: d.reps }).eq("id", d.dbId); }
      else {
        const { data: ins } = await supabase.from("workout_sets").insert({ session_id: sessionId, exercise_id: exId, set_number: sn, weight_lb: d.weight, reps: d.reps }).select().single();
        if (ins) setSetData(p => ({ ...p, [k]: { ...p[k], dbId: ins.id } }));
      }
      setLastSaved(new Date().toLocaleTimeString());
      if (d.reps > 0) { setShowTimer(true); setTimerKey(tk => tk + 1); }
    } catch (err) { console.error(err); }
    setSaving(false);
  }
  function prefillWeight(exId, numSets, w) {
    const u = {};
    for (let i = 1; i <= numSets; i++) { const k = `${exId}-${i}`; u[k] = { ...setData[k], weight: w, reps: setData[k]?.reps || 0, dbId: setData[k]?.dbId }; }
    setSetData(p => ({ ...p, ...u }));
  }
  function completedSets(exId, n) { let c = 0; for (let i = 1; i <= n; i++) if (setData[`${exId}-${i}`]?.reps > 0) c++; return c; }

  return (
    <div style={{ padding: "16px 16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <button onClick={onBack} style={{ ...smallBtn, fontSize: 16, width: 36, height: 36 }}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{day.name}</h2>
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Week {currentWeek} · {day.focus}</p>
        </div>
      </div>
      {lastSaved && <div style={{ fontSize: 10, color: C.green, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8, paddingLeft: 48 }}>{saving ? "Saving..." : `Saved ${lastSaved}`}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {day.exercises.map((ex, exIdx) => {
          const isExp = expandedEx === exIdx, done = completedSets(ex.id, ex.sets), allDone = done === ex.sets, prog = lastWeekData[ex.id];
          return (
            <div key={ex.id} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${allDone ? C.green + "33" : C.border}`, overflow: "hidden" }}>
              <button onClick={() => setExpandedEx(isExp ? -1 : exIdx)} style={{ width: "100%", padding: "14px", background: "none", border: "none", color: C.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: allDone ? C.green + "22" : C.accent + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: allDone ? C.green : C.accent, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{allDone ? "✓" : exIdx + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{ex.sets}×{ex.repMin}–{ex.repMax}{done > 0 && <span style={{ color: allDone ? C.green : C.amber }}> · {done}/{ex.sets}</span>}</div>
                </div>
                {prog?.suggestIncrease && !allDone && <div style={{ fontSize: 9, fontWeight: 700, color: C.green, background: C.green + "18", padding: "3px 6px", borderRadius: 4 }}>↑ UP</div>}
                <span style={{ color: C.muted, transform: isExp ? "rotate(90deg)" : "none", transition: "transform 0.15s", fontSize: 16 }}>›</span>
              </button>
              {isExp && (
                <div style={{ padding: "0 14px 14px" }}>
                  <button onClick={() => setShowCues(showCues === exIdx ? null : exIdx)} style={{ width: "100%", padding: "8px 10px", marginBottom: 8, background: C.accent + "08", border: `1px solid ${C.accent}22`, borderRadius: 8, color: C.accent, fontSize: 12, cursor: "pointer", textAlign: "left" }}>
                    {showCues === exIdx ? ex.cues : "💡 Tap for setup cues"}
                  </button>
                  {prog?.suggestIncrease && (
                    <div style={{ padding: "8px 10px", marginBottom: 8, background: C.green + "10", border: `1px solid ${C.green}33`, borderRadius: 8, fontSize: 12 }}>
                      <span style={{ color: C.green, fontWeight: 600 }}>↑ Progression: </span>
                      <span style={{ color: C.text }}>Last week {prog.lastAvgReps.toFixed(1)} avg reps at {prog.lastWeight}lb. </span>
                      <span style={{ color: C.green, fontWeight: 700 }}>Try {prog.suggestedWeight}lb (+{ex.increment})</span>
                    </div>
                  )}
                  {prog && !prog.suggestIncrease && (
                    <div style={{ padding: "6px 10px", marginBottom: 8, background: C.hover, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.muted }}>
                      Last week: {prog.lastWeight}lb · {prog.lastAvgReps.toFixed(1)} avg reps
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                    {prog?.suggestIncrease ? (<>
                      <button onClick={() => prefillWeight(ex.id, ex.sets, prog.suggestedWeight)} style={{ padding: "6px 10px", background: C.green + "15", border: `1px solid ${C.green}44`, borderRadius: 6, color: C.green, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Fill {prog.suggestedWeight}lb (↑)</button>
                      <button onClick={() => prefillWeight(ex.id, ex.sets, prog.lastWeight)} style={{ padding: "6px 10px", background: C.hover, border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 11, cursor: "pointer" }}>Keep {prog.lastWeight}lb</button>
                    </>) : (
                      <button onClick={() => prefillWeight(ex.id, ex.sets, prog?.lastWeight || 0)} style={{ padding: "6px 10px", background: C.hover, border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 11, cursor: "pointer" }}>Fill {prog?.lastWeight || 0}lb</button>
                    )}
                  </div>
                  {showTimer && <RestTimer key={timerKey} duration={restDuration} onDismiss={() => setShowTimer(false)} />}
                  <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 50px", gap: 6, marginBottom: 6, padding: "0 2px" }}>
                    <span style={hdrLabel}>SET</span><span style={hdrLabel}>WEIGHT</span><span style={hdrLabel}>REPS</span><span style={hdrLabel}></span>
                  </div>
                  {Array.from({ length: ex.sets }, (_, i) => {
                    const sn = i + 1, s = getSet(ex.id, sn), isDone = s.reps > 0, above = s.reps > ex.repMax, below = s.reps > 0 && s.reps < ex.repMin;
                    return (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 50px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: isDone ? C.green : C.muted, textAlign: "center" }}>{sn}</div>
                        <input type="number" inputMode="decimal" value={s.weight || ""} placeholder="lbs" onChange={e => updateLocal(ex.id, sn, "weight", e.target.value)} onBlur={() => saveSet(ex.id, sn)} style={inputStyle} />
                        <input type="number" inputMode="numeric" value={s.reps || ""} placeholder={`${ex.repMin}-${ex.repMax}`} onChange={e => updateLocal(ex.id, sn, "reps", e.target.value)} onBlur={() => saveSet(ex.id, sn)} style={{ ...inputStyle, borderColor: above ? C.green + "66" : below ? C.red + "66" : C.border }} />
                        <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: above ? C.green : below ? C.red : C.muted, textAlign: "center" }}>{above ? "↑ PR" : below ? "LOW" : isDone ? "✓" : ""}</div>
                      </div>
                    );
                  })}
                  {exIdx < day.exercises.length - 1 && (
                    <button onClick={() => { setExpandedEx(exIdx + 1); setShowTimer(false); }} style={{ width: "100%", padding: "10px", marginTop: 6, background: C.accent + "12", border: `1px solid ${C.accent}33`, borderRadius: 8, color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Next Exercise →</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NutritionView({ foods, macroTargets }) {
  const [mealLog, setMealLog] = useState([]);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [catFilter, setCatFilter] = useState("All");
  const [todayDate] = useState(new Date().toISOString().split("T")[0]);
  useEffect(() => { loadToday(); }, []);
  async function loadToday() {
    const { data } = await supabase.from("meal_log").select("*, foods(*)").eq("log_date", todayDate).order("created_at");
    if (data) setMealLog(data.map(m => ({ id: m.id, food: m.foods?.name || "?", portions: parseFloat(m.portions), protein: m.foods?.protein_g || 0, carbs: m.foods?.carbs_g || 0, fat: m.foods?.fat_g || 0, calories: m.foods?.calories || 0, foodId: m.food_id })));
  }
  async function addFood(f) {
    const { data: ins } = await supabase.from("meal_log").insert({ log_date: todayDate, food_id: f.id, portions: 1 }).select().single();
    if (ins) setMealLog(p => [...p, { id: ins.id, food: f.name, portions: 1, protein: f.protein_g, carbs: f.carbs_g, fat: f.fat_g, calories: f.calories, foodId: f.id }]);
    setShowSearch(false); setSearch("");
  }
  async function removeFood(idx) { const e = mealLog[idx]; if (e?.id) await supabase.from("meal_log").delete().eq("id", e.id); setMealLog(p => p.filter((_, i) => i !== idx)); }
  async function updatePortions(idx, portions) { const np = Math.max(0.25, portions); const e = mealLog[idx]; if (e?.id) await supabase.from("meal_log").update({ portions: np }).eq("id", e.id); setMealLog(p => p.map((m, i) => i === idx ? { ...m, portions: np } : m)); }
  const totals = mealLog.reduce((a, m) => ({ protein: a.protein + (m.protein || 0) * m.portions, carbs: a.carbs + (m.carbs || 0) * m.portions, fat: a.fat + (m.fat || 0) * m.portions, calories: a.calories + (m.calories || 0) * m.portions }), { protein: 0, carbs: 0, fat: 0, calories: 0 });
  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) && (catFilter === "All" || f.category === catFilter));
  return (
    <div style={{ padding: "20px 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}><span style={{ color: C.accent }}>FUEL</span>LOG</h1>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 16px" }}>Lean Bulk · {macroTargets.calories} cal target</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[{ l: "Protein", v: Math.round(totals.protein), t: macroTargets.protein, u: "g", c: C.green }, { l: "Carbs", v: Math.round(totals.carbs), t: macroTargets.carbs, u: "g", c: C.blue }, { l: "Fat", v: Math.round(totals.fat), t: macroTargets.fat, u: "g", c: C.amber }, { l: "Cals", v: Math.round(totals.calories), t: macroTargets.calories, u: "", c: C.purple }].map(m => {
          const pct = Math.round((m.v / m.t) * 100);
          return (
            <div key={m.l} style={{ background: C.surface, borderRadius: 12, padding: "12px 8px", textAlign: "center", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: pct > 100 ? C.red : m.c }}>{m.v}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>/ {m.t}{m.u}</div>
              <div style={{ width: "100%", height: 3, background: C.border, borderRadius: 2, marginTop: 6, overflow: "hidden" }}><div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: m.c, borderRadius: 2 }} /></div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.l}</div>
            </div>
          );
        })}
      </div>
      <button onClick={() => setShowSearch(!showSearch)} style={{ width: "100%", padding: "12px", background: showSearch ? C.hover : C.accent + "12", border: `1px solid ${showSearch ? C.border : C.accent}33`, borderRadius: 10, color: showSearch ? C.muted : C.accent, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>{showSearch ? "✕ Close" : "+ Add Food"}</button>
      {showSearch && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 12, marginBottom: 12 }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search foods..." style={{ ...inputStyle, width: "100%", marginBottom: 8, textAlign: "left", paddingLeft: 12 }} autoFocus />
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {["All", "Protein", "Carb", "Fat", "RTD Protein", "Snack", "Meal", "Misc"].map(c => (
              <button key={c} onClick={() => setCatFilter(c)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${catFilter === c ? C.accent : C.border}`, background: catFilter === c ? C.accent + "18" : "transparent", color: catFilter === c ? C.accent : C.muted, fontSize: 11, cursor: "pointer" }}>{c}</button>
            ))}
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {foods.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>Food database empty. Import via SQL Editor.</div> :
            filtered.map(f => (
              <button key={f.id} onClick={() => addFood(f)} style={{ width: "100%", padding: "10px 8px", background: "none", border: "none", borderBottom: `1px solid ${C.border}`, color: C.text, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                <div><div style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</div><div style={{ fontSize: 11, color: C.muted }}>{f.portion_size} {f.portion_unit}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.green }}>{f.protein_g}p</div><div style={{ fontSize: 10, color: C.muted }}>{f.calories} cal</div></div>
              </button>
            ))}
          </div>
        </div>
      )}
      {mealLog.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Today's Log</div>
          {mealLog.map((m, idx) => (
            <div key={m.id || idx} style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.food}</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(m.protein * m.portions)}p · {Math.round(m.carbs * m.portions)}c · {Math.round(m.fat * m.portions)}f · {Math.round(m.calories * m.portions)} cal</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => updatePortions(idx, m.portions - 0.5)} style={tinyBtn}>−</button>
                <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", width: 28, textAlign: "center" }}>{m.portions}</span>
                <button onClick={() => updatePortions(idx, m.portions + 0.5)} style={tinyBtn}>+</button>
              </div>
              <button onClick={() => removeFood(idx)} style={{ background: "none", border: "none", color: C.red, fontSize: 16, cursor: "pointer", padding: "4px" }}>×</button>
            </div>
          ))}
        </div>
      )}
      {mealLog.length === 0 && !showSearch && <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}><div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div><div style={{ fontSize: 14 }}>No meals logged today</div></div>}
    </div>
  );
}

function MeasurementsView({ measurements, onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ measure_date: new Date().toISOString().split("T")[0], bodyweight_lb: "", chest_in: "", waist_in: "", hips_in: "", r_arm_in: "", l_arm_in: "", neck_in: "" });
  async function save() {
    if (!form.bodyweight_lb) return;
    const entry = {}; Object.entries(form).forEach(([k, v]) => { entry[k] = k === "measure_date" ? v : (parseFloat(v) || null); });
    const { data } = await supabase.from("measurements").insert(entry).select().single();
    if (data) { onAdd(data); setShowForm(false); }
  }
  const latest = measurements[measurements.length - 1];
  return (
    <div style={{ padding: "20px 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}><span style={{ color: C.accent }}>BODY</span>TRACK</h1>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 16px" }}>Measurements & body composition</p>
      {latest && (
        <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Latest · {latest.measure_date}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[{ l: "Weight", v: latest.bodyweight_lb, u: "lb" }, { l: "Chest", v: latest.chest_in, u: "in" }, { l: "Waist", v: latest.waist_in, u: "in" }, { l: "Hips", v: latest.hips_in, u: "in" }, { l: "R Arm", v: latest.r_arm_in, u: "in" }, { l: "L Arm", v: latest.l_arm_in, u: "in" }].map(s => (
              <div key={s.l}><div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase" }}>{s.l}</div><div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{s.v ?? "—"}</div><div style={{ fontSize: 10, color: C.muted }}>{s.u}</div></div>
            ))}
          </div>
        </div>
      )}
      <button onClick={() => setShowForm(!showForm)} style={{ width: "100%", padding: "12px", background: C.accent + "12", border: `1px solid ${C.accent}33`, borderRadius: 10, color: C.accent, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>{showForm ? "✕ Cancel" : "+ New Measurement"}</button>
      {showForm && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[{ k: "measure_date", l: "Date", t: "date" }, { k: "bodyweight_lb", l: "Weight (lb)", t: "number" }, { k: "chest_in", l: "Chest (in)", t: "number" }, { k: "waist_in", l: "Waist (in)", t: "number" }, { k: "hips_in", l: "Hips (in)", t: "number" }, { k: "r_arm_in", l: "R Arm (in)", t: "number" }, { k: "l_arm_in", l: "L Arm (in)", t: "number" }, { k: "neck_in", l: "Neck (in)", t: "number" }].map(f => (
              <div key={f.k}><label style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>{f.l}</label>
              <input type={f.t} inputMode={f.t === "number" ? "decimal" : undefined} value={form[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} style={{ ...inputStyle, width: "100%", marginTop: 4 }} /></div>
            ))}
          </div>
          <button onClick={save} style={{ width: "100%", padding: "12px", marginTop: 12, background: C.accent, border: "none", borderRadius: 8, color: C.bg, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Save Measurement</button>
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>History</div>
      {[...measurements].reverse().map(m => (
        <div key={m.id} style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 12, color: C.muted }}>{m.measure_date}</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{m.bodyweight_lb} lb</div></div>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>{m.chest_in && <span>Ch:{m.chest_in} </span>}{m.waist_in && <span>W:{m.waist_in} </span>}{m.r_arm_in && <span>Arm:{m.r_arm_in}</span>}</div>
        </div>
      ))}
    </div>
  );
}

function ProgressView({ measurements }) {
  const [prs, setPrs] = useState([]);
  useEffect(() => { loadPRs(); }, []);
  async function loadPRs() {
    const { data } = await supabase.from("workout_sets").select("exercise_id, weight_lb, reps, exercises(name)").order("weight_lb", { ascending: false });
    if (data) {
      const best = {};
      data.forEach(s => { const n = s.exercises?.name; if (!n || !s.weight_lb || !s.reps) return; const e1 = s.weight_lb * (1 + s.reps / 30); if (!best[n] || e1 > best[n].est1rm) best[n] = { exercise: n, weight: s.weight_lb, reps: s.reps, est1rm: e1 }; });
      setPrs(Object.values(best).sort((a, b) => b.est1rm - a.est1rm));
    }
  }
  const wd = measurements.filter(m => m.bodyweight_lb);
  return (
    <div style={{ padding: "20px 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}><span style={{ color: C.accent }}>PR</span>BOARD</h1>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 16px" }}>Personal records & progress</p>
      {wd.length > 1 && (
        <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Bodyweight Trend</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
            {wd.map(m => { const min = Math.min(...wd.map(d => d.bodyweight_lb)), max = Math.max(...wd.map(d => d.bodyweight_lb)), rng = max - min || 1, h = ((m.bodyweight_lb - min) / rng) * 50 + 10;
              return (<div key={m.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: C.text }}>{m.bodyweight_lb}</span><div style={{ width: "100%", height: h, background: C.accent, borderRadius: 4, maxWidth: 40 }} /><span style={{ fontSize: 8, color: C.muted }}>{m.measure_date?.slice(5)}</span></div>);
            })}
          </div>
        </div>
      )}
      {prs.length > 0 ? (<>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>All-Time Personal Records</div>
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", gap: 0, marginBottom: 8 }}>
          {["Exercise", "Best", "Reps", "E1RM"].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>{h}</div>)}
        </div>
        {prs.map(pr => (
          <div key={pr.exercise} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{pr.exercise}</div>
            <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.accent }}>{pr.weight}</div>
            <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.muted }}>{pr.reps}</div>
            <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.green }}>{Math.round(pr.est1rm)}</div>
          </div>
        ))}
      </>) : (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}><div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div><div style={{ fontSize: 14 }}>No PRs yet</div><div style={{ fontSize: 12, marginTop: 4 }}>Log workouts to start tracking records</div></div>
      )}
    </div>
  );
}
