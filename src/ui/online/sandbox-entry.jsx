// Dev-only harness, no login: /src/ui/online/sandbox.html?as=A   (second player in another tab: ?as=B; invite: &room=CODE)
// Each `as` gets its own fake kid profile, bey and seat memory, so two tabs on one machine are two players.
import {createRoot} from 'react-dom/client';
import '../../styles/theme.css';
import {useGame} from '../../game/store.js';
import {BEYS} from '../../game/beys.js';
import OnlineRoom from './OnlineRoom.jsx';
const q=new URLSearchParams(location.search);
const as=(q.get('as')||'A').toUpperCase();
const KIDS={A:{nickname:'小明',avatar:'1',bey:'dragoon'},B:{nickname:'乐乐',avatar:'3',bey:'titan'}};
const kid=KIDS[as]||KIDS.A;
const bey={...(BEYS[kid.bey]||Object.values(BEYS)[0]),uid:'u-'+as};
useGame.setState({activeKid:{id:'t'+as,nickname:kid.nickname},screen:'versus',params:{}});
useGame.getState().update(s=>{s.profile={...s.profile,nickname:kid.nickname,avatar:kid.avatar};});
function App(){
  return <OnlineRoom myBey={bey} ns={'.'+as} initialCode={q.get('room')} onExit={()=>{location.href=location.pathname+'?as='+as;}}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
