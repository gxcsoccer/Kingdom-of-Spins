import {getLocale, setLocale} from './index.js';
import {hush} from '../game/voiceClips.js';
import './language.css';
export default function LanguagePicker() {
  return <label className="language-picker"><span aria-hidden="true">🌐</span><select aria-label="Language / 语言" value={getLocale()} onChange={e => {
    hush(); setLocale(e.target.value); location.reload();
  }}><option value="zh-CN">中文</option><option value="en">English</option></select></label>;
}
