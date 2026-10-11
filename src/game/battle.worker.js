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
