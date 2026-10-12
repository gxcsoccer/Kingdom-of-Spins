import {tr} from '../i18n/index.js';
// Real-world prototypes behind each fictional region. Only conservative, well-established facts —
// the AI Game Master may cite real places ONLY from these packs.
export const PROTOTYPES = {
  harbor: {
    name: tr("圣米歇尔山"), en: 'Mont-Saint-Michel', place: tr("法国 · 诺曼底海岸"), lat: 48.636, lon: -1.511,
    facts: [
      tr("圣米歇尔山是法国诺曼底海边的一座小岩石岛，岛顶上有一座古老的修道院。"),
      tr("这里的潮差（涨潮和落潮的高度差）最大可达约 14 米，是欧洲潮差最大的地方之一。"),
      tr("大潮涨起来时，海水会把小岛团团围住；落潮时，周围会露出一大片沙滩。"),
      tr("潮水主要是月球的引力拉出来的，太阳也有影响；新月和满月前后潮差最大，叫“大潮”。"),
      tr("现在游客可以走一座长长的步行桥上岛，不用担心被潮水困住。"),
    ],
    compare: {q:tr("新手港湾的潮水和圣米歇尔山一样：什么时候潮差最大？"), options:[tr("新月和满月前后（大潮）"),tr("刮大风的时候"),tr("每天中午")], answer:0,
      explain:tr("新月和满月前后，月球和太阳的引力方向差不多在一条线上，合在一起拉海水，涨得最高、落得最低。")},
    cards: ['geo-tides','geo-coast','geo-compass'],
    imagePrompt: 'Mont-Saint-Michel, a small rocky tidal island off the coast of Normandy France topped by a medieval abbey with a tall spire, surrounded by wide wet sand flats at low tide, the sea coming in from the distance, soft clouds',
  },
  thunder: {
    name: tr("珠穆朗玛峰与喜马拉雅山脉"), en: 'Mount Everest · Himalayas', place: tr("中国与尼泊尔交界"), lat: 27.988, lon: 86.925,
    facts: [
      tr("珠穆朗玛峰是世界最高峰，2020 年中国和尼泊尔共同测量的高度是 8848.86 米。"),
      tr("海拔每升高 100 米，气温大约降低 0.6°C，所以峰顶比海边冷 50 多度。"),
      tr("喜马拉雅山脉是印度洋板块和亚欧板块相撞挤出来的，现在每年还在慢慢升高一点点。"),
      tr("从山脚往上走，会看到森林、草甸、裸露的岩石，最后是常年不化的冰雪和冰川。"),
      tr("峰顶的空气很稀薄，气压只有海边的三分之一左右，登山的人常常要带氧气瓶。"),
    ],
    compare: {q:tr("雷霆山脉和珠穆朗玛峰一样：为什么山顶比山脚冷？"), options:[tr("海拔越高气温越低，约每升高 100 米降 0.6°C"),tr("山顶离太阳更远，所以更冷")], answer:0,
      explain:tr("山顶离太阳只近了几千米，和地球到太阳的 1.5 亿千米比起来几乎没区别。真正的原因是：空气越往高处越稀薄，越不容易保住热量。")},
    cards: ['geo-altitude-cold','geo-snowline','geo-contour','geo-plates'],
    imagePrompt: 'Mount Everest and the Himalaya mountain range, a giant snowy pyramid peak above glaciers, clouds below the summit, pine forests and meadows in the lower valleys, natural landscape',
  },
  volcano: {
    name: tr("夏威夷群岛"), en: 'Hawaiian Islands', place: tr("太平洋中部"), lat: 19.6, lon: -155.5,
    facts: [
      tr("夏威夷群岛在太平洋中间，是海底火山一次次喷发、熔岩一层层堆起来形成的。"),
      tr("这里的火山坡度很缓，像一面平放在地上的盾牌，所以叫“盾状火山”。"),
      tr("太平洋板块下面有一个“热点”，板块慢慢移动，火山一个接一个长出来，岛就排成了一串。"),
      tr("熔岩流进大海会迅速冷却变硬，变成新的陆地，所以岛屿还在“长大”。"),
      tr("冒纳罗亚火山是世界上体积最大的活火山之一。"),
    ],
    compare: {q:tr("龙焰火山岛的原型夏威夷：为什么岛屿排成长长的一串？"), options:[tr("板块在热点上方慢慢移动，火山一个接一个长出来"),tr("海浪把小岛推成了一排")], answer:0,
      explain:tr("热点几乎不动，板块在它上面慢慢滑过；每滑过一段就长出一座新火山，旧的火山被带走，于是排成一串。")},
    cards: ['geo-volcano','geo-plates','geo-magma-lava','geo-hot-spring'],
    imagePrompt: 'the Hawaiian Islands, a broad gently sloping shield volcano with glowing orange lava flowing into the blue Pacific ocean making steam clouds, black lava rock coast, palm trees',
  },
};
export const prototypeOf = regionId => PROTOTYPES[regionId] || null;
// Orthographic projection for the little globe: returns {x,y} in [-1,1] (null if on the far side).
export function globePoint(lat, lon, lat0=20, lon0=lon) {
  const r = Math.PI/180, f = lat*r, l = (lon-lon0)*r, f0 = lat0*r;
  const cosc = Math.sin(f0)*Math.sin(f) + Math.cos(f0)*Math.cos(f)*Math.cos(l);
  if (cosc < 0) return null;
  return {x: Math.cos(f)*Math.sin(l), y: Math.cos(f0)*Math.sin(f) - Math.sin(f0)*Math.cos(f)*Math.cos(l)};
}
