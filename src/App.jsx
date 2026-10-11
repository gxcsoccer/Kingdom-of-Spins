import {lazy,Suspense} from 'react';
import {useGame} from './game/store.js';
import TitleScreen from './ui/TitleScreen.jsx';
import StarterScreen from './ui/StarterScreen.jsx';
import MapScreen from './ui/MapScreen.jsx';
import ShopScreen from './ui/ShopScreen.jsx';
import CollectionScreen from './ui/CollectionScreen.jsx';

const BattleScreen=lazy(()=>import('./ui/BattleScreen.jsx'));
const FusionScreen=lazy(()=>import('./ui/FusionScreen.jsx'));
const VersusScreen=lazy(()=>import('./ui/VersusScreen.jsx'));
const CodexScreen=lazy(()=>import('./ui/CodexScreen.jsx'));
const ArtCheck=lazy(()=>import('./ui/ArtCheck.jsx'));
const ShowcaseCanvas=lazy(()=>import('./scene/BeyShowcase.jsx').then(m=>({default:m.ShowcaseCanvas})));

const SCREENS={title:TitleScreen,starter:StarterScreen,map:MapScreen,shop:ShopScreen,collection:CollectionScreen,battle:BattleScreen,fusion:FusionScreen,versus:VersusScreen,codex:CodexScreen};

export default function App(){
  const screen=useGame(s=>s.screen), nonce=useGame(s=>s.nonce);
  if(new URLSearchParams(location.search).has('art'))return <Suspense fallback={<Loading/>}><ArtCheck/></Suspense>;
  const Screen=SCREENS[screen]||TitleScreen;
  return <>
    <Suspense fallback={<Loading/>}><Screen key={screen+(nonce||0)}/></Suspense>
    <Suspense fallback={null}><ShowcaseCanvas/></Suspense>
  </>;
}
export function Loading({text='LOADING…'}){
  return <div className="page" style={{display:'grid',placeItems:'center',minHeight:'100vh'}}><div className="h-display h-outline" style={{fontSize:48}}>{text}</div></div>;
}
