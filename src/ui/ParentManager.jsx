import {useEffect, useState} from 'react';
import {listKids, updateKid, deleteKid, loadSave, writeSave} from '../net/auth.js';
import {freshSave, useGame} from '../game/store.js';
import {BLADERS} from '../game/story.js';
import {deactivateKid} from '../game/sync.js';

const AVATARS = ['1', '2', '3', '4'];
const input = {border: 'var(--border)', padding: '8px 12px', font: 'inherit', fontWeight: 800};

// Simple grown-up check so kids don't wander into profile management.
function ParentGate({onPass, onCancel}) {
  const [q] = useState(() => { const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4); return {a, b}; });
  const [v, setV] = useState(''), [bad, setBad] = useState(false);
  return (
    <div className="col" style={{alignItems: 'center', gap: 12}}>
      <div className="kicker">家长验证</div>
      <div className="h-display" style={{fontSize: 34}}>{q.a} × {q.b} = ?</div>
      <input autoFocus inputMode="numeric" value={v} onChange={e => { setV(e.target.value.replace(/\D/g, '')); setBad(false); }}
        onKeyDown={e => e.key === 'Enter' && (Number(v) === q.a * q.b ? onPass() : setBad(true))}
        className={bad ? 'shake' : ''} style={{...input, width: 120, fontSize: 26, textAlign: 'center'}}/>
      {bad && <div style={{color: 'var(--red)', fontWeight: 800}}>不对哦，请家长来回答</div>}
      <div className="row"><button className="btn ghost small" onClick={onCancel}>取消</button><button className="btn primary small" onClick={() => Number(v) === q.a * q.b ? onPass() : setBad(true)}>确定</button></div>
    </div>
  );
}

function KidRow({kid, onChanged}) {
  const [nickname, setNickname] = useState(kid.nickname), [avatar, setAvatar] = useState(kid.avatar), [pin, setPin] = useState(kid.pin || '');
  const [save, setSave] = useState(undefined), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { loadSave(kid.id).then(r => setSave(r.data || null)); }, [kid.id]);
  const dirty = nickname !== kid.nickname || avatar !== kid.avatar || (pin || null) !== (kid.pin || null);
  async function persist() {
    if (!nickname.trim()) return setMsg('昵称不能为空');
    if (pin && !/^\d{4}$/.test(pin)) return setMsg('PIN 需要 4 位数字，或留空');
    setBusy(true);
    const {error} = await updateKid(kid.id, {nickname: nickname.trim(), avatar, pin: pin || null});
    setBusy(false); setMsg(error ? '保存失败：' + error.message : '已保存 ✓'); if (!error) onChanged();
  }
  async function resetProgress() {
    if (!confirm(`确定把「${kid.nickname}」的游戏进度清零吗？陀螺、金币、知识卡都会重置。`)) return;
    const {error} = await writeSave(kid.id, freshSave());
    if (useGame.getState().activeKid?.id === kid.id) deactivateKid();
    setMsg(error ? '重置失败：' + error.message : '进度已重置'); setSave(freshSave());
  }
  async function remove() {
    if (!confirm(`确定删除「${kid.nickname}」的档案和云存档吗？此操作不能撤销。`)) return;
    const {error} = await deleteKid(kid.id);
    if (error) return setMsg('删除失败：' + error.message);
    if (useGame.getState().activeKid?.id === kid.id) deactivateKid();
    onChanged();
  }
  const beat = (save?.defeated || []).map(id => BLADERS.find(b => b.id === id)?.name).filter(Boolean);
  return (
    <div className="panel" style={{padding: 16, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16}}>
      <div className="col" style={{gap: 10}}>
        <div className="row">
          <img src={`/art/avatars/${/^[1-4]$/.test(avatar) ? avatar : '1'}.png`} alt="" width={64} height={64} style={{borderRadius: '50%', border: 'var(--border)'}}/>
          <input value={nickname} maxLength={24} onChange={e => setNickname(e.target.value)} style={{...input, flex: 1}} aria-label="昵称"/>
        </div>
        <div className="row" style={{gap: 8}}>
          <span style={{fontWeight: 800}}>头像</span>
          {AVATARS.map(a => <button key={a} onClick={() => setAvatar(a)} aria-label={`头像 ${a}`} style={{padding: 0, border: 'none', background: 'none', borderRadius: '50%', outline: avatar === a ? '3px solid var(--red)' : 'none', outlineOffset: 2}}>
            <img src={`/art/avatars/${a}.png`} alt="" width={40} height={40} style={{borderRadius: '50%', border: '2px solid #111', display: 'block'}}/></button>)}
        </div>
        <div className="row" style={{gap: 8}}>
          <span style={{fontWeight: 800}}>PIN</span>
          <input value={pin} inputMode="numeric" placeholder="不设置" onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} style={{...input, width: 110}} aria-label="PIN"/>
          <span className="muted" style={{fontSize: 12}}>孩子进入档案时需要输入</span>
        </div>
        <div className="row" style={{gap: 8}}>
          <button className="btn primary small" disabled={!dirty || busy} onClick={persist}>保存修改</button>
          {msg && <span style={{fontWeight: 800}}>{msg}</span>}
        </div>
      </div>
      <div className="col" style={{gap: 8, borderLeft: '3px dashed #111', paddingLeft: 16}}>
        <div className="kicker">游戏进度</div>
        {save === undefined && <span className="muted">读取中…</span>}
        {save === null && <span className="muted">还没开始玩</span>}
        {save && <div style={{lineHeight: 1.9, fontWeight: 700}}>
          🌀 陀螺 {save.collection?.length || 0} 只 · 🪙 {save.coins || 0} 金币 · 📚 知识卡 {save.cards?.length || 0} 张<br/>
          ⚔ 对战 {save.battles || 0} 场 · 队员 {save.team?.length || 0} 人<br/>
          🏆 打败过：{beat.length ? beat.join('、') : '还没有'}
        </div>}
        <div className="row mt" style={{gap: 8}}>
          <button className="btn small" onClick={resetProgress}>重置进度</button>
          <button className="btn small" style={{color: 'var(--red)'}} onClick={remove}>删除档案</button>
        </div>
      </div>
    </div>
  );
}

export default function ParentManager({onClose}) {
  const [passed, setPassed] = useState(false), [kids, setKids] = useState(null);
  const refresh = () => listKids().then(r => setKids(r.data || []));
  useEffect(() => { if (passed) refresh(); }, [passed]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal panel pop" style={{maxWidth: 860, animationName: 'slidein', color: 'var(--ink)'}} onClick={e => e.stopPropagation()}>
        <div className="row between"><h2 className="h-display" style={{fontSize: 30}}>⚙ 家长管理</h2><button className="btn small ghost" onClick={onClose}>关闭</button></div>
        {!passed ? <ParentGate onPass={() => setPassed(true)} onCancel={onClose}/> :
          <div className="col mt" style={{gap: 14}}>
            {kids === null && <span className="muted">读取中…</span>}
            {kids?.length === 0 && <span className="muted">还没有孩子档案，先在首页新建一个吧。</span>}
            {kids?.map(k => <KidRow key={k.id + k.nickname + k.avatar + k.pin} kid={k} onChanged={refresh}/>)}
          </div>}
      </div>
    </div>
  );
}
