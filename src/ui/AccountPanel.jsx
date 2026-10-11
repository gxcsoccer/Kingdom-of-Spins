import {useEffect, useState} from 'react';
import {useGame} from '../game/store.js';
import {isConfigured, providerEnabled, getSession, onAuthChange, signInWithGoogle, signOut, listKids, createKid, deleteKid} from '../net/auth.js';
import {activateKid, deactivateKid, restoreLastKid} from '../game/sync.js';

const AVATARS = ['1', '2', '3', '4']; // /art/avatars/<n>.png; older profiles may hold a hex colour
const inputStyle = {border: 'var(--border)', padding: '8px 12px', font: 'inherit', fontWeight: 800};
let restoreTried = false;

function Avatar({color, name, size = 44}) {
  if (/^[1-4]$/.test(String(color))) return <img src={`/art/avatars/${color}.png`} alt="" width={size} height={size} style={{borderRadius: '50%', border: 'var(--border)', background: '#fff', objectFit: 'cover', flex: 'none'}}/>;
  return (
    <span style={{width: size, height: size, borderRadius: '50%', background: color || '#ccc', border: 'var(--border)', display: 'inline-grid', placeItems: 'center',
      fontFamily: 'var(--display)', fontWeight: 900, fontSize: size * .45, color: '#fff', WebkitTextStroke: '1px var(--ink)', flex: 'none'}}>
      {(name || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

function GuestPanel({googleReady}) {
  const profile = useGame(s => s.save.profile), setProfile = useGame(s => s.setProfile);
  return (
    <div className="panel mt2" style={{padding: '12px 18px'}}>
      <div className="row wrap center">
        <span style={{fontWeight: 800}}>玩家名</span>
        <input defaultValue={profile?.nickname || ''} placeholder="输入你的名字" maxLength={12} style={{...inputStyle, width: 160}}
          onBlur={e => setProfile({nickname: e.target.value.trim() || '小陀螺手'})}/>
        <span className="muted" style={{fontSize: 13}}>游客模式 · 存档保存在本机</span>
        {googleReady ? null : <button className="btn small" disabled title="项目还没有配置 Google 登录">家长登录（需要配置 Google）</button>}
      </div>
    </div>
  );
}

function NewKidForm({onDone, onCancel}) {
  const [nickname, setNickname] = useState(''), [avatar, setAvatar] = useState(AVATARS[0]), [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (!nickname.trim()) return setErr('给孩子起个昵称吧');
    if (pin && !/^\d{4}$/.test(pin)) return setErr('PIN 需要是 4 位数字，或者留空');
    setBusy(true);
    const {data, error} = await createKid({nickname: nickname.trim(), avatar, pin: pin || null});
    setBusy(false);
    if (error) return setErr('创建失败：' + error.message);
    onDone(data);
  }
  return (
    <form className="panel tone slidein col" style={{padding: 16}} onSubmit={submit}>
      <div className="kicker">新建孩子档案</div>
      <input autoFocus value={nickname} onChange={e => setNickname(e.target.value)} placeholder="孩子的昵称（不用真名）" maxLength={24} style={inputStyle}/>
      <div className="row">
        <span style={{fontWeight: 800}}>头像颜色</span>
        {AVATARS.map(c => (
          <button type="button" key={c} onClick={() => setAvatar(c)} aria-label={c}
            style={{padding: 0, border: 'none', background: 'none', outline: avatar === c ? '3px solid var(--ink)' : 'none', outlineOffset: 3, borderRadius: '50%'}}>
            <Avatar color={c} name={nickname} size={36}/>
          </button>
        ))}
      </div>
      <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="4 位 PIN（可选）" style={{...inputStyle, width: 180}}/>
      {err && <div style={{color: 'var(--red)', fontWeight: 800}}>{err}</div>}
      <div className="row">
        <button className="btn primary small" disabled={busy}>{busy ? '创建中…' : '创建'}</button>
        <button type="button" className="btn small ghost" onClick={onCancel}>取消</button>
      </div>
    </form>
  );
}

function PinPrompt({kid, onOk, onCancel}) {
  const [pin, setPin] = useState(''), [bad, setBad] = useState(false);
  function check(v) {
    setPin(v);
    if (v.length === 4) { if (v === kid.pin) onOk(); else { setBad(true); setPin(''); } }
  }
  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="modal panel pop col" style={{maxWidth: 360, alignItems: 'center'}} onClick={e => e.stopPropagation()}>
        <Avatar color={kid.avatar} name={kid.nickname} size={64}/>
        <div className="panel-title" style={{fontSize: 22}}>{kid.nickname}，输入 PIN</div>
        <input autoFocus value={pin} onChange={e => check(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" type="password"
          className={bad ? 'shake' : ''} style={{...inputStyle, width: 140, fontSize: 28, textAlign: 'center', letterSpacing: '.4em'}}/>
        {bad && <div style={{color: 'var(--red)', fontWeight: 800}}>PIN 不对，再试一次</div>}
        <button className="btn small ghost" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function ParentPanel({session}) {
  const activeKid = useGame(s => s.activeKid);
  const [kids, setKids] = useState(null), [err, setErr] = useState(''), [adding, setAdding] = useState(false);
  const [pinFor, setPinFor] = useState(null), [busyId, setBusyId] = useState(null);

  async function refresh() {
    const {data, error} = await listKids();
    if (error) setErr('读取孩子档案失败：' + error.message); else { setErr(''); setKids(data); }
  }
  useEffect(() => { refresh(); }, [session?.user?.id]);

  async function choose(kid) {
    setBusyId(kid.id);
    const {error} = await activateKid(kid);
    setBusyId(null);
    if (error) setErr('云存档读取失败，先用本机存档：' + error.message);
  }
  async function remove(kid) {
    if (!confirm(`确定删除「${kid.nickname}」的档案和云存档吗？此操作不能撤销。`)) return;
    const {error} = await deleteKid(kid.id);
    if (error) return setErr('删除失败：' + error.message);
    if (activeKid?.id === kid.id) deactivateKid();
    refresh();
  }

  return (
    <div className="panel mt2 col" style={{padding: '14px 18px', textAlign: 'left'}}>
      <div className="row between wrap">
        <span className="chip">家长 · {session.user?.email}</span>
        <button className="btn small ghost" onClick={async () => { deactivateKid(); await signOut(); }}>退出登录</button>
      </div>
      {err && <div style={{color: 'var(--red)', fontWeight: 800}}>{err}</div>}
      <div className="kicker">谁来玩？</div>
      <div className="row wrap">
        {kids === null && <span className="muted">读取中…</span>}
        {kids?.map(kid => {
          const active = activeKid?.id === kid.id;
          return (
            <div key={kid.id} className={'panel' + (active ? ' tone' : '')} style={{padding: 12, minWidth: 150, cursor: 'pointer', outline: active ? '4px solid var(--red)' : 'none'}}
              onClick={() => (active ? null : kid.pin ? setPinFor(kid) : choose(kid))}>
              <div className="row" style={{gap: 10}}>
                <Avatar color={kid.avatar} name={kid.nickname}/>
                <div className="col" style={{gap: 2}}>
                  <strong style={{fontSize: 18}}>{kid.nickname}</strong>
                  <span className="muted" style={{fontSize: 12}}>{busyId === kid.id ? '读取存档…' : active ? '正在玩 ✓' : kid.pin ? '🔒 有 PIN' : '点我开始'}</span>
                </div>
              </div>
              <button className="btn small ghost" style={{marginTop: 6, padding: '2px 6px', fontSize: 12}} onClick={e => { e.stopPropagation(); remove(kid); }}>删除</button>
            </div>
          );
        })}
        {!adding && <button className="btn" onClick={() => setAdding(true)}>＋ 新建孩子档案</button>}
      </div>
      {adding && <NewKidForm onCancel={() => setAdding(false)} onDone={kid => { setAdding(false); refresh(); choose(kid); }}/>}
      {pinFor && <PinPrompt kid={pinFor} onCancel={() => setPinFor(null)} onOk={() => { const k = pinFor; setPinFor(null); choose(k); }}/>}
    </div>
  );
}

export default function AccountPanel() {
  const [googleReady, setGoogleReady] = useState(null); // null = checking
  const [session, setSession] = useState(undefined);    // undefined = loading

  useEffect(() => {
    if (!isConfigured()) { setGoogleReady(false); return; }
    let live = true;
    providerEnabled('google').then(ok => live && setGoogleReady(ok));
    getSession().then(({data}) => {
      if (!live) return;
      setSession(data);
      if (data && !restoreTried) { restoreTried = true; restoreLastKid(); }
    });
    const off = onAuthChange(s => live && setSession(s));
    return () => { live = false; off(); };
  }, []);

  if (googleReady === false && !session) return <GuestPanel googleReady={false}/>;
  if (session) return <ParentPanel session={session}/>;
  if (googleReady === null || session === undefined) return <GuestPanel googleReady/>;
  return (
    <div className="col">
      <div className="panel mt2" style={{padding: '12px 18px'}}>
        <div className="row wrap center">
          <button className="btn yellow" onClick={() => signInWithGoogle()}>家长用 Google 登录</button>
          <span className="muted" style={{fontSize: 13}}>登录后可以给孩子建档案、云端保存进度</span>
        </div>
      </div>
      <GuestPanel googleReady/>
    </div>
  );
}
