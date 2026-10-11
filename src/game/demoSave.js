// 演示用预置存档：一个“玩到一半”的孩子进度，用来现场演示（家长管理里一键导入）。
import {BEYS} from './beys.js';
import {freshSave} from './store.js';

const uid = () => Math.random().toString(36).slice(2, 8);
const copy = (id, extra = {}) => ({...structuredClone(BEYS[id]), uid: uid(), ...extra});

export function makeDemoSave(prev = {}) {
  const dragoon = copy('dragoon', {origin: 'starter'});
  const fish = copy('fish', {origin: 'explore', foundIn: 'harbor'});
  const goat = copy('goatpuff', {origin: 'explore', foundIn: 'harbor'});
  const ninja = copy('ninjamight', {origin: 'blindbox'});
  // 融合设计的“雷龙小勇士”：蓝金配色、龙爪刃、闪电纹（外观只影响样子，物理参数按攻击型）。
  const design = {
    id: 'fusion-dragoontan-demo', name: 'Dragoontan', zh: '雷龙小勇士', type: 'attack',
    colors: {primary: '#2f7bff', secondary: '#f2b632', accent: '#ffd84a'},
    blade: {wings: 3, reach: .029, ring: 68, mass: 36, style: 'attack'},
    ratchet: {height: 60, prongs: 3}, bit: 'flat',
    look: {shape: 'claw', finish: 'metal', emblem: 'dragon', pattern: 'bolts'},
    lookNote: '你说要蓝金色、龙爪、闪电纹 → 蓝金配色、爪形刃、龙徽章、闪电花纹',
    specialMove: {name: '雷龙裂爪击', shout: '雷龙之力——撕裂吧！'},
    lore: 'Dragoon 和 Titan 的刃合体，闪电缠绕的龙爪。', why: '外圈配重 68%、刃半径大，撞击力强。', tradeoff: '平轴跑得猛，但转速掉得快。',
    parents: ['dragoon', 'titan'], keptFrom: 'dragoon', fusedBy: 'ai', origin: 'fusion', uid: uid(),
    knowledge: [{id: 'ph-momentum', title: '动量与碰撞', layer: 'physics'}],
  };
  const modded = {...structuredClone(design), uid: uid(), zh: '雷龙小勇士·改', bit: 'needle', origin: 'lab', modOf: design.uid,
    mods: [{key: 'bit', from: '平轴 Flat', to: 'needle', toLabel: '尖轴 Needle', label: '轴尖 Bit', text: '换上了 尖轴 Needle'}]};
  return {
    ...freshSave(),
    profile: prev.profile || null,
    coins: 300,
    collection: [dragoon, fish, goat, design, modded, ninja],
    team: [{bladerId: 'hyomi', beyUid: fish.uid}, {bladerId: 'raiga', beyUid: ninja.uid}],
    defeated: ['ran', 'tetsu', 'hop', 'hyomi', 'raiga'],
    wins: {ran: 1, tetsu: 1, hop: 1, hyomi: 1, raiga: 1},
    battles: 9,
    cards: ['bx-three-parts', 'bx-blade-role', 'bx-bit-role', 'bx-xdash', 'bx-finish-points', 'ph-inertia', 'ph-friction-area', 'ph-momentum',
      'ph-gyro-stability', 'ph-energy-convert', 'gd-fusion-blade-only', 'geo-tides', 'geo-compass', 'geo-coast', 'geo-lighthouse', 'geo-altitude-cold'],
    explore: {
      // 港湾寻宝已完成；雷霆山脉进行到一半（见过雷牙、冰见，还差泰坦和岩城）。
      harbor: {found: ['fish', 'goatpuff', 'ninjamight'], met: ['ran', 'tetsu', 'hop'], steps: 16, runs: 1, gm: null},
      thunder: {found: [], met: ['raiga', 'hyomi'], steps: 7, runs: 1, gm: null},
    },
    quizSeen: [],
    demo: true,
  };
}
