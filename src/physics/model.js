import {rotate} from './math.js';
// Idealized model: real rigid-body dynamics, simplified parts, NOT calibrated against real tops.
export const DT=.00025;
export const VERSION='MuJoCo 3.15.0 · RK4 · 4 kHz';
export const TIPS={
  needle:{label:'尖轴 Needle',desc:'接触面小，稳、耐转，不爱跑',radius:.0012,friction:.16,spinRadius:.00035},
  ball:{label:'圆轴 Ball',desc:'均衡，能动也能守',radius:.002,friction:.22,spinRadius:.0009},
  flat:{label:'平轴 Flat',desc:'抓地强，跑得快，攻击型',radius:.003,friction:.35,spinRadius:.002},
  rush:{label:'冲刺 Rush',desc:'橡胶感大平面，爆发猛但掉转快',radius:.0034,friction:.5,spinRadius:.0026},
};
export const BLADE_FRICTION=.12, ARENA_FRICTION=.1;
export const STYLES=['attack','defense','stamina','balance'];
export const RATCHET_PART_MASS=6.5, BIT_PART_MASS=2.2;

// Arena (meters, Z up). Flat center to r=.07, slope rises .02 to r=.185, wall at r~.189.
export const ARENA={flat:.07,slopeEnd:.185,rise:.02,wall:.189,outRadius:.193,segments:32,
  // Wall gaps (segment index ranges). The first one is the Xtreme pocket, the others are over pockets.
  pockets:[{kind:'xtreme',from:0,to:1},{kind:'over',from:11,to:12},{kind:'over',from:21,to:22}]};
export const floorHeight=(x,y)=>Math.min(ARENA.rise,Math.max(0,Math.hypot(x,y)-ARENA.flat)*(ARENA.rise/(ARENA.slopeEnd-ARENA.flat)));
export function pocketAt(angle){
  const seg=((Math.floor(((angle%(2*Math.PI))+2*Math.PI)%(2*Math.PI)/(2*Math.PI/ARENA.segments)))%ARENA.segments);
  return ARENA.pockets.find(p=>seg>=p.from&&seg<=p.to)||null;
}

const clamp=(v,lo,hi,d)=>{const n=Number(v);return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):d;};
// Game-level bey -> validated physics spec. Unknown/invalid values fall back to safe defaults.
export function specFromBey(bey={}) {
  const b=bey.blade||{};
  const spec={
    wings:[2,3,4].includes(+b.wings)?+b.wings:3,
    reach:clamp(b.reach,.022,.030,.026),
    ring:clamp(b.ring,20,85,60),
    bladeMass:clamp(b.mass,24,40,32),
    style:STYLES.includes(b.style)?b.style:'balance',
    height:[55,60,70].includes(+bey.ratchet?.height)?+bey.ratchet.height:60,
    tip:TIPS[bey.bit]?bey.bit:'ball',
  };
  spec.mass=(spec.bladeMass+RATCHET_PART_MASS+BIT_PART_MASS)/1000;
  spec.tipDepth=.019+(spec.height-60)*.0001;
  return spec;
}
export function makePart(spec) {
  const {mass,ring:rp,reach,tipDepth}=spec, ring=rp/100;
  // Idealized disk/ring/shaft mass distribution, independent of the contact mesh.
  const r=reach*.88, h=.008, iz=mass*(.9*(ring+(1-ring)*.5)*r*r+.1*.000016/2);
  const ix=mass*(.9*((ring*.5+(1-ring)*.25)*r*r+h*h/12)+.1*(.00012+(tipDepth-.019)*.006));
  return {...spec,inertia:[ix,ix,iz],radius:reach};
}
// 2D wing outline in the blade plane (convex, counter-clockwise), for physics hull AND visuals.
// Right-spin tops rotate +Z (counter-clockwise from above); the leading edge is at +angle.
export function wingOutline(spec,i=0){
  const n=spec.wings, half={2:.78,3:.56,4:.42}[n], rin=.0135, R=spec.reach, a0=i*2*Math.PI/n;
  const pol={
    attack:[[rin,-half],[R-.006,-half*.7],[R,half*.55],[R-.002,half*.85],[rin,half]],
    defense:[[rin,-half],[R-.001,-half*.8],[R,-half*.2],[R,half*.4],[R-.001,half*.8],[rin,half]],
    stamina:[[rin,-half],[R-.003,-half*.75],[R-.001,0],[R-.003,half*.75],[rin,half]],
    balance:[[rin,-half],[R-.003,-half*.6],[R,half*.2],[R-.002,half*.7],[rin,half]],
  }[spec.style];
  return pol.map(([r,t])=>[r*Math.cos(a0+t),r*Math.sin(a0+t)]);
}
export function topShapes(part) {
  const shapes=[{type:'cylinder',r:.0185,h:.004,p:[0,0,0]},{type:'cylinder',r:.0045,h:(part.tipDepth-.01)/2,p:[0,0,-.004-(part.tipDepth-.01)/2]}];
  for(let i=0;i<part.wings;i++){
    const points=[];
    for(const z of [-.0035,.0035]) for(const [x,y] of wingOutline(part,i)) points.push([x,y,z]);
    shapes.push({type:'hull',points,p:[0,0,0]});
  }
  const t=TIPS[part.tip];
  shapes.push(part.tip==='flat'||part.tip==='rush'?{type:'cylinder',r:t.radius,h:.0015,p:[0,0,-part.tipDepth+.0015],friction:t.friction}:{type:'sphere',r:t.radius,p:[0,0,-part.tipDepth+t.radius],friction:t.friction});
  return shapes;
}
export function arenaShapes() {
  const {flat,slopeEnd,rise,wall,segments}=ARENA;
  const shapes=[{type:'cylinder',r:.23,h:.007,p:[0,0,-.007]}];
  for(let i=0;i<segments;i++) {
    const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments,points=[];
    for(const bottom of [false,true]) for(const [r,t] of [[flat,a],[slopeEnd,a],[slopeEnd,b],[flat,b]]) points.push([r*Math.cos(t),r*Math.sin(t),bottom?-.01:r===flat?0:rise]);
    shapes.push({type:'hull',points,p:[0,0,0]});
    // Rim ledge beyond the slope so tops can ride the edge before the wall.
    const rim=[];for(const bottom of [false,true]) for(const [r,t] of [[slopeEnd,a],[wall-.002,a],[wall-.002,b],[slopeEnd,b]]) rim.push([r*Math.cos(t),r*Math.sin(t),bottom?-.01:rise]);
    if(!pocketAt((a+b)/2)) shapes.push({type:'hull',points:rim,p:[0,0,0]});
    const mid=(a+b)/2;
    if(!pocketAt(mid)) shapes.push({type:'box',size:[.004,.0195,.025],p:[(wall+.002)*Math.cos(mid),(wall+.002)*Math.sin(mid),.035],angle:mid});
  }
  return shapes;
}
// Launch: {rpm 2500-7000, tilt 0-25 deg, angle (position around center), speed m/s, aim -1..1 (inward..tangential)}
export function launchState(part,launch,side) {
  const rpm=clamp(launch.rpm,2500,7000,4500), tiltDeg=clamp(launch.tilt,0,25,6);
  const ang=Number.isFinite(launch.angle)?launch.angle:(side?0:Math.PI), rad=clamp(launch.radius,.04,.12,.09);
  const tilt=tiltDeg*Math.PI/180, tAx=ang+Math.PI/2, q=[Math.cos(tilt/2),Math.cos(tAx)*Math.sin(tilt/2),Math.sin(tAx)*Math.sin(tilt/2),0];
  const p=[rad*Math.cos(ang),rad*Math.sin(ang),0];
  p[2]=floorHeight(p[0],p[1])+Math.max(part.tipDepth*Math.cos(tilt),part.reach*Math.sin(tilt)+.004*Math.cos(tilt))+.0005;
  const speed=clamp(launch.speed,0,.9,.35), aim=clamp(launch.aim,-1,1,.5);
  const inward=[-Math.cos(ang),-Math.sin(ang)], tang=[-Math.sin(ang),Math.cos(ang)];
  const v=[speed*((1-Math.abs(aim))*inward[0]+aim*tang[0]),speed*((1-Math.abs(aim))*inward[1]+aim*tang[1]),0];
  const spin=rpm*Math.PI/30;
  return {p,q,v,w:rotate(q,[0,0,spin])};
}
