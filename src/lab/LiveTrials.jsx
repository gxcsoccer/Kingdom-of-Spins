import {tr} from '../i18n/index.js';
import {useMemo} from 'react';
import {FINISH_ZH} from '../game/story.js';

// "实验中" live board: A row and B row of mini arenas. Each card spins while its simulation runs,
// then draws its rpm curve, stamps WIN/LOSE and the finish type. Big A vs B tally on the left.
const FIN_ICON={xtreme:'💥',over:'🌀',burst:'💣',spin:'😵',judge:'⏱'};

function Spark({samples}){
  const d=useMemo(()=>{
    if(!samples?.length)return '';
    const T=Math.max(1,samples.at(-1).time),R=Math.max(1,...samples.map(s=>s.rpm[0]));
    return samples.map((s,i)=>`${i?'L':'M'}${(s.time/T*100).toFixed(1)},${(52-s.rpm[0]/R*48).toFixed(1)}`).join('');
  },[samples]);
  return <svg className="lt-spark" viewBox="0 0 100 54" preserveAspectRatio="none"><path d={d} pathLength="1"/></svg>;
}

function Card({r,arm,k}){
  const win=r?.result?.winner===0;
  return (
    <div className={`lt-card ${arm} ${r?'done':''} ${r?(win?'win':'lose'):''}`} style={{'--i':k}}>
      <span className="lt-k">{tr("第 {0} 次实验", [k+1])}</span>
      {!r?<span className="lt-spin"><i/><b>{tr("模拟中…")}</b></span>:<>
        <Spark samples={r.samples}/>
        <span className="lt-stamp">{win?'WIN':'LOSE'}</span>
        <span className="lt-fin">{FIN_ICON[r.result.reason]||'🏁'} {FINISH_ZH[r.result.reason]} · {r.result.time.toFixed(1)}s</span>
        <span className="lt-rpm">{tr("3 秒时 ")}{Math.round(r.rpm3[0]).toLocaleString()} rpm</span>
      </>}
    </div>
  );
}

export default function LiveTrials({n,live,labels}){
  const wins=arm=>live[arm].filter(r=>r?.result?.winner===0).length;
  const doneN=arm=>live[arm].filter(Boolean).length;
  return (
    <div className="lt">
      <div className="lt-tally">
        <div className="lt-side a"><small>{tr("A 原版")}</small><b key={'a'+wins('A')}>{wins('A')}</b><em>{doneN('A')}/{n}{tr(" 场")}</em></div>
        <div className="lt-vs">VS</div>
        <div className="lt-side b"><small>{tr("B 改装")}</small><b key={'b'+wins('B')}>{wins('B')}</b><em>{doneN('B')}/{n}{tr(" 场")}</em></div>
        <div className="lt-note">{tr("胜场")}</div>
      </div>
      <div className="lt-grid" style={{'--n':n}}>
        <div className="lt-row-l a">A<small>{labels[0]}</small></div>
        {Array.from({length:n},(_,k)=><Card key={'A'+k} r={live.A[k]} arm="a" k={k}/>)}
        <div className="lt-row-l b">B<small>{labels[1]}</small></div>
        {Array.from({length:n},(_,k)=><Card key={'B'+k} r={live.B[k]} arm="b" k={k}/>)}
      </div>
    </div>
  );
}
