import {useState} from 'react';
import {useGame} from '../game/store.js';
import {BEYS} from '../game/beys.js';
import {BLADERS,FINISH_LABEL,FINISH_ZH} from '../game/story.js';
import BeyArt from './BeyArt.jsx';
import {TopBar,TypeBadge} from './common.jsx';
import './battle.css';
import OnlineRoom from './online/OnlineRoom.jsx';

export default function VersusScreen(){
  const {save,go,params}=useGame();
  const invite=params?.room||null; // from an invite link (?room=CODE)
  const pool=save.collection.length?save.collection:Object.values(BEYS).slice(0,3).map(b=>({...b,uid:b.id}));
  const [mine,setMine]=useState(pool[0]?.uid);
  const [oppId,setOppId]=useState('titan');
  const [mode,setMode]=useState(invite?'online':null); // null | online
  const myBey=pool.find(b=>b.uid===mine)||pool[0];
  const opponents=[...Object.values(BEYS).map(b=>({id:b.id,label:b.name,bey:b})),...BLADERS.filter(b=>save.defeated.includes(b.id)).map(b=>({id:'bl-'+b.id,label:`${b.name} 的 ${b.bey.name}`,bey:b.bey}))];
  const opp=opponents.find(o=>o.id===oppId)||opponents[0];
  const startCpu=()=>{
    if(!save.collection.length)useGame.getState().addBey(myBey,'starter');
    const uid=save.collection.length?myBey.uid:useGame.getState().save.collection[0].uid;
    go('battle',{beyUid:uid,oppBey:opp.bey});
  };
  if(mode==='online')return <OnlineRoom myBey={myBey} initialCode={invite} onExit={()=>{setMode(null);if(invite)go('versus',{});}}/>;
  return (
    <div className="page vs-page">
      <TopBar title="对战模式" back="title"/>
      <div className="vs-grid">
        <div className="panel vs-cpu">
          <div className="vs-h"><h2 className="h-display">VS CPU</h2><span>任选一只陀螺，对手任你挑 · 适合做「只改一个变量」的实验</span></div>
          <div className="prep-h">我方</div>
          <div className="vs-tiles">{pool.map(b=><button key={b.uid} className={`vs-tile ${b.uid===mine?'on':''}`} style={{'--c':b.colors?.primary}} onClick={()=>setMine(b.uid)}><BeyArt bey={b} size={64}/><b>{b.name}</b><TypeBadge type={b.type||b.blade?.style}/></button>)}</div>
          <div className="prep-h">对手</div>
          <div className="vs-tiles opp">{opponents.map(o=><button key={o.id} className={`vs-tile ${oppId===o.id?'on':''}`} style={{'--c':o.bey.colors?.primary}} onClick={()=>setOppId(o.id)}><BeyArt bey={o.bey} size={48}/><b>{o.label}</b></button>)}</div>
          <div className="vs-go-row"><span className="vs-match"><b>{myBey?.name}</b> VS <b>{opp.label}</b></span><button className="btn primary big" onClick={startCpu}>开打 ▶</button></div>
        </div>
        <div className="panel ink vs-online">
          <h2 className="h-display h-yellow">VS 朋友（联机）</h2>
          <p>创建房间，把房间码告诉朋友。双方准备好后，服务器发同一个随机种子，两边各自算同一份确定性物理，再由服务器核对结果。</p>
          <p className="model-note" style={{color:'#bbb'}}>只能用房间码邀请，没有陌生人匹配和私信。</p>
          <button className="btn yellow big" onClick={()=>setMode('online')}>进入联机大厅</button>
        </div>
      </div>
    </div>
  );
}
