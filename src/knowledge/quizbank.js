import {tr} from '../i18n/index.js';
// Shared question bank: ≥4 distinct questions per concept (predict / why / real-life / spot-the-mistake / estimate).
// Every feature (review quizzes, explore gates, picture book) picks an UNSEEN question per kid via save.quizSeen.
// answer = index of the correct option. All facts follow the knowledge cards.
const TF = [tr("对"),tr("错")];
export const QUIZ_BANK = {
  'ph-momentum': [
    {id:'mom-1', fmt:'predict', q:tr("两只陀螺相撞，哪只更难被撞飞？"), options:[tr("更重的那只"),tr("更轻的那只")], answer:0, explain:tr("动量 = 质量 × 速度，越重的陀螺被撞时速度变化越小。")},
    {id:'mom-2', fmt:'why', q:tr("碰撞时两只陀螺互相推的力，哪边更大？"), options:[tr("一样大"),tr("重的那边大"),tr("轻的那边大")], answer:0, explain:tr("相互作用的力总是一样大、方向相反；只是轻的那只速度变化更大。")},
    {id:'mom-3', fmt:'life', q:tr("保龄球撞上球瓶后，为什么球还能继续往前滚？"), options:[tr("球比瓶重得多，速度只变了一点"),tr("球瓶推不动任何东西"),tr("球被地板吸住了")], answer:0, explain:tr("球的质量大，同样的冲击让它速度变化很小，所以继续往前滚。")},
    {id:'mom-4', fmt:'mistake', q:tr("小明说：“只要转得快，再轻的陀螺也撞不飞。”这句话对吗？"), options:TF, answer:1, explain:tr("被撞飞看的是平动的动量变化，和质量关系很大；轻陀螺转得再快也容易被撞开。")},
    {id:'mom-5', fmt:'estimate', q:tr("同样速度下，60 克陀螺的动量大约是 30 克陀螺的几倍？"), options:[tr("2 倍"),tr("一样"),tr("一半")], answer:0, explain:tr("动量 = 质量 × 速度，速度一样时，质量翻倍动量也翻倍。")},
  ],
  'ph-energy-convert': [
    {id:'enc-1', fmt:'why', q:tr("猛撞之后，转速为什么一下掉这么多？"), options:[tr("转动的能量变成了弹开和晃动"),tr("撞击给陀螺加了速")], answer:0, explain:tr("能量不会凭空消失：一部分转动变成了弹开的跑动、晃动，还有声音和热。")},
    {id:'enc-2', fmt:'mistake', q:tr("“撞完以后两只陀螺都转得更快了。”在没有发射器帮忙时，这可能吗？"), options:[tr("不可能"),tr("可能")], answer:0, explain:tr("碰撞不会凭空产生能量，撞完总能量只会减少（变成热、声音和晃动）。")},
    {id:'enc-3', fmt:'life', q:tr("用力拍手时手会变热、还发出声音，这和陀螺碰撞的哪一点一样？"), options:[tr("运动的能量变成了热和声音"),tr("手里有电池")], answer:0, explain:tr("碰撞时一部分动能会变成热和声音，所以陀螺撞完转速会掉。")},
    {id:'enc-4', fmt:'predict', q:tr("两只陀螺轻轻擦过和狠狠对撞，哪种转速掉得更多？"), options:[tr("狠狠对撞"),tr("轻轻擦过")], answer:0, explain:tr("撞得越猛，转动的能量越多地变成弹开、晃动、热和声音。")},
  ],
  'ph-tilt-fall': [
    {id:'tilt-1', fmt:'why', q:tr("转速变低后，陀螺为什么开始晃？"), options:[tr("角动量变小，扛不住重力"),tr("陀螺累了想休息")], answer:0, explain:tr("转得快时角动量大，重力推不倒它；转慢了，角动量不够，轴就越晃越歪。")},
    {id:'tilt-2', fmt:'life', q:tr("自行车骑得太慢时为什么容易左右晃？"), options:[tr("轮子转得慢，稳住它的角动量小了"),tr("车太重了")], answer:0, explain:tr("转得快的轮子像陀螺，有更大的角动量，更稳。")},
    {id:'tilt-3', fmt:'predict', q:tr("陀螺快停下时，它画圈（进动）会怎样？"), options:[tr("圈越画越大、越晃"),tr("圈越来越小、越来越稳")], answer:0, explain:tr("转速越低，越难抵抗重力，晃得越来越厉害，最后倒下。")},
    {id:'tilt-4', fmt:'mistake', q:tr("“陀螺倒下是因为地面突然变斜了。”对吗？"), options:TF, answer:1, explain:tr("通常是转速被摩擦和碰撞消耗掉了，角动量不够，才会倒下（Spin 停转）。")},
  ],
  'bx-xdash': [
    {id:'dash-1', fmt:'why', q:tr("X 冲刺的速度是从哪来的？"), options:[tr("它把自己的转动变成了往前冲"),tr("场地推了它一把，多给了能量")], answer:0, explain:tr("齿轮咬住齿轨，把转动变成前进。总能量没有增加，所以冲完转速会掉一些。")},
    {id:'dash-2', fmt:'predict', q:tr("冲刺完以后，陀螺的转速会怎样？"), options:[tr("变低一些"),tr("变得更高"),tr("完全不变")], answer:0, explain:tr("一部分转动变成了前进的速度，转速自然会降低。")},
    {id:'dash-3', fmt:'life', q:tr("下面哪个和 X 冲刺的原理最像？"), options:[tr("🚲 轮子在地上一转，车就往前走"),tr("🎈 气球放气往前飞")], answer:0, explain:tr("都是“转动 + 抓住地面/齿轨”变成前进。")},
    {id:'dash-4', fmt:'mistake', q:tr("“齿轨是一台马达，会给陀螺加能量。”对吗？"), options:TF, answer:1, explain:tr("齿轨不会加能量，它只是让陀螺把自己的转动换成往前冲。")},
  ],
  'ph-energy-loss': [
    {id:'loss-1', fmt:'why', q:tr("为什么陀螺最后总会停下来？"), options:[tr("摩擦和碰撞一点点吃掉了转速"),tr("陀螺规定只能转 10 秒")], answer:0, explain:tr("轴尖摩擦、空气阻力和每次碰撞都在消耗转动能量，能量用完就停了。")},
    {id:'loss-2', fmt:'life', q:tr("在桌上转一枚硬币，它为什么越转越慢？"), options:[tr("桌面摩擦和空气在消耗它的能量"),tr("硬币越转越重")], answer:0, explain:tr("和陀螺一样，摩擦和空气阻力把转动的能量变成了热。")},
    {id:'loss-3', fmt:'predict', q:tr("同一只陀螺，在光滑的盘子上和粗糙的地毯上，哪里转得更久？"), options:[tr("光滑的盘子"),tr("粗糙的地毯")], answer:0, explain:tr("越光滑摩擦越小，能量消耗越慢，转得越久。")},
    {id:'loss-4', fmt:'mistake', q:tr("“陀螺停下时，能量就消失得无影无踪了。”对吗？"), options:TF, answer:1, explain:tr("能量没有消失，而是变成了热、声音和空气的运动。")},
  ],
  'ph-inertia': [
    {id:'ine-1', fmt:'predict', q:tr("同样重的陀螺，重量放在哪里更难被弄停？"), options:[tr("外圈"),tr("中心")], answer:0, explain:tr("重量越靠外，转动惯量越大，越难被弄停。")},
    {id:'ine-2', fmt:'life', q:tr("花样滑冰运动员想转得更快，她会怎么做？"), options:[tr("把手臂收紧"),tr("把手臂张开")], answer:0, explain:tr("收紧手臂让重量靠近中心，转动惯量变小，就转得更快。")},
    {id:'ine-3', fmt:'mistake', q:tr("“把配重从外圈挪到中心，陀螺会更持久。”对吗？"), options:TF, answer:1, explain:tr("挪到中心转动惯量变小，同样的摩擦会更快把它磨停。")},
    {id:'ine-4', fmt:'why', q:tr("转动惯量大的陀螺，为什么也更难“发射”到高转速？"), options:[tr("它“转动的惰性”大，难加速也难减速"),tr("因为它更光滑")], answer:0, explain:tr("转动惯量就是转动的惰性：越大越难被改变转速，加速和减速都更难。")},
  ],
  'ph-friction-area': [
    {id:'fri-1', fmt:'predict', q:tr("哪种轴尖碰地面积最小、转速掉得最慢？"), options:[tr("尖轴"),tr("平轴")], answer:0, explain:tr("尖轴只用一个小点碰地，摩擦的力臂短，转速掉得慢。")},
    {id:'fri-2', fmt:'why', q:tr("平轴陀螺为什么喜欢满场乱跑？"), options:[tr("抓地强，转动变成了跑动"),tr("它比较轻")], answer:0, explain:tr("平轴碰地面积大、抓地强，像轮子一样把转动变成在场上跑。")},
    {id:'fri-3', fmt:'life', q:tr("哪一双鞋在冰上滑得最远？"), options:[tr("⛸️ 冰鞋"),tr("👟 运动鞋"),tr("🥾 登山靴")], answer:0, explain:tr("冰刀碰冰的面积很小、摩擦很小，所以滑得又久又远。")},
    {id:'fri-4', fmt:'mistake', q:tr("“想让陀螺转得最久，就选抓地最强的橡胶平轴。”对吗？"), options:TF, answer:1, explain:tr("抓地强摩擦也大，转速掉得快；持久要选碰地小的尖轴。")},
  ],
  'ph-gyro-stability': [
    {id:'gyr-1', fmt:'why', q:tr("陀螺转得快的时候为什么不容易倒？"), options:[tr("角动量大，重力只能让它慢慢画圈"),tr("因为地面有磁力")], answer:0, explain:tr("转得快角动量大，重力想推倒它时，它只会慢慢进动。")},
    {id:'gyr-2', fmt:'predict', q:tr("不转的陀螺立在尖上，放手后会怎样？"), options:[tr("马上倒下"),tr("一直立着")], answer:0, explain:tr("不转就没有角动量来抵抗重力，所以会倒。")},
    {id:'gyr-3', fmt:'life', q:tr("下面哪个也是靠“转起来更稳”？"), options:[tr("🚲 骑得快的自行车"),tr("🪑 四条腿的椅子")], answer:0, explain:tr("转动的车轮像陀螺一样有角动量，骑得快更稳。")},
    {id:'gyr-4', fmt:'mistake', q:tr("“转得越快，陀螺歪着画圈画得越快。”对吗？"), options:TF, answer:1, explain:tr("恰好相反：转得越快，进动（画圈）越慢、越稳。")},
  ],
  // ── geography ──
  'geo-tides': [
    {id:'tide-1', fmt:'why', q:tr("潮水一天涨落，主要是谁的引力在拉海水？"), options:[tr("月球"),tr("风"),tr("海里的大鱼")], answer:0, explain:tr("月球的引力拉着海水，大多数海边一天涨潮两次、落潮两次。")},
    {id:'tide-2', fmt:'estimate', q:tr("大多数海边一天会有几次涨潮？"), options:[tr("两次"),tr("一次"),tr("四次")], answer:0, explain:tr("地球自转一圈会经过两个“水鼓包”，所以一般一天涨潮两次。")},
    {id:'tide-3', fmt:'predict', q:tr("什么时候潮差最大（大潮）？"), options:[tr("新月和满月前后"),tr("刮大风的时候"),tr("每天中午")], answer:0, explain:tr("新月和满月前后，月球和太阳的引力排成一线，合在一起拉海水。")},
    {id:'tide-4', fmt:'life', q:tr("想走沙滩小路上小岛，应该选什么时候？"), options:[tr("落潮的时候"),tr("涨潮的时候")], answer:0, explain:tr("落潮时海水退去，沙滩小路才露出来。")},
  ],
  'geo-compass': [
    {id:'cmp-1', fmt:'predict', q:tr("你面朝北站着，右手边是哪个方向？"), options:[tr("东"),tr("西"),tr("南")], answer:0, explain:tr("面朝北：右手是东，左手是西，背后是南。")},
    {id:'cmp-2', fmt:'why', q:tr("指南针的磁针为什么总指向北？"), options:[tr("被地球的磁场拉着"),tr("因为北边风大")], answer:0, explain:tr("地球像一块大磁铁，磁针被它的磁场拉着，大致指向北。")},
    {id:'cmp-3', fmt:'predict', q:tr("你面朝东站着，背后是哪个方向？"), options:[tr("西"),tr("北"),tr("南")], answer:0, explain:tr("东和西是相反的方向。")},
    {id:'cmp-4', fmt:'mistake', q:tr("“面朝南站，左手边是东。”对吗？"), options:TF, answer:0, explain:tr("面朝南时，左手是东、右手是西。")},
  ],
  'geo-sun-direction': [
    {id:'sun-1', fmt:'predict', q:tr("在中国，中午的时候影子大概指向哪边？"), options:[tr("北"),tr("南")], answer:0, explain:tr("北半球中午太阳在南边的天空，所以影子指向北。")},
    {id:'sun-2', fmt:'why', q:tr("太阳从哪边升起？"), options:[tr("东边"),tr("西边"),tr("北边")], answer:0, explain:tr("因为地球自西向东转，我们看到太阳从东边升起、西边落下。")},
    {id:'sun-3', fmt:'predict', q:tr("傍晚太阳在西边时，你的影子朝哪边？"), options:[tr("东边"),tr("西边")], answer:0, explain:tr("影子总在背着太阳的一边。")},
    {id:'sun-4', fmt:'mistake', q:tr("“早上影子最短，中午影子最长。”对吗？"), options:TF, answer:1, explain:tr("中午太阳最高，影子最短；早晚太阳低，影子长。")},
  ],
  'geo-map-scale': [
    {id:'map-1', fmt:'estimate', q:tr("地图上 1 厘米代表 1 千米，两地相距 3 厘米，真实距离大约是？"), options:[tr("3 千米"),tr("30 千米"),tr("3 米")], answer:0, explain:tr("比例尺 1 厘米 = 1 千米，3 厘米就是 3 千米。")},
    {id:'map-2', fmt:'why', q:tr("地图上的“图例”是用来做什么的？"), options:[tr("说明每个符号代表什么"),tr("告诉你地图有多重")], answer:0, explain:tr("图例告诉你山、河、路、灯塔等符号分别是什么。")},
    {id:'map-3', fmt:'predict', q:tr("一般的地图上，上方是哪个方向？"), options:[tr("北"),tr("南"),tr("东")], answer:0, explain:tr("一般地图上北下南、左西右东（除非另有指向标）。")},
    {id:'map-4', fmt:'estimate', q:tr("比例尺 1 厘米 = 500 米，地图上量到 4 厘米，真实大约多远？"), options:[tr("2 千米"),tr("500 米"),tr("20 千米")], answer:0, explain:tr("4 × 500 米 = 2000 米 = 2 千米。")},
  ],
  'geo-coast': [
    {id:'cst-1', fmt:'why', q:tr("海边的细沙主要是怎么来的？"), options:[tr("海浪把岩石慢慢磨碎"),tr("从天上掉下来的")], answer:0, explain:tr("海浪年复一年拍打、冲刷岩石，把它们磨成了沙子。")},
    {id:'cst-2', fmt:'predict', q:tr("沙滩更容易出现在哪里？"), options:[tr("平静的海湾里"),tr("浪最猛的海角尖上")], answer:0, explain:tr("平静的海湾水流慢，沙子容易堆积成沙滩。")},
    {id:'cst-3', fmt:'why', q:tr("海边悬崖上的“海蚀拱门”是怎么来的？"), options:[tr("海浪长年冲刷出来的"),tr("人用机器挖的")], answer:0, explain:tr("海浪不断冲刷岩石，较软的部分被掏空，留下拱门的形状。")},
    {id:'cst-4', fmt:'mistake', q:tr("“海岸的样子永远不会改变。”对吗？"), options:TF, answer:1, explain:tr("海浪一直在磨岩石、搬沙子，海岸会慢慢改变。")},
  ],
  'geo-lighthouse': [
    {id:'lh-1', fmt:'why', q:tr("夜里船员怎么分辨是哪一座灯塔？"), options:[tr("看它独特的闪光节奏"),tr("看灯塔的颜色深浅")], answer:0, explain:tr("每座灯塔的闪光节奏都不一样，数一数就知道是哪座。")},
    {id:'lh-2', fmt:'predict', q:tr("灯塔通常建在哪里？"), options:[tr("危险的礁石和海角上"),tr("城市中心的广场")], answer:0, explain:tr("灯塔提醒船只躲开礁石、找到航线，所以建在海边危险处。")},
    {id:'lh-3', fmt:'why', q:tr("为什么灯塔要建得很高？"), options:[tr("让很远的船也能看到灯光"),tr("为了挡风")], answer:0, explain:tr("地球表面是弯的，灯越高，远处的船越能看到。")},
    {id:'lh-4', fmt:'mistake', q:tr("“灯塔只在白天有用。”对吗？"), options:TF, answer:1, explain:tr("灯塔最重要的工作在夜里和大雾天，用灯光给船指路。")},
  ],
  'geo-altitude-cold': [
    {id:'alt-1', fmt:'estimate', q:tr("从海边爬上 1000 米高的山顶，气温大约会怎样？"), options:[tr("降低约 6°C"),tr("升高约 6°C"),tr("不变")], answer:0, explain:tr("海拔每升高 100 米约降 0.6°C，1000 米大约降 6°C。")},
    {id:'alt-2', fmt:'mistake', q:tr("“山顶冷，是因为山顶离太阳更远。”对吗？"), options:TF, answer:1, explain:tr("山顶离太阳只近了几千米，几乎没区别；真正原因是高处空气稀薄，保不住热。")},
    {id:'alt-3', fmt:'estimate', q:tr("山脚 20°C，爬到 2000 米高，大约多少度？"), options:[tr("约 8°C"),tr("约 18°C"),tr("约 −20°C")], answer:0, explain:tr("2000 米约降 12°C，20 − 12 = 8°C。")},
    {id:'alt-4', fmt:'why', q:tr("为什么高山顶夏天也有积雪？"), options:[tr("海拔高，气温低到 0°C 以下"),tr("山顶的雪是人运上去的")], answer:0, explain:tr("越高越冷，高山顶常年低于 0°C，雪化不掉。")},
  ],
  'geo-thunderstorm': [
    {id:'ts-1', fmt:'why', q:tr("雷暴云里的闪电是怎么产生的？"), options:[tr("冰粒和水滴碰撞带电后放电"),tr("太阳光照进云里")], answer:0, explain:tr("积雨云里冰粒和水滴互相碰撞带上电，放电就是闪电。")},
    {id:'ts-2', fmt:'predict', q:tr("打雷时在山上，最安全的做法是？"), options:[tr("离开山顶和孤立的高处，躲进安全建筑"),tr("站到最高的大树下")], answer:0, explain:tr("闪电容易打在高处和孤立的大树上，要尽快离开、躲进建筑。")},
    {id:'ts-3', fmt:'why', q:tr("雷暴云为什么常常又高又厚？"), options:[tr("热而湿的空气快速上升"),tr("云被风压扁了")], answer:0, explain:tr("暖湿空气猛烈上升、冷却凝结，堆成高高的积雨云。")},
    {id:'ts-4', fmt:'mistake', q:tr("“闪电从来不会打到同一个地方两次。”对吗？"), options:TF, answer:1, explain:tr("高的地方（比如高塔）会被闪电反复击中。")},
  ],
  'geo-thunder-distance': [
    {id:'td-1', fmt:'estimate', q:tr("看到闪电后数到 3 秒才听到雷声，雷电大约有多远？"), options:[tr("约 1 千米"),tr("约 10 米"),tr("约 100 千米")], answer:0, explain:tr("声音每秒约走 340 米，3 秒约 1 千米；光几乎瞬间就到了。")},
    {id:'td-2', fmt:'why', q:tr("为什么总是先看到闪电、后听到雷声？"), options:[tr("光比声音快得多"),tr("雷声是后来才发出的")], answer:0, explain:tr("闪电和雷是同时发生的，只是光跑得比声音快得多。")},
    {id:'td-3', fmt:'estimate', q:tr("数到 6 秒才听到雷声，大约多远？"), options:[tr("约 2 千米"),tr("约 6 千米"),tr("约 600 米")], answer:0, explain:tr("6 × 340 米 ≈ 2000 米。")},
    {id:'td-4', fmt:'predict', q:tr("闪电和雷声的间隔越来越短，说明雷暴在？"), options:[tr("靠近"),tr("远离")], answer:0, explain:tr("间隔变短说明声音要走的路变短，雷暴正在靠近。")},
  ],
  'geo-snowline': [
    {id:'sl-1', fmt:'why', q:tr("冰川是怎么来的？"), options:[tr("积雪年年堆积压成冰，再慢慢往下流"),tr("海水冻住后被推上山")], answer:0, explain:tr("雪线以上积雪化不完，越积越厚被压成冰，在重力作用下慢慢流动。")},
    {id:'sl-2', fmt:'predict', q:tr("“雪线”以上是什么样子？"), options:[tr("积雪一年四季都化不完"),tr("只有冬天有雪")], answer:0, explain:tr("雪线以上气温太低，积雪终年不化。")},
    {id:'sl-3', fmt:'mistake', q:tr("“冰川是一动不动的大冰块。”对吗？"), options:TF, answer:1, explain:tr("冰川在重力作用下会慢慢往下流动，只是很慢。")},
    {id:'sl-4', fmt:'predict', q:tr("同样高的山，靠近赤道和靠近北极，哪边的雪线更低？"), options:[tr("靠近北极的"),tr("靠近赤道的")], answer:0, explain:tr("越靠近极地越冷，不用爬太高就能遇到常年积雪。")},
  ],
  'geo-contour': [
    {id:'ct-1', fmt:'why', q:tr("等高线地图上，线挤得很密的地方说明什么？"), options:[tr("山坡很陡"),tr("山坡很平"),tr("那里有河")], answer:0, explain:tr("等高线越密，同样的距离高度变化越大，坡就越陡。")},
    {id:'ct-2', fmt:'predict', q:tr("一圈圈闭合的等高线中间，通常是？"), options:[tr("山顶"),tr("山谷")], answer:0, explain:tr("越往中间越高、闭合的圈，中间一般是山顶（除非标注是洼地）。")},
    {id:'ct-3', fmt:'life', q:tr("想找一条最好爬的路，应该沿着哪里走？"), options:[tr("等高线比较稀的地方"),tr("等高线最密的地方")], answer:0, explain:tr("等高线稀，坡比较缓，爬起来更轻松。")},
    {id:'ct-4', fmt:'why', q:tr("一条等高线上的所有点有什么相同？"), options:[tr("高度一样"),tr("温度一样")], answer:0, explain:tr("等高线把同样高度的地方连成一条线。")},
  ],
  'geo-rain-shadow': [
    {id:'rs-1', fmt:'predict', q:tr("湿润的风吹向一座大山，哪一边的雨更多？"), options:[tr("迎风坡"),tr("背风坡")], answer:0, explain:tr("风在迎风坡被迫爬升、冷却下雨；翻过山后变干，背风坡少雨。")},
    {id:'rs-2', fmt:'why', q:tr("风爬山时为什么会下雨？"), options:[tr("空气上升变冷，水汽凝结成雨"),tr("山会自己喷水")], answer:0, explain:tr("空气越往上越冷，装不下那么多水汽，就凝结成云和雨。")},
    {id:'rs-3', fmt:'predict', q:tr("背风坡常常是什么样子？"), options:[tr("干燥少雨"),tr("潮湿多雾")], answer:0, explain:tr("水汽在迎风坡已经下掉了，翻过山的风很干。")},
    {id:'rs-4', fmt:'mistake', q:tr("“山的两边，雨量一定一样多。”对吗？"), options:TF, answer:1, explain:tr("迎风坡多雨、背风坡少雨，两边常常差很多。")},
  ],
  'geo-volcano': [
    {id:'vol-1', fmt:'why', q:tr("火山喷出来的东西最初来自哪里？"), options:[tr("地下深处熔化的岩石（岩浆）"),tr("山顶的积雪")], answer:0, explain:tr("地下深处的岩石熔化成岩浆，从地壳裂缝冲出地面形成火山。")},
    {id:'vol-2', fmt:'why', q:tr("岩浆为什么会往上冒？"), options:[tr("它比周围的岩石轻"),tr("被风吸上来")], answer:0, explain:tr("熔化的岩浆比周围固体岩石轻，会往上挤。")},
    {id:'vol-3', fmt:'predict', q:tr("夏威夷这样的盾状火山，山坡是什么样的？"), options:[tr("又宽又缓"),tr("又尖又陡")], answer:0, explain:tr("稀的熔岩流得很远，一层层铺开，堆成缓缓的“盾牌”形状。")},
    {id:'vol-4', fmt:'mistake', q:tr("“火山只会出现在陆地上。”对吗？"), options:TF, answer:1, explain:tr("海底也有很多火山，夏威夷群岛就是海底火山堆出来的。")},
  ],
  'geo-plates': [
    {id:'pl-1', fmt:'estimate', q:tr("地球的板块一年大约移动多远？"), options:[tr("几厘米"),tr("几千米")], answer:0, explain:tr("板块移动得很慢，每年只有几厘米。")},
    {id:'pl-2', fmt:'predict', q:tr("哪里最容易发生地震和火山？"), options:[tr("板块相撞或分开的边界"),tr("板块正中间最平的地方")], answer:0, explain:tr("板块边界受到挤压或拉伸，最容易有地震和火山。")},
    {id:'pl-3', fmt:'why', q:tr("喜马拉雅山是怎么“长”出来的？"), options:[tr("两个板块相撞挤出来的"),tr("风把沙子堆起来的")], answer:0, explain:tr("印度洋板块和亚欧板块相撞，地壳被挤高形成高山。")},
    {id:'pl-4', fmt:'life', q:tr("地球表面的板块像什么？"), options:[tr("碎成几大块的蛋壳"),tr("一整块完整的铁皮")], answer:0, explain:tr("地壳碎成几大块“板块”，它们一直在慢慢移动。")},
  ],
  'geo-hot-spring': [
    {id:'hs-1', fmt:'why', q:tr("温泉的水为什么是热的？"), options:[tr("被地下炽热的岩石加热"),tr("被太阳晒热的")], answer:0, explain:tr("雨水渗进地下被深处的热岩石加热，再冒出地面成了温泉。")},
    {id:'hs-2', fmt:'predict', q:tr("温泉多出现在哪种地方附近？"), options:[tr("火山或地热活跃的地方"),tr("沙漠中间最平的地方")], answer:0, explain:tr("地下热量多的地方，水更容易被加热冒出来。")},
    {id:'hs-3', fmt:'mistake', q:tr("“温泉的热来自太阳照在水面上。”对吗？"), options:TF, answer:1, explain:tr("温泉的热来自地下，叫地热。")},
    {id:'hs-4', fmt:'life', q:tr("下面哪个也是在利用地热？"), options:[tr("地热发电站"),tr("太阳能热水器")], answer:0, explain:tr("地热发电利用的就是地下的热量。")},
  ],
  'geo-magma-lava': [
    {id:'ml-1', fmt:'why', q:tr("岩浆喷出地面以后叫什么？"), options:[tr("熔岩"),tr("温泉"),tr("冰川")], answer:0, explain:tr("在地下叫岩浆，喷出地面叫熔岩，冷却后变成火山岩。")},
    {id:'ml-2', fmt:'predict', q:tr("熔岩流进大海会怎样？"), options:[tr("冷却变硬，变成新的陆地"),tr("一直保持液体")], answer:0, explain:tr("熔岩遇到海水迅速冷却凝固，岛屿就这样“长大”。")},
    {id:'ml-3', fmt:'mistake', q:tr("“岩浆和熔岩是两种完全不同的东西。”对吗？"), options:TF, answer:1, explain:tr("它们是同一种熔化的岩石，只是在地下和地上的叫法不同。")},
    {id:'ml-4', fmt:'predict', q:tr("熔岩冷却以后，常变成什么颜色的石头？"), options:[tr("黑色的火山岩"),tr("透明的水晶")], answer:0, explain:tr("熔岩冷却后常形成黑色的火山岩，比如玄武岩。")},
  ],
};
QUIZ_BANK['ph-impulse'] = QUIZ_BANK['ph-momentum'];
export const quizConcepts = Object.keys(QUIZ_BANK);

// seen: array of ids, oldest first (most recent at the end).
export function pickFromBank(cardId, seen=[], rnd=Math.random) {
  const list = QUIZ_BANK[cardId]; if (!list) return null;
  const s = new Set(seen), fresh = list.filter(q=>!s.has(q.id));
  if (fresh.length) return fresh[Math.floor(rnd()*fresh.length)];
  // All seen: reuse the least-recently seen one.
  let best = list[0], bi = Infinity; for (const q of list) { const i = seen.lastIndexOf(q.id); if (i < bi) { bi = i; best = q; } }
  return best;
}
// Shuffle options so the answer isn't always first.
export function shuffled(q, rnd=Math.random) {
  if (q.options === TF || q.fmt==='mistake') return {...q, options:[...q.options]};   // keep 对/错 order
  const order = q.options.map((_,i)=>i).sort(()=>rnd()-.5);
  return {...q, options:order.map(i=>q.options[i]), answer:order.indexOf(q.answer)};
}
// Is an AI-written quiz essentially a bank question the kid already saw? (same concept + same correct answer idea)
const grams = t => { const s = String(t||'').replace(/[\s，。！？、“”「」…·,.!?：:（）()]/g,''); const g = new Set(); for (let i=0;i<s.length-1;i++) g.add(s.slice(i,i+2)); return g; };
const overlap = (a, b) => { const A = grams(a), B = grams(b); if (!A.size || !B.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n++; return n/Math.min(A.size, B.size); };
export function sameAsSeen(quiz, cardId, seen=[]) {
  const list = QUIZ_BANK[cardId] || [], s = new Set(seen);
  const right = quiz?.options?.[quiz.answer];
  return list.some(b => s.has(b.id) && (overlap(b.q, quiz.q) > .45 || overlap(b.options[b.answer], right) > .5));
}
export const aiQuizId = (cardId, quiz) => `ai-${cardId}-${[...grams(quiz?.options?.[quiz?.answer]||quiz?.q)].slice(0,6).join('')}`;
// Bank questions an AI quiz is essentially the same as (seen or not) — marked seen together with it.
export function similarBankIds(quiz, cardId) {
  const right = quiz?.options?.[quiz?.answer];
  return (QUIZ_BANK[cardId]||[]).filter(b => overlap(b.q, quiz?.q) > .45 || overlap(b.options[b.answer], right) > .5).map(b=>b.id);
}
// Real-life analogy per concept, shown with the reveal (kept for wrong answers too).
export const CONCEPT_ANALOGY = {
  'ph-momentum':tr("保龄球撞球瓶：重的球继续往前，瓶子飞走了。"), 'ph-impulse':tr("保龄球撞球瓶：重的球继续往前，瓶子飞走了。"),
  'ph-energy-convert':tr("碰碰车撞完，两辆车都弹开、变慢了。"), 'ph-tilt-fall':tr("自行车骑得快很稳，骑得太慢就开始左右晃。"),
  'bx-xdash':tr("轮子在地上一转，自行车就往前走。"), 'ph-energy-loss':tr("桌上转硬币，越转越慢，最后“啪”地倒下。"),
  'ph-inertia':tr("花样滑冰张开手臂转得慢，收紧手臂转得快。"), 'ph-friction-area':tr("冰鞋在冰上滑得远，运动鞋抓地停得快。"),
  'ph-gyro-stability':tr("自行车骑得快就不容易倒。"),
};
