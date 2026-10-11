// Dev-only harness: /src/flipbook/sandbox.html?chapter=inertia  (or ?card=ph-friction-area, or ?free=1&card=…)
import {createRoot} from 'react-dom/client';
import '../styles/theme.css';
import '../ui/result/result.css';
import {FlipbookHost} from './Flipbook.jsx';
import {openFlipbook} from './store.js';
import {CHAPTERS} from './chapters.js';
const q = new URLSearchParams(location.search);
const start = {chapter:q.get('chapter')||undefined, cardId:q.get('card')||undefined, free:q.has('free')||undefined};
function App() {
  return <div className="page"><div className="row wrap" style={{gap:8}}>{CHAPTERS.map(c=><button key={c.id} className="btn" onClick={()=>openFlipbook({chapter:c.id})}>📖 {c.title}</button>)}</div><FlipbookHost onUnlock={ids=>console.log('unlock', ids)}/></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
openFlipbook(start.chapter||start.cardId ? start : {chapter:'inertia'});
