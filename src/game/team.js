import {tr} from '../i18n/index.js';
// Teammates who can take a round: their specialty comes from their real launch parameters,
// and they launch automatically along the same path as the CPU (small deterministic jitter).
import {BLADERS} from './story.js';
const bladerById=id=>BLADERS.find(b=>b.id===id);
import {cpuLaunch} from './launch.js';

export const SKILLS={
  gale:{name:tr("疾风发射"),icon:'🌪️',short:tr("发射转速高"),
    why:tr("发射时转得特别快：转速越高，陀螺带着的转动能量越多，能撑得更久，撞上去也更有力。")},
  straight:{name:tr("笔直发射"),icon:'📏',short:tr("倾角小，更稳"),
    why:tr("发射时陀螺几乎是直立的：倾角小，轴尖贴地稳，不容易一落地就晃，转速也掉得慢。")},
  aim:{name:tr("精准瞄准"),icon:'🎯',short:tr("瞄准场地中心"),
    why:tr("发射方向对准中心：陀螺落地后不往边上跑，不容易被甩出场外，能稳稳占住中间。")},
};
// Specialty = what this blader does best compared with the others of the same tier, from real launch numbers:
// highest rpm → 疾风, smallest tilt → 笔直, aim closest to the centre (smallest aim) → 精准. Each skill goes to one blader.
const ORDER=[['gale',l=>-(l.rpm||0)],['straight',l=>l.tilt??9],['aim',l=>l.aim??1]];
const ASSIGN={};
for(const tier of new Set(BLADERS.map(b=>b.tier))){
  const group=BLADERS.filter(b=>b.tier===tier), left=new Set(group.map(b=>b.id));
  for(const [skill,key] of ORDER){const best=group.filter(b=>left.has(b.id)).sort((a,b)=>key(a.launch||{})-key(b.launch||{}))[0];if(best){ASSIGN[best.id]=skill;left.delete(best.id);}}
  for(const id of left)ASSIGN[id]=ORDER.map(([s,k])=>[s,k(BLADERS.find(b=>b.id===id).launch||{})]).sort((a,b)=>a[1]-b[1])[0][0];
}
export const skillOf=blader=>ASSIGN[blader?.id]||'gale';
export const SYNERGY=1.05;
export const synergyOf=(blader,bey)=>!!(blader&&bey&&(bey.type||bey.blade?.style)===(blader.bey?.type||blader.bey?.blade?.style));

/** Team members usable in single-player battles: [{id,name,color,blader,bey,skill,synergy}] */
export function teamRoster(save){
  return (save.team||[]).map(t=>{const b=bladerById(t.bladerId);if(!b)return null;
    const bey=save.collection.find(x=>x.uid===t.beyUid)||null;
    return {id:b.id,name:b.name,color:b.color,blader:b,beyUid:t.beyUid,bey,skill:skillOf(b),line:b.line};}).filter(Boolean);
}

/** Launch for a teammate on the player's side (angle ≈ π). Jitter is half the CPU's; synergy adds +5 % rpm. */
export function mateLaunch(blader,bey,seed){
  const base=blader.launch||{}, j=cpuLaunch(base,seed), half=(k,d)=>(base[k]??d)+((j[k]??d)-(base[k]??d))*.5;
  const syn=synergyOf(blader,bey);
  return {rpm:Math.round(half('rpm',4800)*(syn?SYNERGY:1)),tilt:Math.max(0,half('tilt',5)),speed:Math.max(.05,half('speed',.35)),aim:Math.max(-1,Math.min(1,half('aim',.5))),synergy:syn};
}
