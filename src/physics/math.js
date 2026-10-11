export const add = (a,b) => a.map((v,i)=>v+b[i]);
export const sub = (a,b) => a.map((v,i)=>v-b[i]);
export const scale = (a,s) => a.map(v=>v*s);
export const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
export const norm = a => Math.hypot(...a);
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const conjugate = q => [q[0],-q[1],-q[2],-q[3]];
export function rotate(q,v) { const u=q.slice(1), t=scale(cross(u,v),2); return add(v,add(scale(t,q[0]),cross(u,t))); }
export const local = (q,v) => rotate(conjugate(q),v);
export const inverseInertia = (q,I,v) => rotate(q,local(q,v).map((x,i)=>x/I[i]));
export function metrics(state,part,gravity=9.81) {
  const w=local(state.q,state.w), axis=rotate(state.q,[0,0,1]);
  const translation=.5*part.mass*dot(state.v,state.v);
  const rotation=.5*w.reduce((s,x,i)=>s+part.inertia[i]*x*x,0);
  return {rpm:w[2]*30/Math.PI, tilt:Math.acos(Math.max(-1,Math.min(1,axis[2])))*180/Math.PI,
    translation,rotation,potential:part.mass*gravity*state.p[2],energy:translation+rotation+part.mass*gravity*state.p[2]};
}
// A stationary rack cancels tangential slip. This impulse cannot add kinetic energy.
export function rackImpulse(state,part,maxImpulse=Infinity) {
  const r=Math.hypot(state.p[0],state.p[1]);
  if(r<1e-8) return {state,impulse:0};
  const n=[state.p[0]/r,state.p[1]/r,0], tangent=[-n[1],n[0],0], arm=scale(n,.006);
  const axis=cross(arm,tangent), inv=inverseInertia(state.q,part.inertia,axis);
  const slip=dot(add(state.v,cross(state.w,arm)),tangent);
  const j=Math.max(-maxImpulse,Math.min(maxImpulse,-slip/(1/part.mass+dot(axis,inv))));
  return {state:{...state,v:add(state.v,scale(tangent,j/part.mass)),w:add(state.w,scale(inv,j))},impulse:j};
}
