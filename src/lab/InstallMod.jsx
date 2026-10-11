import {lazy,Suspense,useMemo,useState} from 'react';
import {useGame,bladerById} from '../game/store.js';
import {VARIABLES,makeVariant} from '../game/experiment.js';
import {beyTitle} from '../ui/beyName.js';
import BeyArt from '../ui/BeyArt.jsx';
import './installmod.css';
const BeyShowcase=lazy(()=>import('../scene/BeyShowcase.jsx'));

// What changed, in kid words. Parts (Bit / Ratchet) are swapped; Blade parameters are reworked in the workshop.
export function modText(change){
  const {key,label,fromLabel,toLabel}=change;
  if(key==='bit')return `换上了 ${toLabel}`;
  if(key==='height')return `换上了 Ratchet ${toLabel}`;
  const strip=s=>String(s).replace(/^外圈\s*/,'');
  if(key==='ring')return `在工坊里改造了 Blade：外圈 ${strip(fromLabel)} → ${strip(toLabel)}`;
  return `在工坊里改造了 Blade：${label} ${fromLabel} → ${toLabel}`;
}

/** 结论区的「装上这个改装 → 带改装版再战」. props: change {key,from,to,label,fromLabel,toLabel}, mine, verdict */
export default function InstallMod({change,mine,verdict}){
  const {save,params,addBey,go}=useGame();
  const [show,setShow]=useState(null);           // the freshly built bey (celebration overlay)
  const key=change?.key;
  const opp=params?.bladerId?bladerById(params.bladerId):null;
  const oppName=opp?.name||'对手';
  const installed=useMemo(()=>save.collection.find(b=>b.origin==='lab'&&b.modOf===mine?.uid&&b.mods?.[0]?.key===key&&b.mods?.[0]?.to===change?.to),[save.collection,mine?.uid,key,change?.to]);
  if(!change||!mine)return null;
  if(VARIABLES[key]?.launch)return <div className="im-row"><div className="im-tip">🚀 下次发射拉满到约 <b>{Number(change.to).toLocaleString()}</b> 转试试！</div></div>;
  const install=()=>{
    if(installed){setShow(installed);return;}
    const b=makeVariant(mine,key,change.to);
    delete b.uid;
    b.zh=`${beyTitle(mine)}·改`.slice(0,10);
    b.mods=[{key,from:change.fromLabel,to:change.to,toLabel:change.toLabel,label:change.label,text:modText(change)}];
    b.modOf=mine.uid;
    const added=addBey(b,'lab');
    setShow(added||b);
  };
  const rematch=b=>go('battle',{bladerId:params?.bladerId||undefined,oppBey:params?.oppBey,regionId:params?.regionId,beyUid:b.uid,from:'lab'});
  const weaker=verdict==='A更好';
  return (
    <>
      <div className="im-row">
        {installed
          ?<><span className="im-done" title={beyTitle(installed)}>✅ 已装上</span><button className="lx-big go im-go" onClick={()=>rematch(installed)}>⚔️ 带改装版再战 {oppName}</button></>
          :<><button className="lx-big go im-install" onClick={install}>🔧 {weaker?'还是装上试试？':'装上这个改装'}</button>
            <span className="im-note">{weaker?'实验说原版更强哦——你可以去实战再验证！':modText(change)}</span></>}
      </div>
      {show&&<div className="im-ov" onClick={()=>setShow(null)}>
        <div className="im-card" onClick={e=>e.stopPropagation()}>
          <div className="im-flash"/>
          <div className="im-stamp">改装完成！</div>
          <div className="im-3d"><Suspense fallback={<BeyArt bey={show} size={200} spin/>}><BeyShowcase bey={show} rpm={3200} tilt={.4} zoom={1.2} background={false} standalone/></Suspense></div>
          <div className="im-name">{beyTitle(show)}<small>{show.name}</small></div>
          <div className="im-mod">🔧 {show.mods?.[0]?.text}</div>
          {weaker&&<div className="im-warn">实验里原版更强——实战会不会不一样？去试试！</div>}
          <div className="im-acts">
            <button className="lx-big go" onClick={()=>rematch(show)}>⚔️ 带改装版再战 {oppName}</button>
            <button className="lx-big" onClick={()=>setShow(null)}>继续看结论</button>
          </div>
          <div className="im-hint">已经放进收藏啦（标签：改装）</div>
        </div>
      </div>}
    </>
  );
}
