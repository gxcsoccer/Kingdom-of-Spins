import {useState} from 'react';
import {BLADERS} from '../game/story.js';
// /?art — lists every art slot from the art brief and shows whether the file is delivered.
const BEY_IDS=['dragoon','fish','goatpuff','ninjamight','titan','bossdragoon','fishgoon'];
const GROUPS=[
  ['P0 · Logo',[['logo.png','2048×1024 透明 PNG']]],
  ['P0 · 融合博士',['normal','excited','thinking'].map(m=>[`doctor/${m}.png`,'1024² 透明 PNG'])],
  ['P0 · 对手半身像',BLADERS.map(b=>[`bladers/${b.id}.png`,`${b.name} · 1024² 透明 PNG`])],
  ['P0 · 陀螺立绘',BEY_IDS.map(id=>[`beys/${id}.png`,'1024² 透明 PNG'])],
  ['P1 · 陀螺徽章',BEY_IDS.map(id=>[`emblems/${id}.png`,'512² 透明 PNG'])],
  ['P1 · 背景',['map','arena','lab','shop'].map(n=>[`bg/${n}.jpg`,'2560×1440 JPG'])],
  ['P1 · 玩家头像 / 盲盒',[...[1,2,3,4].map(n=>[`avatars/${n}.png`,'512² PNG']),['blindbox.png','1024² 透明 PNG']]],
];
function Slot({path,spec}){
  const [state,setState]=useState('loading');
  return (
    <div className="panel" style={{padding:10,display:'flex',flexDirection:'column',gap:6}}>
      <div style={{height:140,display:'grid',placeItems:'center',background:'repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px',border:'2px solid #111'}}>
        {state!=='missing'&&<img src={`/art/${path}`} alt={path} style={{maxWidth:'100%',maxHeight:136,display:state==='ok'?'block':'none'}} onLoad={()=>setState('ok')} onError={()=>setState('missing')}/>}
        {state==='missing'&&<span className="badge" style={{background:'var(--red)',color:'#fff'}}>缺</span>}
      </div>
      <code style={{fontSize:12,fontWeight:800}}>{path}</code>
      <span className="muted" style={{fontSize:12}}>{spec}</span>
    </div>
  );
}
export default function ArtCheck(){
  return (
    <div className="page">
      <h1 className="h-display h-outline" style={{fontSize:44}}>素材检查 ART CHECK</h1>
      <p style={{fontWeight:700}}>文件放在 <code>public/art/</code> 下，文件名一字不差。部署后刷新本页。</p>
      {GROUPS.map(([title,items])=>(
        <section key={title} className="mt2">
          <h2 className="panel-title" style={{fontSize:22}}>{title}</h2>
          <div className="grid mt" style={{gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))',gap:14}}>{items.map(([p,s])=><Slot key={p} path={p} spec={s}/>)}</div>
        </section>
      ))}
    </div>
  );
}
