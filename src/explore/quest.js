// 寻宝任务逻辑（纯函数，前后端都能用）：当前目标、可执行的方位线索、冷热提示。
// 场景之间的连接与方位来自 src/game/scenes.js 的 exits / pos，保证线索一定正确、照着走一定能到。
import {SCENES} from '../game/scenes.js';
import {BEYS} from '../game/beys.js';
import {BLADERS} from '../game/story.js';

const DIRS = ['东', '东北', '北', '西北', '西', '西南', '南', '东南'];
export const sceneOf = (regionId, key) => (SCENES[regionId] || []).find(s => s.key === key);

/** 场景图上的最短路径（含起点终点），找不到返回 null。 */
export function shortestPath(regionId, from, to) {
  if (from === to) return [from];
  const prev = {[from]: null}, q = [from];
  while (q.length) {
    const cur = q.shift();
    for (const n of sceneOf(regionId, cur)?.exits || []) {
      if (n in prev) continue;
      prev[n] = cur;
      if (n === to) { const path = [to]; let p = cur; while (p) { path.unshift(p); p = prev[p]; } return path; }
      q.push(n);
    }
  }
  return null;
}
export const hops = (regionId, from, to) => { const p = shortestPath(regionId, from, to); return p ? p.length - 1 : Infinity; };

/** 地图上的罗盘方向（地图 y 向下 = 南）。 */
export function compass(regionId, from, to) {
  const a = sceneOf(regionId, from)?.pos, b = sceneOf(regionId, to)?.pos;
  if (!a || !b) return null;
  const ang = Math.atan2(a.y - b.y, b.x - a.x);   // 北为正
  return DIRS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
}

// 中文名在前（孩子记得住“山羊泡芙”，记不住 GoatPuff）。
export const targetName = t => t.type === 'bey' ? (BEYS[t.id]?.zh || BEYS[t.id]?.name || t.id) : (BLADERS.find(b => b.id === t.id)?.name || t.id);

/**
 * 还没完成的目标（按离当前场景的步数排序，最近的排第一）。
 * hidePlan: [{type:'bey'|'blader', id, scene, spot}]   found/met: 已收集的 id。
 */
export function openTargets(regionId, hidePlan = [], found = [], met = [], here) {
  return hidePlan
    .filter(t => t.type === 'bey' ? !found.includes(t.id) : !met.includes(t.id))
    .map(t => ({...t, dist: hops(regionId, here, t.scene)}))
    .sort((a, b) => a.dist - b.dist);
}

/** 画面里的大致区域（给二级提示用）：左上 / 上方 / 右上 / 左边 / 中间 …… */
export function screenArea(x, y) {
  const h = x < .36 ? '左' : x > .64 ? '右' : '', v = y < .36 ? '上' : y > .64 ? '下' : '';
  if (!h && !v) return '中间';
  if (!h) return v === '上' ? '上方' : '下方';
  if (!v) return h + '边';
  return h + v + '角';
}
const ARROW = {东: '→', 东北: '↗', 北: '↑', 西北: '↖', 西: '←', 西南: '↙', 南: '↓', 东南: '↘'};

/**
 * 当前任务 + 一条能照着走的线索（一定说出下一站的地名，不只说方向）。
 * 提示分三级：不在目标场景时 0=下一站，1=加上目的地，2=加上物体；在目标场景时 0=就在这张图，1=画面区域，2=直接点名物体（并高亮）。
 */
export function questClue(regionId, target, here, hintLevel = 0) {
  if (!target) return null;
  const name = targetName(target), what = target.type === 'bey' ? `陀螺 ${name}` : `陀螺手 ${name}`;
  const scene = sceneOf(regionId, target.scene), spot = scene?.spots?.[target.spot], spotLabel = spot?.label;
  if (here === target.scene) {
    const text = hintLevel >= 2 && spotLabel ? `就在「${spotLabel}」！点它！`
      : hintLevel >= 1 && spot ? `${name} 就在这张图里，看看画面的「${screenArea(spot.x, spot.y)}」。`
      : `${name} 就在这张图里！点点画里的东西找找看。`;
    return {title: `找到${what}`, text, here: true, spot: hintLevel >= 2 ? target.spot : null};
  }
  const path = shortestPath(regionId, here, target.scene) || [];
  const n = path.length - 1, next = sceneOf(regionId, path[1]), d1 = compass(regionId, here, path[1]);
  let text = n <= 1 ? `${name} 就在隔壁的「${next?.title}」${ARROW[d1] || ''}，走过去吧！`
    : `先去「${next?.title}」${ARROW[d1] || ''}，还要走 ${n} 站。`;
  if (n > 1 && hintLevel >= 1 && scene) text += `目的地是「${scene.title}」${hintLevel >= 2 && spotLabel ? `，找「${spotLabel}」` : ''}。`;
  return {title: `找到${what}`, text, steps: n, next: path[1], here: false};
}

/** 画面里的方向（屏幕坐标，y 向下）：上 / 右上 / 右 … */
export function screenDir(dx, dy) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < .08 && ay < .08) return '旁';
  const h = dx > 0 ? '右' : '左', v = dy > 0 ? '下' : '上';
  if (ax > ay * 2) return h;
  if (ay > ax * 2) return v;
  return h + v;
}
/** 罗盘方向对应的箭头。 */
export const DIR_ARROW = {东: '→', 东北: '↗', 北: '↑', 西北: '↖', 西: '←', 西南: '↙', 南: '↓', 东南: '↘'};

/** 冷热提示：点了一个物体后说清楚“这里没有，目标在哪”。 */
export function heat(regionId, target, here, tappedSpot) {
  if (!target) return null;
  if (here === target.scene && tappedSpot === target.spot) return {level: 'found', text: '找到了！'};
  const d = hops(regionId, here, target.scene), name = targetName(target);
  const label = sceneOf(regionId, here)?.spots?.[tappedSpot]?.label || '这里';
  const no = `「${label}」那儿没有 ${name}`;
  if (d === 0) {
    const sp = sceneOf(regionId, here)?.spots || [], a = sp[tappedSpot], t = sp[target.spot];
    const dir = a && t ? screenDir(t.x - a.x, t.y - a.y) : '';
    return {level: 'hot', text: dir && dir !== '旁' ? `${no}，但它就在这张图里 🔥🔥 往「${dir}」边看看` : `${no}，但它就在附近 🔥🔥 再看看别的东西`};
  }
  const next = sceneOf(regionId, (shortestPath(regionId, here, target.scene) || [])[1])?.title;
  if (d === 1) return {level: 'warm', text: `${no}～它在隔壁的「${next}」🔥`};
  if (d === 2) return {level: 'mild', text: `${no}～先去「${next}」，还要走 2 站 🌤`};
  return {level: 'cold', text: `${no}～它还很远 ❄️ 先去「${next}」`};
}
