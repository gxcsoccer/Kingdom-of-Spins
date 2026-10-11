// Streams a physics battle from the worker and exposes the playback interface used by BattleScene.
let worker, nextId=1;
export function getWorker(){
  if(!worker){worker=new Worker(new URL('./battle.worker.js',import.meta.url),{type:'module'});worker.postMessage({type:'warmup'});}
  return worker;
}

const lerp=(a,b,t)=>a+(b-a)*t;
function slerp(a,b,t){
  let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];
  if(d<0){b=b.map(x=>-x);d=-d;}
  if(d>.9995){const r=a.map((x,i)=>lerp(x,b[i],t));const n=Math.hypot(...r);return r.map(x=>x/n);}
  const th=Math.acos(d),s=Math.sin(th),wa=Math.sin((1-t)*th)/s,wb=Math.sin(t*th)/s;
  return a.map((x,i)=>x*wa+b[i]*wb);
}

/**
 * createBattle({beys, launches, maxTime}) -> player
 * player: getTime(), getState(t), events[], beys, samples[], result, summary, done,
 *         start(), setPaused(b), setSpeed(x), onDone(cb), onEvent(cb), dispose()
 */
export function createBattle({beys,launches,maxTime=20}){
  const w=getWorker(), id=nextId++;
  const listeners={done:[],event:[],error:[]};
  const player={beys,launches,samples:[],events:[],result:null,summary:null,done:false,error:null,
    speed:1,paused:true,clock:0,lastWall:null,slowmo:0,firedEvents:0,
    getTime(){
      const now=performance.now();
      if(this.lastWall!=null&&!this.paused){
        let dt=Math.min(.1,(now-this.lastWall)/1000)*this.speed;
        if(this.slowmo>0){this.slowmo-=dt;dt*=.25;}
        const end=this.samples.at(-1)?.time??0;
        // Never play past buffered physics; wait for the worker instead.
        this.clock=Math.min(this.clock+dt,end);
      }
      this.lastWall=now;
      // Fire event callbacks as playback passes them.
      while(this.firedEvents<this.events.length&&this.events[this.firedEvents].time<=this.clock){
        const e=this.events[this.firedEvents++];
        if(e.type==='collision'&&e.intensity>.6)this.slowmo=Math.max(this.slowmo,.12);
        listeners.event.forEach(cb=>cb(e));
      }
      return this.clock;
    },
    getState(t){
      const s=this.samples;if(!s.length)return null;
      if(t<=s[0].time)return s[0];
      let lo=0,hi=s.length-1;
      if(t>=s[hi].time)return s[hi];
      while(hi-lo>1){const m=(lo+hi)>>1;if(s[m].time<=t)lo=m;else hi=m;}
      const a=s[lo],b=s[hi],k=(t-a.time)/(b.time-a.time||1);
      return {time:t,bodies:a.bodies.map((x,i)=>({p:x.p.map((v,j)=>lerp(v,b.bodies[i].p[j],k)),q:slerp(x.q,b.bodies[i].q,k),rpm:lerp(x.rpm,b.bodies[i].rpm,k),tilt:lerp(x.tilt,b.bodies[i].tilt,k)}))};
    },
    get finished(){return this.done&&this.clock>=(this.samples.at(-1)?.time??0)-1e-6;},
    start(){this.paused=false;this.lastWall=performance.now();},
    setPaused(p){this.getTime();this.paused=p;},
    setSpeed(x){this.getTime();this.speed=x;},
    onDone(cb){listeners.done.push(cb);},
    onEvent(cb){listeners.event.push(cb);},
    onError(cb){listeners.error.push(cb);},
    dispose(){w.removeEventListener('message',handler);if(!this.done)w.postMessage({type:'cancel'});},
  };
  const handler=({data})=>{
    if(data.id!==id)return;
    if(data.type==='chunk'){player.samples.push(...data.samples);player.events.push(...data.events);}
    if(data.type==='done'){player.result=data.result;player.summary=data.summary;player.done=true;listeners.done.forEach(cb=>cb(player));}
    if(data.type==='error'){player.error=data.message;listeners.error.forEach(cb=>cb(data.message));}
  };
  w.addEventListener('message',handler);
  w.postMessage({type:'run',id,beys,launches,maxTime});
  return player;
}

// Watch for the playback reaching the end (call from rAF/useFrame or an interval).
export function playbackFinished(player){return player.finished;}
