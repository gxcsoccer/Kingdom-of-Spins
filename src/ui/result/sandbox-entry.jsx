// Dev-only harness for the paged result screen: /src/ui/result/sandbox.html?win=1
import {createRoot} from 'react-dom/client';
import '../../styles/theme.css';
import '../battle.css';
import ResultPanel from './ResultPanel.jsx';
import {FlipbookHost} from '../../flipbook/Flipbook.jsx';
import {useGame} from '../../game/store.js';
import {BEYS} from '../../game/beys.js';
import {BLADERS} from '../../game/story.js';
import round from './sample-round.json';
const win = new URLSearchParams(location.search).get('win')==='1';
const blader = BLADERS.find(b=>b.tier==='pro') || BLADERS[0];
const myBey = {...BEYS.dragoon, uid:'u1'};
const save = {...useGame.getState().save, collection:[myBey,{...BEYS.fish,uid:'u2'}], team:[], defeated:[], coins:100};
const log = (...a)=>console.log(...a);
createRoot(document.getElementById('root')).render(<>
  <ResultPanel won={win} score={win?[4,2]:[2,4]} rounds={[{...round, beyName:myBey.name}]} opp={{name:blader.name, bey:blader.bey, blader}} blader={blader} myBey={myBey}
    prediction={win?'spin':'ko'} save={save} go={(...a)=>log('go',a)} recordMatch={a=>log('recordMatch',a)} unlockCards={a=>log('unlock',a)} recruit={(...a)=>log('recruit',a)} myName="测试" addCoins={n=>log('coins',n)}/>
  <FlipbookHost onUnlock={a=>log('flip unlock',a)}/>
</>);
