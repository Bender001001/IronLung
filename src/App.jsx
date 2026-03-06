import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

// ─── COLORS ──────────────────────────────────────────────────────
const C = {
  bg: "#0a0a0c", surface: "#141418", hover: "#1c1c22", border: "#2a2a32",
  text: "#e8e6e3", muted: "#8a8892", accent: "#c8ff00", accentDim: "#6b8700",
  green: "#34d399", red: "#f87171", amber: "#fbbf24", blue: "#60a5fa", purple: "#a78bfa",
};

const dayColors = { "Lower A": "#3b82f6", "Upper A": "#a78bfa", "Lower B": "#06b6d4", "Upper B": "#f472b6", "Arms & Delts": "#f59e0b" };
const WEEK_ROTATION = ["Lower A", "Upper A", "Rest", "Lower B", "Upper B", "Arms & Delts", "Rest"];

// ─── MAIN APP ────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("workout");
  const [trainingDays, setTrainingDays] = useState([]);
  const [foods, setFoods] = useState([]);
  const [macroTargets, setMacroTargets] = useState({ protein: 174, carbs: 484, fat: 72, calories: 3280 });
  const [measurements, setMeasurements] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(12);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load training days with their exercises
      const { data: days } = await supabase
        .from("training_days")
        .select("*, training_day_exercises(*, exercises(*))")
        .order("day_order");

      if (days) {
        const formatted = days.map((d) => ({
          id: d.id,
          name: d.name,
          focus: d.focus,
          dayOrder: d.day_order,
          exercises: (d.training_day_exercises || [])
            .sort((a, b) => a.exercise_order - b.exercise_order)
            .map((tde) => ({
              id: tde.exercises.id,
              tdeId: tde.id,
              name: tde.exercises.name,
              sets: tde.default_sets,
              repMin: tde.exercises.rep_min,
              repMax: tde.exercises.rep_max,
              increment: parseFloat(tde.exercises.increment_lb) || 2.5,
              category: tde.exercises.category,
              cues: tde.exercises.cues,
              primaryMuscle: tde.exercises.primary_muscle,
            })),
        }));
        setTrainingDays(formatted);
      }

      // Load foods
      const { data: foodData } = await supabase.from("foods").select("*").order("name");
      if (foodData) setFoods(foodData);

      // Load macro targets
      const { data: targets } = await supabase.from("macro_targets").select("*").eq("is_active", true).limit(1);
      if (targets && targets.length > 0) {
        setMacroTargets({
          protein: targets[0].protein_g_target,
          carbs: targets[0].carbs_g_target,
          fat: targets[0].fat_g_target,
          calories: targets[0].calories_target,
        });
      }

      // Load measurements
      const { data: mData } = await supabase.from("measurements").select("*").order("measure_date");
      if (mData) setMeasurements(mData);
    } catch (err) {
      console.error("Load error:", err);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏋️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.accent }}>IRONLOG</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Loading your data...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: "0 auto", paddingBottom: 80, position: "relative" }}>
      {tab === "workout" && !selectedDay && (
        <DaySelect trainingDays={trainingDays} onSelect={setSelectedDay} currentWeek={currentWeek} setCurrentWeek={setCurrentWeek} />
      )}
      {tab === "workout" && selectedDay && (
        <WorkoutSession day={selectedDay} onBack={() => setSelectedDay(null)} currentWeek={currentWeek} />
      )}
      {tab === "nutrition" && (
        <NutritionView foods={foods} macroTargets={macroTargets} />
      )}
      {tab === "measure" && (
        <MeasurementsView measurements={measurements} onAdd={(m) => setMeasurements((p) => [...p, m].sort((a, b) => a.measure_date.localeCompare(b.measure_date)))} />
      )}
      {tab === "progress" && (
        <ProgressView measurements={measurements} />
      )}

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 100 }}>
        {[
          { id: "workout", icon: "🏋️", label: "Train" },
          { id: "nutrition", icon: "🍗", label: "Fuel" },
          { id: "measure", icon: "📏", label: "Track" },
          { id: "progress", icon: "📈", label: "PRs" },
        ].map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "workout") setSelectedDay(null); }}
            style={{ flex: 1, padding: "10px 0 8px", background: "none", border: "none", color: tab === t.id ? C.accent : C.muted, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}


// ─── DAY SELECT ──────────────────────────────────────────────────
function DaySelect({ trainingDays, onSelect, currentWeek, setCurrentWeek }) {
  return (
    <div style={{ padding: "20px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
          <span style={{ color: C.accent }}>IRON</span>LOG
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setCurrentWeek((w) => Math.max(1, w - 1))} style={smallBtn}>←</button>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: C.muted }}>WK {currentWeek}</span>
          <button onClick={() => setCurrentWeek((w) => w + 1)} style={smallBtn}>→</button>
        </div>
      </div>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 20px" }}>Select your training day</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {WEEK_ROTATION.map((dayName, i) => {
          if (dayName === "Rest") {
            return (
              <div key={`rest-${i}`} style={{ padding: "12px 16px", background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, opacity: 0.5 }}>
                <span style={{ fontSize: 13, color: C.muted }}>Day {i + 1}</span>
                <span style={{ marginLeft: 12, fontSize: 14, color: C.muted }}>Rest Day</span>
              </div>
            );
          }
          const day = trainingDays.find((d) => d.name === dayName);
          if (!day) return null;
          const dotColor = dayColors[dayName] || C.accent;

          return (
            <button key={dayName} onClick={() => onSelect(day)}
              style={{ padding: "14px 16px", background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: dotColor + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: dotColor, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{day.name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{day.focus} · {day.exercises.length} exercises</div>
              </div>
              <div style={{ color: C.muted, fontSize: 18 }}>›</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


// ─── WORKOUT SESSION ─────────────────────────────────────────────
function WorkoutSession({ day, onBack, currentWeek }) {
  const [expandedEx, setExpandedEx] = useState(0);
  const [showCues, setShowCues] = useState(null);
  const [setData, setSetData] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Load existing session for this week+day, or create one
  useEffect(() => {
    loadOrCreateSession();
  }, [day.id, currentWeek]);

  async function loadOrCreateSession() {
    // Check for existing session
    const { data: existing } = await supabase
      .from("workout_sessions")
      .select("id, workout_sets(*)")
      .eq("week_number", currentWeek)
      .eq("training_day_id", day.id)
      .limit(1);

    if (existing && existing.length > 0) {
      setSessionId(existing[0].id);
      // Populate setData from existing sets
      const loaded = {};
      existing[0].workout_sets.forEach((ws) => {
        const key = `${ws.exercise_id}-${ws.set_number}`;
        loaded[key] = { weight: ws.weight_lb || 0, reps: ws.reps || 0, dbId: ws.id };
      });
      setSetData(loaded);
    } else {
      // Create new session
      const { data: newSession } = await supabase
        .from("workout_sessions")
        .insert({ week_number: currentWeek, training_day_id: day.id, session_date: new Date().toISOString().split("T")[0] })
        .select()
        .single();
      if (newSession) setSessionId(newSession.id);
    }
  }

  function getSet(exerciseId, setNum) {
    const key = `${exerciseId}-${setNum}`;
    return setData[key] || { weight: 0, reps: 0 };
  }

  function updateLocal(exerciseId, setNum, field, value) {
    const key = `${exerciseId}-${setNum}`;
    setSetData((prev) => ({
      ...prev,
      [key]: { ...prev[key], weight: prev[key]?.weight || 0, reps: prev[key]?.reps || 0, [field]: parseFloat(value) || 0 },
    }));
  }

  async function saveSet(exerciseId, setNum) {
    if (!sessionId) return;
    const key = `${exerciseId}-${setNum}`;
    const data = setData[key];
    if (!data || (data.weight === 0 && data.reps === 0)) return;

    setSaving(true);
    try {
      if (data.dbId) {
        await supabase.from("workout_sets").update({ weight_lb: data.weight, reps: data.reps }).eq("id", data.dbId);
      } else {
        const { data: inserted } = await supabase
          .from("workout_sets")
          .insert({ session_id: sessionId, exercise_id: exerciseId, set_number: setNum, weight_lb: data.weight, reps: data.reps })
          .select()
          .single();
        if (inserted) {
          setSetData((prev) => ({ ...prev, [key]: { ...prev[key], dbId: inserted.id } }));
        }
      }
      setLastSaved(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Save error:", err);
    }
    setSaving(false);
  }

  function prefillWeight(exerciseId, numSets, weight) {
    const updates = {};
    for (let i = 1; i <= numSets; i++) {
      const key = `${exerciseId}-${i}`;
      updates[key] = { ...setData[key], weight, reps: setData[key]?.reps || 0, dbId: setData[key]?.dbId };
    }
    setSetData((prev) => ({ ...prev, ...updates }));
  }

  function completedSets(exerciseId, numSets) {
    let count = 0;
    for (let i = 1; i <= numSets; i++) {
      if (setData[`${exerciseId}-${i}`]?.reps > 0) count++;
    }
    return count;
  }

  return (
    <div style={{ padding: "16px 16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <button onClick={onBack} style={{ ...smallBtn, fontSize: 16, width: 36, height: 36 }}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{day.name}</h2>
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Week {currentWeek} · {day.focus}</p>
        </div>
      </div>
      {lastSaved && (
        <div style={{ fontSize: 10, color: C.green, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8, paddingLeft: 48 }}>
          {saving ? "Saving..." : `Saved ${lastSaved}`}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {day.exercises.map((ex, exIdx) => {
          const isExpanded = expandedEx === exIdx;
          const done = completedSets(ex.id, ex.sets);
          const allDone = done === ex.sets;

          return (
            <div key={ex.id} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${allDone ? C.green + "33" : C.border}`, overflow: "hidden" }}>
              <button onClick={() => setExpandedEx(isExpanded ? -1 : exIdx)}
                style={{ width: "100%", padding: "14px", background: "none", border: "none", color: C.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: allDone ? C.green + "22" : C.accent + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: allDone ? C.green : C.accent, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                  {allDone ? "✓" : exIdx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                    {ex.sets}×{ex.repMin}–{ex.repMax}
                    {done > 0 && <span style={{ color: allDone ? C.green : C.amber }}> · {done}/{ex.sets}</span>}
                  </div>
                </div>
                <span style={{ color: C.muted, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s", fontSize: 16 }}>›</span>
              </button>

              {isExpanded && (
                <div style={{ padding: "0 14px 14px" }}>
                  <button onClick={() => setShowCues(showCues === exIdx ? null : exIdx)}
                    style={{ width: "100%", padding: "8px 10px", marginBottom: 10, background: C.accent + "08", border: `1px solid ${C.accent}22`, borderRadius: 8, color: C.accent, fontSize: 12, cursor: "pointer", textAlign: "left" }}>
                    {showCues === exIdx ? ex.cues : "💡 Tap for setup cues"}
                  </button>

                  <button onClick={() => prefillWeight(ex.id, ex.sets, ex.increment * 5)}
                    style={{ padding: "6px 10px", marginBottom: 10, background: C.hover, border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 11, cursor: "pointer" }}>
                    Fill all sets same weight
                  </button>

                  <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 50px", gap: 6, marginBottom: 6, padding: "0 2px" }}>
                    <span style={hdrLabel}>SET</span>
                    <span style={hdrLabel}>WEIGHT</span>
                    <span style={hdrLabel}>REPS</span>
                    <span style={hdrLabel}></span>
                  </div>

                  {Array.from({ length: ex.sets }, (_, i) => {
                    const setNum = i + 1;
                    const s = getSet(ex.id, setNum);
                    const isDone = s.reps > 0;
                    const aboveRange = s.reps > ex.repMax;
                    const belowRange = s.reps > 0 && s.reps < ex.repMin;

                    return (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 50px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: isDone ? C.green : C.muted, textAlign: "center" }}>
                          {setNum}
                        </div>
                        <input type="number" inputMode="decimal" value={s.weight || ""} placeholder="lbs"
                          onChange={(e) => updateLocal(ex.id, setNum, "weight", e.target.value)}
                          onBlur={() => saveSet(ex.id, setNum)}
                          style={inputStyle} />
                        <input type="number" inputMode="numeric" value={s.reps || ""} placeholder={`${ex.repMin}-${ex.repMax}`}
                          onChange={(e) => updateLocal(ex.id, setNum, "reps", e.target.value)}
                          onBlur={() => saveSet(ex.id, setNum)}
                          style={{ ...inputStyle, borderColor: aboveRange ? C.green + "66" : belowRange ? C.red + "66" : C.border }} />
                        <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: aboveRange ? C.green : belowRange ? C.red : C.muted, textAlign: "center" }}>
                          {aboveRange ? "↑ PR" : belowRange ? "LOW" : isDone ? "✓ OK" : ""}
                        </div>
                      </div>
                    );
                  })}

                  {exIdx < day.exercises.length - 1 && (
                    <button onClick={() => setExpandedEx(exIdx + 1)}
                      style={{ width: "100%", padding: "10px", marginTop: 6, background: C.accent + "12", border: `1px solid ${C.accent}33`, borderRadius: 8, color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Next Exercise →
                    </button>
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


// ─── NUTRITION ───────────────────────────────────────────────────
function NutritionView({ foods, macroTargets }) {
  const [mealLog, setMealLog] = useState([]);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [catFilter, setCatFilter] = useState("All");
  const [todayDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    loadTodayMeals();
  }, []);

  async function loadTodayMeals() {
    const { data } = await supabase
      .from("meal_log")
      .select("*, foods(*)")
      .eq("log_date", todayDate)
      .order("created_at");
    if (data) {
      setMealLog(data.map((m) => ({
        id: m.id,
        food: m.foods?.name || "Unknown",
        portions: parseFloat(m.portions),
        protein: m.foods?.protein_g || 0,
        carbs: m.foods?.carbs_g || 0,
        fat: m.foods?.fat_g || 0,
        calories: m.foods?.calories || 0,
        foodId: m.food_id,
      })));
    }
  }

  async function addFood(food) {
    const { data: inserted } = await supabase
      .from("meal_log")
      .insert({ log_date: todayDate, food_id: food.id, portions: 1 })
      .select()
      .single();
    if (inserted) {
      setMealLog((prev) => [...prev, {
        id: inserted.id, food: food.name, portions: 1, protein: food.protein_g, carbs: food.carbs_g, fat: food.fat_g, calories: food.calories, foodId: food.id,
      }]);
    }
    setShowSearch(false);
    setSearch("");
  }

  async function removeFood(idx) {
    const entry = mealLog[idx];
    if (entry?.id) await supabase.from("meal_log").delete().eq("id", entry.id);
    setMealLog((prev) => prev.filter((_, i) => i !== idx));
  }

  async function updatePortions(idx, portions) {
    const entry = mealLog[idx];
    const newP = Math.max(0.25, portions);
    if (entry?.id) await supabase.from("meal_log").update({ portions: newP }).eq("id", entry.id);
    setMealLog((prev) => prev.map((m, i) => (i === idx ? { ...m, portions: newP } : m)));
  }

  const totals = mealLog.reduce((acc, m) => ({
    protein: acc.protein + (m.protein || 0) * m.portions,
    carbs: acc.carbs + (m.carbs || 0) * m.portions,
    fat: acc.fat + (m.fat || 0) * m.portions,
    calories: acc.calories + (m.calories || 0) * m.portions,
  }), { protein: 0, carbs: 0, fat: 0, calories: 0 });

  const filtered = foods.filter((f) => {
    const ms = f.name.toLowerCase().includes(search.toLowerCase());
    const mc = catFilter === "All" || f.category === catFilter;
    return ms && mc;
  });

  const categories = ["All", "Protein", "Carb", "Fat", "RTD Protein", "Snack", "Meal", "Misc"];

  return (
    <div style={{ padding: "20px 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
        <span style={{ color: C.accent }}>FUEL</span>LOG
      </h1>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 16px" }}>Lean Bulk · {macroTargets.calories} cal target</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Protein", val: Math.round(totals.protein), tgt: macroTargets.protein, unit: "g", color: C.green },
          { label: "Carbs", val: Math.round(totals.carbs), tgt: macroTargets.carbs, unit: "g", color: C.blue },
          { label: "Fat", val: Math.round(totals.fat), tgt: macroTargets.fat, unit: "g", color: C.amber },
          { label: "Cals", val: Math.round(totals.calories), tgt: macroTargets.calories, unit: "", color: C.purple },
        ].map((m) => {
          const pct = Math.round((m.val / m.tgt) * 100);
          return (
            <div key={m.label} style={{ background: C.surface, borderRadius: 12, padding: "12px 8px", textAlign: "center", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: pct > 100 ? C.red : m.color }}>{m.val}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>/ {m.tgt}{m.unit}</div>
              <div style={{ width: "100%", height: 3, background: C.border, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: m.color, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</div>
            </div>
          );
        })}
      </div>

      <button onClick={() => setShowSearch(!showSearch)}
        style={{ width: "100%", padding: "12px", background: showSearch ? C.hover : C.accent + "12", border: `1px solid ${showSearch ? C.border : C.accent}33`, borderRadius: 10, color: showSearch ? C.muted : C.accent, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
        {showSearch ? "✕ Close" : "+ Add Food"}
      </button>

      {showSearch && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 12, marginBottom: 12 }}>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search foods..."
            style={{ ...inputStyle, width: "100%", marginBottom: 8, boxSizing: "border-box" }} autoFocus />
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {categories.map((c) => (
              <button key={c} onClick={() => setCatFilter(c)}
                style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${catFilter === c ? C.accent : C.border}`, background: catFilter === c ? C.accent + "18" : "transparent", color: catFilter === c ? C.accent : C.muted, fontSize: 11, cursor: "pointer" }}>
                {c}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {foods.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>
                Food database is empty. We'll import your 200+ foods next!
              </div>
            ) : (
              filtered.map((f) => (
                <button key={f.id} onClick={() => addFood(f)}
                  style={{ width: "100%", padding: "10px 8px", background: "none", border: "none", borderBottom: `1px solid ${C.border}`, color: C.text, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{f.portion_size} {f.portion_unit}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.green }}>{f.protein_g}p</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{f.calories} cal</div>
                  </div>
                </button>
              ))
            )}
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
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                  {Math.round(m.protein * m.portions)}p · {Math.round(m.carbs * m.portions)}c · {Math.round(m.fat * m.portions)}f · {Math.round(m.calories * m.portions)} cal
                </div>
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

      {mealLog.length === 0 && !showSearch && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
          <div style={{ fontSize: 14 }}>No meals logged today</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Tap "+ Add Food" to start tracking</div>
        </div>
      )}
    </div>
  );
}


// ─── MEASUREMENTS ────────────────────────────────────────────────
function MeasurementsView({ measurements, onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ measure_date: new Date().toISOString().split("T")[0], bodyweight_lb: "", chest_in: "", waist_in: "", hips_in: "", r_arm_in: "", l_arm_in: "", neck_in: "" });

  async function save() {
    if (!form.bodyweight_lb) return;
    const entry = {};
    Object.entries(form).forEach(([k, v]) => {
      entry[k] = k === "measure_date" ? v : (parseFloat(v) || null);
    });
    const { data } = await supabase.from("measurements").insert(entry).select().single();
    if (data) {
      onAdd(data);
      setShowForm(false);
      setForm({ measure_date: new Date().toISOString().split("T")[0], bodyweight_lb: "", chest_in: "", waist_in: "", hips_in: "", r_arm_in: "", l_arm_in: "", neck_in: "" });
    }
  }

  const latest = measurements[measurements.length - 1];

  return (
    <div style={{ padding: "20px 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
        <span style={{ color: C.accent }}>BODY</span>TRACK
      </h1>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 16px" }}>Measurements & body composition</p>

      {latest && (
        <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Latest · {latest.measure_date}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Weight", val: latest.bodyweight_lb, unit: "lb" },
              { label: "Chest", val: latest.chest_in, unit: "in" },
              { label: "Waist", val: latest.waist_in, unit: "in" },
              { label: "Hips", val: latest.hips_in, unit: "in" },
              { label: "R Arm", val: latest.r_arm_in, unit: "in" },
              { label: "L Arm", val: latest.l_arm_in, unit: "in" },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{s.val ?? "—"}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{s.unit}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => setShowForm(!showForm)}
        style={{ width: "100%", padding: "12px", background: C.accent + "12", border: `1px solid ${C.accent}33`, borderRadius: 10, color: C.accent, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
        {showForm ? "✕ Cancel" : "+ New Measurement"}
      </button>

      {showForm && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { key: "measure_date", label: "Date", type: "date" },
              { key: "bodyweight_lb", label: "Weight (lb)", type: "number" },
              { key: "chest_in", label: "Chest (in)", type: "number" },
              { key: "waist_in", label: "Waist (in)", type: "number" },
              { key: "hips_in", label: "Hips (in)", type: "number" },
              { key: "r_arm_in", label: "R Arm (in)", type: "number" },
              { key: "l_arm_in", label: "L Arm (in)", type: "number" },
              { key: "neck_in", label: "Neck (in)", type: "number" },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.label}</label>
                <input type={f.type} inputMode={f.type === "number" ? "decimal" : undefined} value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginTop: 4 }} />
              </div>
            ))}
          </div>
          <button onClick={save}
            style={{ width: "100%", padding: "12px", marginTop: 12, background: C.accent, border: "none", borderRadius: 8, color: C.bg, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Save Measurement
          </button>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>History</div>
      {[...measurements].reverse().map((m) => (
        <div key={m.id} style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted }}>{m.measure_date}</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{m.bodyweight_lb} lb</div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
            {m.chest_in && <span>Ch:{m.chest_in} </span>}
            {m.waist_in && <span>W:{m.waist_in} </span>}
            {m.r_arm_in && <span>Arm:{m.r_arm_in}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}


// ─── PROGRESS ────────────────────────────────────────────────────
function ProgressView({ measurements }) {
  const [prs, setPrs] = useState([]);

  useEffect(() => {
    loadPRs();
  }, []);

  async function loadPRs() {
    // Get best performance per exercise from workout_sets
    const { data } = await supabase
      .from("workout_sets")
      .select("exercise_id, weight_lb, reps, exercises(name)")
      .order("weight_lb", { ascending: false });

    if (data) {
      const best = {};
      data.forEach((s) => {
        const name = s.exercises?.name;
        if (!name || !s.weight_lb || !s.reps) return;
        if (!best[name] || s.weight_lb > best[name].weight || (s.weight_lb === best[name].weight && s.reps > best[name].reps)) {
          best[name] = { exercise: name, weight: s.weight_lb, reps: s.reps, est1rm: s.weight_lb * (1 + s.reps / 30) };
        }
      });
      setPrs(Object.values(best).sort((a, b) => b.est1rm - a.est1rm));
    }
  }

  const weightData = measurements.filter((m) => m.bodyweight_lb);

  return (
    <div style={{ padding: "20px 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
        <span style={{ color: C.accent }}>PR</span>BOARD
      </h1>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 16px" }}>Personal records & progress</p>

      {weightData.length > 1 && (
        <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Bodyweight Trend</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
            {weightData.map((m) => {
              const min = Math.min(...weightData.map((d) => d.bodyweight_lb));
              const max = Math.max(...weightData.map((d) => d.bodyweight_lb));
              const range = max - min || 1;
              const height = ((m.bodyweight_lb - min) / range) * 50 + 10;
              return (
                <div key={m.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: C.text }}>{m.bodyweight_lb}</span>
                  <div style={{ width: "100%", height, background: C.accent, borderRadius: 4, maxWidth: 40 }} />
                  <span style={{ fontSize: 8, color: C.muted }}>{m.measure_date?.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {prs.length > 0 ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>All-Time Personal Records</div>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", gap: 0, marginBottom: 8 }}>
            {["Exercise", "Best", "Reps", "E1RM"].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>{h}</div>
            ))}
          </div>
          {prs.map((pr) => (
            <div key={pr.exercise} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{pr.exercise}</div>
              <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.accent }}>{pr.weight}</div>
              <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.muted }}>{pr.reps}</div>
              <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.green }}>{Math.round(pr.est1rm)}</div>
            </div>
          ))}
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
          <div style={{ fontSize: 14 }}>No PRs yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Log your first workout to start tracking records</div>
        </div>
      )}
    </div>
  );
}


// ─── STYLES ──────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "10px 8px", background: C.hover, border: `1px solid ${C.border}`,
  borderRadius: 8, color: C.text, fontSize: 15, fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 500, outline: "none", textAlign: "center", boxSizing: "border-box",
};
const smallBtn = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.muted, fontSize: 14, cursor: "pointer", width: 32, height: 32,
  display: "flex", alignItems: "center", justifyContent: "center",
};
const tinyBtn = {
  background: C.hover, border: `1px solid ${C.border}`, borderRadius: 6,
  color: C.muted, fontSize: 14, cursor: "pointer", width: 26, height: 26,
  display: "flex", alignItems: "center", justifyContent: "center",
};
const hdrLabel = {
  fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em",
};
