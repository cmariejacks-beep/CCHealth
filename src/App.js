import { useState, useEffect } from "react";

// ── Palette ───────────────────────────────────────────────────────────────
const C = {
  bg:     "#0a0a0a",
  card:   "#141414",
  border: "#2c2c2c",
  text:   "#f2ead8",
  sub:    "#b8a888",
  muted:  "#6a5f4a",
  beige:  "#dcc49a",
  gold:   "#f0d080",
  green:  "#78ddb0",
  red:    "#ee7878",
};

const SYSTEM_PROMPT = `You are Colleen's personal health optimization advisor. You specialize in women's health, perimenopause, HRT, and performance optimization.

COLLEEN'S PROFILE:
- 42-year-old active female on HRT for perimenopause
- 16:8 intermittent fasting (12pm–8pm eating window, flexible on weekends)
- Trains after 4pm (sometimes fasted if she hasn't eaten yet)
- Runs 3x/week, strength 1–2x/week, yoga 1–2x/week
- Daily supplements: 5g creatine, psyllium husk, Vitamin D + K1/K2, red yeast rice, omega-3s
- Tracking devices: Garmin, Whoop, and/or Oura
- Optimization priorities: 1) Recovery & energy, 2) Hormonal balance/perimenopause, 3) Longevity, 4) Training performance, 5) Body composition

TOP PRIORITIES FOR YOUR ADVICE:
1. Recovery & energy first — always factor HRV, sleep, and subjective energy
2. Hormonal balance — cortisol, estrogen fluctuation patterns, HRT interactions
3. Longevity lens — autophagy, inflammation, metabolic health
4. Performance — but only when recovery allows
5. Body composition — last priority, never at expense of hormonal health

YOUR JOB:
Analyze the check-in data and give Colleen a SHORT, ACTIONABLE daily brief (4-6 sentences max). Include:
1. A one-line read on her recovery/readiness
2. A specific training recommendation for today based on her data
3. One nutrition/fasting insight relevant to today
4. One hormone/energy optimization tip if relevant
5. A single "focus for today" — one concrete thing to do

Be direct, specific, warm but not fluffy. No generic advice. Always tie recommendations to her actual data.`;

const WEEKLY_SYSTEM = `You are Colleen's health optimization advisor. Review her week of check-in data and provide a weekly optimization report.

COLLEEN'S PROFILE: 42F, HRT for perimenopause, 16:8 IF (12-8pm), trains after 4pm, runs 3x/week + strength 1-2x/week + yoga 1-2x/week. Supplements: creatine 5g, psyllium husk, Vit D+K1/K2, red yeast rice, omegas. Devices: Garmin/Whoop/Oura. Priorities: 1) Recovery/energy, 2) Hormonal balance, 3) Longevity, 4) Performance, 5) Body composition.

Return ONLY a valid JSON object (no markdown, no backticks):
{
  "headline": "one punchy sentence summarizing the week",
  "recoveryTrend": "improving | declining | stable",
  "recoveryNote": "2 sentences on HRV/sleep trend",
  "hormoneNote": "2 sentences on patterns relevant to perimenopause/HRT",
  "trainingGrade": "A | B | C | D",
  "trainingNote": "2 sentences on training load/balance",
  "topWin": "one specific thing she did well this week",
  "topAdjustment": "one specific change to make next week",
  "nextWeekFocus": "one clear priority for next week"
}`;

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const TRAINING_OPTIONS = ["Rest","Easy Run","Tempo/Intervals","Long Run","Strength","Yoga/Mobility","Fasted Training"];
const SYMPTOM_OPTIONS = ["Brain fog","Mood dip","Hot flashes","Poor sleep","Joint aches","Low libido","Fatigue","Great energy","Strong performance"];

function todayStr() {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function getWeekDays() {
  const d = new Date();
  return Array.from({length:7},(_,i)=>{
    const day = new Date(d);
    day.setDate(d.getDate()-6+i);
    return { label: DAYS[day.getDay()], date: day.getDate(), isToday: i===6 };
  });
}

function metricColor(v, type) {
  if (type==="energy"||type==="sleepQ") return v>=7?C.green:v>=5?C.gold:C.red;
  if (type==="stress") return v<=4?C.green:v<=6?C.gold:C.red;
  if (type==="hrv") return v>=50?C.green:v>=35?C.gold:C.red;
  return C.green;
}

function gradeColor(g) { return ({A:C.green,B:C.gold,C:"#f0a840",D:C.red})[g]||C.sub; }

function ScoreRing({ value, max=10, color, size=58 }) {
  const r=(size-10)/2, circ=2*Math.PI*r, dash=circ*(Math.min(value,max)/max);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#222" strokeWidth="6"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray 0.8s ease"}}/>
    </svg>
  );
}

function Slider({ value, onChange, color }) {
  return (
    <div style={{position:"relative",height:32,display:"flex",alignItems:"center"}}>
      <input type="range" min={1} max={10} value={value}
        onChange={e=>onChange(Number(e.target.value))}
        style={{width:"calc(100% - 36px)",accentColor:color,cursor:"pointer"}}/>
      <span style={{position:"absolute",right:0,fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:"500",color}}>{value}</span>
    </div>
  );
}

const emptyLog = {
  hrv:"", sleep:"", sleepQuality:6, energy:6, stress:4,
  training:"", fasted:false, symptoms:[], notes:""
};

// ── API call using env var for key ────────────────────────────────────────
async function callClaude(system, messages) {
  const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;
  if (!apiKey) throw new Error("No API key set. Add REACT_APP_ANTHROPIC_KEY to your Vercel environment variables.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system, messages })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.find(b=>b.type==="text")?.text || "";
}

export default function App() {
  const [view, setView] = useState("checkin");
  const [log, setLog] = useState({...emptyLog});
  const [history, setHistory] = useState([]);
  const [brief, setBrief] = useState("");
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const weekDays = getWeekDays();

  // Load from localStorage
  useEffect(()=>{
    try {
      const h = localStorage.getItem("colleen_history");
      if (h) setHistory(JSON.parse(h));
      const t = localStorage.getItem("colleen_today");
      if (t) {
        const s = JSON.parse(t);
        if (s.date === todayStr()) {
          setLog(s.log); setSubmitted(true);
          if (s.brief) setBrief(s.brief);
        }
      }
    } catch(e) {}
  },[]);

  const setF=(k,v)=>setLog(p=>({...p,[k]:v}));
  const toggleSym=(s)=>setLog(p=>({...p,symptoms:p.symptoms.includes(s)?p.symptoms.filter(x=>x!==s):[...p.symptoms,s]}));
  const toggleTrain=(t)=>setLog(p=>({...p,training:p.training===t?"":t}));

  const submitCheckin = async () => {
    setLoading(true); setError(""); setView("brief");
    const prompt = `Daily check-in for ${todayStr()}:
- HRV: ${log.hrv||"not logged"} ms
- Sleep: ${log.sleep||"not logged"} hours, quality ${log.sleepQuality}/10
- Energy: ${log.energy}/10
- Stress: ${log.stress}/10
- Training planned: ${log.training||"undecided"}
- Fasted training: ${log.fasted?"yes":"no"}
- Symptoms: ${log.symptoms.join(", ")||"none"}${log.notes?" — "+log.notes:""}

Give me my daily optimization brief.`;
    try {
      const text = await callClaude(SYSTEM_PROMPT, [{role:"user",content:prompt}]);
      setBrief(text); setSubmitted(true);
      const entry = {date:todayStr(),log:{...log},brief:text,ts:Date.now()};
      const newH = [...history.filter(h=>h.date!==todayStr()),entry].slice(-28);
      setHistory(newH);
      localStorage.setItem("colleen_history", JSON.stringify(newH));
      localStorage.setItem("colleen_today", JSON.stringify({date:todayStr(),log:{...log},brief:text}));
    } catch(e) {
      setError(e.message || "Something went wrong. Check your API key in Vercel settings.");
    }
    setLoading(false);
  };

  const generateWeekly = async () => {
    setWeekLoading(true); setError("");
    const last = history.slice(-7);
    if (last.length < 2) { setWeekLoading(false); return; }
    const summary = last.map(e=>`${e.date}: HRV ${e.log.hrv||"?"}, sleep ${e.log.sleep||"?"}h (${e.log.sleepQuality}/10), energy ${e.log.energy}/10, stress ${e.log.stress}/10, training: ${e.log.training||"none"}, symptoms: ${e.log.symptoms.join(",")||"none"}`).join("\n");
    try {
      const text = await callClaude(WEEKLY_SYSTEM, [{role:"user",content:`Weekly data:\n${summary}\n\nGenerate my weekly report as JSON only.`}]);
      setWeeklyReport(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(e) {
      setError(e.message || "Failed to generate weekly report.");
    }
    setWeekLoading(false);
  };

  const formatBrief=(text)=>text.split("\n").map((line,i)=>{
    line=line.replace(/\*\*(.*?)\*\*/g,`<strong style="color:${C.text}">$1</strong>`);
    if(/^#+\s/.test(line))
      return <div key={i} style={{fontFamily:"'DM Mono',monospace",fontSize:11,textTransform:"uppercase",letterSpacing:"0.14em",color:C.beige,margin:"16px 0 8px"}} dangerouslySetInnerHTML={{__html:line.replace(/^#+\s/,"")}}/>;
    if(/^[-•]\s/.test(line.trim()))
      return <div key={i} style={{paddingLeft:22,position:"relative",margin:"5px 0",lineHeight:1.8,fontSize:15,color:C.text}} dangerouslySetInnerHTML={{__html:`<span style="position:absolute;left:0;color:${C.beige}">—</span>${line.trim().slice(2)}`}}/>;
    if(!line.trim()) return <div key={i} style={{height:10}}/>;
    return <div key={i} style={{margin:"4px 0",lineHeight:1.8,fontSize:15,color:C.text}} dangerouslySetInnerHTML={{__html:line}}/>;
  });

  const card={background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20};
  const lbl={fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.12em",textTransform:"uppercase",color:C.sub,marginBottom:10};

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Georgia',serif",maxWidth:600,margin:"0 auto"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0a0a}
        ::-webkit-scrollbar{width:0}
        input[type=range]{-webkit-appearance:none;height:3px;border-radius:2px;background:#2c2c2c;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:currentColor;cursor:pointer}
        input[type=number]{-moz-appearance:textfield}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade{animation:fadeUp 0.35s ease forwards}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spinner{width:26px;height:26px;border:2px solid #252525;border-top-color:${C.green};border-radius:50%;animation:spin 0.85s linear infinite}
        .chip{display:inline-flex;align-items:center;padding:9px 16px;border-radius:24px;border:1px solid #2c2c2c;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;color:${C.sub};background:transparent;margin:3px;transition:all 0.15s;-webkit-tap-highlight-color:transparent}
        .chip:active{opacity:0.7}
        .chip-t{border-color:${C.beige}!important;color:${C.beige}!important}
        .chip-s{border-color:${C.gold}!important;color:${C.gold}!important}
        .ifield{background:#0d0d0d;border:1px solid #2c2c2c;border-radius:10px;padding:13px 16px;color:${C.text};font-family:'DM Mono',monospace;font-size:15px;width:100%;outline:none;transition:border-color 0.2s;-webkit-appearance:none}
        .ifield:focus{border-color:${C.beige}77}
        .ifield::placeholder{color:${C.muted}}
        textarea.ifield{resize:none;font-family:'Georgia',serif;font-size:15px;min-height:80px;line-height:1.6}
        .sbtn{width:100%;padding:17px;background:#181410;border:1.5px solid ${C.beige}66;border-radius:13px;color:${C.beige};font-family:'DM Mono',monospace;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;-webkit-tap-highlight-color:transparent}
        .sbtn:active{opacity:0.75}
        .sbtn:disabled{opacity:0.28;cursor:default}
        .navbtn{background:none;border:none;cursor:pointer;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;padding:9px 13px;border-radius:8px;transition:all 0.2s;-webkit-tap-highlight-color:transparent}
      `}</style>

      {/* ── Header ── */}
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"16px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:C.bg,zIndex:10}}>
        <div>
          <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:18,fontStyle:"italic",color:C.text}}>Colleen</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.muted,letterSpacing:"0.14em",textTransform:"uppercase",marginTop:3}}>Health · Performance · Longevity</div>
        </div>
        <div style={{display:"flex",gap:1}}>
          {[["checkin","Check-in"],["brief","Today"],["weekly","Weekly"],["history","Log"]].map(([v,l])=>(
            <button key={v} className="navbtn"
              style={{color:view===v?C.beige:C.muted,background:view===v?"#1c1710":"none"}}
              onClick={()=>setView(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Week strip ── */}
      <div style={{padding:"14px 18px",display:"flex",gap:6,justifyContent:"center",borderBottom:"1px solid #111"}}>
        {weekDays.map((d,i)=>{
          const has=history.some(h=>h.date.includes(d.date));
          return (
            <div key={i} style={{width:40,height:58,borderRadius:22,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,border:`1px solid ${d.isToday?C.beige+"77":has?"#333":"#1a1a1a"}`,background:d.isToday?"#181410":"#0d0d0d"}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:d.isToday?C.beige:has?C.muted:"#2a2a2a",letterSpacing:"0.06em"}}>{d.label}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:d.isToday?"500":"400",color:d.isToday?C.beige:has?C.sub:"#2a2a2a"}}>{d.date}</div>
              {has&&<div style={{width:5,height:5,borderRadius:"50%",background:d.isToday?C.beige:"#555"}}/>}
            </div>
          );
        })}
      </div>

      {/* ── Error banner ── */}
      {error&&(
        <div style={{margin:"12px 16px",background:"#1a0808",border:`1px solid ${C.red}44`,borderRadius:10,padding:"12px 16px",fontFamily:"'DM Mono',monospace",fontSize:12,color:C.red,lineHeight:1.6}}>
          ⚠ {error}
        </div>
      )}

      <div style={{padding:"20px 16px 60px"}}>

        {/* ═══════ CHECK-IN ═══════ */}
        {view==="checkin"&&(
          <div className="fade" style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:24,fontStyle:"italic",color:C.text,marginBottom:2}}>{todayStr()} — Daily Check-in</div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={card}>
                <div style={lbl}>HRV (ms)</div>
                <input className="ifield" type="number" placeholder="e.g. 48" value={log.hrv} onChange={e=>setF("hrv",e.target.value)}/>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.muted,marginTop:8}}>Whoop · Oura · Garmin</div>
              </div>
              <div style={card}>
                <div style={lbl}>Sleep (hrs)</div>
                <input className="ifield" type="number" placeholder="e.g. 7.5" step="0.5" value={log.sleep} onChange={e=>setF("sleep",e.target.value)}/>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:C.muted,marginTop:8}}>Total last night</div>
              </div>
            </div>

            <div style={{...card,display:"flex",flexDirection:"column",gap:20}}>
              {[
                {key:"sleepQuality",lb:"Sleep quality",type:"sleepQ"},
                {key:"energy",lb:"Energy level",type:"energy"},
                {key:"stress",lb:"Stress level",type:"stress"},
              ].map(({key,lb,type})=>(
                <div key={key}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:"0.1em",textTransform:"uppercase",color:C.sub}}>{lb}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:17,fontWeight:"500",color:metricColor(log[key],type)}}>{log[key]}<span style={{fontSize:11,color:C.muted}}>/10</span></div>
                  </div>
                  <Slider value={log[key]} onChange={v=>setF(key,v)} color={metricColor(log[key],type)}/>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={lbl}>Today's Training</div>
              <div style={{display:"flex",flexWrap:"wrap",marginBottom:14}}>
                {TRAINING_OPTIONS.map(t=>(
                  <button key={t} className={`chip ${log.training===t?"chip-t":""}`} onClick={()=>toggleTrain(t)}>{t}</button>
                ))}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,borderTop:`1px solid ${C.border}`,paddingTop:14}}>
                <button onClick={()=>setF("fasted",!log.fasted)} style={{width:24,height:24,border:`1.5px solid ${log.fasted?C.beige:"#333"}`,borderRadius:6,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {log.fasted&&<div style={{width:12,height:12,borderRadius:3,background:C.beige}}/>}
                </button>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:log.fasted?C.beige:C.muted}}>Training fasted today</span>
              </div>
            </div>

            <div style={card}>
              <div style={lbl}>How are you feeling?</div>
              <div style={{display:"flex",flexWrap:"wrap"}}>
                {SYMPTOM_OPTIONS.map(s=>(
                  <button key={s} className={`chip ${log.symptoms.includes(s)?"chip-s":""}`} onClick={()=>toggleSym(s)}>{s}</button>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={lbl}>Anything else?</div>
              <textarea className="ifield" placeholder="Cycle phase, stress, food timing, how last session felt…" value={log.notes} onChange={e=>setF("notes",e.target.value)} rows={3}/>
            </div>

            <button className="sbtn" onClick={submitCheckin} disabled={loading}>
              {loading?"Generating your brief…":submitted?"Regenerate Brief →":"Generate Daily Brief →"}
            </button>
          </div>
        )}

        {/* ═══════ TODAY'S BRIEF ═══════ */}
        {view==="brief"&&(
          <div className="fade">
            <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:24,fontStyle:"italic",color:C.text,marginBottom:20}}>Today's Brief</div>
            {loading?(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20,padding:"90px 0"}}>
                <div className="spinner"/>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.12em"}}>Analyzing your data…</div>
              </div>
            ):brief?(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {(log.hrv||log.sleep)&&(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                    {log.hrv&&(
                      <div style={{...card,textAlign:"center",padding:"16px 8px"}}>
                        <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><ScoreRing value={Math.min(Number(log.hrv),100)} max={100} color={metricColor(Number(log.hrv),"hrv")}/></div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:"500",color:metricColor(Number(log.hrv),"hrv")}}>{log.hrv}</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.sub,marginTop:4,letterSpacing:"0.1em"}}>HRV</div>
                      </div>
                    )}
                    {log.sleep&&(
                      <div style={{...card,textAlign:"center",padding:"16px 8px"}}>
                        <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><ScoreRing value={Math.min(Number(log.sleep),9)} max={9} color={Number(log.sleep)>=7?C.green:Number(log.sleep)>=6?C.gold:C.red}/></div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:"500",color:C.green}}>{log.sleep}h</div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.sub,marginTop:4,letterSpacing:"0.1em"}}>Sleep</div>
                      </div>
                    )}
                    <div style={{...card,textAlign:"center",padding:"16px 8px"}}>
                      <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><ScoreRing value={log.energy} max={10} color={metricColor(log.energy,"energy")}/></div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:"500",color:metricColor(log.energy,"energy")}}>{log.energy}/10</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.sub,marginTop:4,letterSpacing:"0.1em"}}>Energy</div>
                    </div>
                  </div>
                )}
                <div style={card}>{formatBrief(brief)}</div>
                {log.training&&(
                  <div style={{...card,display:"flex",alignItems:"center",gap:14}}>
                    <div style={{width:40,height:40,borderRadius:"50%",background:"#181410",border:`1px solid ${C.beige}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                      {log.training.includes("Run")?"🏃":log.training.includes("Strength")?"💪":log.training.includes("Yoga")?"🧘":"⚡"}
                    </div>
                    <div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Today's plan</div>
                      <div style={{fontSize:16,color:C.beige,marginTop:4}}>{log.training}{log.fasted?" · Fasted":""}</div>
                    </div>
                  </div>
                )}
              </div>
            ):(
              <div style={{...card,textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.muted}}>Complete your check-in to generate today's brief</div>
                <button className="sbtn" style={{marginTop:22,width:"auto",padding:"12px 28px"}} onClick={()=>setView("checkin")}>Go to Check-in →</button>
              </div>
            )}
          </div>
        )}

        {/* ═══════ WEEKLY ═══════ */}
        {view==="weekly"&&(
          <div className="fade">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:24,fontStyle:"italic",color:C.text}}>Weekly Report</div>
              <button className="sbtn" style={{width:"auto",padding:"10px 20px",fontSize:11}} onClick={generateWeekly} disabled={weekLoading||history.length<2}>
                {weekLoading?"Analyzing…":"Generate →"}
              </button>
            </div>
            {weekLoading?(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20,padding:"90px 0"}}>
                <div className="spinner"/>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:C.muted,letterSpacing:"0.12em"}}>Reviewing your week…</div>
              </div>
            ):weeklyReport?(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{...card,borderColor:C.beige+"44"}}>
                  <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:17,fontStyle:"italic",color:C.text,lineHeight:1.6}}>{weeklyReport.headline}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div style={{...card,textAlign:"center"}}>
                    <div style={{...lbl,marginBottom:10}}>Training Grade</div>
                    <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:52,color:gradeColor(weeklyReport.trainingGrade),lineHeight:1}}>{weeklyReport.trainingGrade}</div>
                  </div>
                  <div style={{...card,textAlign:"center"}}>
                    <div style={{...lbl,marginBottom:10}}>Recovery Trend</div>
                    <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:44,lineHeight:1,color:weeklyReport.recoveryTrend==="improving"?C.green:weeklyReport.recoveryTrend==="declining"?C.red:C.gold}}>
                      {weeklyReport.recoveryTrend==="improving"?"↑":weeklyReport.recoveryTrend==="declining"?"↓":"→"}
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.sub,textTransform:"uppercase",letterSpacing:"0.1em",marginTop:8}}>{weeklyReport.recoveryTrend}</div>
                  </div>
                </div>
                {[
                  {lb:"Recovery & Sleep",text:weeklyReport.recoveryNote,col:C.green},
                  {lb:"Hormonal Balance",text:weeklyReport.hormoneNote,col:C.beige},
                  {lb:"Training Load",text:weeklyReport.trainingNote,col:C.gold},
                ].map(({lb,text,col})=>(
                  <div key={lb} style={card}>
                    <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                      <div style={{width:3,background:col,borderRadius:2,alignSelf:"stretch",flexShrink:0,minHeight:48}}/>
                      <div>
                        <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.12em",textTransform:"uppercase",color:col,marginBottom:8}}>{lb}</div>
                        <div style={{fontSize:14,lineHeight:1.8,color:C.text}}>{text}</div>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{...card,background:"#141008",borderColor:C.gold+"44"}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.12em",textTransform:"uppercase",color:C.gold,marginBottom:8}}>Top Win This Week</div>
                  <div style={{fontSize:14,lineHeight:1.8,color:C.text}}>{weeklyReport.topWin}</div>
                </div>
                <div style={{...card,background:"#130e08",borderColor:C.beige+"44"}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.12em",textTransform:"uppercase",color:C.beige,marginBottom:8}}>Key Adjustment</div>
                  <div style={{fontSize:14,lineHeight:1.8,color:C.text}}>{weeklyReport.topAdjustment}</div>
                </div>
                <div style={card}>
                  <div style={{...lbl,marginBottom:10}}>Next Week's Focus</div>
                  <div style={{fontFamily:"'Libre Baskerville',serif",fontStyle:"italic",fontSize:17,color:C.text,lineHeight:1.6}}>{weeklyReport.nextWeekFocus}</div>
                </div>
              </div>
            ):(
              <div style={{...card,textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:C.muted}}>{history.length<2?"Log at least 2 check-ins to generate your weekly report":"Click Generate to analyze your week"}</div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ HISTORY ═══════ */}
        {view==="history"&&(
          <div className="fade">
            <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:24,fontStyle:"italic",color:C.text,marginBottom:20}}>Check-in Log</div>
            {history.length===0?(
              <div style={{...card,textAlign:"center",padding:"60px 20px",color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:12}}>No check-ins yet — start with today</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[...history].reverse().map((entry,i)=>(
                  <div key={i} style={card}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:16,fontStyle:"italic",color:C.text}}>{entry.date}</div>
                      {entry.log.training&&<span className="chip chip-t" style={{margin:0,fontSize:11}}>{entry.log.training}</span>}
                    </div>
                    <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                      {entry.log.hrv&&<div><div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,marginBottom:4,letterSpacing:"0.1em"}}>HRV</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:17,fontWeight:"500",color:metricColor(Number(entry.log.hrv),"hrv")}}>{entry.log.hrv}</div></div>}
                      {entry.log.sleep&&<div><div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,marginBottom:4,letterSpacing:"0.1em"}}>SLEEP</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:17,fontWeight:"500",color:C.green}}>{entry.log.sleep}h</div></div>}
                      <div><div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,marginBottom:4,letterSpacing:"0.1em"}}>ENERGY</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:17,fontWeight:"500",color:metricColor(entry.log.energy,"energy")}}>{entry.log.energy}/10</div></div>
                      <div><div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:C.muted,marginBottom:4,letterSpacing:"0.1em"}}>STRESS</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:17,fontWeight:"500",color:metricColor(entry.log.stress,"stress")}}>{entry.log.stress}/10</div></div>
                    </div>
                    {entry.log.symptoms.length>0&&(
                      <div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:4}}>
                        {entry.log.symptoms.map(s=><span key={s} className="chip chip-s" style={{margin:0,fontSize:11}}>{s}</span>)}
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
