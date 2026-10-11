// Dev-only harness: /src/flipbook/sandbox.html?card=ph-friction-area
import {createRoot} from 'react-dom/client';
import '../styles/theme.css';
import {FlipbookHost} from './Flipbook.jsx';
import {openFlipbook} from './store.js';
const card = new URLSearchParams(location.search).get('card') || 'ph-friction-area';
function App() {
  return <div className="page"><button className="btn primary big" onClick={()=>openFlipbook({cardId:card})}>📖 翻开绘本</button><FlipbookHost onUnlock={ids=>console.log('unlock', ids)}/></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
openFlipbook({cardId:card});
