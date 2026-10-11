// Dev-only harness: /src/explore/sandbox.html?region=harbor  (add &reset to start a fresh save)
import {createRoot} from 'react-dom/client';
import '../styles/theme.css';
import ExploreScreen from './ExploreScreen.jsx';
import {useGame} from '../game/store.js';
import {BEYS} from '../game/beys.js';
const q = new URLSearchParams(location.search);
const st = useGame.getState();
if (q.has('reset') || !st.save.collection?.length) st.update(s=>{ s.collection=[{...BEYS.dragoon, uid:'u1'}]; s.explore={}; });
useGame.setState({activeKid:{id:'t',nickname:'测试'}, screen:'explore', params:{regionId:q.get('region')||'harbor'}});
function App(){ const screen=useGame(s=>s.screen), params=useGame(s=>s.params); return screen==='explore' ? <ExploreScreen key={JSON.stringify(params)}/> : <div className="page"><h2>go → {screen}</h2><pre>{JSON.stringify(params)}</pre><button className="btn" onClick={()=>useGame.getState().go('explore',{regionId:params.regionId||'harbor'})}>回到探索</button></div>; }
createRoot(document.getElementById('root')).render(<App/>);
