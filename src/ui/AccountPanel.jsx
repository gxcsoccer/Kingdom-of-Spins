import {useGame} from '../game/store.js';
// Placeholder until the backend client (src/net/auth.js) lands: guest/local profile only.
export default function AccountPanel(){
  const profile=useGame(s=>s.save.profile), setProfile=useGame(s=>s.setProfile);
  return (
    <div className="panel mt2" style={{padding:'12px 18px'}}>
      <div className="row wrap center">
        <span style={{fontWeight:800}}>玩家名</span>
        <input defaultValue={profile?.nickname||''} placeholder="输入你的名字" maxLength={12}
          onBlur={e=>setProfile({nickname:e.target.value.trim()||'小陀螺手'})}
          style={{border:'var(--border)',padding:'8px 12px',font:'inherit',fontWeight:800,width:160}}/>
        <span className="muted" style={{fontSize:13}}>游客模式 · 存档保存在本机</span>
      </div>
    </div>
  );
}
