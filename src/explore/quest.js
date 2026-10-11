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

export const targetName = t => t.type === 'bey' ? (BEYS[t.id]?.name || t.id) : (BLADERS.find(b => b.id === t.id)?.name || t.id);

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

/** 当前任务 + 一条能照着走的线索。hintLevel 0=方向，1=加上下一站，2=直接点名物体。 */
export function questClue(regionId, target, here, hintLevel = 0) {
  if (!target) return null;
  const name = targetName(target), what = target.type === 'bey' ? `陀螺 ${name}` : `陀螺手 ${name}`;
  const scene = sceneOf(regionId, target.scene), spotLabel = scene?.spots?.[target.spot]?.label;
  if (here === target.scene) {
    return {title: `找到${what}`, text: hintLevel >= 1 && spotLabel ? `就在这里！仔细看看「${spotLabel}」附近。` : `就在这个地方！点点画里的东西，仔细找找。`, here: true};
  }
  const path = shortestPath(regionId, here, target.scene) || [];
  const dir = compass(regionId, here, target.scene), n = path.length - 1, next = sceneOf(regionId, path[1]);
  let text = `${name} 藏在你的「${dir}」边，大约要走 ${n} 站。`;
  if (hintLevel >= 1 && next) text += `先往「${next.title}」走。`;
  if (hintLevel >= 2 && scene) text += `目的地是「${scene.title}」${spotLabel ? `，在「${spotLabel}」附近` : ''}。`;
  return {title: `找到${what}`, text, dir, steps: n, next: path[1], here: false};
}

/** 冷热提示：点了一个物体后告诉孩子离最近的目标有多远。 */
export function heat(regionId, target, here, tappedSpot) {
  if (!target) return null;
  if (here === target.scene && tappedSpot === target.spot) return {level: 'found', text: '找到了！'};
  const d = hops(regionId, here, target.scene);
  if (d === 0) return {level: 'hot', text: '🔥🔥 超级近！就在这个地方，换个东西点点看'};
  if (d === 1) return {level: 'warm', text: '🔥 很近了！就在旁边的地方'};
  if (d === 2) return {level: 'mild', text: '🌤 有点远，再走两站'};
  return {level: 'cold', text: '❄️ 很远哦，看看小地图的方向'};
}
