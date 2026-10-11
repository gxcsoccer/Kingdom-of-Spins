// Dev-only harness, no login.
//   Online room:   /src/ui/online/sandbox.html?as=A   (second player in another tab: ?as=B; invite: &room=CODE)
//   Versus hub:    /src/ui/online/sandbox.html?hub&as=A  (对战模式 page → CPU battle → back, with a fake kid + collection)
// Each `as` gets its own fake kid profile, bey and seat memory, so two tabs on one machine are two players.
import {lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import '../../styles/theme.css';
import {useGame} from '../../game/store.js';
import {BEYS} from '../../game/beys.js';
import OnlineRoom from './OnlineRoom.jsx';
const VersusScreen=lazy(()=>import('../VersusScreen.jsx'));
const BattleScreen=lazy(()=>import('../BattleScreen.jsx'));
const q=new URLSearchParams(location.search);
const as=(q.get('as')||'A').toUpperCase();
const KIDS={A:{nickname:'小明',avatar:'1',bey:'dragoon'},B:{nickname:'乐乐',avatar:'3',bey:'titan'}};
const kid=KIDS[as]||KIDS.A;
const bey={...(BEYS[kid.bey]||Object.values(BEYS)[0]),uid:'u-'+as};
useGame.setState({activeKid:{id:'t'+as,nickname:kid.nickname},screen:'versus',params:{}});
useGame.getState().update(s=>{s.profile={...s.profile,nickname:kid.nickname,avatar:kid.avatar};
  if(q.has('hub')&&!s.collection?.length){s.collection=['dragoon','fish','ninjamight'].map((id,i)=>({...BEYS[id],uid:'h'+i,origin:'starter'}));s.defeated=['ran','tetsu','hop','raiga'];}
  if(q.has('demo'))s.demo=true;});
function Hub(){
  const screen=useGame(s=>s.screen), nonce=useGame(s=>s.nonce);
  const S=screen==='battle'?BattleScreen:screen==='versus'?VersusScreen:null;
  if(!S)return <div className="page"><h2>go → {screen}</h2><button className="btn" onClick={()=>useGame.getState().go('versus')}>回到对战模式</button></div>;
  return <Suspense fallback={null}><S key={screen+(nonce||0)}/></Suspense>;
}
function App(){
  if(q.has('hub'))return <Hub/>;
  return <OnlineRoom myBey={bey} ns={'.'+as} initialCode={q.get('room')} onExit={()=>{location.href=location.pathname+'?as='+as;}}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
