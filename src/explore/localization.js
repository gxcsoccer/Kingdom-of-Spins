import {getLocale, translateSavedText} from '../i18n/index.js';

// A read-only display projection: preserve the saved route, hiding plan, rewards,
// quiz answer order and IDs. Both old Chinese saves and new English saves work.
export function localizeExploreState(gm, language = getLocale()) {
  if (!gm) return gm;
  const text = value => translateSavedText(value, language);
  const gate = gm.pendingGate;
  return {...gm,
    narration: text(gm.narration),
    trail: (gm.trail || []).map(page => ({...page,
      title: text(page.title), line: text(page.line), tapped: text(page.tapped),
      panels: page.panels?.map(panel => ({...panel, text: text(panel.text)})),
      hotspots: page.hotspots?.map(spot => ({...spot, label: text(spot.label)})),
      exits: page.exits?.map(exit => ({...exit, title: text(exit.title)})),
    })),
    done: (gm.done || []).map(item => ({...item, name: text(item.name), where: text(item.where)})),
    pendingGate: gate ? {...gate, lead: text(gate.lead), q: text(gate.q),
      explain: text(gate.explain), options: gate.options?.map(text)} : gate,
  };
}
