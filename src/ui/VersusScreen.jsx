import {useEffect,useRef,useState} from 'react';
import {useGame} from '../game/store.js';
import {BEYS} from '../game/beys.js';
import {BLADERS,FINISH_LABEL,FINISH_ZH} from '../game/story.js';
import {createRoom,joinRoom} from '../net/room.js';
import {createBattle} from '../game/battlePlayer.js';
import BattleScene from '../scene/BattleScene.jsx';
import BeyArt from './BeyArt.jsx';
import {TopBar,TypeBadge} from './common.jsx';
import LaunchGauge from './LaunchGauge.jsx';
import {STYLES,playerLaunch} from './BattleScreen.jsx';
import './battle.css';

const strip=b=>{const {uid,origin,...rest}=b;return rest;};

export default function VersusScreen(){
  const {save,go}=useGame();
  const pool=save.collection.length?save.collection:Object.values(BEYS).slice(0,3).map(b=>({...b,uid:b.id}));
  const [mine,setMine]=useState(pool[0]?.uid);
  const [oppId,setOppId]=useState('titan');
  const [mode,setMode]=useState(null); // null | online
  const myBey=pool.find(b=>b.uid===mine)||pool[0];
  const opponents=[...Object.values(BEYS).map(b=>({id:b.id,label:b.name,bey:b})),...BLADERS.filter(b=>save.defeated.includes(b.id)).map(b=>({id:'bl-'+b.id,label:`${b.name} 的 ${b.bey.name}`,bey:b.bey}))];
  const opp=opponents.find(o=>o.id===oppId)||opponents[0];
  const startCpu=()=>{
    if(!save.collection.length)useGame.getState().addBey(myBey,'starter');
    const uid=save.collection.length?myBey.uid:useGame.getState().save.collection[0].uid;
    go('battle',{beyUid:uid,oppBey:opp.bey});
  };
  if(mode==='online')return <OnlineRoom myBey={myBey} onExit={()=>setMode(null)}/>;
  return (
    <div className="page">
      <TopBar title="对战模式" back="title"/>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(380px,1fr))'}}>
        <div className="panel" style={{padding:22}}>
          <h2 className="h-display" style={{fontSize:34}}>VS CPU</h2>
          <p style={{fontWeight:700}}>从你的收藏里任选一只，对手任你挑。适合做「只改一个变量」的科学实验。</p>
          <div className="prep-h mt">我方</div>
          <BeyPicker list={pool} value={mine} onChange={setMine}/>
          <div className="prep-h mt">对手</div>
          <div className="row wrap" style={{gap:8}}>{opponents.map(o=><button key={o.id} className={`chip ${oppId===o.id?'on':''}`} onClick={()=>setOppId(o.id)}>{o.label}</button>)}</div>
          <button className="btn primary big mt2" onClick={startCpu}>开打 ▶</button>
        </div>
        <div className="panel ink" style={{padding:22,boxShadow:'6px 6px 0 var(--red)'}}>
          <h2 className="h-display h-yellow" style={{fontSize:34}}>VS 朋友（联机）</h2>
          <p style={{fontWeight:700,lineHeight:1.6}}>创建房间，把房间码告诉朋友。双方准备好后，服务器发同一个随机种子，两边各自算同一份确定性物理，再由服务器核对结果。</p>
          <p className="model-note" style={{color:'#bbb'}}>只能用房间码邀请，没有陌生人匹配和私信。</p>
          <button className="btn yellow big mt" onClick={()=>setMode('online')}>进入联机大厅</button>
        </div>
      </div>
    </div>
  );
}

function BeyPicker({list,value,onChange}){
  return <div className="col" style={{gap:8,maxHeight:260,overflowY:'auto'}}>{list.map(b=><button key={b.uid} className={`prep-bey ${b.uid===value?'on':''}`} onClick={()=>onChange(b.uid)}><BeyArt bey={b} size={44}/><span className="grow"><b>{b.name}</b></span><TypeBadge type={b.type||b.blade?.style}/></button>)}</div>;
}

function OnlineRoom({myBey,onExit}){
  const nickname=useGame(s=>s.save.profile?.nickname)||'玩家';
  const [code,setCode]=useState('');
  const [input,setInput]=useState('');
  const [room,setRoom]=useState(null);
  const [slot,setSlot]=useState(null);
  const [conn,setConn]=useState(null);
  const [error,setError]=useState(null);
  const [player,setPlayer]=useState(null);
  const [final,setFinal]=useState(null);
  const [style,setStyle]=useState('charge');
  const api=useRef(null);
  useEffect(()=>()=>{api.current?.leave();},[]);
  const join=(c)=>{
    setError(null);setCode(c);
    api.current=joinRoom(c,{nickname,bey:strip(myBey)},{
      onState:(r,you)=>{setRoom(r);setSlot(you);},
      onStart:(m)=>{setFinal(null);const p=createBattle({beys:m.beys,launches:m.launches});p.meta=m;
        p.onDone(()=>{});setPlayer(p);setTimeout(()=>p.start(),1200);
        const iv=setInterval(()=>{p.getTime();if(p.finished){clearInterval(iv);api.current?.sendResult({matchId:m.matchId,winner:p.result.winner,reason:p.result.reason,time:p.result.time});}},200);},
      onFinal:(f)=>setFinal(f),
      onError:(e)=>setError(e.message||e.code),
      onConnection:setConn,
    });
  };
  const create=async()=>{const r=await createRoom();if(r.data?.code)join(r.data.code);else setError(r.error?.message||'创建失败');};
  const me=room?.players?.[slot], other=room?.players?.find(p=>p.slot!==slot);
  if(!code)return (
    <div className="page dark">
      <div className="topbar"><button className="btn small" onClick={onExit}>◀ 返回</button><h1 className="h-display h-outline" style={{fontSize:40}}>联机大厅</h1><span/></div>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',maxWidth:900,margin:'0 auto'}}>
        <div className="panel" style={{padding:24,color:'#111'}}><h2 className="panel-title" style={{fontSize:26}}>创建房间</h2><p>出战：<b>{myBey.name}</b></p><button className="btn primary big" onClick={create}>创建</button></div>
        <div className="panel" style={{padding:24,color:'#111'}}><h2 className="panel-title" style={{fontSize:26}}>加入房间</h2>
          <input value={input} onChange={e=>setInput(e.target.value.toUpperCase())} placeholder="房间码" maxLength={6} style={{border:'var(--border)',padding:'10px 14px',font:'inherit',fontSize:28,fontWeight:900,letterSpacing:'.2em',width:'100%'}}/>
          <button className="btn yellow big mt" disabled={input.length<4} onClick={()=>join(input)}>加入</button></div>
      </div>
      {error&&<p className="h-red" style={{textAlign:'center'}}>{error}</p>}
    </div>
  );
  return (
    <div className="page dark battle-page">
      <div className="topbar"><button className="btn small" onClick={()=>{api.current?.leave();onExit();}}>◀ 离开</button>
        <div className="h-display h-yellow" style={{fontSize:36,letterSpacing:'.15em'}}>{code}</div>
        <span className="chip">{conn==='open'?'🟢 已连接':conn==='reconnecting'?'🟡 重连中':'⚪ 连接中'}</span></div>
      {error&&<div className="prep-exp">{error}</div>}
      <div className="hud">
        {[0,1].map(i=>{const p=room?.players?.[i];return <div key={i} className={`hud-side ${i?'right':''}`} style={{background:i?'#f2b632':'#2f7bff'}}>
          <div className="row between"><span className="hud-name">{p?.nickname||'等待加入…'}{i===slot?'（你）':''}</span><span className="hud-pts">{room?.score?.[i]??0} PT</span></div>
          <div className="hud-meta">{p?.bey?.name||'—'} · {p?(p.ready?'✓ 已准备':'选择中'):''}</div></div>;})}
        <div className="hud-mid" style={{gridRow:1,gridColumn:2}}><div>ROUND {room?.round||1}</div><div className="hud-target">先拿 {room?.target||4} 分</div></div>
      </div>
      <div className="battle-stage">
        {player&&<BattleScene player={player} style={{position:'absolute',inset:0}}/>}
        {(!player||final)&&room?.status!=='done'&&<div className="prep">
          {final&&<div className="prep-last">上一回合：<b>{FINISH_LABEL[final.reason]}</b>（{FINISH_ZH[final.reason]}）· {room?.players?.[final.winner]?.nickname} +{final.points}{final.mismatch?' · 两边结果不一致，以房主为准':''}</div>}
          {!other&&<div className="panel" style={{padding:20,maxWidth:520}}><b>把房间码 <span style={{fontSize:28,letterSpacing:'.15em'}}>{code}</span> 告诉朋友</b><p>等朋友加入…</p></div>}
          {other&&!me?.ready&&<div className="prep-grid">
            <div className="panel prep-col"><div className="prep-h">发射方式</div><div className="row wrap" style={{gap:8}}>{Object.entries(STYLES).map(([k,s])=><button key={k} className={`chip ${style===k?'on':''}`} onClick={()=>setStyle(k)}>{s.label}</button>)}</div></div>
            <div className="panel prep-col" style={{alignItems:'center'}}><LaunchGauge onShoot={v=>{setPlayer(null);api.current?.ready(playerLaunch(style,v,room?.round||1),strip(myBey));}}/></div>
          </div>}
          {me?.ready&&<div className="panel" style={{padding:20,maxWidth:520}}><b>已准备！</b> 等 {other?.nickname} 发射…</div>}
        </div>}
        {room?.status==='done'&&<div className="prep"><div className="panel" style={{padding:24,maxWidth:560}}>
          <div className="h-display h-red" style={{fontSize:56}}>{room.champion===slot?'VICTORY!':'GOOD GAME!'}</div>
          <p style={{fontWeight:800}}>{room.players?.[room.champion]?.nickname} 获胜 · {room.score?.join(' : ')}</p>
          <div className="row"><button className="btn primary" onClick={()=>{setPlayer(null);setFinal(null);api.current?.rematch();}}>再来一局</button><button className="btn" onClick={()=>{api.current?.leave();onExit();}}>离开</button></div>
        </div></div>}
      </div>
    </div>
  );
}
