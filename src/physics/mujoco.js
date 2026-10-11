import {arenaShapes,topShapes,BLADE_FRICTION,ARENA_FRICTION} from './model.js';
import {local,rotate} from './math.js';
export class MujocoEngine {
  constructor(M,c,parts,states) {
    this.M=M; this.parts=parts;this.count=parts.length;
    const meshes=[]; let meshId=0;
    const geom=(s,friction=ARENA_FRICTION)=>{
      let attrs=`pos="${s.p.join(' ')}" friction="${s.friction??friction} 0 0" condim="3"`;
      if(s.type==='hull') {const name=`h${meshId++}`; meshes.push(`<mesh name="${name}" vertex="${s.points.flat().join(' ')}"/>`);attrs+=` type="mesh" mesh="${name}"`;}
      if(s.type==='box')attrs+=` type="box" size="${s.size.join(' ')}" euler="0 0 ${s.angle||0}"`;
      if(s.type==='cylinder')attrs+=` type="cylinder" size="${s.r} ${s.h}"`;
      if(s.type==='sphere')attrs+=` type="sphere" size="${s.r}"`;
      return `<geom ${attrs}/>`;
    };
    const ground=c.scenario==='vacuum'?'':arenaShapes().map(s=>geom(s)).join('');
    const bodies=parts.map((p,i)=>`<body name="top${i}" pos="${states[i].p.join(' ')}" quat="${states[i].q.join(' ')}"><freejoint/><inertial pos="0 0 0" mass="${p.mass}" diaginertia="${p.inertia.join(' ')}"/>${topShapes(p).map(s=>geom(s,BLADE_FRICTION)).join('')}</body>`).join('');
    const xml=`<mujoco><compiler angle="radian"/><option timestep="${c.dt}" gravity="0 0 ${c.scenario==='vacuum'?0:-9.81}" integrator="RK4" cone="elliptic" iterations="30" tolerance="1e-10"/><default><geom solref=".002 1" solimp=".95 .99 .0001" margin="0" gap="0"/></default><asset>${meshes.join('')}</asset><worldbody>${ground}${bodies}</worldbody></mujoco>`;
    this.model=M.MjModel.from_xml_string(xml);
    this.data=new M.MjData(this.model);
    states.forEach((s,i)=>{this.data.qpos.set([...s.p,...s.q],i*7); this.setVelocity(i,s.v,s.w);});
    M.mj_forward(this.model,this.data);
    this.bodyGeomStart=ground?arenaShapes().length:0;
  }
  state(i) {const d=this.data,q=Array.from(d.qpos.slice(i*7+3,i*7+7));return {p:Array.from(d.qpos.slice(i*7,i*7+3)),q,v:Array.from(d.qvel.slice(i*6,i*6+3)),w:rotate(q,Array.from(d.qvel.slice(i*6+3,i*6+6)))};}
  setVelocity(i,v,w) {const q=Array.from(this.data.qpos.slice(i*7+3,i*7+7));this.data.qvel.set([...v,...local(q,w)],i*6);}
  torque(i,t) {this.data.xfrc_applied.set(t,(i+1)*6+3);}
  step() {this.M.mj_step(this.model,this.data);}
  touching() {
    if(this.count<2 || !this.data.ncon)return false;
    const contacts=this.data.contact;
    let hit=false;
    try {for(let i=0;i<contacts.size();i++){const c=contacts.get(i);const a=this.model.geom_bodyid[c.geom1],b=this.model.geom_bodyid[c.geom2];if(a>0&&b>0&&a!==b){hit=true;break;}}} finally {contacts.delete();}
    return hit;
  }
  dispose(){this.data.delete();this.model.delete();}
}
