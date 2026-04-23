import { useState, useEffect } from "react";

// ── Neon on black palette ─────────────────────────────────────────────────
const C = {
  bg:      "#000000",
  card:    "#0a0a0a",
  border:  "#1e1e1e",
  text:    "#FFFFFF",
  sub:     "#AAAAAA",
  muted:   "#555555",
  beige:   "#FFEE00",   // neon yellow
  gold:    "#FFEE00",   // neon yellow
  green:   "#00FF9F",   // neon green
  red:     "#FF003C",   // neon red
  patch:   "#FF2D9B",   // neon pink
  blue:    "#00CFFF",   // neon blue
};

// Patch change days: Sunday=0, Wednesday=3
const PATCH_DAYS = [0, 3];
const PATCH_DAY_NAMES = ["Sunday", "Wednesday"];

const SYSTEM_PROMPT = `You are Colleen's personal health optimization advisor. You specialize in women's health, perimenopause, HRT, and performance optimization.

COLLEEN'S PROFILE:
- 42-year-old active female on HRT for perimenopause
- Estrogen patch changed every Sunday and Wednesday evening (NOT cyclic protocol)
- Progesterone oil taken every night before bed
- 16:8 intermittent fasting (12pm–8pm eating window, flexible on weekends)
- Trains after 4pm (sometimes fasted if she hasn't eaten yet)
- Runs 3x/week, strength 1–2x/week, yoga 1–2x/week
- Daily supplements: creatine 5g, psyllium husk, Vitamin D + K1/K2, red yeast rice, omega-3s, NMN
- Tracking device: Garmin (worn to sleep — provides HRV, Body Battery, resting HR)
- Optimization priorities: 1) Recovery & energy, 2) Hormonal balance/perimenopause, 3) Longevity, 4) Training performance, 5) Body composition

HRT CYCLE CONTEXT:
- Patch is changed Sunday and Wednesday evenings
- Day 1 = day after patch change (Monday or Thursday) — estrogen rising
- Day 2 = middle day (Tuesday or Friday) — estrogen peak
- Day 3 = last day before change (Wednesday or Sunday) — estrogen potentially dipping
- Estrogen dips on patch change days (Sunday/Wednesday evenings) before new patch kicks in
- This dip can cause: lower energy, mood shifts, headaches/migraines, disrupted sleep
- Always factor patch cycle day into your advice

MIGRAINE CONTEXT:
- Track migraines carefully — they may correlate with patch change days (estrogen dip), long fasts, poor sleep, or high training load
- Flag any patterns you notice

TOP PRIORITIES:
1. Recovery & energy — always factor HRV, Body Battery, sleep
2. Hormonal balance — cortisol, patch cycle day, HRT interactions
3. Longevity — autophagy, NMN, inflammation, metabolic health
4. Performance — only when recovery allows
5. Body composition — last priority

YOUR JOB:
Analyze ALL check-in data and give Colleen a SHORT, ACTIONABLE daily brief (5-7 sentences). Include:
1. Recovery/readiness read based on HRV and sleep
2. Specific training recommendation for today
3. Nutrition/fasting insight (factor in fasting hours logged)
4. Hormone/patch cycle insight — what to expect today based on cycle day
5. Supplement note if anything is missed or timed suboptimally
6. Focus for today — one concrete thing

Be direct, specific, warm but not fluffy. No generic advice. Always tie to her actual data.`;

const WEEKLY_SYSTEM = `You are Colleen's health optimization advisor. Review her week of check-in data.

COLLEEN'S PROFILE: 42F, HRT for perimenopause (estrogen patch Sun+Wed evenings, progesterone oil nightly), 16:8 IF, trains after 4pm, runs 3x/week + strength 1-2x/week + yoga 1-2x/week. Supplements: creatine 5g, psyllium husk, Vit D+K1/K2, red yeast rice, omegas, NMN. Garmin for HRV/Body Battery. Priorities: 1)Recovery/energy 2)Hormonal balance 3)Longevity 4)Performance 5)Body composition.

Return ONLY valid JSON (no markdown, no backticks):
{
  "headline": "one punchy sentence summarizing the week",
  "recoveryTrend": "improving | declining | stable",
  "recoveryNote": "2 sentences on HRV/sleep/Body Battery trend",
  "hormoneNote": "2 sentences on patch cycle patterns, migraine correlation, energy patterns across cycle days",
  "fastingNote": "1-2 sentences on fasting patterns and impact",
  "supplementNote": "1 sentence on supplement consistency",
  "trainingGrade": "A | B | C | D",
  "trainingNote": "2 sentences on training load/balance",
  "migraineNote": "1-2 sentences if any migraines logged, otherwise null",
  "topWin": "one specific thing she did well this week",
  "topAdjustment": "one specific change to make next week",
  "nextWeekFocus": "one clear priority for next week"
}`;

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const TRAINING_OPTIONS = ["Rest","Easy Run","Tempo/Intervals","Long Run","Strength","Yoga/Mobility","Fasted Training"];
const SYMPTOM_OPTIONS = ["Brain fog","Mood dip","Hot flashes","Poor sleep","Joint aches","Low libido","Fatigue","Great energy","Strong performance"];
const MIGRAINE_OPTIONS = ["None","Mild","Moderate","Severe"];
const SUPPLEMENTS = [
  {key:"creatine", label:"Creatine 5g"},
  {key:"psyllium", label:"Psyllium husk"},
  {key:"vitd", label:"Vitamin D + K"},
  {key:"ryr", label:"Red yeast rice"},
  {key:"omegas", label:"Omegas"},
  {key:"nmn", label:"NMN"},
];

function todayStr() {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function getDayOfWeek() { return new Date().getDay(); }

function isPatchDay() { return PATCH_DAYS.includes(getDayOfWeek()); }

function getPatchCycleDay() {
  const day = getDayOfWeek();
  // 0=Sun patch, 1=Mon(day1), 2=Tue(day2), 3=Wed patch, 4=Thu(day1), 5=Fri(day2), 6=Sat(day3)
  const cycleMap = {0:"Patch Change Day",1:"Day 1 (Estrogen Rising)",2:"Day 2 (Estrogen Peak)",3:"Patch Change Day",4:"Day 1 (Estrogen Rising)",5:"Day 2 (Estrogen Peak)",6:"Day 3 (Estrogen Dipping)"};
  return cycleMap[day] || "Unknown";
}

function getWeekDays() {
  const d = new Date();
  return Array.from({length:7},(_,i)=>{
    const day = new Date(d);
    day.setDate(d.getDate()-6+i);
    return {
      label: DAYS[day.getDay()],
      date: day.getDate(),
      isToday: i===6,
      isPatch: PATCH_DAYS.includes(day.getDay()),
    };
  });
}

function calcFastingHours(lastMealTime) {
  if (!lastMealTime) return null;
  const [h, m] = lastMealTime.split(":").map(Number);
  const now = new Date();
  const last = new Date();
  last.setHours(h, m, 0, 0);
  if (last > now) last.setDate(last.getDate() - 1);
  const diff = (now - last) / (1000 * 60 * 60);
  return Math.round(diff * 10) / 10;
}

function metricColor(v, type) {
  if (type==="energy"||type==="sleepQ") return v>=7?C.green:v>=5?C.gold:C.red;
  if (type==="stress") return v<=4?C.green:v<=6?C.gold:C.red;
  if (type==="hrv") return v>=50?C.green:v>=35?C.gold:C.red;
  return C.green;
}

function gradeColor(g) { return ({A:C.green,B:C.gold,C:"#FF9944",D:C.red})[g]||C.sub; }

function ScoreRing({ value, max=10, color, size=62 }) {
  const r=(size-12)/2, circ=2*Math.PI*r, dash=circ*(Math.min(value,max)/max);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",filter:`drop-shadow(0 0 6px ${color})`}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#111" strokeWidth="7"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray 0.8s ease"}}/>
    </svg>
  );
}

function Slider({ value, onChange, color }) {
  return (
    <div style={{position:"relative",height:34,display:"flex",alignItems:"center"}}>
      <input type="range" min={1} max={10} value={value}
        onChange={e=>onChange(Number(e.target.value))}
        style={{width:"calc(100% - 40px)",accentColor:color,cursor:"pointer"}}/>
      <span style={{position:"absolute",right:0,fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:"700",color,minWidth:36,textAlign:"right"}}>{value}</span>
    </div>
  );
}

const emptyLog = {
  hrv:"", bodyBattery:"", sleep:"", sleepQuality:6, energy:6, stress:4,
  training:"", fasted:false, lastMealTime:"", symptoms:[], migraine:"None",
  supplements:{creatine:false,psyllium:false,vitd:false,ryr:false,omegas:false,nmn:false},
  patchChanged:false, notes:""
};

async function callClaude(system, messages) {
  const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;
  if (!apiKey) throw new Error("No API key set. Add REACT_APP_ANTHROPIC_KEY to Vercel environment variables.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body: JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1000,system,messages})
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.find(b=>b.type==="text")?.text || "";
}

export default function App() {
  const [view, setView] = useState("checkin");
  const [log, setLog] = useState({...emptyLog, supplements:{...emptyLog.supplements}});
  const [history, setHistory] = useState([]);
  const [brief, setBrief] = useState("");
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const weekDays = getWeekDays();
  const patchToday = isPatchDay();
  const cycleDay = getPatchCycleDay();
  const fastingHours = calcFastingHours(log.lastMealTime);

  useEffect(()=>{
    try {
      const h=localStorage.getItem("colleen_history_v2");
      if(h) setHistory(JSON.parse(h));
      const t=localStorage.getItem("colleen_today_v2");
      if(t){ const s=JSON.parse(t); if(s.date===todayStr()){setLog(s.log);setSubmitted(true);if(s.brief)setBrief(s.brief);} }
    } catch(e){}
  },[]);

  const setF=(k,v)=>setLog(p=>({...p,[k]:v}));
  const toggleSym=(s)=>setLog(p=>({...p,symptoms:p.symptoms.includes(s)?p.symptoms.filter(x=>x!==s):[...p.symptoms,s]}));
  const toggleTrain=(t)=>setLog(p=>({...p,training:p.training===t?"":t}));
  const toggleSupp=(k)=>setLog(p=>({...p,supplements:{...p.supplements,[k]:!p.supplements[k]}}));

  const suppSummary = Object.entries(log.supplements).filter(([,v])=>v).map(([k])=>SUPPLEMENTS.find(s=>s.key===k)?.label).join(", ")||"none";
  const missedSupp = SUPPLEMENTS.filter(s=>!log.supplements[s.key]).map(s=>s.label).join(", ")||"none";

  const submitCheckin = async () => {
    setLoading(true); setError(""); setView("brief");
    const prompt = `Daily check-in for ${todayStr()}:
- HRV: ${log.hrv||"not logged"} ms
- Body Battery: ${log.bodyBattery||"not logged"}
- Sleep: ${log.sleep||"not logged"} hours, quality ${log.sleepQuality}/10
- Energy: ${log.energy}/10
- Stress: ${log.stress}/10
- Training planned: ${log.training||"undecided"}
- Last meal time: ${log.lastMealTime||"not logged"} → Fasting hours: ${fastingHours||"unknown"}
- Fasted training: ${log.fasted?"yes":"no"}
- Migraine: ${log.migraine}
- Symptoms: ${log.symptoms.join(", ")||"none"}
- Supplements taken: ${suppSummary}
- Supplements missed: ${missedSupp}
- Patch change day: ${patchToday?"YES — patch should be changed this evening":"no"}
- Patch cycle position: ${cycleDay}
- Patch changed today: ${log.patchChanged?"yes":"not yet"}
- Notes: ${log.notes||"none"}

Give me my daily optimization brief.`;
    try {
      const text = await callClaude(SYSTEM_PROMPT,[{role:"user",content:prompt}]);
      setBrief(text); setSubmitted(true);
      const entry={date:todayStr(),log:{...log,supplements:{...log.supplements}},brief:text,ts:Date.now()};
      const newH=[...history.filter(h=>h.date!==todayStr()),entry].slice(-28);
      setHistory(newH);
      localStorage.setItem("colleen_history_v2",JSON.stringify(newH));
      localStorage.setItem("colleen_today_v2",JSON.stringify({date:todayStr(),log:{...log,supplements:{...log.supplements}},brief:text}));
    } catch(e){ setError(e.message||"Something went wrong."); }
    setLoading(false);
  };

  const generateWeekly = async () => {
    setWeekLoading(true); setError(""); setView("weekly");
    const last=history.slice(-7);
    if(last.length<2){setWeekLoading(false);return;}
    const summary=last.map(e=>`${e.date}: HRV ${e.log.hrv||"?"}, Body Battery ${e.log.bodyBattery||"?"}, sleep ${e.log.sleep||"?"}h (${e.log.sleepQuality}/10), energy ${e.log.energy}/10, stress ${e.log.stress}/10, fasting hrs ${e.log.lastMealTime?"~logged":"not logged"}, training: ${e.log.training||"none"}, migraine: ${e.log.migraine||"none"}, symptoms: ${e.log.symptoms?.join(",")||"none"}, patch changed: ${e.log.patchChanged?"yes":"no"}`).join("\n");
    try {
      const text=await callClaude(WEEKLY_SYSTEM,[{role:"user",content:`Weekly data:\n${summary}\n\nGenerate my weekly report as JSON only.`}]);
      setWeeklyReport(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(e){ setError(e.message||"Failed to generate weekly report."); }
    setWeekLoading(false);
  };

  const formatBrief=(text)=>text.split("\n").map((line,i)=>{
    line=line.replace(/\*\*(.*?)\*\*/g,`<strong style="color:${C.text}">$1</strong>`);
    if(/^#+\s/.test(line)) return <div key={i} style={{fontFamily:"'DM Mono',monospace",fontSize:11,textTransform:"uppercase",letterSpacing:"0.16em",color:C.beige,margin:"18px 0 8px",borderBottom:`1px solid ${C.border}`,paddingBottom:6}} dangerouslySetInnerHTML={{__html:line.replace(/^#+\s/,"")}}/>;
    if(/^[-•]\s/.test(line.trim())) return <div key={i} style={{paddingLeft:24,position:"relative",margin:"6px 0",lineHeight:1.8,fontSize:15,color:C.text}} dangerouslySetInnerHTML={{__html:`<span style="position:absolute;left:0;color:${C.beige};font-weight:bold">—</span>${line.trim().slice(2)}`}}/>;
    if(!line.trim()) return <div key={i} style={{height:10}}/>;
    return <div key={i} style={{margin:"5px 0",lineHeight:1.8,fontSize:15,color:C.text}} dangerouslySetInnerHTML={{__html:line}}/>;
  });

  const card={background:C.card,border:`1px solid #1e1e1e`,borderRadius:14,padding:20};
  const lbl={fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:C.blue,marginBottom:10,fontWeight:"600",textShadow:`0 0 8px ${C.blue}77`};

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Georgia',serif",maxWidth:600,margin:"0 auto"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#000}
        ::-webkit-scrollbar{width:0}
        input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;background:#222;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:currentColor;cursor:pointer;border:2px solid #000;box-shadow:0 0 8px currentColor}
        input[type=number]{-moz-appearance:textfield}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
        input[type=time]{color-scheme:dark}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .fade{animation:fadeUp 0.3s ease forwards}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spinner{width:28px;height:28px;border:3px solid #222;border-top-color:#00FF9F;border-radius:50%;animation:spin 0.8s linear infinite;box-shadow:0 0 14px #00FF9F}
        @keyframes pulse{0%,100%{box-shadow:0 0 16px #FF2D9B44}50%{box-shadow:0 0 40px #FF2D9B99}}
        .pulse{animation:pulse 2s ease-in-out infinite}
        .chip{display:inline-flex;align-items:center;padding:9px 16px;border-radius:24px;border:1px solid #2a2a2a;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;cursor:pointer;color:#444;background:transparent;margin:3px;transition:all 0.15s;-webkit-tap-highlight-color:transparent}
        .chip:active{opacity:0.7}
        .chip-t{border-color:#FFEE00!important;color:#FFEE00!important;background:#0a0a00!important;box-shadow:0 0 12px #FFEE0055!important}
        .chip-s{border-color:#FF2D9B!important;color:#FF2D9B!important;background:#0d0007!important;box-shadow:0 0 12px #FF2D9B55!important}
        .chip-m-mild{border-color:#FFEE00!important;color:#FFEE00!important;box-shadow:0 0 10px #FFEE0077!important}
        .chip-m-mod{border-color:#FF003C!important;color:#FF003C!important;box-shadow:0 0 10px #FF003C77!important}
        .chip-m-sev{border-color:#FF003C!important;color:#FF003C!important;background:#120000!important;box-shadow:0 0 20px #FF003Caa!important}
        .chip-supp{border-color:#00FF9F!important;color:#00FF9F!important;background:#00120a!important;box-shadow:0 0 10px #00FF9F55!important}
        .ifield{background:#050505;border:1px solid #2a2a2a;border-radius:10px;padding:13px 16px;color:#fff;font-family:'DM Mono',monospace;font-size:15px;width:100%;outline:none;transition:all 0.2s;-webkit-appearance:none}
        .ifield:focus{border-color:#00CFFF;box-shadow:0 0 14px #00CFFF55}
        .ifield::placeholder{color:#2a2a2a}
        textarea.ifield{resize:none;font-family:'Georgia',serif;font-size:15px;min-height:80px;line-height:1.6}
        .sbtn{width:100%;padding:18px;background:#000;border:2px solid #FF2D9B;border-radius:13px;color:#FF2D9B;font-family:'DM Mono',monospace;font-size:13px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;-webkit-tap-highlight-color:transparent;box-shadow:0 0 20px #FF2D9B44,inset 0 0 20px #FF2D9B11}
        .sbtn:hover:not(:disabled){box-shadow:0 0 35px #FF2D9B88,inset 0 0 20px #FF2D9B22}
        .sbtn:active{opacity:0.75}
        .sbtn:disabled{opacity:0.18;cursor:default;box-shadow:none}
        .navbtn{background:none;border:none;cursor:pointer;font-family:'DM Mono',monospace;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:9px 12px;border-radius:8px;transition:all 0.2s;-webkit-tap-highlight-color:transparent}
        .section-title{font-family:'DM Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#00CFFF;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #111;text-shadow:0 0 12px #00CFFF99}
      `}</style>

      {/* ── Patch change banner ── */}
      {patchToday&&(
        <div className="pulse" style={{background:"#1a0010",border:`2px solid ${C.patch}`,borderRadius:0,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>💊</span>
            <div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:"700",color:C.patch,letterSpacing:"0.1em"}}>PATCH CHANGE DAY</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#CC66AA",marginTop:2}}>Remember to change your estrogen patch this evening</div>
            </div>
          </div>
          {log.patchChanged&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.green,fontWeight:"700"}}>✓ Done</div>}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{borderBottom:`2px solid ${C.border}`,padding:"16px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:C.bg,zIndex:10}}>
        <div>
          <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:19,fontStyle:"italic",color:C.text,fontWeight:"700",textShadow:`0 0 20px ${C.patch}88`}}>Colleen</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.blue,letterSpacing:"0.16em",textTransform:"uppercase",marginTop:3,fontWeight:"600",textShadow:`0 0 8px ${C.blue}`}}>{cycleDay}</div>
        </div>
        <div style={{display:"flex",gap:2}}>
          {[["checkin","Check-in"],["brief","Today"],["weekly","Weekly"],["history","Log"]].map(([v,l])=>(
            <button key={v} className="navbtn"
              style={{color:view===v?C.patch:C.muted,background:view===v?"#0d0007":"none",border:view===v?"1px solid #FF2D9B66":"1px solid transparent",textShadow:view===v?"0 0 10px #FF2D9B":"none"}}
              onClick={()=>setView(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Week strip ── */}
      <div style={{padding:"14px 18px",display:"flex",gap:6,justifyContent:"center",borderBottom:`1px solid #1a1a1a`,background:"#050505"}}>
        {weekDays.map((d,i)=>(
          <div key={i} style={{width:42,height:62,borderRadius:22,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,border:`2px solid ${d.isToday?C.patch:d.isPatch?C.patch+"44":history.some(h=>h.date.includes(d.date))?"#333":"#111"}`,background:d.isToday?"#0d0007":d.isPatch?"#08000d":"#050505",boxShadow:d.isToday?`0 0 16px ${C.patch}55`:"none"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:"700",color:d.isToday?C.patch:d.isPatch?C.patch+"99":history.some(h=>h.date.includes(d.date))?"#555":"#1a1a1a",letterSpacing:"0.06em"}}>{d.label}</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:d.isToday?"700":"500",color:d.isToday?C.patch:d.isPatch?C.patch+"99":history.some(h=>h.date.includes(d.date))?C.sub:"#1a1a1a",textShadow:d.isToday?`0 0 10px ${C.patch}`:"none"}}>{d.date}</div>
            {d.isPatch&&<div style={{fontSize:8}}>💊</div>}
            {!d.isPatch&&history.some(h=>h.date.includes(d.date))&&<div style={{width:5,height:5,borderRadius:"50%",background:d.isToday?C.beige:"#555"}}/>}
          </div>
        ))}
      </div>

      {error&&(
        <div style={{margin:"12px 16px",background:"#1a0000",border:`2px solid ${C.red}`,borderRadius:10,padding:"12px 16px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.red,lineHeight:1.6,fontWeight:"600"}}>
          ⚠ {error}
        </div>
      )}

      <div style={{padding:"20px 16px 70px"}}>

        {/* ═══════ CHECK-IN ═══════ */}
        {view==="checkin"&&(
          <div className="fade" style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:26,fontStyle:"italic",color:C.text,fontWeight:"700",textShadow:`0 0 20px ${C.blue}66`}}>{todayStr()}</div>

            {/* Garmin metrics */}
            <div style={card}>
              <div className="section-title">Garmin Metrics</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <div>
                  <div style={lbl}>HRV (ms)</div>
                  <input className="ifield" type="number" placeholder="e.g. 48" value={log.hrv} onChange={e=>setF("hrv",e.target.value)}/>
                </div>
                <div>
                  <div style={lbl}>Body Battery</div>
                  <input className="ifield" type="number" placeholder="e.g. 82" value={log.bodyBattery} onChange={e=>setF("bodyBattery",e.target.value)}/>
                </div>
                <div>
                  <div style={lbl}>Sleep (hrs)</div>
                  <input className="ifield" type="number" placeholder="7.5" step="0.5" value={log.sleep} onChange={e=>setF("sleep",e.target.value)}/>
                </div>
              </div>
            </div>

            {/* Sliders */}
            <div style={{...card,display:"flex",flexDirection:"column",gap:20}}>
              <div className="section-title" style={{marginBottom:0}}>How do you feel?</div>
              {[
                {key:"sleepQuality",lb:"Sleep quality",type:"sleepQ"},
                {key:"energy",lb:"Energy level",type:"energy"},
                {key:"stress",lb:"Stress level",type:"stress"},
              ].map(({key,lb,type})=>(
                <div key={key}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:"600",letterSpacing:"0.1em",textTransform:"uppercase",color:C.sub}}>{lb}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:20,fontWeight:"700",color:metricColor(log[key],type)}}>{log[key]}<span style={{fontSize:12,color:C.muted}}>/10</span></div>
                  </div>
                  <Slider value={log[key]} onChange={v=>setF(key,v)} color={metricColor(log[key],type)}/>
                </div>
              ))}
            </div>

            {/* Fasting */}
            <div style={card}>
              <div className="section-title">Fasting</div>
              <div style={lbl}>Last meal time</div>
              <input className="ifield" type="time" value={log.lastMealTime} onChange={e=>setF("lastMealTime",e.target.value)}/>
              {fastingHours&&(
                <div style={{marginTop:12,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:22,fontWeight:"700",color:fastingHours>=20?C.gold:fastingHours>=16?C.green:C.sub}}>{fastingHours}h</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted,fontWeight:"600"}}>fasted so far</div>
                  {fastingHours>=20&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.gold,fontWeight:"700",background:"#1a1200",border:`1px solid ${C.gold}44`,borderRadius:20,padding:"3px 10px"}}>EXTENDED</div>}
                </div>
              )}
            </div>

            {/* Training */}
            <div style={card}>
              <div className="section-title">Training</div>
              <div style={{display:"flex",flexWrap:"wrap",marginBottom:14}}>
                {TRAINING_OPTIONS.map(t=>(
                  <button key={t} className={`chip ${log.training===t?"chip-t":""}`} onClick={()=>toggleTrain(t)}>{t}</button>
                ))}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,borderTop:`1px solid #222`,paddingTop:14}}>
                <button onClick={()=>setF("fasted",!log.fasted)} style={{width:24,height:24,border:`2px solid ${log.fasted?C.beige:"#444"}`,borderRadius:6,background:log.fasted?"#1a1400":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {log.fasted&&<div style={{width:12,height:12,borderRadius:3,background:C.beige}}/>}
                </button>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:"600",color:log.fasted?C.beige:C.muted}}>Training fasted</span>
              </div>
            </div>

            {/* Supplements */}
            <div style={card}>
              <div className="section-title">Supplements</div>
              <div style={{display:"flex",flexWrap:"wrap"}}>
                {SUPPLEMENTS.map(s=>(
                  <button key={s.key} className={`chip ${log.supplements[s.key]?"chip-supp":""}`} onClick={()=>toggleSupp(s.key)}>{s.label}</button>
                ))}
              </div>
              {Object.values(log.supplements).every(v=>v)&&(
                <div style={{marginTop:12,fontFamily:"'DM Mono',monospace",fontSize:11,color:C.green,fontWeight:"700"}}>✓ All supplements taken</div>
              )}
            </div>

            {/* Migraine */}
            <div style={card}>
              <div className="section-title">Migraine</div>
              <div style={{display:"flex",gap:8}}>
                {MIGRAINE_OPTIONS.map(m=>(
                  <button key={m} className={`chip ${log.migraine===m?m==="Mild"?"chip-m-mild":m==="Moderate"?"chip-m-mod":m==="Severe"?"chip-m-sev":"chip-t":""}`}
                    style={{flex:1,justifyContent:"center"}}
                    onClick={()=>setF("migraine",m)}>{m}</button>
                ))}
              </div>
            </div>

            {/* Symptoms */}
            <div style={card}>
              <div className="section-title">Symptoms & Feelings</div>
              <div style={{display:"flex",flexWrap:"wrap"}}>
                {SYMPTOM_OPTIONS.map(s=>(
                  <button key={s} className={`chip ${log.symptoms.includes(s)?"chip-s":""}`} onClick={()=>toggleSym(s)}>{s}</button>
                ))}
              </div>
            </div>

            {/* Patch change */}
            {patchToday&&(
              <div style={{...card,border:`2px solid ${C.patch}55`,background:"#0d0008"}}>
                <div className="section-title" style={{color:C.patch}}>Patch Change</div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <button onClick={()=>setF("patchChanged",!log.patchChanged)} style={{width:26,height:26,border:`2px solid ${log.patchChanged?C.green:"#444"}`,borderRadius:6,background:log.patchChanged?"#001a0a":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {log.patchChanged&&<div style={{width:14,height:14,borderRadius:3,background:C.green}}/>}
                  </button>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:"600",color:log.patchChanged?C.green:C.sub}}>Patch changed this evening ✓</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div style={card}>
              <div className="section-title">Notes</div>
              <textarea className="ifield" placeholder="Anything else — cycle feelings, unusual stress, how training felt…" value={log.notes} onChange={e=>setF("notes",e.target.value)} rows={3}/>
            </div>

            <button className="sbtn" onClick={submitCheckin} disabled={loading}>
              {loading?"Generating your brief…":submitted?"Regenerate Brief →":"Generate Daily Brief →"}
            </button>
          </div>
        )}

        {/* ═══════ TODAY'S BRIEF ═══════ */}
        {view==="brief"&&(
          <div className="fade">
            <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:26,fontStyle:"italic",color:C.text,fontWeight:"700",marginBottom:6,textShadow:`0 0 20px ${C.blue}66`}}>Today's Brief</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.blue,marginBottom:20,fontWeight:"600",letterSpacing:"0.1em",textShadow:`0 0 8px ${C.blue}`}}>{cycleDay.toUpperCase()}</div>
            {loading?(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20,padding:"100px 0"}}>
                <div className="spinner"/>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.14em",fontWeight:"600"}}>Analyzing your data…</div>
              </div>
            ):brief?(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {/* Metric rings */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                  <div style={{...card,textAlign:"center",padding:"16px 8px"}}>
                    <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><ScoreRing value={Math.min(Number(log.hrv)||0,100)} max={100} color={log.hrv?metricColor(Number(log.hrv),"hrv"):"#333"}/></div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:19,fontWeight:"700",color:log.hrv?metricColor(Number(log.hrv),"hrv"):C.muted}}>{log.hrv||"—"}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.sub,marginTop:4,letterSpacing:"0.1em",fontWeight:"600"}}>HRV</div>
                  </div>
                  <div style={{...card,textAlign:"center",padding:"16px 8px"}}>
                    <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><ScoreRing value={Math.min(Number(log.bodyBattery)||0,100)} max={100} color={log.bodyBattery?(Number(log.bodyBattery)>=70?C.green:Number(log.bodyBattery)>=50?C.gold:C.red):"#333"}/></div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:19,fontWeight:"700",color:log.bodyBattery?(Number(log.bodyBattery)>=70?C.green:Number(log.bodyBattery)>=50?C.gold:C.red):C.muted}}>{log.bodyBattery||"—"}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.sub,marginTop:4,letterSpacing:"0.1em",fontWeight:"600"}}>BATTERY</div>
                  </div>
                  <div style={{...card,textAlign:"center",padding:"16px 8px"}}>
                    <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><ScoreRing value={log.energy} max={10} color={metricColor(log.energy,"energy")}/></div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:19,fontWeight:"700",color:metricColor(log.energy,"energy")}}>{log.energy}/10</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.sub,marginTop:4,letterSpacing:"0.1em",fontWeight:"600"}}>ENERGY</div>
                  </div>
                </div>

                {/* Fasting badge */}
                {fastingHours&&(
                  <div style={{...card,display:"flex",alignItems:"center",gap:14,padding:"14px 18px"}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:26,fontWeight:"700",color:fastingHours>=20?C.gold:C.green}}>{fastingHours}h</div>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,fontWeight:"600",letterSpacing:"0.1em"}}>FASTING</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:fastingHours>=20?C.gold:C.sub,marginTop:2,fontWeight:"600"}}>{fastingHours>=24?"24-hour fast 🏆":fastingHours>=20?"Extended fast":fastingHours>=16?"16:8 complete":"In progress"}</div>
                    </div>
                  </div>
                )}

                {/* Migraine alert */}
                {log.migraine!=="None"&&(
                  <div style={{...card,background:"#1a0000",borderColor:C.red,display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:22}}>🧠</span>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.red,fontWeight:"700",letterSpacing:"0.1em"}}>MIGRAINE LOGGED — {log.migraine.toUpperCase()}</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#AA4444",marginTop:3}}>{cycleDay.includes("Patch Change")?"Possible estrogen dip trigger":"Logged for pattern tracking"}</div>
                    </div>
                  </div>
                )}

                <div style={card}>{formatBrief(brief)}</div>

                {/* Supplement check */}
                <div style={{...card,padding:"14px 18px"}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,fontWeight:"700",letterSpacing:"0.12em",marginBottom:8}}>SUPPLEMENTS</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {SUPPLEMENTS.map(s=>(
                      <span key={s.key} style={{fontFamily:"'DM Mono',monospace",fontSize:10,padding:"4px 10px",borderRadius:20,border:`1px solid ${log.supplements[s.key]?C.green:"#333"}`,color:log.supplements[s.key]?C.green:"#444",fontWeight:"600"}}>
                        {log.supplements[s.key]?"✓ ":""}{s.label}
                      </span>
                    ))}
                  </div>
                </div>

                {log.training&&(
                  <div style={{...card,display:"flex",alignItems:"center",gap:14}}>
                    <div style={{width:42,height:42,borderRadius:"50%",background:"#1a1400",border:`2px solid ${C.beige}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                      {log.training.includes("Run")?"🏃":log.training.includes("Strength")?"💪":log.training.includes("Yoga")?"🧘":"⚡"}
                    </div>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:"700"}}>Today's plan</div>
                      <div style={{fontSize:16,color:C.beige,marginTop:4,fontWeight:"600"}}>{log.training}{log.fasted?" · Fasted":""}</div>
                    </div>
                  </div>
                )}
              </div>
            ):(
              <div style={{...card,textAlign:"center",padding:"70px 20px"}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:C.muted,fontWeight:"600"}}>Complete your check-in to generate today's brief</div>
                <button className="sbtn" style={{marginTop:24,width:"auto",padding:"13px 30px"}} onClick={()=>setView("checkin")}>Go to Check-in →</button>
              </div>
            )}
          </div>
        )}

        {/* ═══════ WEEKLY ═══════ */}
        {view==="weekly"&&(
          <div className="fade">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:26,fontStyle:"italic",color:C.text,fontWeight:"700",textShadow:`0 0 20px ${C.blue}66`}}>Weekly Report</div>
              <button className="sbtn" style={{width:"auto",padding:"10px 20px",fontSize:11}} onClick={generateWeekly} disabled={weekLoading||history.length<2}>
                {weekLoading?"Analyzing…":"Generate →"}
              </button>
            </div>
            {weekLoading?(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20,padding:"100px 0"}}>
                <div className="spinner"/>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.14em",fontWeight:"600"}}>Reviewing your week…</div>
              </div>
            ):weeklyReport?(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{...card,borderColor:`${C.patch}55`,boxShadow:`0 0 20px ${C.patch}22`}}>
                  <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:18,fontStyle:"italic",color:C.text,lineHeight:1.6,fontWeight:"700"}}>{weeklyReport.headline}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div style={{...card,textAlign:"center"}}>
                    <div style={{...lbl,marginBottom:10}}>Training Grade</div>
                    <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:56,color:gradeColor(weeklyReport.trainingGrade),lineHeight:1,fontWeight:"700"}}>{weeklyReport.trainingGrade}</div>
                  </div>
                  <div style={{...card,textAlign:"center"}}>
                    <div style={{...lbl,marginBottom:10}}>Recovery Trend</div>
                    <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:48,lineHeight:1,fontWeight:"700",color:weeklyReport.recoveryTrend==="improving"?C.green:weeklyReport.recoveryTrend==="declining"?C.red:C.gold}}>
                      {weeklyReport.recoveryTrend==="improving"?"↑":weeklyReport.recoveryTrend==="declining"?"↓":"→"}
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.sub,textTransform:"uppercase",letterSpacing:"0.1em",marginTop:8,fontWeight:"700"}}>{weeklyReport.recoveryTrend}</div>
                  </div>
                </div>
                {[
                  {lb:"Recovery & Sleep",text:weeklyReport.recoveryNote,col:C.green},
                  {lb:"Hormonal Balance",text:weeklyReport.hormoneNote,col:C.patch},
                  {lb:"Fasting Patterns",text:weeklyReport.fastingNote,col:C.gold},
                  {lb:"Training Load",text:weeklyReport.trainingNote,col:C.beige},
                  weeklyReport.migraineNote&&{lb:"Migraine Patterns",text:weeklyReport.migraineNote,col:C.red},
                  {lb:"Supplements",text:weeklyReport.supplementNote,col:C.green},
                ].filter(Boolean).map(({lb,text,col})=>(
                  <div key={lb} style={card}>
                    <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                      <div style={{width:4,background:col,borderRadius:2,alignSelf:"stretch",flexShrink:0,minHeight:48}}/>
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:col,marginBottom:8,fontWeight:"700"}}>{lb}</div>
                        <div style={{fontSize:14,lineHeight:1.8,color:C.text}}>{text}</div>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{...card,background:"#050a00",borderColor:`${C.green}55`,boxShadow:`0 0 16px ${C.green}22`}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:C.green,marginBottom:8,fontWeight:"700",textShadow:`0 0 10px ${C.green}`}}>Top Win This Week</div>
                  <div style={{fontSize:14,lineHeight:1.8,color:C.text}}>{weeklyReport.topWin}</div>
                </div>
                <div style={{...card,background:"#08000d",borderColor:`${C.patch}55`,boxShadow:`0 0 16px ${C.patch}22`}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.14em",textTransform:"uppercase",color:C.patch,marginBottom:8,fontWeight:"700",textShadow:`0 0 10px ${C.patch}`}}>Key Adjustment</div>
                  <div style={{fontSize:14,lineHeight:1.8,color:C.text}}>{weeklyReport.topAdjustment}</div>
                </div>
                <div style={{...card,borderColor:`${C.blue}55`,boxShadow:`0 0 16px ${C.blue}22`}}>
                  <div style={{...lbl,marginBottom:10}}>Next Week's Focus</div>
                  <div style={{fontFamily:"'Libre Baskerville',serif",fontStyle:"italic",fontSize:18,color:C.text,lineHeight:1.6,fontWeight:"700"}}>{weeklyReport.nextWeekFocus}</div>
                </div>
              </div>
            ):(
              <div style={{...card,textAlign:"center",padding:"70px 20px"}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:C.muted,fontWeight:"600"}}>{history.length<2?"Log at least 2 check-ins to generate your weekly report":"Click Generate to analyze your week"}</div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ HISTORY ═══════ */}
        {view==="history"&&(
          <div className="fade">
            <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:26,fontStyle:"italic",color:C.text,fontWeight:"700",marginBottom:20}}>Check-in Log</div>
            {history.length===0?(
              <div style={{...card,textAlign:"center",padding:"70px 20px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:"600"}}>No check-ins yet — start with today</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[...history].reverse().map((entry,i)=>(
                  <div key={i} style={card}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:17,fontStyle:"italic",color:C.text,fontWeight:"700"}}>{entry.date}</div>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        {entry.log.migraine&&entry.log.migraine!=="None"&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:10,padding:"3px 8px",borderRadius:20,border:`1px solid ${C.red}`,color:C.red,fontWeight:"700"}}>🧠 {entry.log.migraine}</span>}
                        {entry.log.training&&<span className="chip chip-t" style={{margin:0,fontSize:11,fontWeight:"700"}}>{entry.log.training}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:18,flexWrap:"wrap",marginBottom:10}}>
                      {entry.log.hrv&&<div><div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,marginBottom:4,letterSpacing:"0.1em",fontWeight:"700"}}>HRV</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:"700",color:metricColor(Number(entry.log.hrv),"hrv")}}>{entry.log.hrv}</div></div>}
                      {entry.log.bodyBattery&&<div><div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,marginBottom:4,letterSpacing:"0.1em",fontWeight:"700"}}>BATTERY</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:"700",color:Number(entry.log.bodyBattery)>=70?C.green:Number(entry.log.bodyBattery)>=50?C.gold:C.red}}>{entry.log.bodyBattery}</div></div>}
                      {entry.log.sleep&&<div><div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,marginBottom:4,letterSpacing:"0.1em",fontWeight:"700"}}>SLEEP</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:"700",color:C.green}}>{entry.log.sleep}h</div></div>}
                      <div><div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,marginBottom:4,letterSpacing:"0.1em",fontWeight:"700"}}>ENERGY</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:"700",color:metricColor(entry.log.energy,"energy")}}>{entry.log.energy}/10</div></div>
                      <div><div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,marginBottom:4,letterSpacing:"0.1em",fontWeight:"700"}}>STRESS</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:"700",color:metricColor(entry.log.stress,"stress")}}>{entry.log.stress}/10</div></div>
                    </div>
                    {entry.log.symptoms?.length>0&&(
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {entry.log.symptoms.map(s=><span key={s} className="chip chip-s" style={{margin:0,fontSize:10,fontWeight:"700"}}>{s}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
