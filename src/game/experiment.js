// Controlled experiment runner: A (original) vs B (one variable changed), paired trials with identical launches.
import {BEYS} from './beys.js';
import {TIPS} from '../physics/model.js';

export const VARIABLES={
  bit:{label:'轴尖 Bit',options:Object.entries(TIPS).map(([k,t])=>({value:k,label:t.label})),get:b=>b.bit,set:(b,v)=>{b.bit=v;}},
  ring:{label:'外圈配重',options:[{value:30,label:'30%（重量在中间）'},{value:55,label:'55%'},{value:80,label:'80%（重量在外圈）'}],get:b=>b.blade.ring,set:(b,v)=>{b.blade.ring=v;}},
  height:{label:'Ratchet 高度',options:[{value:55,label:'55（矮）'},{value:60,label:'60'},{value:70,label:'70（高）'}],get:b=>b.ratchet?.height??60,set:(b,v)=>{b.ratchet={...b.ratchet,height:v};}},
  wings:{label:'翼片数',options:[{value:2,label:'2 片'},{value:3,label:'3 片'},{value:4,label:'4 片'}],get:b=>b.blade.wings,set:(b,v)=>{b.blade.wings=v;}},
  rpm:{label:'发射转速',options:[{value:3500,label:'3,500 rpm'},{value:5000,label:'5,000 rpm'},{value:6500,label:'6,500 rpm'}],launch:true},
};
export const TRIALS=3, EXP_MAX_TIME=12;

let pool=null, seq=1;
function getPool(){
  if(!pool){const n=Math.max(2,Math.min(4,(navigator.hardwareConcurrency||4)-1));
    pool=Array.from({length:n},()=>{const w=new Worker(new URL('./battle.worker.js',import.meta.url),{type:'module'});w.postMessage({type:'warmup'});return {w,busy:false};});}
  return pool;
}
function sim(job){
  return new Promise((resolve,reject)=>{
    const tryRun=()=>{const slot=getPool().find(s=>!s.busy);if(!slot)return setTimeout(tryRun,30);
      slot.busy=true;const id=seq++;
      const h=({data})=>{if(data.id!==id)return;slot.w.removeEventListener('message',h);slot.busy=false;data.type==='simDone'?resolve(data):reject(new Error(data.message));};
      slot.w.addEventListener('message',h);slot.w.postMessage({type:'sim',id,...job});};
    tryRun();
  });
}

export function makeVariant(bey,key,value){
  const b=structuredClone(bey);if(!VARIABLES[key].launch)VARIABLES[key].set(b,value);return b;
}
// Paired design: trial k uses the SAME small launch jitter for A and B, so only the chosen variable differs.
export function trialLaunches(base,k){
  const j=[[0,0,0],[.06,120,-.04],[-.05,-90,.05]][k%3];
  return base.map((l,i)=>({...l,angle:(l.angle??(i?0:Math.PI))+j[0]*(i?-1:1),rpm:(l.rpm||4800)+j[1],aim:Math.max(-1,Math.min(1,(l.aim??.5)+j[2]))}));
}

export async function runExperiment({mine,opp,launches,key,value,onProgress}){
  const B=makeVariant(mine,key,value), total=TRIALS*2;let done=0;
  const jobs=[];
  for(let k=0;k<TRIALS;k++){
    const L=trialLaunches(launches,k);
    const LB=VARIABLES[key].launch?[{...L[0],rpm:value},L[1]]:L;
    jobs.push(sim({beys:[mine,opp],launches:L,maxTime:EXP_MAX_TIME}).then(r=>{onProgress?.(++done/total);return {k,arm:'A',r};}));
    jobs.push(sim({beys:[B,opp],launches:LB,maxTime:EXP_MAX_TIME}).then(r=>{onProgress?.(++done/total);return {k,arm:'B',r};}));
  }
  const out=await Promise.all(jobs);
  const trials=Array.from({length:TRIALS},(_,k)=>{const t={};for(const o of out.filter(o=>o.k===k))t[o.arm]=o.r;return t;});
  const summarize=arm=>{const rs=trials.map(t=>t[arm]);const avg=f=>rs.reduce((s,r)=>s+f(r),0)/rs.length;
    return {wins:rs.filter(r=>r.result.winner===0).length,trials:rs.length,avgTime:+avg(r=>r.result.time).toFixed(2),avgRpm3:Math.round(avg(r=>r.rpm3[0])),avgHits:+avg(r=>r.hits).toFixed(1)};};
  const stats={A:summarize('A'),B:summarize('B')};
  const verdict=stats.B.wins!==stats.A.wins?(stats.B.wins>stats.A.wins?'B更好':'A更好')
    :Math.abs(stats.B.avgRpm3-stats.A.avgRpm3)>Math.max(stats.A.avgRpm3,1)*.15?(stats.B.avgRpm3>stats.A.avgRpm3?'B更好':'A更好'):'差不多';
  return {variantBey:B,trials,stats,verdict};
}
