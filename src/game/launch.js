// Launch helpers shared by the UI and balance scripts.
export const STYLES={
  charge:{label:'正面冲撞',desc:'直线冲向中间，主动找对手撞',launch:{speed:.45,aim:.3,tilt:6}},
  orbit:{label:'绕场游走',desc:'沿着场地绕圈，速度快',launch:{speed:.42,aim:.85,tilt:4}},
  center:{label:'稳稳放中间',desc:'轻轻放下，保存转速',launch:{speed:.12,aim:.5,tilt:2}},
};
// Deterministic jitter from a string seed so CPU launches vary per round but replay identically.
function rng(seed){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h=Math.imul(h^(h>>>15),2246822507);h=Math.imul(h^(h>>>13),3266489909);return((h^=h>>>16)>>>0)/4294967296;};}
export function cpuLaunch(base,seed){
  const r=rng(seed);
  return {rpm:(base.rpm||4800)+(r()-.5)*600,tilt:Math.max(0,(base.tilt||5)+(r()-.5)*3),speed:Math.max(.05,(base.speed||.35)+(r()-.5)*.12),aim:Math.max(-1,Math.min(1,(base.aim??.5)+(r()-.5)*.3)),angle:(r()-.5)*.6};
}
export function playerLaunch(style,power,round){
  const s=STYLES[style]||STYLES.charge, over=power>.95;
  return {...s.launch,rpm:3000+3900*Math.min(power,.95)/.95,tilt:s.launch.tilt+(over?9:0),angle:Math.PI+((round*37)%11-5)*.04};
}

