import {tr} from '../i18n/index.js';
// Chapter ⑤ quizzes: test the hands-on experiment's own model and numbers (same formulas as experiments.jsx).
const r1 = x => Math.round(x*10)/10;
const LAB = {
  momentum: () => {
    const v = (mA, mB, e) => ({vA:(mA-e*mB)/(mA+mB), vB:(1+e)*mA/(mA+mB)});
    const a = v(30, 60, .7), b = v(60, 30, .7);
    return [
      {id:'lab-mom-30-60', q:tr("A 30 克撞向静止的 B 60 克（恢复系数 e=0.7），撞完 A 会怎样？"), options:[tr("弹回来"),tr("继续往前"),tr("原地停住")], answer:a.vA<-.02?0:a.vA>.02?1:2,
        explain:tr("在实验的模型里，A 撞完的速度是 {0}（负数表示弹回）：轻的撞重的，会被弹回来。", [r1(a.vA)])},
      {id:'lab-mom-60-30', q:tr("A 60 克撞向静止的 B 30 克（e=0.7），撞完谁跑得更快？"), options:['B','A',tr("一样快")], answer:b.vB>b.vA?0:1,
        explain:tr("撞完 A 约 {0}、B 约 {1}（撞前 A = 1.0）：轻的 B 被撞得飞快。", [r1(b.vA), r1(b.vB)])},
      {id:'lab-mom-equal-e1', q:tr("A 40 克撞向静止的 B 40 克，把 e 调到 1（完全弹性），撞完 A 会？"), options:[tr("几乎停住，B 带着全部速度跑走"),tr("和 B 一起慢慢走"),tr("弹回来")], answer:0,
        explain:tr("一样重、完全弹性时，A 把速度全部交给 B，自己停下——就像台球正面撞台球。")},
      {id:'lab-mom-stick', q:tr("把 e 调到 0（撞完粘在一起），A 30 克撞静止的 B 30 克，撞完一起走的速度是？"), options:[tr("原来的一半"),tr("和原来一样"),tr("变成 0")], answer:0,
        explain:tr("动量守恒：30×1 = (30+30)×v，所以 v = 0.5，是原来的一半。")},
      {id:'lab-mom-total', q:tr("在实验里，撞前和撞后两只陀螺加起来的总动量会怎样？"), options:[tr("几乎不变"),tr("变成 0"),tr("翻倍")], answer:0,
        explain:tr("碰撞中总动量守恒；损失的是动能（变成声音、热和晃动），所以 e<1。")},
    ];
  },
  inertia: () => {
    const I = n => 1 + n*2 + (6-n)*.5*441/400;   // same as the lab: n weights on the rim, the rest near the center
    const t = n => I(n);                           // stop time ∝ I (same launch speed, same friction torque)
    return [
      {id:'lab-ine-6-0', q:tr("A 的 6 块配重都在外圈，B 的都在中心，同样转速发射，谁先停？"), options:[tr("B 先停"),tr("A 先停"),tr("同时停")], answer:0,
        explain:tr("A 的转动惯量约 {0}，B 约 {1}；惯量小的 B 被同样的摩擦更快磨停。", [r1(I(6)), r1(I(0))])},
      {id:'lab-ine-3-6', q:tr("A 外圈 3 块、中心 3 块；B 外圈 6 块。谁转得更久？"), options:['B','A',tr("一样久")], answer:0,
        explain:tr("B 的转动惯量约 {0}，比 A 的约 {1} 大，所以转得更久。", [r1(I(6)), r1(I(3))])},
      {id:'lab-ine-ratio', q:tr("实验里，全外圈的陀螺大约能比全中心的多转几倍时间？"), options:[tr("约 {0} 倍", [Math.round(t(6)/t(0))]),tr("一样久"),tr("约一半")], answer:0,
        explain:tr("停下时间和转动惯量成正比：{0} ÷ {1} ≈ {2}。", [r1(I(6)), r1(I(0)), r1(t(6)/t(0))])},
      {id:'lab-ine-move', q:tr("把 A 的配重从外圈全部挪到中心，它的转动惯量会？"), options:[tr("变小"),tr("变大"),tr("不变")], answer:0,
        explain:tr("重量离中心越近，转动惯量越小，也就越快被摩擦磨停。")},
    ];
  },
  friction: () => {
    const arm = {needle:.35, ball:.9, flat:2}, time = k => 10/(arm[k]*1.8);
    return [
      {id:'lab-fri-first', q:tr("三种轴尖一起转，谁最先停下？"), options:[tr("平轴"),tr("尖轴"),tr("圆轴")], answer:0,
        explain:tr("平轴摩擦的力臂最长，转速掉得最快。")},
      {id:'lab-fri-ratio', q:tr("实验里，尖轴大约能转平轴的几倍时间？"), options:[tr("约 {0} 倍", [Math.round(time('needle')/time('flat'))]),tr("一样久"),tr("约一半")], answer:0,
        explain:tr("尖轴约 {0} 秒、平轴约 {1} 秒：力臂短，转速掉得慢。", [r1(time('needle')), r1(time('flat'))])},
      {id:'lab-fri-fast', q:tr("刚开始的时候，哪种轴尖跑得最快？"), options:[tr("平轴"),tr("尖轴")], answer:0,
        explain:tr("平轴抓地最强，能把转动最快地变成跑动。")},
      {id:'lab-fri-order', q:tr("停下的先后顺序是？"), options:[tr("平轴 → 圆轴 → 尖轴"),tr("尖轴 → 圆轴 → 平轴"),tr("三个一起停")], answer:0,
        explain:tr("力臂从长到短：平轴 > 圆轴 > 尖轴，所以平轴最先停、尖轴最后停。")},
    ];
  },
  precession: () => {
    const Om = rpm => 0.042*9.81*0.012/(2.1e-5*rpm*Math.PI/30), per = rpm => 2*Math.PI/Om(rpm);
    return [
      {id:'lab-pre-half', q:tr("转速从 6000 降到 3000 转/分，画一圈的时间会？"), options:[tr("变成一半（画得更快）"),tr("变成两倍（画得更慢）"),tr("不变")], answer:0,
        explain:tr("画一圈的时间和转速成正比：约 {0} 秒 → 约 {1} 秒。转慢了，画圈反而更快、更晃。", [r1(per(6000)), r1(per(3000))])},
      {id:'lab-pre-fall', q:tr("在实验里把转速拖到 300 转/分，会发生什么？"), options:[tr("倒下"),tr("画圈更慢、更稳")], answer:0,
        explain:tr("低于约 350 转/分时，角动量太小，扛不住重力——倒了。")},
      {id:'lab-pre-4000', q:tr("4000 转/分时，画一圈大约要几秒？"), options:[tr("约 {0} 秒", [Math.round(per(4000))]),tr("约 1 秒"),tr("约 100 秒")], answer:0,
        explain:tr("按实验的模型：重力力矩 ÷ 角动量 ≈ {0} 弧度/秒，一圈约 {1} 秒。", [r1(Om(4000)), r1(per(4000))])},
      {id:'lab-pre-fast', q:tr("转速调得越高，陀螺歪着画圈会？"), options:[tr("画得越慢"),tr("画得越快")], answer:0,
        explain:tr("角动量越大，重力越难改变它的方向，进动就越慢。")},
    ];
  },
  tides: () => [
    {id:'lab-tide-face', q:tr("港口正对着月亮的时候，是涨潮还是落潮？"), options:[tr("涨潮"),tr("落潮")], answer:0, explain:tr("朝着月亮的一边海水鼓起来，港口在鼓包里就是涨潮。")},
    {id:'lab-tide-6h', q:tr("从涨潮开始，地球再转 6 小时（四分之一圈），港口会？"), options:[tr("落潮"),tr("还是涨潮")], answer:0, explain:tr("转了四分之一圈，港口来到两个鼓包之间的“低处”，就是落潮。")},
    {id:'lab-tide-12h', q:tr("从涨潮开始，过大约 12 小时，港口会？"), options:[tr("又涨潮"),tr("落潮")], answer:0, explain:tr("地球另一边还有一个鼓包，转半圈后港口又到了鼓包里——一天两次涨潮。")},
    {id:'lab-tide-spring', q:tr("实验里，太阳和月亮排成一线时的潮差，大约是不排成一线时的几倍？"), options:[tr("约 2.7 倍"),tr("一样"),tr("约一半")], answer:0, explain:tr("大潮时月亮和太阳的引力叠加，小潮时互相抵消一部分，比例约 2.7 : 1。")},
  ],
  altitude: () => {
    const T = (t0, h) => Math.round((t0 - .6*h/100)*10)/10;
    const mk = (t0, h) => { const ok = T(t0, h); return {id:`lab-alt-${t0}-${h}`, q:tr("山脚 {0}°C，爬到 {1} 米高，按实验的模型大约多少度？", [t0, h]),
      options:[tr("约 {0}°C", [ok]), tr("约 {0}°C", [r1(t0+.6*h/100)]), tr("约 {0}°C", [t0])], answer:0, explain:tr("每升高 100 米降 0.6°C：{0} 米降 {1}°C，{2} − {3} = {4}°C。", [h, r1(.6*h/100), t0, r1(.6*h/100), ok])}; };
    return [mk(25, 2000), mk(30, 3000), mk(20, 1500), mk(28, 5000),
      {id:'lab-alt-everest', q:tr("山脚 28°C，一直爬到珠穆朗玛峰顶（8848.86 米），大约多少度？"), options:[tr("约 −25°C"),tr("约 0°C"),tr("约 20°C")], answer:0, explain:tr("8849 米约降 53°C：28 − 53 ≈ −25°C，所以峰顶终年冰雪。")}];
  },
};
export function labQuiz(chapterId, seen=[]) {
  const list = LAB[chapterId]?.() || [];
  if (!list.length) return null;
  const s = new Set(seen), fresh = list.filter(q=>!s.has(q.id));
  let q = fresh.length ? fresh[Math.floor(Math.random()*fresh.length)] : list.reduce((best, x)=>seen.lastIndexOf(x.id) < seen.lastIndexOf(best.id) ? x : best, list[0]);
  const order = q.options.map((_,i)=>i).sort(()=>Math.random()-.5);
  return {...q, options:order.map(i=>q.options[i]), answer:order.indexOf(q.answer)};
}
