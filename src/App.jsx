import {lazy,Suspense,Component,useEffect} from 'react';
import {useGame} from './game/store.js';
import {pathToScreen} from './game/router.js';
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
const ExploreScreen=lazy(()=>import('./explore/ExploreScreen.jsx'));
const FlipbookHost=lazy(()=>import('./flipbook/Flipbook.jsx').then(m=>({default:m.FlipbookHost})));
const ShowcaseCanvas=lazy(()=>import('./scene/BeyShowcase.jsx').then(m=>({default:m.ShowcaseCanvas})));

const SCREENS={title:TitleScreen,starter:StarterScreen,map:MapScreen,shop:ShopScreen,collection:CollectionScreen,battle:BattleScreen,fusion:FusionScreen,versus:VersusScreen,codex:CodexScreen,explore:ExploreScreen};

if(typeof window!=='undefined')window.addEventListener('popstate',e=>{const st=e.state||pathToScreen();useGame.getState().go(st.screen,st.params||{},{fromHistory:true});});

// After a deploy, old lazy chunks disappear; reload once instead of showing a blank screen.
class ChunkBoundary extends Component{
  constructor(p){super(p);this.state={err:null};}
  static getDerivedStateFromError(err){return {err};}
  componentDidCatch(err){
    const chunk=/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(String(err?.message||err));
    const k='kos.reloaded';if(chunk&&!sessionStorage.getItem(k)){sessionStorage.setItem(k,'1');location.reload();}
  }
  render(){
    if(!this.state.err){try{sessionStorage.removeItem('kos.reloaded');}catch{}return this.props.children;}
    return <div className="page" style={{display:'grid',placeItems:'center',minHeight:'100vh'}}><div className="panel" style={{padding:24,textAlign:'center'}}>
      <div className="h-display" style={{fontSize:28}}>哎呀，画面卡住了</div><p style={{fontWeight:700}}>游戏刚刚更新过，点一下重新载入就好～</p>
      <button className="btn primary" onClick={()=>location.reload()}>重新载入</button></div></div>;
  }
}

let inviteUsed=false;
export default function App(){
  const screen=useGame(s=>s.screen), nonce=useGame(s=>s.nonce);
  if(new URLSearchParams(location.search).has('art'))return <Suspense fallback={<Loading/>}><ArtCheck/></Suspense>;
  const activeKid=useGame(s=>s.activeKid);
  // Gate: every screen except the title requires a signed-in parent + chosen kid profile.
  const Screen=activeKid?(SCREENS[screen]||TitleScreen):TitleScreen;
  // Invite link (?room=CODE): once a kid profile is chosen, go straight into that online room.
  useEffect(()=>{
    const code=new URLSearchParams(location.search).get('room');
    if(!activeKid||!code||inviteUsed)return;
    inviteUsed=true;useGame.getState().go('versus',{room:code.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5)});
  },[activeKid]);
  return <>
    <ChunkBoundary key={screen+(nonce||0)}><Suspense fallback={<Loading/>}><Screen/></Suspense></ChunkBoundary>
    <Suspense fallback={null}><ShowcaseCanvas/></Suspense>
    <Suspense fallback={null}><FlipbookHost onUnlock={ids=>useGame.getState().unlockCards(ids)}/></Suspense>
  </>;
}
export function Loading({text='LOADING…'}){
  return <div className="page" style={{display:'grid',placeItems:'center',minHeight:'100vh'}}><div className="h-display h-outline" style={{fontSize:48}}>{text}</div></div>;
}
