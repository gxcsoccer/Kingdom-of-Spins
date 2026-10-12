import {tr} from '../i18n/index.js';
import {useGame} from '../game/store.js';
import Codex from '../knowledge/Codex.jsx';
import {TopBar} from './common.jsx';

export default function CodexScreen(){
  const {save,go}=useGame();
  return (
    <div className="page codex-page">
      <TopBar title={tr("知识图鉴")}/>
      <Codex unlocked={save.cards} onClose={()=>go('map')}/>
    </div>
  );
}
