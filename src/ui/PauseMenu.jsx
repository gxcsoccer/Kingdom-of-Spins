import {useState} from 'react';
import {hush} from '../game/voiceClips.js';
import {createPortal} from 'react-dom';

// Always-visible ⏸ button + pause sheet with 继续 / 退出 (exit asks for confirmation).
// onPause(true|false) should freeze/unfreeze physics + timers; onExit leaves the battle.
export default function PauseMenu({onPause,onExit}){
  const [open,setOpen]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const show=()=>{setOpen(true);setConfirm(false);onPause?.(true);hush();};
  const resume=()=>{setOpen(false);setConfirm(false);onPause?.(false);};
  return <>
    <button className="pm-btn" onClick={show} aria-label="暂停 / 退出">⏸<span> 暂停 / 退出</span></button>
    {open&&createPortal(<div className="pm-back" onPointerDown={e=>{if(e.target===e.currentTarget&&!confirm)resume();}}>
      <div className="pm-sheet">
        {!confirm?<>
          <div className="pm-title">⏸ 暂停中</div>
          <button className="pm-go" onClick={resume}>▶ 继续</button>
          <button className="pm-exit" onClick={()=>setConfirm(true)}>🚪 退出对战</button>
        </>:<>
          <div className="pm-q">这场比赛不算输也不算赢，确定离开吗？</div>
          <div className="pm-row"><button className="pm-exit" onClick={onExit}>确定离开</button><button className="pm-go" onClick={()=>setConfirm(false)}>再想想</button></div>
        </>}
      </div>
    </div>,document.body)}
  </>;
}
