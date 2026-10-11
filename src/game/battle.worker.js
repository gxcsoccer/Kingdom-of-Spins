import loadM from '@mujoco/mujoco';
import mujocoWasm from '@mujoco/mujoco/mujoco.wasm?url';
import {Battle} from '../physics/simulation.js';

let modulePromise, current=0;
const load=()=>modulePromise??=loadM({locateFile:()=>mujocoWasm});
const yieldNow=()=>new Promise(r=>setTimeout(r,0));
const slim=s=>({time:s.time,bodies:s.bodies.map(b=>({p:b.p,q:b.q,rpm:b.rpm,tilt:b.tilt}))});

self.onmessage=async({data:msg})=>{
  if(msg.type==='warmup'){try{await load();postMessage({type:'warm'});}catch(e){postMessage({type:'error',message:String(e?.message||e)});}return;}
  if(msg.type==='cancel'){current=0;return;}
  if(msg.type==='sim'){ // run to completion without streaming (experiments); not affected by cancel
    let b;
    try{const M=await load();b=new Battle(M,{beys:msg.beys,launches:msg.launches,maxTime:msg.maxTime});
      while(!b.ended)b.advance(1000);
      const at=t=>{const s=b.samples.find(x=>x.time>=t)||b.samples.at(-1);return s.bodies.map(x=>Math.abs(x.rpm));};
      postMessage({type:'simDone',id:msg.id,result:b.ended,stats:b.stats,rpm3:at(3),
        samples:b.samples.filter((_,i)=>i%6===0).map(s=>({time:s.time,rpm:s.bodies.map(x=>Math.abs(x.rpm))})),
        hits:b.events.filter(e=>e.type==='collision').length,
        full:msg.full?{samples:b.samples.map(slim),events:b.events}:null});
    }catch(e){postMessage({type:'simError',id:msg.id,message:String(e?.message||e)});}
    finally{b?.dispose?.();}
    return;
  }
  if(msg.type!=='run')return;
  const id=msg.id;current=id;
  let battle;
  try{
    const M=await load();
    battle=new Battle(M,{beys:msg.beys,launches:msg.launches,maxTime:msg.maxTime});
    let sent=0,evSent=0;
    while(!battle.ended){
      if(current!==id){battle.dispose();return;}
      battle.advance(500);
      postMessage({type:'chunk',id,samples:battle.samples.slice(sent).map(slim),events:battle.events.slice(evSent)});
      sent=battle.samples.length;evSent=battle.events.length;
      await yieldNow();
    }
    postMessage({type:'chunk',id,samples:battle.samples.slice(sent).map(slim),events:battle.events.slice(evSent)});
    postMessage({type:'done',id,result:battle.ended,summary:battle.summary()});
  }catch(e){postMessage({type:'error',id,message:String(e?.message||e)});}
  finally{battle?.dispose?.();}
};
