import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

const C = { bg:"#111113", sf:"#19191d", sf2:"#222228", bd:"#2c2c34", tx:"#cdcdd0", mt:"#6b6b76", ac:"#7c8aff", gn:"#5cb87a", rd:"#d4544e", am:"#c9a84c", bl:"#5b9bd5" };
const mono = "'JetBrains Mono', monospace";
const sans = "'DM Sans', sans-serif";
const inp = { width:"100%", padding:"10px 8px", background:C.sf2, border:`1px solid ${C.bd}`, borderRadius:8, color:C.tx, fontSize:15, fontFamily:mono, fontWeight:500, outline:"none", textAlign:"center", boxSizing:"border-box" };
const sbtn = { background:C.sf, border:`1px solid ${C.bd}`, borderRadius:8, color:C.mt, fontSize:14, cursor:"pointer", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center" };
const tbtn = { background:C.sf2, border:`1px solid ${C.bd}`, borderRadius:6, color:C.mt, fontSize:14, cursor:"pointer", width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center" };
const hlbl = { fontSize:9, fontWeight:600, color:C.mt, textTransform:"uppercase", letterSpacing:"0.08em" };
const ROTATION = ["Lower A","Upper A","Rest","Lower B","Upper B","Arms & Delts","Rest"];
const WEEK_TYPES = ["Learning","Accumulation","Deload","Peak"];
const GOALS = [{name:"Cut",cpl:12},{name:"Maintain",cpl:14},{name:"Lean Bulk",cpl:16},{name:"Bulk",cpl:18}];

function Timer({ duration, onDismiss }) {
  const [rem, setRem] = useState(duration);
  const [on, setOn] = useState(true);
  const ref = useRef(null);
  useEffect(() => {
    if (on && rem > 0) { ref.current = setInterval(() => setRem(r => { if (r <= 1) { clearInterval(ref.current); setOn(false); if (navigator.vibrate) navigator.vibrate([200,100,200,100,200]); return 0; } return r-1; }), 1000); }
    return () => clearInterval(ref.current);
  }, [on]);
  const m = Math.floor(rem/60), s = rem%60, pct = ((duration-rem)/duration)*100, done = rem===0;
  return (
    <div style={{ background:done?C.gn+"12":C.sf2, border:`1px solid ${done?C.gn+"33":C.bd}`, borderRadius:10, padding:"10px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
          <span style={{ fontSize:22, fontWeight:700, fontFamily:mono, color:done?C.gn:C.tx }}>{done?"Ready":`${m}:${String(s).padStart(2,"0")}`}</span>
          <span style={{ fontSize:11, color:C.mt }}>{done?"":"resting"}</span>
        </div>
        <div style={{ width:"100%", height:2, background:C.bd, borderRadius:1, marginTop:6, overflow:"hidden" }}>
          <div style={{ width:`${pct}%`, height:"100%", background:done?C.gn:C.ac, borderRadius:1, transition:"width 1s linear" }} />
        </div>
      </div>
      <div style={{ display:"flex", gap:4 }}>
        {!done && <button onClick={() => setRem(r=>r+30)} style={{ padding:"5px 8px", background:C.sf, border:`1px solid ${C.bd}`, borderRadius:6, color:C.mt, fontSize:11, cursor:"pointer" }}>+30s</button>}
        <button onClick={onDismiss} style={{ padding:"5px 10px", background:done?C.gn+"15":C.sf, border:`1px solid ${done?C.gn+"33":C.bd}`, borderRadius:6, color:done?C.gn:C.mt, fontSize:11, fontWeight:600, cursor:"pointer" }}>{done?"Continue":"Skip"}</button>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("train");
  const [days, setDays] = useState([]);
  const [foods, setFoods] = useState([]);
  const [mt, setMt] = useState({ protein:174, carbs:484, fat:72, calories:3280 });
  const [meas, setMeas] = useState([]);
  const [selDay, setSelDay] = useState(null);
  const [week, setWeek] = useState(12);
  const [loading, setLoading] = useState(true);
  const [restDur, setRestDur] = useState(120);
  const [weekType, setWeekType] = useState("Accumulation");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: d } = await supabase.from("training_days").select("*, training_day_exercises(*, exercises(*))").order("day_order");
    if (d) setDays(d.map(x => ({ id:x.id, name:x.name, focus:x.focus, exercises:(x.training_day_exercises||[]).sort((a,b)=>a.exercise_order-b.exercise_order).map(t=>({ id:t.exercises.id, name:t.exercises.name, sets:t.default_sets, repMin:t.exercises.rep_min, repMax:t.exercises.rep_max, increment:parseFloat(t.exercises.increment_lb)||2.5, category:t.exercises.category, cues:t.exercises.cues, muscle:t.exercises.primary_muscle, video:t.exercises.video_url })) })));
    const { data: fd } = await supabase.from("foods").select("*").order("name");
    if (fd) setFoods(fd);
    const { data: tg } = await supabase.from("macro_targets").select("*").eq("is_active",true).limit(1);
    if (tg?.[0]) setMt({ protein:tg[0].protein_g_target, carbs:tg[0].carbs_g_target, fat:tg[0].fat_g_target, calories:tg[0].calories_target });
    const { data: ms } = await supabase.from("measurements").select("*").order("measure_date");
    if (ms) setMeas(ms);
    setLoading(false);
  }

  if (loading) return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:sans }}>
      <div style={{ textAlign:"center" }}><div style={{ fontSize:14, fontWeight:600, color:C.ac, letterSpacing:"0.15em" }}>IRONLOG</div><div style={{ fontSize:12, color:C.mt, marginTop:6 }}>Loading...</div></div>
    </div>
  );

  const tabs = [{id:"train",l:"Train"},{id:"fuel",l:"Fuel"},{id:"body",l:"Body"},{id:"stats",l:"Stats"}];
  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.tx, fontFamily:sans, maxWidth:480, margin:"0 auto", paddingBottom:72 }}>
      {tab==="train" && !selDay && <DaySelect days={days} onSelect={setSelDay} week={week} setWeek={setWeek} restDur={restDur} setRestDur={setRestDur} weekType={weekType} setWeekType={setWeekType} />}
      {tab==="train" && selDay && <Session day={selDay} onBack={()=>setSelDay(null)} week={week} restDur={restDur} weekType={weekType} />}
      {tab==="fuel" && <Fuel foods={foods} mt={mt} setMt={setMt} />}
      {tab==="body" && <Body meas={meas} onAdd={m=>setMeas(p=>[...p,m].sort((a,b)=>a.measure_date.localeCompare(b.measure_date)))} />}
      {tab==="stats" && <Stats meas={meas} days={days} week={week} />}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:C.sf, borderTop:`1px solid ${C.bd}`, display:"flex", zIndex:100 }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);if(t.id!=="train")setSelDay(null);}} style={{ flex:1, padding:"12px 0 10px", background:"none", border:"none", color:tab===t.id?C.ac:C.mt, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", cursor:"pointer", fontFamily:sans }}>{t.l}</button>
        ))}
      </div>
    </div>
  );
}

function DaySelect({ days, onSelect, week, setWeek, restDur, setRestDur, weekType, setWeekType }) {
  const [showCfg, setShowCfg] = useState(false);
  return (
    <div style={{ padding:"24px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2 }}>
        <div style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.01em" }}>IRON<span style={{ color:C.ac }}>LOG</span></div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={()=>setShowCfg(!showCfg)} style={{ ...sbtn, fontSize:11, color:showCfg?C.ac:C.mt }}>cfg</button>
          <button onClick={()=>setWeek(w=>Math.max(1,w-1))} style={sbtn}>&lt;</button>
          <span style={{ fontFamily:mono, fontSize:13, color:C.mt, minWidth:44, textAlign:"center" }}>W{week}</span>
          <button onClick={()=>setWeek(w=>w+1)} style={sbtn}>&gt;</button>
        </div>
      </div>
      <div style={{ fontSize:12, color:C.mt, marginBottom:16 }}>{weekType} phase</div>

      {showCfg && (
        <div style={{ background:C.sf, borderRadius:10, border:`1px solid ${C.bd}`, padding:14, marginBottom:14 }}>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.mt, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Week Phase</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {WEEK_TYPES.map(t=>(
                <button key={t} onClick={()=>setWeekType(t)} style={{ padding:"6px 12px", borderRadius:6, border:`1px solid ${weekType===t?C.ac:C.bd}`, background:weekType===t?C.ac+"15":"transparent", color:weekType===t?C.ac:C.mt, fontSize:12, cursor:"pointer" }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, fontWeight:600, color:C.mt, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Rest Timer</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {[60,90,120,150,180,240].map(t=>(
                <button key={t} onClick={()=>setRestDur(t)} style={{ padding:"6px 12px", borderRadius:6, border:`1px solid ${restDur===t?C.ac:C.bd}`, background:restDur===t?C.ac+"15":"transparent", color:restDur===t?C.ac:C.mt, fontSize:12, fontFamily:mono, cursor:"pointer" }}>{Math.floor(t/60)}:{String(t%60).padStart(2,"0")}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {ROTATION.map((dn,i)=>{
          if (dn==="Rest") return <div key={`r${i}`} style={{ padding:"12px 16px", background:C.sf, borderRadius:10, border:`1px solid ${C.bd}`, opacity:0.4 }}><span style={{ fontSize:12, color:C.mt }}>Day {i+1} — Rest</span></div>;
          const day = days.find(d=>d.name===dn);
          if (!day) return null;
          return (
            <button key={dn} onClick={()=>onSelect(day)} style={{ padding:"14px 16px", background:C.sf, borderRadius:10, border:`1px solid ${C.bd}`, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ fontFamily:mono, fontSize:13, fontWeight:600, color:C.mt, width:20 }}>{i+1}</div>
              <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:600, color:C.tx }}>{day.name}</div><div style={{ fontSize:11, color:C.mt, marginTop:2 }}>{day.focus}</div></div>
              <span style={{ color:C.mt+"88", fontSize:14 }}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Session({ day, onBack, week, restDur, weekType }) {
  const [expEx, setExpEx] = useState(0);
  const [showCues, setShowCues] = useState(null);
  const [sd, setSd] = useState({});
  const [sid, setSid] = useState(null);
  const [saved, setSaved] = useState(null);
  const [timer, setTimer] = useState(false);
  const [tk, setTk] = useState(0);
  const [lw, setLw] = useState({});

  useEffect(() => { init(); loadLast(); }, [day.id, week]);

  async function loadLast() {
    const p = week-1; if (p<1) return;
    const { data } = await supabase.from("workout_sessions").select("id, workout_sets(exercise_id, weight_lb, reps)").eq("week_number",p).eq("training_day_id",day.id).limit(1);
    if (data?.[0]) {
      const byE = {};
      data[0].workout_sets.forEach(w => { if (!byE[w.exercise_id]) byE[w.exercise_id]=[]; byE[w.exercise_id].push(w); });
      const prog = {};
      Object.entries(byE).forEach(([eid, sets]) => {
        const v = sets.filter(s=>s.reps>0&&s.weight_lb>0);
        if (!v.length) return;
        const avg = v.reduce((s,x)=>s+x.reps,0)/v.length;
        const mw = Math.max(...v.map(s=>s.weight_lb));
        const ex = day.exercises.find(e=>e.id===parseInt(eid));
        const hit = ex && avg >= ex.repMax;
        prog[eid] = { w:mw, r:avg, up:hit, sw:hit&&ex?mw+ex.increment:mw };
      });
      setLw(prog);
    }
  }

  async function init() {
    const { data } = await supabase.from("workout_sessions").select("id, workout_sets(*)").eq("week_number",week).eq("training_day_id",day.id).limit(1);
    if (data?.[0]) {
      setSid(data[0].id);
      const l = {};
      data[0].workout_sets.forEach(w => { l[`${w.exercise_id}-${w.set_number}`] = { weight:w.weight_lb||0, reps:w.reps||0, dbId:w.id }; });
      setSd(l);
    } else {
      const { data: n } = await supabase.from("workout_sessions").insert({ week_number:week, training_day_id:day.id, session_date:new Date().toISOString().split("T")[0], week_type:weekType }).select().single();
      if (n) setSid(n.id);
    }
  }

  function gs(eid,sn) { return sd[`${eid}-${sn}`]||{weight:0,reps:0}; }
  function ul(eid,sn,f,v) { const k=`${eid}-${sn}`; setSd(p=>({...p,[k]:{...p[k],weight:p[k]?.weight||0,reps:p[k]?.reps||0,[f]:parseFloat(v)||0}})); }
  async function sv(eid,sn) {
    if (!sid) return; const k=`${eid}-${sn}`, d=sd[k]; if(!d||(!d.weight&&!d.reps)) return;
    if (d.dbId) await supabase.from("workout_sets").update({weight_lb:d.weight,reps:d.reps}).eq("id",d.dbId);
    else { const{data:ins}=await supabase.from("workout_sets").insert({session_id:sid,exercise_id:eid,set_number:sn,weight_lb:d.weight,reps:d.reps}).select().single(); if(ins) setSd(p=>({...p,[k]:{...p[k],dbId:ins.id}})); }
    setSaved(new Date().toLocaleTimeString());
    if (d.reps>0) { setTimer(true); setTk(t=>t+1); }
  }
  function fill(eid,n,w) { const u={}; for(let i=1;i<=n;i++){const k=`${eid}-${i}`;u[k]={...sd[k],weight:w,reps:sd[k]?.reps||0,dbId:sd[k]?.dbId};} setSd(p=>({...p,...u})); }
  function done(eid,n) { let c=0; for(let i=1;i<=n;i++) if(sd[`${eid}-${i}`]?.reps>0) c++; return c; }

  return (
    <div style={{ padding:"20px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
        <button onClick={onBack} style={{ ...sbtn, fontSize:14, width:36, height:36 }}>&lt;</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:700 }}>{day.name}</div>
          <div style={{ fontSize:11, color:C.mt }}>Week {week} · {weekType} · {day.focus}</div>
        </div>
        {saved && <div style={{ fontSize:9, color:C.gn, fontFamily:mono }}>{saved}</div>}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {day.exercises.map((ex,xi)=>{
          const isE=expEx===xi, dn=done(ex.id,ex.sets), all=dn===ex.sets, pg=lw[ex.id];
          return (
            <div key={ex.id} style={{ background:C.sf, borderRadius:10, border:`1px solid ${all?C.gn+"28":C.bd}`, overflow:"hidden" }}>
              <button onClick={()=>setExpEx(isE?-1:xi)} style={{ width:"100%", padding:"12px 14px", background:"none", border:"none", color:C.tx, cursor:"pointer", display:"flex", alignItems:"center", gap:10, textAlign:"left" }}>
                <div style={{ fontFamily:mono, fontSize:12, fontWeight:600, color:all?C.gn:C.mt, width:20, textAlign:"center" }}>{all?"✓":xi+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ex.name}</div>
                  <div style={{ fontSize:11, color:C.mt, marginTop:1 }}>{ex.sets} × {ex.repMin}–{ex.repMax}{dn>0&&<span style={{color:all?C.gn:C.am}}> · {dn}/{ex.sets}</span>}</div>
                </div>
                {pg?.up && !all && <span style={{ fontSize:9, fontWeight:600, color:C.gn, background:C.gn+"12", padding:"2px 6px", borderRadius:4 }}>+{ex.increment}</span>}
                <span style={{ color:C.mt+"66", transform:isE?"rotate(90deg)":"none", transition:"transform 0.15s", fontSize:14 }}>›</span>
              </button>

              {isE && (
                <div style={{ padding:"0 14px 14px" }}>
                  {/* Cues + Video */}
                  <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                    <button onClick={()=>setShowCues(showCues===xi?null:xi)} style={{ flex:1, padding:"7px 10px", background:C.sf2, border:`1px solid ${C.bd}`, borderRadius:6, color:C.mt, fontSize:11, cursor:"pointer", textAlign:"left" }}>
                      {showCues===xi?ex.cues:"View setup cues"}
                    </button>
                    {ex.video && <a href={ex.video} target="_blank" rel="noopener noreferrer" style={{ padding:"7px 10px", background:C.sf2, border:`1px solid ${C.bd}`, borderRadius:6, color:C.ac, fontSize:11, textDecoration:"none", display:"flex", alignItems:"center" }}>Watch</a>}
                  </div>

                  {/* Progression */}
                  {pg?.up && (
                    <div style={{ padding:"7px 10px", marginBottom:8, background:C.gn+"08", border:`1px solid ${C.gn}22`, borderRadius:6, fontSize:11 }}>
                      <span style={{ color:C.gn }}>Progression: </span>
                      <span style={{ color:C.tx }}>Last week {pg.r.toFixed(1)} avg reps at {pg.w}lb. </span>
                      <span style={{ color:C.gn, fontWeight:600 }}>Try {pg.sw}lb</span>
                    </div>
                  )}
                  {pg && !pg.up && <div style={{ padding:"5px 10px", marginBottom:8, background:C.sf2, borderRadius:6, fontSize:11, color:C.mt }}>Last week: {pg.w}lb · {pg.r.toFixed(1)} avg reps</div>}

                  {/* Fill buttons */}
                  <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                    {pg?.up ? (<>
                      <button onClick={()=>fill(ex.id,ex.sets,pg.sw)} style={{ padding:"5px 10px", background:C.gn+"10", border:`1px solid ${C.gn}33`, borderRadius:6, color:C.gn, fontSize:11, fontWeight:600, cursor:"pointer" }}>Fill {pg.sw}lb</button>
                      <button onClick={()=>fill(ex.id,ex.sets,pg.w)} style={{ padding:"5px 10px", background:C.sf2, border:`1px solid ${C.bd}`, borderRadius:6, color:C.mt, fontSize:11, cursor:"pointer" }}>Keep {pg.w}lb</button>
                    </>) : (
                      <button onClick={()=>fill(ex.id,ex.sets,pg?.w||0)} style={{ padding:"5px 10px", background:C.sf2, border:`1px solid ${C.bd}`, borderRadius:6, color:C.mt, fontSize:11, cursor:"pointer" }}>Fill {pg?.w||0}lb</button>
                    )}
                  </div>

                  {timer && <Timer key={tk} duration={restDur} onDismiss={()=>setTimer(false)} />}

                  <div style={{ display:"grid", gridTemplateColumns:"32px 1fr 1fr 44px", gap:5, marginBottom:4 }}>
                    <span style={hlbl}>Set</span><span style={hlbl}>Weight</span><span style={hlbl}>Reps</span><span style={hlbl}></span>
                  </div>
                  {Array.from({length:ex.sets},(_,i)=>{
                    const sn=i+1, s=gs(ex.id,sn), ok=s.reps>0, hi=s.reps>ex.repMax, lo=s.reps>0&&s.reps<ex.repMin;
                    return (
                      <div key={i} style={{ display:"grid", gridTemplateColumns:"32px 1fr 1fr 44px", gap:5, marginBottom:5, alignItems:"center" }}>
                        <div style={{ fontFamily:mono, fontSize:12, fontWeight:600, color:ok?C.gn:C.mt, textAlign:"center" }}>{sn}</div>
                        <input type="number" inputMode="decimal" value={s.weight||""} placeholder="lbs" onChange={e=>ul(ex.id,sn,"weight",e.target.value)} onBlur={()=>sv(ex.id,sn)} style={inp} />
                        <input type="number" inputMode="numeric" value={s.reps||""} placeholder={`${ex.repMin}-${ex.repMax}`} onChange={e=>ul(ex.id,sn,"reps",e.target.value)} onBlur={()=>sv(ex.id,sn)} style={{...inp, borderColor:hi?C.gn+"55":lo?C.rd+"55":C.bd}} />
                        <div style={{ fontSize:9, fontFamily:mono, color:hi?C.gn:lo?C.rd:C.mt, textAlign:"center" }}>{hi?"PR":lo?"low":ok?"ok":""}</div>
                      </div>
                    );
                  })}
                  {xi<day.exercises.length-1 && <button onClick={()=>{setExpEx(xi+1);setTimer(false);}} style={{ width:"100%", padding:"9px", marginTop:4, background:C.ac+"10", border:`1px solid ${C.ac}25`, borderRadius:8, color:C.ac, fontSize:12, fontWeight:600, cursor:"pointer" }}>Next exercise</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Fuel({ foods, mt, setMt }) {
  const [log, setLog] = useState([]);
  const [search, setSearch] = useState("");
  const [showS, setShowS] = useState(false);
  const [cat, setCat] = useState("All");
  const [showCalc, setShowCalc] = useState(false);
  const [calcW, setCalcW] = useState("205");
  const [calcG, setCalcG] = useState("Lean Bulk");
  const [calcP, setCalcP] = useState("0.85");
  const [calcF, setCalcF] = useState("0.35");
  const [td] = useState(new Date().toISOString().split("T")[0]);

  useEffect(()=>{ loadLog(); },[]);
  async function loadLog() {
    const { data } = await supabase.from("meal_log").select("*, foods(*)").eq("log_date",td).order("created_at");
    if (data) setLog(data.map(m=>({ id:m.id, food:m.foods?.name||"?", portions:parseFloat(m.portions), protein:m.foods?.protein_g||0, carbs:m.foods?.carbs_g||0, fat:m.foods?.fat_g||0, calories:m.foods?.calories||0 })));
  }
  async function add(f) {
    const { data:ins } = await supabase.from("meal_log").insert({ log_date:td, food_id:f.id, portions:1 }).select().single();
    if (ins) setLog(p=>[...p,{ id:ins.id, food:f.name, portions:1, protein:f.protein_g, carbs:f.carbs_g, fat:f.fat_g, calories:f.calories }]);
    setShowS(false); setSearch("");
  }
  async function rm(i) { const e=log[i]; if(e?.id) await supabase.from("meal_log").delete().eq("id",e.id); setLog(p=>p.filter((_,x)=>x!==i)); }
  async function up(i,pt) { const np=Math.max(0.25,pt), e=log[i]; if(e?.id) await supabase.from("meal_log").update({portions:np}).eq("id",e.id); setLog(p=>p.map((m,x)=>x===i?{...m,portions:np}:m)); }

  const tot = log.reduce((a,m)=>({protein:a.protein+(m.protein||0)*m.portions, carbs:a.carbs+(m.carbs||0)*m.portions, fat:a.fat+(m.fat||0)*m.portions, calories:a.calories+(m.calories||0)*m.portions}),{protein:0,carbs:0,fat:0,calories:0});
  const flt = foods.filter(f=>f.name.toLowerCase().includes(search.toLowerCase())&&(cat==="All"||f.category===cat));

  function recalc() {
    const w = parseFloat(calcW)||205;
    const goal = GOALS.find(g=>g.name===calcG)||GOALS[2];
    const pr = parseFloat(calcP)||0.85;
    const ft = parseFloat(calcF)||0.35;
    const cal = Math.round(w * goal.cpl);
    const protein = Math.round(w * pr);
    const fat = Math.round(w * ft);
    const carbs = Math.round((cal - protein*4 - fat*9) / 4);
    setMt({ protein, carbs, fat, calories:cal });
    // Update in DB
    supabase.from("macro_targets").update({ protein_g_target:protein, carbs_g_target:carbs, fat_g_target:fat, calories_target:cal, bodyweight_lb:w, goal_name:calcG }).eq("is_active",true);
    setShowCalc(false);
  }

  return (
    <div style={{ padding:"24px 16px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div><div style={{ fontSize:20, fontWeight:700 }}>Fuel</div><div style={{ fontSize:11, color:C.mt }}>{calcG} · {mt.calories} cal</div></div>
        <button onClick={()=>setShowCalc(!showCalc)} style={{ padding:"6px 12px", background:C.sf, border:`1px solid ${C.bd}`, borderRadius:6, color:showCalc?C.ac:C.mt, fontSize:11, cursor:"pointer" }}>Calculator</button>
      </div>

      {showCalc && (
        <div style={{ background:C.sf, borderRadius:10, border:`1px solid ${C.bd}`, padding:14, marginBottom:14 }}>
          <div style={{ fontSize:10, fontWeight:600, color:C.mt, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Macro Calculator</div>
          <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
            {GOALS.map(g=>(
              <button key={g.name} onClick={()=>setCalcG(g.name)} style={{ padding:"5px 10px", borderRadius:6, border:`1px solid ${calcG===g.name?C.ac:C.bd}`, background:calcG===g.name?C.ac+"15":"transparent", color:calcG===g.name?C.ac:C.mt, fontSize:11, cursor:"pointer" }}>{g.name}</button>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
            <div><div style={{ fontSize:9, color:C.mt, textTransform:"uppercase", marginBottom:4 }}>Weight (lb)</div><input type="number" value={calcW} onChange={e=>setCalcW(e.target.value)} style={{...inp}} /></div>
            <div><div style={{ fontSize:9, color:C.mt, textTransform:"uppercase", marginBottom:4 }}>Protein/lb</div><input type="number" value={calcP} onChange={e=>setCalcP(e.target.value)} style={{...inp}} /></div>
            <div><div style={{ fontSize:9, color:C.mt, textTransform:"uppercase", marginBottom:4 }}>Fat/lb</div><input type="number" value={calcF} onChange={e=>setCalcF(e.target.value)} style={{...inp}} /></div>
          </div>
          <button onClick={recalc} style={{ width:"100%", padding:"10px", background:C.ac, border:"none", borderRadius:8, color:C.bg, fontSize:13, fontWeight:700, cursor:"pointer" }}>Update Targets</button>
        </div>
      )}

      {/* Macro bars */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:14 }}>
        {[{l:"Protein",v:Math.round(tot.protein),t:mt.protein,u:"g",c:C.gn},{l:"Carbs",v:Math.round(tot.carbs),t:mt.carbs,u:"g",c:C.bl},{l:"Fat",v:Math.round(tot.fat),t:mt.fat,u:"g",c:C.am},{l:"Cal",v:Math.round(tot.calories),t:mt.calories,u:"",c:C.ac}].map(m=>{
          const p=Math.round((m.v/m.t)*100);
          return (
            <div key={m.l} style={{ background:C.sf, borderRadius:10, padding:"10px 6px", textAlign:"center", border:`1px solid ${C.bd}` }}>
              <div style={{ fontSize:16, fontWeight:700, fontFamily:mono, color:p>100?C.rd:m.c }}>{m.v}</div>
              <div style={{ fontSize:9, color:C.mt }}>/ {m.t}{m.u}</div>
              <div style={{ width:"100%", height:2, background:C.bd, borderRadius:1, marginTop:5, overflow:"hidden" }}><div style={{ width:`${Math.min(p,100)}%`, height:"100%", background:m.c, borderRadius:1 }} /></div>
              <div style={{ fontSize:8, color:C.mt, marginTop:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>{m.l}</div>
            </div>
          );
        })}
      </div>

      <button onClick={()=>setShowS(!showS)} style={{ width:"100%", padding:"10px", background:showS?C.sf2:C.ac+"10", border:`1px solid ${showS?C.bd:C.ac}25`, borderRadius:8, color:showS?C.mt:C.ac, fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:12 }}>{showS?"Close":"Add food"}</button>

      {showS && (
        <div style={{ background:C.sf, borderRadius:10, border:`1px solid ${C.bd}`, padding:12, marginBottom:12 }}>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{...inp, marginBottom:8, textAlign:"left", paddingLeft:12}} autoFocus />
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:8 }}>
            {["All","Protein","Carb","Fat","RTD Protein","Snack","Meal","Misc"].map(c=>(
              <button key={c} onClick={()=>setCat(c)} style={{ padding:"3px 8px", borderRadius:12, border:`1px solid ${cat===c?C.ac:C.bd}`, background:cat===c?C.ac+"12":"transparent", color:cat===c?C.ac:C.mt, fontSize:10, cursor:"pointer" }}>{c}</button>
            ))}
          </div>
          <div style={{ maxHeight:220, overflowY:"auto" }}>
            {flt.length===0?<div style={{padding:16,textAlign:"center",color:C.mt,fontSize:12}}>No foods found</div>:
            flt.map(f=>(
              <button key={f.id} onClick={()=>add(f)} style={{ width:"100%", padding:"8px 6px", background:"none", border:"none", borderBottom:`1px solid ${C.bd}`, color:C.tx, cursor:"pointer", textAlign:"left", display:"flex", justifyContent:"space-between" }}>
                <div><div style={{ fontSize:12 }}>{f.name}</div><div style={{ fontSize:10, color:C.mt }}>{f.portion_size} {f.portion_unit}</div></div>
                <div style={{ textAlign:"right" }}><div style={{ fontSize:11, fontFamily:mono, color:C.gn }}>{f.protein_g}p</div><div style={{ fontSize:9, color:C.mt }}>{f.calories}cal</div></div>
              </button>
            ))}
          </div>
        </div>
      )}

      {log.length>0 && (
        <div>
          <div style={{ fontSize:10, fontWeight:600, color:C.mt, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Today</div>
          {log.map((m,i)=>(
            <div key={m.id||i} style={{ background:C.sf, borderRadius:8, border:`1px solid ${C.bd}`, padding:"8px 12px", marginBottom:5, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.food}</div>
                <div style={{ fontSize:10, color:C.mt, fontFamily:mono }}>{Math.round(m.protein*m.portions)}p · {Math.round(m.carbs*m.portions)}c · {Math.round(m.fat*m.portions)}f · {Math.round(m.calories*m.portions)}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                <button onClick={()=>up(i,m.portions-0.5)} style={tbtn}>-</button>
                <span style={{ fontSize:12, fontFamily:mono, width:24, textAlign:"center" }}>{m.portions}</span>
                <button onClick={()=>up(i,m.portions+0.5)} style={tbtn}>+</button>
              </div>
              <button onClick={()=>rm(i)} style={{ background:"none", border:"none", color:C.rd, fontSize:14, cursor:"pointer", padding:"2px" }}>×</button>
            </div>
          ))}
        </div>
      )}
      {log.length===0&&!showS&&<div style={{textAlign:"center",padding:"36px 20px",color:C.mt}}><div style={{fontSize:13}}>No meals logged today</div></div>}
    </div>
  );
}

function Body({ meas, onAdd }) {
  const [showF, setShowF] = useState(false);
  const [fm, setFm] = useState({measure_date:new Date().toISOString().split("T")[0],bodyweight_lb:"",chest_in:"",waist_in:"",hips_in:"",r_arm_in:"",l_arm_in:"",neck_in:""});
  async function save() {
    if(!fm.bodyweight_lb) return;
    const e = {}; Object.entries(fm).forEach(([k,v])=>{e[k]=k==="measure_date"?v:(parseFloat(v)||null);});
    const { data } = await supabase.from("measurements").insert(e).select().single();
    if (data) { onAdd(data); setShowF(false); }
  }
  const lat = meas[meas.length-1];
  const prev = meas.length>1?meas[meas.length-2]:null;
  function delta(cur,prv) { if(!cur||!prv) return null; const d=(cur-prv).toFixed(1); return d>0?`+${d}`:d; }

  return (
    <div style={{ padding:"24px 16px" }}>
      <div style={{ fontSize:20, fontWeight:700, marginBottom:16 }}>Body</div>
      {lat && (
        <div style={{ background:C.sf, borderRadius:10, border:`1px solid ${C.bd}`, padding:16, marginBottom:12 }}>
          <div style={{ fontSize:10, fontWeight:600, color:C.mt, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:12 }}>{lat.measure_date}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
            {[{l:"Weight",v:lat.bodyweight_lb,p:prev?.bodyweight_lb,u:"lb"},{l:"Chest",v:lat.chest_in,p:prev?.chest_in,u:"in"},{l:"Waist",v:lat.waist_in,p:prev?.waist_in,u:"in"},{l:"Hips",v:lat.hips_in,p:prev?.hips_in,u:"in"},{l:"R Arm",v:lat.r_arm_in,p:prev?.r_arm_in,u:"in"},{l:"L Arm",v:lat.l_arm_in,p:prev?.l_arm_in,u:"in"}].map(s=>{
              const d = delta(s.v, s.p);
              return (
                <div key={s.l}>
                  <div style={{ fontSize:9, color:C.mt, textTransform:"uppercase" }}>{s.l}</div>
                  <div style={{ fontSize:20, fontWeight:700, fontFamily:mono }}>{s.v??"—"}</div>
                  <div style={{ fontSize:10, color:C.mt }}>{s.u} {d&&<span style={{color:parseFloat(d)>0?C.gn:C.rd}}>{d}</span>}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <button onClick={()=>setShowF(!showF)} style={{ width:"100%", padding:"10px", background:C.ac+"10", border:`1px solid ${C.ac}25`, borderRadius:8, color:C.ac, fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:12 }}>{showF?"Cancel":"New measurement"}</button>
      {showF && (
        <div style={{ background:C.sf, borderRadius:10, border:`1px solid ${C.bd}`, padding:14, marginBottom:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[{k:"measure_date",l:"Date",t:"date"},{k:"bodyweight_lb",l:"Weight (lb)",t:"number"},{k:"chest_in",l:"Chest",t:"number"},{k:"waist_in",l:"Waist",t:"number"},{k:"hips_in",l:"Hips",t:"number"},{k:"r_arm_in",l:"R Arm",t:"number"},{k:"l_arm_in",l:"L Arm",t:"number"},{k:"neck_in",l:"Neck",t:"number"}].map(f=>(
              <div key={f.k}><label style={{ fontSize:9, color:C.mt, textTransform:"uppercase" }}>{f.l}</label>
              <input type={f.t} inputMode={f.t==="number"?"decimal":undefined} value={fm[f.k]} onChange={e=>setFm(p=>({...p,[f.k]:e.target.value}))} style={{...inp, width:"100%", marginTop:3}} /></div>
            ))}
          </div>
          <button onClick={save} style={{ width:"100%", padding:"10px", marginTop:12, background:C.ac, border:"none", borderRadius:8, color:C.bg, fontSize:13, fontWeight:700, cursor:"pointer" }}>Save</button>
        </div>
      )}
      <div style={{ fontSize:10, fontWeight:600, color:C.mt, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>History</div>
      {[...meas].reverse().map(m=>(
        <div key={m.id} style={{ background:C.sf, borderRadius:8, border:`1px solid ${C.bd}`, padding:"8px 12px", marginBottom:4, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:11, color:C.mt }}>{m.measure_date}</div><div style={{ fontSize:15, fontWeight:700, fontFamily:mono }}>{m.bodyweight_lb} lb</div></div>
          <div style={{ fontSize:10, color:C.mt, fontFamily:mono }}>{m.chest_in&&`Ch:${m.chest_in} `}{m.waist_in&&`W:${m.waist_in} `}{m.r_arm_in&&`A:${m.r_arm_in}`}</div>
        </div>
      ))}
    </div>
  );
}

function Stats({ meas, days, week }) {
  const [prs, setPrs] = useState([]);
  const [vol, setVol] = useState({});
  const [view, setView] = useState("prs");

  useEffect(()=>{ loadPRs(); loadVolume(); },[week]);

  async function loadPRs() {
    const { data } = await supabase.from("workout_sets").select("exercise_id, weight_lb, reps, exercises(name)").order("weight_lb",{ascending:false});
    if (data) {
      const best = {};
      data.forEach(s=>{ const n=s.exercises?.name; if(!n||!s.weight_lb||!s.reps) return; const e1=s.weight_lb*(1+s.reps/30); if(!best[n]||e1>best[n].est1rm) best[n]={exercise:n,weight:s.weight_lb,reps:s.reps,est1rm:e1}; });
      setPrs(Object.values(best).sort((a,b)=>b.est1rm-a.est1rm));
    }
  }

  async function loadVolume() {
    // Get sets for current week to calculate volume per muscle group
    const { data: sessions } = await supabase.from("workout_sessions").select("id, workout_sets(exercise_id, reps, exercises(primary_muscle))").eq("week_number", week);
    if (sessions) {
      const muscles = {};
      sessions.forEach(s => {
        s.workout_sets.forEach(ws => {
          if (ws.reps > 0 && ws.exercises?.primary_muscle) {
            const m = ws.exercises.primary_muscle;
            muscles[m] = (muscles[m] || 0) + 1;
          }
        });
      });
      setVol(muscles);
    }
  }

  const wd = meas.filter(m=>m.bodyweight_lb);
  const volEntries = Object.entries(vol).sort((a,b)=>b[1]-a[1]);
  const maxVol = volEntries.length>0?Math.max(...volEntries.map(v=>v[1])):1;

  return (
    <div style={{ padding:"24px 16px" }}>
      <div style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Stats</div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={()=>setView("prs")} style={{ padding:"6px 14px", borderRadius:6, border:`1px solid ${view==="prs"?C.ac:C.bd}`, background:view==="prs"?C.ac+"15":"transparent", color:view==="prs"?C.ac:C.mt, fontSize:12, cursor:"pointer" }}>PRs</button>
        <button onClick={()=>setView("vol")} style={{ padding:"6px 14px", borderRadius:6, border:`1px solid ${view==="vol"?C.ac:C.bd}`, background:view==="vol"?C.ac+"15":"transparent", color:view==="vol"?C.ac:C.mt, fontSize:12, cursor:"pointer" }}>Volume W{week}</button>
        <button onClick={()=>setView("bw")} style={{ padding:"6px 14px", borderRadius:6, border:`1px solid ${view==="bw"?C.ac:C.bd}`, background:view==="bw"?C.ac+"15":"transparent", color:view==="bw"?C.ac:C.mt, fontSize:12, cursor:"pointer" }}>Bodyweight</button>
      </div>

      {view==="vol" && (
        <div>
          <div style={{ fontSize:10, fontWeight:600, color:C.mt, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Weekly Sets by Muscle — Week {week}</div>
          {volEntries.length === 0 ? (
            <div style={{ padding:24, textAlign:"center", color:C.mt, fontSize:12 }}>No data for this week yet</div>
          ) : volEntries.map(([muscle, sets])=>(
            <div key={muscle} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ width:80, fontSize:11, color:C.tx, textAlign:"right" }}>{muscle}</div>
              <div style={{ flex:1, height:18, background:C.sf, borderRadius:4, overflow:"hidden" }}>
                <div style={{ width:`${(sets/maxVol)*100}%`, height:"100%", background:C.ac+"44", borderRadius:4, display:"flex", alignItems:"center", paddingLeft:6 }}>
                  <span style={{ fontSize:10, fontFamily:mono, color:C.ac, fontWeight:600 }}>{sets}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {view==="bw" && wd.length>1 && (
        <div>
          <div style={{ fontSize:10, fontWeight:600, color:C.mt, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Bodyweight Trend</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:80 }}>
            {wd.map(m=>{ const mn=Math.min(...wd.map(d=>d.bodyweight_lb)),mx=Math.max(...wd.map(d=>d.bodyweight_lb)),rn=mx-mn||1,h=((m.bodyweight_lb-mn)/rn)*60+10;
              return (<div key={m.id} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><span style={{fontSize:9,fontFamily:mono,color:C.tx}}>{m.bodyweight_lb}</span><div style={{width:"100%",height:h,background:C.ac+"55",borderRadius:3,maxWidth:32}} /><span style={{fontSize:7,color:C.mt}}>{m.measure_date?.slice(5)}</span></div>);
            })}
          </div>
        </div>
      )}

      {view==="prs" && (<>
        {prs.length>0?(<>
          <div style={{ display:"grid", gridTemplateColumns:"3fr 1fr 1fr 1fr", gap:0, marginBottom:6 }}>
            {["Exercise","Best","Reps","E1RM"].map(h=><div key={h} style={{ fontSize:9, fontWeight:600, color:C.mt, textTransform:"uppercase", paddingBottom:6, borderBottom:`1px solid ${C.bd}` }}>{h}</div>)}
          </div>
          {prs.map(pr=>(
            <div key={pr.exercise} style={{ display:"grid", gridTemplateColumns:"3fr 1fr 1fr 1fr", padding:"7px 0", borderBottom:`1px solid ${C.bd}` }}>
              <div style={{ fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", paddingRight:6 }}>{pr.exercise}</div>
              <div style={{ fontSize:11, fontFamily:mono, color:C.ac }}>{pr.weight}</div>
              <div style={{ fontSize:11, fontFamily:mono, color:C.mt }}>{pr.reps}</div>
              <div style={{ fontSize:11, fontFamily:mono, color:C.gn }}>{Math.round(pr.est1rm)}</div>
            </div>
          ))}
        </>):(<div style={{textAlign:"center",padding:"36px 20px",color:C.mt}}><div style={{fontSize:13}}>No PRs yet</div></div>)}
      </>)}
    </div>
  );
}
