// Dev-only E2E fixture: separate save slot, no account or cloud writes. Not a production entry.
import {createRoot} from 'react-dom/client';
import '../styles/theme.css';
import App from '../App.jsx';
import {useGame} from '../game/store.js';
import {makeDemoSave} from '../game/demoSave.js';
import {freshSave} from '../game/store.js';
if (!import.meta.env.DEV) throw new Error('Development fixture only');
const query = new URLSearchParams(location.search);
const key = 'kos-e2e-save';
const profile = {id:'e2e', nickname:'Alex the Explorer', avatar:'1'};
const initial = query.has('starter') ? {...freshSave(), profile} : makeDemoSave({profile});
let save;
try { save = JSON.parse(localStorage.getItem(key)); } catch {}
useGame.setState({saveKey:key, save:query.has('reset') || !save ? initial : save, activeKid:profile, onChange:null, screen:query.get('screen') || (query.has('starter') ? 'starter' : 'map'), params:{}});
// Keep this fixture's entry URL when navigating or reloading to switch language.
const go=useGame.getState().go;
useGame.setState({go(screen,params={},opts={}) {
  go(screen,params,{...opts,fromHistory:true});
  const q = new URLSearchParams({screen});
  history.replaceState({screen,params},'',location.pathname+'?'+q);
}});
createRoot(document.getElementById('root')).render(<App/>);
