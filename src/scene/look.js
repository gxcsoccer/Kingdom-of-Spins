import {tr} from '../i18n/index.js';
// Visual "look" of a bey (from fusion AI): blade silhouette, material finish, emblem, blade pattern.
// Silhouettes are derived from the physics wing span (same wing count, same reach, never beyond it),
// so the art never contradicts the collision hull.
import { wingOutline } from '../physics/model.js';

export const SHAPES = ['blade', 'claw', 'fang', 'wing', 'flame', 'shield', 'horn', 'shuriken'];
export const FINISHES = ['toon', 'metal', 'crystal', 'neon'];
export const EMBLEMS = ['dragon', 'wolf', 'eagle', 'shark', 'tiger', 'phoenix', 'lightning', 'flame', 'star', 'wave', 'mountain', 'fish', 'ram', 'shuriken', 'mask', 'letter'];
export const PATTERNS = ['none', 'stripes', 'flames', 'bolts', 'dots'];

export const LOOK_ZH = {
  shape: { blade: tr("利刃"), claw: tr("龙爪刃"), fang: tr("獠牙刃"), wing: tr("后掠翼"), flame: tr("火舌刃"), shield: tr("圆盾刃"), horn: tr("羊角刃"), shuriken: tr("手里剑") },
  finish: { toon: tr("漫画涂装"), metal: tr("金属"), crystal: tr("水晶"), neon: tr("霓虹") },
  emblem: { dragon: tr("龙"), wolf: tr("狼"), eagle: tr("鹰"), shark: tr("鲨"), tiger: tr("虎"), phoenix: tr("凤凰"), lightning: tr("闪电"), flame: tr("火焰"), star: tr("星"), wave: tr("海浪"), mountain: tr("山"), fish: tr("鱼"), ram: tr("山羊"), shuriken: tr("手里剑"), mask: tr("巨人"), letter: tr("字母") },
  pattern: { none: '', stripes: tr("条纹"), flames: tr("火焰纹"), bolts: tr("闪电纹"), dots: tr("圆点纹") },
};

export function normLook(look) {
  if (!look || typeof look !== 'object') return null;
  return {
    shape: SHAPES.includes(look.shape) ? look.shape : 'blade',
    finish: FINISHES.includes(look.finish) ? look.finish : 'toon',
    emblem: EMBLEMS.includes(look.emblem) ? look.emblem : 'letter',
    pattern: PATTERNS.includes(look.pattern) ? look.pattern : 'none',
    trim: ['silver', 'accent', 'gold'].includes(look.trim) ? look.trim : null, // accent-plate colour override (catalog art)
  };
}

/** e.g. 「龙爪刃 · 霓虹 · 闪电纹 · 龙徽」 */
export function lookWords(look) {
  const l = normLook(look); if (!l) return '';
  return [LOOK_ZH.shape[l.shape], LOOK_ZH.finish[l.finish], LOOK_ZH.pattern[l.pattern], l.emblem !== 'letter' ? tr("{0}徽章", [LOOK_ZH.emblem[l.emblem]]) : '']
    .filter(Boolean).join(' · ');
}

const RIN = .0135;
// Polar helper around wing i: t is the angle offset from the wing centre (leading edge = +t).
const polar = (a0, pts) => pts.map(([r, t]) => [r * Math.cos(a0 + t), r * Math.sin(a0 + t)]);

/** Visual wing outline for wing i (2D points, CCW-ish). Falls back to the physics outline. */
export function visualOutline(spec, i, shape = 'blade') {
  if (!shape || shape === 'blade') return wingOutline(spec, i);
  const n = spec.wings, h = { 2: .78, 3: .56, 4: .42 }[n] || .56, R = spec.reach, a0 = i * 2 * Math.PI / n;
  let pts;
  if (shape === 'claw') pts = [[RIN, -h * .9], [R * .7, -h * .8], [R * .94, -h * .3], [R, h * .35], [R * .97, h * 1.05], [R * .9, h * 1.5], [R * .84, h * .95], [R * .76, h * .45], [R * .58, h * .15], [RIN, h * .2]]; // hooked crescent
  else if (shape === 'fang') pts = [[RIN, -h], [R * .7, -h * .9], [R * .86, -h * .55], [R * .72, -h * .2], [R, h * .45], [R * .66, h * .78], [RIN, h]];
  else if (shape === 'wing') pts = [[RIN, -h * .4], [R * .62, -h * 1.15], [R, -h * 1.45], [R * .9, -h * .7], [R * .86, h * .05], [R * .7, h * .6], [RIN, h * .9]];
  else if (shape === 'flame') {
    pts = [[RIN, -h]];
    const k = 7;
    for (let j = 0; j <= k; j++) { const t = -h + 2 * h * j / k; pts.push([j % 2 ? R : R * .76, t + (j % 2 ? .1 * h : 0)]); }
    pts.push([RIN, h]);
  } else if (shape === 'shield') {
    pts = [[RIN, -h * 1.1], [R * .84, -h * 1.1], [R * .97, -h * .92]];
    for (let j = 0; j <= 12; j++) { const t = -h * .8 + 1.6 * h * j / 12; pts.push([R * (j % 4 === 0 ? .93 : 1), t]); } // scalloped armour rim
    pts.push([R * .97, h * .92], [R * .84, h * 1.1], [RIN, h * 1.1]);
  } else if (shape === 'horn') { // curled ram horn: sweeps out, curls back in toward the hub
    pts = [[RIN, -h * .95], [R * .78, -h * 1.12], [R, -h * .62], [R, -h * .05], [R * .93, h * .45], [R * .76, h * .72], [R * .58, h * .62], [R * .54, h * .3], [R * .66, h * .12], [R * .74, h * .22], [R * .8, -h * .1], [R * .62, -h * .3], [RIN, h * .2]];
  } else if (shape === 'shuriken') { // one star point per wing
    pts = [[RIN, -h * .98], [R * .5, -h * .42], [R, h * .1], [R * .48, h * .42], [RIN, h * .98]];
  } else return wingOutline(spec, i);
  return polar(a0, pts);
}
