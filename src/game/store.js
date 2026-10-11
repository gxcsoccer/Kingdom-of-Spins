import {create} from 'zustand';
import {BEYS} from './beys.js';
import {BLADERS} from './story.js';
import {emptyExplore} from './regions.js';
import {screenToPath,pathToScreen} from './router.js';

const KEY='kos-save-v1';
export const BLIND_BOX_COST=100;
export const BLIND_BOX_POOL=[
  {id:'dragoon',weight:20},{id:'fish',weight:20},{id:'goatpuff',weight:20},{id:'ninjamight',weight:25},{id:'titan',weight:15},
];
export const freshSave=()=>({version:1,profile:null,coins:0,collection:[],team:[],defeated:[],wins:{},cards:[],predictions:[],battles:0,demo:false,explore:{}});

function loadLocal(key){try{const s=JSON.parse(localStorage.getItem(key));return s&&s.version===1?{...freshSave(),...s}:freshSave();}catch{return freshSave();}}
const uid=()=>Math.random().toString(36).slice(2,8);
const copyBey=(b,extra={})=>({...structuredClone(b),uid:uid(),...extra});

export const useGame=create((set,get)=>({
  saveKey:KEY,
  save:loadLocal(KEY),
  ...(typeof window!=='undefined'?pathToScreen():{screen:'title',params:{}}),
  go(screen,params={},opts={}){
    set(st=>({screen,params,nonce:(st.nonce||0)+1}));window.scrollTo?.(0,0);
    if(typeof window!=='undefined'&&!opts.fromHistory){const path=screenToPath(screen,params);
      if(path&&path!==location.pathname+location.search)history[opts.replace?'replaceState':'pushState']({screen,params},'',path);}
  },
  // Switch which save slot (kid profile) is active. Remote sync hooks in via onChange.
  useSlot(key,remote){const save=remote?{...freshSave(),...remote}:loadLocal(key);set({saveKey:key,save});},
  update(fn){
    const save=structuredClone(get().save);fn(save);
    set({save});
    try{localStorage.setItem(get().saveKey,JSON.stringify(save));}catch{}
    get().onChange?.(save);
  },
  onChange:null,
  setProfile(profile){get().update(s=>{s.profile={...s.profile,...profile};});},
  chooseStarter(id){get().update(s=>{if(!s.collection.length)s.collection.push(copyBey(BEYS[id],{origin:'starter'}));});},
  addBey(bey,origin='found'){let added;get().update(s=>{added=copyBey(bey,{origin});s.collection.push(added);});return added;},
  addCoins(n){get().update(s=>{s.coins=Math.max(0,s.coins+n);});},
  unlockCards(ids){get().update(s=>{for(const id of ids)if(id&&!s.cards.includes(id))s.cards.push(id);});},
  openBlindBox(rand=Math.random){
    const s=get().save;if(s.coins<BLIND_BOX_COST)return null;
    const owned=new Set(s.collection.map(b=>b.id));
    // Fair rule shown in shop: the first box always gives a bey you don't own yet.
    let pool=BLIND_BOX_POOL;
    if(s.battles<=3||!s.collection.some(b=>b.origin==='blindbox'))pool=pool.filter(p=>!owned.has(p.id))||pool;
    if(!pool.length)pool=BLIND_BOX_POOL;
    const total=pool.reduce((a,p)=>a+p.weight,0);let r=rand()*total,pick=pool[0];
    for(const p of pool){if((r-=p.weight)<0){pick=p;break;}}
    const dup=owned.has(pick.id);
    get().update(st=>{st.coins-=BLIND_BOX_COST;if(dup)st.coins+=40;else st.collection.push(copyBey(BEYS[pick.id],{origin:'blindbox'}));});
    return {bey:BEYS[pick.id],dup};
  },
  recordMatch({bladerId,won,coins,prediction}){
    get().update(s=>{
      s.battles++;
      if(won&&bladerId){s.wins[bladerId]=(s.wins[bladerId]||0)+1;if(!s.defeated.includes(bladerId))s.defeated.push(bladerId);}
      s.coins+=coins||0;
      if(prediction)s.predictions.push({...prediction,at:Date.now()});
    });
  },
  recruit(bladerId,beyUid){get().update(s=>{if(!s.team.some(t=>t.bladerId===bladerId))s.team.push({bladerId,beyUid});});},
  setDemo(on){get().update(s=>{s.demo=on;});},
  // Exploration progress per region (see regions.js). patch(e) mutates the region record.
  updateExplore(regionId,patch){get().update(s=>{s.explore=s.explore||{};const e=s.explore[regionId]||(s.explore[regionId]=emptyExplore());patch(e);});},
  findBey(regionId,beyId){let added=null;get().update(s=>{s.explore=s.explore||{};const e=s.explore[regionId]||(s.explore[regionId]=emptyExplore());
    if(!e.found.includes(beyId)){e.found.push(beyId);if(!s.collection.some(b=>b.id===beyId)&&BEYS[beyId]){added={...structuredClone(BEYS[beyId]),uid:Math.random().toString(36).slice(2,8),origin:'explore',foundIn:regionId};s.collection.push(added);}}});return added;},
  meetBlader(regionId,bladerId){get().update(s=>{s.explore=s.explore||{};const e=s.explore[regionId]||(s.explore[regionId]=emptyExplore());if(!e.met.includes(bladerId))e.met.push(bladerId);});},
  reset(){get().update(s=>{Object.assign(s,freshSave(),{profile:s.profile});});},
}));

export const bladerById=id=>BLADERS.find(b=>b.id===id);
