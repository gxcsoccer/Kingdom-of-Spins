import ZH from './voiceClips.json' with {type:'json'};
import EN from './voiceClips.en.json' with {type:'json'};
import {voKey} from './voiceKey.js';
export function clipFile(text, locale, voice = 'doctor') {
  return locale === 'en' ? EN[voice]?.[voKey(text)] : ZH[voKey(text)];
}
