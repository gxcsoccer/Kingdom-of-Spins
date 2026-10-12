import {tr} from '../i18n/index.js';
// Hands-on mini experiments for the science chapters. Tiny analytic models (stated as such), SVG + rAF.
import {useEffect, useRef, useState} from 'react';

function useLoop(run, step) {
  const s = useRef(step); s.current = step;
  useEffect(()=>{ if (!run) return; let raf, last = performance.now();
    const f = t => { const dt = Math.min(.05, (t-last)/1000); last = t; if (s.current(dt) !== false) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f); return ()=>cancelAnimationFrame(raf); }, [run]);
}
const Note = ({children}) => <div className="xp-note">⚙ {children}</div>;

// ① 转动惯量：同样的发射转速、同样的摩擦力矩，I 越大停得越慢（ω = ω0 − τ/I · t）。
function Disc({weights, angle, label, color, onToggle}) {
  return (
    <svg viewBox="-60 -60 120 120" className="xp-disc">
      <g transform={`rotate(${angle})`}>
        <circle r="50" fill={color} stroke="#111" strokeWidth="3"/>
        {[0,120,240].map(a=><path key={a} d="M0 -50 L12 -28 L-12 -28 Z" fill="#fff" stroke="#111" strokeWidth="2" transform={`rotate(${a})`}/>)}
        <circle r="9" fill="#111"/>
        {weights.map((outer,i)=>{ const a = (i*60+30)*Math.PI/180, r = outer ? 40 : 21; return (
          <rect key={i} x={r*Math.cos(a)-5} y={r*Math.sin(a)-5} width="10" height="10" rx="2" fill="#c9ced6" stroke="#111" strokeWidth="2" style={{cursor:'pointer'}} onClick={()=>onToggle?.(i)}/>); })}
      </g>
      <text y="58" textAnchor="middle" fontSize="9" fontWeight="900">{label}</text>
    </svg>
  );
}
export function InertiaLab({onDone}) {
  const [A, setA] = useState([1,1,1,1,1,1]), [B, setB] = useState([0,0,0,0,0,0]);
  const [st, setSt] = useState(null);   // {w:[..], ang:[..], t, stop:[..]}
  const I = ws => 1 + ws.reduce((s,o)=>s + .5*(o ? 40*40 : 21*21)/400, 0);   // disc + Σ m r² (units arbitrary)
  const W0 = 30, TAU = 48;   // tuned so the rim-weighted disc spins ~8 s
  useLoop(!!st && st.running, dt => setSt(s => { if (!s) return s;
    const w = s.w.map((x,i)=>Math.max(0, x - TAU/s.I[i]*dt)), ang = s.ang.map((a,i)=>a + w[i]*dt*57.3), t = s.t + dt;
    const stop = s.stop.map((v,i)=>v ?? (w[i]===0 ? t : null)), running = w.some(x=>x>0);
    if (!running) onDone?.(); return {...s, w, ang, t, stop, running}; }));
  const go = () => setSt({I:[I(A), I(B)], w:[W0, W0], ang:[0,0], t:0, stop:[null,null], running:true});
  const tog = (set) => i => { if (st?.running) return; set(ws=>ws.map((o,j)=>j===i ? 1-o : o)); setSt(null); };
  return (
    <div className="xp">
      <div className="xp-row">
        {[A,B].map((ws,i)=>(
          <div key={i} className="xp-cell">
            <Disc weights={ws} angle={st?.ang[i]||0} color={i?'#ffd9a0':'#a9cbff'} label={i?tr("陀螺 B"):tr("陀螺 A")} onToggle={tog(i?setB:setA)}/>
            <div className="xp-meter"><i style={{width:`${(st ? st.w[i]/W0 : 1)*100}%`}}/></div>
            <div className="xp-read">{tr("转动惯量 ")}{I(ws).toFixed(1)} · {st?.stop[i] ? tr("停在 {0} 秒", [st.stop[i].toFixed(1)]) : st ? tr("转动中…") : tr("点金属块：外圈 ↔ 中心")}</div>
          </div>))}
      </div>
      <button className="btn primary big" disabled={st?.running} onClick={go}>{tr("🌀 转！")}</button>
      <Note>{tr("小模型：两只陀螺一样重、发射转速一样、摩擦力矩一样；只有金属块的位置不同。")}</Note>
    </div>
  );
}

// ② 轴尖与摩擦：转速衰减 ∝ 摩擦力臂；跑动速度 ∝ 抓地（碰地半径）。数值来自游戏里的轴尖参数。
const TIP = {needle:{label:tr("尖轴"), arm:.35, grip:.2, c:'#14c9a5'}, ball:{label:tr("圆轴"), arm:.9, grip:.5, c:'#2f7bff'}, flat:{label:tr("平轴"), arm:2, grip:1, c:'#ff2d4a'}};
export function FrictionLab({onDone}) {
  const [st, setSt] = useState(null);
  useLoop(!!st?.running, dt => setSt(s => { const n = {...s, t:s.t+dt}; let any = false;
    for (const k of Object.keys(TIP)) { const r = {...s[k]}; if (r.w > 0) { r.w = Math.max(0, r.w - TIP[k].arm*.18*dt*10); r.pos += TIP[k].grip*r.w*dt*.06; r.ang += r.w*dt*60; if (r.w===0) r.stop = n.t; any = true; } n[k] = r; }
    n.running = any; if (!any) onDone?.(); return n; }));
  const go = () => setSt({t:0, running:true, ...Object.fromEntries(Object.keys(TIP).map(k=>[k,{w:10, pos:0, ang:0, stop:null}]))});
  return (
    <div className="xp">
      {Object.entries(TIP).map(([k,tp])=>{ const r = st?.[k]; return (
        <div key={k} className="xp-lane">
          <b style={{color:tp.c}}>{tp.label}</b>
          <div className="xp-track"><span className="xp-top" style={{left:`${Math.min(92, (r?.pos||0)*100)}%`, background:tp.c, transform:`rotate(${r?.ang||0}deg)`}}/></div>
          <div className="xp-meter small"><i style={{width:`${(r ? r.w/10 : 1)*100}%`, background:tp.c}}/></div>
          <span className="xp-read">{r?.stop ? tr("停在 {0} 秒 · 跑了 {1} 格", [r.stop.toFixed(1), Math.round(r.pos*100)]) : r ? tr("转动中…") : ''}</span>
        </div>); })}
      <button className="btn primary big" disabled={st?.running} onClick={go}>{tr("🌀 三个一起转！")}</button>
      <Note>{tr("小模型：转速掉得快慢看摩擦的“力臂”，跑得远近看抓地力；三只陀螺其他条件都一样。")}</Note>
    </div>
  );
}

// ③ 碰撞：一维碰撞（恢复系数 e），B 原本静止：vA' = (mA−e·mB)/(mA+mB)·v，vB' = (1+e)·mA/(mA+mB)·v；动量守恒，动能按 e 损失。
export function MomentumLab({onDone}) {
  const [mA, setMA] = useState(30), [mB, setMB] = useState(45);
  const [st, setSt] = useState(null);
  // Restitution e<1: spinning-top hits lose energy (sound, heat, wobble). e≈0.7 is a plausible plastic-on-plastic value.
  const [e, setE] = useState(.7);
  const v = 1, vA = (mA-e*mB)/(mA+mB)*v, vB = (1+e)*mA/(mA+mB)*v;
  const pBefore = mA*v, pAfter = mA*vA + mB*vB, keep = (mA*vA*vA + mB*vB*vB)/(mA*v*v);
  useLoop(!!st?.running, dt => setSt(s => { const t = s.t + dt; const hit = .35;
    const xa = t < hit ? .1 + v*t*.9 : .1 + v*hit*.9 + vA*(t-hit)*.9, xb = t < hit ? .5 : .5 + vB*(t-hit)*.9;
    const running = t < 1.6; if (!running) onDone?.(); return {t, xa, xb, running, hitShown: t >= hit}; }));
  const size = m => 18 + m*.5;
  return (
    <div className="xp">
      <div className="xp-arena">
        <span className="xp-ball a" style={{left:`${Math.max(2,Math.min(96,(st?.xa ?? .1)*100))}%`, width:size(mA), height:size(mA)}}>A</span>
        <span className="xp-ball b" style={{left:`${Math.min(96,(st?.xb ?? .5)*100)}%`, width:size(mB), height:size(mB)}}>B</span>
        {st?.hitShown && <span className="xp-boom">ガキン！</span>}
      </div>
      <div className="xp-sliders">
        <label>{tr("A 的重量 ")}{mA} g<input type="range" min="20" max="60" value={mA} onChange={e=>{setMA(+e.target.value); setSt(null);}}/></label>
        <label>{tr("B 的重量 ")}{mB} g<input type="range" min="20" max="60" value={mB} onChange={e=>{setMB(+e.target.value); setSt(null);}}/></label>
      </div>
      <label className="xp-sliders one"><span>{tr("碰撞有多“弹”（恢复系数 e）")}{e.toFixed(1)}{e>=.99?tr(" · 完全弹性"):e<=.01?tr(" · 粘在一起"):''}</span><input type="range" min="0" max="1" step=".1" value={e} onChange={x=>{setE(+x.target.value);setSt(null);}}/></label>
      <div className="xp-read big">{tr("撞完：A ")}{vA>=0?tr("向前"):tr("弹回")} {Math.abs(vA).toFixed(2)}{tr(" · B 被撞出 ")}{vB.toFixed(2)}{tr("（撞前 A = 1.00）")}</div>
      <div className="xp-read">{tr("动量 撞前 ")}{pBefore.toFixed(0)}{tr(" = 撞后 ")}{pAfter.toFixed(0)}{tr(" ✓ 守恒 · 动能剩下 ")}{Math.round(keep*100)}{tr("%（其余变成声音、热和晃动）")}</div>
      <button className="btn primary big" disabled={st?.running} onClick={()=>setSt({t:0, running:true})}>{tr("💥 撞！")}</button>
      <Note>{tr("小模型：一维正碰，B 原来不动；动量 = 质量 × 速度，撞前撞后总动量不变。真实陀螺还在旋转、会斜着撞，游戏对战里用的是完整的三维刚体物理。")}</Note>
    </div>
  );
}

// ④ 进动：Ω = m·g·r / (I·ω)；转速越快画圈越慢；太慢就倒。
export function PrecessionLab({onDone}) {
  const [rpm, setRpm] = useState(4000);
  const st = useRef({phi:0, spin:0, wob:0, tilt:10}); const [, force] = useState(0);
  const SPEEDUP = 4;   // 动画快放倍数（画面上写明）
  const fall = rpm < 350, omega = rpm*Math.PI/30;
  const Om = 0.042*9.81*0.012/(2.1e-5*omega);   // 进动角速度 rad/s = m·g·r / (I·ω)
  // 越接近“站不稳”的转速，倾角和晃动越大；转得快时几乎竖直（“睡着的陀螺”）
  const calm = Math.min(1, Math.max(0, (rpm-350)/2500));
  const targetTilt = fall ? 75 : 6 + 34*(1-calm)**2, wobAmp = fall ? 0 : 1.5 + 9*(1-calm)**2;
  useLoop(true, dt => { const s0 = st.current;
    s0.tilt += (targetTilt - s0.tilt)*Math.min(1, dt*(fall?2.5:3));
    if (!fall) { s0.phi += Om*dt*SPEEDUP; s0.wob += dt*(6 + 10*(1-calm)); }
    s0.spin += Math.min(rpm/60, 5)*dt*2*Math.PI*(fall?0.2:1);
    force(x=>x+1); });
  useEffect(()=>{ if (rpm<=800) onDone?.(); }, [rpm]);   // eslint-disable-line
  const {phi, spin, wob, tilt} = st.current, th = (tilt + Math.sin(wob)*wobAmp)*Math.PI/180, L = 95;
  const gx = 100, gy = 140, tx = gx + L*Math.sin(th)*Math.cos(phi), ty = gy - L*Math.cos(th) + L*Math.sin(th)*Math.sin(phi)*.35;
  const dcx = gx + (tx-gx)*.62, dcy = gy + (ty-gy)*.62, lean = Math.atan2(tx-gx, gy-ty)*180/Math.PI;
  const Lw = 18 + 52*Math.min(1, rpm/7000);   // 角动量箭头长度 ∝ 转速
  const ax = (tx-gx)/L, ay = (ty-gy)/L, lx = tx + ax*Lw, ly = ty + ay*Lw;
  const trailRx = L*Math.sin(tilt*Math.PI/180), dots = [0,1,2].map(k=>{const a = spin + k*2*Math.PI/3; return [Math.cos(a)*30, Math.sin(a)*8];});
  return (
    <div className="xp">
      <svg viewBox="0 0 200 165" className="xp-prec">
        <defs><marker id="prArr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#ff2d4a"/></marker>
          <marker id="prArrG" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#2f7bff"/></marker></defs>
        <ellipse cx={gx} cy={gy+2} rx="80" ry="12" fill="#e9e3d4"/>
        {!fall && <ellipse cx={gx} cy={gy - L*Math.cos(tilt*Math.PI/180)} rx={Math.max(2,trailRx)} ry={Math.max(1,trailRx*.35)} fill="none" stroke="#8a3cff" strokeDasharray="4 4"/>}
        <line x1={gx} y1={gy} x2={tx} y2={ty} stroke="#111" strokeWidth="4" strokeLinecap="round"/>
        <g transform={`translate(${dcx} ${dcy}) rotate(${lean})`}>
          <ellipse rx="32" ry="9" fill="#c6a8ff" stroke="#111" strokeWidth="3"/>
          {dots.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3" fill="#111" opacity={y>0?1:.35}/>)}
        </g>
        {!fall && <line x1={tx} y1={ty} x2={lx} y2={ly} stroke="#ff2d4a" strokeWidth="3.5" markerEnd="url(#prArr)"/>}
        {!fall && <text x={lx+4} y={ly} fontSize="8" fontWeight="900" fill="#ff2d4a">{tr("角动量")}</text>}
        <line x1={dcx} y1={dcy} x2={dcx} y2={dcy+24} stroke="#2f7bff" strokeWidth="2.5" markerEnd="url(#prArrG)"/>
        <text x={dcx+4} y={dcy+26} fontSize="8" fontWeight="900" fill="#2f7bff">{tr("重力")}</text>
        {fall && <text x="100" y="26" textAnchor="middle" fontSize="16" fontWeight="900" fill="#ff2d4a">{tr("倒下啦！")}</text>}
        {!fall && <text x="196" y="12" textAnchor="end" fontSize="7" fontWeight="800" fill="#888">{tr("画圈动画 ×")}{SPEEDUP}{tr(" 快放")}</text>}
      </svg>
      <label className="xp-sliders one">{tr("转速 ")}{rpm}{tr(" 转/分")}<input type="range" min="200" max="7000" step="50" value={rpm} onChange={e=>setRpm(+e.target.value)}/></label>
      <div className="xp-read big">{fall ? tr("转得太慢（低于 350 转），角动量太小，扛不住重力——倒了！")
        : tr("红箭头（角动量）{0}：画一圈要 {1} 秒，{2}。", [rpm>4000?tr("很长"):rpm>1500?tr("变短了"):tr("很短"), (2*Math.PI/Om).toFixed(1), calm>.7?tr("几乎竖直、很稳"):calm>.3?tr("开始歪着晃"):tr("晃得很厉害，快倒了")])}</div>
      <Note>{tr("小模型：进动角速度 = 重力力矩 ÷ 角动量（转得越快，画圈越慢）；越接近站不稳的转速晃得越厉害，低于 350 转/分当作“倒下”（和游戏对战规则一致）。")}</Note>
    </div>
  );
}

// ⑤ 潮汐：两个水鼓包朝着/背着月亮；港口水位 ∝ cos 2(θ港 − θ月)；太阳同向时（大潮）振幅更大。
export function TidesLab({onDone}) {
  const [hour, setHour] = useState(6), [spring, setSpring] = useState(true);
  const moon = 0, harbor = hour/24*2*Math.PI, amp = spring ? 1 : .37;   // 大潮 ∝ 月+日(1+0.46)，小潮 ∝ 月−日(1−0.46)：约 2.7 : 1
  const level = amp*Math.cos(2*(harbor-moon));
  const seen = useRef(new Set()); useEffect(()=>{ seen.current.add(level>.4?'hi':level<-.4?'lo':''); if (seen.current.has('hi')&&seen.current.has('lo')) onDone?.(); }, [level]);   // eslint-disable-line
  const R = 40, bul = 10*amp, hx = 100 + (R+4)*Math.cos(harbor), hy = 75 - (R+4)*Math.sin(harbor);
  return (
    <div className="xp">
      <svg viewBox="0 0 260 150" className="xp-tides">
        <ellipse cx="100" cy="75" rx={R+bul} ry={R-bul*.3} fill="#7fd3ff" stroke="#1d6fd1" strokeWidth="2"/>
        <circle cx="100" cy="75" r={R-6} fill="#8fd18a" stroke="#111" strokeWidth="2"/>
        <circle cx={hx} cy={hy} r="6" fill="#ff2d4a" stroke="#fff" strokeWidth="2"/>
        <circle cx="225" cy="75" r="12" fill="#f1f4f7" stroke="#111" strokeWidth="2"/><text x="225" y="100" textAnchor="middle" fontSize="10" fontWeight="900">{tr("月亮")}</text>
        {spring ? <><circle cx="16" cy="75" r="10" fill="#ffd400" stroke="#111"/><text x="16" y="98" textAnchor="middle" fontSize="9" fontWeight="900">{tr("太阳")}</text></>
          : <><circle cx="100" cy="12" r="9" fill="#ffd400" stroke="#111"/><text x="122" y="15" fontSize="9" fontWeight="900">{tr("太阳")}</text></>}
      </svg>
      <div className="xp-tidebar"><span>{tr("港口水位")}</span><div className="xp-meter"><i style={{width:`${(level+1)/2*100}%`}}/></div><b>{level>.4?tr("涨潮 🌊"):level<-.4?tr("落潮 🏖️"):tr("半潮")}</b></div>
      <div className="xp-sliders">
        <label>{tr("一天中的时间 ")}{hour}{tr(" 点（地球自转）")}<input type="range" min="0" max="24" value={hour} onChange={e=>setHour(+e.target.value)}/></label>
        <label className="xp-check"><input type="checkbox" checked={spring} onChange={e=>setSpring(e.target.checked)}/>{tr(" 太阳和月亮排成一线（新月/满月）")}</label>
      </div>
      <Note>{tr("示意模型：鼓包和天体大小都夸张了；真实的潮汐还受海岸地形影响。")}</Note>
    </div>
  );
}

// ⑥ 海拔与温度：T = T0 − 0.6 × h/100。
export function AltitudeLab({onDone}) {
  const [h, setH] = useState(0), [t0, setT0] = useState(28);
  const T = t0 - .6*h/100;
  useEffect(()=>{ if (h>=8000) onDone?.(); }, [h]);   // eslint-disable-line
  const zone = T>12 ? tr("🌲 森林") : T>3 ? tr("🌼 草甸") : T>0 ? tr("🪨 岩石") : tr("❄️ 冰雪");
  return (
    <div className="xp">
      <svg viewBox="0 0 260 150" className="xp-mount">
        <polygon points="20,145 130,10 240,145" fill="#9aa7b3" stroke="#111" strokeWidth="2"/>
        <polygon points="105,40 130,10 155,40 140,36 130,44 118,36" fill="#fff" stroke="#111" strokeWidth="1.5"/>
        <polygon points="20,145 70,85 190,85 240,145" fill="#6fbf73" opacity=".85"/>
        <circle cx="130" cy={145 - h/8849*135} r="6" fill="#ff2d4a" stroke="#fff" strokeWidth="2"/>
        <text x="148" y={149 - h/8849*135} fontSize="11" fontWeight="900">{T.toFixed(1)}°C</text>
      </svg>
      <div className="xp-sliders">
        <label>{tr("海拔 ")}{h}{tr(" 米")}{h>=8800?tr("（珠峰顶！8848.86 米）"):''}<input type="range" min="0" max="8849" step="50" value={h} onChange={e=>setH(+e.target.value)}/></label>
        <label>{tr("山脚（海边）气温 ")}{t0}°C<input type="range" min="5" max="35" value={t0} onChange={e=>setT0(+e.target.value)}/></label>
      </div>
      <div className="xp-read big">{tr("现在：")}{T.toFixed(1)}°C · {zone}</div>
      <Note>{tr("小模型：每升高 100 米降 0.6°C（平均值）。真实的植被分带还和雨量、坡向有关。")}</Note>
    </div>
  );
}

export const EXPERIMENTS = {inertia:InertiaLab, friction:FrictionLab, momentum:MomentumLab, precession:PrecessionLab, tides:TidesLab, altitude:AltitudeLab};
