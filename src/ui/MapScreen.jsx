import {useGame,bladerById} from '../game/store.js';
import {BLADERS,TIERS,tierUnlocked} from '../game/story.js';
import {TopBar,Portrait,TypeBadge,Modal} from './common.jsx';
import BeyArt from './BeyArt.jsx';
import {useState} from 'react';

function hint(save){
  if(!save.defeated.length)return '先去挑战普通对手吧！打赢能赚金币。';
  if(save.collection.length<3){
    if(save.coins>=100)return `你有 ${save.coins} 金币，可以去商店开盲盒；或者来融合工坊，让我帮你设计一只新陀螺！`;
    return `再有 ${3-save.collection.length} 只陀螺就能挑战职业对手！试试融合工坊？`;
  }
  if(save.team.length<3)return '打败职业对手，就能邀请他们加入你的队伍！';
  if(!tierUnlocked('boss',save))return '超级职业已经解锁，他们可不好对付……先预测再出手！';
  return '龙王在等你。准备好你最强的陀螺吧！';
}

export default function MapScreen(){
  const {save,go,setDemo}=useGame();
  const [info,setInfo]=useState(null);
  return (
    <div className="page">
      <TopBar title="冒险地图" back="title" right={<>
        <span className="chip">陀螺 {save.collection.length}/3</span>
        <span className="chip">队员 {save.team.length}/3</span>
      </>}/>
      <div style={{display:'flex',gap:24,flexWrap:'wrap',alignItems:'flex-start'}}>
        <div className="col grow" style={{flex:'999 1 640px',gap:22,minWidth:0}}>
          {Object.entries(TIERS).map(([tier,meta])=>{
            const open=save.demo||tierUnlocked(tier,save);
            const list=BLADERS.filter(b=>b.tier===tier);
            return (
              <section key={tier} className={`panel ${tier==='boss'?'ink':''}`} style={{padding:18,opacity:open?1:.75,background:open?undefined:'var(--tone),#ddd'}}>
                <div className="row between">
                  <h2 className="panel-title" style={{fontSize:24,color:tier==='boss'?'var(--red)':undefined}}>{open?'':'🔒 '}{meta.label}</h2>
                  {!open&&<span className="muted" style={{fontWeight:800}}>{meta.req}</span>}
                </div>
                <div className="grid mt" style={{gridTemplateColumns:`repeat(auto-fill,minmax(${tier==='boss'?320:200}px,1fr))`,gap:14}}>
                  {list.map(b=>{
                    const beat=save.defeated.includes(b.id), recruited=save.team.some(t=>t.bladerId===b.id);
                    return (
                      <button key={b.id} disabled={!open} onClick={()=>setInfo(b)} className="panel" style={{padding:0,textAlign:'left',boxShadow:'var(--shadow-sm)',background:'#fff',color:'var(--ink)',overflow:'hidden'}}>
                        <div style={{display:'flex',gap:10,alignItems:'stretch'}}>
                          <div style={{borderRight:'var(--border)',background:b.color+'33'}}><Portrait blader={b} size={92}/></div>
                          <div style={{padding:'10px 10px 10px 0',flex:1}}>
                            <div className="panel-title" style={{fontSize:20}}>{b.name} {beat&&'✓'}</div>
                            <div style={{fontSize:12,fontWeight:800}}>{b.bey.name}</div>
                            <div className="mt" style={{marginTop:6}}><TypeBadge type={b.bey.type}/></div>
                            {recruited&&<div className="badge" style={{marginTop:6,background:'var(--teal)'}}>已入队</div>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <aside className="col" style={{flex:'1 1 280px',gap:14}}>
          <button className="panel ink" onClick={()=>go('fusion')} style={{padding:18,textAlign:'left',boxShadow:'6px 6px 0 var(--red)',color:'#fff'}}>
            <div className="h-display h-yellow" style={{fontSize:28}}>AI 融合工坊</div>
            <div style={{marginTop:6,fontWeight:700}}>和融合博士一起设计新陀螺 →</div>
          </button>
          <button className="btn" onClick={()=>go('shop')} style={{justifyContent:'space-between'}}>商店 · 盲盒 <span>🎁</span></button>
          <button className="btn" onClick={()=>go('collection')} style={{justifyContent:'space-between'}}>我的陀螺 / 队伍 <span>{save.collection.length}</span></button>
          <button className="btn" onClick={()=>go('codex')} style={{justifyContent:'space-between'}}>知识图鉴 <span>{save.cards.length}</span></button>
          <button className="btn" onClick={()=>go('versus')} style={{justifyContent:'space-between'}}>对战模式 <span>⚔</span></button>
          <div className="row" style={{alignItems:'flex-end',gap:10,marginTop:8}}>
            <DoctorFace/>
            <div className="bubble grow" style={{fontSize:14}}>{hint(save)}</div>
          </div>
          {save.team.length>0&&<div className="panel" style={{padding:14}}>
            <div className="kicker">MY TEAM</div>
            <div className="row wrap mt" style={{gap:8}}>{save.team.map(t=>{const b=bladerById(t.bladerId);return b&&<div key={t.bladerId} style={{border:'var(--border)'}} title={b.name}><Portrait blader={b} size={56}/></div>;})}</div>
          </div>}
          <label className="model-note" style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer'}}><input type="checkbox" checked={!!save.demo} onChange={e=>setDemo(e.target.checked)}/> 演示模式：解锁全部对手</label>
        </aside>
      </div>
      {info&&<Modal onClose={()=>setInfo(null)}>
        <div className="row" style={{alignItems:'flex-start',gap:20,flexWrap:'wrap'}}>
          <div style={{border:'var(--border-thick)',background:info.color+'33'}}><Portrait blader={info} size={180}/></div>
          <div className="col grow">
            <div className="kicker">{TIERS[info.tier].label}</div>
            <h2 className="h-display" style={{fontSize:40}}>{info.name}</h2>
            <div className="bubble">「{info.line}」</div>
            <div className="row mt"><BeyArt bey={info.bey} size={90}/><div><div className="panel-title" style={{fontSize:20}}>{info.bey.name}</div><TypeBadge type={info.bey.type}/></div></div>
          </div>
        </div>
        <div className="row mt2" style={{justifyContent:'flex-end'}}>
          <button className="btn" onClick={()=>setInfo(null)}>再想想</button>
          <button className="btn primary big" onClick={()=>go('battle',{bladerId:info.id})}>挑战！</button>
        </div>
      </Modal>}
    </div>
  );
}

export function DoctorFace({mood='normal',size=72}){
  const [failed,setFailed]=useState(false);
  if(!failed)return <img src={`/art/doctor/${mood}.png`} width={size} height={size} alt="融合博士" style={{objectFit:'contain',flex:'none'}} onError={()=>setFailed(true)}/>;
  return <div style={{width:size,height:size,flex:'none',borderRadius:'50%',border:'var(--border)',background:'radial-gradient(circle at 35% 40%, #111 0 6%, transparent 7%), radial-gradient(circle at 65% 40%, #111 0 6%, transparent 7%), radial-gradient(ellipse at 50% 70%, #111 0 10%, transparent 11%), var(--yellow)',display:'grid',placeItems:'end center'}}><span style={{fontSize:10,fontWeight:900,background:'#fff',border:'2px solid #111',padding:'0 4px',marginBottom:-8}}>博士</span></div>;
}
