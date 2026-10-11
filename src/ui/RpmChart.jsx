// Evidence chart: spin rate of both tops over the decisive round, with collision markers (real recorded data).
export default function RpmChart({samples=[],events=[],moments=[],cursor=null,onSeek,names=['A','B'],colors=['#2f7bff','#f2b632']}){
  if(samples.length<2)return null;
  const W=520,H=180,P={l:44,r:12,t:12,b:26};
  const T=samples.at(-1).time||1, R=Math.max(1000,...samples.flatMap(s=>s.bodies.map(b=>Math.abs(b.rpm))));
  const x=t=>P.l+(W-P.l-P.r)*t/T, y=r=>H-P.b-(H-P.t-P.b)*Math.max(0,Math.abs(r))/R;
  const step=Math.max(1,Math.floor(samples.length/240));
  const path=i=>samples.filter((_,k)=>k%step===0||k===samples.length-1).map((s,k)=>`${k?'L':'M'}${x(s.time).toFixed(1)},${y(s.bodies[i].rpm).toFixed(1)}`).join('');
  const hits=events.filter(e=>e.type==='collision');
  return (
    <figure style={{margin:0}}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="两只陀螺的转速随时间变化" style={{cursor:onSeek?"pointer":"default"}} onClick={e=>{if(!onSeek)return;const r=e.currentTarget.getBoundingClientRect();const px=(e.clientX-r.left)/r.width*W;onSeek(Math.max(0,Math.min(T,(px-P.l)/(W-P.l-P.r)*T)));}}>
        <rect x={P.l} y={P.t} width={W-P.l-P.r} height={H-P.t-P.b} fill="#fff" stroke="#111" strokeWidth="2"/>
        {[0,.5,1].map(f=><g key={f}><line x1={P.l} x2={W-P.r} y1={y(R*f)} y2={y(R*f)} stroke="#111" strokeOpacity=".12"/><text x={P.l-6} y={y(R*f)+4} fontSize="10" textAnchor="end" fontWeight="700">{Math.round(R*f/100)*100}</text></g>)}
        {hits.map((e,i)=><g key={i}><line x1={x(e.time)} x2={x(e.time)} y1={P.t} y2={H-P.b} stroke="#ff2d4a" strokeWidth={1+2*e.intensity} strokeOpacity=".55"/></g>)}
        {[0,1].map(i=><path key={i} d={path(i)} fill="none" stroke={colors[i]} strokeWidth="3" strokeLinejoin="round"/>)}
        {moments.map(m=><g key={m.id}><circle cx={x(m.time)} cy={P.t+10} r="8" fill="#ffd400" stroke="#111" strokeWidth="2"/><text x={x(m.time)} y={P.t+14} fontSize="10" fontWeight="900" textAnchor="middle">{m.n}</text></g>)}
        {cursor!=null&&<line x1={x(cursor)} x2={x(cursor)} y1={P.t} y2={H-P.b} stroke="#111" strokeWidth="2" strokeDasharray="3 3"/>}
        <text x={W-P.r} y={H-8} fontSize="10" textAnchor="end" fontWeight="700">{T.toFixed(1)} 秒</text>
        <text x={P.l} y={H-8} fontSize="10" fontWeight="700">0</text>
      </svg>
      <figcaption style={{display:'flex',gap:14,fontSize:12,fontWeight:800,flexWrap:'wrap'}}>
        {names.map((n,i)=><span key={i}><i style={{display:'inline-block',width:14,height:4,background:colors[i],verticalAlign:'middle',marginRight:4}}/>{n} 转速（rpm）</span>)}
        <span><i style={{display:'inline-block',width:3,height:12,background:'#ff2d4a',verticalAlign:'middle',marginRight:4}}/>碰撞（越粗越猛）</span>
      </figcaption>
    </figure>
  );
}
