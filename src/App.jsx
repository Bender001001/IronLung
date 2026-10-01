import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { supabase } from "./supabase.js";
// three.js + @react-three/fiber are loaded on demand (see Muscle3DView below) so they
// stay out of the main bundle; the 3D view is one toggle inside an exercise card.

const cache={get(k){try{const v=localStorage.getItem(`il_${k}`);return v?JSON.parse(v):null;}catch{return null;}},set(k,v){try{localStorage.setItem(`il_${k}`,JSON.stringify(v));}catch{}}};
function getPending(){return cache.get("pending")||[];}
function localDate(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function isOptionalDay(d){return/^optional/i.test(d?.focus||"");}
function mondayKey(ds){const[y,m,d]=String(ds).slice(0,10).split("-").map(Number);const dt=new Date(y,m-1,d);const back=(dt.getDay()+6)%7;dt.setDate(dt.getDate()-back);return`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;}
function daysSinceLastMeasurement(meas){if(!meas?.length)return Infinity;const last=meas.reduce((a,b)=>a.measure_date>b.measure_date?a:b);return Math.floor((Date.now()-new Date(last.measure_date).getTime())/86400000);}
function addPendingSet(op){const q=getPending().filter(o=>!(o.type==="upsert_set"&&o.sessionId===op.sessionId&&o.exerciseId===op.exerciseId&&o.setNumber===op.setNumber));q.push({...op,ts:Date.now()});cache.set("pending",q);}
function addPending(op){const q=getPending();q.push({...op,ts:Date.now()});cache.set("pending",q);}
// Offline queue. Each op throws on a Supabase error so a failed op stays queued.
// create_session ops carry the temp id the UI used; later set ops that point at that
// temp id are re-pointed at the real session id once it exists.
async function flushPending(){if(flushing)return 0;flushing=true;try{const q=getPending();if(!q.length)return 0;let ok=0;const fail=[];const idMap=cache.get("pending_idmap")||{};const chk=r=>{if(r?.error)throw r.error;return r;};for(const op of q){try{if(op.type==="upsert_set"){const sessionId=idMap[op.sessionId]||op.sessionId;if(String(sessionId).startsWith("temp_")){fail.push(op);continue;}const payload={weight_lb:op.weight,reps:op.reps};if(op.rir!=null)payload.rir=op.rir;if(op.mmc!=null)payload.mmc=op.mmc;if(op.dbId)chk(await supabase.from("workout_sets").update(payload).eq("id",op.dbId));else chk(await supabase.from("workout_sets").upsert({session_id:sessionId,exercise_id:op.exerciseId,set_number:op.setNumber,...payload},{onConflict:"session_id,exercise_id,set_number"}));ok++;}else if(op.type==="insert_meal"){chk(await supabase.from("meal_log").insert({log_date:op.date,food_id:op.foodId,portions:op.portions}));ok++;}else if(op.type==="delete_meal"){chk(await supabase.from("meal_log").delete().eq("id",op.id));ok++;}else if(op.type==="update_portions"){chk(await supabase.from("meal_log").update({portions:op.portions}).eq("id",op.id));ok++;}else if(op.type==="insert_measurement"){chk(await supabase.from("measurements").insert(op.data));ok++;}else if(op.type==="create_session"){const{data}=chk(await supabase.from("workout_sessions").insert(op.data).select().single());if(op.tempId&&data)idMap[op.tempId]=data.id;ok++;}else if(op.type==="insert_food"){chk(await supabase.from("foods").insert(op.data));ok++;}}catch{fail.push(op);}}cache.set("pending",fail);cache.set("pending_idmap",fail.length?idMap:{});return ok;}finally{flushing=false;}}

let flushing=false;

// DB exercise row -> the shape Session renders. Shared by the day loader and Swap.
function toEx(e,sets){return{id:e.id,name:e.name,sets,repMin:e.rep_min,repMax:e.rep_max,increment:parseFloat(e.increment_lb)||2.5,category:e.category,cues:e.cues,muscle:e.primary_muscle,video:e.video_url,imageUrl:e.image_url,tempo:e.tempo_eccentric_sec||null,isCompound:!!e.is_compound,isCardio:!!e.is_cardio};}

async function getSwapCandidates(exerciseId){
  const{data:src}=await supabase.from("exercises").select("primary_muscle,region_tag,length_bias").eq("id",exerciseId).single();
  if(!src)return[];
  const{data:pool}=await supabase.from("exercises").select("id,name,primary_muscle,region_tag,length_bias,is_compound,priority_level,rep_min,rep_max,increment_lb,cues,video_url,image_url,tempo_eccentric_sec,is_cardio").eq("primary_muscle",src.primary_muscle).neq("id",exerciseId);
  if(!pool)return[];
  return pool.filter(c=>!c.is_cardio).map(c=>{
    let score=0,tier="OK";
    if(c.region_tag&&c.region_tag===src.region_tag){score=3;tier="EXACT";}
    else if(c.length_bias&&c.length_bias===src.length_bias){score=2;tier="CLOSE";}
    else{score=1;tier="OK";}
    return{...c,_score:score,_tier:tier};
  }).sort((a,b)=>b._score-a._score);
}

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
function suggestedPhase(wk){const inBlock=((wk-1)%4)+1;return inBlock===1?"MEV":inBlock===2?"MAV":inBlock===3?"MRV":"DELOAD";}
function blockNumber(wk){return Math.ceil(wk/4);}
function isTodayTraining(){const d=new Date().getDay();const idx=d===0?6:d-1;return ROTATION[idx]!=="Rest";}
function todayDayName(){const d=new Date().getDay();const idx=d===0?6:d-1;return ROTATION[idx];}
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
let VOL_TARGETS={};
async function loadVolTargets(){
  try{
    const cached=cache.get("vol_targets");if(cached)VOL_TARGETS=cached;
    const{data}=await supabase.from("volume_targets").select("muscle,priority_level,target_min_sets,target_mav_sets,target_max_sets");
    if(data){VOL_TARGETS={};data.forEach(t=>{VOL_TARGETS[t.muscle]={min:t.target_min_sets,mav:t.target_mav_sets||null,max:t.target_max_sets,priority:t.priority_level};});cache.set("vol_targets",VOL_TARGETS);}
  }catch{}
}
loadVolTargets();

// ── Bodyweight trend & adaptive maintenance ──────────────────────────────────
// One weight per day (last entry wins). The trend is an exponentially weighted
// average (10% per day, gaps handled), which smooths out water and food noise.
// The weekly rate is a least-squares slope over the last 21 days.
function dayNum(ds){const[y,m,d]=String(ds).slice(0,10).split("-").map(Number);return Math.round(Date.UTC(y,m-1,d)/86400000);}
function dailyWeights(meas){const by={};(meas||[]).forEach(m=>{const w=parseFloat(m.bodyweight_lb);if(w>0&&m.measure_date)by[m.measure_date]=w;});return Object.entries(by).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,w])=>({date,w,t:dayNum(date)}));}
function slopePerDay(pts){const n=pts.length;if(n<2)return null;const mx=pts.reduce((s,p)=>s+p.t,0)/n,my=pts.reduce((s,p)=>s+p.w,0)/n;const den=pts.reduce((s,p)=>s+(p.t-mx)**2,0);if(!den)return null;return pts.reduce((s,p)=>s+(p.t-mx)*(p.w-my),0)/den;}
function weightTrend(meas){
  const pts=dailyWeights(meas);if(!pts.length)return null;
  let tr=pts[0].w;
  const series=pts.map((p,i)=>{if(i>0){const a=1-Math.pow(0.9,p.t-pts[i-1].t);tr=tr+a*(p.w-tr);}return{...p,trend:Math.round(tr*10)/10};});
  const today=dayNum(localDate());
  const recent=pts.filter(p=>today-p.t<=21);
  const sl=recent.length>=5&&recent[recent.length-1].t-recent[0].t>=10?slopePerDay(recent):null;
  return{series,trend:series[series.length-1].trend,last:pts[pts.length-1],rate:sl==null?null:sl*7,recentCount:recent.length,daysSinceLast:today-pts[pts.length-1].t};
}
// Target weekly change as % of bodyweight. Gaining ranges follow Iraki et al. 2019
// (0.25-0.5%/wk for novice/intermediate); cutting 0.5-1%/wk.
const GOAL_RATES={"Cut":[-1,-0.5],"Maintain":[-0.25,0.25],"Lean Bulk":[0.25,0.5],"Bulk":[0.5,0.75]};
function rateAdvice(rate,bw,goal){
  const band=GOAL_RATES[goal]||GOAL_RATES["Maintain"];if(rate==null||!bw)return null;
  const lo=band[0]*bw/100,hi=band[1]*bw/100,mid=(lo+hi)/2;
  if(rate>=lo&&rate<=hi)return{ok:true,lo,hi,text:`On target for ${goal}`};
  const kcal=Math.max(-400,Math.min(400,Math.round(((mid-rate)*3500/7)/50)*50));
  return{ok:false,lo,hi,kcal,text:`${rate<lo?"Below":"Above"} the ${goal} range. ${kcal>0?"Add":"Cut"} about ${Math.abs(kcal)} kcal/day.`};
}
// Maintenance from your own data: average logged intake minus the energy implied
// by the weight change over the same window (~3,500 kcal per lb). Days under
// 1,200 kcal logged are treated as incomplete and skipped.
async function estimateMaintenance(meas,windowDays=28){
  const pts=dailyWeights(meas);const today=dayNum(localDate());
  const win=pts.filter(p=>today-p.t<=windowDays);
  if(win.length<6||win[win.length-1].t-win[0].t<14)return{ready:false,reason:`Needs 6+ weigh-ins over 14+ days (have ${win.length})`};
  const since=new Date(Date.now()-windowDays*86400000);const sinceStr=`${since.getFullYear()}-${String(since.getMonth()+1).padStart(2,"0")}-${String(since.getDate()).padStart(2,"0")}`;
  const rows=await fetchAll(()=>supabase.from("meal_log").select("log_date,portions,foods(calories)").gte("log_date",sinceStr).order("id"));
  const byDay={};rows.forEach(r=>{byDay[r.log_date]=(byDay[r.log_date]||0)+(parseFloat(r.foods?.calories)||0)*(parseFloat(r.portions)||1);});
  const full=Object.values(byDay).filter(k=>k>=1200);
  if(full.length<10)return{ready:false,reason:`Needs 10+ fully logged days (have ${full.length})`};
  const avgIn=full.reduce((a,b)=>a+b,0)/full.length;const sl=slopePerDay(win);
  return{ready:true,maint:Math.round((avgIn-sl*3500)/10)*10,avgIn:Math.round(avgIn),rate:sl*7,days:full.length,weighIns:win.length};
}

// Fractional volume: a working set counts 1.0 for the primary muscle and 0.5 for each
// secondary muscle (exercises.secondary_muscles), per Pelland et al. 2025. Upper-chest
// work also counts toward the total-chest target, as volume_targets intends.
const VOL_ROLLUP={"Upper Chest":["Chest"]};
function muscleCredits(e){if(!e?.primary_muscle)return[];const out=[{m:e.primary_muscle,w:1}];(VOL_ROLLUP[e.primary_muscle]||[]).forEach(m=>out.push({m,w:1}));(e.secondary_muscles||[]).forEach(m=>{if(!out.some(o=>o.m===m))out.push({m,w:0.5});});return out;}
function fmtSets(x){const r=Math.round(x*2)/2;return Number.isInteger(r)?String(r):r.toFixed(1);}

// "Last time" numbers per exercise from recent sets (newest first). Shared by the live
// session loader and the offline fallback.
function buildLast(exercises,data,{week,dayId,isDeload}){
  const isCurrent=w=>w.workout_sessions?.week_number===week&&w.workout_sessions?.training_day_id===dayId;
  const bySess={};data.forEach(w=>{if(isCurrent(w))return;if(!bySess[w.exercise_id])bySess[w.exercise_id]=w.session_id;});
  const prog={};
  exercises.forEach(ex=>{
    const sessId=bySess[ex.id];if(!sessId)return;
    const v=data.filter(w=>w.exercise_id===ex.id&&w.session_id===sessId).sort((a,b)=>a.set_number-b.set_number);if(!v.length)return;
    const avg=v.reduce((s,x)=>s+x.reps,0)/v.length;const mw=Math.max(...v.map(s=>s.weight_lb));
    const rirAdj=progressionFromRIR(v);
    const sets=v.map(x=>({w:x.weight_lb,r:x.reps}));const when=v[0].workout_sessions?.session_date||null;
    const stall=stallCheck(exposuresFromSets(data.filter(w=>w.exercise_id===ex.id&&!isCurrent(w))));
    if(isDeload)prog[ex.id]={w:mw,r:avg,up:false,sw:Math.round(mw*0.6/2.5)*2.5,deload:true,rirAdj,sets,when,stall};
    else{const hit=v.every(s=>s.reps>=ex.repMax);prog[ex.id]={w:mw,r:avg,up:hit,sw:hit?mw+ex.increment:mw,rirAdj,sets,when,stall};}
  });
  return prog;
}
// Keep the offline snapshot current with sets logged in this app session (online or not),
// and record the latest training date+week so the week number can advance offline.
function rememberSet(row,programId){
  try{
    if(!(row.weight_lb>0)||!(row.reps>0))return;
    const rows=(cache.get("last_sets")||[]).filter(r=>!(r.session_id===row.session_id&&r.exercise_id===row.exercise_id&&r.set_number===row.set_number));
    rows.unshift(row);cache.set("last_sets",rows.slice(0,1500));
    const k=`last_train_${programId}`;const lt=cache.get(k);const ws=row.workout_sessions;
    if(!lt||ws.session_date>lt.date||(ws.session_date===lt.date&&ws.week_number>lt.week))cache.set(k,{week:ws.week_number,date:ws.session_date});
  }catch{}
}
// Saved on every online launch so any training day can show last-time numbers offline,
// even one you haven't opened yet this week.
async function warmLastSets(days){
  try{
    const ids=[...new Set(days.flatMap(d=>d.exercises.map(e=>e.id)))];if(!ids.length)return;
    const{data,error}=await supabase.from("workout_sets").select("session_id,exercise_id,set_number,weight_lb,reps,rir,workout_sessions(week_number,training_day_id,session_date,week_type)").in("exercise_id",ids).gt("weight_lb",0).gt("reps",0).order("created_at",{ascending:false}).limit(1000);
    if(!error&&data){const unsynced=new Set(getPending().filter(o=>o.type==="upsert_set").map(o=>String(o.sessionId)));const local=(cache.get("last_sets")||[]).filter(r=>String(r.session_id).startsWith("temp_")&&unsynced.has(String(r.session_id)));cache.set("last_sets",[...local,...data]);}
  }catch{}
}

// ── Stall detection ──────────────────────────────────────────────────────────
// Per exercise, each logged session is one "exposure" scored by its best estimated
// 1RM (Epley). Stalled = the best of the last 3 exposures is no better than the best
// before them. If those 3 came right after a 3+ week break, it's "rebuilding" instead.
function exposuresFromSets(rows){
  const by={};rows.forEach(r=>{const ws=r.workout_sessions||{};if(ws.week_type==="Deload"||!(r.weight_lb>0)||!(r.reps>0))return;const k=r.session_id;if(!by[k])by[k]={date:ws.session_date||"",best:0};by[k].best=Math.max(by[k].best,epley1RM(r.weight_lb,r.reps));});
  return Object.values(by).filter(e=>e.date).sort((a,b)=>a.date.localeCompare(b.date));
}
function stallCheck(exp){
  if(!exp||exp.length<4)return null;
  const last=exp.slice(-3),prior=exp.slice(0,-3);
  const bestPrior=Math.max(...prior.map(e=>e.best)),bestRecent=Math.max(...last.map(e=>e.best));
  const gapDays=dayNum(last[0].date)-dayNum(prior[prior.length-1].date);
  const stalled=bestRecent<=bestPrior*1.005;
  return{stalled:stalled&&gapDays<21,rebuilding:stalled&&gapDays>=21,bestPrior,bestRecent,lastDate:last[2].date,n:exp.length};
}
async function computeStalls(){
  const rows=await fetchAll(()=>supabase.from("workout_sets").select("exercise_id,session_id,weight_lb,reps,exercises(name,is_compound),workout_sessions(session_date,week_type)").gt("reps",0).gt("weight_lb",0).order("id"));
  const by={};rows.forEach(r=>{(by[r.exercise_id]=by[r.exercise_id]||{name:r.exercises?.name,isCompound:!!r.exercises?.is_compound,rows:[]}).rows.push(r);});
  const today=dayNum(localDate());
  return Object.values(by).map(e=>{const exp=exposuresFromSets(e.rows);return{name:e.name,isCompound:e.isCompound,st:stallCheck(exp),last:exp.length?exp[exp.length-1].date:null};}).filter(e=>e.st&&e.last&&today-dayNum(e.last)<=60);
}
// What to add when a priority muscle is behind for the week.
const CARRYOVER_EX={"Side Delts":"lateral raises","Lats":"pulldowns","Upper Chest":"low-to-high cable flys","Biceps":"curls","Triceps":"overhead triceps extensions","Rear Delts":"rear delt flys"};

function stallTip(isCompound){return isCompound?"Drop the load about 10% and build back up over 3 sessions, or swap to a close variation.":"Add reps before load, use a smaller jump (cable or machine), or add one set.";}

// Supabase returns at most 1,000 rows per request; page through when a view needs all history.
async function fetchAll(build,page=1000){let out=[];for(let from=0;;from+=page){const{data,error}=await build().range(from,from+page-1);if(error)throw error;out=out.concat(data||[]);if(!data||data.length<page)break;}return out;}

function epley1RM(weight,reps){if(!weight||!reps)return 0;return weight*(1+reps/30);}
function deloadAdjust(weight,weekType){if(weekType!=="Deload"||!weight)return weight;return Math.round((weight*0.6)/2.5)*2.5;}
function deloadSets(sets,weekType){if(weekType!=="Deload")return sets;return Math.max(1,Math.ceil(sets/2));}

function progressionFromRIR(prevSets){
  const validRIRs=prevSets.filter(s=>s.rir!==null&&s.rir!==undefined).map(s=>s.rir);
  if(validRIRs.length<2)return{delta:0,reason:null};
  const avg=validRIRs.reduce((a,b)=>a+b,0)/validRIRs.length;
  if(avg>=3)return{delta:1,reason:"Avg RIR "+avg.toFixed(1)+" — bump load"};
  if(avg<=0.5)return{delta:-1,reason:"Avg RIR "+avg.toFixed(1)+" — hold"};
  return{delta:0,reason:null};
}

function volumeStatus(sets,tgt){
  if(!tgt)return{label:"UNTAGGED",color:C.mt,severity:0};
  const mev=tgt.min,mrv=tgt.max,mav=tgt.mav||Math.round(mev+(mrv-mev)*0.65);
  if(sets<mev)return{label:"UNDER",color:C.rd,severity:1,delta:mev-sets,mev,mav,mrv};
  if(sets<mav)return{label:"BUILD",color:C.am,severity:2,mev,mav,mrv};
  if(sets<=mrv)return{label:"OPTIMAL",color:C.gn,severity:3,mev,mav,mrv};
  return{label:"JUNK",color:C.rd,severity:4,delta:sets-mrv,mev,mav,mrv};
}

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

// ── CSV export (your own data only; RLS scopes every query to the signed-in user) ──
function toCSV(rows,cols){const esc=v=>{if(v==null)return"";const t=String(v);return/[",\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t;};return[cols.map(c=>c[0]).join(","),...rows.map(r=>cols.map(c=>esc(c[1](r))).join(","))].join("\n");}
function downloadText(name,text){const blob=new Blob([text],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}
async function exportCSV(kind){
  const stamp=localDate();
  if(kind==="workouts"){const rows=await fetchAll(()=>supabase.from("workout_sets").select("set_number,weight_lb,reps,rir,mmc,is_pr,exercises(name,primary_muscle),workout_sessions(session_date,week_number,week_type,training_days(name))").order("id"));
    rows.sort((a,b)=>(a.workout_sessions?.session_date||"").localeCompare(b.workout_sessions?.session_date||""));
    downloadText(`ironlog-workouts-${stamp}.csv`,toCSV(rows,[["date",r=>r.workout_sessions?.session_date],["week",r=>r.workout_sessions?.week_number],["week_type",r=>r.workout_sessions?.week_type],["day",r=>r.workout_sessions?.training_days?.name],["exercise",r=>r.exercises?.name],["muscle",r=>r.exercises?.primary_muscle],["set",r=>r.set_number],["weight_lb",r=>r.weight_lb],["reps",r=>r.reps],["rir",r=>r.rir],["mmc",r=>r.mmc],["pr",r=>r.is_pr?"yes":""]]));}
  else if(kind==="food"){const rows=await fetchAll(()=>supabase.from("meal_log").select("log_date,portions,foods(name,protein_g,carbs_g,fat_g,calories)").order("id"));
    downloadText(`ironlog-food-${stamp}.csv`,toCSV(rows,[["date",r=>r.log_date],["food",r=>r.foods?.name],["portions",r=>r.portions],["protein_g",r=>Math.round((r.foods?.protein_g||0)*r.portions)],["carbs_g",r=>Math.round((r.foods?.carbs_g||0)*r.portions)],["fat_g",r=>Math.round((r.foods?.fat_g||0)*r.portions)],["kcal",r=>Math.round((r.foods?.calories||0)*r.portions)]]));}
  else{const rows=await fetchAll(()=>supabase.from("measurements").select("*").order("measure_date"));
    const cols=["measure_date","bodyweight_lb","body_fat_pct","waist_in","chest_in","shoulder_circ_in","r_arm_in","l_arm_in","thigh_in","calf_in","neck_in","hips_in","notes"];
    downloadText(`ironlog-body-${stamp}.csv`,toCSV(rows,cols.map(c=>[c,r=>r[c]])));}
}

// ── Auth ──────────────────────────────────────────────────────────────────────
// Supabase Auth gates the app. Data access is limited by RLS to emails in
// private.app_users (see migration auth_allowlist_and_authenticated_policies).
// The session is kept in localStorage by supabase-js, so this works offline once signed in.

// Offline-first startup. With no signal, supabase-js keeps retrying an expired token
// refresh for up to ~30s and every query waits on it. Reads race a short timeout and
// fall back to the local cache, and the stored session is trusted until the server
// actually says it's gone.
function net(p,ms=6000){if(navigator.onLine===false)return Promise.reject(new Error("offline"));return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error("network timeout")),ms))]);}
function storedSession(){try{const raw=localStorage.getItem("sb-qijapjafswogmjxxsbhw-auth-token");if(!raw)return null;const v=JSON.parse(raw);return v?.user?v:null;}catch{return null;}}

async function authHeaders(){try{const{data}=await supabase.auth.getSession();const t=data?.session?.access_token;return t?{Authorization:`Bearer ${t}`}:{};}catch{return{};}}
async function signOut(){try{await supabase.auth.signOut();}catch{}Object.keys(localStorage).filter(k=>k.startsWith("il_")).forEach(k=>localStorage.removeItem(k));try{navigator.serviceWorker?.controller?.postMessage("clear-caches");if(window.caches){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));}}catch{}}

function Splash({msg}){return(<div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:sans}}><div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:C.tx,letterSpacing:"0.05em"}}>IRON<span style={{color:C.ac}}>LOG</span></div><div style={{fontSize:11,color:C.mt,marginTop:8}}>{msg||"Loading..."}</div></div></div>);}

function Login(){
  const[email,setEmail]=useState(()=>cache.get("last_email")||"");
  const[pw,setPw]=useState("");
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState(null);
  const[mode,setMode]=useState("signin");
  async function run(fn){setBusy(true);setMsg(null);try{cache.set("last_email",email.trim());await fn();}catch(e){setMsg({err:true,t:e?.message||"Something went wrong"});}finally{setBusy(false);}}
  const signIn=()=>run(async()=>{const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password:pw});if(error)throw error;});
  const signUp=()=>run(async()=>{const{data,error}=await supabase.auth.signUp({email:email.trim(),password:pw,options:{emailRedirectTo:window.location.origin}});if(error)throw error;if(!data.session)setMsg({t:"Check your email and tap the confirmation link. If it opens a \"not found\" page, that is fine: the account is confirmed. Come back here and sign in."});});
  const link=()=>run(async()=>{const{error}=await supabase.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin,shouldCreateUser:false}});if(error)throw error;setMsg({t:"Sign-in link sent. Open it on this device."});});
  const reset=()=>run(async()=>{const{error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});if(error)throw error;setMsg({t:"Password reset email sent."});});
  const can=email.includes("@")&&(mode==="link"||pw.length>=6);
  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:sans,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:360}}>
        <div style={{fontSize:24,fontWeight:800,letterSpacing:"0.01em",marginBottom:4}}>IRON<span style={{color:C.ac}}>LOG</span></div>
        <div style={{fontSize:12,color:C.mt,marginBottom:20}}>{mode==="signup"?"Create your account":mode==="link"?"Email me a sign-in link":"Sign in"}</div>
        <div style={{...lbl2,marginBottom:4}}>Email</div>
        <input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} style={{...inpL,marginBottom:10}} placeholder="you@example.com"/>
        {mode!=="link"&&<><div style={{...lbl2,marginBottom:4}}>Password</div>
        <input type="password" autoComplete={mode==="signup"?"new-password":"current-password"} value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&can&&(mode==="signup"?signUp():signIn())} style={{...inpL,marginBottom:14}} placeholder={mode==="signup"?"6+ characters":""}/></>}
        <button disabled={!can||busy} onClick={mode==="signup"?signUp:mode==="link"?link:signIn} style={{...btnP,opacity:!can||busy?0.5:1,marginBottom:10}}>{busy?"...":mode==="signup"?"Create account":mode==="link"?"Send link":"Sign in"}</button>
        {msg&&<div style={{padding:"8px 12px",marginBottom:10,borderRadius:8,fontSize:12,background:msg.err?`${C.rd}10`:`${C.gn}10`,border:`1px solid ${msg.err?C.rd:C.gn}33`,color:msg.err?C.rd:C.gn}}>{msg.t}</div>}
        <div style={{display:"flex",flexWrap:"wrap",gap:12,fontSize:11}}>
          {mode!=="signin"&&<button onClick={()=>{setMode("signin");setMsg(null);}} style={{background:"none",border:"none",color:C.ac,cursor:"pointer",padding:0,fontSize:11}}>Sign in with password</button>}
          {mode!=="signup"&&<button onClick={()=>{setMode("signup");setMsg(null);}} style={{background:"none",border:"none",color:C.ac,cursor:"pointer",padding:0,fontSize:11}}>Create account</button>}
          {mode!=="link"&&<button onClick={()=>{setMode("link");setMsg(null);}} style={{background:"none",border:"none",color:C.ac,cursor:"pointer",padding:0,fontSize:11}}>Email me a link</button>}
          {mode==="signin"&&email.includes("@")&&<button onClick={reset} style={{background:"none",border:"none",color:C.mt,cursor:"pointer",padding:0,fontSize:11}}>Forgot password</button>}
        </div>
      </div>
    </div>
  );
}

function NoAccess({email}){
  return(<div style={{background:C.bg,minHeight:"100vh",color:C.tx,fontFamily:sans,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{maxWidth:360}}>
    <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Signed in, but no access yet</div>
    <div style={{fontSize:12,color:C.mt,lineHeight:1.6,marginBottom:16}}>{email} is not on this app's allowlist. Ask the owner to add it, then sign in again.</div>
    <button onClick={signOut} style={btnS}>Sign out</button>
  </div></div>);
}

export default function Root(){
  const[session,setSession]=useState(()=>storedSession()||undefined);
  const[access,setAccess]=useState("checking");
  useEffect(()=>{
    // Ask the browser not to evict offline data under storage pressure (Android/Chrome honor this; iOS keeps home-screen app data while you use it).
    try{navigator.storage?.persist?.();}catch{}
    // A failed refresh (no signal) keeps the stored session; a rejected token is removed from storage by supabase-js, so this falls through to Login.
    supabase.auth.getSession().then(({data,error})=>setSession(data?.session||(error?storedSession():null))).catch(()=>setSession(storedSession()));
    const{data:sub}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s||null));
    return()=>sub?.subscription?.unsubscribe();
  },[]);
  const uid=session?.user?.id;
  useEffect(()=>{
    if(!uid){setAccess("checking");return;}
    let live=true;
    (async()=>{try{const{data,error}=await net(supabase.from("programs").select("id").limit(1),8000);if(!live)return;if(error){setAccess("ok");return;}setAccess(data&&data.length?"ok":"denied");}catch{if(live)setAccess("ok");}})();
    return()=>{live=false;};
  },[uid]);
  if(session===undefined)return<Splash/>;
  if(!session)return<Login/>;
  if(access==="denied")return<NoAccess email={session.user?.email}/>;
  return<App key={uid} userEmail={session.user?.email}/>;
}

// ── App ───────────────────────────────────────────────────────────────────────

function App({userEmail}){
  const[tab,setTab]=useState("train");
  const[days,setDays]=useState([]);
  const[foods,setFoods]=useState([]);
  const[mt,setMt]=useState({protein:174,carbs:484,fat:72,calories:3280});
  const[meas,setMeas]=useState([]);
  const[selDay,setSelDay]=useState(null);
  const[week,setWeek]=useState(()=>cache.get("week")||12);
  const[loading,setLoading]=useState(true);
  const[restDur,setRestDurRaw]=useState(()=>cache.get("restDur")??0);
  function setRestDur(v){setRestDurRaw(v);cache.set("restDur",v);}
  const[weekType,setWeekType]=useState(()=>cache.get("weekType")||"Accumulation");
  const[pc,setPc]=useState(0);
  const[activeProgram,setActiveProgram]=useState(()=>cache.get("activeProgram")||1);
  const[measNudgeDismissed,setMeasNudgeDismissed]=useState(()=>{const v=cache.get("dismissed_measurement_nudge");if(!v)return false;return(Date.now()-new Date(v).getTime())<7*86400000;});
  const online=useOnline();
  const[incoming,setIncoming]=useState(()=>parseAddLink());

  useEffect(()=>{load();syncWeek();},[activeProgram]);
  useEffect(()=>{if(online)flushPending().then(n=>{if(n>0){setPc(getPending().length);load();}});},[online]);
  // Fresh device / cleared cache: start on whichever program is marked active in Supabase.
  useEffect(()=>{if(cache.get("activeProgram")!=null)return;(async()=>{try{const{data}=await supabase.from("programs").select("id").eq("is_active",true).limit(1);const pid=data?.[0]?.id;if(pid&&pid!==activeProgram){setActiveProgram(pid);cache.set("activeProgram",pid);}}catch{}})();},[]);

  // Week number follows training weeks: it stays on the week of your last logged session
  // until you train in a new calendar week (Mon-Sun), then moves up by one. Gaps don't
  // inflate it, and a finished week can't be reopened by accident. Arrows still override.
  async function syncWeek(){
    try{
      const{data,error}=await net(supabase.from("workout_sessions").select("week_number,session_date,workout_sets(count)").eq("program_id",activeProgram).order("session_date",{ascending:false}).order("id",{ascending:false}).limit(15));
      if(error)throw error;
      const last=(data||[]).find(s=>(s.workout_sets?.[0]?.count||0)>0);
      if(!last){const lt=cache.get(`last_train_${activeProgram}`);if(lt)return applyWeek(lt);setWeek(1);cache.set("week",1);return;}
      const lt=cache.get(`last_train_${activeProgram}`);
      // A session logged offline and not synced yet can be newer than the server's latest.
      applyWeek(lt&&lt.date>last.session_date?lt:{week:last.week_number,date:last.session_date});
    }catch{const lt=cache.get(`last_train_${activeProgram}`);if(lt)applyWeek(lt);}
  }
  function applyWeek(lt){
    cache.set(`last_train_${activeProgram}`,lt);
    const wk=mondayKey(localDate())>mondayKey(lt.date)?lt.week+1:lt.week;
    setWeek(wk);cache.set("week",wk);
  }

  async function load(){
    setLoading(true);
    try{
      const{data:d,error:dE}=await net(supabase.from("training_days").select("*,training_day_exercises(*,exercises(*))").eq("program_id",activeProgram).order("day_order"));
      if(dE)throw dE;
      if(d){
        const f=d.map(x=>({id:x.id,name:x.name,focus:x.focus,exercises:(x.training_day_exercises||[]).sort((a,b)=>a.exercise_order-b.exercise_order).map(t=>toEx(t.exercises,t.default_sets))}));
        setDays(f);cache.set(`days_${activeProgram}`,f);warmLastSets(f);
      }
      const{data:fd}=await net(supabase.from("foods").select("*").order("name"));if(fd){setFoods(fd);cache.set("foods",fd);}
      const{data:tg}=await net(supabase.from("macro_targets").select("*").eq("is_active",true).limit(1));if(tg?.[0]){const goalName=tg[0].goal_name;const t={protein:tg[0].protein_g_target,carbs:tg[0].carbs_g_target,fat:tg[0].fat_g_target,calories:tg[0].calories_target,goalName,bw:tg[0].bodyweight_lb,restCarbs:tg[0].rest_carbs_g||Math.max(0,tg[0].carbs_g_target-100),restCalories:tg[0].rest_calories||Math.max(1500,tg[0].calories_target-400)};setMt(t);cache.set("mt",t);}else if(Array.isArray(tg)){setMt(p=>({...p,goalName:undefined,noTargets:true}));}
      const{data:ms}=await net(supabase.from("measurements").select("*").order("measure_date"));if(ms){setMeas(ms);cache.set("meas",ms);}
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
      {tab==="train"&&!selDay&&!measNudgeDismissed&&daysSinceLastMeasurement(meas)>=14&&(
        <div style={{padding:"16px 16px 0"}} onClick={()=>setTab("body")}>
          <div style={{background:`${C.am}14`,border:`1px solid ${C.am}33`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,cursor:"pointer"}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:C.am}}>{meas.length?`Biweekly check-in due — last log ${daysSinceLastMeasurement(meas)} days ago`:"Log your first bodyweight check-in"}</div>
              <div style={{fontSize:10,color:C.mt,marginTop:2}}>Tap to log</div>
            </div>
            <button onClick={e=>{e.stopPropagation();const v=new Date().toISOString();cache.set("dismissed_measurement_nudge",v);setMeasNudgeDismissed(true);}} style={{background:"none",border:"none",color:C.mt,fontSize:16,cursor:"pointer",padding:4,flexShrink:0,lineHeight:1}}>×</button>
          </div>
        </div>
      )}
      {tab==="train"&&!selDay&&<DaySelect userEmail={userEmail} days={days} onSelect={setSelDay} week={week} setWeek={setWeek} restDur={restDur} setRestDur={setRestDur} weekType={weekType} setWeekType={setWeekType} online={online} activeProgram={activeProgram} switchProgram={switchProgram} meas={meas} onAddMeas={(m,replace)=>setMeas(p=>(replace?p.map(x=>x.id===m.id?m:x):[...p,m]).sort((a,b)=>a.measure_date.localeCompare(b.measure_date)))}/>}
      {tab==="train"&&selDay&&<Session day={selDay} onBack={()=>setSelDay(null)} week={week} restDur={restDur} weekType={weekType} isDeload={weekType==="Deload"} online={online} onPC={()=>setPc(getPending().length)} activeProgram={activeProgram}/>}
      {tab==="fuel"&&<Fuel foods={foods} setFoods={setFoods} mt={mt} setMt={setMt} meas={meas} online={online} onPC={()=>setPc(getPending().length)}/>}
      {tab==="body"&&<Body mt={mt} meas={meas} onAdd={m=>setMeas(p=>[...p,m].sort((a,b)=>a.measure_date.localeCompare(b.measure_date)))} online={online} onPC={()=>setPc(getPending().length)}/>}
      {tab==="stats"&&<Stats meas={meas} week={week} online={online} activeProgram={activeProgram}/>}
      {tab==="skills"&&<SkillsSection supabase={supabase}/>}
      {tab==="cali"&&<CaliWorkoutsSection supabase={supabase}/>}
      {incoming&&<AddFromLink item={incoming} onDone={(logged)=>{clearAddLink();setIncoming(null);if(logged)setTab("fuel");}}/>}
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

// ── "Send to IronLog" links (FlavorFold) ─────────────────────────────────────
// Format (per serving):  /?add=<name>&p=<protein g>&c=<carbs g>&f=<fat g>&kcal=<calories>&servings=<n>&src=flavorfold
// Opening the link (signed in) shows a confirm sheet; confirming saves the recipe to
// foods (reused if the same name + calories already exists) and logs it for today.
function parseAddLink(){
  try{
    const q=new URLSearchParams(window.location.search);const name=(q.get("add")||"").trim().slice(0,120);if(!name)return null;
    const num=(k,max)=>{const v=parseFloat(q.get(k));return Number.isFinite(v)&&v>=0&&v<=max?Math.round(v*10)/10:null;};
    const item={name,protein:num("p",500),carbs:num("c",1000),fat:num("f",500),kcal:num("kcal",5000),servings:num("servings",20)||1,src:(q.get("src")||"").slice(0,30)};
    if(item.kcal==null&&item.protein!=null&&item.carbs!=null&&item.fat!=null)item.kcal=Math.round(item.protein*4+item.carbs*4+item.fat*9);
    return item.kcal==null?null:item;
  }catch{return null;}
}
function clearAddLink(){try{const u=new URL(window.location.href);["add","p","c","f","kcal","servings","src"].forEach(k=>u.searchParams.delete(k));window.history.replaceState(null,"",u.pathname+(u.search||"")+u.hash);}catch{}}
function AddFromLink({item,onDone}){
  const[servings,setServings]=useState(item.servings||1);
  const[busy,setBusy]=useState(false);const[err,setErr]=useState(null);
  const tot=k=>Math.round((item[k]||0)*servings);
  async function confirm(){
    setBusy(true);setErr(null);
    try{
      let food=null;
      const{data:found,error:fe}=await supabase.from("foods").select("*").eq("name",item.name).eq("calories",item.kcal).limit(1);if(fe)throw fe;
      food=found?.[0]||null;
      if(!food){const{data,error}=await supabase.from("foods").insert({name:item.name,portion_size:1,portion_unit:"serving",protein_g:item.protein||0,carbs_g:item.carbs||0,fat_g:item.fat||0,calories:item.kcal,category:"Meal",notes:item.src?`From ${item.src}`:null}).select().single();if(error)throw error;food=data;}
      const{error:le}=await supabase.from("meal_log").insert({log_date:localDate(),food_id:food.id,portions:servings});if(le)throw le;
      onDone(true);
    }catch(e){setErr(e?.message||"Couldn't save. Check your connection and try again.");setBusy(false);}
  }
  return(
    <div style={{position:"fixed",inset:0,background:"#000a",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{width:"100%",maxWidth:480,background:C.sf,borderTop:`1px solid ${C.bd2}`,borderRadius:"14px 14px 0 0",padding:"18px 16px calc(18px + env(safe-area-inset-bottom,0px))"}}>
        <div style={{...lbl,color:C.ac,marginBottom:6}}>{item.src?`From ${item.src}`:"Add to today"}</div>
        <div style={{fontSize:16,fontWeight:700,marginBottom:12}}>{item.name}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:12}}>
          {[{l:"Protein",v:tot("protein"),u:"g",c:C.gn},{l:"Carbs",v:tot("carbs"),u:"g",c:C.bl},{l:"Fat",v:tot("fat"),u:"g",c:C.am},{l:"Calories",v:tot("kcal"),u:"",c:C.ac}].map(m=><div key={m.l} style={{background:C.sf2,borderRadius:8,padding:"8px 4px",textAlign:"center"}}><div style={{fontSize:16,fontWeight:700,fontFamily:mono,color:m.c}}>{m.v}{m.u}</div><div style={{fontSize:8,color:C.mt,marginTop:2}}>{m.l}</div></div>)}
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <span style={{fontSize:12,color:C.tx2}}>Servings</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}><button onClick={()=>setServings(v=>Math.max(0.5,v-0.5))} style={tbtn}>-</button><span style={{fontFamily:mono,fontSize:14,minWidth:28,textAlign:"center"}}>{servings}</span><button onClick={()=>setServings(v=>Math.min(20,v+0.5))} style={tbtn}>+</button></div>
        </div>
        {err&&<div style={{padding:"8px 10px",marginBottom:10,background:`${C.rd}10`,border:`1px solid ${C.rd}33`,borderRadius:8,fontSize:11,color:C.rd}}>{err}</div>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>onDone(false)} style={{...btnGhost,flex:1,textAlign:"center"}}>Cancel</button>
          <button disabled={busy} onClick={confirm} style={{...btnP,flex:2,opacity:busy?0.5:1}}>{busy?"Saving...":"Log it"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Muscle diagram ─────────────────────────────────────────────────────────────
// MUSCLE_MAP's `side` field is still used below to auto-orient the 3D model
// (front vs back). Its `slugs` field is now unused — it only ever fed the
// removed Flat/SVG body-highlighter view — but left in place since it's
// harmless and documents the front/back call for each muscle either way.
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
  "Biceps (Short Head)":{slugs:["biceps"],side:"front"},
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

// ── 3D muscle viewer (real anatomical mesh, static pose, flex-pulse) ───────
// Source asset: Z-Anatomy / BodyParts3D via hpfrei/body-anatomy-3d-viewer
// (CC BY-SA 4.0 — see attribution line rendered in the 3D tab below and
// public/ANATOMY_LICENSE.txt). The asset has no skeleton rig, so there is no
// joint motion here (unlike the old box-mannequin) — instead the primary
// muscle's real anatomical mesh brightens and pulses in scale to read as
// "engaged." Reuses the same muscle-name taxonomy as MUSCLE_MAP above and
// only highlights the primary muscle, matching existing image/SVG behavior.
// Biceps and triceps are split into their individual heads here (the source
// mesh already models "short head of biceps brachii", "long head of biceps
// brachii", and the three triceps heads as separate geometry) — the app's
// own primary_muscle taxonomy already has "Biceps (Short Head)" and "Triceps
// Long Head" as distinct values on some exercises, but every other view
// (Flat, and the old box-mannequin) collapses them to the same highlight as
// the generic muscle. This lets the 3D tab actually show the specific head
// instead of the whole muscle group, wherever that distinction is tracked.
const MUSCLE_PATTERNS={
  chest:[/pectoralis major/i],
  lats:[/latissimus dorsi/i],
  traps:[/trapezius/i],
  sideDelts:[/acromial part of deltoid/i],
  rearDelts:[/scapular spinal part of deltoid/i],
  frontDelts:[/clavicular part of deltoid/i],
  bicepsShortHead:[/short head of biceps brachii/i],
  bicepsLongHead:[/long head of biceps brachii/i],
  tricepsLongHead:[/long head of triceps brachii/i],
  tricepsLateralHead:[/lateral head of triceps brachii/i],
  tricepsMedialHead:[/medial head of triceps brachii/i],
  abs:[/rectus abdominis/i],
  quads:[/rectus femoris/i,/vastus (lateralis|medialis|intermedius)/i],
  hamstrings:[/biceps femoris/i,/semitendinosus/i,/semimembranosus/i],
  glutes:[/gluteus (maximus|medius|minimus)/i],
  calves:[/gastrocnemius/i,/soleus muscle/i],
  adductors:[/adductor (magnus|longus|brevis)/i],
};

const MUSCLE_TO_ANATOMY={
  "Chest":["chest"],"Upper Chest":["chest"],
  "Lats":["lats"],"Mid Back":["lats"],"Back":["lats"],
  "Upper Traps":["traps"],
  "Side Delts":["sideDelts"],"Rear Delts":["rearDelts"],"Shoulders":["sideDelts","frontDelts","rearDelts"],
  "Biceps":["bicepsShortHead","bicepsLongHead"],"Biceps (Short Head)":["bicepsShortHead"],
  "Triceps":["tricepsLongHead","tricepsLateralHead","tricepsMedialHead"],"Triceps Long Head":["tricepsLongHead"],
  "Abs":["abs"],"Quads":["quads"],"Hamstrings":["hamstrings"],
  "Glutes":["glutes"],"Calves":["calves"],"Adductors":["adductors"],"Abductors":["glutes"],
};

// THREE.GLTFLoader sanitizes node names before exposing them as Object3D.name:
// spaces become underscores and the ".001"-style duplicate suffix loses its
// dot (e.g. "Clavicular head of pectoralis major muscle.001" ->
// "Clavicular_head_of_pectoralis_major_muscle001"). Normalize before matching.
function stripSuffix(name){return(name||"").replace(/_/g," ").replace(/\d+$/,"").trim();}
function categoryForName(name){
  const n=stripSuffix(name);
  for(const[cat,list]of Object.entries(MUSCLE_PATTERNS))if(list.some(re=>re.test(n)))return cat;
  return null;
}

// The 3D components are built inside make3D() so three.js and @react-three/fiber can be
// fetched with a dynamic import() the first time the 3D view is opened (still one source file).
function make3D({Canvas,useFrame,useThree,GLTFLoader,THREE}){
let gltfPromise=null;
function loadAnatomy(){
  if(!gltfPromise){
    const loader=new GLTFLoader();
    gltfPromise=new Promise((resolve,reject)=>loader.load("/anatomy.glb",resolve,undefined,reject));
  }
  return gltfPromise;
}

function AnatomyModel({muscle,color,playing,onLoaded,onError}){
  const[scene,setScene]=useState(null);
  const activeMeshes=useRef([]);
  const t=useRef(0);
  const categories=useMemo(()=>MUSCLE_TO_ANATOMY[muscle]||[],[muscle]);

  useEffect(()=>{
    let cancelled=false;
    loadAnatomy().then(gltf=>{
      if(cancelled)return;
      const cloned=gltf.scene.clone(true);
      cloned.traverse(obj=>{
        if(!obj.isMesh)return;
        obj.userData.anatomyCategory=categoryForName(obj.name);
        obj.material=new THREE.MeshStandardMaterial({color:C.sf3,roughness:0.55,metalness:0.05});
      });
      setScene(cloned);
      if(onLoaded)onLoaded();
    }).catch(err=>{console.error("anatomy load failed",err);if(onError)onError();});
    return()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    if(!scene)return;
    const active=[];
    scene.traverse(obj=>{
      if(!obj.isMesh)return;
      if(obj.userData.anatomyCategory&&categories.includes(obj.userData.anatomyCategory)){
        active.push(obj);
      }else{
        obj.material.color.set(C.sf3);
        obj.scale.setScalar(1);
      }
    });
    activeMeshes.current=active;
  },[scene,categories]);

  useFrame((_,delta)=>{
    if(playing)t.current+=delta;
    const s01=(Math.sin(t.current*1.6)+1)/2;
    for(const m of activeMeshes.current){
      m.material.color.set(color);
      m.scale.setScalar(1+s01*0.14);
    }
  });

  if(!scene)return null;
  return<primitive object={scene}/>;
}

// Auto-frames the camera on the loaded mesh once its bounding box is known —
// the anatomical asset's proportions/pivot differ from the old box mannequin,
// so a fixed camera position would clip or under-fill the frame.
function FitCamera({targetRef}){
  const{camera}=useThree();
  const fitted=useRef(false);
  useFrame(()=>{
    if(fitted.current||!targetRef.current)return;
    const box=new THREE.Box3().setFromObject(targetRef.current);
    if(box.isEmpty())return;
    const size=new THREE.Vector3();box.getSize(size);
    const center=new THREE.Vector3();box.getCenter(center);
    if(size.length()===0)return;
    const maxDim=Math.max(size.x,size.y,size.z);
    const fov=camera.fov*(Math.PI/180);
    const dist=(maxDim/2)/Math.tan(fov/2)*1.6;
    camera.position.set(center.x,center.y,center.z+dist);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    fitted.current=true;
  });
  return null;
}

// Manual drag-to-rotate + slow idle spin. No orbit-controls package added —
// only the two libraries that were approved (three, @react-three/fiber).
function OrbitGroup({children,initialYaw=0}){
  const{gl}=useThree();
  const group=useRef();
  const dragging=useRef(false);
  const last=useRef([0,0]);
  const yawSet=useRef(false);
  useEffect(()=>{
    if(!yawSet.current&&group.current){group.current.rotation.y=initialYaw;yawSet.current=true;}
  },[initialYaw]);
  useEffect(()=>{
    const el=gl.domElement;
    const down=e=>{dragging.current=true;last.current=[e.clientX,e.clientY];};
    const up=()=>{dragging.current=false;};
    const move=e=>{
      if(!dragging.current||!group.current)return;
      const dx=e.clientX-last.current[0],dy=e.clientY-last.current[1];
      last.current=[e.clientX,e.clientY];
      group.current.rotation.y+=dx*0.01;
      group.current.rotation.x=Math.max(-0.5,Math.min(0.5,group.current.rotation.x+dy*0.01));
    };
    el.addEventListener("pointerdown",down);
    window.addEventListener("pointermove",move);
    window.addEventListener("pointerup",up);
    return()=>{el.removeEventListener("pointerdown",down);window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);};
  },[gl]);
  useFrame((_,delta)=>{if(!dragging.current&&group.current)group.current.rotation.y+=delta*0.15;});
  return<group ref={group}>{children}</group>;
}

function Muscle3DView({muscle,color}){
  const[playing,setPlaying]=useState(true);
  // "loading" | "ready" | "error" — the anatomical mesh is a ~2.3MB fetch (vs.
  // Tier A's instant procedural shapes), so on a slow connection the canvas
  // would otherwise sit blank with no feedback; and if the fetch ever 404s
  // (bad deploy, missing public/anatomy.glb) it would fail completely silently.
  const[status,setStatus]=useState("loading");
  const modelRef=useRef();
  // Face whichever side the primary muscle is actually on (reuses the same
  // front/back classification the SVG fallback already uses) — otherwise a
  // back muscle like Lats would be lit on a model facing away from camera.
  const initialYaw=useMemo(()=>MUSCLE_MAP[muscle]?.side==="back"?Math.PI:0,[muscle]);
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,width:"100%"}}>
      {/* Sized up from the old fixed 160x190 (matched to the Photo/Flat thumbnails)
          now that 3D is the more detailed, primary view — responsive so it also
          fills more of the card on a phone instead of sitting tiny in a corner. */}
      <div style={{width:"100%",maxWidth:280,aspectRatio:"160/190",background:C.sf2,borderRadius:8,position:"relative",touchAction:"none",overflow:"hidden"}}>
        <Canvas camera={{fov:28}} dpr={[1,1.5]}>
          <ambientLight intensity={1.4}/>
          <directionalLight position={[2,4,3]} intensity={1.6}/>
          <directionalLight position={[-2,1,-3]} intensity={1.0}/>
          <directionalLight position={[0,-3,2]} intensity={0.6}/>
          <OrbitGroup initialYaw={initialYaw}>
            <group ref={modelRef}>
              <AnatomyModel muscle={muscle} color={color} playing={playing} onLoaded={()=>setStatus("ready")} onError={()=>setStatus("error")}/>
            </group>
          </OrbitGroup>
          <FitCamera targetRef={modelRef}/>
        </Canvas>
        {status==="loading"&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:C.tx2,fontFamily:mono,pointerEvents:"none"}}>Loading model…</div>
        )}
        {status==="error"&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:C.tx2,fontFamily:mono,textAlign:"center",padding:12,pointerEvents:"none"}}>Couldn't load 3D model — try Photo</div>
        )}
        {status==="ready"&&(
          <button onClick={()=>setPlaying(p=>!p)} style={{position:"absolute",bottom:5,right:5,background:C.bg+"cc",border:`1px solid ${C.bd}`,borderRadius:6,color:C.tx2,fontSize:9,padding:"3px 7px",cursor:"pointer"}}>{playing?"Pause":"Play"}</button>
        )}
      </div>
      {/* CC BY-SA 4.0 requires attribution — kept visible whenever this asset is shown, not buried in a settings page. */}
      <div style={{fontSize:7,color:C.mt,textAlign:"center",lineHeight:1.3,maxWidth:280}}>
        Anatomy model: <a href="https://www.z-anatomy.com/" target="_blank" rel="noreferrer" style={{color:C.mt}}>Z-Anatomy</a> via hpfrei, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" style={{color:C.mt}}>CC BY-SA 4.0</a>
      </div>
    </div>
  );
}
return Muscle3DView;
}
const Muscle3DView=lazy(()=>Promise.all([import("@react-three/fiber"),import("three/examples/jsm/loaders/GLTFLoader.js"),import("three")]).then(([r3f,gltf,THREE])=>({default:make3D({Canvas:r3f.Canvas,useFrame:r3f.useFrame,useThree:r3f.useThree,GLTFLoader:gltf.GLTFLoader,THREE})})));

// Photo (curated per-exercise image) and 3D (real anatomical mesh) are the
// two real options now. The old "Flat" body-highlighter silhouette is gone —
// it only ever added real value for exercises with neither a photo nor a
// MUSCLE_MAP entry, and 3D covers that same fallback case just as well (see
// Cross-Body Rope Extension), so keeping a third, lower-fidelity view around
// just added a toggle nobody needed. Cardio exercises (no primary_muscle
// mapping at all) fall through to 3D too — a plain rotatable figure with
// nothing highlighted, which is a reasonable "nothing to show" state.
function MuscleDiagram({muscle,color,imageUrl}){
  const col=color||C.ac;
  const[mode,setMode]=useState(imageUrl?"image":"3d");

  const chip=on=>({fontSize:9,padding:"3px 8px",borderRadius:20,border:`1px solid ${on?col:C.bd}`,background:on?`${col}14`:"transparent",color:on?col:C.mt,cursor:"pointer",fontWeight:600});

  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
      <div style={{fontSize:8,color:col,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700,fontFamily:sans}}>
        {muscle}
      </div>
      {mode==="image"&&imageUrl&&(
        <div style={{width:160,background:C.sf2,borderRadius:8}}>
          <img src={imageUrl} alt={muscle} style={{width:"100%",display:"block",borderRadius:8}} onError={e=>{e.target.style.display="none";}}/>
        </div>
      )}
      {mode==="3d"&&<Suspense fallback={<div style={{width:"100%",maxWidth:280,aspectRatio:"160/190",background:C.sf2,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:C.tx2,fontFamily:mono}}>Loading 3D…</div>}><Muscle3DView muscle={muscle} color={col}/></Suspense>}
      <div style={{display:"flex",gap:4}}>
        {imageUrl&&<button onClick={()=>setMode("image")} style={chip(mode==="image")}>Photo</button>}
        <button onClick={()=>setMode("3d")} style={chip(mode==="3d")}>3D</button>
      </div>
    </div>
  );
}

function DaySelect({userEmail,days,onSelect,week,setWeek,restDur,setRestDur,weekType,setWeekType,online,activeProgram,switchProgram,meas,onAddMeas}){
  const[showCfg,setShowCfg]=useState(false);
  const[wc,setWc]=useState(null);
  const[summary,setSummary]=useState(null);
  const[showSum,setShowSum]=useState(false);
  const[dismissedDL,setDismissedDL]=useState(false);
  const[stalledNames,setStalledNames]=useState(()=>(cache.get("stalls")||[]).filter(e=>e.st?.stalled).map(e=>e.name));
  useEffect(()=>{if(!online)return;computeStalls().then(out=>{cache.set("stalls",out);setStalledNames(out.filter(e=>e.st?.stalled).map(e=>e.name));}).catch(()=>{});},[activeProgram]);
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
  const wt=useMemo(()=>weightTrend(meas),[meas]);

  useEffect(()=>{lc();loadSummary();},[week,activeProgram]);

  async function logBW(){
    if(!bwInput)return;
    const lat=meas&&meas.length>0?meas[meas.length-1]:null;
    const entry={measure_date:localDate(),bodyweight_lb:parseFloat(bwInput)||null};
    if(lat?.height_in)entry.height_in=lat.height_in;
    // One weigh-in per day: editing today's weight updates the row instead of adding another.
    const todayRow=lat&&lat.measure_date===entry.measure_date&&lat.id&&!String(lat.id).startsWith("t_")?lat:null;
    if(todayRow){try{const{data,error}=await supabase.from("measurements").update({bodyweight_lb:entry.bodyweight_lb}).eq("id",todayRow.id).select().single();if(error)throw error;if(data)onAddMeas(data,true);}catch{onAddMeas({...todayRow,bodyweight_lb:entry.bodyweight_lb},true);}setShowBWInput(false);setBwInput("");return;}
    try{const{data,error}=await supabase.from("measurements").insert(entry).select().single();if(error)throw error;if(data)onAddMeas(data);}
    catch{onAddMeas({...entry,id:`t_${Date.now()}`});addPending({type:"insert_measurement",data:entry});}
    setShowBWInput(false);setBwInput("");
  }

  async function lc(){
    if(!online){setWc(null);return;}
    try{
      const{data}=await supabase.from("workout_sessions").select("id,training_day_id,workout_sets(reps)").eq("week_number",week).eq("program_id",activeProgram);
      if(!data?.length){setWc(null);setCompletedDays({});return;}
      const core=days.filter(d=>!isOptionalDay(d));const coreIds=new Set(core.map(d=>d.id));const tp=core.reduce((s,d)=>s+d.exercises.reduce((s2,e)=>s2+e.sets,0),0);
      let dn=0;const cd={};
      data.forEach(s=>{let sets=0;s.workout_sets.forEach(ws=>{if(ws.reps>0){if(coreIds.has(s.training_day_id))dn++;sets++;}});if(sets>0)cd[s.training_day_id]=true;});
      setCompletedDays(cd);setWc(tp>0?Math.min(100,Math.round((dn/tp)*100)):0);
    }catch{setWc(null);}
  }

  async function loadSummary(){
    if(!online)return;
    try{
      const{data}=await supabase.from("workout_sessions").select("id,training_day_id,workout_sets(exercise_id,weight_lb,reps,exercises(name,primary_muscle,secondary_muscles))").eq("week_number",week).eq("program_id",activeProgram);
      if(!data?.length){setSummary(null);return;}
      let totalSets=0,completedSets=0,prCount=0;const muscles={};
      const{data:prevData}=await supabase.from("workout_sessions").select("id,workout_sets(exercise_id,weight_lb,reps,exercises(name,primary_muscle,secondary_muscles))").eq("week_number",week-1).eq("program_id",activeProgram);
      const prevBest={};const prevMuscles={};
      if(prevData)prevData.forEach(s=>s.workout_sets.forEach(ws=>{
        const n=ws.exercises?.name;if(n&&ws.weight_lb){if(!prevBest[n]||ws.weight_lb>prevBest[n])prevBest[n]=ws.weight_lb;}
        if(ws.reps>0&&ws.exercises?.primary_muscle){muscleCredits(ws.exercises).forEach(({m,w})=>{prevMuscles[m]=(prevMuscles[m]||0)+w;});}
      }));
      data.forEach(s=>{s.workout_sets.forEach(ws=>{totalSets++;if(ws.reps>0){completedSets++;if(ws.exercises?.primary_muscle){muscleCredits(ws.exercises).forEach(({m,w})=>{muscles[m]=(muscles[m]||0)+w;});}const n=ws.exercises?.name;if(n&&ws.weight_lb&&prevBest[n]&&ws.weight_lb>prevBest[n])prCount++;}});});
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
          {wt&&wt.daysSinceLast<=21&&wt.recentCount>=2&&<div style={{fontSize:10,fontFamily:mono,color:C.mt,marginTop:2}}>trend {wt.trend} lb{wt.rate!=null&&<span style={{color:C.tx2}}> · {wt.rate>=0?"+":""}{wt.rate.toFixed(1)} lb/wk</span>}</div>}
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
              <span style={{...lbl,color:C.ac}}>Goal progress</span>
              <button onClick={()=>{setGoalBWInput(String(goalBW));setGoalBFInput(String(goalBF));setShowGoalEdit(!showGoalEdit);}} style={{background:"none",border:"none",color:C.mt,fontSize:10,cursor:"pointer",padding:0}}>{showGoalEdit?"done":"edit goal"}</button>
            </div>
            {showGoalEdit?(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
                <div><div style={{...lbl2,marginBottom:4}}>Goal weight (lb)</div><input type="number" inputMode="decimal" value={goalBWInput} onChange={e=>setGoalBWInput(e.target.value)} onBlur={()=>{cache.set("goalBW",goalBWInput);setGoalBW(goalBWInput);}} style={{...inp,fontSize:13}} placeholder="e.g. 185"/></div>
                <div><div style={{...lbl2,marginBottom:4}}>Goal BF%</div><input type="number" inputMode="decimal" value={goalBFInput} onChange={e=>setGoalBFInput(e.target.value)} onBlur={()=>{cache.set("goalBF",goalBFInput);setGoalBF(goalBFInput);}} style={{...inp,fontSize:13}} placeholder="e.g. 12"/></div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {gBW&&curBW&&<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:C.tx}}>{curBW} lb <span style={{color:C.mt}}>→ {gBW} lb</span></span><span style={{fontSize:11,fontFamily:mono,color:bwPct===100?C.gn:C.ac}}>{bwPct}%</span></div><div style={{height:5,background:C.bd,borderRadius:3,overflow:"hidden"}}><div style={{width:`${bwPct||0}%`,height:"100%",background:bwPct===100?C.gn:C.ac,borderRadius:3,transition:"width 0.4s"}}/></div><div style={{fontSize:9,color:C.mt,marginTop:2}}>{bwPct===100?"Goal reached 🎯":`${Math.abs(gBW-curBW).toFixed(1)} lb to go`}</div></div>}
                {gBF&&curBF&&<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:C.tx}}>{parseFloat(curBF).toFixed(1)}% BF <span style={{color:C.mt}}>→ {gBF}%</span></span><span style={{fontSize:11,fontFamily:mono,color:bfPct===100?C.gn:C.am}}>{bfPct}%</span></div><div style={{height:5,background:C.bd,borderRadius:3,overflow:"hidden"}}><div style={{width:`${bfPct||0}%`,height:"100%",background:bfPct===100?C.gn:C.am,borderRadius:3,transition:"width 0.4s"}}/></div><div style={{fontSize:9,color:C.mt,marginTop:2}}>{parseFloat(curBF)>gBF?`${(parseFloat(curBF)-gBF).toFixed(1)}% to go`:"Goal reached 🎯"}</div></div>}
              </div>
            )}
          </div>
        );
      })()):(
        <button onClick={()=>setShowGoalEdit(true)} style={{...btnGhost,width:"100%",textAlign:"center",marginBottom:12,fontSize:11,color:C.mt}}>+ Set a bodyweight / BF% goal</button>
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

      {summary&&summary.sessionsLogged>=3&&(()=>{const behind=Object.entries(VOL_TARGETS).filter(([m,t])=>t.priority==="HIGH"&&CARRYOVER_EX[m]&&(summary.muscles[m]||0)<t.min).map(([m,t])=>({m,have:summary.muscles[m]||0,need:t.min}));if(!behind.length)return null;return(
        <div style={{background:`${C.ac}0d`,border:`1px solid ${C.ac}33`,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:600,color:C.ac,marginBottom:4}}>Priority muscles behind this week</div>
          {behind.slice(0,3).map(b=><div key={b.m} style={{fontSize:11,color:C.tx2,marginTop:2}}>{b.m} {fmtSets(b.have)}/{b.need} sets: add {Math.min(4,Math.ceil(b.need-b.have))} sets of {CARRYOVER_EX[b.m]} to your next session</div>)}
        </div>);})()}
      {stalledNames.length>=3&&!isDL&&!dismissedDL&&(
        <div style={{background:`${C.am}10`,border:`1px solid ${C.am}33`,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:C.am}}>Deload week?</div><div style={{fontSize:11,color:C.mt,marginTop:1}}>{stalledNames.length} lifts have stalled ({stalledNames.slice(0,3).join(", ")}{stalledNames.length>3?"…":""}). A week at 2 sets and ~60% load usually clears built-up fatigue.</div></div>
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
          {Object.keys(summary.muscles).length>0&&<div><div style={{...lbl,marginBottom:7}}>Volume by muscle</div><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{Object.entries(summary.muscles).sort(([ma,sa],[mb,sb])=>{const pa=VOL_TARGETS[ma]?.priority||"LOW",pb=VOL_TARGETS[mb]?.priority||"LOW";const po={HIGH:0,MED:1,LOW:2};return(po[pa]??2)-(po[pb]??2)||sb-sa;}).map(([m,sets])=>{const tgt=VOL_TARGETS[m];const under=tgt&&sets<tgt.min,inR=tgt&&sets>=tgt.min&&sets<=tgt.max,over=tgt&&sets>tgt.max;const sc=inR?C.gn:under?C.am:over?C.rd:C.mt;const isHigh=tgt?.priority==="HIGH";const delta=summary.muscleDeltas?.[m];return<span key={m} style={{padding:"3px 8px",borderRadius:4,background:isHigh?`${C.ac}10`:C.sf2,border:`1px solid ${isHigh?`${C.ac}33`:tgt?`${sc}33`:C.bd}`,fontSize:10,fontFamily:mono,display:"flex",alignItems:"center",gap:4}}>{isHigh&&<span style={{fontSize:7,color:C.ac,fontWeight:700}}>★</span>}<span style={{color:C.tx}}>{m}</span><span style={{color:sc}}>{fmtSets(sets)}</span>{tgt&&<span style={{fontSize:8,color:C.mt}}>/{tgt.min}-{tgt.max}</span>}{delta!=null&&<span style={{color:delta>0?C.gn:C.rd,fontSize:9}}>{delta>0?`+${fmtSets(delta)}`:fmtSets(delta)}</span>}</span>;})}</div></div>}
        </div>
      )}

      {showCfg&&(
        <div style={{...card,marginBottom:12}}>
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={lbl}>Week phase</span>
              <span style={{fontSize:10,color:C.mt,fontFamily:mono}}>Block {blockNumber(week)} · suggested: {suggestedPhase(week)}</span>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {WEEK_TYPES.map(t=><button key={t} onClick={()=>setWeekType(t)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${weekType===t?(t==="Deload"?C.am:C.ac):C.bd}`,background:weekType===t?(t==="Deload"?C.am:C.ac)+"15":"transparent",color:weekType===t?(t==="Deload"?C.am:C.ac):C.mt,fontSize:12,fontWeight:weekType===t?600:400,cursor:"pointer"}}>{t}</button>)}
            </div>
            {isDL&&<div style={{fontSize:11,color:C.am,marginTop:8,padding:"6px 10px",background:`${C.am}08`,borderRadius:6}}>Deload: 2 sets at ~60% weight</div>}
          </div>
          <div>
            <div style={{...lbl,marginBottom:10}}>Rest timer <span style={{textTransform:"none",letterSpacing:0,fontWeight:400,color:C.mt}}>· Auto = 3:00 compounds, 1:30 isolation</span></div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[0,60,90,120,150,180,240].map(t=><button key={t} onClick={()=>setRestDur(t)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${restDur===t?C.ac:C.bd}`,background:restDur===t?`${C.ac}15`:"transparent",color:restDur===t?C.ac:C.mt,fontSize:12,fontFamily:mono,cursor:"pointer"}}>{t===0?"Auto":`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`}</button>)}
            </div>
          </div>
          <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.bd}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}><span style={{fontSize:11,color:C.mt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Signed in as {userEmail||"?"}</span></div>
          <div style={{marginTop:10,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><span style={{fontSize:11,color:C.mt,marginRight:2}}>Export CSV:</span>{[["workouts","Workouts"],["food","Food"],["body","Body"]].map(([k,l])=><button key={k} onClick={()=>exportCSV(k).catch(e=>console.error("export failed",e))} style={{...btnGhost,padding:"5px 10px",fontSize:11}}>{l}</button>)}<span style={{flex:1}}/><button onClick={signOut} style={{...btnGhost,padding:"6px 12px",fontSize:11,flexShrink:0}}>Sign out</button></div>
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
  const[readiness,setReadiness]=useState(null);
  const[showReadiness,setShowReadiness]=useState(false);
  const[checkedReadiness,setCheckedReadiness]=useState(false);
  const[rdForm,setRdForm]=useState({sleep_hours:null,energy:null,soreness_priority:null});
  const[swapEx,setSwapEx]=useState(null);
  const[swapCandidates,setSwapCandidates]=useState([]);
  const swapKey=`swaps_${day.id}_${week}_${activeProgram}`;
  const[swapMap,setSwapMapRaw]=useState(()=>cache.get(swapKey)||{});
  function setSwapMap(fn){setSwapMapRaw(p=>{const n=typeof fn==="function"?fn(p):fn;cache.set(swapKey,n);return n;});}
  const[prState,setPrState]=useState(null);
  const[span,setSpan]=useState(null);
  const prDismissRef=useRef(null);
  const saveTimer=useRef({});
  const sdRef=useRef({});
  sdRef.current=sd;

  function eff(ex){return deloadSets(ex.sets,weekType);}
  // Keep the phone screen on while a session is open (re-acquired when the tab comes back).
  useEffect(()=>{let lock=null;const req=async()=>{try{lock=await navigator.wakeLock?.request("screen");}catch{}};req();const vis=()=>{if(document.visibilityState==="visible")req();};document.addEventListener("visibilitychange",vis);return()=>{document.removeEventListener("visibilitychange",vis);try{lock?.release();}catch{}};},[]);
  useEffect(()=>{init();loadLast();},[day.id,week]);
  useEffect(()=>{
    if(!sid||String(sid).startsWith("temp_")||checkedReadiness)return;
    setCheckedReadiness(true);
    (async()=>{
      try{const{data}=await supabase.from("session_readiness").select("*").eq("session_id",sid).limit(1);
      if(data?.[0]){setReadiness(data[0]);}else{setShowReadiness(true);}}catch{}
    })();
  },[sid,checkedReadiness]);

  // "Last time" = the most recent logged session that contains each exercise (any day,
  // excluding this session). Laterals now appear on 4 days, so the freshest number to beat
  // is whichever day you did them last. Keeps per-set detail for the logbook targets.
  async function loadLast(){
    const exerciseIds=day.exercises.map(e=>e.id);if(!exerciseIds.length)return;
    const apply=rows=>{const prog=buildLast(day.exercises,rows,{week,dayId:day.id,isDeload});setLw(prog);return prog;};
    try{
      const{data,error}=await net(supabase.from("workout_sets").select("session_id,exercise_id,set_number,weight_lb,reps,rir,created_at,workout_sessions(week_number,training_day_id,session_date,week_type)").in("exercise_id",exerciseIds).gt("weight_lb",0).gt("reps",0).order("created_at",{ascending:false}).limit(800));if(error)throw error;
      if(!data)return;
      cache.set(`lw_${day.id}_${week}`,apply(data));
    }catch{
      // Offline: this day's cached numbers, else rebuild from the recent-sets snapshot
      // the app saves on every online launch (warmLastSets).
      const c=cache.get(`lw_${day.id}_${week}`);if(c){setLw(c);return;}
      const rows=cache.get("last_sets");if(rows)apply(rows.filter(r=>exerciseIds.includes(r.exercise_id)));
    }
  }

  async function loadHistory(exerciseId){
    try{const{data}=await supabase.from("workout_sets").select("weight_lb,reps,workout_sessions(week_number)").eq("exercise_id",exerciseId).order("created_at",{ascending:true});if(data){const byWeek={};data.forEach(s=>{const wk=s.workout_sessions?.week_number;if(!wk)return;if(!byWeek[wk])byWeek[wk]={maxW:0,totalReps:0,sets:0};byWeek[wk].maxW=Math.max(byWeek[wk].maxW,s.weight_lb||0);byWeek[wk].totalReps+=s.reps||0;byWeek[wk].sets++;});const weeks=Object.entries(byWeek).map(([wk,d])=>({week:parseInt(wk),weight:d.maxW,avgReps:d.sets>0?(d.totalReps/d.sets).toFixed(1):0})).sort((a,b)=>a.week-b.week);setHistory({exerciseId,weeks});}}catch{}
  }

  async function init(){
    const ck=`session_${day.id}_${week}_${activeProgram}`;
    try{
      const{data,error:se}=await net(supabase.from("workout_sessions").select("id,notes,workout_sets(*)").eq("week_number",week).eq("training_day_id",day.id).eq("program_id",activeProgram).limit(1));if(se)throw se;
      if(data?.[0]){setSid(data[0].id);setNotes(data[0].notes||"");{const ts=(data[0].workout_sets||[]).filter(w=>w.reps>0&&w.created_at).map(w=>new Date(w.created_at).getTime());if(ts.length)setSpan({start:Math.min(...ts),end:Math.max(...ts)});}const l={};data[0].workout_sets.forEach(w=>{l[`${w.exercise_id}-${w.set_number}`]={weight:w.weight_lb||0,reps:w.reps||0,rir:w.rir??null,mmc:w.mmc??null,dbId:w.id};});setSd(l);cache.set(ck,{sid:data[0].id,sets:l});}
      else{if(navigator.onLine===false)throw new Error("offline");const{data:n,error:ne}=await supabase.from("workout_sessions").insert({week_number:week,training_day_id:day.id,session_date:localDate(),week_type:weekType,program_id:activeProgram,mesocycle_block:Math.ceil(week/4),mesocycle_phase:weekType==="Deload"?"DELOAD":(((week-1)%4)+1===1?"MEV":((week-1)%4)+1===2?"MAV":((week-1)%4)+1===3?"MRV":"DELOAD")}).select().single();if(ne)throw ne;if(n){setSid(n.id);cache.set(ck,{sid:n.id,sets:{}});}}
    }catch{const c=cache.get(ck);if(c){setSid(c.sid);setSd(c.sets||{});}else{const tid=`temp_${Date.now()}`;setSid(tid);cache.set(ck,{sid:tid,sets:{}});addPending({type:"create_session",tempId:tid,data:{week_number:week,training_day_id:day.id,session_date:localDate(),week_type:weekType,program_id:activeProgram}});onPC();}}
  }

  async function saveNotes(val){setNotes(val);if(!sid||String(sid).startsWith("temp_"))return;try{await supabase.from("workout_sessions").update({notes:val}).eq("id",sid);setNotesSaved(true);setTimeout(()=>setNotesSaved(false),1500);}catch{}}
  function gs(eid,sn){return sd[`${eid}-${sn}`]||{weight:0,reps:0};}

  function ul(eid,sn,f,v){
    const k=`${eid}-${sn}`;
    setSd(p=>({...p,[k]:{...p[k],weight:p[k]?.weight||0,reps:p[k]?.reps||0,[f]:parseFloat(v)||0}}));
    clearTimeout(saveTimer.current[k]);
    saveTimer.current[k]=setTimeout(()=>sv(eid,sn),800);
  }

  async function sv(eid,sn,overrides={}){if(!sid)return;const k=`${eid}-${sn}`,d={...sdRef.current[k],...overrides};if(!d||(!d.weight&&!d.reps))return;const ck=`session_${day.id}_${week}_${activeProgram}`;const cached=cache.get(ck)||{sid,sets:{}};cached.sets=cached.sets||{};const wasDone=(cached.sets[k]?.reps||0)>0;if(d.reps>0)rememberSet({session_id:sid,exercise_id:eid,set_number:sn,weight_lb:d.weight,reps:d.reps,rir:d.rir??null,workout_sessions:{week_number:week,training_day_id:day.id,session_date:localDate(),week_type:weekType}},activeProgram);if(!wasDone&&d.reps>0){startTimer();setSpan(p=>({start:p?.start||Date.now(),end:Date.now()}));}else if(d.reps>0)setSpan(p=>p?{...p,end:Date.now()}:{start:Date.now(),end:Date.now()});cached.sets[k]={weight:d.weight,reps:d.reps,rir:d.rir,mmc:d.mmc,dbId:d.dbId};cache.set(ck,cached);const queue=()=>{addPendingSet({type:"upsert_set",dbId:d.dbId,sessionId:sid,exerciseId:eid,setNumber:sn,weight:d.weight,reps:d.reps,rir:d.rir??null,mmc:d.mmc??null});onPC();};if(String(sid).startsWith("temp_")){queue();setSaved(new Date().toLocaleTimeString());return;}
    const payload={weight_lb:d.weight,reps:d.reps};if(d.rir!=null)payload.rir=d.rir;if(d.mmc!=null)payload.mmc=d.mmc;try{if(navigator.onLine===false)throw new Error("offline");let savedRowId=d.dbId;if(d.dbId){const{error:ue}=await supabase.from("workout_sets").update(payload).eq("id",d.dbId);if(ue)throw ue;}else{const{data:ins,error:ie}=await supabase.from("workout_sets").upsert({session_id:sid,exercise_id:eid,set_number:sn,...payload},{onConflict:"session_id,exercise_id,set_number"}).select().single();if(ie)throw ie;if(ins){savedRowId=ins.id;setSd(p=>({...p,[k]:{...p[k],dbId:ins.id}}));cached.sets[k].dbId=ins.id;cache.set(ck,cached);}}
      if(savedRowId&&d.weight>0&&d.reps>0&&weekType!=="Deload"){
        const currE1=epley1RM(d.weight,d.reps);
        const{data:prior}=await supabase.from("workout_sets").select("weight_lb,reps,exercises(name)").eq("exercise_id",eid).neq("id",savedRowId).gt("weight_lb",0).gt("reps",0);
        const priorMaxE1=(prior||[]).reduce((mx,s)=>Math.max(mx,epley1RM(s.weight_lb,s.reps)),0);
        if(currE1>priorMaxE1){
          await supabase.from("workout_sets").update({is_pr:true}).eq("id",savedRowId);
          const exName=prior?.[0]?.exercises?.name||"";
          if(prDismissRef.current)clearTimeout(prDismissRef.current);
          setPrState({setId:savedRowId,weight:d.weight,reps:d.reps,e1RM:currE1,exerciseName:exName});
          prDismissRef.current=setTimeout(()=>setPrState(null),4000);
        }
      }
    }catch{queue();}
    setSaved(new Date().toLocaleTimeString());}
  function adj(eid,sn,field,delta){const k=`${eid}-${sn}`,curr=sdRef.current[k]?.[field]||0;const newVal=field==="reps"?Math.max(0,Math.round(curr+delta)):Math.max(0,Math.round((curr+delta)*100)/100);const updates={weight:sdRef.current[k]?.weight||0,reps:sdRef.current[k]?.reps||0,[field]:newVal};setSd(p=>({...p,[k]:{...p[k],...updates}}));sv(eid,sn,updates);}

  function fill(eid,n,w){const u={};for(let i=1;i<=n;i++){const k=`${eid}-${i}`;u[k]={...sdRef.current[k],weight:w,reps:sd[k]?.reps||0,dbId:sd[k]?.dbId};}setSd(p=>({...p,...u}));}
  function done(eid,n){let c=0;for(let i=1;i<=n;i++)if(sd[`${eid}-${i}`]?.reps>0)c++;return c;}
  const totalS=day.exercises.reduce((s,e)=>s+eff(e),0),doneS=day.exercises.reduce((s,e)=>s+done(e.id,eff(e)),0),comp=totalS>0?Math.round((doneS/totalS)*100):0;
  function startTimer(){setShowTimer(true);setTimerKey(k=>k+1);}
  const progName=activeProgram===2?"APEX":"IRONCLAD";

  return(
    <div style={{padding:"20px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
        <button onClick={onBack} style={sbtn}>‹</button>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:18,fontWeight:700}}>{day.name}</div><div style={{fontSize:11,color:C.mt,marginTop:1}}>W{week} · {weekType} · {progName}{span&&<span style={{fontFamily:mono}}> · {Math.max(1,Math.round((span.end-span.start)/60000))} min</span>}</div></div>
        <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:18,fontWeight:700,fontFamily:mono,color:comp===100?C.gn:comp>0?C.am:C.mt}}>{comp}%</div><div style={{fontSize:8,color:C.mt,fontFamily:mono,marginTop:1,textTransform:"uppercase",letterSpacing:"0.06em"}}>{comp===100?"complete":"done"}</div>{saved&&<div style={{fontSize:8,color:C.gn,fontFamily:mono,marginTop:1}}>{saved}</div>}</div>
      </div>
      <div style={{width:"100%",height:6,background:C.bd,borderRadius:3,marginBottom:10,overflow:"hidden"}}><div style={{width:`${comp}%`,height:"100%",background:comp===100?C.gn:C.ac,borderRadius:3,transition:"width 0.3s"}}/></div>
      <div style={{marginBottom:12,position:"relative"}}>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} onBlur={e=>saveNotes(e.target.value)} placeholder="Session notes — how you felt, anything off, PRs to remember..." style={{...inpL,height:notes?68:38,resize:"none",padding:"9px 12px",lineHeight:1.5,fontSize:12,color:C.tx,transition:"height 0.2s",fontFamily:sans}}/>
        {notesSaved&&<span style={{position:"absolute",right:10,bottom:8,fontSize:9,color:C.gn,fontFamily:mono}}>saved</span>}
      </div>
      {showReadiness&&(
        <div style={{background:`${C.ac}06`,border:`1px solid ${C.ac}33`,borderRadius:12,padding:14,marginBottom:12}}>
          <div style={{...lbl,color:C.ac,marginBottom:12}}>How are you feeling?</div>
          <div style={{marginBottom:10}}>
            <div style={lbl2}>Sleep (hrs)</div>
            <div style={{display:"flex",gap:5,marginTop:5}}>{[4,5,6,7,8,9].map(v=>{const sel=rdForm.sleep_hours===v;return<button key={v} onClick={()=>setRdForm(p=>({...p,sleep_hours:v}))} style={{flex:1,padding:"7px 0",borderRadius:7,border:`1px solid ${sel?`${C.ac}55`:C.bd}`,background:sel?`${C.ac}14`:C.sf2,color:sel?C.ac:C.mt,fontSize:11,fontFamily:mono,fontWeight:sel?600:400,cursor:"pointer"}}>{v}h</button>;})}
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={lbl2}>Energy</div>
            <div style={{display:"flex",gap:5,marginTop:5}}>{[1,2,3,4,5].map(v=>{const sel=rdForm.energy===v;return<button key={v} onClick={()=>setRdForm(p=>({...p,energy:v}))} style={{flex:1,padding:"7px 0",borderRadius:7,border:`1px solid ${sel?`${C.ac}55`:C.bd}`,background:sel?`${C.ac}14`:C.sf2,color:sel?C.ac:C.mt,fontSize:11,fontFamily:mono,fontWeight:sel?600:400,cursor:"pointer"}}>{v}/5</button>;})}
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <div style={lbl2}>Priority muscle soreness</div>
            <div style={{display:"flex",gap:5,marginTop:5}}>{[1,2,3,4,5].map(v=>{const sel=rdForm.soreness_priority===v;const label=v===1?"none":v===5?"high":`${v}/5`;return<button key={v} onClick={()=>setRdForm(p=>({...p,soreness_priority:v}))} style={{flex:1,padding:"7px 0",borderRadius:7,border:`1px solid ${sel?`${C.ac}55`:C.bd}`,background:sel?`${C.ac}14`:C.sf2,color:sel?C.ac:C.mt,fontSize:11,fontFamily:mono,fontWeight:sel?600:400,cursor:"pointer"}}>{label}</button>;})}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowReadiness(false)} style={{...btnGhost,flex:1,textAlign:"center"}}>Skip</button>
            <button disabled={!rdForm.sleep_hours||!rdForm.energy} onClick={async()=>{
              const r=rdForm;
              const score=(r.sleep_hours||7)/8+(r.energy||3)/5+(6-(r.soreness_priority||3))/5;
              const intensity_modifier=score<2?0.85:score<2.5?0.92:1.0;
              const row={session_id:sid,sleep_hours:r.sleep_hours,energy:r.energy,soreness_priority:r.soreness_priority,intensity_modifier};
              try{await supabase.from("session_readiness").insert(row);}catch{}
              setReadiness(row);setShowReadiness(false);
            }} style={{...btnP,flex:2,opacity:(!rdForm.sleep_hours||!rdForm.energy)?0.45:1}}>Save &amp; start</button>
          </div>
        </div>
      )}
      {readiness?.intensity_modifier&&readiness.intensity_modifier<1.0&&(
        <div style={{padding:"8px 12px",marginBottom:12,background:`${C.am}10`,border:`1px solid ${C.am}22`,borderRadius:8,fontSize:11,color:C.am}}>
          Recovery low. Loads suggested at {Math.round(readiness.intensity_modifier*100)}% today.
        </div>
      )}
      {isDeload&&<div style={{padding:10,marginBottom:14,background:`${C.am}14`,border:`1px solid ${C.am}33`,borderRadius:8,fontSize:11,fontWeight:600,color:C.am,letterSpacing:"0.06em"}}>DELOAD WEEK — loads at 60%, sets halved</div>}

      {day.exercises.length===0&&(
        <div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13,background:C.sf2,borderRadius:12,border:`1px solid ${C.bd}`}}>
          No exercises found for {day.name} in {progName}.<br/>
          <span style={{fontSize:11,color:`${C.mt}88`,marginTop:6,display:"block"}}>Check that training_day_exercises rows exist for program_id={activeProgram} in Supabase.</span>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {day.exercises.map((origEx,xi)=>{
          const ex=swapMap[origEx.id]||origEx;
          const es=eff(ex),isE=expEx===xi,dn=done(ex.id,es),all=dn===es,pg=lw[ex.id];
          const rirAdj=pg?.rirAdj;
          const rirBump=!pg?.deload&&rirAdj?.delta===1?(ex.increment||2.5):0;
          const rawWeight=pg?(pg.deload?pg.sw:pg.up?pg.sw:pg.w+rirBump):null;
          const todayWeight=rawWeight&&ex.isCompound&&readiness?.intensity_modifier<1?Math.round(rawWeight*readiness.intensity_modifier/2.5)*2.5:rawWeight;
          const tgtReps=i=>{if(!pg||pg.deload)return null;if(pg.up)return ex.repMin;const l=pg.sets?.[i];if(!l)return null;return l.r>=ex.repMax?ex.repMax:l.r+1;};
          const restFor=restDur||(ex.isCompound?180:90);
          const firstCompound=xi===day.exercises.findIndex(e=>(swapMap[e.id]||e).isCompound);
          const warmups=firstCompound&&todayWeight&&todayWeight>=40&&!isDeload&&done(ex.id,es)===0?[[0.5,8],[0.7,4],[0.85,2]].map(([pct,r])=>({w:Math.max(0,Math.round(todayWeight*pct/(ex.increment||2.5))*(ex.increment||2.5)),r})):null;
          return(
            <div key={ex.id} style={{background:C.sf,borderRadius:12,border:`1px solid ${all?`${C.gn}30`:isE?C.bd2:C.bd}`,overflow:"hidden"}}>
              <button onClick={()=>{setExpEx(isE?-1:xi);setHistory(null);setShowTimer(false);}} style={{width:"100%",padding:"13px 14px",background:"none",border:"none",color:C.tx,cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left"}}>
                <div style={{fontFamily:mono,fontSize:13,fontWeight:700,color:all?C.gn:C.mt,width:22,textAlign:"center",flexShrink:0}}>{all?"✓":xi+1}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ex.name}</div>
                  <div style={{fontSize:11,color:C.mt,marginTop:1}}>{es}×{ex.repMin}–{ex.repMax}{isDeload&&<span style={{fontSize:9,color:C.am}}> (deload)</span>}{todayWeight&&<span style={{color:pg.up?C.gn:pg.deload?C.am:C.mt}}> · {todayWeight}lb</span>}{dn>0&&<span style={{color:all?C.gn:C.am}}> · {dn}/{es}</span>}</div>
                </div>
                {ex.tempo&&<span style={{fontSize:9,fontFamily:mono,fontWeight:700,color:ex.tempo>=3?C.gn:C.mt,background:ex.tempo>=3?`${C.gn}14`:C.sf2,padding:"2px 6px",borderRadius:4,flexShrink:0}}>{ex.tempo}s ↓</span>}
                {!all&&!isDeload&&(rirAdj?.delta===1?<span style={{fontSize:9,fontWeight:700,color:C.gn,background:`${C.gn}14`,padding:"2px 6px",borderRadius:4,flexShrink:0,fontFamily:mono}}>↑ RIR</span>:rirAdj?.delta===-1?<span style={{fontSize:9,fontWeight:700,color:C.am,background:`${C.am}14`,padding:"2px 6px",borderRadius:4,flexShrink:0,fontFamily:mono}}>RIR hold</span>:pg?.up?<span style={{fontSize:9,fontWeight:700,color:C.gn,background:`${C.gn}14`,padding:"2px 6px",borderRadius:4,flexShrink:0}}>↑ LOAD</span>:null)}
                {pg?.deload&&<span style={{fontSize:9,fontWeight:700,color:C.am,background:`${C.am}14`,padding:"2px 6px",borderRadius:4,flexShrink:0}}>60%</span>}
                {!all&&!pg?.deload&&pg?.stall?.stalled&&<span style={{fontSize:9,fontWeight:700,color:C.rd,background:`${C.rd}14`,padding:"2px 6px",borderRadius:4,flexShrink:0,fontFamily:mono}}>STALL</span>}
                <span style={{color:C.mt,transform:isE?"rotate(90deg)":"none",transition:"transform 0.2s",fontSize:18,flexShrink:0,lineHeight:1}}>›</span>
              </button>
              {isE&&(
                <div style={{padding:"0 14px 14px"}}>
                  <div style={{display:"flex",gap:6,marginBottom:10}}>
                    <button onClick={()=>setShowCues(showCues===xi?null:xi)} style={{flex:1,padding:"8px 12px",background:showCues===xi?`${C.ac}12`:"transparent",border:`1px solid ${showCues===xi?`${C.ac}44`:C.bd}`,borderRadius:8,color:showCues===xi?C.ac:C.mt,fontSize:11,cursor:"pointer",textAlign:"left",whiteSpace:showCues===xi?"normal":"nowrap",overflow:showCues===xi?"visible":"hidden",textOverflow:showCues===xi?"clip":"ellipsis",lineHeight:showCues===xi?1.5:"normal",display:"flex",alignItems:"center",gap:5}}>{showCues===xi?(ex.tempo>=3?<><span style={{color:C.mt,fontSize:10}}>Control the stretch — 3s down. </span>{ex.cues}</>:ex.cues):<><span style={{fontSize:10}}>📋</span> View cues</>}</button>
                    {ex.video&&<a href={ex.video} target="_blank" rel="noopener noreferrer" style={{padding:"8px 12px",background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,color:C.ac,fontSize:11,textDecoration:"none",flexShrink:0}}>Watch</a>}
                    <button onClick={()=>history?.exerciseId===ex.id?setHistory(null):loadHistory(ex.id)} style={{padding:"8px 12px",background:C.sf2,border:`1px solid ${history?.exerciseId===ex.id?`${C.ac}44`:C.bd}`,borderRadius:8,color:history?.exerciseId===ex.id?C.ac:C.mt,fontSize:11,cursor:"pointer",flexShrink:0}}>History</button>
                    <button onClick={async()=>{if(swapEx===xi){setSwapEx(null);return;}const cands=await getSwapCandidates(origEx.id);setSwapCandidates(cands);setSwapEx(xi);}} style={{padding:"8px 12px",background:swapEx===xi?`${C.am}14`:C.sf2,border:`1px solid ${swapEx===xi?`${C.am}44`:C.bd}`,borderRadius:8,color:swapEx===xi?C.am:C.mt,fontSize:11,cursor:"pointer",flexShrink:0}}>Swap</button>
                  </div>
                  {swapEx===xi&&(
                    <div style={{background:C.sf2,borderRadius:10,border:`1px solid ${C.bd}`,padding:10,marginBottom:10}}>
                      <div style={{fontSize:11,fontWeight:600,color:C.tx,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>Swap: <span style={{color:C.mt}}>{origEx.name}</span></span>{swapMap[origEx.id]&&<button onClick={()=>{setSwapMap(p=>{const n={...p};delete n[origEx.id];return n;});setSwapEx(null);}} style={{...btnGhost,padding:"3px 8px",fontSize:10}}>Use original</button>}</div>
                      {swapCandidates.length===0&&<div style={{fontSize:11,color:C.mt,textAlign:"center",padding:"10px 0"}}>No alternatives found</div>}
                      {[{tier:"EXACT",label:"Best match"},{tier:"CLOSE",label:"Similar"},{tier:"OK",label:"Same muscle"}].map(({tier,label})=>{
                        const group=swapCandidates.filter(c=>c._tier===tier);
                        if(!group.length)return null;
                        return(<div key={tier} style={{marginBottom:6}}>
                          <div style={{fontSize:9,fontWeight:600,color:C.mt,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>{label}</div>
                          {group.map(c=>{
                            const biasColor=c.length_bias==="lengthened"?C.gn:c.length_bias==="shortened"?C.am:null;
                            const biasLabel=c.length_bias==="lengthened"?"long":c.length_bias==="shortened"?"short":c.length_bias==="mid-range"?"mid":null;
                            return(<button key={c.id} onClick={()=>{setSwapMap(p=>({...p,[origEx.id]:toEx(c,origEx.sets)}));setSwapEx(null);}} style={{width:"100%",display:"flex",alignItems:"center",gap:6,padding:"8px 10px",background:swapMap[origEx.id]?.id===c.id?`${C.ac}12`:C.sf,border:`1px solid ${swapMap[origEx.id]?.id===c.id?`${C.ac}44`:C.bd}`,borderRadius:8,marginBottom:4,cursor:"pointer",textAlign:"left"}}>
                              {c.priority_level==="HIGH"&&<span style={{fontSize:8,color:C.ac,fontWeight:700,flexShrink:0}}>★</span>}
                              <span style={{fontSize:12,color:C.tx,flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</span>
                              {biasLabel&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:biasColor?`${biasColor}14`:C.sf2,color:biasColor||C.mt,fontFamily:mono,flexShrink:0}}>{biasLabel}</span>}
                            </button>);
                          })}
                        </div>);
                      })}
                    </div>
                  )}
                  <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
                    <MuscleDiagram muscle={ex.muscle} color={pg?.up?C.gn:pg?.deload?C.am:C.ac} imageUrl={ex.imageUrl} exerciseName={ex.name}/>
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
                  {showTimer?<Timer key={timerKey} duration={restFor} onDismiss={()=>setShowTimer(false)}/>
                  :<button onClick={startTimer} style={{width:"100%",padding:"9px",marginBottom:10,background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,color:C.mt,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.mt} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    Start rest timer ({Math.floor(restFor/60)}:{String(restFor%60).padStart(2,"0")})
                  </button>}
                  {warmups&&<div style={{fontSize:10,fontFamily:mono,color:C.mt,marginBottom:6,padding:"6px 8px",background:C.sf2,borderRadius:6}}>Warm-up (not logged): <span style={{color:C.tx2}}>{warmups.map(w=>`${w.w}×${w.r}`).join(" · ")}</span></div>}
                  {pg?.sets?.length>0&&!pg.deload&&<div style={{fontSize:10,fontFamily:mono,color:C.mt,marginBottom:6,lineHeight:1.5}}>Last{pg.when?` (${pg.when.slice(5)})`:""}: <span style={{color:C.tx2}}>{pg.sets.map(x=>`${x.w}×${x.r}`).join(" · ")}</span><br/><span style={{color:pg.up?C.gn:C.ac}}>{pg.up?`Top of range hit. ${pg.sw}lb × ${ex.repMin}+ today`:"Beat it: +1 rep per set (grey numbers), same weight"}</span>{pg.stall?.stalled&&<><br/><span style={{color:C.rd}}>No progress in 3 sessions (best e1RM {Math.round(pg.stall.bestRecent)} vs {Math.round(pg.stall.bestPrior)}). {stallTip(ex.isCompound)}</span></>}{pg.stall?.rebuilding&&<><br/><span style={{color:C.am}}>Rebuilding after a break: {Math.round(pg.stall.bestRecent)} vs {Math.round(pg.stall.bestPrior)} e1RM before it. Usually back within a few sessions.</span></>}</div>}
                  <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 32px",gap:4,marginBottom:5}}>{["Set","Weight","Reps",""].map(h=><span key={h} style={hlbl}>{h}</span>)}</div>
                  {Array.from({length:es},(_,i)=>{const sn=i+1,s=gs(ex.id,sn),ok=s.reps>0,hi=s.reps>ex.repMax,lo=s.reps>0&&s.reps<ex.repMin;
                    return(<div key={i} style={{marginBottom:6}}>
                      <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 32px",gap:4,alignItems:"center"}}>
                        <div style={{fontFamily:mono,fontSize:12,fontWeight:600,color:ok?C.gn:C.mt,textAlign:"center"}}>{sn}</div>
                        <div style={{display:"flex",alignItems:"center",gap:3}}>
                          <button onClick={()=>adj(ex.id,sn,"weight",-ex.increment)} style={{...tbtn,flexShrink:0}}>-</button>
                          <input type="number" inputMode="decimal" value={s.weight||""} placeholder={todayWeight?`${todayWeight}`:"lbs"} onChange={e=>ul(ex.id,sn,"weight",e.target.value)} onBlur={()=>sv(ex.id,sn)} style={{...inp,flex:1,minWidth:0,padding:"10px 4px"}}/>
                          <button onClick={()=>adj(ex.id,sn,"weight",ex.increment)} style={{...tbtn,flexShrink:0}}>+</button>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:3}}>
                          <button onClick={()=>adj(ex.id,sn,"reps",-1)} style={{...tbtn,flexShrink:0}}>-</button>
                          <input type="number" inputMode="numeric" value={s.reps||""} placeholder={tgtReps(i)!=null?`${tgtReps(i)}`:`${ex.repMin}-${ex.repMax}`} onChange={e=>ul(ex.id,sn,"reps",e.target.value)} onBlur={()=>sv(ex.id,sn)} style={{...inp,flex:1,minWidth:0,padding:"10px 4px",borderColor:hi?`${C.gn}55`:lo?`${C.rd}55`:C.bd}}/>
                          <button onClick={()=>adj(ex.id,sn,"reps",1)} style={{...tbtn,flexShrink:0}}>+</button>
                        </div>
                        <div style={{fontSize:9,fontFamily:mono,color:hi?C.gn:lo?C.rd:C.mt,textAlign:"center"}}>{hi?"top":lo?"low":ok?"ok":""}</div>
                      </div>
                      {ok&&<div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 32px",gap:4,alignItems:"center",marginTop:4}}>
                        <div/>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:9,color:C.mt,minWidth:24,fontFamily:mono}}>RIR</span>
                          <div style={{display:"flex",gap:4,flex:1}}>
                            {[0,1,2,3].map(v=>{const sel=s.rir===v;const c=v===0?C.rd:v===1?C.am:C.gn;return<button key={v} onClick={()=>{const k=`${ex.id}-${sn}`;setSd(p=>({...p,[k]:{...p[k],rir:v}}));sv(ex.id,sn,{rir:v});}} style={{paddingTop:5,paddingBottom:5,paddingLeft:0,paddingRight:0,flex:1,background:sel?`${c}22`:C.sf2,border:`1px solid ${sel?c+"55":C.bd}`,borderRadius:5,fontSize:10,fontFamily:mono,fontWeight:600,color:sel?c:C.mt,cursor:"pointer"}}>{v}</button>;})}
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:9,color:C.mt,minWidth:28,fontFamily:mono}}>MMC</span>
                          <div style={{display:"flex",gap:4,flex:1}}>
                            {[1,2,3].map(v=>{const sel=s.mmc===v;const disp=v===1?"·":v===2?"··":"●";return<button key={v} onClick={()=>{const k=`${ex.id}-${sn}`;setSd(p=>({...p,[k]:{...p[k],mmc:v}}));sv(ex.id,sn,{mmc:v});}} style={{paddingTop:5,paddingBottom:5,paddingLeft:0,paddingRight:0,flex:1,background:sel?`${C.ac}14`:C.sf2,border:`1px solid ${sel?C.ac+"44":C.bd}`,borderRadius:5,fontSize:10,fontFamily:mono,fontWeight:600,color:sel?C.ac:C.mt,cursor:"pointer"}}>{disp}</button>;})}
                          </div>
                        </div>
                        <div/>
                      </div>}
                    </div>);
                  })}
                  {xi<day.exercises.length-1&&<button onClick={()=>{setExpEx(xi+1);setShowTimer(false);setHistory(null);}} style={{...btnP,marginTop:6,fontSize:13}}>Next exercise →</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {prState&&(
        <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",maxWidth:320,width:"calc(100% - 32px)",background:`${C.gn}22`,border:`1px solid ${C.gn}55`,borderRadius:10,padding:"12px 16px",zIndex:100,animation:"prIn 0.2s ease",pointerEvents:"none"}}>
          <style>{`@keyframes prIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
          <div style={{fontSize:12,fontWeight:700,color:C.gn,textAlign:"center"}}>🏆 New PR — {prState.weight}×{prState.reps}{prState.exerciseName?` · ${prState.exerciseName}`:""}</div>
          <div style={{fontSize:10,color:`${C.gn}cc`,textAlign:"center",marginTop:3}}>e1RM {Math.round(prState.e1RM)} lb</div>
        </div>
      )}
    </div>
  );
}

function Fuel({foods,setFoods,mt,setMt,meas=[],online,onPC}){
  const[log,setLog]=useState([]);const[search,setSearch]=useState("");const[showS,setShowS]=useState(false);const[cat,setCat]=useState("All");const[showCalc,setShowCalc]=useState(false);const[showAdd,setShowAdd]=useState(false);const[showRecent,setShowRecent]=useState(false);const savedMt=cache.get("mt");
  const training=isTodayTraining();
  const activeMt=training?mt:{...mt,carbs:mt.restCarbs||Math.max(0,mt.carbs-100),calories:mt.restCalories||Math.max(1500,mt.calories-400)};
  const latMeas=meas.length>0?meas[meas.length-1]:null;
  const latBW=latMeas?.bodyweight_lb||savedMt?.bw||205;
  const latBF=latMeas?.body_fat_pct||(latMeas?.waist_in&&latMeas?.neck_in&&latMeas?.height_in?navyBF(latMeas.waist_in,latMeas.neck_in,latMeas.height_in):null)||19.5;
  const[calcW,setCalcW]=useState(String(latBW));const[calcH,setCalcH]=useState(String(latMeas?.height_in||71));const[calcAge,setCalcAge]=useState("30");const[calcBF,setCalcBF]=useState(String(parseFloat(latBF).toFixed(1)));const[calcAct,setCalcAct]=useState("Active");const[calcG,setCalcG]=useState(mt.goalName||savedMt?.goalName||"Maintain");const[calcP,setCalcP]=useState("1.18");const[calcF,setCalcF]=useState("0.37");const[calcRC,setCalcRC]=useState(String(mt.restCarbs||Math.max(0,mt.carbs-100)));const[useEmpirical,setUseEmpirical]=useState(true);const[empiricalMaint,setEmpiricalMaint]=useState(String(cache.get("empiricalMaint")||"3100"));const[nf,setNf]=useState({name:"",portion_size:"",portion_unit:"",protein_g:"",carbs_g:"",fat_g:"",calories:"",category:"Protein"});const[recentFoods,setRecentFoods]=useState([]);const[td]=useState(localDate());
  const[showAI,setShowAI]=useState(false);const[aiText,setAiText]=useState("");const[aiImg,setAiImg]=useState(null);const[aiImgMime,setAiImgMime]=useState("image/jpeg");const[aiLoading,setAiLoading]=useState(false);const[aiResult,setAiResult]=useState(null);const[aiError,setAiError]=useState(null);const aiFileRef=useRef(null);const[showScan,setShowScan]=useState(false);const[scanStatus,setScanStatus]=useState("Point camera at barcode");const scanRef=useRef(null);const streamRef=useRef(null);const scanLockRef=useRef(false);
  const[saveErr,setSaveErr]=useState(null);
  const[maintEst,setMaintEst]=useState(null);
  useEffect(()=>{if(!showCalc)return;let live=true;estimateMaintenance(meas).then(r=>{if(live)setMaintEst(r);}).catch(()=>{if(live)setMaintEst({ready:false,reason:"Offline"});});return()=>{live=false;};},[showCalc,meas]);
  const[showPlan,setShowPlan]=useState(false);
  const[plan,setPlan]=useState(null);
  const[planLoading,setPlanLoading]=useState(false);
  const[planError,setPlanError]=useState(null);
  async function generatePlan(){setPlanLoading(true);setPlanError(null);setPlan(null);try{const res=await fetch("/api/meal-plan",{method:"POST",headers:{"Content-Type":"application/json",...(await authHeaders())},body:JSON.stringify({foods:foods.filter(f=>f.calories>0).map(f=>({name:f.name.replace(/[^\x20-\x7E]/g,'').replace(/"/g,"'").trim(),portion_size:f.portion_size,portion_unit:f.portion_unit,protein_g:f.protein_g,carbs_g:f.carbs_g,fat_g:f.fat_g,calories:f.calories,category:f.category})),targets:{protein:activeMt.protein,carbs:activeMt.carbs,fat:activeMt.fat,calories:activeMt.calories,goal:mt.goalName||"Maintain"}})});const data=await res.json();if(data.error)throw new Error(data.detail?`${data.error}: ${data.detail}`:data.error);const slots=["breakfast","lunch","dinner","snacks"];slots.forEach(slot=>{if(!Array.isArray(data[slot]))data[slot]=[];});setPlan(data);}catch(err){setPlanError(err.message||"Failed to generate plan");}finally{setPlanLoading(false);}}
  function planTotal(){if(!plan)return{protein:0,carbs:0,fat:0,calories:0};const all=[...plan.breakfast,...plan.lunch,...plan.dinner,...plan.snacks];return all.reduce((a,m)=>({protein:a.protein+(m.protein_g||0)*(m.portions||1),carbs:a.carbs+(m.carbs_g||0)*(m.portions||1),fat:a.fat+(m.fat_g||0)*(m.portions||1),calories:a.calories+(m.calories||0)*(m.portions||1)}),{protein:0,carbs:0,fat:0,calories:0});}
  async function logPlanToday(){if(!plan)return;const all=[...plan.breakfast,...plan.lunch,...plan.dinner,...plan.snacks];for(const f of all){if(!f.id)continue;const entry={id:`t_${Date.now()}_${f.id}`,food:f.name,portions:f.portions||1,protein:f.protein_g,carbs:f.carbs_g,fat:f.fat_g,calories:f.calories,foodId:f.id};setLog(p=>{const n=[...p,entry];cache.set(`meals_${td}`,n);return n;});try{const{error}=await supabase.from("meal_log").insert({log_date:td,food_id:f.id,portions:f.portions||1});if(error)throw error;}catch{addPending({type:"insert_meal",date:td,foodId:f.id,portions:f.portions||1});onPC();}}setShowPlan(false);setPlan(null);}
  useEffect(()=>{loadLog();loadRecent();},[]);
  async function loadLog(){try{const{data,error}=await net(supabase.from("meal_log").select("*,foods(*)").eq("log_date",td).order("created_at"));if(error)throw error;if(data){const l=data.map(m=>({id:m.id,food:m.foods?.name||"?",portions:parseFloat(m.portions),protein:m.foods?.protein_g||0,carbs:m.foods?.carbs_g||0,fat:m.foods?.fat_g||0,calories:m.foods?.calories||0,foodId:m.food_id}));setLog(l);cache.set(`meals_${td}`,l);}}catch{const c=cache.get(`meals_${td}`);if(c)setLog(c);}}
  async function loadRecent(){try{const y=new Date();y.setDate(y.getDate()-1);const yesterday=`${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,"0")}-${String(y.getDate()).padStart(2,"0")}`;const{data,error}=await net(supabase.from("meal_log").select("food_id,portions,foods(*)").gte("log_date",yesterday).order("created_at",{ascending:false}).limit(20));if(error)throw error;if(data){const seen=new Set();const unique=[];data.forEach(m=>{if(m.foods&&!seen.has(m.food_id)){seen.add(m.food_id);unique.push({...m.foods,lastPortions:parseFloat(m.portions)});}});setRecentFoods(unique);cache.set("recent_foods",unique);}}catch{const c=cache.get("recent_foods");if(c)setRecentFoods(c);}}
  async function add(f,portions=1){const entry={id:`t_${Date.now()}`,food:f.name,portions,protein:f.protein_g,carbs:f.carbs_g,fat:f.fat_g,calories:f.calories,foodId:f.id};setLog(p=>{const n=[...p,entry];cache.set(`meals_${td}`,n);return n;});try{const{data:ins,error}=await supabase.from("meal_log").insert({log_date:td,food_id:f.id,portions}).select().single();if(error)throw error;if(ins)setLog(p=>p.map(m=>m.id===entry.id?{...m,id:ins.id}:m));}catch{addPending({type:"insert_meal",date:td,foodId:f.id,portions});onPC();}setShowS(false);setShowRecent(false);setSearch("");}
  async function rm(i){const e=log[i];setLog(p=>{const n=p.filter((_,x)=>x!==i);cache.set(`meals_${td}`,n);return n;});if(e?.id&&!String(e.id).startsWith("t")){try{const{error}=await supabase.from("meal_log").delete().eq("id",e.id);if(error)throw error;}catch{addPending({type:"delete_meal",id:e.id});onPC();}}}
  async function up(i,pt){const np=Math.max(0.25,pt);setLog(p=>{const n=p.map((m,x)=>x===i?{...m,portions:np}:m);cache.set(`meals_${td}`,n);return n;});const e=log[i];if(e?.id&&!String(e.id).startsWith("t")){try{const{error}=await supabase.from("meal_log").update({portions:np}).eq("id",e.id);if(error)throw error;}catch{addPending({type:"update_portions",id:e.id,portions:np});onPC();}}}
  async function saveNewFood(){if(!nf.name||!nf.calories)return;const entry={name:nf.name,portion_size:parseFloat(nf.portion_size)||1,portion_unit:nf.portion_unit||"serving",protein_g:parseFloat(nf.protein_g)||0,carbs_g:parseFloat(nf.carbs_g)||0,fat_g:parseFloat(nf.fat_g)||0,calories:parseFloat(nf.calories)||0,category:nf.category};try{const{data,error}=await supabase.from("foods").insert(entry).select().single();if(error)throw error;if(data)setFoods(p=>[...p,data].sort((a,b)=>a.name.localeCompare(b.name)));}catch{addPending({type:"insert_food",data:entry});onPC();setFoods(p=>[...p,{...entry,id:`t_${Date.now()}`}].sort((a,b)=>a.name.localeCompare(b.name)));}setNf({name:"",portion_size:"",portion_unit:"",protein_g:"",carbs_g:"",fat_g:"",calories:"",category:"Protein"});setShowAdd(false);}
  const tot=log.reduce((a,m)=>({protein:a.protein+(m.protein||0)*m.portions,carbs:a.carbs+(m.carbs||0)*m.portions,fat:a.fat+(m.fat||0)*m.portions,calories:a.calories+(m.calories||0)*m.portions}),{protein:0,carbs:0,fat:0,calories:0});
  const flt=foods.filter(f=>f.category!=="One-off"&&f.name.toLowerCase().includes(search.toLowerCase())&&(cat==="All"||f.category===cat));
  function getSuggested(){const remPro=Math.max(0,mt.protein-Math.round(tot.protein));const remCal=Math.max(0,mt.calories-Math.round(tot.calories));const remFat=Math.max(0,mt.fat-Math.round(tot.fat));if(remPro<10||foods.length===0)return[];const loggedIds=new Set(log.map(m=>m.foodId).filter(Boolean));const proRatio=remPro*4/Math.max(remCal,1);const seed=Math.floor(Date.now()/3600000);return foods.filter(f => f.protein_g > 0 && f.calories >= 30 && !loggedIds.has(f.id) && !['Meal','Fast Food','Misc','Treat','Deli','One-off'].includes(f.category)).map((f,i)=>{const lean=f.protein_g*4/(f.calories||1);const calFit=1-Math.min(1,Math.abs(f.calories-remCal*0.3)/500);const fatPenalty=remFat<20&&f.fat_g>10?-0.5:0;const variety=Math.sin(seed+i*137.5)*0.15;return{...f,score:lean*proRatio*60+calFit*20+fatPenalty+variety};}).sort((a,b)=>b.score-a.score).slice(0,3);}
  const suggested=getSuggested();
  const remPro=Math.max(0,mt.protein-Math.round(tot.protein));
  const remCal=Math.max(0,mt.calories-Math.round(tot.calories));
  async function recalc(){const w=parseFloat(calcW)||205,h=parseFloat(calcH)||71,age=parseFloat(calcAge)||30;const bf=parseFloat(calcBF)||20;const leanMass=w*(1-bf/100);const act=ACTIVITY.find(a=>a.name===calcAct)||ACTIVITY[2];const goal=GOALS.find(g=>g.name===calcG)||GOALS[1];const tdee=useEmpirical?parseFloat(empiricalMaint)||3100:calcTDEE(w,h,age,act.mult);const cal=Math.round(tdee+goal.delta);const protein=Math.round(leanMass*(parseFloat(calcP)||1.18));const fat=Math.max(70,Math.round(leanMass*(parseFloat(calcF)||0.37)));const carbs=Math.max(0,Math.round((cal-protein*4-fat*9)/4));const rc=parseInt(calcRC)||Math.max(0,carbs-100);const rcal=Math.round(cal-Math.max(0,carbs-rc)*4);setMt({protein,carbs,fat,calories:cal,goalName:calcG,bw:w,restCarbs:rc,restCalories:rcal});cache.set("mt",{protein,carbs,fat,calories:cal,goalName:calcG,bw:w,restCarbs:rc,restCalories:rcal});if(useEmpirical)cache.set("empiricalMaint",empiricalMaint);setShowCalc(false);try{const row={protein_g_target:protein,carbs_g_target:carbs,fat_g_target:fat,calories_target:cal,bodyweight_lb:w,goal_name:calcG,protein_per_lb:parseFloat(calcP)||null,fat_per_lb:parseFloat(calcF)||null,rest_carbs_g:rc,rest_calories:rcal};const{data:upd,error}=await supabase.from("macro_targets").update(row).eq("is_active",true).select("id");if(error)throw error;if(!upd?.length){const{error:ie}=await supabase.from("macro_targets").insert({...row,is_active:true,activity_factor:null});if(ie)throw ie;}setSaveErr(null);}catch(e){console.error("macro target save failed",e);setSaveErr("Targets saved on this phone only. The database save failed, so another device (or a reload) may show the old targets. Try Set as targets again when you have signal.");}}
  function previewMacros(overrideGoal){const w=parseFloat(calcW)||205,h=parseFloat(calcH)||71,age=parseFloat(calcAge)||30;const bf=parseFloat(calcBF)||20;const leanMass=w*(1-bf/100);const act=ACTIVITY.find(a=>a.name===calcAct)||ACTIVITY[2];const goal=GOALS.find(g=>g.name===(overrideGoal||calcG))||GOALS[1];const tdee=useEmpirical?parseFloat(empiricalMaint)||3100:calcTDEE(w,h,age,act.mult);const cal=Math.round(tdee+goal.delta);const protein=Math.round(leanMass*(parseFloat(calcP)||1.18));const fat=Math.max(70,Math.round(leanMass*(parseFloat(calcF)||0.37)));const carbs=Math.max(0,Math.round((cal-protein*4-fat*9)/4));return{protein,carbs,fat,calories:cal,tdee,leanMass:Math.round(leanMass)};}
  async function startScan(){scanLockRef.current=false;setShowScan(true);setShowAI(false);setAiResult(null);setScanStatus("Starting camera...");try{const ZXing=await import("https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/+esm");const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});streamRef.current=stream;if(scanRef.current){scanRef.current.srcObject=stream;scanRef.current.play();}setScanStatus("Point camera at barcode");const reader=new ZXing.BrowserMultiFormatReader();reader.decodeFromStream(stream,scanRef.current,async(result,err)=>{if(!result||scanLockRef.current)return;scanLockRef.current=true;const barcode=result.getText();if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}setScanStatus("Looking up product...");try{const res=await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);const data=await res.json();if(data.status===1&&data.product){const p=data.product;const n=p.nutriments;const hasServingData=n.proteins_serving!=null||n["energy-kcal_serving"]!=null;const servingQty=parseFloat(p.serving_quantity)||0;const servingSize=p.serving_size||"serving";let protein,carbs,fat,calories;if(hasServingData){protein=parseFloat(n.proteins_serving||0);carbs=parseFloat(n.carbohydrates_serving||0);fat=parseFloat(n.fat_serving||0);calories=parseFloat(n["energy-kcal_serving"]||0);}else if(servingQty>0){const scale=servingQty/100;protein=parseFloat(n.proteins||0)*scale;carbs=parseFloat(n.carbohydrates||0)*scale;fat=parseFloat(n.fat||0)*scale;calories=parseFloat(n["energy-kcal"]||0)*scale;}else{protein=parseFloat(n.proteins||0);carbs=parseFloat(n.carbohydrates||0);fat=parseFloat(n.fat||0);calories=parseFloat(n["energy-kcal"]||0);}setAiResult({name:p.product_name||p.generic_name||"Scanned food",portion_size:servingQty||100,portion_unit:servingSize,protein_g:Math.round(protein*10)/10,carbs_g:Math.round(carbs*10)/10,fat_g:Math.round(fat*10)/10,calories:Math.round(calories),notes:hasServingData?"From barcode scan":servingQty>0?"Scaled to serving size":"Per 100g — check serving size"});setShowScan(false);setShowAI(true);setScanStatus("Point camera at barcode");}else{setScanStatus("Product not found — try AI Log instead");setTimeout(()=>{setShowScan(false);scanLockRef.current=false;},2500);}}catch{setScanStatus("Lookup failed — try AI Log instead");setTimeout(()=>{setShowScan(false);scanLockRef.current=false;},2500);}});}catch(e){setScanStatus(`Camera error: ${e.message}`);setTimeout(()=>setShowScan(false),2500);}}
  function stopScan(){scanLockRef.current=false;if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}setShowScan(false);}
  function handleAIPhoto(e){const file=e.target.files?.[0];if(!file)return;setAiImgMime(file.type||"image/jpeg");const reader=new FileReader();reader.onload=ev=>{const b64=ev.target.result.split(",")[1];setAiImg(b64);};reader.readAsDataURL(file);}
  async function runAIParse(){if(!aiText&&!aiImg)return;setAiLoading(true);setAiError(null);setAiResult(null);try{const res=await fetch("/api/ai-parse",{method:"POST",headers:{"Content-Type":"application/json",...(await authHeaders())},body:JSON.stringify({text:aiText||undefined,imageBase64:aiImg||undefined,mimeType:aiImgMime})});const data=await res.json();if(data.error)throw new Error(data.detail?`${data.error}: ${data.detail}`:data.error);setAiResult({...data,protein_g:parseFloat(data.protein_g)||0,carbs_g:parseFloat(data.carbs_g)||0,fat_g:parseFloat(data.fat_g)||0,calories:parseFloat(data.calories)||0,portion_size:parseFloat(data.portion_size)||1});}catch(err){setAiError(err.message||"Something went wrong");}finally{setAiLoading(false);}}
  // "Log only" still needs a foods row so the meal_log entry survives reloads and other devices;
  // it is stored as category "One-off" and hidden from search and suggestions.
  async function logAIResult(saveToDb){if(!aiResult)return;{const entry={name:aiResult.name,portion_size:aiResult.portion_size,portion_unit:aiResult.portion_unit||"serving",protein_g:aiResult.protein_g,carbs_g:aiResult.carbs_g,fat_g:aiResult.fat_g,calories:aiResult.calories,category:saveToDb?"Meal":"One-off"};try{const{data,error}=await supabase.from("foods").insert(entry).select().single();if(error)throw error;if(data){if(saveToDb)setFoods(p=>[...p,data].sort((a,b)=>a.name.localeCompare(b.name)));await add(data,1);setShowAI(false);setAiText("");setAiImg(null);setAiResult(null);return;}}catch{}}const entry={id:`t_${Date.now()}`,food:aiResult.name,portions:1,protein:aiResult.protein_g,carbs:aiResult.carbs_g,fat:aiResult.fat_g,calories:aiResult.calories,foodId:null};setLog(p=>{const n=[...p,entry];cache.set(`meals_${td}`,n);return n;});setShowAI(false);setAiText("");setAiImg(null);setAiResult(null);}

  return(
    <div style={{padding:"24px 16px"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
        <div><div style={{fontSize:20,fontWeight:700}}>Fuel</div><div style={{fontSize:11,color:C.mt,marginTop:1}}>{activeMt.calories} cal · {training?"Training day":"Rest day"}{mt.goalName?` · ${mt.goalName}`:""}</div></div>
        <button onClick={()=>setShowCalc(!showCalc)} style={{...btnGhost,color:showCalc?C.ac:C.mt,borderColor:showCalc?`${C.ac}44`:C.bd,marginTop:2}}>Calculator</button>
      </div>
      {mt.noTargets&&!showCalc&&<button onClick={()=>setShowCalc(true)} style={{...btnS,marginBottom:12,textAlign:"left",padding:"10px 12px",fontSize:12}}>These are placeholder targets. Tap to open the Calculator and set yours.</button>}
      {saveErr&&<div style={{padding:"8px 12px",marginBottom:12,background:`${C.rd}10`,border:`1px solid ${C.rd}33`,borderRadius:8,fontSize:11,color:C.rd}}>{saveErr}</div>}
      {showCalc&&(()=>{const prev=previewMacros();return(<div style={{...card,marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}><div><div style={{...lbl2,marginBottom:4}}>Weight (lb)</div><input type="number" value={calcW} onChange={e=>setCalcW(e.target.value)} style={{...inp,fontSize:13}}/></div><div><div style={{...lbl2,marginBottom:4}}>Height (in)</div><input type="number" value={calcH} onChange={e=>setCalcH(e.target.value)} style={{...inp,fontSize:13}}/></div><div><div style={{...lbl2,marginBottom:4}}>Age</div><input type="number" value={calcAge} onChange={e=>setCalcAge(e.target.value)} style={{...inp,fontSize:13}}/></div><div><div style={{...lbl2,marginBottom:4}}>Body Fat %</div><input type="number" value={calcBF} onChange={e=>setCalcBF(e.target.value)} style={{...inp,fontSize:13}}/></div></div>
        <div style={{padding:"7px 12px",background:`${C.gn}10`,borderRadius:8,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:11,color:C.mt}}>Lean mass (protein anchor)</span><span style={{fontFamily:mono,fontSize:13,fontWeight:700,color:C.gn}}>{prev.leanMass} lb</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}><div><div style={{...lbl2,marginBottom:4}}>Protein / lean lb</div><input type="number" value={calcP} onChange={e=>setCalcP(e.target.value)} style={{...inp,fontSize:13}}/></div><div><div style={{...lbl2,marginBottom:4}}>Fat / lean lb</div><input type="number" value={calcF} onChange={e=>setCalcF(e.target.value)} style={{...inp,fontSize:13}}/></div></div>
        <div style={{...lbl2,marginBottom:6}}>Maintenance calories</div>
        {maintEst&&(maintEst.ready?<div style={{padding:"8px 12px",background:`${C.ac}0d`,border:`1px solid ${C.ac}33`,borderRadius:8,marginBottom:10,display:"flex",alignItems:"center",gap:10}}><div style={{flex:1}}><div style={{fontSize:13,fontFamily:mono,fontWeight:700,color:C.ac}}>{maintEst.maint} cal</div><div style={{fontSize:10,color:C.mt,marginTop:2}}>From your last 4 weeks: {maintEst.avgIn} cal/day eaten across {maintEst.days} fully logged days, weight {maintEst.rate>=0?"+":""}{maintEst.rate.toFixed(2)} lb/wk ({maintEst.weighIns} weigh-ins)</div></div><button onClick={()=>{setUseEmpirical(true);setEmpiricalMaint(String(maintEst.maint));}} style={{...btnGhost,padding:"6px 10px",fontSize:11,color:C.ac,borderColor:`${C.ac}44`,flexShrink:0}}>Use</button></div>:<div style={{fontSize:10,color:C.mt,marginBottom:10}}>Estimated maintenance from your own logs: not enough data yet. {maintEst.reason}.</div>)}
        <div style={{display:"flex",gap:6,marginBottom:10}}><button onClick={()=>setUseEmpirical(false)} style={{flex:1,padding:"7px",borderRadius:8,border:`1px solid ${!useEmpirical?C.ac:C.bd}`,background:!useEmpirical?`${C.ac}15`:"transparent",color:!useEmpirical?C.ac:C.mt,fontSize:11,fontWeight:!useEmpirical?600:400,cursor:"pointer"}}>Calculate (formula)</button><button onClick={()=>setUseEmpirical(true)} style={{flex:1,padding:"7px",borderRadius:8,border:`1px solid ${useEmpirical?C.ac:C.bd}`,background:useEmpirical?`${C.ac}15`:"transparent",color:useEmpirical?C.ac:C.mt,fontSize:11,fontWeight:useEmpirical?600:400,cursor:"pointer"}}>Real world (what I eat)</button></div>
        {useEmpirical?(<div style={{marginBottom:12}}><div style={{...lbl2,marginBottom:4}}>Calories currently maintaining on</div><input type="number" value={empiricalMaint} onChange={e=>setEmpiricalMaint(e.target.value)} style={{...inp,fontSize:16}}/><div style={{fontSize:10,color:C.mt,marginTop:5}}>Based on your actual weight trend — more accurate than any formula</div></div>):(<div style={{marginBottom:12}}><div style={{...lbl2,marginBottom:6}}>Activity level</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{ACTIVITY.map(a=><button key={a.name} onClick={()=>setCalcAct(a.name)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${calcAct===a.name?C.ac:C.bd}`,background:calcAct===a.name?`${C.ac}15`:"transparent",color:calcAct===a.name?C.ac:C.mt,fontSize:11,fontWeight:calcAct===a.name?600:400,cursor:"pointer"}}>{a.name}<span style={{fontSize:9,color:C.mt,display:"block"}}>{a.label}</span></button>)}</div></div>)}
        <div style={{padding:"8px 12px",background:C.sf2,borderRadius:8,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:11,color:C.mt}}>{useEmpirical?"Your maintenance":"Calculated TDEE"}</span><span style={{fontFamily:mono,fontSize:14,fontWeight:700,color:C.tx}}>{prev.tdee} cal</span></div>
        <div style={{...lbl2,marginBottom:6}}>Goal</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>{GOALS.map(g=>{const p=previewMacros(g.name);return(<button key={g.name} onClick={()=>setCalcG(g.name)} style={{flex:1,padding:"8px 6px",borderRadius:8,border:`1px solid ${calcG===g.name?C.ac:C.bd}`,background:calcG===g.name?`${C.ac}15`:"transparent",cursor:"pointer",textAlign:"center"}}><div style={{fontSize:12,fontWeight:calcG===g.name?700:400,color:calcG===g.name?C.ac:C.mt}}>{g.name}</div><div style={{fontSize:10,fontFamily:mono,color:calcG===g.name?C.ac:C.mt,marginTop:2}}>{p.calories} cal</div></button>);})}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:12}}>{[{l:"Protein",v:prev.protein,u:"g",c:C.gn},{l:"Carbs",v:prev.carbs,u:"g",c:C.bl},{l:"Fat",v:prev.fat,u:"g",c:C.am},{l:"Calories",v:prev.calories,u:"",c:C.ac}].map(m=>(<div key={m.l} style={{background:C.sf2,borderRadius:8,padding:"8px 4px",textAlign:"center"}}><div style={{fontSize:16,fontWeight:700,fontFamily:mono,color:m.c}}>{m.v}</div><div style={{fontSize:8,color:C.mt,marginTop:2}}>{m.l}</div></div>))}</div>
        <div style={{marginBottom:12}}>
          <div style={{...hlbl,marginBottom:6}}>Rest day carbs</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <input type="number" value={calcRC} onChange={e=>setCalcRC(e.target.value)} style={{...inp,flex:1,fontSize:14}}/>
            <div style={{fontSize:11,color:C.mt,flexShrink:0}}>vs {prev.carbs}g training</div>
          </div>
          <div style={{fontSize:10,color:C.mt,marginTop:4}}>Rest day calories auto-adjust: ~{Math.round(prev.calories-Math.max(0,prev.carbs-(parseInt(calcRC)||prev.carbs-100))*4)} cal</div>
        </div>
        <button onClick={recalc} style={btnP}>Set as targets</button>
      </div>);})()}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>{[{l:"Pro",v:Math.round(tot.protein),t:activeMt.protein,u:"g",c:C.gn},{l:"Carb",v:Math.round(tot.carbs),t:activeMt.carbs,u:"g",c:C.bl},{l:"Fat",v:Math.round(tot.fat),t:activeMt.fat,u:"g",c:C.am},{l:"Cal",v:Math.round(tot.calories),t:activeMt.calories,u:"",c:C.ac}].map(m=>{const p=Math.round((m.v/m.t)*100);return(<div key={m.l} style={{background:C.sf,borderRadius:10,padding:"12px 6px",textAlign:"center",border:`1px solid ${C.bd}`}}><div style={{fontSize:20,fontWeight:700,fontFamily:mono,color:p>100?C.rd:m.c,lineHeight:1}}>{m.v}</div><div style={{fontSize:9,color:C.mt,marginTop:3}}>/{m.t}{m.u}</div><div style={{width:"100%",height:4,background:C.bd,borderRadius:2,marginTop:6,overflow:"hidden"}}><div style={{width:`${Math.min(p,100)}%`,height:"100%",background:m.c,borderRadius:2}}/></div><div style={{...hlbl,marginTop:5}}>{m.l}</div></div>);})}</div>
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

function Body({mt,meas,onAdd,online,onPC}){
  const wt=useMemo(()=>weightTrend(meas),[meas]);
  const[showF,setShowF]=useState(false);
  const fields=[{k:"measure_date",l:"Date",t:"date"},{k:"bodyweight_lb",l:"Weight (lb)",t:"number"},{k:"chest_in",l:"Chest",t:"number"},{k:"waist_in",l:"Waist *",t:"number"},{k:"hips_in",l:"Hips",t:"number"},{k:"r_arm_in",l:"R Arm",t:"number"},{k:"l_arm_in",l:"L Arm",t:"number"},{k:"r_forearm_in",l:"R Forearm",t:"number"},{k:"l_forearm_in",l:"L Forearm",t:"number"},{k:"shoulder_circ_in",l:"Shoulders",t:"number"},{k:"thigh_in",l:"Thigh",t:"number"},{k:"calf_in",l:"Calf",t:"number"},{k:"neck_in",l:"Neck *",t:"number"}];
  const init={};fields.forEach(f=>init[f.k]=f.k==="measure_date"?localDate():"");
  const[fm,setFm]=useState(init);
  async function save(){if(!fm.bodyweight_lb)return;const e={};Object.entries(fm).forEach(([k,v])=>{e[k]=k==="measure_date"?v:(parseFloat(v)||null);});const lat=meas[meas.length-1];const h=lat?.height_in||70;if(e.waist_in&&e.neck_in)e.body_fat_pct=parseFloat(navyBF(e.waist_in,e.neck_in,h));e.height_in=h;try{const{data,error}=await supabase.from("measurements").insert(e).select().single();if(error)throw error;if(data){onAdd(data);setShowF(false);}}catch{onAdd({...e,id:`t_${Date.now()}`});addPending({type:"insert_measurement",data:e});onPC();setShowF(false);}}
  const lat=meas[meas.length-1];const prev=meas.length>1?meas[meas.length-2]:null;
  function delta(c,p){if(!c||!p)return null;const d=(c-p).toFixed(1);return parseFloat(d)>0?`+${d}`:d;}
  const latBF=lat?.body_fat_pct||(lat?.waist_in&&lat?.neck_in&&lat?.height_in?navyBF(lat.waist_in,lat.neck_in,lat.height_in):null);
  const wtDelta=delta(lat?.bodyweight_lb,prev?.bodyweight_lb);
  const bfDelta=lat&&prev?(()=>{const lbf=lat.body_fat_pct||(lat.waist_in&&lat.neck_in&&lat.height_in?navyBF(lat.waist_in,lat.neck_in,lat.height_in):null);const pbf=prev.body_fat_pct||(prev.waist_in&&prev.neck_in&&prev.height_in?navyBF(prev.waist_in,prev.neck_in,prev.height_in):null);return delta(parseFloat(lbf),parseFloat(pbf));})():null;
  return(
    <div style={{padding:"20px 16px"}}>
      <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Body</div>
      <WeightTrendCard wt={wt} goal={mt?.goalName||"Maintain"}/>
      <VTaperCard meas={meas}/>
      <ProgressPhotos latestBW={wt?.last?.w||null}/>
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

// Shoulder circumference / waist: one number that only improves if delts and lats
// grow or the waist comes down. Tracked over time, not judged against an "ideal".
function VTaperCard({meas}){
  const pts=(meas||[]).filter(m=>parseFloat(m.shoulder_circ_in)>0&&parseFloat(m.waist_in)>0).map((m,i)=>({x:i+1,y:Math.round(parseFloat(m.shoulder_circ_in)/parseFloat(m.waist_in)*1000)/1000,label:m.measure_date?.slice(5)}));
  if(!pts.length)return null;
  const last=pts[pts.length-1],first=pts[0],d=last.y-first.y;
  return(
    <div style={{...card,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
        <span style={{...lbl,color:C.ac}}>V-taper</span>
        <span style={{fontSize:10,color:C.mt}}>shoulders ÷ waist</span>
      </div>
      <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:pts.length>1?6:0}}>
        <span style={{fontSize:24,fontWeight:800,fontFamily:mono}}>{last.y.toFixed(3)}</span>
        {pts.length>1&&<span style={{fontSize:12,fontFamily:mono,color:d>=0?C.gn:C.rd}}>{d>=0?"+":""}{d.toFixed(3)} since {first.label}</span>}
      </div>
      {pts.length>1&&<LineChart points={pts} color={C.ac} height={70}/>}
      <div style={{fontSize:9,color:C.mt,marginTop:4}}>From Shoulders and Waist in your measurements. Goes up when delts and lats grow or the waist drops.</div>
    </div>
  );
}

// Private progress photos: Supabase Storage bucket progress-photos/<user id>/..., rows in
// public.progress_photos. Images are resized on the phone (max 1280px JPEG) before upload.
const POSES=["front","side","back"];
async function shrinkImage(file,max=1280,q=0.82){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url;});
    const sc=Math.min(1,max/Math.max(img.width,img.height));const cv=document.createElement("canvas");cv.width=Math.round(img.width*sc);cv.height=Math.round(img.height*sc);
    cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
    return await new Promise(res=>cv.toBlob(b=>res(b),"image/jpeg",q));
  }finally{URL.revokeObjectURL(url);}
}
function ProgressPhotos({latestBW}){
  const[rows,setRows]=useState(null);const[urls,setUrls]=useState({});
  const[pose,setPose]=useState("front");const[date,setDate]=useState(localDate());
  const[busy,setBusy]=useState(false);const[err,setErr]=useState(null);
  const[cmp,setCmp]=useState({pose:"front",a:null,b:null});const[delId,setDelId]=useState(null);
  const fileRef=useRef(null);
  async function load(){
    try{
      const{data,error}=await supabase.from("progress_photos").select("*").order("taken_on",{ascending:true}).order("id");if(error)throw error;
      setRows(data||[]);
      const paths=(data||[]).map(r=>r.path);
      if(paths.length){const{data:signed}=await supabase.storage.from("progress-photos").createSignedUrls(paths,3600);const m={};(signed||[]).forEach(x=>{if(x.signedUrl)m[x.path]=x.signedUrl;});setUrls(m);}
    }catch(e){setErr(e?.message||"Couldn't load photos");setRows([]);}
  }
  useEffect(()=>{load();},[]);
  async function upload(e){
    const file=e.target.files?.[0];e.target.value="";if(!file)return;
    setBusy(true);setErr(null);
    try{
      const{data:sess}=await supabase.auth.getSession();const uid=sess?.session?.user?.id;if(!uid)throw new Error("Not signed in");
      const blob=await shrinkImage(file);const path=`${uid}/${date}-${pose}-${Date.now()}.jpg`;
      const{error:ue}=await supabase.storage.from("progress-photos").upload(path,blob,{contentType:"image/jpeg"});if(ue)throw ue;
      const{error:ie}=await supabase.from("progress_photos").insert({taken_on:date,pose,path,bodyweight_lb:latestBW});if(ie){await supabase.storage.from("progress-photos").remove([path]);throw ie;}
      await load();
    }catch(e2){setErr(e2?.message||"Upload failed");}
    setBusy(false);
  }
  async function del(r){
    try{const{error}=await supabase.from("progress_photos").delete().eq("id",r.id);if(error)throw error;await supabase.storage.from("progress-photos").remove([r.path]);setDelId(null);await load();}catch(e){setErr(e?.message||"Delete failed");}
  }
  const byPose=(rows||[]).filter(r=>r.pose===cmp.pose);
  const dates=[...new Set(byPose.map(r=>r.taken_on))];
  const aDate=cmp.a&&dates.includes(cmp.a)?cmp.a:dates[0];const bDate=cmp.b&&dates.includes(cmp.b)?cmp.b:dates[dates.length-1];
  const pick=d=>byPose.filter(r=>r.taken_on===d).slice(-1)[0];
  const A=pick(aDate),B=pick(bDate);
  const chip=on=>({padding:"5px 10px",borderRadius:8,border:`1px solid ${on?C.ac:C.bd}`,background:on?`${C.ac}15`:"transparent",color:on?C.ac:C.mt,fontSize:11,cursor:"pointer",textTransform:"capitalize"});
  return(
    <div style={{...card,marginBottom:12}}>
      <div style={{...lbl,color:C.ac,marginBottom:10}}>Progress photos</div>
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
        {POSES.map(p=><button key={p} onClick={()=>setPose(p)} style={chip(pose===p)}>{p}</button>)}
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...inp,width:"auto",fontSize:12,padding:"5px 8px",flex:1,minWidth:120}}/>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={upload} style={{display:"none"}}/>
      <button disabled={busy} onClick={()=>fileRef.current?.click()} style={{...btnS,marginBottom:10,opacity:busy?0.5:1}}>{busy?"Uploading...":`+ Add ${pose} photo`}</button>
      {err&&<div style={{fontSize:11,color:C.rd,marginBottom:8}}>{err}</div>}
      <div style={{fontSize:10,color:C.mt,marginBottom:10}}>Same spot, same light, same time of day (morning, before eating) every 2 weeks makes the comparison honest. Photos are private to your account.</div>
      {rows&&rows.length>0&&(<>
        <div style={{...lbl2,marginBottom:6}}>Compare</div>
        <div style={{display:"flex",gap:6,marginBottom:8}}>{POSES.map(p=><button key={p} onClick={()=>setCmp(c=>({...c,pose:p}))} style={chip(cmp.pose===p)}>{p}</button>)}</div>
        {dates.length===0?<div style={{fontSize:11,color:C.mt}}>No {cmp.pose} photos yet.</div>:(<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
            {[{d:aDate,set:v=>setCmp(c=>({...c,a:v}))},{d:bDate,set:v=>setCmp(c=>({...c,b:v}))}].map((s2,i)=><select key={i} value={s2.d} onChange={e=>s2.set(e.target.value)} style={{...inpL,fontSize:12,padding:"6px 8px"}}>{dates.map(d=><option key={d} value={d}>{d}</option>)}</select>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[A,B].map((r,i)=><div key={i} style={{background:C.sf2,borderRadius:8,overflow:"hidden",position:"relative",aspectRatio:"3/4"}}>
              {r&&urls[r.path]?<img src={urls[r.path]} alt={`${r.pose} ${r.taken_on}`} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>:<div style={{fontSize:10,color:C.mt,padding:8}}>—</div>}
              {r&&<div style={{position:"absolute",left:0,right:0,bottom:0,padding:"4px 6px",background:"#000a",fontSize:10,fontFamily:mono,color:C.tx,display:"flex",justifyContent:"space-between"}}><span>{r.taken_on}{r.bodyweight_lb?` · ${r.bodyweight_lb}lb`:""}</span>{delId===r.id?<span style={{display:"flex",gap:6}}><button onClick={()=>del(r)} style={{background:"none",border:"none",color:C.rd,fontSize:10,cursor:"pointer",padding:0}}>Delete</button><button onClick={()=>setDelId(null)} style={{background:"none",border:"none",color:C.mt,fontSize:10,cursor:"pointer",padding:0}}>Keep</button></span>:<button onClick={()=>setDelId(r.id)} style={{background:"none",border:"none",color:C.mt,fontSize:12,cursor:"pointer",padding:0,lineHeight:1}}>×</button>}</div>}
            </div>)}
          </div>
        </>)}
      </>)}
    </div>
  );
}

function WeightTrendCard({wt,goal}){
  if(!wt)return<div style={{...card,marginBottom:12,fontSize:12,color:C.mt}}>Log your weight each morning on the Train tab. A trend appears after a few days.</div>;
  const recent=wt.series.filter(p=>wt.series[wt.series.length-1].t-p.t<=60);
  const adv=rateAdvice(wt.rate,wt.trend,goal);
  const W=400,H=110,ys=recent.flatMap(p=>[p.w,p.trend]);const minY=Math.min(...ys)-0.5,maxY=Math.max(...ys)+0.5;const t0=recent[0].t,t1=Math.max(recent[recent.length-1].t,t0+1);
  const px=t=>12+(t-t0)/(t1-t0)*(W-24),py=v=>H-14-(v-minY)/(maxY-minY||1)*(H-28);
  const stale=wt.daysSinceLast>3;
  return(
    <div style={{...card,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
        <span style={{...lbl,color:C.ac}}>Weight trend</span>
        <span style={{fontSize:10,color:C.mt,fontFamily:mono}}>goal: {goal}</span>
      </div>
      <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:4}}>
        <span style={{fontSize:24,fontWeight:800,fontFamily:mono}}>{wt.trend}<span style={{fontSize:11,color:C.mt,fontWeight:400}}> lb</span></span>
        {wt.rate!=null?<span style={{fontSize:13,fontFamily:mono,color:adv?.ok?C.gn:C.am}}>{wt.rate>=0?"+":""}{wt.rate.toFixed(2)} lb/wk</span>:<span style={{fontSize:11,color:C.mt}}>rate needs 5 weigh-ins over 10+ days</span>}
      </div>
      {adv&&<div style={{fontSize:11,color:adv.ok?C.gn:C.am,marginBottom:6}}>{adv.text} <span style={{color:C.mt}}>(target {adv.lo>=0?"+":""}{adv.lo.toFixed(1)} to {adv.hi>=0?"+":""}{adv.hi.toFixed(1)} lb/wk)</span></div>}
      {stale&&<div style={{fontSize:11,color:C.am,marginBottom:6}}>Last weigh-in {wt.daysSinceLast} days ago. Daily weigh-ins make the trend useful.</div>}
      {recent.length>=2&&<svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H,display:"block"}}>
        {recent.map(p=><circle key={p.date} cx={px(p.t)} cy={py(p.w)} r="2.5" fill={C.mt}><title>{`${p.date}: ${p.w} lb (trend ${p.trend})`}</title></circle>)}
        <polyline points={recent.map(p=>`${px(p.t)},${py(p.trend)}`).join(" ")} fill="none" stroke={C.ac} strokeWidth="2" strokeLinejoin="round"/>
        <text x="12" y={H-2} fontSize="8" fill={C.mt} fontFamily={mono}>{recent[0].date.slice(5)}</text>
        <text x={W-12} y={H-2} fontSize="8" fill={C.mt} fontFamily={mono} textAnchor="end">{recent[recent.length-1].date.slice(5)}</text>
      </svg>}
      <div style={{fontSize:9,color:C.mt,marginTop:4}}>Dots = daily weigh-ins · line = smoothed trend</div>
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
  const[reviewWeek,setReviewWeek]=useState(week);const[reviewData,setReviewData]=useState(null);const[stalls,setStalls]=useState(null);
  useEffect(()=>{loadPRs();loadVol();loadMuscleTrend();getWeekReview(reviewWeek);loadStalls();},[week,activeProgram]);
  async function loadStalls(){try{const out=await computeStalls();setStalls(out);cache.set("stalls",out);}catch{const c=cache.get("stalls");if(c)setStalls(c);}}
  useEffect(()=>{getWeekReview(reviewWeek);},[reviewWeek]);
  async function getWeekReview(wk){
    try{
      const{data:sessions}=await supabase.from("workout_sessions").select("id").eq("week_number",wk).eq("program_id",activeProgram);
      if(!sessions||!sessions.length){setReviewData({empty:true,week:wk});return;}
      const sessionIds=sessions.map(s=>s.id);
      const{data:sets}=await supabase.from("workout_sets").select("exercise_id,weight_lb,reps,rir,exercises(name,primary_muscle,secondary_muscles)").in("session_id",sessionIds).gt("reps",0);
      const sessionsCompleted=sessions.length;
      const completionPct=Math.round((sessionsCompleted/4)*100);
      const rirs=(sets||[]).filter(s=>s.rir!==null&&s.rir!==undefined).map(s=>s.rir);
      const avgRIR=rirs.length?parseFloat((rirs.reduce((a,b)=>a+b,0)/rirs.length).toFixed(1)):null;
      const volumeByMuscle={};
      (sets||[]).forEach(s=>{muscleCredits(s.exercises).forEach(({m,w})=>{volumeByMuscle[m]=(volumeByMuscle[m]||0)+w;});});
      const{data:prevSessions}=await supabase.from("workout_sessions").select("id").eq("week_number",wk-1).eq("program_id",activeProgram);
      const prevIds=(prevSessions||[]).map(s=>s.id);
      let topGains=[];
      if(prevIds.length){
        const{data:prevSets}=await supabase.from("workout_sets").select("weight_lb,exercises(name)").in("session_id",prevIds).gt("weight_lb",0);
        const prevMax={};(prevSets||[]).forEach(s=>{const n=s.exercises?.name;if(n&&s.weight_lb)prevMax[n]=Math.max(prevMax[n]||0,s.weight_lb);});
        const currMax={};(sets||[]).forEach(s=>{const n=s.exercises?.name;if(n&&s.weight_lb)currMax[n]=Math.max(currMax[n]||0,s.weight_lb);});
        topGains=Object.entries(currMax).map(([name,w])=>({name,delta:w-(prevMax[name]||w)})).filter(g=>g.delta>0).sort((a,b)=>b.delta-a.delta).slice(0,3);
      }
      setReviewData({week:wk,sessionsCompleted,completionPct,avgRIR,volumeByMuscle,topGains});
    }catch{setReviewData(null);}
  }
  async function loadPRs(){try{const data=await fetchAll(()=>supabase.from("workout_sets").select("exercise_id,weight_lb,reps,exercises(name)").gt("reps",0).order("id"));if(data){const best={};data.forEach(s=>{const n=s.exercises?.name;if(!n||!s.weight_lb||!s.reps)return;const e1=s.weight_lb*(1+s.reps/30);if(!best[n]||e1>best[n].est1rm)best[n]={exercise:n,weight:s.weight_lb,reps:s.reps,est1rm:e1};});const p=Object.values(best).sort((a,b)=>b.est1rm-a.est1rm);setPrs(p);cache.set("prs",p);}}catch{const c=cache.get("prs");if(c)setPrs(c);}}
  async function loadVol(){try{const{data}=await supabase.from("workout_sessions").select("id,workout_sets(exercise_id,reps,exercises(primary_muscle,secondary_muscles))").eq("week_number",week).eq("program_id",activeProgram);if(data){const m={};data.forEach(s=>s.workout_sets.forEach(ws=>{if(ws.reps>0&&ws.exercises?.primary_muscle){muscleCredits(ws.exercises).forEach(({m:mu,w})=>{m[mu]=(m[mu]||0)+w;});}}));setVol(m);}}catch{}}
  async function loadMuscleTrend(){try{const data=await fetchAll(()=>supabase.from("workout_sets").select("weight_lb,exercises(primary_muscle,secondary_muscles),workout_sessions(week_number)").gt("weight_lb",0).order("id"));if(data){const byMuscle={};data.forEach(s=>{const muscle=s.exercises?.primary_muscle;const wk=s.workout_sessions?.week_number;if(!muscle||!wk||!s.weight_lb)return;if(!byMuscle[muscle])byMuscle[muscle]={};if(!byMuscle[muscle][wk]||s.weight_lb>byMuscle[muscle][wk])byMuscle[muscle][wk]=s.weight_lb;});const result={};Object.entries(byMuscle).forEach(([muscle,weeks])=>{const pts=Object.entries(weeks).map(([wk,w])=>({x:parseInt(wk),y:w})).sort((a,b)=>a.x-b.x);if(pts.length>=2)result[muscle]=pts;});setMuscleTrend(result);cache.set("muscleTrend",result);}}catch{const c=cache.get("muscleTrend");if(c)setMuscleTrend(c);}}
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
      {reviewData&&!reviewData.empty&&(
        <div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.bd}`,padding:"14px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700}}>W{reviewData.week} Review</div>
            <button onClick={()=>{const nw=reviewWeek===week?week-1:week;setReviewWeek(nw);}} style={{fontSize:10,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.bd}`,background:"transparent",color:C.mt,cursor:"pointer"}}>{reviewWeek===week?"Last Week":"This Week"}</button>
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:4}}>
            <div style={{fontSize:36,fontWeight:700,fontFamily:mono,color:reviewData.completionPct>=80?C.gn:reviewData.completionPct>=50?C.am:C.rd,lineHeight:1}}>{Math.min(reviewData.completionPct,100)}%</div>
            <div style={{fontSize:11,color:C.mt}}>complete</div>
          </div>
          <div style={{fontSize:11,color:C.mt,marginBottom:10}}>{reviewData.sessionsCompleted} session{reviewData.sessionsCompleted!==1?"s":""}{reviewData.avgRIR!==null?` · avg RIR ${reviewData.avgRIR}`:""}</div>
          {Object.keys(reviewData.volumeByMuscle).length>0&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
              {Object.entries(reviewData.volumeByMuscle).sort((a,b)=>b[1]-a[1]).map(([m,sets])=>{
                const st=volumeStatus(sets,VOL_TARGETS[m]);
                return<span key={m} style={{fontSize:10,padding:"3px 8px",borderRadius:12,background:`${st.color}15`,color:st.color,border:`1px solid ${st.color}33`}}>{m} {fmtSets(sets)}</span>;
              })}
            </div>
          )}
          {reviewData.topGains&&reviewData.topGains.length>0&&(
            <div>
              <div style={{fontSize:10,fontWeight:600,color:C.mt,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Top Gains</div>
              {reviewData.topGains.map(g=>(
                <div key={g.name} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"3px 0"}}>
                  <span style={{color:C.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"70%"}}>{g.name}</span>
                  <span style={{color:C.gn,fontFamily:mono,fontWeight:600}}>+{g.delta} lb</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{display:"flex",gap:4,marginBottom:16,background:C.sf2,borderRadius:10,padding:4}}>
        {[{id:"prs",l:"PRs"},{id:"vol",l:`Vol W${week}`},{id:"stall",l:"Stalls"},{id:"bw",l:"Weight"},{id:"bf",l:"BF"},{id:"muscle",l:"Muscle"}].map(v=>(
          <button key={v.id} onClick={()=>setView(v.id)} style={{flex:1,padding:"7px 0",borderRadius:7,border:"none",background:view===v.id?C.sf:"transparent",color:view===v.id?C.tx:C.mt,fontSize:11,fontWeight:view===v.id?600:400,cursor:"pointer",transition:"background 0.15s"}}>{v.l}</button>
        ))}
      </div>
      {view==="vol"&&(()=>{
        const lo={JUNK:0,UNDER:1,BUILD:2,OPTIMAL:3,UNTAGGED:4};
        const po={HIGH:0,MED:1,LOW:2};
        const vData=[...new Set([...Object.keys(VOL_TARGETS),...Object.keys(vol)])].filter(m=>vol[m]>0).map(m=>{
          const tgt=VOL_TARGETS[m],actual=vol[m]||0,st=volumeStatus(actual,tgt);
          return{muscle:m,actual,tgt,st,priority:tgt?.priority||"LOW"};
        }).sort((a,b)=>(lo[a.st.label]??4)-(lo[b.st.label]??4)||(po[a.priority]??2)-(po[b.priority]??2));
        const junkCount=vData.filter(v=>v.st.label==="JUNK").length;
        const underCount=vData.filter(v=>v.st.label==="UNDER").length;
        return(
          <div>
            {junkCount>0&&<div style={{padding:"7px 12px",marginBottom:10,background:`${C.rd}10`,border:`1px solid ${C.rd}33`,borderRadius:8,fontSize:11,color:C.rd}}>{junkCount} muscle{junkCount>1?"s":""} over MRV — consider trimming sets</div>}
            {!junkCount&&underCount>0&&<div style={{padding:"7px 12px",marginBottom:10,background:`${C.am}10`,border:`1px solid ${C.am}33`,borderRadius:8,fontSize:11,color:C.am}}>{underCount} muscle{underCount>1?"s":""} below MEV — consider adding sets</div>}
            <div style={{...lbl,marginBottom:10}}>Sets vs target — W{week}</div>
            {vData.map(v=>{
              const{muscle,actual,tgt,st}=v;
              const isHigh=tgt?.priority==="HIGH";
              const mev=st.mev??0,mav=st.mav??0,mrv=st.mrv??0;
              const barMax=Math.max(mrv*1.2,actual*1.1,1);
              return(
                <div key={muscle} style={{marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      {isHigh&&<span style={{fontSize:8,color:C.ac,fontWeight:700}}>★</span>}
                      <span style={{fontSize:12,color:C.tx}}>{muscle}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,fontFamily:mono,color:C.mt}}>{fmtSets(actual)}/{mrv||"?"}</span>
                      <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:st.color}}>
                        {st.label}{st.label==="JUNK"&&st.delta!=null?` +${fmtSets(st.delta)}`:st.label==="UNDER"&&st.delta!=null?` -${fmtSets(st.delta)}`:""}
                      </span>
                    </div>
                  </div>
                  {tgt&&<div style={{position:"relative",width:"100%",height:6,background:C.sf2,borderRadius:3}}>
                    <div style={{position:"absolute",left:0,width:`${Math.min((mev/barMax)*100,100)}%`,height:"100%",background:`${C.rd}30`,borderRadius:"3px 0 0 3px"}}/>
                    <div style={{position:"absolute",left:`${(mev/barMax)*100}%`,width:`${Math.min(((mav-mev)/barMax)*100,100)}%`,height:"100%",background:`${C.am}30`}}/>
                    <div style={{position:"absolute",left:`${(mav/barMax)*100}%`,width:`${Math.min(((mrv-mav)/barMax)*100,100)}%`,height:"100%",background:`${C.gn}30`,borderRadius:"0 3px 3px 0"}}/>
                    <div style={{position:"absolute",left:`${Math.min((actual/barMax)*100,99)}%`,transform:"translateX(-50%)",top:-1,width:3,height:8,background:st.color,borderRadius:2}}/>
                  </div>}
                </div>
              );
            })}
            <div style={{display:"flex",gap:12,marginTop:8,fontSize:10,color:C.mt}}>
              <span><span style={{color:C.rd}}>●</span> Under MEV</span>
              <span><span style={{color:C.am}}>●</span> Build</span>
              <span><span style={{color:C.gn}}>●</span> Optimal</span>
              <span><span style={{color:C.rd,fontWeight:700}}>●</span> Junk</span>
            </div>
          </div>
        );
      })()}
      {view==="stall"&&(()=>{
        if(!stalls)return<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>Loading...</div>;
        const st=stalls.filter(e=>e.st.stalled),rb=stalls.filter(e=>e.st.rebuilding),ok=stalls.filter(e=>!e.st.stalled&&!e.st.rebuilding);
        const Row=({e,c})=><div style={{padding:"9px 0",borderBottom:`1px solid ${C.bd}`}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><span style={{fontSize:12,color:C.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</span><span style={{fontSize:11,fontFamily:mono,color:c,flexShrink:0}}>{Math.round(e.st.bestRecent)} / {Math.round(e.st.bestPrior)}</span></div>{c===C.rd&&<div style={{fontSize:10,color:C.mt,marginTop:3}}>{stallTip(e.isCompound)}</div>}</div>;
        return(<div>
          <div style={{fontSize:11,color:C.mt,marginBottom:12,lineHeight:1.5}}>Lifts trained in the last 60 days with 4+ sessions. Numbers are best e1RM in the last 3 sessions vs best before that.</div>
          <div style={{...lbl,color:C.rd,marginBottom:4}}>Stalled ({st.length})</div>
          {st.length?st.map(e=><Row key={e.name} e={e} c={C.rd}/>):<div style={{fontSize:12,color:C.mt,padding:"6px 0 12px"}}>None. Everything you're training is moving.</div>}
          {rb.length>0&&<><div style={{...lbl,color:C.am,margin:"14px 0 4px"}}>Rebuilding after a break ({rb.length})</div>{rb.map(e=><Row key={e.name} e={e} c={C.am}/>)}</>}
          <div style={{...lbl,color:C.gn,margin:"14px 0 4px"}}>Progressing ({ok.length})</div>
          {ok.map(e=><Row key={e.name} e={e} c={C.gn}/>)}
        </div>);
      })()}
      {view==="bw"&&(bwPoints.length>=2?(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}><div style={lbl}>Bodyweight trend</div><div style={{fontFamily:mono,fontSize:11,color:C.mt}}>{bwPoints[0].y} → <span style={{color:C.ac,fontWeight:600}}>{bwPoints[bwPoints.length-1].y} lb</span></div></div><div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.bd}`,padding:"14px 10px 6px"}}><LineChart points={bwPoints} color={C.ac} height={100}/></div></div>):<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>Not enough data yet</div>)}
      {view==="bf"&&(bfData.length>=2?(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}><div style={lbl}>Body fat trend</div><div style={{fontFamily:mono,fontSize:11,color:C.mt}}>{bfData[0].y}% → <span style={{color:C.am,fontWeight:600}}>{bfData[bfData.length-1].y}%</span></div></div><div style={{background:C.sf,borderRadius:12,border:`1px solid ${C.am}22`,padding:"14px 10px 6px"}}><LineChart points={bfData} color={C.am} height={100}/></div></div>):<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>Not enough data yet — log waist + neck measurements in Body tab</div>)}
      {view==="muscle"&&(muscleKeys.length>0?(<div><div style={{...lbl,marginBottom:10}}>Max weight by muscle — all weeks</div><div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>{muscleKeys.map(m=>(<button key={m} onClick={()=>setSelMuscle(m)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${activeMuscle===m?getMC(m)+"55":C.bd}`,background:activeMuscle===m?getMC(m)+"14":"transparent",color:activeMuscle===m?getMC(m):C.mt,fontSize:11,fontWeight:activeMuscle===m?600:400,cursor:"pointer"}}>{m}</button>))}</div>{activeMuscle&&muscleTrend[activeMuscle]&&(<div style={{background:C.sf,borderRadius:12,border:`1px solid ${getMC(activeMuscle)}22`,padding:"14px 10px 6px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,paddingLeft:4,paddingRight:4}}><div style={{fontSize:13,fontWeight:600,color:getMC(activeMuscle)}}>{activeMuscle}</div><div style={{fontFamily:mono,fontSize:11,color:C.mt}}>{muscleTrend[activeMuscle][0].y} → <span style={{color:getMC(activeMuscle),fontWeight:600}}>{muscleTrend[activeMuscle][muscleTrend[activeMuscle].length-1].y} lb</span></div></div><LineChart points={muscleTrend[activeMuscle]} color={getMC(activeMuscle)} height={100}/></div>)}</div>):<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>No training data yet</div>)}
      {view==="prs"&&(<>{prs.length>0?(<><div style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr",marginBottom:6,paddingBottom:6,borderBottom:`1px solid ${C.bd}`}}>{["Exercise","Best","Reps","E1RM"].map(h=><div key={h} style={hlbl}>{h}</div>)}</div>{prs.map(pr=>(<div key={pr.exercise} style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr",padding:"8px 0",borderBottom:`1px solid ${C.bd}`}}><div style={{fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:6,color:C.tx}}>{pr.exercise}</div><div style={{fontSize:11,fontFamily:mono,color:C.ac}}>{pr.weight}</div><div style={{fontSize:11,fontFamily:mono,color:C.mt}}>{pr.reps}</div><div style={{fontSize:11,fontFamily:mono,color:C.gn}}>{Math.round(pr.est1rm)}</div></div>))}</>):<div style={{textAlign:"center",padding:"36px 20px",color:C.mt,fontSize:13}}>No PRs yet</div>}</>)}
    </div>
  );
}
