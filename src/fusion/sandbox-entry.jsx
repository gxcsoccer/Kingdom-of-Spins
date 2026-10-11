// Dev-only harness: http://127.0.0.1:5173/src/fusion/sandbox.html
import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import '../styles/theme.css';
import FusionLab from './FusionLab.jsx';
import Codex from '../knowledge/Codex.jsx';
import {BEYS} from '../game/beys.js';

function App() {
  const [col, setCol] = useState(Object.values(BEYS).slice(0,5));
  const [cards, setCards] = useState([]);
  const [codex, setCodex] = useState(location.hash==='#codex');
  if (codex) return <div className="page"><Codex unlocked={cards.length?cards:['bx-three-parts','ph-inertia','gd-ideal-model']} newIds={['ph-inertia']} onClose={()=>setCodex(false)}/></div>;
  return <FusionLab collection={col} onUnlock={ids=>setCards(c=>[...new Set([...c,...ids])])} onSave={b=>{console.log('saved',b);setCol(c=>[...c,b]);setCodex(true);}} onClose={()=>setCodex(true)}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
