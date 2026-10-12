import {tr} from '../i18n/index.js';
import {specFromBey,makePart,TIPS} from '../physics/model.js';
// Display stats derived from the physics spec (not hidden multipliers): 0..100 for bars + raw numbers.
export function beyStats(bey){
  const part=makePart(specFromBey(bey));
  const iz=part.inertia[2]*1e6; // g·cm² ≈ kg·m²·1e7; we show ×1e6 kg·m² for readability
  const grip={needle:10,ball:35,flat:70,rush:95}[part.tip];
  const edge={attack:90,balance:60,defense:35,stamina:20}[part.style];
  const pct=(v,lo,hi)=>Math.round(Math.max(4,Math.min(100,(v-lo)/(hi-lo)*100)));
  return {
    massG:+(part.mass*1000).toFixed(1), inertia:+iz.toFixed(2), tip:TIPS[part.tip].label, height:part.height,
    bars:{
      attack:pct(edge*.6+grip*.4,10,95),
      defense:pct(part.mass*1000*1.6+(70-part.height)*1.5,55,90),
      stamina:pct(iz*3.4+(100-grip)*.35,40,110),
      speed:pct(grip,0,100),
    },
  };
}
export const BAR_LABEL={attack:tr("攻击"),defense:tr("防御"),stamina:tr("持久"),speed:tr("机动")};
export const BAR_COLOR={attack:'#ff2d4a',defense:'#f2b632',stamina:'#14c9a5',speed:'#2f7bff'};
