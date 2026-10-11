import {createRoot} from 'react-dom/client';
import './styles/theme.css';
import App from './App.jsx';
import {getWorker} from './game/battlePlayer.js';

getWorker(); // start loading MuJoCo WASM early
createRoot(document.getElementById('root')).render(<App/>);
