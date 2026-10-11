import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import ReplaySlot from '../ReplaySlot.jsx';
import {DoctorFace} from '../MapScreen.jsx';
import {getCard} from '../../knowledge/cards.js';
import {openFlipbook} from '../../flipbook/store.js';
import {voiceLine,prefetchVoice} from '../../game/voiceClips.js';
import * as sfx from '../../game/sfx.js';
import {momentCard} from '../../ai/fallback.js';
import {freshQuiz, markSeen} from '../../knowledge/quizSeen.js';

// Guided "博士讲解模式": the doctor narrates the replay, drives slow-mo highlights, asks quizzes and waits
// for the kid's answer. Pure presentation over data already in ResultPanel (moments + AI commentary).
const NUM='①②③④⑤';
const HIGHLIGHT_WALL_MS=7400;          // ReplayViewer highlight: 1.8 s of round time at ¼× ≈ 7.2 s
const PRAISE=['答对啦！你的眼睛真厉害！','完全正确！你像个小科学家！','没错！就是这样！'];
const CHEER=['差一点点！没关系，我们一起看看为什么。','嗯～不是这个哦。别灰心，答案很有意思！'];
const speakable=t=>String(t||'').replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu,'').replace(/[「」【】]/g,'');
const estimate=t=>Math.max(2500,String(t||'').length*200);

function useBoxHeight(){
  const ref=useRef(null);const [h,setH]=useState(0);
  useEffect(()=>{const el=ref.current;if(!el)return;const ro=new ResizeObserver(([e])=>setH(Math.round(e.contentRect.height)));ro.observe(el);return()=>ro.disconnect();},[]);
  return [ref,h];
}

export default function GuidedReview({decisive,myBey,opp,moments,names,ai,unlockCards,addCoins,onNext,onManual,titleOf,fallbackOf}){
  const viewer=useRef(null);
  const [boxRef,boxH]=useBoxHeight();
  const [line,setLine]=useState({text:'',mood:'normal',key:0,instant:false});
  const [nextBtn,setNextBtn]=useState(false);
  const [stamp,setStamp]=useState(null); // {ok,key}
  const [typed,setTyped]=useState(0);
  const [caption,setCaption]=useState(null);
  const [quiz,setQuiz]=useState(null);           // {m, quiz, answer?}
  const [cur,setCur]=useState(null);             // current moment
  const [outro,setOutro]=useState(false);
  const [paused,setPausedS]=useState(false);
  const [muted,setMutedS]=useState(sfx.isMuted());
  const [cards,setCards]=useState([]);
  const [coinsWon,setCoinsWon]=useState(0);
  const st=useRef({run:0,paused:false,skip:null,answer:null});
  const aiRef=useRef(ai);useEffect(()=>{aiRef.current=ai;},[ai]);
  // Stable props for the replay (the typewriter re-renders often; new arrays would reset the replay player).
  const beys=useMemo(()=>[myBey,opp.bey],[myBey,opp.bey]);
  const rvMoments=useMemo(()=>moments.map(m=>({id:m.id,time:m.time,title:(ai?.moments||[]).find(x=>x.id===m.id)?.title||titleOf(m)})),[moments,ai,titleOf]);

  // typewriter
  useEffect(()=>{
    const n=line.text.length;if(line.instant){setTyped(n);return;}
    setTyped(0);if(!n)return;
    const step=25;let i=0; // ~40 chars/s
    const iv=setInterval(()=>{if(st.current.paused)return;i++;setTyped(i);if(i>=n)clearInterval(iv);},step);
    return()=>clearInterval(iv);
  },[line]);

  const alive=id=>st.current.run===id;
  const sleep=(ms,id)=>new Promise(res=>{let left=ms;let last=performance.now();
    const tick=()=>{if(!alive(id))return res(false);const now=performance.now();if(!st.current.paused)left-=now-last;last=now;
      if(st.current.skip){st.current.skip=null;return res(true);}if(left<=0)return res(true);setTimeout(tick,80);};tick();});
  // Say one line: typewriter + TTS; resolves on speech end (or an estimate if TTS is off/unavailable).
  const say=useCallback((text,mood,id,opt={})=>new Promise(res=>{
    if(!alive(id))return res(false);
    setLine(l=>({text,mood,key:l.key+1,instant:!!opt.instant}));
    if(opt.next)setNextBtn(true);
    const est=opt.next?4500:estimate(text);
    const tts=!sfx.isMuted()&&typeof window!=='undefined'&&window.speechSynthesis&&window.SpeechSynthesisUtterance;
    const t0=performance.now(), minRead=opt.next?0:(opt.instant?0:text.length*25)+1400; // typing time + a beat to read
    let done=false;const finish=force=>{if(done)return;const wait=minRead-(performance.now()-t0);if(!force&&wait>0&&alive(id)){setTimeout(finish,Math.min(wait,400));return;}done=true;setNextBtn(false);res(true);};
    if(!sfx.isMuted()){
      // 博士配音（预生成 / 实时）；不可用时退回浏览器朗读
      let fell=false;const stop=voiceLine(speakable(text),{onEnd:()=>setTimeout(finish,opt.next?1200:250),onFail:()=>{fell=true;synth();}});
      sleep(est*2.2+6000,id).then(finish);
      const watch=()=>{if(done||fell)return;if(!alive(id)){stop();return finish(true);}if(st.current.skip){st.current.skip=null;stop();return finish(true);}setTimeout(watch,120);};watch();
      return;
    }
    synth();
    function synth(){
    if(tts){
      try{
        window.speechSynthesis.cancel();
        const u=new SpeechSynthesisUtterance(speakable(text));u.lang='zh-CN';u.rate=1.05;u.pitch=1.2;
        u.onend=()=>setTimeout(finish,opt.next?1200:250);u.onerror=()=>sleep(est,id).then(finish);
        window.speechSynthesis.speak(u);
        sleep(est*1.8+2500,id).then(finish); // safety net: some browsers drop onend
        const skipWatch=()=>{if(done)return;if(!alive(id)){window.speechSynthesis.cancel();return finish(true);}if(st.current.skip){st.current.skip=null;window.speechSynthesis.cancel();return finish(true);}setTimeout(skipWatch,80);};skipWatch();
        return;
      }catch{/* fall through */}
    }
    sleep(est,id).then(()=>finish(true));
    }
  }),[]);// eslint-disable-line
  const waitAnswer=id=>new Promise(res=>{st.current.answer=i=>{st.current.answer=null;res(i);};const w=()=>{if(!alive(id)){st.current.answer=null;return res(null);}if(st.current.answer)setTimeout(w,120);};w();});
  const waitViewer=async id=>{const t0=performance.now();while(alive(id)&&!viewer.current?.playMoment&&performance.now()-t0<5000)await sleep(100,id);};
  const waitAi=async id=>{const t0=performance.now();while(alive(id)&&!aiRef.current&&performance.now()-t0<9000)await sleep(200,id);};

  const run=useCallback(async()=>{
    const id=++st.current.run;st.current.paused=false;setPausedS(false);
    setOutro(false);setQuiz(null);setCaption(null);setCur(null);setCards([]);setCoinsWon(0);
    // 博士要讲的台词提前送去生成配音（服务器缓存），轮到时直接播放
    const warm=()=>{const am=aiRef.current?.moments||[];prefetchVoice(aiRef.current?.headline,...moments.flatMap(m=>{const x=am.find(y=>y.id===m.id);return [`第${NUM[m.n-1]}个关键时刻：${String(x?.title||titleOf(m)).replace(/[！!。.]+$/,"")}！`,x?.explain,x?.quiz?.q&&`先别急着看——考考你：${x.quiz.q}`];}));};
    warm();
    if(!await say('准备好了吗？一起看录像！','excited',id))return;
    if(!aiRef.current){setLine(l=>({text:'博士在看录像…',mood:'thinking',key:l.key+1}));await waitAi(id);if(!alive(id))return;}
    warm();
    const aiM=mid=>(aiRef.current?.moments||[]).find(x=>x.id===mid);
    if(aiRef.current?.headline&&!await say(aiRef.current.headline,'normal',id))return;
    for(const m of moments){
      const a=aiM(m.id),title=a?.title||titleOf(m);
      setCur(m);setQuiz(null);
      if(!await say(`第${NUM[m.n-1]}个关键时刻：${String(title).replace(/[！!。.]+$/,"")}！`,'excited',id))return;
      await waitViewer(id);if(!alive(id))return;
      // One quiz per moment that this kid hasn't been asked before (any feature).
      const concept=m.kind==='finish'&&/over|xtreme/.test(m.data?.reason||'')?'ph-momentum':momentCard(m);
      const q=a?.quiz?freshQuiz(a.quiz,concept):null;
      const highlight=async()=>{
        viewer.current?.playMoment?.(m.id);
        if(a?.dj){setCaption(a.dj);if(!sfx.isMuted())sfx.say(speakable(a.dj),'zh-CN',1.2);}
        const ok=await sleep(HIGHLIGHT_WALL_MS,id);setCaption(null);viewer.current?.pause?.();return ok;
      };
      if(!q){
        // No quiz: slow-mo highlight, then the doctor explains.
        if(!await highlight())return;
        if(!await say(a?.explain||fallbackOf(m),'normal',id))return;
        if(a?.cardId){unlockCards?.([a.cardId]);setCards(c=>c.includes(a.cardId)?c:[...c,a.cardId]);}
        continue;
      }
      // 先猜再揭晓: freeze the replay just before the moment, ask with NO explanation, wait for the answer;
      // only then play the slow-mo and explain (with the real-life analogy).
      viewer.current?.seek?.(Math.max(0,m.time-.6));viewer.current?.pause?.();
      markSeen(q.id,q.alsoIds||[]);
      setQuiz({m,quiz:q});
      let ansNow=null;const ansP=waitAnswer(id).then(v=>{ansNow=v;return v;});
      const asked=say(`先别急着看——考考你：${q.q}`,'thinking',id);
      await Promise.race([asked,ansP]);
      if(ansNow!=null){st.current.skip=true;await asked;}
      const ans=ansNow!=null?ansNow:await ansP;if(ans==null||!alive(id))return;
      const right=ans===q.answer;
      setQuiz({m,quiz:q,answer:ans});
      if(right){sfx.beep(true);sfx.clang(.25);addCoins?.(5);setCoinsWon(c=>c+5);}else sfx.beep();
      setStamp({ok:right,key:Date.now()});
      if(!await say(right?'答对啦！我们来看慢动作，验证一下！':'我们来看慢动作，找找答案！','excited',id))return;
      if(!await highlight())return;
      const react=right?PRAISE[m.n%PRAISE.length]:CHEER[m.n%CHEER.length];
      const full=`${react}${q.reveal||q.explain||''}${a?.explain?` ${a.explain}`:''}${q.analogy?`\n🌏 生活里也一样：${q.analogy}`:''}`;
      if(a?.cardId){unlockCards?.([a.cardId]);setCards(c=>c.includes(a.cardId)?c:[...c,a.cardId]);}
      if(!await say(full,right?'excited':'normal',id,{instant:true,next:true}))return;
      setStamp(null);
    }
    setCur(null);setQuiz(null);
    const take=aiRef.current?.takeaway||'记住：一次只看一个原因，用实验来验证！';
    setOutro(true);
    await say(`${take} 要不要去实验室亲手验证一下？`,'excited',id);
  },[moments,say,titleOf,fallbackOf,addCoins,unlockCards]);// eslint-disable-line

  useEffect(()=>{if(boxH>0&&st.current.run===0){const t=setTimeout(run,700);return()=>clearTimeout(t);}},[boxH,run]);
  useEffect(()=>()=>{st.current.run++;window.speechSynthesis?.cancel();},[]);

  const togglePause=()=>{const p=!st.current.paused;st.current.paused=p;setPausedS(p);
    try{p?window.speechSynthesis?.pause():window.speechSynthesis?.resume();}catch{}
    if(p)viewer.current?.pause?.();else if(caption)viewer.current?.play?.();};
  const skip=()=>{if(quiz&&quiz.answer==null)return;st.current.skip=true;if(st.current.paused)togglePause();};
  const toggleMute=()=>{const m=!muted;sfx.setMuted(m);setMutedS(m);if(m)window.speechSynthesis?.cancel();};
  const answer=i=>st.current.answer?.(i);
  const next=()=>{st.current.skip=true;};
  const shown=line.text.slice(0,typed);
  const waitingQuiz=quiz&&quiz.answer==null;

  return (
    <div className="gr">
      <div className="gr-doc">
        <div key={line.key} className={`gr-balloon ${line.mood}`}>
          {cur&&<div className="gr-moment">{NUM[cur.n-1]} {(ai?.moments||[]).find(x=>x.id===cur.id)?.title||titleOf(cur)} <small>{cur.time.toFixed(1)} 秒</small>
            <button className="gr-chip" onClick={()=>openFlipbook({moment:{kind:cur.kind,title:titleOf(cur),explain:fallbackOf(cur)}})}>📖 翻开绘本</button></div>}
          <p className={line.text.length>70?'long':''}>{shown}<span className="gr-caret">{typed<line.text.length?'▍':''}</span></p>
          {quiz&&<div className="gr-quiz">
            {quiz.quiz.options.map((o,i)=>{const done=quiz.answer!=null;if(done&&i!==quiz.answer&&i!==quiz.quiz.answer)return null;return (
              <button key={i} className={`gr-ans ${done?'small':''} ${done&&i===quiz.quiz.answer?'right':''} ${done&&i===quiz.answer&&i!==quiz.quiz.answer?'wrong':''}`} disabled={done} onClick={()=>answer(i)}><b>{done?(i===quiz.quiz.answer?'✓':'✗'):'ABC'[i]}</b>{o}</button>);})}
            {waitingQuiz&&<div className="gr-wait">博士在等你回答～</div>}
          </div>}
          {nextBtn&&<button className="gr-next" onClick={next}>下一个 ▶</button>}
          {outro&&<div className="gr-outro">
            {(cards.length>0||coinsWon>0)&&<div className="gr-got">{coinsWon>0&&<span className="gr-coin">🪙 +{coinsWon}</span>}{cards.map(c=>{const k=getCard(c);return k&&<span key={c} className="gr-card">📚 {k.title}</span>;})}</div>}
            <div className="gr-outro-btns"><button className="gr-lab" onClick={onNext}>去实验室验证 ▶</button><button className="gr-again" onClick={run}>⟲ 再看一遍</button></div>
          </div>}
        </div>
        {stamp&&<div key={stamp.key} className={`gr-stamp ${stamp.ok?'ok':'no'}`}>{stamp.ok?<>答对了！<b>+5🪙</b></>:'差一点！'}</div>}
        <div className={`gr-doctor mood-${line.mood}`}><DoctorFace mood={line.mood==='excited'?'excited':line.mood==='thinking'?'thinking':'normal'} size={240}/></div>
        <div className="gr-ctrl">
          <button onClick={togglePause} title={paused?'继续':'暂停'}>{paused?'▶':'⏸'}</button>
          <button onClick={skip} disabled={!!waitingQuiz} title="跳过这句">⏭ 跳过这句</button>
          <button onClick={toggleMute} title="声音">{muted?'🔇':'🔊'}</button>
          <button className="gr-manual" onClick={onManual}>我自己看</button>
        </div>
      </div>
      <div className="gr-stage" ref={boxRef}>
        {boxH>0&&<ReplaySlot ref={viewer} height={Math.max(180,boxH-150)} beys={beys} samples={decisive.samples} events={decisive.events} moments={rvMoments}/>}
        {caption&&<div className="gr-caption"><span>🎙</span>{caption}</div>}
      </div>
    </div>
  );
}
