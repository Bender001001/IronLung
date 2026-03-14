import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

const cache={get(k){try{const v=localStorage.getItem(`il_${k}`);return v?JSON.parse(v):null;}catch{return null;}},set(k,v){try{localStorage.setItem(`il_${k}`,JSON.stringify(v));}catch{}}};
function getPending(){return cache.get("pending")||[];}
function addPending(op){const q=getPending();q.push({...op,ts:Date.now()});cache.set("pending",q);}
async function flushPending(){const q=getPending();if(!q.length)return 0;let ok=0;const fail=[];for(const op of q){try{if(op.type==="upsert_set"){if(op.dbId)await supabase.from("workout_sets").update({weight_lb:op.weight,reps:op.reps}).eq("id",op.dbId);else await supabase.from("workout_sets").insert({session_id:op.sessionId,exercise_id:op.exerciseId,set_number:op.setNumber,weight_lb:op.weight,reps:op.reps});ok++;}else if(op.type==="insert_meal"){await supabase.from("meal_log").insert({log_date:op.date,food_id:op.foodId,portions:op.portions});ok++;}else if(op.type==="delete_meal"){await supabase.from("meal_log").delete().eq("id",op.id);ok++;}else if(op.type==="update_portions"){await supabase.from("meal_log").update({portions:op.portions}).eq("id",op.id);ok++;}else if(op.type==="insert_measurement"){await supabase.from("measurements").insert(op.data);ok++;}else if(op.type==="create_session"){await supabase.from("workout_sessions").insert(op.data);ok++;}else if(op.type==="insert_food"){await supabase.from("foods").insert(op.data);ok++;}}catch{fail.push(op);}}cache.set("pending",fail);return ok;}

// Design tokens
const C={bg:"#111113",sf:"#19191d",sf2:"#222228",sf3:"#27272e",bd:"#2c2c34",bd2:"#38383f",tx:"#cdcdd0",tx2:"#9898a4",mt:"#6b6b76",ac:"#7c8aff",gn:"#5cb87a",rd:"#d4544e",am:"#c9a84c",bl:"#5b9bd5"};
const mono="'JetBrains Mono',monospace",sans="'DM Sans',sans-serif";

// Shared style primitives
const inp={width:"100%",padding:"10px 8px",background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,color:C.tx,fontSize:15,fontFamily:mono,fontWeight:500,outline:"none",textAlign:"center",boxSizing:"border-box"};
const inpL={...inp,textAlign:"left",paddingLeft:12,fontSize:13};
const sbtn={background:C.sf,border:`1px solid ${C.bd}`,borderRadius:8,color:C.mt,fontSize:14,cursor:"pointer",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0};
const tbtn={background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:6,color:C.mt,fontSize:14,cursor:"pointer",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center"};
const btnP={width:"100%",padding:"12px",background:C.ac,border:"none",borderRadius:10,color:C.bg,fontSize:14,fontWeight:700,cursor:"pointer"};
const btnS={width:"100%",padding:"11px",background:`${C.ac}12`,border:`1px solid ${C.ac}30`,borderRadius:10,color:C.ac,fontSize:13,fontWeight:600,cursor:"pointer"};
const btnGhost={padding:"8px 14px",background:C.sf,border:`1px solid ${C.bd}`,borderRadius:8,color:C.mt,fontSize:12,fontWeight:500,cursor:"pointer"};
const card={background:C.sf,borderRadius:12,border:`1px solid ${C.bd}`,padding:16};
const hlbl={fontSize:9,fontWeight:600,color:C.mt,textTransform:"uppercase",letterSpacing:"0.08em"};

// Data constants (unchanged)
const ROTATION=["Lower A","Upper A","Rest","Lower B","Upper B","Arms & Delts","Rest"];
const WEEK_TYPES=["Learning","Accumulation","Deload","Peak"];
const GOALS=[{name:"Cut",cpl:12},{name:"Maintain",cpl:14},{name:"Lean Bulk",cpl:16},{name:"Bulk",cpl:18}];
const VOL_TARGETS={Quads:{min:10,max:20},Hamstrings:{min:10,max:16},Glutes:{min:6,max:16},Chest:{min:10,max:20},Back:{min:10,max:20},Shoulders:{min:8,max:16},Biceps:{min:6,max:14},Triceps:{min:6,max:14},Calves:{min:6,max:12}};

// Calculations (unchanged)
function navyBF(w,n,h){if(!w||!n||!h||w<=n)return null;return(86.010*Math.log10(w-n)-70.041*Math.log10(h)+36.76).toFixed(1);}

// Icons
const GearIcon=({c,sz=16})=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const Icons={
  train:({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M2 9v6M22 9v6M6.5 12h11M2 12h4.5M17.5 12H22"/></svg>,
  fuel:({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>,
  body:({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="5" r="3"/><path d="M12 8v4M8 22l2-8M16 22l-2-8M7 12h10"/></svg>,
  stats:({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
};

// Timer — timestamp-based, survives backgrounding (logic unchanged)
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
        <button onClick={onDismiss} style={{...btnGhost,fontSize:11,padding:"5px 10px",fontWeight:600,color:done?C.gn:C.mt,borderColor:done?`${C.gn}33`:C.bd,background:done?`${C.gn}12`:C.sf}}>{done?"Continue":"Skip"}</button>
      </div>
    </div>
  );
}

function useOnline(){const[o,setO]=useState(navigator.onLine);useEffect(()=>{const a=()=>setO(true),b=()=>setO(false);window.addEventListener("online",a);window.addEventListener("offline",b);return()=>{window.removeEventListener("online",a);window.removeEventListener("offline",b);};},[]);return o;}

export default function App(){
  const[tab,setTab]=useState("train");const[days,setDays]=useState([]);const[foods,setFoods]=useState([]);
  const[mt,setMt]=useState({protein:174,carbs:484,fat:72,calories:3280});const[meas,setMeas]=useState([]);
  const[selDay,setSelDay]=useState(null);const[week,setWeek]=useState(12);const[loading,setLoading]=useState(true);
  const[restDur,setRestDur]=useState(120);const[weekType,setWeekType]=useState("Accumulation");
  const[pc,setPc]=useState(0);const online=useOnline();
  useEffect(()=>{load();},[]);
  useEffect(()=>{if(online)flushPending().then(n=>{if(n>0){setPc(getPending().length);load();}});},[online]);
  async function load(){setLoading(true);try{
    const{data:d,error:dE}=await supabase.from("training_days").select("*,training_day_exercises(*,exercises(*))").order("day_order");if(dE)throw dE;
    if(d){const f=d.map(x=>({id:x.id,name:x.name,focus:x.focus,exercises:(x.training_day_exercises||[]).sort((a,b)=>a.exercise_order-b.exercise_order).map(t=>({id:t.exercises.id,name:t.exercises.name,sets:t.default_sets,repMin:t.exercises.rep_min,repMax:t.exercises.rep_max,increment:parseFloat(t.exercises.increment_lb)||2.5,category:t.exercises.category,cues:t.exercises.cues,muscle:t.exercises.primary_muscle,video:t.exercises.video_url}))}));setDays(f);cache.set("days",f);}
    const{data:fd}=await supabase.from("foods").select("*").order("name");if(fd){setFoods(fd);cache.set("foods",fd);}
    const{data:tg}=await supabase.from("macro_targets").select("*").eq("is_active",true).limit(1);if(tg?.[0]){const t={protein:tg[0].protein_g_target,carbs:tg[0].carbs_g_target,fat:tg[0].fat_g_target,calories:tg[0].calories_target};setMt(t);cache.set("mt",t);}
    const{data:ms}=await supabase.from("measurements").select("*").order("measure_date");if(ms){setMeas(ms);cache.set("meas",ms);}
  }catch{setDays(cache.get("days")||[]);setFoods(cache.get("foods")||[]);const cm=cache.get("mt");if(cm)setMt(cm);setMeas(cache.get("meas")||[]);}
  setPc(getPending().length);setLoading(false);}

  if(loading)return(<div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:sans}}><div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:C.tx,letterSpacing:"0.05em"}}>IRON<span style={{color:C.ac}}>LOG</span></div><div style={{fontSize:11,color:C.mt,marginTop:8}}>Loading...</div></div></div>);

  const tabs=[{id:"train",label:"Train",Icon:Icons.train},{id:"fuel",label:"Fuel",Icon:Icons.fuel},{id:"body",label:"Body",Icon:Icons.body},{id:"stats",label:"Stats",Icon:Icons.stats}];
  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:sans,maxWidth:480,margin:"0 auto",paddingBottom:80}}>
      {(!online||pc>0)&&<div style={{background:!online?`${C.am}14`:C.sf,borderBottom:`1px solid ${!online?`${C.am}30`:C.bd}`,padding:"7px 16px",display:"flex",alignItems:"center",gap:7}}><div style={{width:6,height:6,borderRadius:"50%",background:!online?C.am:C.gn,flexShrink:0}}/><span style={{fontSize:11,color:!online?C.am:C.gn}}>{!online?"Offline mode":pc>0?`Syncing ${pc} items...`:"Synced"}</span></div>}
      {tab==="train"&&!selDay&&<DaySelect days={days} onSelect={setSelDay} week={week} setWeek={setWeek} restDur={restDur} setRestDur={setRestDur} weekType={weekType} setWeekType={setWeekType} online={online}/>}
      {tab==="train"&&selDay&&<Session day={selDay} onBack={()=>setSelDay(null)} week={week} restDur={restDur} weekType={weekType} isDeload={weekType==="Deload"} online={online} onPC={()=>setPc(getPending().length)}/>}
      {tab==="fuel"&&<Fuel foods={foods} setFoods={setFoods} mt={mt} setMt={setMt} online={online} onPC={()=>setPc(getPending().length)}/>}
      {tab==="body"&&<Body meas={meas} onAdd={m=>setMeas(p=>[...p,m].sort((a,b)=>a.measure_date.localeCompare(b.measure_date)))} online={online} onPC={()=>setPc(getPending().length)}/>}
      {tab==="stats"&&<Stats meas={meas} week={week} online={online}/>}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:C.sf,borderTop:`1px solid ${C.bd}`,display:"flex",zIndex:100,padding:"6px 0 env(safe-area-inset-bottom,4px)"}}>
        {tabs.map(t=>{const active=tab===t.id;const color=active?C.ac:C.mt;return(
          <button key={t.id} onClick={()=>{setTab(t.id);if(t.id!=="train")setSelDay(null);}} style={{flex:1,padding:"8px 0",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,minHeight:48,justifyContent:"center",position:"relative"}}>
            {active&&<div style={{position:"absolute",top:0,left:"20%",right:"20%",height:2,background:C.ac,borderRadius:"0 0 2px 2px"}}/>}
            <t.Icon c={color}/><span style={{fontSize:10,fontWeight:active?700:500,color,letterSpacing:"0.04em"}}>{t.label}</span>
          </button>);})}
      </div>
    </div>
  );
}

function DaySelect({days,onSelect,week,setWeek,restDur,setRestDur,weekType,setWeekType,online}){
  const[showCfg,setShowCfg]=useState(false);const[wc,setWc]=useState(null);const[summary,setSummary]=useState(null);const[showSum,setShowSum]=useState(false);const[dismissedDL,setDismissedDL]=useState(false);
  useEffect(()=>{lc();loadSummary();},[week]);
  async function lc(){if(!online){setWc(null);return;}try{const{data}=await supabase.from("workout_sessions").select("id,workout_sets(reps)").eq("week_number",week);if(!data?.length){setWc(null);return;}const tp=days.reduce((s,d)=>s+d.exercises.reduce((s2,e)=>s2+e.sets,0),0);let dn=0;data.forEach(s=>s.workout_sets.forEach(ws=>{if(ws.reps>0)dn++;}));setWc(tp>0?Math.round((dn/tp)*100):0);}catch{setWc(null);}}
  async function loadSummary(){if(!online)return;try{const{data}=await supabase.from("workout_sessions").select("id,training_day_id,workout_sets(exercise_id,weight_lb,reps,exercises(name,primary_muscle))").eq("week_number",week);if(!data?.length){setSummary(null);return;}
    let totalSets=0,completedSets=0,prCount=0;const muscles={};
    const{data:prevData}=await supabase.from("workout_sessions").select("id,workout_sets(exercise_id,weight_lb,exercises(name))").eq("week_number",week-1);
    const prevBest={};if(prevData)prevData.forEach(s=>s.workout_sets.forEach(ws=>{const n=ws.exercises?.name;if(!n||!ws.weight_lb)return;if(!prevBest[n]||ws.weight_lb>prevBest[n])prevBest[n]=ws.weight_lb;}));
    data.forEach(s=>{s.workout_sets.forEach(ws=>{totalSets++;if(ws.reps>0){completedSets++;if(ws.exercises?.primary_muscle){const m=ws.exercises.primary_muscle;muscles[m]=(muscles[m]||0)+1;}const n=ws.exercises?.name;if(n&&ws.weight_lb&&prevBest[n]&&ws.weight_lb>prevBest[n])prCount++;}});});
    setSummary({totalSets,completedSets,prCount,sessionsLogged:data.length,muscles});}catch{}}
  const isDL=weekType==="Deload";const wcColor=wc===100?C.gn:wc>50?C.ac:wc>0?C.am:C.mt;
  return(
    <div style={{padding:"24px 16px"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontSize:22,fontWeight:800,letterSpacing:"0.01em"}}>IRON<span style={{color:C.ac}}>LOG</span></div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>setShowCfg(!showCfg)} style={{...sbtn,color:showCfg?C.ac:C.mt,borderColor:showCfg?`${C.ac}44`:C.bd}}>
            <GearIcon c={showCfg?C.ac:C.mt} sz={16}/>
          </button>
          <div style={{display:"flex",alignItems:"center",background:C.sf,border:`1px solid ${C.bd}`,borderRadius:8,overflow:"hidden"}}>
            <button onClick={()=>setWeek(w=>Math.max(1,w-1))} style={{background:"none",border:"none",cursor:"pointer",color:C.mt,width:34,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>‹</button>
            <div style={{borderLeft:`1px solid ${C.bd}`,borderRight:`1px solid ${C.bd}`,padding:"0 12px",height:36,display:"flex",alignItems:"center"}}>
              <span style={{fontFamily:mono,fontSize:13,fontWeight:600,color:C.tx}}>W{week}</span>
            </div>
            <button onClick={()=>setWeek(w=>w+1)} style={{background:"none",border:"none",cursor:"pointer",color:C.mt,width:34,height:36,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>›</button>
          </div>
        </div>
      </div>
      {/* Week meta bar */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <span style={{fontSize:11,fontWeight:600,color:isDL?C.am:C.tx2,padding:"3px 9px",background:isDL?`${C.am}12`:C.sf2,borderRadius:6,border:`1px solid ${isDL?C.am+"33":C.bd}`,flexShrink:0}}>{weekType}</span>
        {wc!==null&&(<div style={{display:"flex",alignItems:"center",gap:6,flex:1}}><div style={{flex:1,height:3,background:C.bd,borderRadius:2,overflow:"hidden"}}><div style={{width:`${wc}%`,height:"100%",background:wcColor,borderRadius:2,transition:"width 0.4s"}}/></div><span style={{fontFamily:mono,fontSize:11,fontWeight:600,color:wcColor,minWidth:30,textAlign:"right"}}>{wc}%</span></div>)}
        {summary&&<button onClick={()=>setShowSum(!showSum)} style={{...btnGhost,fontSize:10,padding:"4px 10px",color:showSum?C.ac:C.mt,borderColor:showSum?`${C.ac}40`:C.bd,flexShrink:0}}>{showSum?"Close":"Summary"}</button>}
      </div>
      {/* Deload suggestion — appears on every 4th week if not already set */}
      {week%4===0&&!isDL&&!dismissedDL&&(
        <div style={{background:`${C.am}10`,border:`1px solid ${C.am}33`,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:600,color:C.am}}>Deload week?</div>
            <div style={{fontSize:11,color:C.mt,marginTop:1}}>W{week} is typically a deload in a 16-week block.</div>
          </div>
          <button onClick={()=>{setWeekType("Deload");setDismissedDL(true);}} style={{padding:"6px 12px",background:`${C.am}18`,border:`1px solid ${C.am}44`,borderRadius:8,color:C.am,fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0}}>Switch</button>
          <button onClick={()=>setDismissedDL(true)} style={{background:"none",border:"none",color:C.mt,fontSize:16,cursor:"pointer",padding:"2px",flexShrink:0}}>×</button>
        </div>
      )}
      {/* Summary panel */}
      {showSum&&summary&&(
        <div style={{...card,marginBottom:14}}>
          <div style={{...hlbl,marginBottom:12}}>Week {week} recap</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}>
            {[{l:"Sessions",v:summary.sessionsLogged,c:C.ac},{l:"Done",v:summary.completedSets,c:C.bl},{l:"Total",v:summary.totalSets,c:C.mt},{l:"PRs",v:summary.prCount,c:summary.prCount>0?C.gn:C.mt}].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,fontFamily:mono,color:s.c}}>{s.v}</div><div style={{...hlbl,marginTop:3}}>{s.l}</div></div>
            ))}
          </div>
          {Object.keys(summary.muscles).length>0&&<div><div style={{...hlbl,marginBottom:7}}>Volume by muscle</div><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{Object.entries(summary.muscles).sort((a,b)=>b[1]-a[1]).map(([m,sets])=>{const tgt=VOL_TARGETS[m];const inR=tgt&&sets>=tgt.min&&sets<=tgt.max;return<span key={m} style={{padding:"3px 8px",borderRadius:4,background:C.sf2,border:`1px solid ${inR?`${C.gn}33`:C.bd}`,fontSize:10,fontFamily:mono}}><span style={{color:C.tx}}>{m}</span> <span style={{color:inR?C.gn:C.mt}}>{sets}</span></span>;})}</div></div>}
        </div>
      )}
      {/* Settings panel */}
      {showCfg&&(
        <div style={{...card,marginBottom:14}}>
          <div style={{marginBottom:14}}>
            <div style={{...hlbl,marginBottom:10}}>Week phase</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {WEEK_TYPES.map(t=><button key={t} onClick={()=>setWeekType(t)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${weekType===t?(t==="Deload"?C.am:C.ac):C.bd}`,background:weekType===t?(t==="Deload"?C.am:C.ac)+"15":"transparent",color:weekType===t?(t==="Deload"?C.am:C.ac):C.mt,fontSize:12,fontWeight:weekType===t?600:400,cursor:"pointer"}}>{t}</button>)}
            </div>
            {isDL&&<div style={{fontSize:11,color:C.am,marginTop:8,padding:"6px 10px",background:`${C.am}08`,borderRadius:6}}>Deload: 2 sets at ~60% weight</div>}
          </div>
          <div>
            <div style={{...hlbl,marginBottom:10}}>Rest timer</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[60,90,120,150,180,240].map(t=><button key={t} onClick={()=>setRestDur(t)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${restDur===t?C.ac:C.bd}`,background:restDur===t?`${C.ac}15`:"transparent",color:restDur===t?C.ac:C.mt,fontSize:12,fontFamily:mono,cursor:"pointer"}}>{Math.floor(t/60)}:{String(t%60).padStart(2,"0")}</button>)}
            </div>
          </div>
        </div>
      )}
      {/* Day list */}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {ROTATION.map((dn,i)=>{
          if(dn==="Rest")return<div key={`r${i}`} style={{padding:"9px 16px",background:C.sf2,borderRadius:10,border:`1px solid ${C.bd}`,opacity:0.35,display:"flex",alignItems:"center",gap:14}}><div style={{fontFamily:mono,fontSize:11,color:C.mt,width:20,textAlign:"center"}}>{i+1}</div><span style={{fontSize:11,color:C.mt}}>Rest</span></div>;
          const day=days.find(d=>d.name===dn);if(!day)return null;
          return(
            <button key={dn} onClick={()=>onSelect(day)} style={{padding:"14px 16px",background:C.sf,borderRadius:12,border:`1px solid ${C.bd}`,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:14,width:"100%"}}>
              <div style={{fontFamily:mono,fontSize:12,fontWeight:600,color:C.mt,width:20,textAlign:"center",flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:700,color:C.tx}}>{day.name}</div><div style={{fontSize:11,color:C.mt,marginTop:2}}>{day.focus}</div></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.mt} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Session({day,onBack,week,restDur,weekType,isDeload,online,onPC}){
  const[expEx,setExpEx]=useState(0);const[showCues,setShowCues]=useState(null);const[sd,setSd]=useState({});const[sid,setSid]=useState(null);const[saved,setSaved]=useState(null);const[showTimer,setShowTimer]=useState(false);const[timerKey,setTimerKey]=useState(0);const[lw,setLw]=useState({});const[history,setHistory]=useState(null);
  function eff(ex){return isDeload?Math.min(ex.sets,2):ex.sets;}
  useEffect(()=>{init();loadLast();},[day.id,week]);
  async function loadLast(){const p=week-1;if(p<1)return;try{const{data}=await supabase.from("workout_sessions").select("id,workout_sets(exercise_id,weight_lb,reps)").eq("week_number",p).eq("training_day_id",day.id).limit(1);if(data?.[0]){const byE={};data[0].workout_sets.forEach(w=>{if(!byE[w.exercise_id])byE[w.exercise_id]=[];byE[w.exercise_id].push(w);});const prog={};Object.entries(byE).forEach(([eid,sets])=>{const v=sets.filter(s=>s.reps>0&&s.weight_lb>0);if(!v.length)return;const avg=v.reduce((s,x)=>s+x.reps,0)/v.length;const mw=Math.max(...v.map(s=>s.weight_lb));const ex=day.exercises.find(e=>e.id===parseInt(eid));if(isDeload)prog[eid]={w:mw,r:avg,up:false,sw:Math.round(mw*0.6/2.5)*2.5,deload:true};else{const hit=ex&&avg>=ex.repMax;prog[eid]={w:mw,r:avg,up:hit,sw:hit&&ex?mw+ex.increment:mw};}});setLw(prog);cache.set(`lw_${day.id}_${week}`,prog);}}catch{const c=cache.get(`lw_${day.id}_${week}`);if(c)setLw(c);}}
  async function loadHistory(exerciseId){try{const{data}=await supabase.from("workout_sets").select("weight_lb,reps,workout_sessions(week_number)").eq("exercise_id",exerciseId).order("created_at",{ascending:true});if(data){const byWeek={};data.forEach(s=>{const wk=s.workout_sessions?.week_number;if(!wk)return;if(!byWeek[wk])byWeek[wk]={maxW:0,totalReps:0,sets:0};byWeek[wk].maxW=Math.max(byWeek[wk].maxW,s.weight_lb||0);byWeek[wk].totalReps+=s.reps||0;byWeek[wk].sets++;});const weeks=Object.entries(byWeek).map(([wk,d])=>({week:parseInt(wk),weight:d.maxW,avgReps:d.sets>0?(d.totalReps/d.sets).toFixed(1):0})).sort((a,b)=>a.week-b.week);setHistory({exerciseId,weeks});}}catch{}}
  async function init(){const ck=`session_${day.id}_${week}`;try{const{data}=await supabase.from("workout_sessions").select("id,workout_sets(*)").eq("week_number",week).eq("training_day_id",day.id).limit(1);if(data?.[0]){setSid(data[0].id);const l={};data[0].workout_sets.forEach(w=>{l[`${w.exercise_id}-${w.set_number}`]={weight:w.weight_lb||0,reps:w.reps||0,dbId:w.id};});setSd(l);cache.set(ck,{sid:data[0].id,sets:l});}else{const{data:n}=await supabase.from("workout_sessions").insert({week_number:week,training_day_id:day.id,session_date:new Date().toISOString().split("T")[0],week_type:weekType}).select().single();if(n){setSid(n.id);cache.set(ck,{sid:n.id,sets:{}});}}}catch{const c=cache.get(ck);if(c){setSid(c.sid);setSd(c.sets);}else{const tid=`temp_${Date.now()}`;setSid(tid);addPending({type:"create_session",data:{week_number:week,training_day_id:day.id,session_date:new Date().toISOString().split("T")[0],week_type:weekType}});onPC();}}}
  function gs(eid,sn){return sd[`${eid}-${sn}`]||{weight:0,reps:0};}
  function ul(eid,sn,f,v){const k=`${eid}-${sn}`;setSd(p=>({...p,[k]:{...p[k],weight:p[k]?.weight||0,reps:p[k]?.reps||0,[f]:parseFloat(v)||0}}));}
  async function sv(eid,sn){if(!sid)return;const k=`${eid}-${sn}`,d=sd[k];if(!d||(!d.weight&&!d.reps))return;const ck=`session_${day.id}_${week}`;const cached=cache.get(ck)||{sid,sets:{}};cached.sets[k]={weight:d.weight,reps:d.reps,dbId:d.dbId};cache.set(ck,cached);
    try{if(d.dbId)await supabase.from("workout_sets").update({weight_lb:d.weight,reps:d.reps}).eq("id",d.dbId);else{const{data:ins}=await supabase.from("workout_sets").insert({session_id:sid,exercise_id:eid,set_number:sn,weight_lb:d.weight,reps:d.reps}).select().single();if(ins){setSd(p=>({...p,[k]:{...p[k],dbId:ins.id}}));cached.sets[k].dbId=ins.id;cache.set(ck,cached);}}}
    catch{addPending({type:"upsert_set",dbId:d.dbId,sessionId:sid,exerciseId:eid,setNumber:sn,weight:d.weight,reps:d.reps});onPC();}
    setSaved(new Date().toLocaleTimeString());
    // NO auto-timer — user starts manually
  }
  function fill(eid,n,w){const u={};for(let i=1;i<=n;i++){const k=`${eid}-${i}`;u[k]={...sd[k],weight:w,reps:sd[k]?.reps||0,dbId:sd[k]?.dbId};}setSd(p=>({...p,...u}));}
  function done(eid,n){let c=0;for(let i=1;i<=n;i++)if(sd[`${eid}-${i}`]?.reps>0)c++;return c;}
  const totalS=day.exercises.reduce((s,e)=>s+eff(e),0),doneS=day.exercises.reduce((s,e)=>s+done(e.id,eff(e)),0),comp=totalS>0?Math.round((doneS/totalS)*100):0;
  function startTimer(){setShowTimer(true);setTimerKey(k=>k+1);}
  return(
    <div style={{padding:"20px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
        <button onClick={onBack} style={sbtn}>‹</button>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:18,fontWeight:700}}>{day.name}</div><div style={{fontSize:11,color:C.mt,marginTop:1}}>W{week} · {weekType} · {day.focus}</div></div>
        <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:18,fontWeight:700,fontFamily:mono,color:comp===100?C.gn:comp>0?C.am:C.mt}}>{comp}%</div>{saved&&<div style={{fontSize:8,color:C.gn,fontFamily:mono,marginTop:1}}>{saved}</div>}</div>
      </div>
      <div style={{width:"100%",height:4,background:C.bd,borderRadius:2,marginBottom:14,overflow:"hidden"}}><div style={{width:`${comp}%`,height:"100%",background:comp===100?C.gn:C.ac,borderRadius:2,transition:"width 0.3s"}}/></div>
      {isDeload&&<div style={{padding:"8px 12px",marginBottom:12,background:`${C.am}10`,border:`1px solid ${C.am}22`,borderRadius:8,fontSize:11,color:C.am}}>Deload week — 2 sets at ~60%</div>}
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
                {pg?.up&&!all&&!isDeload&&<span style={{fontSize:9,fontWeight:700,color:C.gn,background:`${C.gn}14`,padding:"2px 6px",borderRadius:4,flexShrink:0}}>↑ PR</span>}
                {pg?.deload&&<span style={{fontSize:9,fontWeight:700,color:C.am,background:`${C.am}14`,padding:"2px 6px",borderRadius:4,flexShrink:0}}>60%</span>}
                <span style={{color:C.mt,transform:isE?"rotate(90deg)":"none",transition:"transform 0.2s",fontSize:18,flexShrink:0,lineHeight:1}}>›</span>
              </button>
              {isE&&(
                <div style={{padding:"0 14px 14px"}}>
                  <div style={{display:"flex",gap:6,marginBottom:10}}>
                    <button onClick={()=>setShowCues(showCues===xi?null:xi)} style={{flex:1,padding:"8px 10px",background:C.sf2,border:`1px solid ${showCues===xi?`${C.ac}44`:C.bd}`,borderRadius:8,color:showCues===xi?C.tx:C.mt,fontSize:11,cursor:"pointer",textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{showCues===xi?ex.cues:"View cues"}</button>
                    {ex.video&&<a href={ex.video} target="_blank" rel="noopener noreferrer" style={{padding:"8px 12px",background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,color:C.ac,fontSize:11,textDecoration:"none",flexShrink:0}}>Watch</a>}
                    <button onClick={()=>history?.exerciseId===ex.id?setHistory(null):loadHistory(ex.id)} style={{padding:"8px 12px",background:C.sf2,border:`1px solid ${history?.exerciseId===ex.id?`${C.ac}44`:C.bd}`,borderRadius:8,color:history?.exerciseId===ex.id?C.ac:C.mt,fontSize:11,cursor:"pointer",flexShrink:0}}>History</button>
                  </div>
                  {history?.exerciseId===ex.id&&history.weeks.length>0&&(
                    <div style={{background:C.sf2,borderRadius:10,padding:10,marginBottom:10}}>
                      <div style={{...hlbl,marginBottom:8}}>Weight progression</div>
                      <div style={{display:"flex",alignItems:"flex-end",gap:3,height:50}}>
                        {history.weeks.slice(-12).map(w=>{const mn=Math.min(...history.weeks.map(x=>x.weight)),mx=Math.max(...history.weeks.map(x=>x.weight)),rn=mx-mn||1,h=((w.weight-mn)/rn)*40+8;return(<div key={w.week} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><span style={{fontSize:7,fontFamily:mono,color:C.tx}}>{w.weight}</span><div style={{width:"100%",height:h,background:w.week===week?C.ac:`${C.ac}44`,borderRadius:2,maxWidth:24}}/><span style={{fontSize:6,color:C.mt}}>W{w.week}</span></div>);})}
                      </div>
                    </div>
                  )}
                  {pg&&(
                    <div style={{padding:"10px 12px",marginBottom:10,background:pg.deload?`${C.am}08`:pg.up?`${C.gn}08`:C.sf2,border:`1px solid ${pg.deload?`${C.am}22`:pg.up?`${C.gn}22`:C.bd}`,borderRadius:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div><div style={{...hlbl,marginBottom:4}}>Today's weight</div><div style={{fontSize:22,fontWeight:700,fontFamily:mono,color:pg.deload?C.am:pg.up?C.gn:C.tx}}>{todayWeight}lb</div></div>
                        <div style={{textAlign:"right"}}><div style={{fontSize:11,color:C.mt}}>{pg.deload?"Deload 60%":pg.up?`+${ex.increment}lb`:"Hold"}</div><div style={{fontSize:10,color:C.mt,fontFamily:mono,marginTop:2}}>Last: {pg.w}lb · {pg.r.toFixed(1)} avg</div></div>
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
                  {xi<day.exercises.length-1&&<button onClick={()=>{setExpEx(xi+1);setShowTimer(false);setHistory(null);}} style={{...btnS,marginTop:6}}>Next exercise</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Fuel({foods,setFoods,mt,setMt,online,onPC}){
  const[log,setLog]=useState([]);const[search,setSearch]=useState("");const[showS,setShowS]=useState(false);const[cat,setCat]=useState("All");const[showCalc,setShowCalc]=useState(false);const[showAdd,setShowAdd]=useState(false);const[showRecent,setShowRecent]=useState(false);const[calcW,setCalcW]=useState("205");const[calcG,setCalcG]=useState("Lean Bulk");const[calcP,setCalcP]=useState("0.85");const[calcF,setCalcF]=useState("0.35");const[nf,setNf]=useState({name:"",portion_size:"",portion_unit:"",protein_g:"",carbs_g:"",fat_g:"",calories:"",category:"Protein"});const[recentFoods,setRecentFoods]=useState([]);const[td]=useState(new Date().toISOString().split("T")[0]);
  useEffect(()=>{loadLog();loadRecent();},[]);
  async function loadLog(){try{const{data}=await supabase.from("meal_log").select("*,foods(*)").eq("log_date",td).order("created_at");if(data){const l=data.map(m=>({id:m.id,food:m.foods?.name||"?",portions:parseFloat(m.portions),protein:m.foods?.protein_g||0,carbs:m.foods?.carbs_g||0,fat:m.foods?.fat_g||0,calories:m.foods?.calories||0,foodId:m.food_id}));setLog(l);cache.set(`meals_${td}`,l);}}catch{const c=cache.get(`meals_${td}`);if(c)setLog(c);}}
  async function loadRecent(){try{const yesterday=new Date(Date.now()-86400000).toISOString().split("T")[0];const{data}=await supabase.from("meal_log").select("food_id,portions,foods(*)").gte("log_date",yesterday).order("created_at",{ascending:false}).limit(20);if(data){const seen=new Set();const unique=[];data.forEach(m=>{if(m.foods&&!seen.has(m.food_id)){seen.add(m.food_id);unique.push({...m.foods,lastPortions:parseFloat(m.portions)});}});setRecentFoods(unique);cache.set("recent_foods",unique);}}catch{const c=cache.get("recent_foods");if(c)setRecentFoods(c);}}
  async function add(f,portions=1){const entry={id:`t_${Date.now()}`,food:f.name,portions,protein:f.protein_g,carbs:f.carbs_g,fat:f.fat_g,calories:f.calories,foodId:f.id};setLog(p=>{const n=[...p,entry];cache.set(`meals_${td}`,n);return n;});try{const{data:ins}=await supabase.from("meal_log").insert({log_date:td,food_id:f.id,portions}).select().single();if(ins)setLog(p=>p.map(m=>m.id===entry.id?{...m,id:ins.id}:m));}catch{addPending({type:"insert_meal",date:td,foodId:f.id,portions});onPC();}setShowS(false);setShowRecent(false);setSearch("");}
  async function rm(i){const e=log[i];setLog(p=>{const n=p.filter((_,x)=>x!==i);cache.set(`meals_${td}`,n);return n;});if(e?.id&&!String(e.id).startsWith("t")){try{await supabase.from("meal_log").delete().eq("id",e.id);}catch{addPending({type:"delete_meal",id:e.id});onPC();}}}
  async function up(i,pt){const np=Math.max(0.25,pt);setLog(p=>{const n=p.map((m,x)=>x===i?{...m,portions:np}:m);cache.set(`meals_${td}`,n);return n;});const e=log[i];if(e?.id&&!String(e.id).startsWith("t")){try{await supabase.from("meal_log").update({portions:np}).eq("id",e.id);}catch{addPending({type:"update_portions",id:e.id,portions:np});onPC();}}}
  async function saveNewFood(){if(!nf.name||!nf.calories)return;const entry={name:nf.name,portion_size:parseFloat(nf.portion_size)||1,portion_unit:nf.portion_unit||"serving",protein_g:parseFloat(nf.protein_g)||0,carbs_g:parseFloat(nf.carbs_g)||0,fat_g:parseFloat(nf.fat_g)||0,calories:parseFloat(nf.calories)||0,category:nf.category};try{const{data}=await supabase.from("foods").insert(entry).select().single();if(data)setFoods(p=>[...p,data].sort((a,b)=>a.name.localeCompare(b.name)));}catch{addPending({type:"insert_food",data:entry});onPC();setFoods(p=>[...p,{...entry,id:`t_${Date.now()}`}].sort((a,b)=>a.name.localeCompare(b.name)));}setNf({name:"",portion_size:"",portion_unit:"",protein_g:"",carbs_g:"",fat_g:"",calories:"",category:"Protein"});setShowAdd(false);}
  const tot=log.reduce((a,m)=>({protein:a.protein+(m.protein||0)*m.portions,carbs:a.carbs+(m.carbs||0)*m.portions,fat:a.fat+(m.fat||0)*m.portions,calories:a.calories+(m.calories||0)*m.portions}),{protein:0,carbs:0,fat:0,calories:0});
  const flt=foods.filter(f=>f.name.toLowerCase().includes(search.toLowerCase())&&(cat==="All"||f.category===cat));
  function recalc(){const w=parseFloat(calcW)||205,goal=GOALS.find(g=>g.name===calcG)||GOALS[2],pr=parseFloat(calcP)||0.85,ft=parseFloat(calcF)||0.35;const cal=Math.round(w*goal.cpl),protein=Math.round(w*pr),fat=Math.round(w*ft),carbs=Math.round((cal-protein*4-fat*9)/4);setMt({protein,carbs,fat,calories:cal});cache.set("mt",{protein,carbs,fat,calories:cal});try{supabase.from("macro_targets").update({protein_g_target:protein,carbs_g_target:carbs,fat_g_target:fat,calories_target:cal,bodyweight_lb:w,goal_name:calcG}).eq("is_active",true);}catch{}setShowCalc(false);}
  return(
    <div style={{padding:"24px 16px"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
        <div><div style={{fontSize:20,fontWeight:700}}>Fuel</div><div style={{fontSize:11,color:C.mt,marginTop:1}}>{mt.calories} cal target</div></div>
        <button onClick={()=>setShowCalc(!showCalc)} style={{...btnGhost,color:showCalc?C.ac:C.mt,borderColor:showCalc?`${C.ac}44`:C.bd,marginTop:2}}>Calculator</button>
      </div>
      {showCalc&&(
        <div style={{...card,marginBottom:14}}>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>{GOALS.map(g=><button key={g.name} onClick={()=>setCalcG(g.name)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${calcG===g.name?C.ac:C.bd}`,background:calcG===g.name?`${C.ac}15`:"transparent",color:calcG===g.name?C.ac:C.mt,fontSize:12,fontWeight:calcG===g.name?600:400,cursor:"pointer"}}>{g.name}</button>)}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
            <div><div style={{...hlbl,marginBottom:4}}>Weight</div><input type="number" value={calcW} onChange={e=>setCalcW(e.target.value)} style={inp}/></div>
            <div><div style={{...hlbl,marginBottom:4}}>Pro/lb</div><input type="number" value={calcP} onChange={e=>setCalcP(e.target.value)} style={inp}/></div>
            <div><div style={{...hlbl,marginBottom:4}}>Fat/lb</div><input type="number" value={calcF} onChange={e=>setCalcF(e.target.value)} style={inp}/></div>
          </div>
          <button onClick={recalc} style={btnP}>Update Targets</button>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>
        {[{l:"Pro",v:Math.round(tot.protein),t:mt.protein,u:"g",c:C.gn},{l:"Carb",v:Math.round(tot.carbs),t:mt.carbs,u:"g",c:C.bl},{l:"Fat",v:Math.round(tot.fat),t:mt.fat,u:"g",c:C.am},{l:"Cal",v:Math.round(tot.calories),t:mt.calories,u:"",c:C.ac}].map(m=>{
          const p=Math.round((m.v/m.t)*100);
          return(
            <div key={m.l} style={{background:C.sf,borderRadius:10,padding:"12px 6px",textAlign:"center",border:`1px solid ${C.bd}`}}>
              <div style={{fontSize:20,fontWeight:700,fontFamily:mono,color:p>100?C.rd:m.c,lineHeight:1}}>{m.v}</div>
              <div style={{fontSize:9,color:C.mt,marginTop:3}}>/{m.t}{m.u}</div>
              <div style={{width:"100%",height:4,background:C.bd,borderRadius:2,marginTop:6,overflow:"hidden"}}><div style={{width:`${Math.min(p,100)}%`,height:"100%",background:m.c,borderRadius:2}}/></div>
              <div style={{...hlbl,marginTop:5}}>{m.l}</div>
            </div>
          );
        })}
      </div>
      {recentFoods.length>0&&!showS&&!showAdd&&(
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <span style={hlbl}>Recent</span>
            <button onClick={()=>setShowRecent(!showRecent)} style={{background:"none",border:"none",color:C.ac,fontSize:10,cursor:"pointer"}}>{showRecent?"Less":"More"}</button>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{(showRecent?recentFoods:recentFoods.slice(0,6)).map(f=><button key={f.id} onClick={()=>add(f,f.lastPortions||1)} style={{padding:"7px 10px",background:C.sf,border:`1px solid ${C.bd}`,borderRadius:8,color:C.tx,fontSize:11,cursor:"pointer",display:"flex",gap:5,alignItems:"center"}}><span style={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name.length>18?f.name.slice(0,18)+"…":f.name}</span><span style={{fontFamily:mono,fontSize:10,color:C.gn,flexShrink:0}}>{f.protein_g}p</span></button>)}</div>
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={()=>{setShowS(!showS);setShowAdd(false);}} style={{...btnS,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={showS?C.mt:C.ac} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          {showS?"Close search":"Search foods"}
        </button>
        <button onClick={()=>{setShowAdd(!showAdd);setShowS(false);}} style={{...btnGhost,padding:"11px 14px",flexShrink:0,borderColor:showAdd?`${C.ac}44`:C.bd,color:showAdd?C.ac:C.mt}}>+ New</button>
      </div>
      {showAdd&&(
        <div style={{...card,marginBottom:12}}>
          <div style={{...hlbl,marginBottom:10}}>Custom food</div>
          <input type="text" value={nf.name} onChange={e=>setNf(p=>({...p,name:e.target.value}))} placeholder="Food name" style={{...inpL,marginBottom:8}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><input type="number" inputMode="decimal" value={nf.portion_size} onChange={e=>setNf(p=>({...p,portion_size:e.target.value}))} placeholder="Portion" style={inp}/><input type="text" value={nf.portion_unit} onChange={e=>setNf(p=>({...p,portion_unit:e.target.value}))} placeholder="Unit" style={inpL}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:10}}>{[{k:"protein_g",l:"Pro"},{k:"carbs_g",l:"Carb"},{k:"fat_g",l:"Fat"},{k:"calories",l:"Cal"}].map(f=><div key={f.k}><div style={{...hlbl,marginBottom:3}}>{f.l}</div><input type="number" value={nf[f.k]} onChange={e=>setNf(p=>({...p,[f.k]:e.target.value}))} style={inp}/></div>)}</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>{["Protein","Carb","Fat","Snack","Meal","Misc"].map(c=><button key={c} onClick={()=>setNf(p=>({...p,category:c}))} style={{padding:"4px 10px",borderRadius:12,border:`1px solid ${nf.category===c?C.ac:C.bd}`,background:nf.category===c?`${C.ac}12`:"transparent",color:nf.category===c?C.ac:C.mt,fontSize:10,cursor:"pointer"}}>{c}</button>)}</div>
          <button onClick={saveNewFood} style={btnP}>Save Food</button>
        </div>
      )}
      {showS&&(
        <div style={{...card,marginBottom:12}}>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search foods..." style={{...inpL,marginBottom:8}} autoFocus/>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>{["All","Protein","Carb","Fat","RTD Protein","Snack","Meal","Misc"].map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:"4px 10px",borderRadius:12,border:`1px solid ${cat===c?C.ac:C.bd}`,background:cat===c?`${C.ac}12`:"transparent",color:cat===c?C.ac:C.mt,fontSize:10,cursor:"pointer"}}>{c}</button>)}</div>
          <div style={{maxHeight:280,overflowY:"auto"}}>{flt.length===0?<div style={{padding:"20px 0",textAlign:"center",color:C.mt,fontSize:12}}>No foods found</div>:flt.map(f=><button key={f.id} onClick={()=>add(f)} style={{width:"100%",padding:"10px 4px",background:"none",border:"none",borderBottom:`1px solid ${C.bd}`,color:C.tx,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{f.name}</div><div style={{fontSize:10,color:C.mt,marginTop:1}}>{f.portion_size} {f.portion_unit}</div></div><div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:12,fontFamily:mono,color:C.gn,fontWeight:600}}>{f.protein_g}p</div><div style={{fontSize:9,color:C.mt,fontFamily:mono}}>{f.calories}cal</div></div></button>)}</div>
        </div>
      )}
      {log.length>0&&(<div><div style={{...hlbl,marginBottom:8}}>Today</div>{log.map((m,i)=><div key={m.id||i} style={{background:C.sf,borderRadius:10,border:`1px solid ${C.bd}`,padding:"10px 12px",marginBottom:5,display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.food}</div><div style={{fontSize:10,color:C.mt,fontFamily:mono,marginTop:1}}>{Math.round(m.protein*m.portions)}p · {Math.round(m.carbs*m.portions)}c · {Math.round(m.fat*m.portions)}f · {Math.round(m.calories*m.portions)}cal</div></div><div style={{display:"flex",alignItems:"center",gap:3}}><button onClick={()=>up(i,m.portions-0.5)} style={tbtn}>-</button><span style={{fontSize:12,fontFamily:mono,width:24,textAlign:"center"}}>{m.portions}</span><button onClick={()=>up(i,m.portions+0.5)} style={tbtn}>+</button></div><button onClick={()=>rm(i)} style={{background:"none",border:"none",color:C.rd,fontSize:16,cursor:"pointer",padding:"2px",flexShrink:0}}>×</button></div>)}</div>)}
      {log.length===0&&!showS&&!showAdd&&<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>No meals logged today</div>}
    </div>
  );
}

function Body({meas,onAdd,online,onPC}){
  const[showF,setShowF]=useState(false);
  const fields=[{k:"measure_date",l:"Date",t:"date"},{k:"bodyweight_lb",l:"Weight (lb)",t:"number"},{k:"chest_in",l:"Chest",t:"number"},{k:"waist_in",l:"Waist *",t:"number"},{k:"hips_in",l:"Hips",t:"number"},{k:"r_arm_in",l:"R Arm",t:"number"},{k:"l_arm_in",l:"L Arm",t:"number"},{k:"r_forearm_in",l:"R Forearm",t:"number"},{k:"l_forearm_in",l:"L Forearm",t:"number"},{k:"shoulder_circ_in",l:"Shoulders",t:"number"},{k:"thigh_in",l:"Thigh",t:"number"},{k:"calf_in",l:"Calf",t:"number"},{k:"neck_in",l:"Neck *",t:"number"}];
  const init={};fields.forEach(f=>init[f.k]=f.k==="measure_date"?new Date().toISOString().split("T")[0]:"");
  const[fm,setFm]=useState(init);
  // Save logic unchanged
  async function save(){if(!fm.bodyweight_lb)return;const e={};Object.entries(fm).forEach(([k,v])=>{e[k]=k==="measure_date"?v:(parseFloat(v)||null);});const lat=meas[meas.length-1];const h=lat?.height_in||70;if(e.waist_in&&e.neck_in)e.body_fat_pct=parseFloat(navyBF(e.waist_in,e.neck_in,h));e.height_in=h;try{const{data}=await supabase.from("measurements").insert(e).select().single();if(data){onAdd(data);setShowF(false);}}catch{onAdd({...e,id:`t_${Date.now()}`});addPending({type:"insert_measurement",data:e});onPC();setShowF(false);}}
  const lat=meas[meas.length-1];const prev=meas.length>1?meas[meas.length-2]:null;
  function delta(c,p){if(!c||!p)return null;const d=(c-p).toFixed(1);return parseFloat(d)>0?`+${d}`:d;}
  const latBF=lat?.body_fat_pct||(lat?.waist_in&&lat?.neck_in&&lat?.height_in?navyBF(lat.waist_in,lat.neck_in,lat.height_in):null);
  const wtDelta=delta(lat?.bodyweight_lb,prev?.bodyweight_lb);
  const bfDelta=lat&&prev?(()=>{const lbf=lat.body_fat_pct||(lat.waist_in&&lat.neck_in&&lat.height_in?navyBF(lat.waist_in,lat.neck_in,lat.height_in):null);const pbf=prev.body_fat_pct||(prev.waist_in&&prev.neck_in&&prev.height_in?navyBF(prev.waist_in,prev.neck_in,prev.height_in):null);return delta(parseFloat(lbf),parseFloat(pbf));})():null;

  return(
    <div style={{padding:"24px 16px"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Body</div>

      {lat&&(
        <div>
          {/* Hero: weight + BF% */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.bd}`,padding:"16px 14px"}}>
              <div style={{...hlbl,marginBottom:6}}>Bodyweight</div>
              <div style={{fontSize:28,fontWeight:800,fontFamily:mono,lineHeight:1}}>{lat.bodyweight_lb??<span style={{color:C.mt}}>—</span>}</div>
              <div style={{fontSize:11,color:C.mt,marginTop:4}}>lb{wtDelta&&<span style={{color:parseFloat(wtDelta)>0?C.am:C.gn,marginLeft:5}}>{wtDelta}</span>}</div>
            </div>
            <div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.ac}22`,padding:"16px 14px"}}>
              <div style={{...hlbl,marginBottom:6}}>Body fat</div>
              <div style={{fontSize:28,fontWeight:800,fontFamily:mono,color:C.ac,lineHeight:1}}>{latBF??<span style={{color:C.mt,fontSize:20}}>—</span>}</div>
              <div style={{fontSize:11,color:C.mt,marginTop:4}}>%{bfDelta&&<span style={{color:parseFloat(bfDelta)>0?C.rd:C.gn,marginLeft:5}}>{bfDelta}</span>}</div>
            </div>
          </div>
          {/* Date badge */}
          <div style={{fontSize:10,color:C.mt,marginBottom:12,padding:"4px 0",textAlign:"right"}}>{lat.measure_date}</div>
          {/* Measurements grid */}
          <div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.bd}`,padding:14,marginBottom:12}}>
            <div style={{...hlbl,marginBottom:12}}>Measurements</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              {[{l:"Chest",v:lat.chest_in,p:prev?.chest_in},{l:"Waist",v:lat.waist_in,p:prev?.waist_in},{l:"Hips",v:lat.hips_in,p:prev?.hips_in},{l:"R Arm",v:lat.r_arm_in,p:prev?.r_arm_in},{l:"L Arm",v:lat.l_arm_in,p:prev?.l_arm_in},{l:"Shoulders",v:lat.shoulder_circ_in,p:prev?.shoulder_circ_in},{l:"R Forearm",v:lat.r_forearm_in,p:prev?.r_forearm_in},{l:"L Forearm",v:lat.l_forearm_in,p:prev?.l_forearm_in},{l:"Thigh",v:lat.thigh_in,p:prev?.thigh_in},{l:"Calf",v:lat.calf_in,p:prev?.calf_in},{l:"Neck",v:lat.neck_in,p:prev?.neck_in}].map(s=>{
                const d=delta(s.v,s.p);
                return(
                  <div key={s.l}>
                    <div style={{fontSize:8,color:C.mt,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.l}</div>
                    <div style={{fontSize:16,fontWeight:700,fontFamily:mono,marginTop:2}}>{s.v??<span style={{color:C.mt,fontSize:12}}>—</span>}</div>
                    {s.v&&<div style={{fontSize:9,color:C.mt}}>"{ }{ }{d&&<span style={{color:parseFloat(d)>0?C.gn:C.rd,marginLeft:2}}>{d}</span>}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* New measurement CTA */}
      <button onClick={()=>setShowF(!showF)} style={{...btnS,marginBottom:12}}>{showF?"Cancel":"+ New measurement"}</button>

      {showF&&(
        <div style={{...card,marginBottom:12}}>
          <div style={{fontSize:10,color:C.mt,marginBottom:10}}>BF% auto-calculates from waist + neck</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {fields.map(f=>(
              <div key={f.k}>
                <label style={{fontSize:8,color:f.k==="waist_in"||f.k==="neck_in"?C.ac:C.mt,textTransform:"uppercase",letterSpacing:"0.06em"}}>{f.l}</label>
                <input type={f.t} inputMode={f.t==="number"?"decimal":undefined} value={fm[f.k]} onChange={e=>setFm(p=>({...p,[f.k]:e.target.value}))} style={{...inp,marginTop:3,fontSize:13}}/>
              </div>
            ))}
          </div>
          {fm.waist_in&&fm.neck_in&&<div style={{marginTop:10,padding:"6px 10px",background:`${C.ac}08`,borderRadius:6,fontSize:12,color:C.ac,textAlign:"center"}}>Est. BF: {navyBF(parseFloat(fm.waist_in),parseFloat(fm.neck_in),meas[meas.length-1]?.height_in||70)||"—"}%</div>}
          <button onClick={save} style={{...btnP,marginTop:12}}>Save</button>
        </div>
      )}

      {/* History list */}
      <div style={{...hlbl,marginBottom:8}}>History</div>
      {[...meas].reverse().map(m=>{
        const bf=m.body_fat_pct||(m.waist_in&&m.neck_in&&m.height_in?navyBF(m.waist_in,m.neck_in,m.height_in):null);
        return(
          <div key={m.id} style={{background:C.sf,borderRadius:10,border:`1px solid ${C.bd}`,padding:"10px 14px",marginBottom:5,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:10,color:C.mt}}>{m.measure_date}</div>
              <div style={{fontSize:16,fontWeight:700,fontFamily:mono}}>{m.bodyweight_lb} lb</div>
            </div>
            <div style={{fontSize:10,color:C.mt,fontFamily:mono,textAlign:"right"}}>
              {bf&&<div style={{color:C.ac,marginBottom:2}}>BF {bf}%</div>}
              <div>{m.chest_in?`Ch ${m.chest_in}″`:""}{m.r_arm_in?` · A ${m.r_arm_in}″`:""}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// SVG line chart — reused for bodyweight and muscle trend
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
      {/* Glow */}
      <polyline points={ptStr} fill="none" stroke={`${color}25`} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Line */}
      <polyline points={ptStr} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Dots */}
      {points.map((p,i)=><circle key={i} cx={px(p.x)} cy={py(p.y)} r="3" fill={color} stroke={C.bg} strokeWidth="1.5"/>)}
      {/* Latest label */}
      <text x={px(last.x)} y={py(last.y)-8} textAnchor="middle" fontSize="9" fill={color} fontFamily="JetBrains Mono,monospace" fontWeight="600">{last.y}</text>
      {/* X labels: first and last week */}
      <text x={px(points[0].x)} y={height-2} textAnchor="middle" fontSize="8" fill={C.mt} fontFamily="JetBrains Mono,monospace">W{points[0].x}</text>
      <text x={px(last.x)} y={height-2} textAnchor="middle" fontSize="8" fill={C.mt} fontFamily="JetBrains Mono,monospace">W{last.x}</text>
    </svg>
  );
}

function Stats({meas,week,online}){
  const[prs,setPrs]=useState([]);const[vol,setVol]=useState({});const[muscleTrend,setMuscleTrend]=useState({});const[view,setView]=useState("prs");const[selMuscle,setSelMuscle]=useState(null);
  useEffect(()=>{loadPRs();loadVol();loadMuscleTrend();},[week]);

  // All data queries — unchanged logic, new muscle trend added
  async function loadPRs(){try{const{data}=await supabase.from("workout_sets").select("exercise_id,weight_lb,reps,exercises(name)").order("weight_lb",{ascending:false});if(data){const best={};data.forEach(s=>{const n=s.exercises?.name;if(!n||!s.weight_lb||!s.reps)return;const e1=s.weight_lb*(1+s.reps/30);if(!best[n]||e1>best[n].est1rm)best[n]={exercise:n,weight:s.weight_lb,reps:s.reps,est1rm:e1};});const p=Object.values(best).sort((a,b)=>b.est1rm-a.est1rm);setPrs(p);cache.set("prs",p);}}catch{const c=cache.get("prs");if(c)setPrs(c);}}
  async function loadVol(){try{const{data}=await supabase.from("workout_sessions").select("id,workout_sets(exercise_id,reps,exercises(primary_muscle))").eq("week_number",week);if(data){const m={};data.forEach(s=>s.workout_sets.forEach(ws=>{if(ws.reps>0&&ws.exercises?.primary_muscle){const mu=ws.exercises.primary_muscle;m[mu]=(m[mu]||0)+1;}}));setVol(m);}}catch{}}
  async function loadMuscleTrend(){try{const{data}=await supabase.from("workout_sets").select("weight_lb,exercises(primary_muscle),workout_sessions(week_number)").gt("weight_lb",0);if(data){const byMuscle={};data.forEach(s=>{const muscle=s.exercises?.primary_muscle;const wk=s.workout_sessions?.week_number;if(!muscle||!wk||!s.weight_lb)return;if(!byMuscle[muscle])byMuscle[muscle]={};if(!byMuscle[muscle][wk]||s.weight_lb>byMuscle[muscle][wk])byMuscle[muscle][wk]=s.weight_lb;});const result={};Object.entries(byMuscle).forEach(([muscle,weeks])=>{const pts=Object.entries(weeks).map(([wk,w])=>({x:parseInt(wk),y:w})).sort((a,b)=>a.x-b.x);if(pts.length>=2)result[muscle]=pts;});setMuscleTrend(result);cache.set("muscleTrend",result);}}catch{const c=cache.get("muscleTrend");if(c)setMuscleTrend(c);}}

  const wd=meas.filter(m=>m.bodyweight_lb);
  const bwPoints=wd.map((m,i)=>({x:i+1,y:m.bodyweight_lb,label:m.measure_date?.slice(5)}));
  const allM=[...new Set([...Object.keys(VOL_TARGETS),...Object.keys(vol)])];
  const volD=allM.map(m=>({muscle:m,actual:vol[m]||0,min:VOL_TARGETS[m]?.min||0,max:VOL_TARGETS[m]?.max||20})).sort((a,b)=>b.actual-a.actual);
  const maxB=Math.max(...volD.map(v=>Math.max(v.actual,v.max)),1);
  const topPR=prs[0];
  const topRaw=prs.length?[...prs].sort((a,b)=>b.weight-a.weight)[0]:null;
  const muscleKeys=Object.keys(muscleTrend).sort();
  const activeMuscle=selMuscle&&muscleTrend[selMuscle]?selMuscle:muscleKeys[0]||null;

  // Muscle colors for variety
  const muscleColors={Chest:C.ac,Back:C.bl,Quads:C.gn,Hamstrings:"#5bc4a8",Glutes:"#a07aff",Shoulders:C.am,Biceps:"#ff7aaa",Triceps:"#ff9f5b",Calves:C.mt,Glutes:C.rd};
  const getMC=m=>muscleColors[m]||C.ac;

  return(
    <div style={{padding:"24px 16px"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:14}}>Stats</div>

      {/* Highlights strip */}
      {prs.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          {topPR&&<div style={{background:C.sf,borderRadius:10,border:`1px solid ${C.gn}22`,padding:"12px 14px"}}>
            <div style={{...hlbl,color:C.gn,marginBottom:5}}>Top E1RM</div>
            <div style={{fontSize:18,fontWeight:700,fontFamily:mono,color:C.gn}}>{Math.round(topPR.est1rm)}<span style={{fontSize:10,color:C.mt,fontWeight:400}}> lb</span></div>
            <div style={{fontSize:10,color:C.mt,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{topPR.exercise}</div>
          </div>}
          {topRaw&&<div style={{background:C.sf,borderRadius:10,border:`1px solid ${C.ac}22`,padding:"12px 14px"}}>
            <div style={{...hlbl,color:C.ac,marginBottom:5}}>Heaviest set</div>
            <div style={{fontSize:18,fontWeight:700,fontFamily:mono,color:C.ac}}>{topRaw.weight}<span style={{fontSize:10,color:C.mt,fontWeight:400}}> lb</span></div>
            <div style={{fontSize:10,color:C.mt,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{topRaw.exercise}</div>
          </div>}
        </div>
      )}

      {/* Tab pills */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:C.sf2,borderRadius:10,padding:4}}>
        {[{id:"prs",l:"PRs"},{id:"vol",l:`Vol W${week}`},{id:"bw",l:"Weight"},{id:"muscle",l:"Muscle"}].map(v=>(
          <button key={v.id} onClick={()=>setView(v.id)} style={{flex:1,padding:"7px 0",borderRadius:7,border:"none",background:view===v.id?C.sf:"transparent",color:view===v.id?C.tx:C.mt,fontSize:11,fontWeight:view===v.id?600:400,cursor:"pointer",transition:"background 0.15s"}}>
            {v.l}
          </button>
        ))}
      </div>

      {/* Volume view */}
      {view==="vol"&&(
        <div>
          <div style={{...hlbl,marginBottom:12}}>Sets vs target — W{week}</div>
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

      {/* Bodyweight line chart */}
      {view==="bw"&&(
        bwPoints.length>=2?(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
              <div style={{...hlbl}}>Bodyweight trend</div>
              <div style={{fontFamily:mono,fontSize:11,color:C.mt}}>{bwPoints[0].y} → <span style={{color:C.ac,fontWeight:600}}>{bwPoints[bwPoints.length-1].y} lb</span></div>
            </div>
            <div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.bd}`,padding:"14px 10px 6px"}}>
              <LineChart points={bwPoints} color={C.ac} height={100}/>
            </div>
          </div>
        ):<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>Not enough data yet</div>
      )}

      {/* Muscle strength trend */}
      {view==="muscle"&&(
        muscleKeys.length>0?(
          <div>
            <div style={{...hlbl,marginBottom:10}}>Max weight by muscle — all weeks</div>
            {/* Muscle selector pills */}
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
              {muscleKeys.map(m=>(
                <button key={m} onClick={()=>setSelMuscle(m)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${activeMuscle===m?getMC(m)+"55":C.bd}`,background:activeMuscle===m?getMC(m)+"14":"transparent",color:activeMuscle===m?getMC(m):C.mt,fontSize:11,fontWeight:activeMuscle===m?600:400,cursor:"pointer"}}>
                  {m}
                </button>
              ))}
            </div>
            {/* Chart for selected muscle */}
            {activeMuscle&&muscleTrend[activeMuscle]&&(
              <div style={{background:C.sf,borderRadius:12,border:`1px solid ${getMC(activeMuscle)}22`,padding:"14px 10px 6px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,paddingLeft:4,paddingRight:4}}>
                  <div style={{fontSize:13,fontWeight:600,color:getMC(activeMuscle)}}>{activeMuscle}</div>
                  <div style={{fontFamily:mono,fontSize:11,color:C.mt}}>
                    {muscleTrend[activeMuscle][0].y} → <span style={{color:getMC(activeMuscle),fontWeight:600}}>{muscleTrend[activeMuscle][muscleTrend[activeMuscle].length-1].y} lb</span>
                  </div>
                </div>
                <LineChart points={muscleTrend[activeMuscle]} color={getMC(activeMuscle)} height={100}/>
              </div>
            )}
          </div>
        ):<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>No training data yet</div>
      )}

      {/* PRs table */}
      {view==="prs"&&(
        <>
          {prs.length>0?(
            <>
              <div style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr",marginBottom:6,paddingBottom:6,borderBottom:`1px solid ${C.bd}`}}>
                {["Exercise","Best","Reps","E1RM"].map(h=><div key={h} style={hlbl}>{h}</div>)}
              </div>
              {prs.map(pr=>(
                <div key={pr.exercise} style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr",padding:"8px 0",borderBottom:`1px solid ${C.bd}`}}>
                  <div style={{fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:6,color:C.tx}}>{pr.exercise}</div>
                  <div style={{fontSize:11,fontFamily:mono,color:C.ac}}>{pr.weight}</div>
                  <div style={{fontSize:11,fontFamily:mono,color:C.mt}}>{pr.reps}</div>
                  <div style={{fontSize:11,fontFamily:mono,color:C.gn}}>{Math.round(pr.est1rm)}</div>
                </div>
              ))}
            </>
          ):<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>No PRs yet</div>}
        </>
      )}
    </div>
  );
}
