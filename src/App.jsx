import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

const cache={get(k){try{const v=localStorage.getItem(`il_${k}`);return v?JSON.parse(v):null;}catch{return null;}},set(k,v){try{localStorage.setItem(`il_${k}`,JSON.stringify(v));}catch{}}};
function getPending(){return cache.get("pending")||[];}
function localDate(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function addPending(op){const q=getPending();q.push({...op,ts:Date.now()});cache.set("pending",q);}
async function flushPending(){if(flushing)return 0;flushing=true;const q=getPending();if(!q.length)return 0;let ok=0;const fail=[];for(const op of q){try{if(op.type==="upsert_set"){if(op.dbId)await supabase.from("workout_sets").update({weight_lb:op.weight,reps:op.reps}).eq("id",op.dbId);else await supabase.from("workout_sets").insert({session_id:op.sessionId,exercise_id:op.exerciseId,set_number:op.setNumber,weight_lb:op.weight,reps:op.reps});ok++;}else if(op.type==="insert_meal"){await supabase.from("meal_log").insert({log_date:op.date,food_id:op.foodId,portions:op.portions});ok++;}else if(op.type==="delete_meal"){await supabase.from("meal_log").delete().eq("id",op.id);ok++;}else if(op.type==="update_portions"){await supabase.from("meal_log").update({portions:op.portions}).eq("id",op.id);ok++;}else if(op.type==="insert_measurement"){await supabase.from("measurements").insert(op.data);ok++;}else if(op.type==="create_session"){await supabase.from("workout_sessions").insert(op.data);ok++;}else if(op.type==="insert_food"){await supabase.from("foods").insert(op.data);ok++;}}catch{fail.push(op);}}cache.set("pending",fail);flushing=false;return ok;}

let flushing=false;

const C={bg:"#111113",sf:"#19191d",sf2:"#222228",sf3:"#27272e",bd:"#2c2c34",bd2:"#38383f",tx:"#cdcdd0",tx2:"#9898a4",mt:"#6b6b76",ac:"#7c8aff",gn:"#5cb87a",rd:"#d4544e",am:"#c9a84c",bl:"#5b9bd5"};
const mono="'JetBrains Mono',monospace",sans="'DM Sans',sans-serif";

const inp={width:"100%",padding:"11px 10px",background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,color:C.tx,fontSize:16,fontFamily:mono,fontWeight:500,outline:"none",textAlign:"center",boxSizing:"border-box",transition:"border-color 0.15s"};
const inpL={...inp,textAlign:"left",paddingLeft:12,fontSize:14};
const sbtn={background:C.sf,border:`1px solid ${C.bd}`,borderRadius:10,color:C.mt,fontSize:14,cursor:"pointer",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0};
const tbtn={background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:6,color:C.mt,fontSize:14,cursor:"pointer",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center"};
const btnP={width:"100%",padding:"12px",background:C.ac,border:"none",borderRadius:10,color:C.bg,fontSize:15,fontWeight:700,cursor:"pointer",letterSpacing:"0.02em"};
const btnS={width:"100%",padding:"11px",background:`${C.ac}12`,border:`1px solid ${C.ac}30`,borderRadius:10,color:C.ac,fontSize:14,fontWeight:600,cursor:"pointer"};
const btnGhost={padding:"9px 16px",background:C.sf,border:`1px solid ${C.bd}`,borderRadius:8,color:C.mt,fontSize:13,fontWeight:500,cursor:"pointer"};
const card={background:C.sf,borderRadius:12,border:`1px solid ${C.bd}`,padding:16};
const hlbl={fontSize:9,fontWeight:600,color:C.mt,textTransform:"uppercase",letterSpacing:"0.08em"};
const lbl={fontSize:12,fontWeight:600,color:C.tx2,textTransform:"uppercase",letterSpacing:"0.06em"};
const lbl2={fontSize:10,fontWeight:500,color:C.mt,textTransform:"uppercase",letterSpacing:"0.06em"};
const card2={...card,border:`1px solid ${C.bd2}`};

const PROGRAMS=[{id:1,name:"IRONCLAD"},{id:2,name:"APEX"}];
const ROTATION=["Lower A","Upper A","Rest","Lower B","Upper B","Arms & Delts","Rest"];
const WEEK_TYPES=["Learning","Accumulation","Deload","Peak"];
const GOALS=[
  {name:"Cut",delta:-350,desc:"-350 cal"},
  {name:"Maintain",delta:0,desc:"TDEE"},
  {name:"Lean Bulk",delta:175,desc:"+175 cal"},
  {name:"Bulk",delta:400,desc:"+400 cal"},
];
const ACTIVITY=[
  {name:"Light",label:"1-2x/week",mult:1.375},
  {name:"Moderate",label:"3-4x/week",mult:1.55},
  {name:"Active",label:"5x/week",mult:1.725},
  {name:"Very Active",label:"6-7x/week",mult:1.9},
];
function calcTDEE(weightLb,heightIn,age,actMult){
  const wKg=weightLb*0.453592,hCm=heightIn*2.54;
  const bmr=10*wKg+6.25*hCm-5*age+5;
  return Math.round(bmr*actMult);
}
const VOL_TARGETS={Quads:{min:10,max:20},Hamstrings:{min:10,max:16},Glutes:{min:6,max:16},Chest:{min:10,max:20},"Upper Chest":{min:4,max:10},Back:{min:10,max:20},Lats:{min:6,max:12},"Mid Back":{min:4,max:10},Shoulders:{min:8,max:16},"Side Delts":{min:6,max:12},"Rear Delts":{min:4,max:10},Biceps:{min:6,max:14},Triceps:{min:6,max:14},"Triceps Long Head":{min:3,max:8},Calves:{min:6,max:12},Adductors:{min:3,max:8},Abductors:{min:3,max:8}};

function navyBF(w,n,h){if(!w||!n||!h||w<=n)return null;return(86.010*Math.log10(w-n)-70.041*Math.log10(h)+36.76).toFixed(1);}

const GearIcon=({c,sz=16})=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const Icons={
  train:({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M2 9v6M22 9v6M6.5 12h11M2 12h4.5M17.5 12H22"/></svg>,
  fuel:({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>,
  body:({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="5" r="3"/><path d="M12 8v4M8 22l2-8M16 22l-2-8M7 12h10"/></svg>,
  stats:({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  skills:({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  cali:({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v5M8 9l4 3 4-3M5 21l3-7M19 21l-3-7M5 21h14"/></svg>,
};

function Timer({duration,onDismiss}){
  const[endTime,setEndTime]=useState(()=>Date.now()+duration*1000);
  const[rem,setRem]=useState(duration);
  const[done,setDone]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    function tick(){const left=Math.max(0,Math.ceil((endTime-Date.now())/1000));setRem(left);if(left<=0&&!done){setDone(true);if(navigator.vibrate)navigator.vibrate([200,100,200,100,200]);}}
    tick();ref.current=setInterval(tick,500);return()=>clearInterval(ref.current);
  },[endTime,done]);
  function addTime(s){setEndTime(t=>t+s*1000);setDone(false);}
  const m=Math.floor(rem/60),s=rem%60,pct=((duration-rem)/duration)*100;
  return(
    <div style={{background:done?`${C.gn}12`:C.sf2,border:`1px solid ${done?C.gn+"33":C.bd}`,borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"baseline",gap:6}}>
          <span style={{fontSize:22,fontWeight:700,fontFamily:mono,color:done?C.gn:C.tx}}>{done?"Ready":`${m}:${String(s).padStart(2,"0")}`}</span>
          <span style={{fontSize:11,color:C.mt}}>{done?"":"resting"}</span>
        </div>
        <div style={{width:"100%",height:3,background:C.bd,borderRadius:2,marginTop:6,overflow:"hidden"}}>
          <div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:done?C.gn:C.ac,borderRadius:2,transition:"width 0.5s linear"}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:4}}>
        {!done&&<button onClick={()=>addTime(30)} style={{...btnGhost,fontSize:11,padding:"5px 8px"}}>+30s</button>}
        <button onClick={onDismiss} style={{...btnGhost,fontSize:11,padding:"5px 10px",fontWeight:600,color:done?C.gn:C.mt,borderColor:done?`${C.gn}33`:C.bd,background:done?`${C.gn}12`:C.sf}}>{done?"Done":"Skip"}</button>
      </div>
    </div>
  );
}

function useOnline(){const[o,setO]=useState(navigator.onLine);useEffect(()=>{const a=()=>setO(true),b=()=>setO(false);window.addEventListener("online",a);window.addEventListener("offline",b);return()=>{window.removeEventListener("online",a);window.removeEventListener("offline",b);};},[]);return o;}

// ── SkillsSection ─────────────────────────────────────────────────────────────

function SkillsSection({ supabase }) {
  const [exercises, setExercises] = useState([]);
  const [stages, setStages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState({});
  const [selectedEx, setSelectedEx] = useState(null);
  const [view, setView] = useState('list');
  const [logForm, setLogForm] = useState({ person: 'You', value: '', sets: 3, notes: '' });
  const [openInstructions, setOpenInstructions] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [exRes, stageRes, progressRes] = await Promise.all([
      supabase.from('skill_exercises').select('*').order('name'),
      supabase.from('skill_stages').select('*').order('stage_number'),
      supabase.from('skill_progress').select('*'),
    ]);
    setExercises(exRes.data || []);
    setStages(stageRes.data || []);
    const prog = {};
    (progressRes.data || []).forEach(p => { prog[`${p.skill_exercise_id}_${p.person}`] = p.current_stage_id; });
    setProgress(prog);
    setLoading(false);
  };

  const loadLogs = async (exerciseId) => {
    const { data } = await supabase.from('skill_logs').select('*, skill_stages(name, target_value, target_unit)').eq('skill_exercise_id', exerciseId).order('logged_date', { ascending: false }).order('created_at', { ascending: false }).limit(30);
    setLogs(data || []);
  };

  const getExStages = (exerciseId) => stages.filter(s => s.skill_exercise_id === exerciseId).sort((a, b) => a.stage_number - b.stage_number);
  const getCurrentStage = (exerciseId, person) => { const stageId = progress[`${exerciseId}_${person}`]; if (!stageId) return getExStages(exerciseId)[0]; return stages.find(s => s.id === stageId); };
  const getNextStage = (exerciseId, currentStageNumber) => getExStages(exerciseId).find(s => s.stage_number > currentStageNumber) || null;

  const isProgressReady = (exerciseId, person, stageId) => {
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return false;
    const recent = logs.filter(l => l.stage_id === stageId && l.person === person).slice(0, 3);
    if (recent.length < 2) return false;
    return recent.every(l => Number(l.achieved_value) >= Number(stage.target_value));
  };

  const isFinalStage = (exerciseId, stageNumber) => { const exStages = getExStages(exerciseId); return exStages[exStages.length - 1]?.stage_number === stageNumber; };
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const openExercise = async (ex) => {
    setSelectedEx(ex); await loadLogs(ex.id); setView('detail');
    setOpenInstructions(null); setLogForm({ person: 'You', value: '', sets: 3, notes: '' });
  };

  const saveLog = async () => {
    if (!logForm.value || isNaN(Number(logForm.value))) return;
    setSaving(true);
    const stage = getCurrentStage(selectedEx.id, logForm.person);
    const { error } = await supabase.from('skill_logs').insert({ skill_exercise_id: selectedEx.id, stage_id: stage?.id, person: logForm.person, achieved_value: parseFloat(logForm.value), sets_completed: parseInt(logForm.sets) || 1, notes: logForm.notes || null, logged_date: localDate() });
    if (error) { showToast('Error saving', 'error'); console.error(error); }
    else { await loadLogs(selectedEx.id); setLogForm(f => ({ ...f, value: '', notes: '' })); showToast('Logged!'); }
    setSaving(false);
  };

  const advanceStage = async (person) => {
    const stage = getCurrentStage(selectedEx.id, person);
    const next = getNextStage(selectedEx.id, stage.stage_number);
    if (!next) return;
    const { error } = await supabase.from('skill_progress').upsert({ skill_exercise_id: selectedEx.id, person, current_stage_id: next.id }, { onConflict: 'skill_exercise_id,person' });
    if (!error) { setProgress(p => ({ ...p, [`${selectedEx.id}_${person}`]: next.id })); showToast(`${person} → ${next.name}`); }
  };

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
    personBtn:(active,isYou)=>({flex:1,padding:"8px",borderRadius:7,border:`1px solid ${active?(isYou?"#1a3a5c":"#3c1a5c"):C.bd}`,cursor:"pointer",fontSize:13,fontWeight:600,background:active?(isYou?"#0d1e33":"#1e0d2e"):C.sf2,color:active?(isYou?"#7ab8f5":"#c9a0dc"):C.mt}),
  };

  if (view === 'list') return (
    <div style={sc.page}>
      {toast && <div style={{ ...sc.toast, ...(toast.type === 'error' ? sc.toastErr : sc.toastOk) }}>{toast.msg}</div>}
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Skills</div>
      {loading && <div style={sc.empty}>Loading...</div>}
      {!loading && exercises.length === 0 && <div style={sc.empty}>No skills found. Run skills_reseed.sql in Supabase first.</div>}
      {exercises.map(ex => {
        const youStage = getCurrentStage(ex.id, 'You');
        const AshslayStage = getCurrentStage(ex.id, 'Ashslay');
        return (
          <div key={ex.id} style={sc.exCard} onClick={() => openExercise(ex)} onMouseEnter={e => e.currentTarget.style.borderColor = C.bd2} onMouseLeave={e => e.currentTarget.style.borderColor = C.bd}>
            <div style={{color:C.tx,fontSize:14,fontWeight:600,marginBottom:4}}>{ex.name}</div>
            {ex.description&&<div style={{color:C.mt,fontSize:12,lineHeight:1.5,marginBottom:8}}>{ex.description}</div>}
            <div>
              {youStage && <span style={{ ...sc.pill, ...sc.pillYou }}>You — {youStage.name}</span>}
              {AshslayStage && <span style={{ ...sc.pill, ...sc.pillAshslay }}>Ashslay — {AshslayStage.name}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (view === 'detail' && selectedEx) {
    const persons = ['You', 'Ashslay'];
    return (
      <div style={sc.page}>
        {toast && <div style={{ ...sc.toast, ...(toast.type === 'error' ? sc.toastErr : sc.toastOk) }}>{toast.msg}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button style={btnGhost} onClick={()=>setView('list')}>← Back</button>
          <span style={{color:C.tx,fontSize:16,fontWeight:700}}>{selectedEx.name}</span>
        </div>
        {persons.map(person => {
          const isYou = person === 'You';
          const stage = getCurrentStage(selectedEx.id, person);
          if (!stage) return null;
          const next = getNextStage(selectedEx.id, stage.stage_number);
          const ready = isProgressReady(selectedEx.id, person, stage.id);
          const final = isFinalStage(selectedEx.id, stage.stage_number);
          const nameColor = isYou ? '#7ab8f5' : '#c9a0dc';
          const instrKey = `${selectedEx.id}_${person}`;
          const allStages = getExStages(selectedEx.id);
          return (
            <div key={person} style={{ marginBottom: 16 }}>
              <div style={{...lbl,marginBottom:8}}>{person}</div>
              {ready && next && (
                <div style={sc.progressBanner}>
                  <div style={{color:C.gn,fontSize:12,fontWeight:700,marginBottom:4}}>✓ Target hit — ready to level up</div>
                  <div style={{color:C.mt,fontSize:12,marginBottom:10}}>Next: <span style={{color:C.tx}}>{next.name}</span></div>
                  <button onClick={()=>advanceStage(person)} style={{...sc.btn,background:`${C.gn}14`,color:C.gn,border:`1px solid ${C.gn}33`,fontSize:12,padding:"7px 14px"}}>Advance →</button>
                </div>
              )}
              {final && <div style={{background:`${C.am}08`,border:`1px solid ${C.am}22`,borderRadius:8,padding:"12px 14px",marginBottom:10}}><div style={{color:C.am,fontSize:12,fontWeight:700}}>Final stage</div></div>}
              <div style={sc.stageBlock}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  {allStages.map(s => <div key={s.id} style={{ width: 20, height: 4, borderRadius: 2, background: s.stage_number <= stage.stage_number ? (isYou ? '#7ab8f5' : '#c9a0dc') : C.bd }} />)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:nameColor,marginBottom:3}}>Stage {stage.stage_number} — {stage.name}</div>
                    <div style={{color:C.mt,fontSize:12}}>Target: {stage.target_value} {stage.target_unit} × {stage.target_sets} sets</div>
                  </div>
                  <button style={btnGhost} onClick={() => setOpenInstructions(openInstructions === instrKey ? null : instrKey)}>
                    {openInstructions === instrKey ? 'Hide' : 'How to'}
                  </button>
                </div>
                {openInstructions === instrKey && <div style={sc.instructions}>{stage.instructions}</div>}
              </div>
            </div>
          );
        })}
        <div style={sc.logBox}>
          <div style={{...lbl,marginBottom:14}}>Log a session</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['You', 'Ashslay'].map(p => <button key={p} style={sc.personBtn(logForm.person === p, p === 'You')} onClick={() => setLogForm(f => ({ ...f, person: p }))}>{p}</button>)}
          </div>
          {(() => { const s = getCurrentStage(selectedEx.id, logForm.person); return s ? <div style={{color:C.mt,fontSize:11,marginBottom:12}}>Stage {s.stage_number} — {s.name} · Target: {s.target_value} {s.target_unit}</div> : null; })()}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><div style={{...lbl2,marginBottom:4}}>{getCurrentStage(selectedEx.id, logForm.person)?.target_unit === 'seconds' ? 'Hold time (sec)' : 'Reps'}</div><input type="number" inputMode="decimal" value={logForm.value} onChange={e => setLogForm(f => ({ ...f, value: e.target.value }))} style={inpL} placeholder="0" /></div>
            <div><div style={{...lbl2,marginBottom:4}}>Sets</div><input type="number" inputMode="numeric" value={logForm.sets} onChange={e => setLogForm(f => ({ ...f, sets: e.target.value }))} style={inpL} /></div>
          </div>
          <input type="text" value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inpL, marginBottom: 12 }} placeholder="Notes (optional)" />
          <button onClick={saveLog} disabled={saving || !logForm.value} style={{...btnS,background:saving||!logForm.value?C.sf2:`${C.gn}12`,color:saving||!logForm.value?C.mt:C.gn,border:`1px solid ${saving||!logForm.value?C.bd:`${C.gn}33`}`}}>
            {saving ? 'Saving...' : 'Log Session'}
          </button>
        </div>
        <div style={{...lbl,marginBottom:8}}>Recent logs</div>
        {logs.length === 0 && <div style={sc.empty}>No logs yet.</div>}
        {logs.slice(0, 15).map(log => {
          const isYou = log.person === 'You';
          const unit = log.skill_stages?.target_unit === 'seconds' ? 's' : ' reps';
          return (
            <div key={log.id} style={sc.logRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...sc.pill, ...(isYou ? sc.pillYou : sc.pillAshslay), marginRight: 0 }}>{log.person}</span>
                <span style={{color:C.tx2,fontSize:12}}>{log.skill_stages?.name}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{color:C.tx,fontSize:13,fontWeight:600}}>{log.achieved_value}{unit} × {log.sets_completed}</div>
                <div style={{color:C.mt,fontSize:11}}>{log.logged_date}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

// ── CaliWorkoutsSection ───────────────────────────────────────────────────────

function CaliWorkoutsSection({ supabase }) {
  const [templates, setTemplates] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('list');
  const [person, setPerson] = useState('You');
  const [showScaled, setShowScaled] = useState({});
  const [logging, setLogging] = useState(false);
  const [logNote, setLogNote] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [tRes, eRes, lRes] = await Promise.all([
      supabase.from('cali_workout_templates').select('*').order('display_order'),
      supabase.from('cali_workout_exercises').select('*').order('order_num'),
      supabase.from('cali_workout_logs').select('*, cali_workout_templates(name)').order('logged_date', { ascending: false }).limit(30),
    ]);
    setTemplates(tRes.data || []);
    setExercises(eRes.data || []);
    setLogs(lRes.data || []);
    setLoading(false);
  };

  const getExercises = (templateId) => exercises.filter(e => e.template_id === templateId).sort((a, b) => a.order_num - b.order_num);
  const lastDoneDate = (templateId, p) => { const entry = logs.find(l => l.template_id === templateId && l.person === p); return entry ? entry.logged_date : null; };

  const logWorkout = async () => {
    if (!selected) return;
    setLogging(true);
    const { error } = await supabase.from('cali_workout_logs').insert({ template_id: selected.id, person, notes: logNote || null, logged_date: localDate() });
    if (!error) { showToast('Workout logged!'); setLogNote(''); await loadAll(); }
    else { showToast('Error logging', 'error'); console.error(error); }
    setLogging(false);
  };

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const focusColor = (focus) => ({ push: { bg: '#1a0d0d', border: '#4a1a1a', text: '#f07070' }, pull: { bg: '#0d1a0d', border: '#1a4a1a', text: '#70c070' }, core: { bg: '#0d0d1a', border: '#1a1a4a', text: '#7070f0' } })[focus] || { bg: '#1a1a1a', border: '#2a2a2a', text: '#aaa' };

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

  if (view === 'list') return (
    <div style={wc.page}>
      {toast && <div style={{ ...wc.toast, ...(toast.type === 'error' ? wc.toastErr : wc.toastOk) }}>{toast.msg}</div>}
      <div style={{fontSize:20,fontWeight:700,marginBottom:6}}>Cali Workouts</div>
      <div style={{color:C.mt,fontSize:12,marginBottom:16}}>Push → Pull → Core → repeat. 20–25 min each.</div>
      {loading && <div style={wc.empty}>Loading...</div>}
      {!loading && templates.map(t => {
        const col = focusColor(t.focus);
        const youLast = lastDoneDate(t.id, 'You');
        const AshslayLast = lastDoneDate(t.id, 'Ashslay');
        return (
          <div key={t.id} style={wc.card} onClick={() => { setSelected(t); setView('detail'); setShowScaled({}); }} onMouseEnter={e => e.currentTarget.style.borderColor = C.bd2} onMouseLeave={e => e.currentTarget.style.borderColor = C.bd}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ ...wc.pill, background: col.bg, border: `1px solid ${col.border}`, color: col.text }}>{t.focus.toUpperCase()}</span>
              <span style={{color:C.mt,fontSize:12}}>{t.duration_min} min</span>
            </div>
            <div style={{color:C.tx,fontSize:15,fontWeight:700,marginBottom:4}}>{t.name}</div>
            <div style={{color:C.mt,fontSize:12,lineHeight:1.5,marginBottom:8}}>{t.description}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {youLast && <span style={{ color: '#7ab8f5', fontSize: 11 }}>You — {youLast}</span>}
              {AshslayLast && <span style={{ color: '#c9a0dc', fontSize: 11 }}>Ashslay — {AshslayLast}</span>}
              {!youLast&&!AshslayLast&&<span style={{color:C.mt,fontSize:11}}>Not done yet</span>}
            </div>
          </div>
        );
      })}
      {logs.length > 0 && (
        <>
          <div style={{height:1,background:C.bd,margin:"16px 0"}}/>
          <div style={{...lbl,marginBottom:8}}>Recent sessions</div>
          {logs.slice(0, 8).map(l => {
            const isYou = l.person === 'You';
            return (
              <div key={l.id} style={wc.logRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...wc.pill, ...(isYou ? { background: '#0d1e33', color: '#7ab8f5', border: '1px solid #1a3a5c' } : { background: '#1e0d2e', color: '#c9a0dc', border: '1px solid #3c1a5c' }) }}>{l.person}</span>
                  <span style={{color:C.tx2,fontSize:12}}>{l.cali_workout_templates?.name}</span>
                </div>
                <div style={{color:C.mt,fontSize:11}}>{l.logged_date}</div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  if (view === 'detail' && selected) {
    const col = focusColor(selected.focus);
    const exs = getExercises(selected.id);
    return (
      <div style={wc.page}>
        {toast && <div style={{ ...wc.toast, ...(toast.type === 'error' ? wc.toastErr : wc.toastOk) }}>{toast.msg}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button style={btnGhost} onClick={()=>setView('list')}>← Back</button>
          <span style={{ ...wc.pill, background: col.bg, border: `1px solid ${col.border}`, color: col.text, marginRight: 4 }}>{selected.focus.toUpperCase()}</span>
          <span style={{color:C.tx,fontSize:16,fontWeight:700}}>{selected.name}</span>
        </div>
        <div style={{color:C.mt,fontSize:12,marginBottom:16}}>{selected.description}</div>
        {exs.map((ex, i) => {
          const isWarmup = ex.order_num === 1;
          const isLast = i === exs.length - 1;
          const scaled = showScaled[ex.id];
          return (
            <div key={ex.id} style={{...wc.exCard,background:isWarmup||isLast?C.bg:C.sf}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{color:isWarmup||isLast?C.mt:C.tx,fontSize:13,fontWeight:700,marginBottom:3}}>{i+1}. {ex.name}</div>
                  {!isWarmup&&<div style={{color:C.mt,fontSize:12}}>{ex.sets} sets · {ex.reps_or_duration}{ex.rest_sec>0?` · ${ex.rest_sec}s rest`:''}</div>}
                </div>
                {ex.scaled_notes && (
                  <button onClick={() => setShowScaled(s => ({ ...s, [ex.id]: !s[ex.id] }))} style={{...btnGhost,padding:"4px 10px",fontSize:11,background:scaled?`${C.am}08`:C.sf2,color:scaled?C.am:C.mt,borderColor:scaled?`${C.am}22`:C.bd}}>
                    {scaled ? 'Hide' : 'Scale'}
                  </button>
                )}
              </div>
              {ex.beginner_notes && <div style={wc.exNotes}>{ex.beginner_notes}</div>}
              {scaled && ex.scaled_notes && (
                <div style={wc.scaledBox}>
                  <div style={{...lbl2,color:C.am,marginBottom:4}}>Scaling options</div>
                  <div style={{color:C.tx2,fontSize:12,lineHeight:1.6}}>{ex.scaled_notes}</div>
                </div>
              )}
            </div>
          );
        })}
        <div style={wc.logBox}>
          <div style={{...lbl,marginBottom:14}}>Log this workout</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['You', 'Ashslay'].map(p => <button key={p} style={wc.personBtn(person === p, p === 'You')} onClick={() => setPerson(p)}>{p}</button>)}
          </div>
          <input type="text" value={logNote} onChange={e=>setLogNote(e.target.value)} style={{...inpL,marginBottom:10}} placeholder="Notes — how it felt, what you modified (optional)"/>
          <button onClick={logWorkout} disabled={logging} style={{...btnS,background:logging?C.sf2:`${C.gn}12`,color:logging?C.mt:C.gn,border:`1px solid ${logging?C.bd:`${C.gn}33`}`}}>
            {logging ? 'Logging...' : `Log ${selected.name} — ${person}`}
          </button>
        </div>
      </div>
    );
  }
  return null;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App(){
  const[tab,setTab]=useState("train");
  const[days,setDays]=useState([]);
  const[foods,setFoods]=useState([]);
  const[mt,setMt]=useState({protein:174,carbs:484,fat:72,calories:3280});
  const[meas,setMeas]=useState([]);
  const[selDay,setSelDay]=useState(null);
  const[week,setWeek]=useState(()=>cache.get("week")||12);
  const[loading,setLoading]=useState(true);
  const[restDur,setRestDur]=useState(120);
  const[weekType,setWeekType]=useState(()=>cache.get("weekType")||"Accumulation");
  const[pc,setPc]=useState(0);
  const[activeProgram,setActiveProgram]=useState(()=>cache.get("activeProgram")||1);
  const online=useOnline();

  useEffect(()=>{load();},[activeProgram]);
  useEffect(()=>{if(online)flushPending().then(n=>{if(n>0){setPc(getPending().length);load();}});},[online]);

  async function load(){
    setLoading(true);
    try{
      const{data:d,error:dE}=await supabase.from("training_days").select("*,training_day_exercises(*,exercises(*))").eq("program_id",activeProgram).order("day_order");
      if(dE)throw dE;
      if(d){
        const f=d.map(x=>({id:x.id,name:x.name,focus:x.focus,exercises:(x.training_day_exercises||[]).sort((a,b)=>a.exercise_order-b.exercise_order).map(t=>({id:t.exercises.id,name:t.exercises.name,sets:t.default_sets,repMin:t.exercises.rep_min,repMax:t.exercises.rep_max,increment:parseFloat(t.exercises.increment_lb)||2.5,category:t.exercises.category,cues:t.exercises.cues,muscle:t.exercises.primary_muscle,video:t.exercises.video_url,imageUrl:t.exercises.image_url}))}));
        setDays(f);cache.set(`days_${activeProgram}`,f);
      }
      const{data:fd}=await supabase.from("foods").select("*").order("name");if(fd){setFoods(fd);cache.set("foods",fd);}
      const{data:tg}=await supabase.from("macro_targets").select("*").eq("is_active",true).limit(1);if(tg?.[0]){const goalName=tg[0].goal_name;const t={protein:tg[0].protein_g_target,carbs:tg[0].carbs_g_target,fat:tg[0].fat_g_target,calories:tg[0].calories_target,goalName,bw:tg[0].bodyweight_lb};setMt(t);cache.set("mt",t);}
      const{data:ms}=await supabase.from("measurements").select("*").order("measure_date");if(ms){setMeas(ms);cache.set("meas",ms);}
    }catch{
      setDays(cache.get(`days_${activeProgram}`)||[]);setFoods(cache.get("foods")||[]);const cm=cache.get("mt");if(cm)setMt(cm);setMeas(cache.get("meas")||[]);
    }
    setPc(getPending().length);setLoading(false);
  }

  function switchProgram(pid){setActiveProgram(pid);cache.set("activeProgram",pid);setSelDay(null);}

  if(loading)return(<div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:sans}}><div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:C.tx,letterSpacing:"0.05em"}}>IRON<span style={{color:C.ac}}>LOG</span></div><div style={{fontSize:11,color:C.mt,marginTop:8}}>Loading...</div></div></div>);

  const tabs=[
    {id:"train", label:"Train",  Icon:Icons.train},
    {id:"fuel",  label:"Fuel",   Icon:Icons.fuel},
    {id:"body",  label:"Body",   Icon:Icons.body},
    {id:"stats", label:"Stats",  Icon:Icons.stats},
    {id:"skills",label:"Skills", Icon:Icons.skills},
    {id:"cali",  label:"Cali",   Icon:Icons.cali},
  ];

  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:sans,maxWidth:480,margin:"0 auto",paddingBottom:80}}>
      {(!online||pc>0)&&<div style={{background:!online?`${C.am}14`:C.sf,borderBottom:`1px solid ${!online?`${C.am}30`:C.bd}`,padding:"7px 16px",display:"flex",alignItems:"center",gap:7}}><div style={{width:6,height:6,borderRadius:"50%",background:!online?C.am:C.gn,flexShrink:0}}/><span style={{fontSize:11,color:!online?C.am:C.gn}}>{!online?"Offline mode":pc>0?`Syncing ${pc} items...`:"Synced"}</span></div>}
      {tab==="train"&&!selDay&&<DaySelect days={days} onSelect={setSelDay} week={week} setWeek={setWeek} restDur={restDur} setRestDur={setRestDur} weekType={weekType} setWeekType={setWeekType} online={online} activeProgram={activeProgram} switchProgram={switchProgram} meas={meas} onAddMeas={m=>setMeas(p=>[...p,m].sort((a,b)=>a.measure_date.localeCompare(b.measure_date)))}/>}
      {tab==="train"&&selDay&&<Session day={selDay} onBack={()=>setSelDay(null)} week={week} restDur={restDur} weekType={weekType} isDeload={weekType==="Deload"} online={online} onPC={()=>setPc(getPending().length)} activeProgram={activeProgram}/>}
      {tab==="fuel"&&<Fuel foods={foods} setFoods={setFoods} mt={mt} setMt={setMt} meas={meas} online={online} onPC={()=>setPc(getPending().length)}/>}
      {tab==="body"&&<Body meas={meas} onAdd={m=>setMeas(p=>[...p,m].sort((a,b)=>a.measure_date.localeCompare(b.measure_date)))} online={online} onPC={()=>setPc(getPending().length)}/>}
      {tab==="stats"&&<Stats meas={meas} week={week} online={online} activeProgram={activeProgram}/>}
      {tab==="skills"&&<SkillsSection supabase={supabase}/>}
      {tab==="cali"&&<CaliWorkoutsSection supabase={supabase}/>}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:C.sf,borderTop:`1px solid ${C.bd}`,display:"flex",zIndex:100,padding:"6px 0 env(safe-area-inset-bottom,4px)"}}>
        {tabs.map(t=>{const active=tab===t.id;const color=active?C.ac:C.mt;return(
          <button key={t.id} onClick={()=>{setTab(t.id);if(t.id!=="train")setSelDay(null);}} style={{flex:1,padding:"8px 0",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,minHeight:48,justifyContent:"center",position:"relative"}}>
            {active&&<div style={{position:"absolute",top:0,left:"20%",right:"20%",height:2,background:C.ac,borderRadius:"0 0 2px 2px"}}/>}
            <t.Icon c={color}/><span style={{fontSize:10,fontWeight:active?700:500,color,letterSpacing:"0.02em"}}>{t.label}</span>
          </button>);})}
      </div>
    </div>
  );
}

// ── Muscle diagram ─────────────────────────────────────────────────────────────
import Model from 'react-body-highlighter';

const MUSCLE_MAP={
  "Lats":{slugs:["upper-back"],side:"back"},
  "Mid Back":{slugs:["trapezius","upper-back"],side:"back"},
  "Back":{slugs:["trapezius","upper-back","lower-back"],side:"back"},
  "Upper Traps":{slugs:["trapezius"],side:"back"},
  "Chest":{slugs:["chest"],side:"front"},
  "Upper Chest":{slugs:["chest"],side:"front"},
  "Side Delts":{slugs:["front-deltoids"],side:"front"},
  "Rear Delts":{slugs:["back-deltoids"],side:"back"},
  "Shoulders":{slugs:["front-deltoids"],side:"front"},
  "Biceps":{slugs:["biceps"],side:"front"},
  "Triceps":{slugs:["triceps"],side:"back"},
  "Triceps Long Head":{slugs:["triceps"],side:"back"},
  "Abs":{slugs:["abs"],side:"front"},
  "Quads":{slugs:["quadriceps"],side:"front"},
  "Hamstrings":{slugs:["hamstring"],side:"back"},
  "Glutes":{slugs:["gluteal"],side:"back"},
  "Calves":{slugs:["calves"],side:"back"},
  "Adductors":{slugs:["adductor"],side:"front"},
  "Abductors":{slugs:["abductors"],side:"front"},
};

// FIX: imageUrl first (cleaned PNGs with dark bg), SVG model as fallback
function MuscleDiagram({muscle,color,imageUrl}){
  const col=color||C.ac;

  if(imageUrl){
    return(
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
        <div style={{fontSize:8,color:col,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700,fontFamily:sans}}>{muscle}</div>
        <div style={{width:160}}>
          <img src={imageUrl} alt={muscle} style={{width:"100%",display:"block",borderRadius:8}} onError={e=>{e.target.style.display="none";}}/>
        </div>
      </div>
    );
  }

  const info=MUSCLE_MAP[muscle];
  if(!info)return null;
  const isFront=info.side==="front";
  const activeData=[{name:muscle,muscles:info.slugs,frequency:1}];
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
      <div style={{fontSize:8,color:col,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700,fontFamily:sans}}>
        {muscle} · {isFront?"Front":"Back"}
      </div>
      <div style={{width:90}}>
        <Model data={activeData} style={{width:"100%"}} highlightedColors={[col]} bodyColor="#45454f" type={isFront?"anterior":"posterior"}/>
      </div>
    </div>
  );
}

function DaySelect({days,onSelect,week,setWeek,restDur,setRestDur,weekType,setWeekType,online,activeProgram,switchProgram,meas,onAddMeas}){
  const[showCfg,setShowCfg]=useState(false);
  const[wc,setWc]=useState(null);
  const[summary,setSummary]=useState(null);
  const[showSum,setShowSum]=useState(false);
  const[dismissedDL,setDismissedDL]=useState(false);
  const[completedDays,setCompletedDays]=useState({});
  const[showBWInput,setShowBWInput]=useState(false);
  const[bwInput,setBwInput]=useState("");
  const[showGoalEdit,setShowGoalEdit]=useState(false);
  const[goalBW,setGoalBW]=useState(()=>cache.get("goalBW")||"");
  const[goalBF,setGoalBF]=useState(()=>cache.get("goalBF")||"");
  const[goalBWInput,setGoalBWInput]=useState("");
  const[goalBFInput,setGoalBFInput]=useState("");
  const latMeas=meas&&meas.length>0?meas[meas.length-1]:null;
  const todayBW=latMeas?.measure_date===localDate()?latMeas?.bodyweight_lb:null;
  const lastBW=latMeas?.bodyweight_lb||null;

  useEffect(()=>{lc();loadSummary();},[week,activeProgram]);

  async function logBW(){
    if(!bwInput)return;
    const lat=meas&&meas.length>0?meas[meas.length-1]:null;
    const entry={measure_date:localDate(),bodyweight_lb:parseFloat(bwInput)||null};
    if(lat?.height_in)entry.height_in=lat.height_in;
    try{const{data}=await supabase.from("measurements").insert(entry).select().single();if(data)onAddMeas(data);}
    catch{onAddMeas({...entry,id:`t_${Date.now()}`});addPending({type:"insert_measurement",data:entry});}
    setShowBWInput(false);setBwInput("");
  }

  async function lc(){
    if(!online){setWc(null);return;}
    try{
      const{data}=await supabase.from("workout_sessions").select("id,training_day_id,workout_sets(reps)").eq("week_number",week).eq("program_id",activeProgram);
      if(!data?.length){setWc(null);setCompletedDays({});return;}
      const tp=days.reduce((s,d)=>s+d.exercises.reduce((s2,e)=>s2+e.sets,0),0);
      let dn=0;const cd={};
      data.forEach(s=>{let sets=0;s.workout_sets.forEach(ws=>{if(ws.reps>0){dn++;sets++;}});if(sets>0)cd[s.training_day_id]=true;});
      setCompletedDays(cd);setWc(tp>0?Math.round((dn/tp)*100):0);
    }catch{setWc(null);}
  }

  async function loadSummary(){
    if(!online)return;
    try{
      const{data}=await supabase.from("workout_sessions").select("id,training_day_id,workout_sets(exercise_id,weight_lb,reps,exercises(name,primary_muscle))").eq("week_number",week).eq("program_id",activeProgram);
      if(!data?.length){setSummary(null);return;}
      let totalSets=0,completedSets=0,prCount=0;const muscles={};
      const{data:prevData}=await supabase.from("workout_sessions").select("id,workout_sets(exercise_id,weight_lb,reps,exercises(name,primary_muscle))").eq("week_number",week-1).eq("program_id",activeProgram);
      const prevBest={};const prevMuscles={};
      if(prevData)prevData.forEach(s=>s.workout_sets.forEach(ws=>{
        const n=ws.exercises?.name;if(n&&ws.weight_lb){if(!prevBest[n]||ws.weight_lb>prevBest[n])prevBest[n]=ws.weight_lb;}
        if(ws.reps>0&&ws.exercises?.primary_muscle){const m=ws.exercises.primary_muscle;prevMuscles[m]=(prevMuscles[m]||0)+1;}
      }));
      data.forEach(s=>{s.workout_sets.forEach(ws=>{totalSets++;if(ws.reps>0){completedSets++;if(ws.exercises?.primary_muscle){const m=ws.exercises.primary_muscle;muscles[m]=(muscles[m]||0)+1;}const n=ws.exercises?.name;if(n&&ws.weight_lb&&prevBest[n]&&ws.weight_lb>prevBest[n])prCount++;}});});
      const muscleDeltas={};const allMuscles=new Set([...Object.keys(muscles),...Object.keys(prevMuscles)]);
      allMuscles.forEach(m=>{const delta=(muscles[m]||0)-(prevMuscles[m]||0);if(delta!==0)muscleDeltas[m]=delta;});
      setSummary({totalSets,completedSets,prCount,sessionsLogged:data.length,muscles,muscleDeltas});
    }catch{}
  }

  const isDL=weekType==="Deload";
  const wcColor=wc===100?C.gn:wc>50?C.ac:wc>0?C.am:C.mt;

  return(
    <div style={{padding:"20px 16px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontSize:22,fontWeight:800,letterSpacing:"0.01em"}}>IRON<span style={{color:C.ac}}>LOG</span></div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>setShowCfg(!showCfg)} style={{...sbtn,color:showCfg?C.ac:C.mt,borderColor:showCfg?`${C.ac}44`:C.bd}}><GearIcon c={showCfg?C.ac:C.mt} sz={16}/></button>
          <div style={{display:"flex",alignItems:"center",background:C.sf,border:`1px solid ${C.bd}`,borderRadius:8,overflow:"hidden"}}>
            <button onClick={()=>setWeek(w=>{const n=Math.max(1,w-1);cache.set("week",n);return n;})} style={{background:"none",border:"none",cursor:"pointer",color:C.mt,width:34,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>‹</button>
            <div style={{borderLeft:`1px solid ${C.bd}`,borderRight:`1px solid ${C.bd}`,padding:"0 12px",height:36,display:"flex",alignItems:"center"}}><span style={{fontFamily:mono,fontSize:13,fontWeight:600,color:C.tx}}>W{week}</span></div>
            <button onClick={()=>setWeek(w=>{const n=w+1;cache.set("week",n);return n;})} style={{background:"none",border:"none",cursor:"pointer",color:C.mt,width:34,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>›</button>
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:12,background:C.sf2,borderRadius:10,padding:4}}>
        {PROGRAMS.map(p=>{
          const active=activeProgram===p.id;const isA=p.id===2;const activeColor=isA?C.am:C.ac;
          return(<button key={p.id} onClick={()=>switchProgram(p.id)} style={{flex:1,padding:"8px 0",borderRadius:7,border:"none",background:active?C.sf:"transparent",color:active?(isA?C.am:C.ac):C.mt,fontSize:12,fontWeight:active?700:400,cursor:"pointer",transition:"all 0.15s",position:"relative"}}>
            {active&&<div style={{position:"absolute",top:0,left:"20%",right:"20%",height:2,background:activeColor,borderRadius:"0 0 2px 2px"}}/>}
            {p.name}
          </button>);
        })}
      </div>

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 14px",background:C.sf,border:`1px solid ${C.bd}`,borderRadius:10}}>
        <div style={{flex:1}}>
          <div style={{...lbl,marginBottom:3}}>Bodyweight</div>
          <div style={{fontSize:18,fontWeight:700,fontFamily:mono,color:todayBW?C.gn:C.tx}}>
            {todayBW?`${todayBW} lb`:lastBW?`${lastBW} lb`:<span style={{color:C.mt}}>—</span>}
            {todayBW&&<span style={{fontSize:10,color:C.gn,marginLeft:6,fontWeight:500}}>logged today</span>}
            {!todayBW&&lastBW&&<span style={{fontSize:10,color:C.mt,marginLeft:6}}>last logged</span>}
          </div>
        </div>
        {showBWInput?(
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <input type="number" inputMode="decimal" value={bwInput} onChange={e=>setBwInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&logBW()} placeholder="lbs" style={{...inp,width:72,fontSize:14,padding:"7px 6px"}} autoFocus/>
            <button onClick={logBW} style={{...btnGhost,padding:"7px 12px",color:C.gn,borderColor:`${C.gn}44`,fontSize:12,fontWeight:600}}>Save</button>
            <button onClick={()=>setShowBWInput(false)} style={{background:"none",border:"none",color:C.mt,cursor:"pointer",fontSize:16,padding:"2px"}}>×</button>
          </div>
        ):(
          <button onClick={()=>{setBwInput(lastBW?String(lastBW):"");setShowBWInput(true);}} style={{...btnGhost,padding:"6px 12px",fontSize:11}}>
            {todayBW?"Edit":"Log weight"}
          </button>
        )}
      </div>

      {/* ── Cut progress tracker ── */}
      {(goalBW||goalBF)?((()=>{
        const curBW=lastBW||0;
        const curBF=meas&&meas.length>0?(meas[meas.length-1].body_fat_pct||(meas[meas.length-1].waist_in&&meas[meas.length-1].neck_in&&meas[meas.length-1].height_in?navyBF(meas[meas.length-1].waist_in,meas[meas.length-1].neck_in,meas[meas.length-1].height_in):null)):null;
        const startBW=meas&&meas.length>0?meas[0].bodyweight_lb:curBW;
        const startBF=meas&&meas.length>0?(meas[0].body_fat_pct||(meas[0].waist_in&&meas[0].neck_in&&meas[0].height_in?navyBF(meas[0].waist_in,meas[0].neck_in,meas[0].height_in):null)):curBF;
        const gBW=parseFloat(goalBW)||null;
        const gBF=parseFloat(goalBF)||null;
        const bwPct=gBW&&startBW&&startBW!==gBW?Math.min(100,Math.max(0,Math.round(((startBW-curBW)/(startBW-gBW))*100))):null;
        const bfPct=gBF&&startBF&&parseFloat(startBF)!==gBF?Math.min(100,Math.max(0,Math.round(((parseFloat(startBF)-parseFloat(curBF||startBF))/(parseFloat(startBF)-gBF))*100))):null;
        return(
          <div style={{background:C.sf,border:`1px solid ${C.bd}`,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{...lbl,color:C.ac}}>Cut progress</span>
              <button onClick={()=>{setGoalBWInput(String(goalBW));setGoalBFInput(String(goalBF));setShowGoalEdit(!showGoalEdit);}} style={{background:"none",border:"none",color:C.mt,fontSize:10,cursor:"pointer",padding:0}}>{showGoalEdit?"done":"edit goal"}</button>
            </div>
            {showGoalEdit?(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
                <div><div style={{...lbl2,marginBottom:4}}>Goal weight (lb)</div><input type="number" inputMode="decimal" value={goalBWInput} onChange={e=>setGoalBWInput(e.target.value)} onBlur={()=>{cache.set("goalBW",goalBWInput);setGoalBW(goalBWInput);}} style={{...inp,fontSize:13}} placeholder="e.g. 185"/></div>
                <div><div style={{...lbl2,marginBottom:4}}>Goal BF%</div><input type="number" inputMode="decimal" value={goalBFInput} onChange={e=>setGoalBFInput(e.target.value)} onBlur={()=>{cache.set("goalBF",goalBFInput);setGoalBF(goalBFInput);}} style={{...inp,fontSize:13}} placeholder="e.g. 12"/></div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {gBW&&curBW&&<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:C.tx}}>{curBW} lb <span style={{color:C.mt}}>→ {gBW} lb</span></span><span style={{fontSize:11,fontFamily:mono,color:bwPct===100?C.gn:C.ac}}>{bwPct}%</span></div><div style={{height:5,background:C.bd,borderRadius:3,overflow:"hidden"}}><div style={{width:`${bwPct||0}%`,height:"100%",background:bwPct===100?C.gn:C.ac,borderRadius:3,transition:"width 0.4s"}}/></div><div style={{fontSize:9,color:C.mt,marginTop:2}}>{curBW>gBW?`${(curBW-gBW).toFixed(1)} lb to go`:"Goal reached 🎯"}</div></div>}
                {gBF&&curBF&&<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:C.tx}}>{parseFloat(curBF).toFixed(1)}% BF <span style={{color:C.mt}}>→ {gBF}%</span></span><span style={{fontSize:11,fontFamily:mono,color:bfPct===100?C.gn:C.am}}>{bfPct}%</span></div><div style={{height:5,background:C.bd,borderRadius:3,overflow:"hidden"}}><div style={{width:`${bfPct||0}%`,height:"100%",background:bfPct===100?C.gn:C.am,borderRadius:3,transition:"width 0.4s"}}/></div><div style={{fontSize:9,color:C.mt,marginTop:2}}>{parseFloat(curBF)>gBF?`${(parseFloat(curBF)-gBF).toFixed(1)}% to go`:"Goal reached 🎯"}</div></div>}
              </div>
            )}
          </div>
        );
      })()):(
        <button onClick={()=>setShowGoalEdit(true)} style={{...btnGhost,width:"100%",textAlign:"center",marginBottom:12,fontSize:11,color:C.mt}}>+ Set cut goal (weight / BF%)</button>
      )}
      {showGoalEdit&&!goalBW&&!goalBF&&(
        <div style={{background:C.sf,border:`1px solid ${C.bd}`,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
          <div style={{...lbl,marginBottom:8,color:C.ac}}>Set your goal</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><div style={{...lbl2,marginBottom:4}}>Goal weight (lb)</div><input type="number" inputMode="decimal" value={goalBWInput} onChange={e=>setGoalBWInput(e.target.value)} onBlur={()=>{if(goalBWInput){cache.set("goalBW",goalBWInput);setGoalBW(goalBWInput);}}} style={{...inp,fontSize:13}} placeholder="e.g. 185" autoFocus/></div>
            <div><div style={{...lbl2,marginBottom:4}}>Goal BF%</div><input type="number" inputMode="decimal" value={goalBFInput} onChange={e=>setGoalBFInput(e.target.value)} onBlur={()=>{if(goalBFInput){cache.set("goalBF",goalBFInput);setGoalBF(goalBFInput);}}} style={{...inp,fontSize:13}} placeholder="e.g. 12"/></div>
          </div>
          <div style={{fontSize:10,color:C.mt,marginTop:8}}>Enter either or both. Progress tracks automatically from your Body logs.</div>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <span style={{fontSize:11,fontWeight:600,color:isDL?C.am:C.tx2,padding:"3px 9px",background:isDL?`${C.am}12`:C.sf2,borderRadius:6,border:`1px solid ${isDL?C.am+"33":C.bd}`,flexShrink:0}}>{weekType}</span>
        {wc!==null&&(<div style={{display:"flex",alignItems:"center",gap:6,flex:1}}><div style={{flex:1,height:3,background:C.bd,borderRadius:2,overflow:"hidden"}}><div style={{width:`${wc}%`,height:"100%",background:wcColor,borderRadius:2,transition:"width 0.4s"}}/></div><span style={{fontFamily:mono,fontSize:11,fontWeight:600,color:wcColor,minWidth:30,textAlign:"right"}}>{wc}%</span></div>)}
        {summary&&<button onClick={()=>setShowSum(!showSum)} style={{...btnGhost,fontSize:10,padding:"4px 10px",color:showSum?C.ac:C.mt,borderColor:showSum?`${C.ac}40`:C.bd,flexShrink:0}}>{showSum?"Close":"Summary"}</button>}
      </div>

      {week%4===0&&!isDL&&!dismissedDL&&(
        <div style={{background:`${C.am}10`,border:`1px solid ${C.am}33`,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:C.am}}>Deload week?</div><div style={{fontSize:11,color:C.mt,marginTop:1}}>W{week} is typically a deload in a 16-week block.</div></div>
          <button onClick={()=>{setWeekType("Deload");setDismissedDL(true);}} style={{padding:"6px 12px",background:`${C.am}18`,border:`1px solid ${C.am}44`,borderRadius:8,color:C.am,fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0}}>Switch</button>
          <button onClick={()=>setDismissedDL(true)} style={{background:"none",border:"none",color:C.mt,fontSize:16,cursor:"pointer",padding:"2px",flexShrink:0}}>×</button>
        </div>
      )}

      {showSum&&summary&&(
        <div style={{...card,marginBottom:12}}>
          <div style={{...lbl,marginBottom:12}}>Week {week} recap — {PROGRAMS.find(p=>p.id===activeProgram)?.name}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}>
            {[{l:"Sessions",v:summary.sessionsLogged,c:C.ac},{l:"Done",v:summary.completedSets,c:C.bl},{l:"Total",v:summary.totalSets,c:C.mt},{l:"PRs",v:summary.prCount,c:summary.prCount>0?C.gn:C.mt}].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,fontFamily:mono,color:s.c}}>{s.v}</div><div style={{...hlbl,marginTop:3}}>{s.l}</div></div>
            ))}
          </div>
          {Object.keys(summary.muscles).length>0&&<div><div style={{...lbl,marginBottom:7}}>Volume by muscle</div><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{Object.entries(summary.muscles).sort((a,b)=>b[1]-a[1]).map(([m,sets])=>{const tgt=VOL_TARGETS[m];const inR=tgt&&sets>=tgt.min&&sets<=tgt.max;const delta=summary.muscleDeltas?.[m];return<span key={m} style={{padding:"3px 8px",borderRadius:4,background:C.sf2,border:`1px solid ${inR?`${C.gn}33`:C.bd}`,fontSize:10,fontFamily:mono,display:"flex",alignItems:"center",gap:4}}><span style={{color:C.tx}}>{m}</span><span style={{color:inR?C.gn:C.mt}}>{sets}</span>{delta!=null&&<span style={{color:delta>0?C.gn:C.rd,fontSize:9}}>{delta>0?`+${delta}`:delta}</span>}</span>;})}</div></div>}
        </div>
      )}

      {showCfg&&(
        <div style={{...card,marginBottom:12}}>
          <div style={{marginBottom:12}}>
            <div style={{...lbl,marginBottom:10}}>Week phase</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {WEEK_TYPES.map(t=><button key={t} onClick={()=>setWeekType(t)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${weekType===t?(t==="Deload"?C.am:C.ac):C.bd}`,background:weekType===t?(t==="Deload"?C.am:C.ac)+"15":"transparent",color:weekType===t?(t==="Deload"?C.am:C.ac):C.mt,fontSize:12,fontWeight:weekType===t?600:400,cursor:"pointer"}}>{t}</button>)}
            </div>
            {isDL&&<div style={{fontSize:11,color:C.am,marginTop:8,padding:"6px 10px",background:`${C.am}08`,borderRadius:6}}>Deload: 2 sets at ~60% weight</div>}
          </div>
          <div>
            <div style={{...lbl,marginBottom:10}}>Rest timer</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[60,90,120,150,180,240].map(t=><button key={t} onClick={()=>setRestDur(t)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${restDur===t?C.ac:C.bd}`,background:restDur===t?`${C.ac}15`:"transparent",color:restDur===t?C.ac:C.mt,fontSize:12,fontFamily:mono,cursor:"pointer"}}>{Math.floor(t/60)}:{String(t%60).padStart(2,"0")}</button>)}
            </div>
          </div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {ROTATION.map((dn,i)=>{
          if(dn==="Rest")return<div key={`r${i}`} style={{padding:"9px 16px",background:C.sf2,borderRadius:10,border:`1px solid ${C.bd}`,opacity:0.35,display:"flex",alignItems:"center",gap:14}}><div style={{fontFamily:mono,fontSize:11,color:C.mt,width:20,textAlign:"center"}}>{i+1}</div><span style={{fontSize:11,color:C.mt}}>Rest</span></div>;
          const day=days.find(d=>d.name===dn);if(!day)return null;
          const isDone=completedDays[day.id];
          return(
            <button key={dn} onClick={()=>onSelect(day)} style={{padding:"14px 16px",background:isDone?`${C.gn}08`:C.sf,borderRadius:12,border:`1px solid ${isDone?C.gn+"30":C.bd}`,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:14,width:"100%"}}>
              <div style={{fontFamily:mono,fontSize:12,fontWeight:700,color:isDone?C.gn:C.mt,width:20,textAlign:"center",flexShrink:0}}>{isDone?"✓":i+1}</div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:700,color:isDone?C.gn:C.tx}}>{day.name}</div><div style={{fontSize:11,color:C.mt,marginTop:2}}>{day.focus}</div></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDone?C.gn:C.mt} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Session({day,onBack,week,restDur,weekType,isDeload,online,onPC,activeProgram}){
  const[expEx,setExpEx]=useState(0);
  const[showCues,setShowCues]=useState(null);
  const[sd,setSd]=useState({});
  const[sid,setSid]=useState(null);
  const[saved,setSaved]=useState(null);
  const[showTimer,setShowTimer]=useState(false);
  const[timerKey,setTimerKey]=useState(0);
  const[lw,setLw]=useState({});
  const[history,setHistory]=useState(null);
  const[notes,setNotes]=useState("");
  const[notesSaved,setNotesSaved]=useState(false);
  const saveTimer=useRef({});
  const sdRef=useRef({});
  sdRef.current=sd;

  function eff(ex){return isDeload?Math.min(ex.sets,2):ex.sets;}
  useEffect(()=>{init();loadLast();},[day.id,week]);

  async function loadLast(){
    const p=week-1;
    try{
      if(p>=1){
        const{data}=await supabase.from("workout_sessions").select("id,workout_sets(exercise_id,weight_lb,reps)").eq("week_number",p).eq("training_day_id",day.id).limit(1);
        if(data?.[0]){
          const byE={};data[0].workout_sets.forEach(w=>{if(!byE[w.exercise_id])byE[w.exercise_id]=[];byE[w.exercise_id].push(w);});
          const prog={};
          Object.entries(byE).forEach(([eid,sets])=>{const v=sets.filter(s=>s.reps>0&&s.weight_lb>0);if(!v.length)return;const avg=v.reduce((s,x)=>s+x.reps,0)/v.length;const mw=Math.max(...v.map(s=>s.weight_lb));const ex=day.exercises.find(e=>e.id===parseInt(eid));if(isDeload)prog[eid]={w:mw,r:avg,up:false,sw:Math.round(mw*0.6/2.5)*2.5,deload:true};else{const hit=ex&&v.every(s=>s.reps>=ex.repMax);prog[eid]={w:mw,r:avg,up:hit,sw:hit&&ex?mw+ex.increment:mw};}});
          setLw(prog);cache.set(`lw_${day.id}_${week}`,prog);return;
        }
      }
      const exerciseIds=day.exercises.map(e=>e.id);if(!exerciseIds.length)return;
      const{data:fallback}=await supabase.from("workout_sets").select("exercise_id,weight_lb,reps,created_at").in("exercise_id",exerciseIds).gt("weight_lb",0).gt("reps",0).order("created_at",{ascending:false});
      if(fallback){const byE={};fallback.forEach(ws=>{if(!byE[ws.exercise_id])byE[ws.exercise_id]=ws;});const prog={};Object.entries(byE).forEach(([eid,ws])=>{const mw=ws.weight_lb;const r=ws.reps;if(isDeload)prog[eid]={w:mw,r,up:false,sw:Math.round(mw*0.6/2.5)*2.5,deload:true};else prog[eid]={w:mw,r,up:false,sw:mw};});setLw(prog);cache.set(`lw_${day.id}_${week}`,prog);}
    }catch{const c=cache.get(`lw_${day.id}_${week}`);if(c)setLw(c);}
  }

  async function loadHistory(exerciseId){
    try{const{data}=await supabase.from("workout_sets").select("weight_lb,reps,workout_sessions(week_number)").eq("exercise_id",exerciseId).order("created_at",{ascending:true});if(data){const byWeek={};data.forEach(s=>{const wk=s.workout_sessions?.week_number;if(!wk)return;if(!byWeek[wk])byWeek[wk]={maxW:0,totalReps:0,sets:0};byWeek[wk].maxW=Math.max(byWeek[wk].maxW,s.weight_lb||0);byWeek[wk].totalReps+=s.reps||0;byWeek[wk].sets++;});const weeks=Object.entries(byWeek).map(([wk,d])=>({week:parseInt(wk),weight:d.maxW,avgReps:d.sets>0?(d.totalReps/d.sets).toFixed(1):0})).sort((a,b)=>a.week-b.week);setHistory({exerciseId,weeks});}}catch{}
  }

  async function init(){
    const ck=`session_${day.id}_${week}_${activeProgram}`;
    try{
      const{data}=await supabase.from("workout_sessions").select("id,notes,workout_sets(*)").eq("week_number",week).eq("training_day_id",day.id).eq("program_id",activeProgram).limit(1);
      if(data?.[0]){setSid(data[0].id);setNotes(data[0].notes||"");const l={};data[0].workout_sets.forEach(w=>{l[`${w.exercise_id}-${w.set_number}`]={weight:w.weight_lb||0,reps:w.reps||0,dbId:w.id};});setSd(l);cache.set(ck,{sid:data[0].id,sets:l});}
      else{const{data:n}=await supabase.from("workout_sessions").insert({week_number:week,training_day_id:day.id,session_date:localDate(),week_type:weekType,program_id:activeProgram}).select().single();if(n){setSid(n.id);cache.set(ck,{sid:n.id,sets:{}});}}
    }catch{const c=cache.get(ck);if(c){setSid(c.sid);setSd(c.sets);}else{const tid=`temp_${Date.now()}`;setSid(tid);addPending({type:"create_session",data:{week_number:week,training_day_id:day.id,session_date:localDate(),week_type:weekType,program_id:activeProgram}});onPC();}}
  }

  async function saveNotes(val){setNotes(val);if(!sid||String(sid).startsWith("temp_"))return;try{await supabase.from("workout_sessions").update({notes:val}).eq("id",sid);setNotesSaved(true);setTimeout(()=>setNotesSaved(false),1500);}catch{}}
  function gs(eid,sn){return sd[`${eid}-${sn}`]||{weight:0,reps:0};}

  function ul(eid,sn,f,v){
    const k=`${eid}-${sn}`;
    setSd(p=>({...p,[k]:{...p[k],weight:p[k]?.weight||0,reps:p[k]?.reps||0,[f]:parseFloat(v)||0}}));
    clearTimeout(saveTimer.current[k]);
    saveTimer.current[k]=setTimeout(()=>sv(eid,sn),800);
  }

  async function sv(eid,sn){if(!sid||String(sid).startsWith("temp_"))return;const k=`${eid}-${sn}`,d=sdRef.current[k];if(!d||(!d.weight&&!d.reps))return;const ck=`session_${day.id}_${week}_${activeProgram}`;const cached=cache.get(ck)||{sid,sets:{}};cached.sets[k]={weight:d.weight,reps:d.reps,dbId:d.dbId};cache.set(ck,cached);
    try{if(d.dbId)await supabase.from("workout_sets").update({weight_lb:d.weight,reps:d.reps}).eq("id",d.dbId);else{const{data:ins}=await supabase.from("workout_sets").insert({session_id:sid,exercise_id:eid,set_number:sn,weight_lb:d.weight,reps:d.reps}).select().single();if(ins){setSd(p=>({...p,[k]:{...p[k],dbId:ins.id}}));cached.sets[k].dbId=ins.id;cache.set(ck,cached);}}}
    catch{addPending({type:"upsert_set",dbId:d.dbId,sessionId:sid,exerciseId:eid,setNumber:sn,weight:d.weight,reps:d.reps});onPC();}
    setSaved(new Date().toLocaleTimeString());}

  function fill(eid,n,w){const u={};for(let i=1;i<=n;i++){const k=`${eid}-${i}`;u[k]={...sdRef.current[k],weight:w,reps:sd[k]?.reps||0,dbId:sd[k]?.dbId};}setSd(p=>({...p,...u}));}
  function done(eid,n){let c=0;for(let i=1;i<=n;i++)if(sd[`${eid}-${i}`]?.reps>0)c++;return c;}
  const totalS=day.exercises.reduce((s,e)=>s+eff(e),0),doneS=day.exercises.reduce((s,e)=>s+done(e.id,eff(e)),0),comp=totalS>0?Math.round((doneS/totalS)*100):0;
  function startTimer(){setShowTimer(true);setTimerKey(k=>k+1);}
  const progName=activeProgram===2?"APEX":"IRONCLAD";

  return(
    <div style={{padding:"20px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
        <button onClick={onBack} style={sbtn}>‹</button>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:18,fontWeight:700}}>{day.name}</div><div style={{fontSize:11,color:C.mt,marginTop:1}}>W{week} · {weekType} · {progName}</div></div>
        <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:18,fontWeight:700,fontFamily:mono,color:comp===100?C.gn:comp>0?C.am:C.mt}}>{comp}%</div><div style={{fontSize:8,color:C.mt,fontFamily:mono,marginTop:1,textTransform:"uppercase",letterSpacing:"0.06em"}}>{comp===100?"complete":"done"}</div>{saved&&<div style={{fontSize:8,color:C.gn,fontFamily:mono,marginTop:1}}>{saved}</div>}</div>
      </div>
      <div style={{width:"100%",height:6,background:C.bd,borderRadius:3,marginBottom:10,overflow:"hidden"}}><div style={{width:`${comp}%`,height:"100%",background:comp===100?C.gn:C.ac,borderRadius:3,transition:"width 0.3s"}}/></div>
      <div style={{marginBottom:12,position:"relative"}}>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} onBlur={e=>saveNotes(e.target.value)} placeholder="Session notes — how you felt, anything off, PRs to remember..." style={{...inpL,height:notes?68:38,resize:"none",padding:"9px 12px",lineHeight:1.5,fontSize:12,color:C.tx,transition:"height 0.2s",fontFamily:sans}}/>
        {notesSaved&&<span style={{position:"absolute",right:10,bottom:8,fontSize:9,color:C.gn,fontFamily:mono}}>saved</span>}
      </div>
      {isDeload&&<div style={{padding:"8px 12px",marginBottom:12,background:`${C.am}10`,border:`1px solid ${C.am}22`,borderRadius:8,fontSize:11,color:C.am}}>Deload week — 2 sets at ~60%</div>}

      {day.exercises.length===0&&(
        <div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13,background:C.sf2,borderRadius:12,border:`1px solid ${C.bd}`}}>
          No exercises found for {day.name} in {progName}.<br/>
          <span style={{fontSize:11,color:`${C.mt}88`,marginTop:6,display:"block"}}>Check that training_day_exercises rows exist for program_id={activeProgram} in Supabase.</span>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {day.exercises.map((ex,xi)=>{
          const es=eff(ex),isE=expEx===xi,dn=done(ex.id,es),all=dn===es,pg=lw[ex.id];
          const todayWeight=pg?(pg.deload?pg.sw:pg.up?pg.sw:pg.w):null;
          return(
            <div key={ex.id} style={{background:C.sf,borderRadius:12,border:`1px solid ${all?`${C.gn}30`:isE?C.bd2:C.bd}`,overflow:"hidden"}}>
              <button onClick={()=>{setExpEx(isE?-1:xi);setHistory(null);setShowTimer(false);}} style={{width:"100%",padding:"13px 14px",background:"none",border:"none",color:C.tx,cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left"}}>
                <div style={{fontFamily:mono,fontSize:13,fontWeight:700,color:all?C.gn:C.mt,width:22,textAlign:"center",flexShrink:0}}>{all?"✓":xi+1}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ex.name}</div>
                  <div style={{fontSize:11,color:C.mt,marginTop:1}}>{es}×{ex.repMin}–{ex.repMax}{todayWeight&&<span style={{color:pg.up?C.gn:pg.deload?C.am:C.mt}}> · {todayWeight}lb</span>}{dn>0&&<span style={{color:all?C.gn:C.am}}> · {dn}/{es}</span>}</div>
                </div>
                {pg?.up&&!all&&!isDeload&&<span style={{fontSize:9,fontWeight:700,color:C.gn,background:`${C.gn}14`,padding:"2px 6px",borderRadius:4,flexShrink:0}}>↑ LOAD</span>}
                {pg?.deload&&<span style={{fontSize:9,fontWeight:700,color:C.am,background:`${C.am}14`,padding:"2px 6px",borderRadius:4,flexShrink:0}}>60%</span>}
                <span style={{color:C.mt,transform:isE?"rotate(90deg)":"none",transition:"transform 0.2s",fontSize:18,flexShrink:0,lineHeight:1}}>›</span>
              </button>
              {isE&&(
                <div style={{padding:"0 14px 14px"}}>
                  <div style={{display:"flex",gap:6,marginBottom:10}}>
                    <button onClick={()=>setShowCues(showCues===xi?null:xi)} style={{flex:1,padding:"8px 12px",background:showCues===xi?`${C.ac}12`:"transparent",border:`1px solid ${showCues===xi?`${C.ac}44`:C.bd}`,borderRadius:8,color:showCues===xi?C.ac:C.mt,fontSize:11,cursor:"pointer",textAlign:"left",whiteSpace:showCues===xi?"normal":"nowrap",overflow:showCues===xi?"visible":"hidden",textOverflow:showCues===xi?"clip":"ellipsis",lineHeight:showCues===xi?1.5:"normal",display:"flex",alignItems:"center",gap:5}}>{showCues===xi?ex.cues:<><span style={{fontSize:10}}>📋</span> View cues</>}</button>
                    {ex.video&&<a href={ex.video} target="_blank" rel="noopener noreferrer" style={{padding:"8px 12px",background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,color:C.ac,fontSize:11,textDecoration:"none",flexShrink:0}}>Watch</a>}
                    <button onClick={()=>history?.exerciseId===ex.id?setHistory(null):loadHistory(ex.id)} style={{padding:"8px 12px",background:C.sf2,border:`1px solid ${history?.exerciseId===ex.id?`${C.ac}44`:C.bd}`,borderRadius:8,color:history?.exerciseId===ex.id?C.ac:C.mt,fontSize:11,cursor:"pointer",flexShrink:0}}>History</button>
                  </div>
                  <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
                    <MuscleDiagram muscle={ex.muscle} color={pg?.up?C.gn:pg?.deload?C.am:C.ac} imageUrl={ex.imageUrl}/>
                  </div>
                  {history?.exerciseId===ex.id&&history.weeks.length>0&&(
                    <div style={{background:C.sf2,borderRadius:10,padding:10,marginBottom:10}}>
                      <div style={{...lbl,marginBottom:8}}>Weight progression</div>
                      <div style={{display:"flex",alignItems:"flex-end",gap:3,height:50}}>
                        {history.weeks.slice(-12).map(w=>{const mn=Math.min(...history.weeks.map(x=>x.weight)),mx=Math.max(...history.weeks.map(x=>x.weight)),rn=mx-mn||1,h=((w.weight-mn)/rn)*40+8;return(<div key={w.week} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><span style={{fontSize:7,fontFamily:mono,color:C.tx}}>{w.weight}</span><div style={{width:"100%",height:h,background:w.week===week?C.ac:`${C.ac}44`,borderRadius:2,maxWidth:24}}/><span style={{fontSize:6,color:C.mt}}>W{w.week}</span></div>);})}
                      </div>
                    </div>
                  )}
                  {pg&&(
                    <div style={{...card2,marginBottom:10,background:pg.deload?`${C.am}08`:pg.up?`${C.gn}08`:C.sf2,borderColor:pg.deload?`${C.am}44`:pg.up?`${C.gn}44`:C.bd2}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div><div style={{...lbl,marginBottom:4}}>Today's weight</div><div style={{fontSize:22,fontWeight:700,fontFamily:mono,color:pg.deload?C.am:pg.up?C.gn:C.tx}}>{todayWeight}lb</div></div>
                        <div style={{textAlign:"right"}}><div style={{fontSize:11,color:C.mt}}>{pg.deload?"Deload 60%":pg.up?`+${ex.increment}lb`:"Hold"}</div><div style={{fontSize:10,color:C.mt,fontFamily:mono,marginTop:2}}>Last: {pg.w}lb · {typeof pg.r==="number"?pg.r.toFixed(1):pg.r} avg</div></div>
                      </div>
                    </div>
                  )}
                  <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                    <button onClick={()=>fill(ex.id,es,todayWeight||0)} style={{padding:"7px 12px",background:pg?.up?`${C.gn}10`:pg?.deload?`${C.am}10`:C.sf2,border:`1px solid ${pg?.up?`${C.gn}33`:pg?.deload?`${C.am}33`:C.bd}`,borderRadius:8,color:pg?.up?C.gn:pg?.deload?C.am:C.mt,fontSize:12,fontWeight:600,cursor:"pointer"}}>Fill {todayWeight||0}lb</button>
                    {pg?.up&&<button onClick={()=>fill(ex.id,es,pg.w)} style={{padding:"7px 12px",background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,color:C.mt,fontSize:12,cursor:"pointer"}}>Keep {pg.w}lb</button>}
                  </div>
                  {showTimer?<Timer key={timerKey} duration={restDur} onDismiss={()=>setShowTimer(false)}/>
                  :<button onClick={startTimer} style={{width:"100%",padding:"9px",marginBottom:10,background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,color:C.mt,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.mt} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    Start rest timer ({Math.floor(restDur/60)}:{String(restDur%60).padStart(2,"0")})
                  </button>}
                  <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 40px",gap:5,marginBottom:5}}>{["Set","Weight","Reps",""].map(h=><span key={h} style={hlbl}>{h}</span>)}</div>
                  {Array.from({length:es},(_,i)=>{const sn=i+1,s=gs(ex.id,sn),ok=s.reps>0,hi=s.reps>ex.repMax,lo=s.reps>0&&s.reps<ex.repMin;
                    return(<div key={i} style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 40px",gap:5,marginBottom:5,alignItems:"center"}}><div style={{fontFamily:mono,fontSize:12,fontWeight:600,color:ok?C.gn:C.mt,textAlign:"center"}}>{sn}</div><input type="number" inputMode="decimal" value={s.weight||""} placeholder="lbs" onChange={e=>ul(ex.id,sn,"weight",e.target.value)} onBlur={()=>sv(ex.id,sn)} style={inp}/><input type="number" inputMode="numeric" value={s.reps||""} placeholder={`${ex.repMin}-${ex.repMax}`} onChange={e=>ul(ex.id,sn,"reps",e.target.value)} onBlur={()=>sv(ex.id,sn)} style={{...inp,borderColor:hi?`${C.gn}55`:lo?`${C.rd}55`:C.bd}}/><div style={{fontSize:9,fontFamily:mono,color:hi?C.gn:lo?C.rd:C.mt,textAlign:"center"}}>{hi?"PR":lo?"low":ok?"ok":""}</div></div>);
                  })}
                  {xi<day.exercises.length-1&&<button onClick={()=>{setExpEx(xi+1);setShowTimer(false);setHistory(null);}} style={{...btnP,marginTop:6,fontSize:13}}>Next exercise →</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Fuel({foods,setFoods,mt,setMt,meas=[],online,onPC}){
  const[log,setLog]=useState([]);const[search,setSearch]=useState("");const[showS,setShowS]=useState(false);const[cat,setCat]=useState("All");const[showCalc,setShowCalc]=useState(false);const[showAdd,setShowAdd]=useState(false);const[showRecent,setShowRecent]=useState(false);const savedMt=cache.get("mt");
  const latMeas=meas.length>0?meas[meas.length-1]:null;
  const latBW=latMeas?.bodyweight_lb||savedMt?.bw||205;
  const latBF=latMeas?.body_fat_pct||(latMeas?.waist_in&&latMeas?.neck_in&&latMeas?.height_in?navyBF(latMeas.waist_in,latMeas.neck_in,latMeas.height_in):null)||19.5;
  const[calcW,setCalcW]=useState(String(latBW));const[calcH,setCalcH]=useState(String(latMeas?.height_in||71));const[calcAge,setCalcAge]=useState("30");const[calcBF,setCalcBF]=useState(String(parseFloat(latBF).toFixed(1)));const[calcAct,setCalcAct]=useState("Active");const[calcG,setCalcG]=useState((!savedMt?.goalName||savedMt?.goalName==="Maintain")?"Cut":savedMt?.goalName);const[calcP,setCalcP]=useState("1.18");const[calcF,setCalcF]=useState("0.37");const[useEmpirical,setUseEmpirical]=useState(true);const[empiricalMaint,setEmpiricalMaint]=useState(String(cache.get("empiricalMaint")||"3100"));const[nf,setNf]=useState({name:"",portion_size:"",portion_unit:"",protein_g:"",carbs_g:"",fat_g:"",calories:"",category:"Protein"});const[recentFoods,setRecentFoods]=useState([]);const[td]=useState(localDate());
  const[showAI,setShowAI]=useState(false);const[aiText,setAiText]=useState("");const[aiImg,setAiImg]=useState(null);const[aiImgMime,setAiImgMime]=useState("image/jpeg");const[aiLoading,setAiLoading]=useState(false);const[aiResult,setAiResult]=useState(null);const[aiError,setAiError]=useState(null);const aiFileRef=useRef(null);const[showScan,setShowScan]=useState(false);const[scanStatus,setScanStatus]=useState("Point camera at barcode");const scanRef=useRef(null);const streamRef=useRef(null);const scanLockRef=useRef(false);
  const[showPlan,setShowPlan]=useState(false);
  const[plan,setPlan]=useState(null);
  const[planLoading,setPlanLoading]=useState(false);
  const[planError,setPlanError]=useState(null);
  async function generatePlan(){setPlanLoading(true);setPlanError(null);setPlan(null);try{const res=await fetch("/api/meal-plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({foods:foods.filter(f=>f.calories>0).map(f=>({name:f.name.replace(/[^\x20-\x7E]/g,'').replace(/"/g,"'").trim(),portion_size:f.portion_size,portion_unit:f.portion_unit,protein_g:f.protein_g,carbs_g:f.carbs_g,fat_g:f.fat_g,calories:f.calories,category:f.category})),targets:{protein:mt.protein,carbs:mt.carbs,fat:mt.fat,calories:mt.calories}})});const data=await res.json();if(data.error)throw new Error(data.detail?`${data.error}: ${data.detail}`:data.error);const slots=["breakfast","lunch","dinner","snacks"];slots.forEach(slot=>{if(!Array.isArray(data[slot]))data[slot]=[];});setPlan(data);}catch(err){setPlanError(err.message||"Failed to generate plan");}finally{setPlanLoading(false);}}
  function planTotal(){if(!plan)return{protein:0,carbs:0,fat:0,calories:0};const all=[...plan.breakfast,...plan.lunch,...plan.dinner,...plan.snacks];return all.reduce((a,m)=>({protein:a.protein+(m.protein_g||0)*(m.portions||1),carbs:a.carbs+(m.carbs_g||0)*(m.portions||1),fat:a.fat+(m.fat_g||0)*(m.portions||1),calories:a.calories+(m.calories||0)*(m.portions||1)}),{protein:0,carbs:0,fat:0,calories:0});}
  async function logPlanToday(){if(!plan)return;const all=[...plan.breakfast,...plan.lunch,...plan.dinner,...plan.snacks];for(const f of all){if(!f.id)continue;const entry={id:`t_${Date.now()}_${f.id}`,food:f.name,portions:f.portions||1,protein:f.protein_g,carbs:f.carbs_g,fat:f.fat_g,calories:f.calories,foodId:f.id};setLog(p=>{const n=[...p,entry];cache.set(`meals_${td}`,n);return n;});try{await supabase.from("meal_log").insert({log_date:td,food_id:f.id,portions:f.portions||1});}catch{addPending({type:"insert_meal",date:td,foodId:f.id,portions:f.portions||1});onPC();}}setShowPlan(false);setPlan(null);}
  useEffect(()=>{loadLog();loadRecent();},[]);
  async function loadLog(){try{const{data}=await supabase.from("meal_log").select("*,foods(*)").eq("log_date",td).order("created_at");if(data){const l=data.map(m=>({id:m.id,food:m.foods?.name||"?",portions:parseFloat(m.portions),protein:m.foods?.protein_g||0,carbs:m.foods?.carbs_g||0,fat:m.foods?.fat_g||0,calories:m.foods?.calories||0,foodId:m.food_id}));setLog(l);cache.set(`meals_${td}`,l);}}catch{const c=cache.get(`meals_${td}`);if(c)setLog(c);}}
  async function loadRecent(){try{const y=new Date();y.setDate(y.getDate()-1);const yesterday=`${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,"0")}-${String(y.getDate()).padStart(2,"0")}`;const{data}=await supabase.from("meal_log").select("food_id,portions,foods(*)").gte("log_date",yesterday).order("created_at",{ascending:false}).limit(20);if(data){const seen=new Set();const unique=[];data.forEach(m=>{if(m.foods&&!seen.has(m.food_id)){seen.add(m.food_id);unique.push({...m.foods,lastPortions:parseFloat(m.portions)});}});setRecentFoods(unique);cache.set("recent_foods",unique);}}catch{const c=cache.get("recent_foods");if(c)setRecentFoods(c);}}
  async function add(f,portions=1){const entry={id:`t_${Date.now()}`,food:f.name,portions,protein:f.protein_g,carbs:f.carbs_g,fat:f.fat_g,calories:f.calories,foodId:f.id};setLog(p=>{const n=[...p,entry];cache.set(`meals_${td}`,n);return n;});try{const{data:ins}=await supabase.from("meal_log").insert({log_date:td,food_id:f.id,portions}).select().single();if(ins)setLog(p=>p.map(m=>m.id===entry.id?{...m,id:ins.id}:m));}catch{addPending({type:"insert_meal",date:td,foodId:f.id,portions});onPC();}setShowS(false);setShowRecent(false);setSearch("");}
  async function rm(i){const e=log[i];setLog(p=>{const n=p.filter((_,x)=>x!==i);cache.set(`meals_${td}`,n);return n;});if(e?.id&&!String(e.id).startsWith("t")){try{await supabase.from("meal_log").delete().eq("id",e.id);}catch{addPending({type:"delete_meal",id:e.id});onPC();}}}
  async function up(i,pt){const np=Math.max(0.25,pt);setLog(p=>{const n=p.map((m,x)=>x===i?{...m,portions:np}:m);cache.set(`meals_${td}`,n);return n;});const e=log[i];if(e?.id&&!String(e.id).startsWith("t")){try{await supabase.from("meal_log").update({portions:np}).eq("id",e.id);}catch{addPending({type:"update_portions",id:e.id,portions:np});onPC();}}}
  async function saveNewFood(){if(!nf.name||!nf.calories)return;const entry={name:nf.name,portion_size:parseFloat(nf.portion_size)||1,portion_unit:nf.portion_unit||"serving",protein_g:parseFloat(nf.protein_g)||0,carbs_g:parseFloat(nf.carbs_g)||0,fat_g:parseFloat(nf.fat_g)||0,calories:parseFloat(nf.calories)||0,category:nf.category};try{const{data}=await supabase.from("foods").insert(entry).select().single();if(data)setFoods(p=>[...p,data].sort((a,b)=>a.name.localeCompare(b.name)));}catch{addPending({type:"insert_food",data:entry});onPC();setFoods(p=>[...p,{...entry,id:`t_${Date.now()}`}].sort((a,b)=>a.name.localeCompare(b.name)));}setNf({name:"",portion_size:"",portion_unit:"",protein_g:"",carbs_g:"",fat_g:"",calories:"",category:"Protein"});setShowAdd(false);}
  const tot=log.reduce((a,m)=>({protein:a.protein+(m.protein||0)*m.portions,carbs:a.carbs+(m.carbs||0)*m.portions,fat:a.fat+(m.fat||0)*m.portions,calories:a.calories+(m.calories||0)*m.portions}),{protein:0,carbs:0,fat:0,calories:0});
  const flt=foods.filter(f=>f.name.toLowerCase().includes(search.toLowerCase())&&(cat==="All"||f.category===cat));
  function getSuggested(){const remPro=Math.max(0,mt.protein-Math.round(tot.protein));const remCal=Math.max(0,mt.calories-Math.round(tot.calories));const remFat=Math.max(0,mt.fat-Math.round(tot.fat));if(remPro<10||foods.length===0)return[];const loggedIds=new Set(log.map(m=>m.foodId).filter(Boolean));const proRatio=remPro*4/Math.max(remCal,1);const seed=Math.floor(Date.now()/3600000);return foods.filter(f=>f.protein_g>0&&f.calories>=30&&!loggedIds.has(f.id)).map((f,i)=>{const lean=f.protein_g*4/(f.calories||1);const calFit=1-Math.min(1,Math.abs(f.calories-remCal*0.3)/500);const fatPenalty=remFat<20&&f.fat_g>10?-0.5:0;const variety=Math.sin(seed+i*137.5)*0.15;return{...f,score:lean*proRatio*60+calFit*20+fatPenalty+variety};}).sort((a,b)=>b.score-a.score).slice(0,3);}
  const suggested=getSuggested();
  const remPro=Math.max(0,mt.protein-Math.round(tot.protein));
  const remCal=Math.max(0,mt.calories-Math.round(tot.calories));
  function recalc(){const w=parseFloat(calcW)||205,h=parseFloat(calcH)||71,age=parseFloat(calcAge)||30;const bf=parseFloat(calcBF)||20;const leanMass=w*(1-bf/100);const act=ACTIVITY.find(a=>a.name===calcAct)||ACTIVITY[2];const goal=GOALS.find(g=>g.name===calcG)||GOALS[1];const tdee=useEmpirical?parseFloat(empiricalMaint)||3100:calcTDEE(w,h,age,act.mult);const cal=Math.round(tdee+goal.delta);const protein=Math.round(leanMass*(parseFloat(calcP)||1.18));const fat=Math.max(70,Math.round(leanMass*(parseFloat(calcF)||0.37)));const carbs=Math.max(0,Math.round((cal-protein*4-fat*9)/4));setMt({protein,carbs,fat,calories:cal,goalName:calcG,bw:w});cache.set("mt",{protein,carbs,fat,calories:cal,goalName:calcG,bw:w});if(useEmpirical)cache.set("empiricalMaint",empiricalMaint);try{supabase.from("macro_targets").update({protein_g_target:protein,carbs_g_target:carbs,fat_g_target:fat,calories_target:cal,bodyweight_lb:w,goal_name:calcG}).eq("is_active",true);}catch{}setShowCalc(false);}
  function previewMacros(overrideGoal){const w=parseFloat(calcW)||205,h=parseFloat(calcH)||71,age=parseFloat(calcAge)||30;const bf=parseFloat(calcBF)||20;const leanMass=w*(1-bf/100);const act=ACTIVITY.find(a=>a.name===calcAct)||ACTIVITY[2];const goal=GOALS.find(g=>g.name===(overrideGoal||calcG))||GOALS[1];const tdee=useEmpirical?parseFloat(empiricalMaint)||3100:calcTDEE(w,h,age,act.mult);const cal=Math.round(tdee+goal.delta);const protein=Math.round(leanMass*(parseFloat(calcP)||1.18));const fat=Math.max(70,Math.round(leanMass*(parseFloat(calcF)||0.37)));const carbs=Math.max(0,Math.round((cal-protein*4-fat*9)/4));return{protein,carbs,fat,calories:cal,tdee,leanMass:Math.round(leanMass)};}
  async function startScan(){scanLockRef.current=false;setShowScan(true);setShowAI(false);setAiResult(null);setScanStatus("Starting camera...");try{const ZXing=await import("https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/+esm");const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});streamRef.current=stream;if(scanRef.current){scanRef.current.srcObject=stream;scanRef.current.play();}setScanStatus("Point camera at barcode");const reader=new ZXing.BrowserMultiFormatReader();reader.decodeFromStream(stream,scanRef.current,async(result,err)=>{if(!result||scanLockRef.current)return;scanLockRef.current=true;const barcode=result.getText();if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}setScanStatus("Looking up product...");try{const res=await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);const data=await res.json();if(data.status===1&&data.product){const p=data.product;const n=p.nutriments;const hasServingData=n.proteins_serving!=null||n["energy-kcal_serving"]!=null;const servingQty=parseFloat(p.serving_quantity)||0;const servingSize=p.serving_size||"serving";let protein,carbs,fat,calories;if(hasServingData){protein=parseFloat(n.proteins_serving||0);carbs=parseFloat(n.carbohydrates_serving||0);fat=parseFloat(n.fat_serving||0);calories=parseFloat(n["energy-kcal_serving"]||0);}else if(servingQty>0){const scale=servingQty/100;protein=parseFloat(n.proteins||0)*scale;carbs=parseFloat(n.carbohydrates||0)*scale;fat=parseFloat(n.fat||0)*scale;calories=parseFloat(n["energy-kcal"]||0)*scale;}else{protein=parseFloat(n.proteins||0);carbs=parseFloat(n.carbohydrates||0);fat=parseFloat(n.fat||0);calories=parseFloat(n["energy-kcal"]||0);}setAiResult({name:p.product_name||p.generic_name||"Scanned food",portion_size:servingQty||100,portion_unit:servingSize,protein_g:Math.round(protein*10)/10,carbs_g:Math.round(carbs*10)/10,fat_g:Math.round(fat*10)/10,calories:Math.round(calories),notes:hasServingData?"From barcode scan":servingQty>0?"Scaled to serving size":"Per 100g — check serving size"});setShowScan(false);setShowAI(true);setScanStatus("Point camera at barcode");}else{setScanStatus("Product not found — try AI Log instead");setTimeout(()=>{setShowScan(false);scanLockRef.current=false;},2500);}}catch{setScanStatus("Lookup failed — try AI Log instead");setTimeout(()=>{setShowScan(false);scanLockRef.current=false;},2500);}});}catch(e){setScanStatus(`Camera error: ${e.message}`);setTimeout(()=>setShowScan(false),2500);}}
  function stopScan(){scanLockRef.current=false;if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}setShowScan(false);}
  function handleAIPhoto(e){const file=e.target.files?.[0];if(!file)return;setAiImgMime(file.type||"image/jpeg");const reader=new FileReader();reader.onload=ev=>{const b64=ev.target.result.split(",")[1];setAiImg(b64);};reader.readAsDataURL(file);}
  async function runAIParse(){if(!aiText&&!aiImg)return;setAiLoading(true);setAiError(null);setAiResult(null);try{const res=await fetch("/api/ai-parse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:aiText||undefined,imageBase64:aiImg||undefined,mimeType:aiImgMime})});const data=await res.json();if(data.error)throw new Error(data.detail?`${data.error}: ${data.detail}`:data.error);setAiResult({...data,protein_g:parseFloat(data.protein_g)||0,carbs_g:parseFloat(data.carbs_g)||0,fat_g:parseFloat(data.fat_g)||0,calories:parseFloat(data.calories)||0,portion_size:parseFloat(data.portion_size)||1});}catch(err){setAiError(err.message||"Something went wrong");}finally{setAiLoading(false);}}
  async function logAIResult(saveToDb){if(!aiResult)return;if(saveToDb){const entry={name:aiResult.name,portion_size:aiResult.portion_size,portion_unit:aiResult.portion_unit||"serving",protein_g:aiResult.protein_g,carbs_g:aiResult.carbs_g,fat_g:aiResult.fat_g,calories:aiResult.calories,category:"Meal"};try{const{data}=await supabase.from("foods").insert(entry).select().single();if(data){setFoods(p=>[...p,data].sort((a,b)=>a.name.localeCompare(b.name)));await add(data,1);return;}}catch{}}const entry={id:`t_${Date.now()}`,food:aiResult.name,portions:1,protein:aiResult.protein_g,carbs:aiResult.carbs_g,fat:aiResult.fat_g,calories:aiResult.calories,foodId:null};setLog(p=>{const n=[...p,entry];cache.set(`meals_${td}`,n);return n;});setShowAI(false);setAiText("");setAiImg(null);setAiResult(null);}

  return(
    <div style={{padding:"24px 16px"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
        <div><div style={{fontSize:20,fontWeight:700}}>Fuel</div><div style={{fontSize:11,color:C.mt,marginTop:1}}>{mt.calories} cal target</div></div>
        <button onClick={()=>setShowCalc(!showCalc)} style={{...btnGhost,color:showCalc?C.ac:C.mt,borderColor:showCalc?`${C.ac}44`:C.bd,marginTop:2}}>Calculator</button>
      </div>
      {showCalc&&(()=>{const prev=previewMacros();return(<div style={{...card,marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}><div><div style={{...lbl2,marginBottom:4}}>Weight (lb)</div><input type="number" value={calcW} onChange={e=>setCalcW(e.target.value)} style={{...inp,fontSize:13}}/></div><div><div style={{...lbl2,marginBottom:4}}>Height (in)</div><input type="number" value={calcH} onChange={e=>setCalcH(e.target.value)} style={{...inp,fontSize:13}}/></div><div><div style={{...lbl2,marginBottom:4}}>Age</div><input type="number" value={calcAge} onChange={e=>setCalcAge(e.target.value)} style={{...inp,fontSize:13}}/></div><div><div style={{...lbl2,marginBottom:4}}>Body Fat %</div><input type="number" value={calcBF} onChange={e=>setCalcBF(e.target.value)} style={{...inp,fontSize:13}}/></div></div>
        <div style={{padding:"7px 12px",background:`${C.gn}10`,borderRadius:8,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:11,color:C.mt}}>Lean mass (protein anchor)</span><span style={{fontFamily:mono,fontSize:13,fontWeight:700,color:C.gn}}>{prev.leanMass} lb</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}><div><div style={{...lbl2,marginBottom:4}}>Protein / lean lb</div><input type="number" value={calcP} onChange={e=>setCalcP(e.target.value)} style={{...inp,fontSize:13}}/></div><div><div style={{...lbl2,marginBottom:4}}>Fat / lean lb</div><input type="number" value={calcF} onChange={e=>setCalcF(e.target.value)} style={{...inp,fontSize:13}}/></div></div>
        <div style={{...lbl2,marginBottom:6}}>Maintenance calories</div>
        <div style={{display:"flex",gap:6,marginBottom:10}}><button onClick={()=>setUseEmpirical(false)} style={{flex:1,padding:"7px",borderRadius:8,border:`1px solid ${!useEmpirical?C.ac:C.bd}`,background:!useEmpirical?`${C.ac}15`:"transparent",color:!useEmpirical?C.ac:C.mt,fontSize:11,fontWeight:!useEmpirical?600:400,cursor:"pointer"}}>Calculate (formula)</button><button onClick={()=>setUseEmpirical(true)} style={{flex:1,padding:"7px",borderRadius:8,border:`1px solid ${useEmpirical?C.ac:C.bd}`,background:useEmpirical?`${C.ac}15`:"transparent",color:useEmpirical?C.ac:C.mt,fontSize:11,fontWeight:useEmpirical?600:400,cursor:"pointer"}}>Real world (what I eat)</button></div>
        {useEmpirical?(<div style={{marginBottom:12}}><div style={{...lbl2,marginBottom:4}}>Calories currently maintaining on</div><input type="number" value={empiricalMaint} onChange={e=>setEmpiricalMaint(e.target.value)} style={{...inp,fontSize:16}}/><div style={{fontSize:10,color:C.mt,marginTop:5}}>Based on your actual weight trend — more accurate than any formula</div></div>):(<div style={{marginBottom:12}}><div style={{...lbl2,marginBottom:6}}>Activity level</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{ACTIVITY.map(a=><button key={a.name} onClick={()=>setCalcAct(a.name)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${calcAct===a.name?C.ac:C.bd}`,background:calcAct===a.name?`${C.ac}15`:"transparent",color:calcAct===a.name?C.ac:C.mt,fontSize:11,fontWeight:calcAct===a.name?600:400,cursor:"pointer"}}>{a.name}<span style={{fontSize:9,color:C.mt,display:"block"}}>{a.label}</span></button>)}</div></div>)}
        <div style={{padding:"8px 12px",background:C.sf2,borderRadius:8,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:11,color:C.mt}}>{useEmpirical?"Your maintenance":"Calculated TDEE"}</span><span style={{fontFamily:mono,fontSize:14,fontWeight:700,color:C.tx}}>{prev.tdee} cal</span></div>
        <div style={{...lbl2,marginBottom:6}}>Goal</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>{GOALS.map(g=>{const p=previewMacros(g.name);return(<button key={g.name} onClick={()=>setCalcG(g.name)} style={{flex:1,padding:"8px 6px",borderRadius:8,border:`1px solid ${calcG===g.name?C.ac:C.bd}`,background:calcG===g.name?`${C.ac}15`:"transparent",cursor:"pointer",textAlign:"center"}}><div style={{fontSize:12,fontWeight:calcG===g.name?700:400,color:calcG===g.name?C.ac:C.mt}}>{g.name}</div><div style={{fontSize:10,fontFamily:mono,color:calcG===g.name?C.ac:C.mt,marginTop:2}}>{p.calories} cal</div></button>);})}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:12}}>{[{l:"Protein",v:prev.protein,u:"g",c:C.gn},{l:"Carbs",v:prev.carbs,u:"g",c:C.bl},{l:"Fat",v:prev.fat,u:"g",c:C.am},{l:"Calories",v:prev.calories,u:"",c:C.ac}].map(m=>(<div key={m.l} style={{background:C.sf2,borderRadius:8,padding:"8px 4px",textAlign:"center"}}><div style={{fontSize:16,fontWeight:700,fontFamily:mono,color:m.c}}>{m.v}</div><div style={{fontSize:8,color:C.mt,marginTop:2}}>{m.l}</div></div>))}</div>
        <button onClick={recalc} style={btnP}>Set as targets</button>
      </div>);})()}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>{[{l:"Pro",v:Math.round(tot.protein),t:mt.protein,u:"g",c:C.gn},{l:"Carb",v:Math.round(tot.carbs),t:mt.carbs,u:"g",c:C.bl},{l:"Fat",v:Math.round(tot.fat),t:mt.fat,u:"g",c:C.am},{l:"Cal",v:Math.round(tot.calories),t:mt.calories,u:"",c:C.ac}].map(m=>{const p=Math.round((m.v/m.t)*100);return(<div key={m.l} style={{background:C.sf,borderRadius:10,padding:"12px 6px",textAlign:"center",border:`1px solid ${C.bd}`}}><div style={{fontSize:20,fontWeight:700,fontFamily:mono,color:p>100?C.rd:m.c,lineHeight:1}}>{m.v}</div><div style={{fontSize:9,color:C.mt,marginTop:3}}>/{m.t}{m.u}</div><div style={{width:"100%",height:4,background:C.bd,borderRadius:2,marginTop:6,overflow:"hidden"}}><div style={{width:`${Math.min(p,100)}%`,height:"100%",background:m.c,borderRadius:2}}/></div><div style={{...hlbl,marginTop:5}}>{m.l}</div></div>);})}</div>
      {suggested.length>0&&!showS&&!showAdd&&(<div style={{marginBottom:14}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><span style={lbl}>Suggested next</span><span style={{fontSize:10,color:C.mt,fontFamily:mono}}>{remPro}g pro · {remCal} cal left</span></div><div style={{display:"flex",flexDirection:"column",gap:5}}>{suggested.map(f=>(<button key={f.id} onClick={()=>add(f,1)} style={{padding:"10px 12px",background:C.sf,border:`1px solid ${C.bd}`,borderRadius:10,color:C.tx,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left",width:"100%"}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{f.name}</div><div style={{fontSize:10,color:C.mt,marginTop:1}}>{f.portion_size} {f.portion_unit}</div></div><div style={{textAlign:"right",flexShrink:0,marginLeft:10}}><div style={{fontSize:12,fontFamily:mono,color:C.gn,fontWeight:600}}>{f.protein_g}p</div><div style={{fontSize:9,color:C.mt,fontFamily:mono}}>{f.calories}cal</div></div></button>))}</div></div>)}
      {recentFoods.length>0&&!showS&&!showAdd&&(<div style={{marginBottom:14}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><span style={lbl}>Recent</span><button onClick={()=>setShowRecent(!showRecent)} style={{background:"none",border:"none",color:C.ac,fontSize:10,cursor:"pointer"}}>{showRecent?"Less":"More"}</button></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{(showRecent?recentFoods:recentFoods.slice(0,6)).map(f=><button key={f.id} onClick={()=>add(f,f.lastPortions||1)} style={{padding:"7px 10px",background:C.sf,border:`1px solid ${C.bd}`,borderRadius:8,color:C.tx,fontSize:11,cursor:"pointer",display:"flex",gap:5,alignItems:"center"}}><span style={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name.length>18?f.name.slice(0,18)+"…":f.name}</span><span style={{fontFamily:mono,fontSize:10,color:C.gn,flexShrink:0}}>{f.protein_g}p</span></button>)}</div></div>)}
      <button onClick={()=>{if(showScan)stopScan();else startScan();setShowAI(false);}} style={{...btnGhost,width:"100%",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px",borderColor:showScan?`${C.ac}44`:C.bd,color:showScan?C.ac:C.mt}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9V6a2 2 0 012-2h2M15 4h2a2 2 0 012 2v3M3 15v3a2 2 0 002 2h2M15 20h2a2 2 0 002-2v-3M7 9h10v6H7z"/></svg>
        {showScan?"Close scanner":"Scan barcode"}
      </button>
      {showScan&&(<div style={{...card,marginBottom:12,textAlign:"center"}}><video ref={scanRef} style={{width:"100%",borderRadius:8,background:C.sf2,maxHeight:220,objectFit:"cover"}} playsInline muted/><div style={{fontSize:11,color:C.mt,marginTop:8}}>{scanStatus}</div><button onClick={stopScan} style={{...btnGhost,marginTop:8,padding:"6px 16px"}}>Cancel</button></div>)}
      <button onClick={()=>{setShowAI(!showAI);setShowS(false);setShowAdd(false);setAiResult(null);setAiError(null);}} style={{...btnP,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:showAI?C.sf2:C.ac,color:showAI?C.mt:C.bg,border:showAI?`1px solid ${C.bd}`:"none"}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showAI?C.mt:C.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        {showAI?"Close AI Log":"AI Log — photo or text"}
      </button>
      {showAI&&(<div style={{...card,marginBottom:12}}>
        <div style={{...hlbl,marginBottom:10}}>Snap a label, meal, or just type what you ate</div>
        <input ref={aiFileRef} type="file" style={{display:"none"}} onChange={handleAIPhoto}/>
        <div style={{display:"flex",gap:8,marginBottom:10}}><button onClick={()=>aiFileRef.current?.click()} style={{flex:1,padding:"10px",background:aiImg?`${C.gn}12`:C.sf2,border:`1px solid ${aiImg?C.gn+"44":C.bd}`,borderRadius:10,color:aiImg?C.gn:C.mt,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>{aiImg?"Photo ready ✓":"Take / upload photo"}</button>{aiImg&&<button onClick={()=>setAiImg(null)} style={{...btnGhost,padding:"10px 12px",color:C.rd,borderColor:`${C.rd}33`}}>×</button>}</div>
        <textarea value={aiText} onChange={e=>setAiText(e.target.value)} placeholder={'e.g. "2 scrambled eggs, cup of oatmeal with honey"'} style={{...inpL,height:70,resize:"none",padding:"10px 12px",lineHeight:1.5,marginBottom:10}}/>
        <button onClick={runAIParse} disabled={aiLoading||(!aiText&&!aiImg)} style={{...btnP,opacity:aiLoading||(!aiText&&!aiImg)?0.5:1,marginBottom:aiError||aiResult?10:0}}>{aiLoading?"Analyzing...":"Parse with AI"}</button>
        {aiError&&<div style={{padding:"8px 10px",background:`${C.rd}10`,border:`1px solid ${C.rd}33`,borderRadius:8,fontSize:11,color:C.rd}}>{aiError}</div>}
        {aiResult&&(<div style={{background:C.sf2,borderRadius:10,border:`1px solid ${C.gn}33`,padding:12}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{aiResult.name}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:10}}>{[{l:"Protein",v:"protein_g",c:C.gn},{l:"Carbs",v:"carbs_g",c:C.bl},{l:"Fat",v:"fat_g",c:C.am},{l:"Calories",v:"calories",c:C.ac}].map(f=>(<div key={f.l}><div style={{...lbl2,color:f.c,marginBottom:3}}>{f.l}</div><input type="number" value={aiResult[f.v]} onChange={e=>setAiResult(p=>({...p,[f.v]:parseFloat(e.target.value)||0}))} style={{...inp,fontSize:13,borderColor:`${f.c}33`}}/></div>))}</div>
          {aiResult.notes&&<div style={{fontSize:10,color:C.mt,marginBottom:10,fontStyle:"italic"}}>{aiResult.notes}</div>}
          <div style={{display:"flex",gap:6,marginBottom:8}}><button onClick={()=>logAIResult(false)} style={{...btnS,flex:1}}>Log only</button><button onClick={()=>logAIResult(true)} style={{...btnP,flex:1,fontSize:12}}>Log + save to DB</button></div>
          <button onClick={()=>{setAiResult(null);setAiText("");setAiImg(null);startScan();}} style={{...btnGhost,width:"100%",textAlign:"center",fontSize:12}}>+ Scan another item</button>
        </div>)}
      </div>)}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={()=>{setShowS(!showS);setShowAdd(false);setShowAI(false);}} style={{...btnS,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={showS?C.mt:C.ac} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          {showS?"Close search":"Search foods"}
        </button>
        <button onClick={()=>{setShowAdd(!showAdd);setShowS(false);setShowAI(false);}} style={{...btnGhost,padding:"11px 14px",flexShrink:0,borderColor:showAdd?`${C.ac}44`:C.bd,color:showAdd?C.ac:C.mt}}>+ New</button>
      </div>
      {showAdd&&(<div style={{...card,marginBottom:12}}><div style={{...lbl,marginBottom:10}}>Custom food</div><input type="text" value={nf.name} onChange={e=>setNf(p=>({...p,name:e.target.value}))} placeholder="Food name" style={{...inpL,marginBottom:8}}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><input type="number" inputMode="decimal" value={nf.portion_size} onChange={e=>setNf(p=>({...p,portion_size:e.target.value}))} placeholder="Portion" style={inp}/><input type="text" value={nf.portion_unit} onChange={e=>setNf(p=>({...p,portion_unit:e.target.value}))} placeholder="Unit" style={inpL}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:10}}>{[{k:"protein_g",l:"Pro"},{k:"carbs_g",l:"Carb"},{k:"fat_g",l:"Fat"},{k:"calories",l:"Cal"}].map(f=><div key={f.k}><div style={{...lbl2,marginBottom:3}}>{f.l}</div><input type="number" value={nf[f.k]} onChange={e=>setNf(p=>({...p,[f.k]:e.target.value}))} style={inp}/></div>)}</div><div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>{["Protein","Carb","Fat","Snack","Meal","Misc"].map(c=><button key={c} onClick={()=>setNf(p=>({...p,category:c}))} style={{padding:"4px 10px",borderRadius:12,border:`1px solid ${nf.category===c?C.ac:C.bd}`,background:nf.category===c?`${C.ac}12`:"transparent",color:nf.category===c?C.ac:C.mt,fontSize:10,cursor:"pointer"}}>{c}</button>)}</div><button onClick={saveNewFood} style={btnP}>Save Food</button></div>)}
      {showS&&(<div style={{...card,marginBottom:12}}><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search foods..." style={{...inpL,marginBottom:8}} autoFocus/><div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>{["All","Protein","Carb","Fat","RTD Protein","Snack","Meal","Misc"].map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:"4px 10px",borderRadius:12,border:`1px solid ${cat===c?C.ac:C.bd}`,background:cat===c?`${C.ac}12`:"transparent",color:cat===c?C.ac:C.mt,fontSize:10,cursor:"pointer"}}>{c}</button>)}</div><div style={{maxHeight:280,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>{flt.length===0?<div style={{padding:"20px 0",textAlign:"center",color:C.mt,fontSize:12}}>No foods found</div>:flt.map(f=><button key={f.id} onClick={()=>add(f)} style={{width:"100%",padding:"10px 4px",background:"none",border:"none",borderBottom:`1px solid ${C.bd}`,color:C.tx,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{f.name}</div><div style={{fontSize:10,color:C.mt,marginTop:1}}>{f.portion_size} {f.portion_unit}</div></div><div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:12,fontFamily:mono,color:C.gn,fontWeight:600}}>{f.protein_g}p</div><div style={{fontSize:9,color:C.mt,fontFamily:mono}}>{f.calories}cal</div></div></button>)}</div></div>)}
      {log.length>0&&(<div><div style={{...lbl,marginBottom:8}}>Today</div>{log.map((m,i)=><div key={m.id||i} style={{background:C.sf,borderRadius:10,border:`1px solid ${C.bd}`,padding:"10px 12px",marginBottom:5,display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.food}</div><div style={{fontSize:10,color:C.mt,fontFamily:mono,marginTop:1}}>{Math.round(m.protein*m.portions)}p · {Math.round(m.carbs*m.portions)}c · {Math.round(m.fat*m.portions)}f · {Math.round(m.calories*m.portions)}cal</div></div><div style={{display:"flex",alignItems:"center",gap:3}}><button onClick={()=>up(i,m.portions-0.5)} style={tbtn}>-</button><span style={{fontSize:12,fontFamily:mono,width:24,textAlign:"center"}}>{m.portions}</span><button onClick={()=>up(i,m.portions+0.5)} style={tbtn}>+</button></div><button onClick={()=>rm(i)} style={{background:"none",border:"none",color:C.rd,fontSize:16,cursor:"pointer",padding:"2px",flexShrink:0}}>×</button></div>)}</div>)}
      {/* ── AI Meal Plan ── */}
      <div style={{marginTop:8,marginBottom:8}}>
        <button onClick={()=>{setShowPlan(!showPlan);if(!showPlan&&!plan)generatePlan();}} style={{...btnGhost,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 14px",borderColor:showPlan?`${C.ac}44`:C.bd,color:showPlan?C.ac:C.mt}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          {showPlan?"Close meal plan":"Generate AI meal plan"}
        </button>
        {showPlan&&(<div style={{...card,marginTop:8}}>
          {planLoading&&<div style={{textAlign:"center",padding:"24px 0",color:C.mt,fontSize:12}}>Building your meal plan...</div>}
          {planError&&<div style={{padding:"10px",background:`${C.rd}10`,border:`1px solid ${C.rd}33`,borderRadius:8,fontSize:11,color:C.rd,marginBottom:10}}>{planError}<button onClick={generatePlan} style={{...btnGhost,marginTop:8,width:"100%",textAlign:"center",color:C.ac,borderColor:`${C.ac}33`}}>Try again</button></div>}
          {plan&&(()=>{const pt=planTotal();const slots=["breakfast","lunch","dinner","snacks"];const slotColors={breakfast:C.am,lunch:C.gn,dinner:C.ac,snacks:C.bl};return(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><span style={{...lbl,color:C.ac}}>AI meal plan</span><button onClick={generatePlan} style={{background:"none",border:"none",color:C.mt,fontSize:10,cursor:"pointer"}}>regenerate</button></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:14}}>{[{l:"Pro",v:Math.round(pt.protein),t:mt.protein,c:C.gn},{l:"Carb",v:Math.round(pt.carbs),t:mt.carbs,c:C.bl},{l:"Fat",v:Math.round(pt.fat),t:mt.fat,c:C.am},{l:"Cal",v:Math.round(pt.calories),t:mt.calories,c:C.ac}].map(m=>{const pct=Math.round((m.v/m.t)*100);return(<div key={m.l} style={{background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,padding:"8px 4px",textAlign:"center"}}><div style={{fontSize:16,fontWeight:700,fontFamily:mono,color:pct>100?C.rd:m.c}}>{m.v}</div><div style={{fontSize:8,color:C.mt,marginTop:2}}>/{m.t}</div><div style={{width:"100%",height:3,background:C.bd,borderRadius:2,marginTop:4,overflow:"hidden"}}><div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:m.c,borderRadius:2}}/></div><div style={{...hlbl,marginTop:3}}>{m.l}</div></div>);})}</div>
            {slots.map(slot=>plan[slot]?.length>0&&(<div key={slot} style={{marginBottom:10}}><div style={{...lbl,marginBottom:5,color:slotColors[slot],textTransform:"capitalize"}}>{slot}</div>{plan[slot].map((f,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:C.sf2,borderRadius:8,marginBottom:4}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{f.portions&&f.portions!==1?`${f.portions}× `:""}{f.name}</div><div style={{fontSize:10,color:C.mt,fontFamily:mono}}>{Math.round((f.protein_g||0)*(f.portions||1))}p · {Math.round((f.calories||0)*(f.portions||1))}cal</div></div></div>))}</div>))}
            {plan.notes&&<div style={{fontSize:10,color:C.mt,fontStyle:"italic",marginBottom:10}}>{plan.notes}</div>}
            <button onClick={logPlanToday} style={{...btnP,fontSize:12}}>Log all to today</button>
          </>);})()}
        </div>)}
      </div>

      {log.length===0&&!showS&&!showAdd&&<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>No meals logged today</div>}
    </div>
  );
}

function Body({meas,onAdd,online,onPC}){
  const[showF,setShowF]=useState(false);
  const fields=[{k:"measure_date",l:"Date",t:"date"},{k:"bodyweight_lb",l:"Weight (lb)",t:"number"},{k:"chest_in",l:"Chest",t:"number"},{k:"waist_in",l:"Waist *",t:"number"},{k:"hips_in",l:"Hips",t:"number"},{k:"r_arm_in",l:"R Arm",t:"number"},{k:"l_arm_in",l:"L Arm",t:"number"},{k:"r_forearm_in",l:"R Forearm",t:"number"},{k:"l_forearm_in",l:"L Forearm",t:"number"},{k:"shoulder_circ_in",l:"Shoulders",t:"number"},{k:"thigh_in",l:"Thigh",t:"number"},{k:"calf_in",l:"Calf",t:"number"},{k:"neck_in",l:"Neck *",t:"number"}];
  const init={};fields.forEach(f=>init[f.k]=f.k==="measure_date"?localDate():"");
  const[fm,setFm]=useState(init);
  async function save(){if(!fm.bodyweight_lb)return;const e={};Object.entries(fm).forEach(([k,v])=>{e[k]=k==="measure_date"?v:(parseFloat(v)||null);});const lat=meas[meas.length-1];const h=lat?.height_in||70;if(e.waist_in&&e.neck_in)e.body_fat_pct=parseFloat(navyBF(e.waist_in,e.neck_in,h));e.height_in=h;try{const{data}=await supabase.from("measurements").insert(e).select().single();if(data){onAdd(data);setShowF(false);}}catch{onAdd({...e,id:`t_${Date.now()}`});addPending({type:"insert_measurement",data:e});onPC();setShowF(false);}}
  const lat=meas[meas.length-1];const prev=meas.length>1?meas[meas.length-2]:null;
  function delta(c,p){if(!c||!p)return null;const d=(c-p).toFixed(1);return parseFloat(d)>0?`+${d}`:d;}
  const latBF=lat?.body_fat_pct||(lat?.waist_in&&lat?.neck_in&&lat?.height_in?navyBF(lat.waist_in,lat.neck_in,lat.height_in):null);
  const wtDelta=delta(lat?.bodyweight_lb,prev?.bodyweight_lb);
  const bfDelta=lat&&prev?(()=>{const lbf=lat.body_fat_pct||(lat.waist_in&&lat.neck_in&&lat.height_in?navyBF(lat.waist_in,lat.neck_in,lat.height_in):null);const pbf=prev.body_fat_pct||(prev.waist_in&&prev.neck_in&&prev.height_in?navyBF(prev.waist_in,prev.neck_in,prev.height_in):null);return delta(parseFloat(lbf),parseFloat(pbf));})():null;
  return(
    <div style={{padding:"20px 16px"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Body</div>
      {lat&&(<div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.bd}`,padding:"16px 14px"}}><div style={{...lbl,marginBottom:6}}>Bodyweight</div><div style={{fontSize:28,fontWeight:800,fontFamily:mono,lineHeight:1}}>{lat.bodyweight_lb??<span style={{color:C.mt}}>—</span>}</div><div style={{fontSize:11,color:C.mt,marginTop:4}}>lb{wtDelta&&<span style={{color:parseFloat(wtDelta)>0?C.am:C.gn,marginLeft:5}}>{wtDelta}</span>}</div></div>
          <div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.ac}22`,padding:"16px 14px"}}><div style={{...lbl,marginBottom:6}}>Body fat</div><div style={{fontSize:28,fontWeight:800,fontFamily:mono,color:C.ac,lineHeight:1}}>{latBF??<span style={{color:C.mt,fontSize:20}}>—</span>}</div><div style={{fontSize:11,color:C.mt,marginTop:4}}>%{bfDelta&&<span style={{color:parseFloat(bfDelta)>0?C.rd:C.gn,marginLeft:5}}>{bfDelta}</span>}</div></div>
        </div>
        {lat.bodyweight_lb&&latBF&&(()=>{const lm=Math.round(lat.bodyweight_lb*(1-parseFloat(latBF)/100));const prevLm=prev?.bodyweight_lb&&(prev.body_fat_pct||(prev.waist_in&&prev.neck_in&&prev.height_in?navyBF(prev.waist_in,prev.neck_in,prev.height_in):null))?Math.round(prev.bodyweight_lb*(1-parseFloat(prev.body_fat_pct||(prev.waist_in&&prev.neck_in&&prev.height_in?navyBF(prev.waist_in,prev.neck_in,prev.height_in):null))/100)):null;const lmd=prevLm?((lm-prevLm)>0?`+${(lm-prevLm).toFixed(1)}`:(lm-prevLm).toFixed(1)):null;return(<div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.gn}22`,padding:"12px 14px",marginBottom:2}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{...lbl,marginBottom:4,color:C.gn}}>Lean mass</div><div style={{fontSize:24,fontWeight:800,fontFamily:mono,color:C.gn,lineHeight:1}}>{lm} <span style={{fontSize:11,fontWeight:400,color:C.mt}}>lb</span></div><div style={{fontSize:10,color:C.mt,marginTop:3}}>The number that matters on a cut{lmd&&<span style={{color:parseFloat(lmd)>0?C.gn:C.rd,marginLeft:5}}>{lmd} lb</span>}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:10,color:C.mt}}>= {lat.bodyweight_lb} lb</div><div style={{fontSize:10,color:C.mt}}>× {(100-parseFloat(latBF)).toFixed(1)}% lean</div></div></div></div>);})()}
        <div style={{fontSize:10,color:C.mt,marginBottom:12,padding:"4px 0",textAlign:"right"}}>{lat.measure_date}</div>
        <div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.bd}`,padding:14,marginBottom:12}}>
          <div style={{...lbl,marginBottom:12}}>Measurements</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {[{l:"Chest",v:lat.chest_in,p:prev?.chest_in},{l:"Waist",v:lat.waist_in,p:prev?.waist_in},{l:"Hips",v:lat.hips_in,p:prev?.hips_in},{l:"R Arm",v:lat.r_arm_in,p:prev?.r_arm_in},{l:"L Arm",v:lat.l_arm_in,p:prev?.l_arm_in},{l:"Shoulders",v:lat.shoulder_circ_in,p:prev?.shoulder_circ_in},{l:"R Forearm",v:lat.r_forearm_in,p:prev?.r_forearm_in},{l:"L Forearm",v:lat.l_forearm_in,p:prev?.l_forearm_in},{l:"Thigh",v:lat.thigh_in,p:prev?.thigh_in},{l:"Calf",v:lat.calf_in,p:prev?.calf_in},{l:"Neck",v:lat.neck_in,p:prev?.neck_in}].map(s=>{const d=delta(s.v,s.p);return(<div key={s.l}><div style={lbl2}>{s.l}</div><div style={{fontSize:16,fontWeight:700,fontFamily:mono,marginTop:2}}>{s.v??<span style={{color:C.mt,fontSize:12}}>—</span>}</div>{s.v&&<div style={{fontSize:9,color:C.mt}}>{d&&<span style={{color:parseFloat(d)>0?C.gn:C.rd}}>{d}</span>}</div>}</div>);})}
          </div>
        </div>
      </div>)}
      <button onClick={()=>setShowF(!showF)} style={{...btnS,marginBottom:12}}>{showF?"Cancel":"+ New measurement"}</button>
      {showF&&(<div style={{...card,marginBottom:12}}><div style={{fontSize:10,color:C.mt,marginBottom:10}}>BF% auto-calculates from waist + neck</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{fields.map(f=>(<div key={f.k}><label style={{fontSize:8,color:f.k==="waist_in"||f.k==="neck_in"?C.ac:C.mt,textTransform:"uppercase",letterSpacing:"0.06em"}}>{f.l}</label><input type={f.t} inputMode={f.t==="number"?"decimal":undefined} value={fm[f.k]} onChange={e=>setFm(p=>({...p,[f.k]:e.target.value}))} style={{...inp,marginTop:3,fontSize:13}}/></div>))}</div>{fm.waist_in&&fm.neck_in&&<div style={{marginTop:10,padding:"6px 10px",background:`${C.ac}08`,borderRadius:6,fontSize:12,color:C.ac,textAlign:"center"}}>Est. BF: {navyBF(parseFloat(fm.waist_in),parseFloat(fm.neck_in),meas[meas.length-1]?.height_in||70)||"—"}%</div>}<button onClick={save} style={{...btnP,marginTop:12}}>Save</button></div>)}
      <div style={{...lbl,marginBottom:8}}>History</div>
      {[...meas].reverse().map(m=>{const bf=m.body_fat_pct||(m.waist_in&&m.neck_in&&m.height_in?navyBF(m.waist_in,m.neck_in,m.height_in):null);return(<div key={m.id} style={{background:C.sf,borderRadius:10,border:`1px solid ${C.bd}`,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:10,color:C.mt}}>{m.measure_date}</div><div style={{fontSize:16,fontWeight:700,fontFamily:mono}}>{m.bodyweight_lb} lb</div></div><div style={{fontSize:10,color:C.mt,fontFamily:mono,textAlign:"right"}}>{bf&&<div style={{color:C.ac,marginBottom:2}}>BF {bf}%</div>}<div>{m.chest_in?`Ch ${m.chest_in}″`:""}{m.r_arm_in?` · A ${m.r_arm_in}″`:""}</div></div></div>);})}
    </div>
  );
}

function LineChart({points,color,height=90}){
  if(!points||points.length<2)return null;
  const W=400,H=height-20;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const rx=maxX-minX||1,ry=maxY-minY||1;
  const px=x=>((x-minX)/rx)*(W-24)+12;
  const py=y=>H-((y-minY)/ry)*(H-14)-2;
  const ptStr=points.map(p=>`${px(p.x)},${py(p.y)}`).join(" ");
  const last=points[points.length-1];
  return(
    <svg viewBox={`0 0 ${W} ${height}`} style={{width:"100%",height,display:"block",overflow:"visible"}}>
      <polyline points={ptStr} fill="none" stroke={`${color}25`} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points={ptStr} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {points.map((p,i)=><circle key={i} cx={px(p.x)} cy={py(p.y)} r="3" fill={color} stroke={C.bg} strokeWidth="1.5"/>)}
      <text x={px(last.x)} y={py(last.y)-8} textAnchor="middle" fontSize="9" fill={color} fontFamily="JetBrains Mono,monospace" fontWeight="600">{last.y}</text>
      <text x={px(points[0].x)} y={height-2} textAnchor="middle" fontSize="8" fill={C.mt} fontFamily="JetBrains Mono,monospace">{points[0].label||`W${points[0].x}`}</text>
      <text x={px(last.x)} y={height-2} textAnchor="middle" fontSize="8" fill={C.mt} fontFamily="JetBrains Mono,monospace">{last.label||`W${last.x}`}</text>
    </svg>
  );
}

function Stats({meas,week,online,activeProgram}){
  const[prs,setPrs]=useState([]);const[vol,setVol]=useState({});const[muscleTrend,setMuscleTrend]=useState({});const[view,setView]=useState("prs");const[selMuscle,setSelMuscle]=useState(null);
  useEffect(()=>{loadPRs();loadVol();loadMuscleTrend();},[week,activeProgram]);
  async function loadPRs(){try{const{data}=await supabase.from("workout_sets").select("exercise_id,weight_lb,reps,exercises(name)").order("weight_lb",{ascending:false});if(data){const best={};data.forEach(s=>{const n=s.exercises?.name;if(!n||!s.weight_lb||!s.reps)return;const e1=s.weight_lb*(1+s.reps/30);if(!best[n]||e1>best[n].est1rm)best[n]={exercise:n,weight:s.weight_lb,reps:s.reps,est1rm:e1};});const p=Object.values(best).sort((a,b)=>b.est1rm-a.est1rm);setPrs(p);cache.set("prs",p);}}catch{const c=cache.get("prs");if(c)setPrs(c);}}
  async function loadVol(){try{const{data}=await supabase.from("workout_sessions").select("id,workout_sets(exercise_id,reps,exercises(primary_muscle))").eq("week_number",week).eq("program_id",activeProgram);if(data){const m={};data.forEach(s=>s.workout_sets.forEach(ws=>{if(ws.reps>0&&ws.exercises?.primary_muscle){const mu=ws.exercises.primary_muscle;m[mu]=(m[mu]||0)+1;}}));setVol(m);}}catch{}}
  async function loadMuscleTrend(){try{const{data}=await supabase.from("workout_sets").select("weight_lb,exercises(primary_muscle),workout_sessions(week_number)").gt("weight_lb",0);if(data){const byMuscle={};data.forEach(s=>{const muscle=s.exercises?.primary_muscle;const wk=s.workout_sessions?.week_number;if(!muscle||!wk||!s.weight_lb)return;if(!byMuscle[muscle])byMuscle[muscle]={};if(!byMuscle[muscle][wk]||s.weight_lb>byMuscle[muscle][wk])byMuscle[muscle][wk]=s.weight_lb;});const result={};Object.entries(byMuscle).forEach(([muscle,weeks])=>{const pts=Object.entries(weeks).map(([wk,w])=>({x:parseInt(wk),y:w})).sort((a,b)=>a.x-b.x);if(pts.length>=2)result[muscle]=pts;});setMuscleTrend(result);cache.set("muscleTrend",result);}}catch{const c=cache.get("muscleTrend");if(c)setMuscleTrend(c);}}
  const wd=meas.filter(m=>m.bodyweight_lb);
  const bfData=meas.filter(m=>{const bf=m.body_fat_pct||(m.waist_in&&m.neck_in&&m.height_in?navyBF(m.waist_in,m.neck_in,m.height_in):null);return bf!==null;}).map((m,i)=>{const bf=parseFloat(m.body_fat_pct||(m.waist_in&&m.neck_in&&m.height_in?navyBF(m.waist_in,m.neck_in,m.height_in):null));return{x:i+1,y:bf};});
  const bwPoints=wd.map((m,i)=>({x:i+1,y:m.bodyweight_lb,label:m.measure_date?.slice(5)}));
  const allM=[...new Set([...Object.keys(VOL_TARGETS),...Object.keys(vol)])].filter(m=>vol[m]>0);
  const volD=allM.map(m=>({muscle:m,actual:vol[m]||0,min:VOL_TARGETS[m]?.min||0,max:VOL_TARGETS[m]?.max||20})).sort((a,b)=>b.actual-a.actual);
  const maxB=Math.max(...volD.map(v=>Math.max(v.actual,v.max)),1);
  const topPR=prs[0];const topRaw=prs.length?[...prs].sort((a,b)=>b.weight-a.weight)[0]:null;
  const muscleKeys=Object.keys(muscleTrend).sort();
  const activeMuscle=selMuscle&&muscleTrend[selMuscle]?selMuscle:muscleKeys[0]||null;
  const muscleColors={Chest:C.ac,Back:C.bl,Quads:C.gn,Hamstrings:"#5bc4a8",Glutes:"#a07aff",Shoulders:C.am,Biceps:"#ff7aaa",Triceps:"#ff9f5b",Calves:C.mt,Adductors:"#e07aff",Abductors:"#ff9f5b"};
  const getMC=m=>muscleColors[m]||C.ac;
  return(
    <div style={{padding:"20px 16px"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:14}}>Stats</div>
      {prs.length>0&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        {topPR&&<div style={{background:C.sf,borderRadius:10,border:`1px solid ${C.gn}22`,padding:"12px 14px"}}><div style={{...lbl,color:C.gn,marginBottom:5}}>Top E1RM</div><div style={{fontSize:20,fontWeight:700,fontFamily:mono,color:C.gn}}>{Math.round(topPR.est1rm)}<span style={{fontSize:10,color:C.mt,fontWeight:400}}> lb</span></div><div style={{fontSize:10,color:C.mt,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{topPR.exercise}</div></div>}
        {topRaw&&<div style={{background:C.sf,borderRadius:10,border:`1px solid ${C.ac}22`,padding:"12px 14px"}}><div style={{...lbl,color:C.ac,marginBottom:5}}>Heaviest set</div><div style={{fontSize:20,fontWeight:700,fontFamily:mono,color:C.ac}}>{topRaw.weight}<span style={{fontSize:10,color:C.mt,fontWeight:400}}> lb</span></div><div style={{fontSize:10,color:C.mt,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{topRaw.exercise}</div></div>}
      </div>)}
      <div style={{display:"flex",gap:4,marginBottom:16,background:C.sf2,borderRadius:10,padding:4}}>
        {[{id:"prs",l:"PRs"},{id:"vol",l:`Vol W${week}`},{id:"bw",l:"Weight"},{id:"bf",l:"Body Fat"},{id:"muscle",l:"Muscle"}].map(v=>(
          <button key={v.id} onClick={()=>setView(v.id)} style={{flex:1,padding:"7px 0",borderRadius:7,border:"none",background:view===v.id?C.sf:"transparent",color:view===v.id?C.tx:C.mt,fontSize:11,fontWeight:view===v.id?600:400,cursor:"pointer",transition:"background 0.15s"}}>{v.l}</button>
        ))}
      </div>
      {view==="vol"&&(
        <div>
          <div style={{...lbl,marginBottom:12}}>Sets vs target — W{week}</div>
          {volD.map(v=>{
            const inR=v.actual>=v.min&&v.actual<=v.max,over=v.actual>v.max;
            const bc=v.actual===0?`${C.mt}44`:inR?C.gn:over?C.am:C.rd;
            return(
              <div key={v.muscle} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:12}}>{v.muscle}</span>
                  <span style={{fontSize:11,fontFamily:mono,color:bc}}>{v.actual}<span style={{color:C.mt}}>/{v.min}–{v.max}</span></span>
                </div>
                <div style={{position:"relative",width:"100%",height:10,background:C.sf,borderRadius:3,overflow:"hidden"}}>
                  <div style={{position:"absolute",left:`${(v.min/maxB)*100}%`,width:`${((v.max-v.min)/maxB)*100}%`,height:"100%",background:`${C.mt}18`,borderRadius:3}}/>
                  <div style={{position:"relative",width:`${(v.actual/maxB)*100}%`,height:"100%",background:`${bc}77`,borderRadius:3}}/>
                </div>
              </div>
            );
          })}
          <div style={{display:"flex",gap:12,marginTop:12,fontSize:10,color:C.mt}}>
            <span><span style={{color:C.gn}}>●</span> In range</span>
            <span><span style={{color:C.rd}}>●</span> Below</span>
            <span><span style={{color:C.am}}>●</span> Above</span>
          </div>
        </div>
      )}
      {view==="bw"&&(bwPoints.length>=2?(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}><div style={lbl}>Bodyweight trend</div><div style={{fontFamily:mono,fontSize:11,color:C.mt}}>{bwPoints[0].y} → <span style={{color:C.ac,fontWeight:600}}>{bwPoints[bwPoints.length-1].y} lb</span></div></div><div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.bd}`,padding:"14px 10px 6px"}}><LineChart points={bwPoints} color={C.ac} height={100}/></div></div>):<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>Not enough data yet</div>)}
      {view==="bf"&&(bfData.length>=2?(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}><div style={lbl}>Body fat trend</div><div style={{fontFamily:mono,fontSize:11,color:C.mt}}>{bfData[0].y}% → <span style={{color:C.am,fontWeight:600}}>{bfData[bfData.length-1].y}%</span></div></div><div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.am}22`,padding:"14px 10px 6px"}}><LineChart points={bfData} color={C.am} height={100}/></div></div>):<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>Not enough data yet — log waist + neck measurements in Body tab</div>)}
      {view==="muscle"&&(muscleKeys.length>0?(<div><div style={{...lbl,marginBottom:10}}>Max weight by muscle — all weeks</div><div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>{muscleKeys.map(m=>(<button key={m} onClick={()=>setSelMuscle(m)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${activeMuscle===m?getMC(m)+"55":C.bd}`,background:activeMuscle===m?getMC(m)+"14":"transparent",color:activeMuscle===m?getMC(m):C.mt,fontSize:11,fontWeight:activeMuscle===m?600:400,cursor:"pointer"}}>{m}</button>))}</div>{activeMuscle&&muscleTrend[activeMuscle]&&(<div style={{background:C.sf,borderRadius:12,border:`1px solid ${getMC(activeMuscle)}22`,padding:"14px 10px 6px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,paddingLeft:4,paddingRight:4}}><div style={{fontSize:13,fontWeight:600,color:getMC(activeMuscle)}}>{activeMuscle}</div><div style={{fontFamily:mono,fontSize:11,color:C.mt}}>{muscleTrend[activeMuscle][0].y} → <span style={{color:getMC(activeMuscle),fontWeight:600}}>{muscleTrend[activeMuscle][muscleTrend[activeMuscle].length-1].y} lb</span></div></div><LineChart points={muscleTrend[activeMuscle]} color={getMC(activeMuscle)} height={100}/></div>)}</div>):<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>No training data yet</div>)}
      {view==="prs"&&(<>{prs.length>0?(<><div style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr",marginBottom:6,paddingBottom:6,borderBottom:`1px solid ${C.bd}`}}>{["Exercise","Best","Reps","E1RM"].map(h=><div key={h} style={hlbl}>{h}</div>)}</div>{prs.map(pr=>(<div key={pr.exercise} style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr",padding:"8px 0",borderBottom:`1px solid ${C.bd}`}}><div style={{fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:6,color:C.tx}}>{pr.exercise}</div><div style={{fontSize:11,fontFamily:mono,color:C.ac}}>{pr.weight}</div><div style={{fontSize:11,fontFamily:mono,color:C.mt}}>{pr.reps}</div><div style={{fontSize:11,fontFamily:mono,color:C.gn}}>{Math.round(pr.est1rm)}</div></div>))}</>):<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>No PRs yet</div>}</>)}
    </div>
  );
}
