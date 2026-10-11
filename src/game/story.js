import {BEYS} from './beys.js';
// Story roster. Tiers follow the kid's design: normal → (own 3 beys) → pro (recruitable) → (3 teammates) → super pro → boss.
const v=(base,over)=>({...BEYS[base],...over,blade:{...BEYS[base].blade,...(over.blade||{})},colors:{...BEYS[base].colors,...(over.colors||{})}});
export const BLADERS = [
  {id:'ran', name:'小岚', tier:'normal', color:'#14c9a5', line:'转得久才是王道！', bey:v('fish',{id:'ran-fish',name:'Mist Fish',blade:{ring:72}}), launch:{rpm:4300,tilt:4,speed:.3,aim:.7}},
  {id:'tetsu', name:'阿铁', tier:'normal', color:'#f2b632', line:'我的陀螺像山一样稳。', bey:v('goatpuff',{id:'tetsu-goat',name:'Rock GoatPuff'}), launch:{rpm:4400,tilt:5,speed:.3,aim:.5}},
  {id:'hop', name:'跳跳', tier:'normal', color:'#ff7a3d', line:'冲冲冲！撞飞你！', bey:v('ninjamight',{id:'hop-ninja',name:'Hop Ninja',bit:'flat',blade:{style:'attack'}}), launch:{rpm:4500,tilt:6,speed:.45,aim:.4}},
  {id:'raiga', name:'雷牙', tier:'pro', color:'#2f7bff', line:'想赢我？先追上我的速度。', bey:v('dragoon',{id:'raiga-dragoon',name:'Thunder Dragoon',blade:{mass:36}}), launch:{rpm:5200,tilt:5,speed:.45,aim:.5}},
  {id:'hyomi', name:'冰见', tier:'pro', color:'#7cd8ff', line:'最后还在转的，就是赢家。', bey:v('fish',{id:'hyomi-fish',name:'Glacier Fish',blade:{mass:34,ring:84}}), launch:{rpm:5400,tilt:3,speed:.25,aim:.8}},
  {id:'iwaki', name:'岩城', tier:'pro', color:'#8d99a6', line:'金属的重量，你接得住吗？', bey:v('titan',{id:'iwaki-titan',name:'Titan'}), launch:{rpm:5000,tilt:4,speed:.3,aim:.5}},
  {id:'shadow', name:'影', tier:'super', color:'#8a3cff', line:'……你看不见我的刀。', bey:v('ninjamight',{id:'shadow-ninja',name:'Shadow NinjaMight',blade:{mass:37,reach:.029}}), launch:{rpm:5600,tilt:5,speed:.4,aim:.6}},
  {id:'blaze', name:'焰', tier:'super', color:'#ff4d2d', line:'燃烧吧！全力一击！', bey:v('dragoon',{id:'blaze-dragoon',name:'Blaze Dragoon',bit:'rush',colors:{primary:'#ff4d2d',accent:'#ffd400'}}), launch:{rpm:5800,tilt:6,speed:.5,aim:.4}},
  {id:'nova', name:'诺瓦', tier:'super', color:'#ff5bd0', line:'我算过了，你赢的概率很低哦。', bey:v('titan',{id:'nova-titan',name:'Nova Titan',bit:'needle',colors:{primary:'#ff5bd0',accent:'#ffe27a'}}), launch:{rpm:5800,tilt:3,speed:.25,aim:.7}},
  {id:'ryuoh', name:'龙王', tier:'boss', color:'#ff2d4a', line:'龙，只会俯视大地。', bey:BEYS.bossdragoon, launch:{rpm:6200,tilt:5,speed:.5,aim:.5}},
];
export const TIERS = {
  normal:{label:'普通对手',req:null},
  pro:{label:'职业对手',req:'收集 3 只陀螺解锁'},
  super:{label:'超级职业',req:'队伍里有 3 名队员解锁'},
  boss:{label:'最终 BOSS',req:'打败全部超级职业解锁'},
};
export const WIN_POINTS = 4;
export const POINTS = {xtreme:3, over:2, burst:2, spin:1, judge:1};
export const FINISH_LABEL = {xtreme:'XTREME FINISH', over:'OVER FINISH', burst:'BURST FINISH', spin:'SPIN FINISH', judge:'判定胜'};
export const FINISH_ZH = {xtreme:'极限出界', over:'出界', burst:'爆裂', spin:'停转', judge:'时间到·转速判定'};

export function tierUnlocked(tier, save){
  if(tier==='normal')return true;
  if(tier==='pro')return save.collection.length>=3;
  if(tier==='super')return save.team.length>=3;
  if(tier==='boss')return BLADERS.filter(b=>b.tier==='super').every(b=>save.defeated.includes(b.id));
  return false;
}
