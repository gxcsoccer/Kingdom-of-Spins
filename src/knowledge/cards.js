import {tr, translate} from '../i18n/index.js';
// Knowledge base. layer: 'official' = real Beyblade X facts; 'physics' = general science;
// 'design' = this game's original settings / idealized simulator. Keep bodies short (≤80 chars).
// trigger: when the game should surface the card (fusion param, battle event, bit, etc.).
export const LAYER_LABEL = {official:tr("官方事实"), physics:tr("物理知识"), design:tr("游戏设定"), geo:tr("真实世界的地理")};

export const CARDS = [
  // ── Beyblade X structure (official) ──
  {id:'bx-three-parts', layer:'official', title:tr("陀螺的三大件"), tags:[tr("结构"),'blade','ratchet','bit'], trigger:'fusion.start',
    body:tr("Beyblade X 的基本陀螺由 Blade（刃）、Ratchet（棘轮）、Bit（轴尖）三部分组装而成。")},
  {id:'bx-blade-role', layer:'official', title:tr("Blade 负责碰撞"), tags:['blade',tr("攻击")], trigger:'fusion.blade',
    body:tr("Blade 在最外面，最常和对手撞在一起，形状决定从哪里撞、撞得多狠。它也是最重的部件之一。")},
  {id:'bx-ratchet-numbers', layer:'official', title:tr("3-60 是什么意思"), tags:['ratchet',tr("高度")], trigger:'fusion.ratchet',
    body:tr("Ratchet 名字像 3-60：前面的 3 是凸起（爪）的数量，后面的 60 表示高度 6.0 毫米。")},
  {id:'bx-ratchet-lock', layer:'official', title:tr("Ratchet 也管爆裂"), tags:['ratchet','burst'], trigger:'fusion.ratchet',
    body:tr("Ratchet 的爪和 Blade 卡在一起。撞得太狠时卡扣松开，陀螺就会“爆裂”散开。")},
  {id:'bx-bit-role', layer:'official', title:tr("Bit 决定怎么跑"), tags:['bit',tr("轴尖")], trigger:'fusion.bit',
    body:tr("Bit 是最下面的轴尖，只有它碰地面。它的形状决定陀螺是满场乱冲还是站在中间稳稳转。")},
  {id:'bx-xdash', layer:'official', title:tr("X Dash 极限冲刺"), tags:['bit','dash','xtreme'], trigger:'battle.dash',
    body:tr("Bit 上有一圈小齿轮。场地边缘有一条齿轨“Xtreme Line”，齿轮咬上去，陀螺就会猛地冲刺加速！")},
  {id:'bx-lockchip', layer:'official', title:tr("锁芯 Lock Chip"), tags:['cx',tr("结构")], trigger:'fusion.cx',
    body:tr("CX 系列的 Blade 能再拆开：中间有锁芯 Lock Chip，外面还有主刃和辅助刃，可以换着装。")},
  {id:'bx-cx-parts', layer:'official', title:tr("CX 可以拆刃"), tags:['cx','blade'], trigger:'fusion.cx',
    body:tr("CX（Custom Line）把 Blade 分成锁芯、主刃、辅助刃三块，换一块就能改变重量和碰撞形状。")},
  {id:'bx-finish-points', layer:'official', title:tr("四种获胜方式"), tags:[tr("规则"),tr("得分")], trigger:'battle.finish',
    body:tr("Xtreme 终结 3 分，Over 出界 2 分，Burst 爆裂 2 分，Spin 停转 1 分。")},
  {id:'bx-first-to-4', layer:'official', title:tr("先拿 4 分获胜"), tags:[tr("规则")], trigger:'battle.match',
    body:tr("正式比赛按分数算：先拿到 4 分获胜（Xtreme 3 分、Over 2 分、Spin 1 分）。陀螺王国为了让小朋友打得更快，改成了 5 局 3 胜。")},
  {id:'bx-xtreme-finish', layer:'official', title:tr("Xtreme 终结"), tags:[tr("规则"),'xtreme'], trigger:'battle.finish.xtreme',
    body:tr("把对手撞进场地正前方的 Xtreme 口袋，就是最帅的 Xtreme 终结，一次拿 3 分。")},
  {id:'bx-types', layer:'official', title:tr("四种类型"), tags:[tr("类型")], trigger:'fusion.type',
    body:tr("陀螺常分为攻击、防御、持久、平衡四种类型。没有永远最强的类型，要看对手和场地。")},
  {id:'bx-spin-direction', layer:'official', title:tr("右旋是主流"), tags:[tr("旋转")], trigger:'battle.start',
    body:tr("大部分 Beyblade X 陀螺是右旋的：从上往下看，它是逆时针转的。")},

  // ── Physics (general science) ──
  {id:'ph-inertia', layer:'physics', title:tr("转动惯量"), tags:[tr("惯量"),'ring',tr("持久")], trigger:'fusion.ring',
    body:tr("重量放得越靠外圈，转动惯量越大。它就像“转动的惰性”，越大越难被弄停，也越难被加速。")},
  {id:'ph-figure-skater', layer:'physics', title:tr("花样滑冰的秘密"), tags:[tr("惯量"),tr("角动量")], trigger:'fusion.ring',
    body:tr("滑冰运动员收紧手臂转得更快，张开手臂就慢下来。重量离中心越远，转动惯量越大。")},
  {id:'ph-angular-momentum', layer:'physics', title:tr("角动量"), tags:[tr("角动量"),tr("持久")], trigger:'battle.spin',
    body:tr("角动量 = 转动惯量 × 转速。角动量越大，陀螺越“倔强”，越能站稳不倒。")},
  {id:'ph-gyro-stability', layer:'physics', title:tr("为什么转着不会倒"), tags:[tr("稳定"),tr("进动")], trigger:'battle.tilt',
    body:tr("转得快的陀螺有很大的角动量，重力想把它推倒时，它只是慢慢画圈（进动），而不是直接倒下。")},
  {id:'ph-precession', layer:'physics', title:tr("进动：歪着画圈"), tags:[tr("倾角"),tr("进动")], trigger:'battle.tilt',
    body:tr("陀螺歪着转时，轴会慢慢绕圈，这叫进动。转速越低，进动越大，最后摇摇晃晃停下来。")},
  {id:'ph-friction-area', layer:'physics', title:tr("接触面与摩擦"), tags:[tr("摩擦"),'bit'], trigger:'fusion.bit',
    body:tr("轴尖越尖，碰地面积越小，摩擦掉的转速越少；轴尖越平，抓地越强，跑得快但转速掉得也快。")},
  {id:'ph-needle', layer:'physics', title:tr("尖轴：省力站桩"), tags:['needle',tr("持久")], trigger:'bit.needle',
    body:tr("尖轴只用一个小点碰地，摩擦力的“力臂”很短，转速掉得慢，适合持久和防守。")},
  {id:'ph-flat', layer:'physics', title:tr("平轴：抓地冲锋"), tags:['flat',tr("攻击")], trigger:'bit.flat',
    body:tr("平轴转起来像轮子在地上滚，会把转动变成满场跑动。冲得猛，但转速消耗也快。")},
  {id:'ph-rubber', layer:'physics', title:tr("橡胶为什么抓地"), tags:['rush',tr("材料"),tr("摩擦")], trigger:'bit.rush',
    body:tr("橡胶软、表面摩擦系数大，像运动鞋底一样抓地。冲刺最猛，但能量也被摩擦“吃掉”得最快。")},
  {id:'ph-com-height', layer:'physics', title:tr("重心高低"), tags:[tr("重心"),'ratchet',tr("高度")], trigger:'fusion.ratchet',
    body:tr("Ratchet 越高，陀螺重心越高，被撞时更容易被掀歪；越矮越稳，但刃的碰撞高度也跟着变。")},
  {id:'ph-momentum', layer:'physics', title:tr("动量与碰撞"), tags:[tr("碰撞"),tr("质量")], trigger:'battle.collision',
    body:tr("质量 × 速度 = 动量。两个陀螺相撞时会互相交换动量，越重越难被撞飞。")},
  {id:'ph-impulse', layer:'physics', title:tr("冲量：一瞬间的大力"), tags:[tr("碰撞"),tr("冲量")], trigger:'battle.collision',
    body:tr("碰撞只有一眨眼，但力非常大。力 × 时间就是冲量，它决定被撞的那一方速度改变多少。")},
  {id:'ph-spin-to-move', layer:'physics', title:tr("转动变跑动"), tags:[tr("碰撞"),tr("能量")], trigger:'battle.collision',
    body:tr("刃边撞到对手时，一部分转动会变成弹开的跑动。所以撞完常常两边转速都会掉一截。")},
  {id:'ph-energy-loss', layer:'physics', title:tr("能量去哪了"), tags:[tr("能量"),tr("摩擦")], trigger:'battle.spin',
    body:tr("陀螺的能量会被轴尖摩擦、空气阻力和碰撞慢慢变成热和声音。没有能量补充，它终究会停。")},
  {id:'ph-mass-tradeoff', layer:'physics', title:tr("越重越好吗"), tags:[tr("质量"),tr("取舍")], trigger:'fusion.mass',
    body:tr("更重更难被撞飞，但同样的发射力让它转得没那么快。设计就是在各种“取舍”里找平衡。")},
  {id:'ph-wall-hit', layer:'physics', title:tr("撞墙也掉转"), tags:[tr("碰撞"),tr("场地")], trigger:'battle.wall',
    body:tr("攻击型陀螺冲得太猛撞到墙，刃和墙之间的摩擦也会吃掉转速。冲得快不等于赢！")},
  {id:'ph-bowl', layer:'physics', title:tr("碗形场地"), tags:[tr("场地"),tr("重力")], trigger:'battle.start',
    body:tr("场地中间低四周高，重力会把陀螺往中间拉，所以陀螺常常绕着场地画大圈。")},

  // ── Materials ──
  {id:'mt-metal', layer:'physics', title:tr("金属更重更硬"), tags:[tr("材料"),tr("金属"),tr("质量")], trigger:'fusion.mass',
    body:tr("金属的密度比塑料大好几倍，同样大小重得多。把金属放在外圈，转动惯量会大大增加。")},
  {id:'mt-plastic', layer:'physics', title:tr("塑料：轻又好造型"), tags:[tr("材料"),tr("塑料")], trigger:'fusion.blade',
    body:tr("塑料轻、容易做成复杂形状，适合做刃的造型；但同样大小比金属轻，惯量较小。")},
  {id:'mt-density', layer:'physics', title:tr("密度是什么"), tags:[tr("材料"),tr("密度")], trigger:'fusion.mass',
    body:tr("密度就是“同样大小有多重”。铁块和泡沫一样大，铁块重得多，因为铁的密度大。")},

  // ── Scientific method ──
  {id:'sm-predict', layer:'physics', title:tr("先猜一猜"), tags:[tr("科学方法"),tr("预测")], trigger:'battle.predict',
    body:tr("科学家做实验前会先预测结果。猜错了也没关系，猜错正是发现新东西的开始！")},
  {id:'sm-one-variable', layer:'physics', title:tr("一次只改一样"), tags:[tr("科学方法"),tr("对照")], trigger:'battle.retry',
    body:tr("想知道外圈配重有没有用？只改配重，其他都不动，再比一次。改太多就不知道是谁的功劳了。")},
  {id:'sm-repeat', layer:'physics', title:tr("多比几次"), tags:[tr("科学方法"),tr("统计")], trigger:'battle.retry',
    body:tr("赢一次可能是运气。同样的设置多比几次，看大多数时候谁赢，结论才更可靠。")},

  {id:'sm-control', layer:'physics', title:tr("控制变量"), tags:[tr("科学方法"),tr("对照"),tr("变量")], trigger:'lab.start',
    body:tr("公平的实验：只改一个东西（变量），对手、发射力、场地全都不变。这样结果变了，才知道是谁的功劳。")},
  {id:'sm-sample', layer:'physics', title:tr("样本越多越可靠"), tags:[tr("科学方法"),tr("重复"),tr("统计")], trigger:'lab.result',
    body:tr("只比 1 次可能碰上运气。比 3 次、10 次，看大多数结果，就像多问几个人再下结论。")},
  {id:'sm-sensitive', layer:'physics', title:tr("差一点点，结果大不同"), tags:[tr("科学方法"),tr("混沌"),tr("碰撞")], trigger:'lab.result',
    body:tr("碰撞的位置只差一点点，后面的路线就可能完全不同，就像弹珠游戏。所以要多做几次实验看规律。")},
  {id:'ph-energy-convert', layer:'physics', title:tr("碰撞中的能量转换"), tags:[tr("能量"),tr("碰撞"),tr("转速")], trigger:'battle.collision',
    body:tr("撞击时，转动的能量会变成弹开的跑动、晃动，还有热和声音。所以猛撞之后转速常常一下掉很多。")},
  {id:'ph-launch-rpm', layer:'physics', title:tr("发射越猛角动量越大"), tags:[tr("发射"),tr("转速"),tr("角动量")], trigger:'lab.rpm',
    body:tr("发射时转得越快，角动量越大，陀螺越稳、越能熬。但能量多一倍，需要的发射力也要更大。")},
  {id:'ph-wing-contact', layer:'physics', title:tr("翼片数与碰撞"), tags:['wings',tr("碰撞"),'blade'], trigger:'lab.wings',
    body:tr("翼片少，刃边有大缺口，撞上时像拳头一样集中发力；翼片多，外形更圆，撞击更像擦过去。")},
  {id:'ph-tilt-fall', layer:'physics', title:tr("转速低了就会倒"), tags:[tr("倾角"),tr("转速"),tr("停转")], trigger:'battle.spin',
    body:tr("转速越来越低，角动量不够抵抗重力，陀螺就越晃越歪，最后倒下——这就是 Spin 停转。")},
  // ── Real-world geography (layer 'geo'; kid-level but factually correct). region: where the explorer uses it ──
  {id:'geo-tides', layer:'geo', region:'harbor', title:tr("潮汐和月亮"), tags:[tr("潮汐"),tr("月球"),tr("海")], trigger:'explore.harbor',
    body:tr("月球的引力拉着海水，地球转一圈，大多数海边一天会涨潮两次、落潮两次。落潮时才能看到礁石和潮池。")},
  {id:'geo-compass', layer:'geo', region:'harbor', title:tr("指南针指向哪里"), tags:[tr("方向"),tr("指南针"),tr("北")], trigger:'explore.harbor',
    body:tr("指南针的磁针被地球磁场拉着，一头总是大致指向北。面朝北时，右手边是东，左手边是西，背后是南。")},
  {id:'geo-sun-direction', layer:'geo', region:'harbor', title:tr("太阳认方向"), tags:[tr("方向"),tr("太阳"),tr("东")], trigger:'explore.harbor',
    body:tr("太阳从东边升起、西边落下。在中国（北半球）中午时，太阳在南边的天空，影子指向北。")},
  {id:'geo-map-scale', layer:'geo', region:'harbor', title:tr("比例尺和图例"), tags:[tr("地图"),tr("比例尺"),tr("图例")], trigger:'explore.harbor',
    body:tr("比例尺告诉你地图上 1 厘米代表真实的多远；图例告诉你每个符号是什么。地图上一般上北下南、左西右东。")},
  {id:'geo-coast', layer:'geo', region:'harbor', title:tr("海岸的样子"), tags:[tr("海岸"),tr("沙滩"),tr("海湾"),tr("礁石")], trigger:'explore.harbor',
    body:tr("海浪把岩石慢慢磨碎成沙，在平静的海湾里堆成沙滩；坚硬的岩石留下来，变成礁石和海边的悬崖。")},
  {id:'geo-lighthouse', layer:'geo', region:'harbor', title:tr("灯塔为船指路"), tags:[tr("灯塔"),tr("航海")], trigger:'explore.harbor',
    body:tr("灯塔建在礁石和海角上，夜里按固定节奏闪光。每座灯塔闪法不同，船员数一数就知道自己在哪、该躲开哪里。")},
  {id:'geo-altitude-cold', layer:'geo', region:'thunder', title:tr("越高越冷"), tags:[tr("海拔"),tr("温度"),tr("山")], trigger:'explore.thunder',
    body:tr("在对流层里，海拔每升高 100 米，气温平均大约降低 0.6°C。所以高山顶上就算夏天也可能有积雪。")},
  {id:'geo-thunderstorm', layer:'geo', region:'thunder', title:tr("雷暴是怎么来的"), tags:[tr("雷"),tr("闪电"),tr("云")], trigger:'explore.thunder',
    body:tr("热而湿的空气快速上升，冷却后凝结成高高的积雨云。云里的冰粒和水滴互相碰撞带上电，放电就是闪电和雷声。")},
  {id:'geo-thunder-distance', layer:'geo', region:'thunder', title:tr("数秒算雷有多远"), tags:[tr("雷"),tr("声音"),tr("光")], trigger:'explore.thunder',
    body:tr("光几乎瞬间到达，声音每秒只走约 340 米。看到闪电后数到 3 秒听到雷声，雷电大约在 1 公里外。")},
  {id:'geo-snowline', layer:'geo', region:'thunder', title:tr("雪线和冰川"), tags:[tr("雪线"),tr("冰川"),tr("冰")], trigger:'explore.thunder',
    body:tr("雪线以上，积雪一年四季都化不完。雪越积越厚被压成冰，在重力作用下慢慢往山下流，这就是冰川。")},
  {id:'geo-contour', layer:'geo', region:'thunder', title:tr("等高线地图"), tags:[tr("等高线"),tr("地图"),tr("山")], trigger:'explore.thunder',
    body:tr("等高线把同样高度的地方连成线。线挤得越密，山坡越陡；线越稀，坡越缓。一圈圈闭合的线中间通常是山顶。")},
  {id:'geo-rain-shadow', layer:'geo', region:'thunder', title:tr("迎风坡和背风坡"), tags:[tr("降雨"),tr("风"),tr("山")], trigger:'explore.thunder',
    body:tr("湿润的风吹到山前被迫爬升，冷却后下雨，迎风坡雨多树多；翻过山的风变干了，背风坡就干燥少雨。")},
  {id:'geo-volcano', layer:'geo', region:'volcano', title:tr("火山怎么形成"), tags:[tr("火山"),tr("岩浆")], trigger:'explore.volcano',
    body:tr("地下深处的岩石熔化成岩浆，岩浆比周围的岩石轻，会往上挤。它从地壳的裂缝冲出地面，就形成了火山。")},
  {id:'geo-plates', layer:'geo', region:'volcano', title:tr("地球的板块"), tags:[tr("板块"),tr("地震"),tr("火山")], trigger:'explore.volcano',
    body:tr("地球表面像碎成几大块的蛋壳，叫板块。板块每年只移动几厘米，它们相撞或分开的地方最容易有火山和地震。")},
  {id:'geo-hot-spring', layer:'geo', region:'volcano', title:tr("温泉为什么是热的"), tags:[tr("温泉"),tr("地热")], trigger:'explore.volcano',
    body:tr("雨水渗进地下，被深处炽热的岩石加热，再沿着裂缝冒出地面，就成了温泉。这种来自地下的热叫地热。")},
  {id:'geo-magma-lava', layer:'geo', region:'volcano', title:tr("岩浆和熔岩"), tags:[tr("岩浆"),tr("熔岩"),tr("火山")], trigger:'explore.volcano',
    body:tr("在地下时叫岩浆，喷出地面后就叫熔岩。熔岩冷却变硬，会变成黑色的火山岩，比如玄武岩。")},

  // ── Game design (original settings / idealized model) ──
  {id:'gd-fusion-blade-only', layer:'design', title:tr("融合只换 Blade"), tags:[tr("融合")], trigger:'fusion.start',
    body:tr("在陀螺王国里，融合只会创造新的 Blade；Ratchet 和 Bit 保持原样，从你选的那只陀螺继承。")},
  {id:'gd-fusion-names', layer:'design', title:tr("融合起名"), tags:[tr("融合"),tr("名字")], trigger:'fusion.name',
    body:tr("融合的名字由两个名字拼起来：Fish + Dragoon = Fishgoon，GoatPuff + NinjaMight = NinjaPuff。")},
  {id:'gd-ideal-model', layer:'design', title:tr("这是理想化模型"), tags:[tr("模型"),tr("模拟")], trigger:'battle.result',
    body:tr("游戏里的对战用真实物理公式计算，但陀螺形状是简化的，也没和真陀螺对比校准，结果只代表这个模型。")},
  {id:'gd-ring-slider', layer:'design', title:tr("外圈配重比例"), tags:['ring',tr("惯量")], trigger:'fusion.ring',
    body:tr("游戏里的“外圈配重”表示刃的重量有多少放在最外圈。比例越高，计算出的转动惯量越大。")},
  {id:'gd-wings', layer:'design', title:tr("刃的翼片数量"), tags:['blade','wings'], trigger:'fusion.wings',
    body:tr("翼片少，每片更宽，撞击集中；翼片多，外形更圆，碰撞更平滑。这是游戏里简化的刃形状。")},
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map(c=>[c.id,c]));
export const getCard = id => CARD_BY_ID[id] || null;
export const cardsByTrigger = prefix => CARDS.filter(c=>c.trigger===prefix||c.trigger.startsWith(prefix+'.'));

// Pick cards relevant to free text / tags (simple keyword scoring, used for grounding prompts).
const KEYWORDS = {
  'ph-inertia':[tr("惯量"),tr("外圈"),tr("配重"),'ring',tr("持久"),tr("久")], 'ph-figure-skater':[tr("滑冰"),tr("外圈"),tr("惯量")],
  'ph-angular-momentum':[tr("角动量"),tr("稳"),tr("倔")], 'ph-gyro-stability':[tr("倒"),tr("稳"),tr("不倒")], 'ph-precession':[tr("歪"),tr("晃"),tr("进动"),tr("倾")],
  'ph-friction-area':[tr("摩擦"),tr("轴尖"),'bit',tr("尖"),tr("平")], 'ph-needle':[tr("尖轴"),'needle',tr("持久"),tr("站")], 'ph-flat':[tr("平轴"),'flat',tr("冲"),tr("快"),tr("跑")],
  'ph-rubber':[tr("橡胶"),'rush',tr("冲刺"),tr("抓地")], 'ph-com-height':[tr("重心"),tr("高度"),'ratchet',tr("矮"),tr("高")], 'ph-momentum':[tr("动量"),tr("撞"),tr("碰撞"),tr("重")],
  'ph-impulse':[tr("冲量"),tr("撞"),tr("力")], 'ph-spin-to-move':[tr("撞"),tr("弹"),tr("转速")], 'ph-energy-loss':[tr("能量"),tr("停"),tr("摩擦")],
  'ph-mass-tradeoff':[tr("重"),tr("轻"),tr("质量")], 'ph-wall-hit':[tr("墙"),tr("撞墙")], 'mt-metal':[tr("金属"),tr("铁"),tr("重"),tr("钢")],
  'mt-plastic':[tr("塑料"),tr("轻")], 'mt-density':[tr("密度")], 'bx-xdash':['dash',tr("冲刺"),tr("齿轮"),tr("齿轨"),tr("极限")],
  'bx-finish-points':[tr("得分"),tr("分"),'xtreme',tr("出界"),tr("爆裂"),tr("停转")], 'bx-ratchet-numbers':['3-60','ratchet',tr("棘轮"),tr("高度")],
  'bx-three-parts':['blade','ratchet','bit',tr("部件"),tr("组装")], 'bx-types':[tr("攻击"),tr("防御"),tr("持久"),tr("平衡"),tr("类型")],
  'bx-cx-parts':['cx',tr("锁芯"),tr("拆")], 'sm-one-variable':[tr("变量"),tr("对照"),tr("改")], 'sm-control':[tr("变量"),tr("对照"),tr("公平"),tr("控制")], 'sm-sample':[tr("重复"),tr("多次"),tr("样本"),tr("运气")], 'sm-sensitive':[tr("敏感"),tr("运气"),tr("不一样"),tr("混沌")], 'ph-energy-convert':[tr("能量"),tr("撞"),tr("转速"),tr("掉")], 'ph-launch-rpm':[tr("发射"),tr("转速"),'rpm'], 'ph-wing-contact':[tr("翼"),tr("翼片"),'wings'], 'ph-tilt-fall':[tr("倒"),tr("停转"),tr("歪")], 'geo-tides':[tr("潮"),tr("月亮"),tr("海水")], 'geo-compass':[tr("指南针"),tr("方向"),tr("北"),tr("东"),tr("西"),tr("南")], 'geo-altitude-cold':[tr("海拔"),tr("山顶"),tr("冷"),tr("温度")], 'geo-thunderstorm':[tr("雷"),tr("闪电"),tr("云")], 'geo-volcano':[tr("火山"),tr("岩浆")], 'geo-contour':[tr("等高线")], 'geo-lighthouse':[tr("灯塔")], 'sm-predict':[tr("预测"),tr("猜")],
  'gd-fusion-blade-only':[tr("融合")], 'gd-ideal-model':[tr("真实"),tr("模型"),tr("真的")],
};
export function relevantCards(text='', n=6) {
  const t=String(text).toLowerCase();
  const scored=CARDS.map(c=>{
    let s=0;
    for(const k of KEYWORDS[c.id]||[]) if([k,translate(k,[],'en')].some(word=>{const w=word.toLowerCase();return /[\u3400-\u9fff]/.test(w)?t.includes(w):(' '+t.replace(/[^a-z0-9 -]/g,' ')+' ').includes(' '+w+' ');})) s+=2;
    for(const k of c.tags) if(t.includes(String(k).toLowerCase())) s+=1;
    if(t.includes(c.title)) s+=3;
    return [s,c];
  }).filter(([s])=>s>0).sort((a,b)=>b[0]-a[0]).map(([,c])=>c);
  return scored.slice(0,n);
}
