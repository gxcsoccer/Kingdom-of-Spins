// AI 科学绘本 — built-in chapters. Each chapter = one big question with a 6-page arc:
// 1 hook(+guess) → 2 observe → 3 analogy → 4 hands-on experiment (widget) → 5 quiz → 6 wrap-up + badge.
// Static art: public/art/book/<chapter>/<n>.jpg for pages 1,2,3,6 (pre-generated). Pages 4/5 use widgets/quiz UI.
export const BOOK_STYLE = "bright Japanese anime cel-shaded children's science manga illustration, bold clean ink outlines, light screentone shading, 4:3 landscape frame, clear single focal subject, no text, no letters, no numbers, no speech bubbles";
export const bookArt = (chapter, n) => `/art/book/${chapter}/${n}.jpg`;

export const CHAPTERS = [
  {
    id: 'inertia', title: '外圈的秘密', question: '为什么外圈重的陀螺转得更久？', color: '#2f7bff', badge: '惯量大师',
    cards: ['ph-inertia', 'ph-figure-skater', 'gd-ring-slider', 'mt-metal'], experiment: 'inertia', quiz: 'ph-inertia',
    pages: [
      {kind:'hook', title:'两只陀螺比耐力', text:['两只一样重的陀螺，用一样的力发射。','一只把重量放在外圈，一只放在中心。','你猜，谁会转得更久？'],
        guess:['外圈重的','中心重的','一样久'], answer:0,
        prompt:'two identical-size battle spinning tops side by side on a white practice stadium floor, seen from a low three-quarter angle, the left top has shiny heavy metal weights mounted on its outer rim, the right top has a single heavy metal weight in its center hub, both spinning with circular motion lines, a curious kid scientist with goggles watching between them'},
      {kind:'observe', title:'仔细看外圈', text:['看！左边陀螺的重量都在边上。','转起来以后，外圈的每一块金属都在绕着中心跑大圈。','离中心越远，跑的圈越大、越难停下来。'],
        prompt:'a Beyblade-style battle spinning top seen from directly above: a flat round metal disc with three curved blades, six small heavy silver metal weights fixed evenly around the outer rim, glowing blue curved arrows circling the rim to show rotation, a small center hub, white background with speed lines'},
      {kind:'analogy', title:'花样滑冰的魔法', text:['滑冰运动员张开手臂，转得慢；收紧手臂，一下子转得飞快！','重量离中心越远，“转动惯量”越大——越难加速，也越难停下。','外圈重的陀螺，就像一直张着手臂。'],
        prompt:'a two-part manga scene of the same figure skater spinning on ice: on the left she spins slowly with both arms stretched wide out to the sides, on the right she spins fast with arms pulled tightly to her chest, swirl lines and ice sparkles, an ice rink background'},
      {kind:'experiment', title:'动手试一试', text:['点一点灰色的配重块，把它放到外圈或中心，再按“转！”','两只陀螺发射转速一样，摩擦也一样。','看谁先停下来？'] },
      {kind:'quiz', title:'小测验', text:['用你刚学到的知识回答：'] },
      {kind:'wrap', title:'你搞懂了！', text:['重量放在外圈，转动惯量更大。','同样的转速下，它装着更多“转动的能量”，摩擦要花更久才能把它磨掉。','所以持久型陀螺常常把金属放在外圈！'],
        prompt:'a proud kid holding up a battle spinning top with gleaming metal weights on its outer rim, golden trophy-like glow and sparkles behind, a friendly white-haired scientist with goggles giving a thumbs up, celebratory confetti'},
    ],
  },
  {
    id: 'friction', title: '轴尖的选择', question: '为什么尖轴转得久，平轴跑得快？', color: '#14c9a5', badge: '摩擦侦探',
    cards: ['ph-friction-area', 'ph-needle', 'ph-flat', 'ph-rubber'], experiment: 'friction', quiz: 'ph-friction-area',
    pages: [
      {kind:'hook', title:'三种轴尖', text:['陀螺最下面碰地的地方叫轴尖。','有尖的、圆的、平的。','你猜，哪一种转得最久？'], guess:['尖轴','圆轴','平轴'], answer:0,
        prompt:'three battle spinning tops in a row on a smooth arena floor, close-up on their bottom tips touching the ground: the left has a sharp needle point, the middle has a small round ball tip, the right has a wide flat tip, a magnifying glass hovering over the tips'},
      {kind:'observe', title:'看碰地的地方', text:['尖轴只用一个小点碰地。','平轴用一大片碰地，像轮子在地上滚。','碰地的面积不同，摩擦也不同。'],
        prompt:'extreme close-up cross-section manga illustration of two spinning top tips on the floor: a sharp needle tip touching the ground at one tiny glowing point with a few small sparks, next to a wide flat tip pressing a large glowing contact patch with many sparks and dust, motion lines'},
      {kind:'analogy', title:'冰鞋和运动鞋', text:['穿冰鞋在冰上，碰地很少，滑得又久又远；','穿运动鞋在操场，抓地很牢，能猛地冲出去，但也停得快。','轴尖也是这样：抓地少更持久，抓地多更会跑。'],
        prompt:'split manga panel: on the left a kid gliding smoothly on ice skates with long graceful trail lines, on the right a kid in sneakers sprinting and pushing off hard on a running track with dust kicking up, dynamic speed lines'},
      {kind:'experiment', title:'动手试一试', text:['选一种轴尖，按“转！”','看转速掉得快不快，再看它跑得有多远。'] },
      {kind:'quiz', title:'小测验', text:['用你刚学到的知识回答：'] },
      {kind:'wrap', title:'你搞懂了！', text:['碰地面积小、摩擦的“力臂”短，转速掉得慢——尖轴持久。','抓地强的平轴，把转动变成满场跑动——攻击型最爱。','没有最好的轴尖，只有最适合的选择！'],
        prompt:'three happy battle spinning tops with needle, ball and flat tips posing like a team on a podium in a stadium, each with a different colored aura, a kid scientist cheering, confetti'},
    ],
  },
  {
    id: 'momentum', title: '碰撞的较量', question: '为什么重的陀螺不容易被撞飞？', color: '#ff2d4a', badge: '碰撞专家',
    cards: ['ph-momentum', 'ph-impulse', 'ph-energy-convert', 'ph-mass-tradeoff'], experiment: 'momentum', quiz: 'ph-momentum',
    pages: [
      {kind:'hook', title:'轻的撞重的', text:['一只轻陀螺，猛地撞向一只重陀螺。','撞完以后，谁会被弹得更远？'], guess:['轻的那只','重的那只','一样远'], answer:0,
        prompt:'a small light battle spinning top crashing into a big heavy metal battle spinning top inside a stadium bowl, impact star burst at the contact point, the small top bouncing back, sparks flying, dramatic speed lines'},
      {kind:'observe', title:'撞击的一瞬间', text:['碰撞只有一眨眼，但力非常大。','两只陀螺互相推了对方一把——力一样大！','可是重的那只，速度只变了一点点。'],
        prompt:'slow-motion manga freeze-frame of two battle spinning tops at the exact moment of collision, two equal-size glowing arrows pushing in opposite directions at the contact point, the heavy top barely moving, the light top recoiling, sparks and shock rings'},
      {kind:'analogy', title:'保龄球和球瓶', text:['保龄球很重，撞上球瓶后还继续往前滚；','球瓶很轻，被撞得满天飞。','动量 = 质量 × 速度：越重，越难被改变速度。'],
        prompt:'a heavy bowling ball smashing into bowling pins on a lane, the pins flying in all directions while the ball keeps rolling forward, dynamic impact lines, bright bowling alley'},
      {kind:'experiment', title:'动手试一试', text:['调一调两只陀螺的重量，按“撞！”','看撞完后两只的速度。'] },
      {kind:'quiz', title:'小测验', text:['用你刚学到的知识回答：'] },
      {kind:'wrap', title:'你搞懂了！', text:['碰撞时两边受的力一样大，但越重的一方速度变化越小。','所以防御型陀螺常常更重——不容易被撞飞。','可是太重的话，同样的发射力转速会低一些，这就是取舍！'],
        prompt:'a sturdy heavy battle spinning top standing firm like a shield in the middle of a stadium while smaller tops bounce off it, golden glow, a kid scientist raising a fist in triumph'},
    ],
  },
  {
    id: 'precession', title: '不倒的秘密', question: '陀螺转起来，为什么不会倒？', color: '#8a3cff', badge: '平衡之王',
    cards: ['ph-gyro-stability', 'ph-precession', 'ph-angular-momentum', 'ph-tilt-fall'], experiment: 'precession', quiz: 'ph-gyro-stability',
    pages: [
      {kind:'hook', title:'站着的陀螺', text:['不转的陀螺，一放手就倒了。','可是转起来，它就能用一个小尖站着！','你猜，转得越快会怎样？'], guess:['越稳','越容易倒','没区别'], answer:0,
        prompt:'two battle spinning tops on a floor: one lying fallen on its side not spinning, the other standing upright on its tiny tip spinning fast with strong circular motion lines, a surprised kid pointing at them'},
      {kind:'observe', title:'歪着画圈', text:['仔细看：陀螺歪着的时候，并没有倒下去。','它的轴在慢慢画圈——这叫“进动”。','转速越低，圈画得越大、越晃。'],
        prompt:'a tilted battle spinning top spinning on its tip, its axis tracing a slow dotted circle in the air above it, curved arrows showing the circular path, a faint ghost image of the top at several points around the circle'},
      {kind:'analogy', title:'骑自行车', text:['自行车骑得快，稳稳不倒；骑得太慢，就开始左右晃。','转得快的轮子和陀螺一样，有很大的“角动量”。','角动量越大，越不容易被重力推倒。'],
        prompt:'a kid riding a bicycle fast and steady along a park path with speed lines and spinning wheel blur, and in a small inset the same kid wobbling slowly on the bicycle, sweat drops'},
      {kind:'experiment', title:'动手试一试', text:['拖动转速滑块，再看陀螺怎么画圈。','转速太低会怎样？'] },
      {kind:'quiz', title:'小测验', text:['用你刚学到的知识回答：'] },
      {kind:'wrap', title:'你搞懂了！', text:['转得快的陀螺角动量大，重力推它时，它只会慢慢画圈。','转速掉下来，圈越画越大，最后倒下——这就是 Spin 停转。','想让陀螺更稳？让它转得更快、转得更久！'],
        prompt:'a battle spinning top spinning perfectly upright on its tip glowing with a stable purple aura and a halo ring around its axis, a kid scientist balancing on one foot imitating it, playful'},
    ],
  },
  {
    id: 'tides', title: '月亮拉海水', question: '海水为什么每天涨落两次？', color: '#29b6ff', badge: '潮汐观察员',
    cards: ['geo-tides', 'geo-coast', 'geo-compass'], experiment: 'tides', quiz: 'geo-tides',
    pages: [
      {kind:'hook', title:'消失的小路', text:['早上，海边露出一条沙滩小路，能走到小岛上。','到了下午，小路不见了，小岛被海水围住！','你猜，是谁把海水拉来拉去？'], guess:['月亮','风','大鱼'], answer:0,
        prompt:'a small rocky island with a pointed-spire abbey connected to the shore by a wet sandy path at low tide, the same island in a small inset surrounded by sea at high tide with the path underwater, seagulls, bright sky'},
      {kind:'observe', title:'潮水的痕迹', text:['看码头的木桩：一圈深色的水印，那是涨潮时海水到过的高度。','落潮时，潮池和礁石都露出来了。','大多数海边，一天涨潮两次、落潮两次。'],
        prompt:'a harbour pier with wooden posts showing a dark wet tide line high above the current low water level, exposed tide pools with starfish and crabs and seaweed-covered rocks below, boats resting on the sand'},
      {kind:'analogy', title:'被月亮拉长的海洋', text:['月球的引力拉着地球上的海水。','海水被拉成两头鼓起的“大鼓包”：一头朝着月亮，一头背着月亮。','地球每天自转一圈，海边会经过两个鼓包，所以涨潮两次。'],
        prompt:'a simple space diagram illustration: the Earth seen from above the north pole with a blue ocean layer stretched into an oval with two bulges, one bulge pointing toward the Moon on the right and one on the opposite side, the Moon glowing, arrows showing the Earth rotating, starry background'},
      {kind:'experiment', title:'动手试一试', text:['拖动时间，让地球转起来，看港口的水位怎么变。','再试试让太阳和月亮排成一条线。'] },
      {kind:'quiz', title:'小测验', text:['用你刚学到的知识回答：'] },
      {kind:'wrap', title:'你搞懂了！', text:['潮汐主要是月球的引力造成的，太阳也会帮忙。','新月和满月前后，太阳和月亮排成一线，潮差最大——叫“大潮”。','在法国的圣米歇尔山，潮差最大可达约 14 米！'],
        prompt:'Mont-Saint-Michel style rocky tidal island with an abbey at sunset, a full moon rising behind it, the sea flowing in across wide sand flats, a kid explorer with a map watching from the shore'},
    ],
  },
  {
    id: 'altitude', title: '越高越冷', question: '为什么山越高越冷？', color: '#7cd8ff', badge: '登山探险家',
    cards: ['geo-altitude-cold', 'geo-snowline', 'geo-contour'], experiment: 'altitude', quiz: 'geo-altitude-cold',
    pages: [
      {kind:'hook', title:'山脚和山顶', text:['山脚下穿短袖还嫌热，山顶却盖着厚厚的雪。','山顶明明离太阳更近一点……','你猜，为什么山顶反而更冷？'], guess:['空气越高越稀薄，保不住热','山顶离太阳更远','山顶风太小'], answer:0,
        prompt:'a tall mountain from base to summit: green forest and a warm sunny valley with a kid in a t-shirt at the bottom, meadows in the middle, and a snowy icy peak at the top with a climber in a thick jacket, clear sky'},
      {kind:'observe', title:'山上的“分层”', text:['从山脚往上爬：森林 → 草甸 → 光秃秃的岩石 → 冰雪。','这条积雪终年不化的界线，叫“雪线”。','越往上，植物越少、越矮。'],
        prompt:'a side view of a huge mountain showing clear vegetation zones in horizontal layers: dense pine forest at the bottom, alpine meadow with flowers above, bare grey rock higher, and white snow and glaciers at the top, a dotted line marking where snow begins'},
      {kind:'analogy', title:'稀薄的被子', text:['地面被太阳晒热，再把热传给贴着地面的空气。','越往高处，空气越稀薄，就像被子越来越薄，保不住热。','平均每升高 100 米，气温大约降低 0.6°C。'],
        prompt:'a cozy cartoon illustration of the Earth’s surface as a sleeping town under a thick warm blanket of air near the ground, the blanket getting thinner and more see-through higher up toward snowy mountain peaks, the sun shining, gentle and clear'},
      {kind:'experiment', title:'动手试一试', text:['拖动高度滑块往上爬，看看温度和景色的变化。','试试爬到珠穆朗玛峰的高度！'] },
      {kind:'quiz', title:'小测验', text:['用你刚学到的知识回答：'] },
      {kind:'wrap', title:'你搞懂了！', text:['海拔每升高 100 米，气温约降 0.6°C。','珠穆朗玛峰高 8848.86 米，峰顶比海边冷 50 多度。','所以高山顶上，就算夏天也会有积雪和冰川。'],
        prompt:'the summit of the tallest snowy pyramid-shaped mountain with a cloud banner trailing from the peak, glaciers below, a small team of climbers in bright jackets planting a flag without any symbols, deep blue sky'},
    ],
  },
];
export const chapterById = id => CHAPTERS.find(c=>c.id===id);
export const chapterForCard = cardId => CHAPTERS.find(c=>c.cards.includes(cardId)) || null;
export const chapterForMoment = m => {
  const k = m?.kind;
  if (k==='first-hit' || k==='big-hit') return chapterById('momentum');
  if (k==='spin-drop') return chapterById('precession');
  if (k==='dash') return chapterById('friction');
  if (k==='finish') return /出|撞|over|xtreme/i.test(`${m.title||''}${m.explain||''}`) ? chapterById('momentum') : chapterById('inertia');
  return null;
};
// Image list for pre-generation: [{chapter, n, path, prompt}]
export const BOOK_IMAGES = CHAPTERS.flatMap(c=>c.pages.map((p,i)=>p.prompt ? {chapter:c.id, n:i+1, path:`public${bookArt(c.id, i+1)}`, prompt:`${p.prompt}. ${BOOK_STYLE}`} : null).filter(Boolean));
