// Pick 3–4 key moments of a recorded round from real samples/events (no invention).
export function findMoments(samples,events,result){
  const hits=events.filter(e=>e.type==='collision');
  const out=[];
  if(hits[0])out.push({id:'first',time:hits[0].time,kind:'first-hit',data:{relSpeed:hits[0].relSpeed,intensity:hits[0].intensity,rpmAfter:hits[0].rpm}});
  const big=hits.slice(1).reduce((m,e)=>!m||e.intensity*e.relSpeed>m.intensity*m.relSpeed?e:m,null);
  if(big&&big.time-out[0]?.time>.3)out.push({id:'big',time:big.time,kind:'big-hit',data:{relSpeed:big.relSpeed,intensity:big.intensity,rpmAfter:big.rpm}});
  // Largest 1-second spin drop for either bey.
  let best=null;
  for(let i=0;i<samples.length;i++){
    const j=samples.findIndex((s,k)=>k>i&&s.time>=samples[i].time+1);if(j<0)break;
    for(const b of [0,1]){const d=Math.abs(samples[i].bodies[b].rpm)-Math.abs(samples[j].bodies[b].rpm);
      if(!best||d>best.drop)best={drop:d,body:b,t0:samples[i].time,i,j};}
    i+=5;
  }
  if(best&&best.drop>400&&!out.some(m=>Math.abs(m.time-best.t0)<.6))
    out.push({id:'drop',time:+best.t0.toFixed(2),kind:'spin-drop',body:best.body,data:{drop:Math.round(best.drop),rpmBefore:samples[best.i].bodies.map(b=>Math.round(Math.abs(b.rpm))),rpmAfter:samples[best.j].bodies.map(b=>Math.round(Math.abs(b.rpm)))}});
  if(result)out.push({id:'finish',time:result.time,kind:'finish',data:{reason:result.reason,winner:result.winner}});
  return out.sort((a,b)=>a.time-b.time).slice(0,4).map((m,i)=>({...m,n:i+1}));
}
