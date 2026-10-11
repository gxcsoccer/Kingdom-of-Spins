import {useState,createContext,useContext,lazy,Suspense} from 'react';

// Opt-in 3D: wrap a subtree in <BeyArt3D.Provider value={true}> and BeyArt renders the 3D
// BeyShowcase (shared canvas via <ShowcaseCanvas/> in App) instead of the 2D icon.
export const BeyArt3D=createContext(false);
const BeyShowcase=lazy(()=>import('../scene/BeyShowcase.jsx'));
import {specFromBey,wingOutline} from '../physics/model.js';
import {normLook,visualOutline} from '../scene/look.js';

// Top-view manga icon of a bey, generated from the same wing outline as the physics hull.
// Uses /art/beys/<id>.png if the user supplied one.
export function BeySvg({bey,size=160,spin=false}){
  const spec=specFromBey(bey), k=1/.032*46, c=bey.colors||{};
  const look=normLook(bey.look);
  const wings=Array.from({length:spec.wings},(_,i)=>(look?visualOutline(spec,i,look.shape):wingOutline(spec,i)).map(([x,y])=>`${(x*k).toFixed(2)},${(-y*k).toFixed(2)}`).join(' '));
  const initial=(bey.name||'?').replace(/[^A-Za-z]/g,'').slice(0,1)||'★';
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} style={spin?{animation:'spinslow 1.2s linear infinite'}:undefined} aria-label={bey.name}>
      <defs>
        <pattern id="tone" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".55" fill="rgba(0,0,0,.35)"/></pattern>
      </defs>
      <circle r="47" fill="none" stroke="#111" strokeWidth=".6" strokeDasharray="2 3" opacity=".35"/>
      {wings.map((pts,i)=>(<g key={i}>
        <polygon points={pts} fill={c.primary||'#888'} stroke="#111" strokeWidth="2.2" strokeLinejoin="round"/>
        <polygon points={pts} fill="url(#tone)" opacity=".55" style={{mixBlendMode:'multiply'}} transform="translate(1.5,1.5) scale(.92)"/>
      </g>))}
      <circle r={19.5} fill={c.secondary||'#eee'} stroke="#111" strokeWidth="2.2"/>
      <circle r={15} fill="none" stroke="#111" strokeWidth="1.2" strokeDasharray={spec.style==='attack'?'4 2':'1 0'}/>
      <circle r={11} fill={c.accent||'#ffd400'} stroke="#111" strokeWidth="2"/>
      <text y="4.6" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="13" fill="#fff" stroke="#111" strokeWidth="1.2" paintOrder="stroke">{initial}</text>
      <path d="M-30 -36 Q-40 -20 -38 -4" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".9"/>
    </svg>
  );
}

export default function BeyArt({bey,size=160,spin}){
  const [failed,setFailed]=useState(false);
  const three=useContext(BeyArt3D);
  if(three)return (
    <div style={{width:size,height:size,position:'relative'}}>
      <Suspense fallback={<BeySvg bey={bey} size={size}/>}>
        <BeyShowcase bey={bey} background={false} zoom={1.2} style={{position:'absolute',inset:0,background:'transparent'}}/>
      </Suspense>
    </div>
  );
  // Story variants (e.g. 'raiga-dragoon') reuse their base bey's art; fused beys use the generated icon.
  const ids=[bey.id,String(bey.id||'').split('-').pop()].filter((v,i,a)=>v&&a.indexOf(v)===i);
  const idx=failed===false?0:failed;
  if(!bey.parents&&!bey.look&&idx<ids.length)return <img key={ids[idx]} src={`/art/beys/${ids[idx]}.png`} width={size} height={size} alt={bey.name} style={{objectFit:'contain',display:'block'}} onError={()=>setFailed(idx+1)}/>;
  return <BeySvg bey={bey} size={size} spin={spin}/>;
}

export function PartLine({bey}){
  const spec=specFromBey(bey);
  return <span className="kicker" style={{letterSpacing:'.08em'}}>{bey.name} {bey.ratchet?.prongs||3}-{spec.height} {({needle:'N',ball:'B',flat:'F',rush:'R'})[spec.tip]}</span>;
}
