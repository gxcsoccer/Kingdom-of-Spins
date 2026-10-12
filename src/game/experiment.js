import {tr} from '../i18n/index.js';
// Controlled experiment runner: A (original) vs B (one variable changed), paired trials with identical launches.
import {BEYS} from './beys.js';
import {TIPS} from '../physics/model.js';

export const VARIABLES={
  bit:{label:tr("轴尖 Bit"),options:Object.entries(TIPS).map(([k,t])=>({value:k,label:t.label})),get:b=>b.bit,set:(b,v)=>{b.bit=v;}},
  ring:{label:tr("外圈配重"),options:[{value:30,label:tr("30%（重量在中间）")},{value:55,label:'55%'},{value:80,label:tr("80%（重量在外圈）")}],get:b=>b.blade.ring,set:(b,v)=>{b.blade.ring=v;}},
  height:{label:tr("Ratchet 高度"),options:[{value:55,label:tr("55（矮）")},{value:60,label:'60'},{value:70,label:tr("70（高）")}],get:b=>b.ratchet?.height??60,set:(b,v)=>{b.ratchet={...b.ratchet,height:v};}},
  wings:{label:tr("翼片数"),options:[{value:2,label:tr("2 片")},{value:3,label:tr("3 片")},{value:4,label:tr("4 片")}],get:b=>b.blade.wings,set:(b,v)=>{b.blade.wings=v;}},
  rpm:{label:tr("发射转速"),options:[{value:3500,label:'3,500 rpm'},{value:5000,label:'5,000 rpm'},{value:6500,label:'6,500 rpm'}],launch:true},
};
// 和正式对战同样的时长（battlePlayer 默认 20 秒）：第 1 次试验发射参数完全相同，“原版”必须重现刚才那一局。
export const TRIALS=3, EXP_MAX_TIME=20;

let pool=null, seq=1;
function makeWorker(){const w=new Worker(new URL('./battle.worker.js',import.meta.url),{type:'module'});w.postMessage({type:'warmup'});return w;}
function getPool(){
  if(!pool){const n=Math.max(2,Math.min(4,(navigator.hardwareConcurrency||4)-1));
    pool=Array.from({length:n},()=>({w:makeWorker(),busy:false}));}
  return pool;
}
function sim(job){
  return new Promise((resolve,reject)=>{
    const tryRun=()=>{const slot=getPool().find(s=>!s.busy);if(!slot)return setTimeout(tryRun,30);
      try{slot.w||=makeWorker();}catch(error){reject(error);return;}
      slot.busy=true;const id=seq++,w=slot.w;
      const cleanup=()=>{w.removeEventListener('message',h);w.removeEventListener('error',fail);slot.busy=false;};
      const fail=event=>{cleanup();w.terminate();slot.w=null;reject(new Error(event.message||'Physics worker unavailable'));};
      const h=({data})=>{if(data.id!==id)return;cleanup();data.type==='simDone'?resolve(data):reject(new Error(data.message));};
      w.addEventListener('message',h);w.addEventListener('error',fail);w.postMessage({type:'sim',id,...job});};
    tryRun();
  });
}

export function makeVariant(bey,key,value){
  const b=structuredClone(bey);if(!VARIABLES[key].launch)VARIABLES[key].set(b,value);return b;
}
// Paired design: trial k uses the SAME small launch jitter for A and B, so only the chosen variable differs.
export function trialLaunches(base,k){
  const j=[[0,0,0],[.06,120,-.04],[-.05,-90,.05],[.03,-60,.08],[-.07,80,-.07]][k%5];
  return base.map((l,i)=>({...l,angle:(l.angle??(i?0:Math.PI))+j[0]*(i?-1:1),rpm:(l.rpm||4800)+j[1],aim:Math.max(-1,Math.min(1,(l.aim??.5)+j[2]))}));
}

// onTrial({k, arm:'A'|'B', result, rpm3, samples, hits}) fires as each simulation finishes (live lab cards).
export async function runExperiment({mine,opp,launches,key,value,onProgress,onTrial,trials:N=TRIALS}){
  const B=makeVariant(mine,key,value), total=N*2;let done=0;
  const jobs=[];
  for(let k=0;k<N;k++){
    const L=trialLaunches(launches,k);
    const LB=VARIABLES[key].launch?[{...L[0],rpm:value},L[1]]:L;
    jobs.push(sim({beys:[mine,opp],launches:L,maxTime:EXP_MAX_TIME,full:true}).then(r=>{onProgress?.(++done/total);onTrial?.({k,arm:'A',...r});return {k,arm:'A',r};}));
    jobs.push(sim({beys:[B,opp],launches:LB,maxTime:EXP_MAX_TIME,full:true}).then(r=>{onProgress?.(++done/total);onTrial?.({k,arm:'B',...r});return {k,arm:'B',r};}));
  }
  const out=await Promise.all(jobs);
  const trials=Array.from({length:N},(_,k)=>{const t={};for(const o of out.filter(o=>o.k===k))t[o.arm]=o.r;return t;});
  const summarize=arm=>{const rs=trials.map(t=>t[arm]);const avg=f=>rs.reduce((s,r)=>s+f(r),0)/rs.length;
    return {wins:rs.filter(r=>r.result.winner===0).length,trials:rs.length,avgTime:+avg(r=>r.result.time).toFixed(2),avgRpm3:Math.round(avg(r=>r.rpm3[0])),avgHits:+avg(r=>r.hits).toFixed(1)};};
  const stats={A:summarize('A'),B:summarize('B')};
  const verdict=stats.B.wins!==stats.A.wins?(stats.B.wins>stats.A.wins?'B更好':'A更好')
    :Math.abs(stats.B.avgRpm3-stats.A.avgRpm3)>Math.max(stats.A.avgRpm3,1)*.15?(stats.B.avgRpm3>stats.A.avgRpm3?'B更好':'A更好'):'差不多';
  return {variantBey:B,trials,stats,verdict};
}
