import {tr} from '../i18n/index.js';
import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {listKids, updateKid, deleteKid, loadSave, writeSave} from '../net/auth.js';
import {freshSave, useGame} from '../game/store.js';
import {BLADERS} from '../game/story.js';
import {deactivateKid} from '../game/sync.js';
import {makeDemoSave} from '../game/demoSave.js';

const AVATARS = ['1', '2', '3', '4'];
const input = {border: 'var(--border)', padding: '8px 12px', font: 'inherit', fontWeight: 800};

// Simple grown-up check so kids don't wander into profile management.
function ParentGate({onPass, onCancel}) {
  const [q] = useState(() => { const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4); return {a, b}; });
  const [v, setV] = useState(''), [bad, setBad] = useState(false);
  return (
    <div className="col" style={{alignItems: 'center', gap: 12}}>
      <div className="kicker">{tr("家长验证")}</div>
      <div className="h-display" style={{fontSize: 34}}>{q.a} × {q.b} = ?</div>
      <input autoFocus inputMode="numeric" value={v} onChange={e => { setV(e.target.value.replace(/\D/g, '')); setBad(false); }}
        onKeyDown={e => e.key === 'Enter' && (Number(v) === q.a * q.b ? onPass() : setBad(true))}
        className={bad ? 'kos-input shake' : 'kos-input'} style={{...input, width: 120, fontSize: 26, textAlign: 'center'}}/>
      {bad && <div style={{color: 'var(--red)', fontWeight: 800}}>{tr("不对哦，请家长来回答")}</div>}
      <div className="row"><button className="btn ghost small" onClick={onCancel}>{tr("取消")}</button><button className="btn primary small" onClick={() => Number(v) === q.a * q.b ? onPass() : setBad(true)}>{tr("确定")}</button></div>
    </div>
  );
}

function KidRow({kid, onChanged}) {
  const [nickname, setNickname] = useState(kid.nickname), [avatar, setAvatar] = useState(kid.avatar), [pin, setPin] = useState(kid.pin || '');
  const [save, setSave] = useState(undefined), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { loadSave(kid.id).then(r => setSave(r.data || null)); }, [kid.id]);
  const dirty = nickname !== kid.nickname || avatar !== kid.avatar || (pin || null) !== (kid.pin || null);
  async function persist() {
    if (!nickname.trim()) return setMsg(tr("昵称不能为空"));
    if (pin && !/^\d{4}$/.test(pin)) return setMsg(tr("PIN 需要 4 位数字，或留空"));
    setBusy(true);
    const {error} = await updateKid(kid.id, {nickname: nickname.trim(), avatar, pin: pin || null});
    setBusy(false); setMsg(error ? tr("保存失败：") + error.message : tr("已保存 ✓")); if (!error) onChanged();
  }
  async function resetProgress() {
    if (!confirm(tr("确定把「{0}」的游戏进度清零吗？陀螺、金币、知识卡都会重置。", [kid.nickname]))) return;
    if (useGame.getState().activeKid?.id === kid.id) await deactivateKid({discardPending: true});
    const {error} = await writeSave(kid.id, freshSave());
    setMsg(error ? tr("重置失败：") + error.message : tr("进度已重置")); if (!error) setSave(freshSave());
  }
  // 演示用：一键写入“玩到一半”的进度（走正常的云存档；当前正在玩的档案也同步到本地）。
  async function importDemo() {
    if (!confirm(tr("导入演示存档会覆盖「{0}」现在的全部进度（陀螺、队员、探索、金币、知识卡）。确定导入吗？", [kid.nickname]))) return;
    const data = makeDemoSave({...save, profile: {...save?.profile, nickname: kid.nickname, avatar: kid.avatar || null, kidId: kid.id}});
    setBusy(true);
    const {error} = await writeSave(kid.id, data);
    if (!error && useGame.getState().activeKid?.id === kid.id) useGame.getState().update(s => { for (const k of Object.keys(s)) delete s[k]; Object.assign(s, data); });
    setBusy(false);
    setMsg(error ? tr("导入失败：") + error.message : tr("演示存档已导入 ✓")); if (!error) setSave(data);
  }
  async function remove() {
    if (!confirm(tr("确定删除「{0}」的档案和云存档吗？此操作不能撤销。", [kid.nickname]))) return;
    if (useGame.getState().activeKid?.id === kid.id) await deactivateKid({discardPending: true});
    const {error} = await deleteKid(kid.id);
    if (error) return setMsg(tr("删除失败：") + error.message);
    onChanged();
  }
  const beat = (save?.defeated || []).map(id => BLADERS.find(b => b.id === id)?.name).filter(Boolean);
  return (
    <div className="panel parent-kid-row" style={{padding: 16, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16}}>
      <div className="col" style={{gap: 10}}>
        <div className="row" style={{gap: 10, flexWrap: 'nowrap'}}>
          <img src={`/art/avatars/${/^[1-4]$/.test(avatar) ? avatar : '1'}.png`} alt="" width={64} height={64} style={{borderRadius: '50%', border: 'var(--border)'}}/>
          <input className="kos-input" value={nickname} maxLength={24} onChange={e => setNickname(e.target.value)} style={{...input, flex: 1, minWidth: 0}} aria-label={tr("昵称")}/>
        </div>
        <div className="row" style={{gap: 8, flexWrap: 'nowrap'}}>
          <span style={{fontWeight: 800, whiteSpace: 'nowrap'}}>{tr("头像")}</span>
          {AVATARS.map(a => <button key={a} onClick={() => setAvatar(a)} aria-label={tr("头像 {0}", [a])} className={`av-pick ${avatar === a ? 'on' : ''}`}>
            <img src={`/art/avatars/${a}.png`} alt="" width={40} height={40} style={{borderRadius: '50%', border: '2px solid #111', display: 'block'}}/></button>)}
        </div>
        <div className="row" style={{gap: 8}}>
          <span style={{fontWeight: 800, whiteSpace: 'nowrap'}}>PIN</span>
          <input className="kos-input" value={pin} inputMode="numeric" placeholder={tr("不设置")} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} style={{...input, width: 110}} aria-label="PIN"/>
          <span className="muted" style={{fontSize: 12}}>{tr("孩子进入档案时需要输入")}</span>
        </div>
        <div className="row" style={{gap: 8}}>
          <button className="btn primary small" disabled={!dirty || busy} onClick={persist}>{tr("保存修改")}</button>
          {msg && <span style={{fontWeight: 800}}>{msg}</span>}
        </div>
      </div>
      <div className="col" style={{gap: 8, borderLeft: '3px dashed #111', paddingLeft: 16}}>
        <div className="kicker">{tr("游戏进度")}</div>
        {save === undefined && <span className="muted">{tr("读取中…")}</span>}
        {save === null && <span className="muted">{tr("还没开始玩")}</span>}
        {save && <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '6px 14px', fontWeight: 700, lineHeight: 1.5}}>
          <span>{tr("🌀 陀螺 ")}{save.collection?.length || 0}{tr(" 只")}</span><span>🪙 {save.coins || 0}{tr(" 金币")}</span>
          <span>{tr("📚 知识卡 ")}{save.cards?.length || 0}{tr(" 张")}</span><span>{tr("⚔ 对战 ")}{save.battles || 0}{tr(" 场")}</span>
          <span>{tr("👥 队员 ")}{save.team?.length || 0}{tr(" 人")}</span><span/>
          <span style={{gridColumn: '1 / -1'}}>{tr("🏆 打败过：")}{beat.length ? beat.join('、') : tr("还没有")}</span>
        </div>}
        <div className="row mt" style={{gap: 8}}>
          <button className="btn small" onClick={resetProgress}>{tr("重置进度")}</button>
          <button className="btn small yellow" disabled={busy} onClick={importDemo}>{tr("🎬 导入演示存档")}</button>
          <button className="btn small" style={{color: 'var(--red)'}} onClick={remove}>{tr("删除档案")}</button>
        </div>
      </div>
    </div>
  );
}

export default function ParentManager({onClose}) {
  const [passed, setPassed] = useState(false), [kids, setKids] = useState(null);
  const refresh = () => listKids().then(r => setKids(r.data || []));
  useEffect(() => { if (passed) refresh(); }, [passed]);
  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div className="modal panel pop" style={{maxWidth: 860, width: 'min(860px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', animationName: 'slidein', color: 'var(--ink)'}} onClick={e => e.stopPropagation()}>
        <div className="row between"><h2 className="h-display" style={{fontSize: 30}}>{tr("⚙ 家长管理")}</h2><button className="btn small ghost" onClick={onClose}>{tr("关闭")}</button></div>
        {!passed ? <ParentGate onPass={() => setPassed(true)} onCancel={onClose}/> :
          <div className="col mt" style={{gap: 14}}>
            {kids === null && <span className="muted">{tr("读取中…")}</span>}
            {kids?.length === 0 && <span className="muted">{tr("还没有孩子档案，先在首页新建一个吧。")}</span>}
            {kids?.map(k => <KidRow key={k.id + k.nickname + k.avatar + k.pin} kid={k} onChanged={refresh}/>)}
          </div>}
      </div>
    </div>,
    document.body
  );
}
