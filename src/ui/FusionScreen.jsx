import {useGame} from '../game/store.js';
import {BLADERS} from '../game/story.js';
import FusionLab from '../fusion/FusionLab.jsx';
import {TopBar} from './common.jsx';

export default function FusionScreen(){
  const {save,addBey,unlockCards,go,params}=useGame();
  const opponents=BLADERS.filter(b=>b.tier==='normal'||save.defeated.includes(b.id)||save.demo).map(b=>({id:b.id,name:b.name,bey:b.bey}));
  return (
    <div className="page">
      <TopBar title="AI 融合工坊"/>
      <FusionLab collection={save.collection} opponents={opponents}
        onUnlock={ids=>unlockCards(ids)}
        onSave={bey=>{const added=addBey(bey,'fusion');unlockCards((bey.knowledge||[]).map(k=>k.id||k));go('collection',{highlight:added?.uid});}}
        onClose={()=>go(params.back||'map')}/>
    </div>
  );
}
