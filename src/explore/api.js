import {getLocale, localizeTextFields, tr} from '../i18n/index.js';
// Explore step client: never throws; on failure returns a gentle "keep walking" page so the run continues.
import {sanitizePage} from '../ai/fallback.js';
export async function exploreStep({regionId, state, action}) {
  const ctl = new AbortController(), timer = setTimeout(()=>ctl.abort(), 45000);
  try {
    const r = await fetch('/api/ai/explore/step', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({regionId, state, action, locale:getLocale()}), signal:ctl.signal});
    const out = await r.json();
    if (!r.ok || !out.page) throw new Error(out.error || 'HTTP '+r.status);
    return localizeTextFields({events:[], ...out});
  } catch {
    return localizeTextFields({page: sanitizePage({title:'继续前进', panels:[{text:'信号有点弱……我们换个方向走走看！', kind:'caption', x:.05, y:.05}], imagePrompt:'a winding path through a seaside town toward a lighthouse, adventure map feeling', cardId:'geo-compass'}, 'geo-compass'), events:[], narration:'往前走走看！', fallback:true});
  } finally { clearTimeout(timer); }
}
