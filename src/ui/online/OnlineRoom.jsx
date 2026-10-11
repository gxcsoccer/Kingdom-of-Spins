// Online versus (invite-code rooms only — no stranger matchmaking).
// Lobby → waiting room → per round: VS splash (round 1) → 3D slingshot (LaunchSequence) → "对手正在发射…" →
// server 'start' → both browsers run the same deterministic physics → result → 'final' → round banner → … → champion.
// The seat is remembered (code + pid) so a refresh or network drop rejoins the same room and progress.
import {useEffect,useMemo,useRef,useState} from 'react';
import {useGame} from '../../game/store.js';
import {FINISH_LABEL,FINISH_ZH} from '../../game/story.js';
import {createRoom,joinRoom} from '../../net/room.js';
import {createBattle} from '../../game/battlePlayer.js';
import {useTaskScope} from '../../game/useTaskScope.js';
import BattleScene from '../../scene/BattleScene.jsx';
import BeyArt from '../BeyArt.jsx';
import {beyTitle} from '../beyName.js';
import LaunchSequence,{VsSplash} from '../LaunchSequence.jsx';
import PauseMenu from '../PauseMenu.jsx';
import {Hud} from '../BattleScreen.jsx';
import * as sfx from '../../game/sfx.js';
import '../battle.css';
import './online.css';

const strip=b=>{const {uid,origin,...rest}=b;return rest;};
const avatarOf=v=>/^[1-4]$/.test(String(v))?String(v):null;
const SEAT_TTL=2*3600_000;

// ---- seat memory: sessionStorage (per tab) first, localStorage as fallback after the tab was closed ----
function seat(ns){
  const k=`kos.online${ns}`;
  return {
    get(){try{const v=JSON.parse(sessionStorage.getItem(k)||localStorage.getItem(k)||'null');return v&&Date.now()-v.t<SEAT_TTL?v:null;}catch{return null;}},
    set(v){try{const s=JSON.stringify({...v,t:Date.now()});sessionStorage.setItem(k,s);localStorage.setItem(k,s);}catch{}},
    clear(){try{sessionStorage.removeItem(k);localStorage.removeItem(k);}catch{}},
  };
}
const newPid=()=>{try{return crypto.randomUUID();}catch{return String(Math.random()).slice(2)+Date.now();}};

function Avatar({avatar,bey,size=96}){
  return <div className="ol-ava" style={{width:size,height:size,'--c':bey?.colors?.primary||'#2f7bff'}}>
    {avatar?<img src={`/art/avatars/${avatar}.png`} alt=""/>:bey?<BeyArt bey={bey} size={size*.8}/>:<span>?</span>}
  </div>;
}

/** props: myBey, onExit, initialCode (from ?room= invite link), ns (storage namespace — dev harness only) */
export default function OnlineRoom({myBey,onExit,initialCode=null,ns=''}){
  const tasks=useTaskScope();
  const profile=useGame(s=>s.save.profile);
  const nickname=profile?.nickname||'玩家';
  const avatar=avatarOf(profile?.avatar);
  const beyMsg=useMemo(()=>({...strip(myBey),owner:{avatar}}),[myBey,avatar]);
  const mem=useMemo(()=>seat(ns),[ns]);

  const [code,setCode]=useState(null);
  const [room,setRoom]=useState(null);
  const [slot,setSlot]=useState(-1);
  const [conn,setConn]=useState(null);
  const [error,setError]=useState(null);
  const [busy,setBusy]=useState(false);
  const [phase,setPhase]=useState('room'); // room | launch | fight | banner | champ
  const [launched,setLaunched]=useState(false);
  const [player,setPlayer]=useState(null);
  const [finals,setFinals]=useState({}); // matchId → final
  const [vsSeen,setVsSeen]=useState(false);
  const [goInfo,setGoInfo]=useState(null);   // {round, at, deadline} in local ms — the synced countdown + launch window
  const [oppPull,setOppPull]=useState(0);
  const [startAt,setStartAt]=useState(0);
  const [autoFired,setAutoFired]=useState(false);
  const [now,setNow]=useState(Date.now());
  const lastPull=useRef(0);
  const api=useRef(null), slotRef=useRef(-1), matchRef=useRef(null), resumeRef=useRef(false), pauseRef=useRef(false);

  useEffect(()=>()=>{api.current?.leave();},[]); // navigating away = leaving (the seat survives only a refresh)
  useEffect(()=>()=>{player?.dispose?.();sfx.spinHum(false);},[player]);

  const join=(c,{resume=false}={})=>{
    c=String(c).trim().toUpperCase();
    setError(null);setCode(c);resumeRef.current=resume;
    const prev=mem.get();
    const pid=prev?.pid||newPid();
    mem.set({code:c,pid});
    const h=joinRoom(c,{nickname,bey:beyMsg,pid},{
      onState:(r,you)=>{slotRef.current=you;setRoom(r);setSlot(you);},
      onStart:startMatch,
      onFinal:f=>{setFinals(m=>({...m,[f.matchId]:f}));},
      onError:e=>{
        if(e.code==='no-room'||e.code==='full'){mem.clear();h.leave();setCode(null);setRoom(null);setError(e.code==='full'?'这个房间已经有两位小玩家了':'房间不存在或已经过期，检查一下房间码？');}
        else if(e.code!=='locked')console.warn('[room]',e);
      },
      onConnection:setConn,
      onGo:g=>{setGoInfo({round:g.round,at:h.toLocal(g.at),deadline:h.toLocal(g.deadline)});setOppPull(0);setAutoFired(false);setLaunched(false);setPlayer(null);setPhase('launch');},
      onPull:m=>{if(m.slot!==slotRef.current)setOppPull(m.power);},
    });
    api.current=h;
  };
  // Auto-join: invite link first, otherwise resume a remembered seat.
  useEffect(()=>{
    const prev=mem.get();
    if(initialCode)join(initialCode,{resume:prev?.code===String(initialCode).toUpperCase()});
    else if(prev?.code)join(prev.code,{resume:true});
  },[]);// eslint-disable-line

  const create=async()=>{
    setBusy(true);setError(null);sfx.beep(true);
    const r=await createRoom();setBusy(false);
    if(r.data?.code){mem.clear();join(r.data.code);}else setError('创建房间失败了，再试一次？');
  };
  const leave=()=>{api.current?.leave();mem.clear();player?.dispose?.();sfx.spinHum(false);window.speechSynthesis?.cancel();onExit();};

  function startMatch(m){
    if(matchRef.current===m.matchId)return;
    tasks.cancel();
    matchRef.current=m.matchId;
    const p=createBattle({beys:m.beys,launches:m.launches});
    p.meta=m;
    p.onEvent(e=>{if(e.type==='collision')sfx.clang(e.intensity);if(e.type==='dash')sfx.whoosh();if(e.type==='finish'){sfx.spinHum(false);sfx.fanfare(e.winner===slotRef.current);}});
    p.onError(()=>{tasks.cancel();sfx.spinHum(false);setPhase('error');});
    // Report as soon as the physics is done (not when playback ends) so a local pause never stalls the other kid.
    p.onDone(pl=>{const r=pl.result;api.current?.sendResult({matchId:m.matchId,winner:r.winner,reason:r.reason,time:r.time});});
    pauseRef.current=false;
    // Both browsers start playback at the same server instant (m.at); legacy servers send no `at` → start now.
    const at=m.at?api.current?.toLocal(m.at)??Date.now():Date.now(), wait=Math.max(0,Math.min(3000,at-Date.now()));
    setStartAt(Date.now()+wait);
    setPlayer(p);setLaunched(false);setPhase('fight');
    tasks.schedule(()=>{p.start();sfx.spinHum(true);},wait);
  }

  // Playback finished → hold 2.6 s (unpaused) on the finish banner → round banner.
  useEffect(()=>{
    if(phase!=='fight'||!player)return;
    let raf,t;const tick=()=>{player.getTime();if(player.finished){
      let left=2600;const step=()=>{if(!pauseRef.current)left-=100;if(left<=0)setPhase('banner');else t=setTimeout(step,100);};t=setTimeout(step,100);return;}
      raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(raf);clearTimeout(t);};
  },[phase,player]);

  const me=room?.players?.[slot], other=room?.players?.find(p=>p.slot!==slot);
  const score=room?.score||[0,0], target=room?.target||3;

  // Resume after refresh / reconnect: jump to wherever the room is.
  useEffect(()=>{
    if(!room||!resumeRef.current||slot<0)return;
    resumeRef.current=false;
    if(room.status==='done'){setPhase('champ');return;}
    if(room.status==='waiting'&&me?.ready){setVsSeen(true);setPhase('launch');setLaunched(true);}
    else if(room.status==='waiting'&&(room.round>1||score[0]+score[1]>0))setVsSeen(true); // waits in the room for 准备好了 (or the re-sent 'go')
  },[room,slot]);// eslint-disable-line

  const curFinal=player?finals[player.meta.matchId]:null;
  // While this round is still playing locally, don't spoil it: the server score may already include it.
  const hudScore=phase==='fight'&&curFinal?curFinal.score.map((v,i)=>i===curFinal.winner?v-1:v):score;
  // 准备好了: tell the room (synced servers answer with 'go' once both kids are armed); legacy servers: start locally.
  const arm=()=>{sfx.beep(true);if(api.current?.synced)api.current.arm();else{setGoInfo({round:room?.round||1,at:Date.now(),deadline:null});setLaunched(false);setPlayer(null);setPhase('launch');}};
  const afterBanner=()=>{if(!curFinal)return;if(curFinal.matchOver){setPlayer(null);setPhase('champ');}else if(!me?.armed)arm();};
  const ticking=phase==='launch'||(phase==='fight'&&now<startAt);
  useEffect(()=>{if(!ticking)return;const iv=setInterval(()=>setNow(Date.now()),100);return()=>clearInterval(iv);},[ticking]);
  const onPower=pw=>{const t=Date.now();if(t-lastPull.current>=150||pw===0){lastPull.current=t;api.current?.pull(+pw.toFixed(2));}};

  if(!code)return <Lobby {...{myBey,nickname,avatar,error,busy,create,join,onExit}}/>;
  if(phase==='error')return <div className="page"><div className="panel"><p>对战暂时没能启动，请退出后重新加入房间</p><button className="btn primary" onClick={leave}>退出房间</button></div></div>;

  const names=[0,1].map(i=>room?.players?.[i]?.nickname||'…');
  const beys=[0,1].map(i=>room?.players?.[i]?.bey||(i===slot?myBey:myBey));
  // Slot 1 launches from the far side: turn the camera 180° (view only) and mirror the HUD so "me" is always on the left.
  const flip=slot===1, ord=flip?[1,0]:[0,1];
  const hudBase=player||idleOf(beys);
  const hudPlayer=flip?swapView(hudBase):hudBase;
  const showStage=phase==='launch'||phase==='fight'||phase==='banner';
  const oppOffline=other&&!other.connected;

  return (
    <div className="page dark battle-page ol-page">
      {phase==='room'&&<WaitRoom {...{code,room,slot,me,other,conn,myBey,leave}} onGo={arm}/>}
      {showStage&&<>
        <Hud player={hudPlayer} names={ord.map(i=>i===slot?`${names[i]}（你）`:names[i])} beys={ord.map(i=>beys[i])} score={ord.map(i=>hudScore[i])} target={target} color={beys[ord[1]]?.colors?.primary||'#f2b632'} round={player?.meta?.round||room?.round||1}/>
        <div className="battle-stage">
          <PauseMenu onPause={on=>{pauseRef.current=on;if(phase==='fight'&&player)player.setPaused(on);if(on)sfx.spinHum(false);else if(phase==='fight'&&player&&!player.finished)sfx.spinHum(true);}} onExit={leave}/>
          <BattleScene player={player||idleOf(beys)} flip={flip} frameloop={player?'always':'demand'} style={{position:'absolute',inset:0}}/>
          {phase==='launch'&&goInfo&&now<goInfo.at&&<Countdown at={goInfo.at} now={now} first={!vsSeen&&(room?.round||1)===1} me={{name:nickname,avatar}} other={other} myBey={myBey}/>}
          {phase==='launch'&&!launched&&other&&(!goInfo||now>=goInfo.at)&&<LaunchSequence key={`r${room?.round}`} autoFireAt={goInfo?.deadline||undefined} onPower={onPower}
            me={{name:nickname,avatar}} opp={{name:other.nickname,bey:other.bey||myBey,color:other.bey?.colors?.primary||'#f2b632',avatar:avatarOf(other.bey?.owner?.avatar)}}
            beys={[{...myBey,uid:myBey.uid||'me'}]} beyUid={myBey.uid||'me'} setBeyUid={()=>{}}
            first={false} lastRound={room?.last&&room.status==='waiting'?room.last:null}
            lastLabel={room?.last?`上一局：${FINISH_LABEL[room.last.reason]} · ${room.players?.[room.last.winner]?.nickname||''} 赢下这局　比分 ${score[0]} : ${score[1]}`:''} onPredict={()=>setVsSeen(true)}
            onLaunch={l=>{setVsSeen(true);setLaunched(true);if(goInfo?.deadline&&Date.now()>=goInfo.deadline+800)setAutoFired(true);api.current?.pull(1);api.current?.ready({rpm:l.rpm,speed:l.speed,aim:l.aim,tilt:l.tilt},beyMsg);}}/>}
          {phase==='launch'&&!launched&&goInfo&&now>=goInfo.at&&<LaunchHud goInfo={goInfo} now={now} other={other} pull={oppPull}/>}
          {phase==='launch'&&launched&&<WaitOpp me={me} other={other} myBey={myBey} offline={oppOffline} pull={oppPull} autoFired={autoFired}/>}
          {phase==='fight'&&now<startAt&&<div className="ol-ready-go" key={startAt}>READY…<b>GO!</b></div>}
          {phase==='banner'&&<RoundBanner final={curFinal} slot={slot} room={room} round={player?.meta?.round} onNext={afterBanner} armed={!!me?.armed} other={other}/>}
          {oppOffline&&!(phase==='launch'&&launched)&&<div className="ol-offline">📡 {other.nickname} 掉线了，等待重连…</div>}
          {conn==='reconnecting'&&<div className="ol-offline me">📡 网络断了，正在重新连接…</div>}
        </div>
      </>}
      {phase==='champ'&&<Champion {...{room,slot,leave}} onRematch={()=>{sfx.beep(true);if(room?.status==='done')api.current?.rematch();setFinals({});setVsSeen(false);setPlayer(null);setLaunched(false);setGoInfo(null);setPhase('room');}}/>}
    </div>
  );
}

// HUD view with the two bodies swapped (memoised per player so the HUD's rAF loop isn't restarted every render).
const swapCache=new WeakMap();
function swapView(p){
  if(!swapCache.has(p))swapCache.set(p,{get clock(){return p.clock;},get paused(){return p.paused;},
    getState:t=>{const st=p.getState(t);return st?.bodies?{...st,bodies:[st.bodies[1],st.bodies[0]]}:st;}});
  return swapCache.get(p);
}
// Static stand-in so the WebGL canvas is warm behind the slingshot.
const idleCache=new WeakMap();
function idleOf(beys){
  const k=beys[0];if(idleCache.has(k)&&idleCache.get(k).beys[1]===beys[1])return idleCache.get(k);
  const st={time:0,bodies:[{p:[-.09,0,.045],q:[1,0,0,0],rpm:0,tilt:0},{p:[.09,0,.045],q:[1,0,0,0],rpm:0,tilt:0}]};
  const p={beys,events:[],getTime:()=>0,getState:()=>st};idleCache.set(k,p);return p;
}

// ================= Lobby =================
function Lobby({myBey,nickname,avatar,error,busy,create,join,onExit}){
  const [input,setInput]=useState('');
  const ok=input.length===5;
  return (
    <div className="page ol-page ol-lobby">
      <div className="ol-top">
        <button className="btn small" onClick={onExit}>◀ 返回</button>
        <h1 className="h-display h-outline ol-title">联机大厅</h1>
        <div className="ol-me-chip"><Avatar avatar={avatar} bey={myBey} size={40}/><b>{nickname}</b><span>· {beyTitle(myBey)}</span></div>
      </div>
      <div className="ol-cards">
        <div className="ol-card red">
          <div className="ol-card-lines"/>
          <div className="ol-card-kicker">STEP 1 · 我来当房主</div>
          <h2 className="ol-card-h">创建房间</h2>
          <div className="ol-card-bey"><BeyArt bey={myBey} size={150}/></div>
          <p className="ol-card-p">拿到一个 <b>5 位房间码</b>，念给朋友听</p>
          <button className="btn yellow big ol-cta" disabled={busy} onClick={create}>{busy?'创建中…':'创建房间！'}</button>
        </div>
        <div className="ol-vs">OR</div>
        <div className="ol-card yellow">
          <div className="ol-card-lines"/>
          <div className="ol-card-kicker">朋友给了我房间码</div>
          <h2 className="ol-card-h">加入房间</h2>
          <label className="ol-code-input">
            <input className="kos-input" value={input} autoFocus inputMode="text" autoComplete="off" spellCheck={false} maxLength={5}
              onChange={e=>setInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} onKeyDown={e=>{if(e.key==='Enter'&&ok)join(input);}}/>
            <div className="ol-code-boxes" aria-hidden>{[0,1,2,3,4].map(i=><span key={i} className={i===input.length?'cur':''}>{input[i]||''}</span>)}</div>
          </label>
          <p className="ol-card-p">输入朋友念给你的房间码</p>
          <button className="btn primary big ol-cta" disabled={!ok} onClick={()=>{sfx.beep(true);join(input);}}>加入！</button>
        </div>
      </div>
      {error&&<div className="ol-error">😮 {error}</div>}
      <div className="ol-safe">🔒 只能用房间码邀请认识的朋友 · 不会匹配陌生人</div>
    </div>
  );
}

// ================= Waiting room =================
function WaitRoom({code,room,slot,me,other,conn,myBey,leave,onGo}){
  const [copied,setCopied]=useState(null);
  const copy=async(text,what)=>{try{await navigator.clipboard.writeText(text);}catch{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();try{document.execCommand('copy');}catch{}t.remove();}
    sfx.beep(true);setCopied(what);setTimeout(()=>setCopied(c=>c===what?null:c),1600);};
  const link=`${location.origin}${location.pathname}?room=${code}`;
  const card=(p,i,mine)=>{
    if(!p)return <div key={i} className="ol-pcard empty"><div className="ol-ava ol-ava-q" style={{width:120,height:120}}><span>?</span></div><b className="ol-pname">等朋友加入…</b><p>把房间码告诉朋友</p><div className="ol-dots"><i/><i/><i/></div></div>;
    const bey=mine?myBey:p.bey;const off=!p.connected;
    return <div key={i} className={`ol-pcard ${mine?'mine':'theirs'} ${off?'off':''}`} style={{'--c':bey?.colors?.primary||'#2f7bff'}}>
      <div className="ol-pcard-tag">{mine?'你':'对手'}</div>
      <Avatar avatar={mine?avatarOf(p.bey?.owner?.avatar)||avatarOf(useGame.getState().save.profile?.avatar):avatarOf(p.bey?.owner?.avatar)} bey={bey} size={104}/>
      <b className="ol-pname">{p.nickname}</b>
      <div className="ol-pbey">{bey&&<BeyArt bey={bey} size={96}/>}<span>{bey?beyTitle(bey):'—'}</span></div>
      <div className={`ol-pstate ${off?'off':p.armed||p.ready?'ready':'on'}`}>{off?'📡 等待重连…':p.ready?'✓ 已发射，等你！':p.armed?'✓ 准备好了！':'● 已连接'}</div>
    </div>;
  };
  const left=room?.players?.find(p=>p.slot===slot), right=room?.players?.find(p=>p.slot!==slot);
  const canGo=!!(other&&other.connected&&room?.status==='waiting');
  return (
    <div className="ol-wait">
      <div className="ol-top">
        <button className="btn small" onClick={leave}>◀ 离开房间</button>
        <h1 className="h-display h-outline ol-title">等待区</h1>
        <span className={`ol-conn ${conn}`}>{conn==='open'?'● 已连上服务器':conn==='reconnecting'?'◌ 重新连接中…':'◌ 连接中…'}</span>
      </div>
      <div className="ol-codebar">
        <div className="ol-code-label">房间码<small>念给朋友听</small></div>
        <div className="ol-code-big">{code.split('').map((c,i)=><span key={i} style={{'--i':i}}>{c}</span>)}</div>
        <div className="ol-code-btns">
          <button className="btn small" onClick={()=>copy(code,'code')}>📋 复制房间码</button>
          <button className="btn small yellow" onClick={()=>copy(link,'link')}>🔗 复制邀请链接</button>
        </div>
        {copied&&<div className="ol-stamp" key={copied}>{copied==='code'?'已复制！':'链接已复制！'}</div>}
      </div>
      <div className="ol-players">
        {card(left||me,0,true)}
        <div className="ol-vsmark"><span>V</span><span>S</span></div>
        {card(right,1,false)}
      </div>
      <div className="ol-go-row">
        {canGo&&me?.armed?<div className="ol-go-wait armed">✓ 你准备好了 · 等 {other.nickname} 点「准备好了」<span className="ol-ell"><i>.</i><i>.</i><i>.</i></span></div>
          :canGo?<button className="btn primary big ol-go" onClick={onGo}>⚡ 准备好了！（5 局 3 胜）</button>
          :<div className="ol-go-wait">{other?`等 ${other.nickname} 重新连上…`:'朋友进来后就能开战'}</div>}
      </div>
    </div>
  );
}

// ================= After my launch: waiting for the other kid =================
function WaitOpp({me,other,myBey,offline,pull,autoFired}){
  return (
    <div className="ol-waitopp">
      <div className="ol-wo-lines"/>
      <div className="ol-wo-mine">
        <BeyArt bey={myBey} size={150}/>
        <div className="ol-wo-stamp">{autoFired?'时间到，自动发射！':'已锁定！'}</div>
      </div>
      <div className="ol-wo-center">
        <div className="ol-wo-spin"><BeyArt bey={other?.bey||myBey} size={190}/></div>
        <div className="ol-wo-text">{offline?<>📡 {other?.nickname} 掉线了<br/><small>等待重连…</small></>:<>{other?.nickname||'对手'} 正在发射<span className="ol-ell"><i>.</i><i>.</i><i>.</i></span></>}</div>
        {!offline&&other&&!other.ready&&<OppPull other={other} pull={pull}/>}
        <div className="ol-wo-sub">两边都发射好，比赛就会同时开始</div>
      </div>
    </div>
  );
}

// ================= Synced countdown (VS splash on round 1, then 3·2·1) =================
function Countdown({at,now,first,me,other,myBey}){
  const left=Math.ceil((at-now)/1000);
  const prev=useRef(null);
  useEffect(()=>{if(left!==prev.current&&left<=3&&left>0)sfx.beep(left===1);prev.current=left;},[left]);
  return (
    <div className="ol-count">
      {first&&other?<div className="ol-count-vs"><VsSplash me={me} opp={{name:other.nickname,bey:other.bey||myBey,color:other.bey?.colors?.primary||'#f2b632',avatar:avatarOf(other.bey?.owner?.avatar)}} myBey={myBey} onPick={()=>{}}/></div>
        :<div className="ol-count-bg"/>}
      {left<=3&&left>0&&<div className="ol-count-n" key={left}>{left}</div>}
      <div className="ol-count-t">两边同时开始 · 准备拉发射器！</div>
    </div>
  );
}
// Shared 10 s launch window + the other kid's live pull.
function LaunchHud({goInfo,now,other,pull}){
  if(!goInfo.deadline)return other?.ready?<div className="ol-oppready">✓ {other.nickname} 已经发射好了！</div>:null;
  const left=Math.max(0,Math.ceil((goInfo.deadline-now)/1000));
  return <div className="ol-lhud">
    <div className={`ol-timer ${left<=3?'hot':''}`}>⏱ <b>{left}</b> 秒</div>
    {other&&(other.ready?<div className="ol-oppull done">✓ {other.nickname} 已发射</div>:<OppPull other={other} pull={pull}/>)}
  </div>;
}
function OppPull({other,pull}){
  return <div className="ol-oppull"><span>{other.nickname} 正在拉… {Math.round(pull*100)}%</span><i><em style={{width:`${Math.round(pull*100)}%`}}/></i></div>;
}

// ================= Round banner =================
function RoundBanner({final,slot,room,round,onNext,armed,other}){
  const won=final&&final.winner===slot;
  useEffect(()=>{if(final)sfx.clang(1);},[final]);
  if(!final)return <div className="ol-banner wait"><div className="ol-wo-text">等对手的比赛结果<span className="ol-ell"><i>.</i><i>.</i><i>.</i></span></div></div>;
  const score=final.score||room?.score||[0,0], target=room?.target||3;
  const pips=i=><div className="ol-pips">{Array.from({length:target},(_,k)=><i key={k} className={k<score[i]?'on':''}/>)}</div>;
  const name=i=>room?.players?.[i]?.nickname||'';
  return (
    <div className={`ol-banner ${won?'win':'lose'}`}>
      <div className="ol-banner-ribbon">
        <div className="ol-banner-k">第 {final.round||round} 局</div>
        <div className="ol-banner-h">{won?'你赢了这局！':`${name(final.winner)} 赢了这局`}</div>
        <div className="ol-banner-f">{FINISH_LABEL[final.reason]} · {FINISH_ZH[final.reason]}</div>
      </div>
      <div className="ol-score">
        <div className={`ol-score-side ${slot===0?'me':''}`}><b>{name(0)}</b>{pips(0)}</div>
        <div className="ol-score-num">{score[0]}<span>:</span>{score[1]}</div>
        <div className={`ol-score-side ${slot===1?'me':''}`}><b>{name(1)}</b>{pips(1)}</div>
      </div>
      <div className="ol-banner-t">{target*2-1} 局 {target} 胜{final.matchOver?' · 比赛结束！':''}</div>
      {final.matchOver?<button className="btn primary big ol-next" onClick={onNext}>看冠军 ▶</button>
        :armed?<div className="ol-next-wait">✓ 你准备好了 · {other?.armed?'马上开始！':`等 ${other?.nickname||'对手'} 准备…`}</div>
        :<button className="btn primary big ol-next" onClick={onNext}>下一局 · 准备好了！</button>}
      {!final.matchOver&&other&&<div className={`ol-next-opp ${other.armed?'on':''}`}>{other.armed?`✓ ${other.nickname} 已经准备好了`:`${other.nickname} 还在看结果…`}</div>}
      {final.mismatch&&<div className="ol-mismatch">两台设备算出的结果有一点点不同，这局按房主的结果算</div>}
    </div>
  );
}

// ================= Champion =================
function Champion({room,slot,leave,onRematch}){
  const champ=room?.champion, won=champ===slot;
  const p=room?.players?.[champ], loser=room?.players?.find(x=>x.slot!==champ);
  useEffect(()=>{sfx.fanfare(won);sfx.say(won?'Victory!':'Good game!','en-US',1.1);},[]);// eslint-disable-line
  const opponentAsked=room?.status==='waiting';
  return (
    <div className={`ol-champ ${won?'win':'lose'}`}>
      <div className="ol-champ-burst"/>
      <div className="ol-champ-lines"/>
      <div className="ol-champ-h">{won?'VICTORY!':'GOOD GAME!'}</div>
      <div className="ol-champ-sub">{won?'你是冠军！':`${p?.nickname||'对手'} 拿下了冠军，下次再来！`}</div>
      <div className="ol-champ-row">
        <div className="ol-champ-p winner">
          <div className="ol-crown">👑</div>
          <Avatar avatar={avatarOf(p?.bey?.owner?.avatar)} bey={p?.bey} size={150}/>
          <b>{p?.nickname}</b>
          <div className="ol-champ-bey">{p?.bey&&<BeyArt bey={p.bey} size={110}/>}<span>{p?.bey?beyTitle(p.bey):''}</span></div>
        </div>
        <div className="ol-champ-score">{room?.score?.[champ]??0}<span>:</span>{room?.score?.[loser?.slot??(1-champ)]??0}</div>
        <div className="ol-champ-p">
          <Avatar avatar={avatarOf(loser?.bey?.owner?.avatar)} bey={loser?.bey} size={110}/>
          <b>{loser?.nickname}</b>
          <div className="ol-champ-bey">{loser?.bey&&<BeyArt bey={loser.bey} size={80}/>}<span>{loser?.bey?beyTitle(loser.bey):''}</span></div>
        </div>
      </div>
      {opponentAsked&&<div className="ol-ask">🔥 对手想再来一场！</div>}
      <div className="ol-champ-btns">
        <button className="btn primary big" onClick={onRematch}>{opponentAsked?'好！再来一场':'🔁 再来一场'}</button>
        <button className="btn big" onClick={leave}>返回</button>
      </div>
    </div>
  );
}
