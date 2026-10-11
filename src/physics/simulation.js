import {DT,VERSION,TIPS,floorHeight,makePart,specFromBey,launchState,pocketAt,ARENA} from './model.js';
import {add,sub,scale,norm,rotate,local,metrics,rackImpulse} from './math.js';
import {MujocoEngine} from './mujoco.js';

export const SAMPLE_HZ=60, MAX_TIME=30, STOP_RPM=350;
export const RAIL_FORCE={needle:0,ball:0,flat:0,rush:0};
// One round between two beys. Deterministic for identical inputs (fixed step, no hidden randomness).
export class Battle {
  constructor(module,{beys,launches,rail=true,maxTime=MAX_TIME}) {
    this.parts=beys.map(b=>makePart(specFromBey(b)));
    this.config={beys,launches,rail,maxTime,dt:DT};
    const states=this.parts.map((p,i)=>launchState(p,launches[i]||{},i));
    this.engine=new MujocoEngine(module,{dt:DT,scenario:'duel'},this.parts,states);
    this.steps=0;this.time=0;this.events=[];this.samples=[];this.hit=false;this.lastCollision=-1;this.lastRail=[-1,-1];this.ended=null;
    this.stats=this.parts.map(()=>({hits:0,railTime:0,maxSpeed:0,impulse:0}));
    this.sample();
  }
  record(e){this.events.push({time:+this.time.toFixed(4),...e});}
  snapshot(){
    const bodies=this.parts.map((part,i)=>{const s=this.engine.state(i),m=metrics(s,part);return {p:s.p,q:s.q,v:s.v,w:s.w,rpm:m.rpm,tilt:m.tilt,energy:m.energy};});
    return {time:+this.time.toFixed(4),bodies};
  }
  sample(){const s=this.snapshot();if(!s.bodies.every(b=>[...b.p,...b.q,b.rpm].every(Number.isFinite)))throw new Error('non-finite state');this.samples.push(s);return s;}
  finish(winner,reason,detail){
    if(this.ended)return;
    const points={xtreme:3,over:2,burst:2,spin:1,judge:1}[reason]??1;
    this.ended={winner,reason,points,time:+this.time.toFixed(4),detail};
    this.record({type:'finish',winner,reason,points,detail});
  }
  advance(count){
    const dt=DT,interval=Math.round(1/SAMPLE_HZ/dt);
    for(let k=0;k<count&&!this.ended;k++){
      for(let i=0;i<this.parts.length;i++){
        const s=this.engine.state(i),p=this.parts[i];
        // Uncalibrated drag: air term + near-tip spin friction torque.
        let torque=scale(s.w,-2e-10*norm(s.w));
        const tip=add(s.p,rotate(s.q,[0,0,-p.tipDepth]));
        if(tip[2]-floorHeight(tip[0],tip[1])<.0006){
          const axis=rotate(s.q,[0,0,1]),spin=local(s.q,s.w)[2];
          torque=add(torque,scale(axis,-.12*p.mass*9.81*TIPS[p.tip].spinRadius*Math.tanh(spin/15)));
        }
        this.engine.torque(i,torque);
      }
      const before=this.parts.map((_,i)=>this.engine.state(i));
      this.engine.step();this.steps++;this.time=this.steps*dt;
      if(this.config.rail)for(let i=0;i<this.parts.length;i++){
        // Xtreme line approximation: tangential no-slip impulse near the rim; never adds energy.
        const s=this.engine.state(i),p=this.parts[i],r=Math.hypot(s.p[0],s.p[1]);
        if(r>.150&&r<.170&&s.p[2]-floorHeight(s.p[0],s.p[1])<p.tipDepth+.003&&rotate(s.q,[0,0,1])[2]>.85){
          const res=rackImpulse(s,p,RAIL_FORCE[p.tip]*dt);
          this.engine.setVelocity(i,res.state.v,res.state.w);
          if(Math.abs(res.impulse)>1e-6){this.stats[i].railTime+=dt;if(this.time-this.lastRail[i]>.35){this.record({type:'dash',body:i,speed:+norm(res.state.v).toFixed(3)});this.lastRail[i]=this.time;}}
        }
      }
      const hit=this.engine.touching();
      if(hit&&!this.hit&&this.time-this.lastCollision>.03){
        const after=this.parts.map((_,i)=>this.engine.state(i));
        const dv=before.map((b,i)=>norm(sub(after[i].v,b.v)));
        const rel=norm(sub(before[0].v,before[1].v));
        const point=scale(add(after[0].p,after[1].p),.5);
        const intensity=Math.min(1,(rel+dv[0]+dv[1])/1.2);
        this.stats.forEach((st,i)=>{st.hits++;st.impulse+=dv[i]*this.parts[i].mass;});
        this.record({type:'collision',point,relSpeed:+rel.toFixed(3),intensity:+intensity.toFixed(3),rpm:after.map((s,i)=>Math.round(metrics(s,this.parts[i]).rpm))});
        this.lastCollision=this.time;
      }
      this.hit=hit;
      for(let i=0;i<this.parts.length&&!this.ended;i++){
        const s=this.engine.state(i),r=Math.hypot(s.p[0],s.p[1]);
        this.stats[i].maxSpeed=Math.max(this.stats[i].maxSpeed,Math.hypot(s.v[0],s.v[1]));
        if(r>ARENA.outRadius||s.p[2]<-.02){
          const pocket=pocketAt(Math.atan2(s.p[1],s.p[0]));
          this.finish(1-i,pocket?.kind==='xtreme'?'xtreme':'over',{loser:i,pocket:pocket?.kind||'wall'});
        }
      }
      if(this.steps%interval===0){
        const snap=this.sample();
        if(!this.ended){
          const dead=snap.bodies.map(b=>Math.abs(b.rpm)<STOP_RPM||b.tilt>70);
          if(dead[0]&&dead[1])this.finish(Math.abs(snap.bodies[0].rpm)>=Math.abs(snap.bodies[1].rpm)?0:1,'spin',{both:true});
          else if(dead[0]||dead[1])this.finish(dead[0]?1:0,'spin',{loser:dead[0]?0:1});
          else if(this.time>=this.config.maxTime){
            const a=Math.abs(snap.bodies[0].rpm),b=Math.abs(snap.bodies[1].rpm);
            this.finish(a>=b?0:1,'judge',{rpm:[Math.round(a),Math.round(b)]});
          }
        }
      }
    }
    if(this.ended&&this.samples.at(-1).time!==+this.time.toFixed(4))this.sample();
    return this.snapshot();
  }
  summary(){
    return {model:VERSION,positioning:'idealized rigid-body model; not calibrated against real tops',
      parts:this.parts.map(p=>({wings:p.wings,style:p.style,reach:p.reach,ring:p.ring,massG:+(p.mass*1000).toFixed(1),tip:p.tip,height:p.height,inertiaZ:p.inertia[2]})),
      launches:this.config.launches,result:this.ended,stats:this.stats,
      events:this.events.filter(e=>e.type!=='dash'||true).slice(0,60)};
  }
  dispose(){this.engine.dispose();}
}
