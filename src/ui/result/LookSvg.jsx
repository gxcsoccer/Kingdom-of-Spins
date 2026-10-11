// 孩子设计的陀螺（有 look）在结果页的 2D 立绘：和 3D 模型同一套外形 / 花纹 / 徽章 / 涂装，只是画成平面漫画图标。
import {useId} from 'react';
import {specFromBey} from '../../physics/model.js';
import {normLook,visualOutline} from '../../scene/look.js';
import {ICONS,DETAIL,INK,lum} from '../../scene/toon.js';

// Replays a canvas-path function (moveTo/lineTo/…) into an SVG path string.
function svgPath(fn){
  if(!fn)return '';let d='';const f=n=>+n.toFixed(2);
  fn({moveTo:(x,y)=>{d+=`M${f(x)} ${f(y)}`;},lineTo:(x,y)=>{d+=(d?'L':'M')+`${f(x)} ${f(y)}`;},quadraticCurveTo:(a,b,x,y)=>{d+=`Q${f(a)} ${f(b)} ${f(x)} ${f(y)}`;},
    closePath:()=>{d+='Z';},arc:(x,y,r)=>{d+=`M${f(x-r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2*r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2*r)} 0Z`;},rect:(x,y,w,h)=>{d+=`M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;}});
  return d;
}
const PATTERN={
  bolts:(c)=><path d="M9 0 L2 9 L6 9 L1 18 L13 7 L8 7 L12 0Z" fill={c} stroke={INK} strokeWidth=".9" strokeLinejoin="round"/>,
  stripes:(c)=><path d="M0 18 L6 18 L18 6 L18 0 Z" fill={c} stroke={INK} strokeWidth=".8"/>,
  dots:(c)=><circle cx="9" cy="9" r="3.2" fill={c} stroke={INK} strokeWidth=".8"/>,
  flames:(c)=><path d="M2 18 Q3 10 9 5 Q7 11 12 10 Q11 14 15 18Z" fill={c} stroke={INK} strokeWidth=".8"/>,
};

export default function LookSvg({bey,size=150,spin=false}){
  const id=useId().replace(/:/g,'');
  const spec=specFromBey(bey), k=1/.032*46, c=bey.colors||{}, look=normLook(bey.look)||{shape:'blade',finish:'toon',emblem:'letter',pattern:'none'};
  const prim=c.primary||'#888', sec=c.secondary||'#eee', acc=c.accent||'#ffd400';
  const mark=lum(acc)>.42&&Math.abs(lum(acc)-lum(prim))>.18?acc:sec;      // pattern colour that reads on the blade
  const wings=Array.from({length:spec.wings},(_,i)=>visualOutline(spec,i,look.shape).map(([x,y])=>`${(x*k).toFixed(2)},${(-y*k).toFixed(2)}`).join(' '));
  const disc=[acc,sec,'#ffffff'].find(x=>x&&lum(x)>.42)||'#ffffff';
  const icon=look.emblem!=='letter'&&ICONS[look.emblem];
  const letter=(bey.name||'?').replace(/[^A-Za-z]/g,'').slice(0,1)||'★';
  const metal=look.finish==='metal', crystal=look.finish==='crystal', neon=look.finish==='neon';
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} style={spin?{animation:'spinslow 1.2s linear infinite'}:undefined} aria-label={bey.name}>
      <defs>
        <pattern id={`p${id}`} width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">{PATTERN[look.pattern]?.(mark)}</pattern>
        <pattern id={`t${id}`} width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".55" fill="rgba(0,0,0,.35)"/></pattern>
        <linearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={metal?.75:crystal?.6:.25}/><stop offset=".45" stopColor="#fff" stopOpacity="0"/>
          <stop offset=".62" stopColor="#000" stopOpacity={metal?.28:.1}/><stop offset=".8" stopColor="#fff" stopOpacity={metal?.45:.15}/><stop offset="1" stopColor="#000" stopOpacity=".2"/>
        </linearGradient>
        {neon&&<filter id={`g${id}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4"/></filter>}
      </defs>
      <circle r="47" fill="none" stroke="#111" strokeWidth=".6" strokeDasharray="2 3" opacity=".35"/>
      {neon&&wings.map((pts,i)=><polygon key={'n'+i} points={pts} fill="none" stroke={acc} strokeWidth="5" filter={`url(#g${id})`} opacity=".9"/>)}
      {wings.map((pts,i)=>(<g key={i}>
        <polygon points={pts} fill={prim} opacity={crystal?.82:1}/>
        {PATTERN[look.pattern]&&<polygon points={pts} fill={`url(#p${id})`}/>}
        {look.finish==='toon'&&<polygon points={pts} fill={`url(#t${id})`} opacity=".5" style={{mixBlendMode:'multiply'}} transform="translate(1.5,1.5) scale(.92)"/>}
        <polygon points={pts} fill={`url(#m${id})`}/>
        <polygon points={pts} fill="none" stroke={neon?acc:INK} strokeWidth="2.2" strokeLinejoin="round"/>
      </g>))}
      <circle r={20} fill={sec} stroke={INK} strokeWidth="2.2"/>
      {metal&&<circle r={20} fill={`url(#m${id})`}/>}
      <circle r={16} fill="none" stroke={INK} strokeWidth="1.1" strokeDasharray={spec.style==='attack'?'4 2':'1 0'}/>
      <circle r={13.5} fill={disc} stroke={INK} strokeWidth="2"/>
      {icon?<g transform="scale(.23)" strokeLinejoin="round">
          <path d={svgPath(icon)} fill={INK} stroke={disc} strokeWidth="10" paintOrder="stroke"/>
          {DETAIL[look.emblem]&&<path d={svgPath(DETAIL[look.emblem])} fill={disc}/>}
        </g>
        :<text y="4.6" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="13" fill="#fff" stroke={INK} strokeWidth="1.2" paintOrder="stroke">{letter}</text>}
      <path d="M-30 -36 Q-40 -20 -38 -4" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".9"/>
    </svg>
  );
}
