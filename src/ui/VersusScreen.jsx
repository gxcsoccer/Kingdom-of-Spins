import {tr} from '../i18n/index.js';
import {lazy,Suspense,useState} from 'react';
import {useGame} from '../game/store.js';
import {BEYS} from '../game/beys.js';
import {BLADERS} from '../game/story.js';
import BeyArt from './BeyArt.jsx';
import {Portrait,TypeBadge} from './common.jsx';
import {beyTitle,beySub} from './beyName.js';
import * as sfx from '../game/sfx.js';
import './battle.css';
import './versus.css';
import OnlineRoom from './online/OnlineRoom.jsx';
const BeyShowcase=lazy(()=>import('../scene/BeyShowcase.jsx'));

const PAGE=6;
const avatarOf=v=>/^[1-4]$/.test(String(v))?String(v):null;

/** 对战模式: home (two big entries) → VS CPU setup (bey + opponent) → BattleScreen, or → VS 朋友 (bey) → OnlineRoom. */
export default function VersusScreen(){
  const {save,go,params}=useGame();
  const invite=params?.room||null; // invite link (?room=CODE)
  const pool=save.collection.length?save.collection:Object.values(BEYS).slice(0,3).map(b=>({...b,uid:b.id}));
  const [mine,setMine]=useState(params?.beyUid&&pool.some(b=>b.uid===params.beyUid)?params.beyUid:pool[0]?.uid);
  const [oppId,setOppId]=useState(null);
  const [step,setStep]=useState(invite?'online':'home'); // home | cpu | friend | online
  const myBey=pool.find(b=>b.uid===mine)||pool[0];
  const opponents=[
    ...BLADERS.filter(b=>save.defeated.includes(b.id)).map(b=>({id:'bl-'+b.id,name:b.name,bey:b.bey,blader:b,color:b.color})),
    ...Object.values(BEYS).map(b=>({id:b.id,name:'CPU',bey:b,color:b.colors?.primary})),
  ];
  const opp=opponents.find(o=>o.id===oppId)||opponents[0];
  const me={name:save.profile?.nickname||tr("你"),avatar:avatarOf(save.profile?.avatar)};
  const startCpu=()=>{
    sfx.clang(1);
    if(!save.collection.length)useGame.getState().addBey(myBey,'starter');
    const uid=save.collection.length?myBey.uid:useGame.getState().save.collection[0].uid;
    go('battle',{beyUid:uid,oppBey:opp.bey,...(opp.blader?{oppLook:opp.blader.id}:{}),from:'versus'});
  };

  if(step==='online')return <OnlineRoom myBey={myBey} initialCode={invite} onExit={()=>{if(invite)go('versus',{});else setStep('friend');}}/>;

  return (
    <div className={`vx vx-s-${step}`}>
      <div className="vx-lines"/>
      <div className="vx-top">
        <button className="btn small" onClick={()=>step==='home'?go('title'):setStep('home')}>◀ {step==='home'?tr("返回"):tr("对战模式")}</button>
        <h1 className="vx-title">{step==='home'?tr("对战模式"):step==='cpu'?'VS CPU':tr("VS 朋友")}</h1>
        <div className="vx-me"><Face me={me} bey={myBey} size={38}/><b>{me.name}</b></div>
      </div>

      {step==='home'&&<div className="vx-home">
        <button className="vx-entry cpu" onClick={()=>{sfx.whoosh();setStep('cpu');}}>
          <span className="vx-entry-bg"/><span className="vx-entry-lines"/>
          <span className="vx-entry-art">
            <EntryBey bey={myBey} side="a"/>
            <EntryBey bey={BEYS.titan} side="b"/>
          </span>
          <span className="vx-entry-k">{tr("单人练习 · 做实验")}</span>
          <span className="vx-entry-h">VS CPU</span>
          <span className="vx-entry-p">{tr("挑任意对手，5 局 3 胜")}<br/>{tr("适合「只改一个变量」比一比")}</span>
          <span className="vx-entry-go">{tr("出发 ▶")}</span>
        </button>
        <div className="vx-or">VS</div>
        <button className="vx-entry friend" onClick={()=>{sfx.whoosh();setStep('friend');}}>
          <span className="vx-entry-bg"/><span className="vx-entry-lines"/>
          <span className="vx-entry-art faces">
            <span className="vx-entry-face a">{me.avatar?<img src={`/art/avatars/${me.avatar}.png`} alt=""/>:<BeyArt bey={myBey} size={110}/>}</span>
            <span className="vx-entry-face b"><span>?</span></span>
          </span>
          <span className="vx-entry-k">{tr("联机 · 只用房间码")}</span>
          <span className="vx-entry-h">{tr("VS 朋友")}</span>
          <span className="vx-entry-p">{tr("建个房间，把房间码念给朋友")}<br/>{tr("两台设备同时开打")}</span>
          <span className="vx-entry-go">{tr("联机 ▶")}</span>
        </button>
      </div>}

      {step==='cpu'&&<div className="vx-setup">
        <BeyPick pool={pool} value={myBey.uid} onChange={setMine} label={tr("我方陀螺")}/>
        <div className="vx-mid"><span>V</span><span>S</span></div>
        <OppPick opponents={opponents} value={opp.id} onChange={setOppId}/>
        <div className="vx-strip">
          <div className="vx-strip-side me"><Face me={me} bey={myBey} size={50}/><span><b>{beyTitle(myBey)}</b><small>{me.name}</small></span></div>
          <div className="vx-strip-vs">VS</div>
          <div className="vx-strip-side opp">{opp.blader?<span className="vx-face"><Portrait blader={opp.blader} size={50}/></span>:<span className="vx-face bey"><BeyArt bey={opp.bey} size={44}/></span>}<span><b>{opp.bey.name}</b><small>{opp.blader?opp.blader.name:'CPU'}</small></span></div>
          <button className="vx-fight" onClick={startCpu}>{tr("开打！")}</button>
        </div>
      </div>}

      {step==='friend'&&<div className="vx-setup friend">
        <BeyPick pool={pool} value={myBey.uid} onChange={setMine} label={tr("带哪只陀螺去联机？")}/>
        <div className="vx-friend-info">
          <div className="vx-friend-card">
            <div className="vx-friend-h">{tr("怎么和朋友对战")}</div>
            <ol>
              <li><b>1</b>{tr("一个人")}<em>{tr("创建房间")}</em>{tr("，拿到 5 位房间码")}</li>
              <li><b>2</b>{tr("把房间码")}<em>{tr("念给朋友")}</em>{tr("（或者发邀请链接）")}</li>
              <li><b>3</b>{tr("两边都")}<em>{tr("拉开发射器")}</em>{tr("，比赛同时开始")}</li>
            </ol>
            <div className="vx-safe">{tr("🔒 只能邀请认识的朋友 · 没有陌生人匹配")}</div>
          </div>
          <button className="vx-fight" onClick={()=>{sfx.clang(1);setStep('online');}}>{tr("进入联机大厅 ▶")}</button>
        </div>
      </div>}
    </div>
  );
}

// Both hero tops use the same camera, lighting and model-local spin axis.
// Rotating a rendered image or its DOM container would rotate the camera too.
function EntryBey({bey,side}){
  return <span className={`vx-entry-bey ${side}`} aria-hidden="true">
    <Suspense fallback={null}>
      <BeyShowcase bey={bey} rpm={3200} tilt={.62} zoom={1.12} background={false} style={{background:'transparent'}}/>
    </Suspense>
  </span>;
}

function Face({me,bey,size}){
  return <span className="vx-face" style={{width:size,height:size}}>{me.avatar?<img src={`/art/avatars/${me.avatar}.png`} alt=""/>:<BeyArt bey={bey} size={size*.85}/>}</span>;
}

// Big bey card with ◀ ▶ (one bey at a time — no scrolling row).
function BeyPick({pool,value,onChange,label}){
  const i=Math.max(0,pool.findIndex(b=>b.uid===value)), b=pool[i];
  const step=d=>{sfx.beep();onChange(pool[(i+d+pool.length)%pool.length].uid);};
  return (
    <div className="vx-pick" style={{'--c':b.colors?.primary||'#2f7bff'}}>
      <div className="vx-pick-label">{label}</div>
      <div className="vx-pick-card" key={b.uid}>
        <div className="vx-pick-bg"/>
        <div className="vx-pick-art"><BeyArt bey={b} size={210}/></div>
        <div className="vx-pick-name">{beyTitle(b)}{beySub(b)&&<small>{beySub(b)}</small>}</div>
        <div className="vx-pick-meta"><TypeBadge type={b.type||b.blade?.style}/><span>{b.ratchet?.prongs||3}-{b.ratchet?.height||60} · {b.bit}</span></div>
      </div>
      {pool.length>1&&<>
        <button className="vx-arrow l" onClick={()=>step(-1)} aria-label={tr("上一只")}>◀</button>
        <button className="vx-arrow r" onClick={()=>step(1)} aria-label={tr("下一只")}>▶</button>
        <div className="vx-dots">{pool.map(x=><i key={x.uid} className={x.uid===b.uid?'on':''}/>)}</div>
      </>}
    </div>
  );
}

// Opponent grid: portrait cards for defeated bladers, bey cards for CPU; paged instead of scrolled.
function OppPick({opponents,value,onChange}){
  const pages=Math.ceil(opponents.length/PAGE);
  const [page,setPage]=useState(Math.floor(Math.max(0,opponents.findIndex(o=>o.id===value))/PAGE));
  const shown=opponents.slice(page*PAGE,page*PAGE+PAGE);
  return (
    <div className="vx-opps">
      <div className="vx-pick-label">{tr("选对手")}</div>
      <div className="vx-opp-grid" key={page}>
        {shown.map((o,k)=><button key={o.id} className={`vx-opp ${o.id===value?'on':''}`} style={{'--c':o.color||'#8d99a6','--k':k}} onClick={()=>{sfx.beep(true);onChange(o.id);}}>
          {o.blader?<><span className="vx-opp-face"><Portrait blader={o.blader} size={84}/></span><span className="vx-opp-bey"><BeyArt bey={o.bey} size={56}/></span></>
            :<><span className="vx-opp-face cpu"><BeyArt bey={o.bey} size={72}/></span><span className="vx-opp-cpu">CPU</span></>}
          <span className="vx-opp-name"><b>{o.blader?o.name:o.bey.name}</b><small>{o.blader?o.bey.name:({attack:tr("攻击型"),defense:tr("防御型"),stamina:tr("耐力型"),balance:tr("平衡型")}[o.bey.type]||'CPU')}</small></span>
          {o.id===value&&<span className="vx-opp-stamp">{tr("挑战！")}</span>}
        </button>)}
      </div>
      {pages>1&&<div className="vx-pager">
        <button onClick={()=>setPage((page-1+pages)%pages)}>◀</button><span>{page+1} / {pages}</span><button onClick={()=>setPage((page+1)%pages)}>▶</button>
      </div>}
    </div>
  );
}
