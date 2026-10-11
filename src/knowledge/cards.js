// Knowledge base. layer: 'official' = real Beyblade X facts; 'physics' = general science;
// 'design' = this game's original settings / idealized simulator. Keep bodies short (≤80 chars).
// trigger: when the game should surface the card (fusion param, battle event, bit, etc.).
export const LAYER_LABEL = {official:'官方事实', physics:'物理知识', design:'游戏设定'};

export const CARDS = [
  // ── Beyblade X structure (official) ──
  {id:'bx-three-parts', layer:'official', title:'陀螺的三大件', tags:['结构','blade','ratchet','bit'], trigger:'fusion.start',
    body:'Beyblade X 的基本陀螺由 Blade（刃）、Ratchet（棘轮）、Bit（轴尖）三部分组装而成。'},
  {id:'bx-blade-role', layer:'official', title:'Blade 负责碰撞', tags:['blade','攻击'], trigger:'fusion.blade',
    body:'Blade 在最外面，最常和对手撞在一起，形状决定从哪里撞、撞得多狠。它也是最重的部件之一。'},
  {id:'bx-ratchet-numbers', layer:'official', title:'3-60 是什么意思', tags:['ratchet','高度'], trigger:'fusion.ratchet',
    body:'Ratchet 名字像 3-60：前面的 3 是凸起（爪）的数量，后面的 60 表示高度 6.0 毫米。'},
  {id:'bx-ratchet-lock', layer:'official', title:'Ratchet 也管爆裂', tags:['ratchet','burst'], trigger:'fusion.ratchet',
    body:'Ratchet 的爪和 Blade 卡在一起。撞得太狠时卡扣松开，陀螺就会“爆裂”散开。'},
  {id:'bx-bit-role', layer:'official', title:'Bit 决定怎么跑', tags:['bit','轴尖'], trigger:'fusion.bit',
    body:'Bit 是最下面的轴尖，只有它碰地面。它的形状决定陀螺是满场乱冲还是站在中间稳稳转。'},
  {id:'bx-xdash', layer:'official', title:'X Dash 极限冲刺', tags:['bit','dash','xtreme'], trigger:'battle.dash',
    body:'Bit 上有一圈小齿轮。场地边缘有一条齿轨“Xtreme Line”，齿轮咬上去，陀螺就会猛地冲刺加速！'},
  {id:'bx-lockchip', layer:'official', title:'锁芯 Lock Chip', tags:['cx','结构'], trigger:'fusion.cx',
    body:'CX 系列的 Blade 能再拆开：中间有锁芯 Lock Chip，外面还有主刃和辅助刃，可以换着装。'},
  {id:'bx-cx-parts', layer:'official', title:'CX 可以拆刃', tags:['cx','blade'], trigger:'fusion.cx',
    body:'CX（Custom Line）把 Blade 分成锁芯、主刃、辅助刃三块，换一块就能改变重量和碰撞形状。'},
  {id:'bx-finish-points', layer:'official', title:'四种获胜方式', tags:['规则','得分'], trigger:'battle.finish',
    body:'Xtreme 终结 3 分，Over 出界 2 分，Burst 爆裂 2 分，Spin 停转 1 分。'},
  {id:'bx-first-to-4', layer:'official', title:'先拿 4 分获胜', tags:['规则'], trigger:'battle.match',
    body:'正式对战里，先拿到 4 分的一方赢下整场比赛，所以一次 Xtreme 终结就差不多赢了一大半！'},
  {id:'bx-xtreme-finish', layer:'official', title:'Xtreme 终结', tags:['规则','xtreme'], trigger:'battle.finish.xtreme',
    body:'把对手撞进场地正前方的 Xtreme 口袋，就是最帅的 Xtreme 终结，一次拿 3 分。'},
  {id:'bx-types', layer:'official', title:'四种类型', tags:['类型'], trigger:'fusion.type',
    body:'陀螺常分为攻击、防御、持久、平衡四种类型。没有永远最强的类型，要看对手和场地。'},
  {id:'bx-spin-direction', layer:'official', title:'右旋是主流', tags:['旋转'], trigger:'battle.start',
    body:'大部分 Beyblade X 陀螺是右旋的：从上往下看，它是逆时针转的。'},

  // ── Physics (general science) ──
  {id:'ph-inertia', layer:'physics', title:'转动惯量', tags:['惯量','ring','持久'], trigger:'fusion.ring',
    body:'重量放得越靠外圈，转动惯量越大。它就像“转动的惰性”，越大越难被弄停，也越难被加速。'},
  {id:'ph-figure-skater', layer:'physics', title:'花样滑冰的秘密', tags:['惯量','角动量'], trigger:'fusion.ring',
    body:'滑冰运动员收紧手臂转得更快，张开手臂就慢下来。重量离中心越远，转动惯量越大。'},
  {id:'ph-angular-momentum', layer:'physics', title:'角动量', tags:['角动量','持久'], trigger:'battle.spin',
    body:'角动量 = 转动惯量 × 转速。角动量越大，陀螺越“倔强”，越能站稳不倒。'},
  {id:'ph-gyro-stability', layer:'physics', title:'为什么转着不会倒', tags:['稳定','进动'], trigger:'battle.tilt',
    body:'转得快的陀螺有很大的角动量，重力想把它推倒时，它只是慢慢画圈（进动），而不是直接倒下。'},
  {id:'ph-precession', layer:'physics', title:'进动：歪着画圈', tags:['倾角','进动'], trigger:'battle.tilt',
    body:'陀螺歪着转时，轴会慢慢绕圈，这叫进动。转速越低，进动越大，最后摇摇晃晃停下来。'},
  {id:'ph-friction-area', layer:'physics', title:'接触面与摩擦', tags:['摩擦','bit'], trigger:'fusion.bit',
    body:'轴尖越尖，碰地面积越小，摩擦掉的转速越少；轴尖越平，抓地越强，跑得快但转速掉得也快。'},
  {id:'ph-needle', layer:'physics', title:'尖轴：省力站桩', tags:['needle','持久'], trigger:'bit.needle',
    body:'尖轴只用一个小点碰地，摩擦力的“力臂”很短，转速掉得慢，适合持久和防守。'},
  {id:'ph-flat', layer:'physics', title:'平轴：抓地冲锋', tags:['flat','攻击'], trigger:'bit.flat',
    body:'平轴转起来像轮子在地上滚，会把转动变成满场跑动。冲得猛，但转速消耗也快。'},
  {id:'ph-rubber', layer:'physics', title:'橡胶为什么抓地', tags:['rush','材料','摩擦'], trigger:'bit.rush',
    body:'橡胶软、表面摩擦系数大，像运动鞋底一样抓地。冲刺最猛，但能量也被摩擦“吃掉”得最快。'},
  {id:'ph-com-height', layer:'physics', title:'重心高低', tags:['重心','ratchet','高度'], trigger:'fusion.ratchet',
    body:'Ratchet 越高，陀螺重心越高，被撞时更容易被掀歪；越矮越稳，但刃的碰撞高度也跟着变。'},
  {id:'ph-momentum', layer:'physics', title:'动量与碰撞', tags:['碰撞','质量'], trigger:'battle.collision',
    body:'质量 × 速度 = 动量。两个陀螺相撞时会互相交换动量，越重越难被撞飞。'},
  {id:'ph-impulse', layer:'physics', title:'冲量：一瞬间的大力', tags:['碰撞','冲量'], trigger:'battle.collision',
    body:'碰撞只有一眨眼，但力非常大。力 × 时间就是冲量，它决定被撞的那一方速度改变多少。'},
  {id:'ph-spin-to-move', layer:'physics', title:'转动变跑动', tags:['碰撞','能量'], trigger:'battle.collision',
    body:'刃边撞到对手时，一部分转动会变成弹开的跑动。所以撞完常常两边转速都会掉一截。'},
  {id:'ph-energy-loss', layer:'physics', title:'能量去哪了', tags:['能量','摩擦'], trigger:'battle.spin',
    body:'陀螺的能量会被轴尖摩擦、空气阻力和碰撞慢慢变成热和声音。没有能量补充，它终究会停。'},
  {id:'ph-mass-tradeoff', layer:'physics', title:'越重越好吗', tags:['质量','取舍'], trigger:'fusion.mass',
    body:'更重更难被撞飞，但同样的发射力让它转得没那么快。设计就是在各种“取舍”里找平衡。'},
  {id:'ph-wall-hit', layer:'physics', title:'撞墙也掉转', tags:['碰撞','场地'], trigger:'battle.wall',
    body:'攻击型陀螺冲得太猛撞到墙，刃和墙之间的摩擦也会吃掉转速。冲得快不等于赢！'},
  {id:'ph-bowl', layer:'physics', title:'碗形场地', tags:['场地','重力'], trigger:'battle.start',
    body:'场地中间低四周高，重力会把陀螺往中间拉，所以陀螺常常绕着场地画大圈。'},

  // ── Materials ──
  {id:'mt-metal', layer:'physics', title:'金属更重更硬', tags:['材料','金属','质量'], trigger:'fusion.mass',
    body:'金属的密度比塑料大好几倍，同样大小重得多。把金属放在外圈，转动惯量会大大增加。'},
  {id:'mt-plastic', layer:'physics', title:'塑料：轻又好造型', tags:['材料','塑料'], trigger:'fusion.blade',
    body:'塑料轻、容易做成复杂形状，适合做刃的造型；但同样大小比金属轻，惯量较小。'},
  {id:'mt-density', layer:'physics', title:'密度是什么', tags:['材料','密度'], trigger:'fusion.mass',
    body:'密度就是“同样大小有多重”。铁块和泡沫一样大，铁块重得多，因为铁的密度大。'},

  // ── Scientific method ──
  {id:'sm-predict', layer:'physics', title:'先猜一猜', tags:['科学方法','预测'], trigger:'battle.predict',
    body:'科学家做实验前会先预测结果。猜错了也没关系，猜错正是发现新东西的开始！'},
  {id:'sm-one-variable', layer:'physics', title:'一次只改一样', tags:['科学方法','对照'], trigger:'battle.retry',
    body:'想知道外圈配重有没有用？只改配重，其他都不动，再比一次。改太多就不知道是谁的功劳了。'},
  {id:'sm-repeat', layer:'physics', title:'多比几次', tags:['科学方法','统计'], trigger:'battle.retry',
    body:'赢一次可能是运气。同样的设置多比几次，看大多数时候谁赢，结论才更可靠。'},

  {id:'sm-control', layer:'physics', title:'控制变量', tags:['科学方法','对照','变量'], trigger:'lab.start',
    body:'公平的实验：只改一个东西（变量），对手、发射力、场地全都不变。这样结果变了，才知道是谁的功劳。'},
  {id:'sm-sample', layer:'physics', title:'样本越多越可靠', tags:['科学方法','重复','统计'], trigger:'lab.result',
    body:'只比 1 次可能碰上运气。比 3 次、10 次，看大多数结果，就像多问几个人再下结论。'},
  {id:'sm-sensitive', layer:'physics', title:'差一点点，结果大不同', tags:['科学方法','混沌','碰撞'], trigger:'lab.result',
    body:'碰撞的位置只差一点点，后面的路线就可能完全不同，就像弹珠游戏。所以要多做几次实验看规律。'},
  {id:'ph-energy-convert', layer:'physics', title:'碰撞中的能量转换', tags:['能量','碰撞','转速'], trigger:'battle.collision',
    body:'撞击时，转动的能量会变成弹开的跑动、晃动，还有热和声音。所以猛撞之后转速常常一下掉很多。'},
  {id:'ph-launch-rpm', layer:'physics', title:'发射越猛角动量越大', tags:['发射','转速','角动量'], trigger:'lab.rpm',
    body:'发射时转得越快，角动量越大，陀螺越稳、越能熬。但能量多一倍，需要的发射力也要更大。'},
  {id:'ph-wing-contact', layer:'physics', title:'翼片数与碰撞', tags:['wings','碰撞','blade'], trigger:'lab.wings',
    body:'翼片少，刃边有大缺口，撞上时像拳头一样集中发力；翼片多，外形更圆，撞击更像擦过去。'},
  {id:'ph-tilt-fall', layer:'physics', title:'转速低了就会倒', tags:['倾角','转速','停转'], trigger:'battle.spin',
    body:'转速越来越低，角动量不够抵抗重力，陀螺就越晃越歪，最后倒下——这就是 Spin 停转。'},
  // ── Game design (original settings / idealized model) ──
  {id:'gd-fusion-blade-only', layer:'design', title:'融合只换 Blade', tags:['融合'], trigger:'fusion.start',
    body:'在陀螺王国里，融合只会创造新的 Blade；Ratchet 和 Bit 保持原样，从你选的那只陀螺继承。'},
  {id:'gd-fusion-names', layer:'design', title:'融合起名', tags:['融合','名字'], trigger:'fusion.name',
    body:'融合的名字由两个名字拼起来：Fish + Dragoon = Fishgoon，GoatPuff + NinjaMight = NinjaPuff。'},
  {id:'gd-ideal-model', layer:'design', title:'这是理想化模型', tags:['模型','模拟'], trigger:'battle.result',
    body:'游戏里的对战用真实物理公式计算，但陀螺形状是简化的，也没和真陀螺对比校准，结果只代表这个模型。'},
  {id:'gd-ring-slider', layer:'design', title:'外圈配重比例', tags:['ring','惯量'], trigger:'fusion.ring',
    body:'游戏里的“外圈配重”表示刃的重量有多少放在最外圈。比例越高，计算出的转动惯量越大。'},
  {id:'gd-wings', layer:'design', title:'刃的翼片数量', tags:['blade','wings'], trigger:'fusion.wings',
    body:'翼片少，每片更宽，撞击集中；翼片多，外形更圆，碰撞更平滑。这是游戏里简化的刃形状。'},
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map(c=>[c.id,c]));
export const getCard = id => CARD_BY_ID[id] || null;
export const cardsByTrigger = prefix => CARDS.filter(c=>c.trigger===prefix||c.trigger.startsWith(prefix+'.'));

// Pick cards relevant to free text / tags (simple keyword scoring, used for grounding prompts).
const KEYWORDS = {
  'ph-inertia':['惯量','外圈','配重','ring','持久','久'], 'ph-figure-skater':['滑冰','外圈','惯量'],
  'ph-angular-momentum':['角动量','稳','倔'], 'ph-gyro-stability':['倒','稳','不倒'], 'ph-precession':['歪','晃','进动','倾'],
  'ph-friction-area':['摩擦','轴尖','bit','尖','平'], 'ph-needle':['尖轴','needle','持久','站'], 'ph-flat':['平轴','flat','冲','快','跑'],
  'ph-rubber':['橡胶','rush','冲刺','抓地'], 'ph-com-height':['重心','高度','ratchet','矮','高'], 'ph-momentum':['动量','撞','碰撞','重'],
  'ph-impulse':['冲量','撞','力'], 'ph-spin-to-move':['撞','弹','转速'], 'ph-energy-loss':['能量','停','摩擦'],
  'ph-mass-tradeoff':['重','轻','质量'], 'ph-wall-hit':['墙','撞墙'], 'mt-metal':['金属','铁','重','钢'],
  'mt-plastic':['塑料','轻'], 'mt-density':['密度'], 'bx-xdash':['dash','冲刺','齿轮','齿轨','极限'],
  'bx-finish-points':['得分','分','xtreme','出界','爆裂','停转'], 'bx-ratchet-numbers':['3-60','ratchet','棘轮','高度'],
  'bx-three-parts':['blade','ratchet','bit','部件','组装'], 'bx-types':['攻击','防御','持久','平衡','类型'],
  'bx-cx-parts':['cx','锁芯','拆'], 'sm-one-variable':['变量','对照','改'], 'sm-control':['变量','对照','公平','控制'], 'sm-sample':['重复','多次','样本','运气'], 'sm-sensitive':['敏感','运气','不一样','混沌'], 'ph-energy-convert':['能量','撞','转速','掉'], 'ph-launch-rpm':['发射','转速','rpm'], 'ph-wing-contact':['翼','翼片','wings'], 'ph-tilt-fall':['倒','停转','歪'], 'sm-predict':['预测','猜'],
  'gd-fusion-blade-only':['融合'], 'gd-ideal-model':['真实','模型','真的'],
};
export function relevantCards(text='', n=6) {
  const t=String(text).toLowerCase();
  const scored=CARDS.map(c=>{
    let s=0;
    for(const k of KEYWORDS[c.id]||[]) if(t.includes(k.toLowerCase())) s+=2;
    for(const k of c.tags) if(t.includes(String(k).toLowerCase())) s+=1;
    if(t.includes(c.title)) s+=3;
    return [s,c];
  }).filter(([s])=>s>0).sort((a,b)=>b[0]-a[0]).map(([,c])=>c);
  return scored.slice(0,n);
}
