import {tr} from '../i18n/index.js';
// Bey catalog. Names follow the kid's original designs (placeholders, not official products).
// blade: wings 2-4, reach .022-.030 m, ring 20-85 (% of blade mass on the outer ring), mass 24-40 g, style
// ratchet.height: 55 | 60 | 70 ; bit: needle | ball | flat | rush
// look: visual-only silhouette/finish/emblem matched to /art/beys/<id>.png (physics comes from blade.*)
export const BEYS = {
  dragoon: {id:'dragoon', name:'Dragoon', zh:tr("飞龙"), type:'attack', colors:{primary:'#2f7bff',secondary:'#c9d6ff',accent:'#00e5ff'},
    blade:{wings:3,reach:.029,ring:70,mass:34,style:'attack'}, ratchet:{height:60,prongs:3}, bit:'flat', look:{shape:'claw',finish:'metal',emblem:'dragon',pattern:'none',trim:'silver'},
    lore:tr("三片龙翼，刃口朝前，冲得快撞得狠。")},
  fish: {id:'fish', name:'Fish', zh:tr("游鱼"), type:'stamina', colors:{primary:'#14c9a5',secondary:'#e0fff6',accent:'#7cffd8'},
    blade:{wings:4,reach:.025,ring:80,mass:30,style:'stamina'}, ratchet:{height:55,prongs:4}, bit:'needle', look:{shape:'wing',finish:'metal',emblem:'fish',pattern:'none',trim:'silver'},
    lore:tr("圆滑的鱼鳍，重量都在外圈，像鱼一样绕着转个不停。")},
  goatpuff: {id:'goatpuff', name:'GoatPuff', zh:tr("山羊泡芙"), type:'defense', colors:{primary:'#f2b632',secondary:'#fff4d6',accent:'#ffe27a'},
    blade:{wings:2,reach:.027,ring:55,mass:37,style:'defense'}, ratchet:{height:60,prongs:5}, bit:'ball', look:{shape:'horn',finish:'metal',emblem:'ram',pattern:'none',trim:'accent'},
    lore:tr("两只厚厚的羊角，又重又稳，撞上来就顶回去。")},
  ninjamight: {id:'ninjamight', name:'NinjaMight', zh:tr("忍者之力"), type:'balance', colors:{primary:'#8a3cff',secondary:'#e7d9ff',accent:'#d35bff'},
    blade:{wings:3,reach:.027,ring:62,mass:33,style:'balance'}, ratchet:{height:60,prongs:3}, bit:'ball', look:{shape:'shuriken',finish:'metal',emblem:'shuriken',pattern:'none',trim:'silver'},
    lore:tr("攻守都会一点，像忍者一样找机会。")},
  titan: {id:'titan', name:'Titan', zh:tr("泰坦"), type:'defense', colors:{primary:'#8d99a6',secondary:'#f1f4f7',accent:'#ff7a3d'},
    blade:{wings:4,reach:.028,ring:68,mass:39,style:'defense'}, ratchet:{height:55,prongs:4}, bit:'ball', look:{shape:'shield',finish:'metal',emblem:'mask',pattern:'none',trim:'accent'},
    lore:tr("金属重甲巨人，最重的陀螺之一。")},
  bossdragoon: {id:'bossdragoon', name:'Boss Dragoon', zh:tr("魔王飞龙"), type:'attack', colors:{primary:'#ff2d4a',secondary:'#ffd0d6',accent:'#ffb300'},
    blade:{wings:3,reach:.030,ring:75,mass:38,style:'attack'}, ratchet:{height:60,prongs:3}, bit:'rush', look:{shape:'claw',finish:'metal',emblem:'dragon',pattern:'none',trim:'gold'},
    lore:tr("传说中的魔王陀螺。")},
};
export const STARTERS = ['dragoon','fish','goatpuff'];
export const TYPE_LABEL = {attack:tr("攻击型"),defense:tr("防御型"),stamina:tr("持久型"),balance:tr("平衡型")};
