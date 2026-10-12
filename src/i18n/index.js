import en from './en.json' with {type: 'json'};

export const LOCALES = ['zh-CN', 'en'];
export const LOCALE_KEY = 'kos.locale';
export const normalizeLocale = value => /^en(?:[-_]|$)/i.test(String(value || '')) ? 'en' : 'zh-CN';
export function detectLocale(storage, languages = globalThis.navigator?.languages) {
  try { const saved = (storage ?? globalThis.localStorage)?.getItem(LOCALE_KEY); if (LOCALES.includes(saved)) return saved; } catch {}
  // Only English and Chinese are supported; keep Chinese for other browser languages.
  return normalizeLocale(languages?.[0]);
}
let locale = typeof window === 'undefined' ? 'zh-CN' : detectLocale();
export const getLocale = () => locale;
export const speechLocale = () => locale === 'en' ? 'en-US' : 'zh-CN';
export function setLocale(value) {
  if (!LOCALES.includes(value)) return false;
  locale = value;
  try { globalThis.localStorage?.setItem(LOCALE_KEY, value); } catch {}
  applyDocumentLocale();
  return true;
}
export function applyDocumentLocale() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.title = locale === 'en' ? 'Kingdom of Spins' : 'Kingdom of Spins · 陀螺王国';
}
applyDocumentLocale();

export function translate(source, values = [], language = locale) {
  const text = language === 'en' ? (en[source] ?? source) : source;
  return String(text).replace(/\{(\d+)\}/g, (token, n) => n in values ? String(values[n] ?? '') : token);
}
export const tr = translate;

// Old saves and deterministic server templates contain source-language prose. Translate only
// known messages, without changing IDs, verdict enums, or unknown text written by a player.
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const textPatterns = entries => entries.filter(([key]) => /\{\d+\}/.test(key)).map(([key, value]) => {
  const parts = key.split(/(\{\d+\})/g), slots = [];
  const pattern = parts.map(p => /^\{\d+\}$/.test(p) ? (slots.push(Number(p.slice(1,-1))), '([\\s\\S]*?)') : escape(p)).join('');
  return {re: new RegExp('^' + pattern + '$'), slots, value, specificity: key.replace(/\{\d+\}/g, '').length};
}).sort((a,b) => b.specificity - a.specificity);
const patterns = textPatterns(Object.entries(en));
export function translateText(text, language = locale, depth = 0) {
  if (language !== 'en' || typeof text !== 'string' || !/[\u3400-\u9fff]/.test(text)) return text;
  if (Object.hasOwn(en, text)) return en[text];
  if (depth >= 6) return text;
  for (const {re, slots, value} of patterns) {
    const match = re.exec(text);
    if (!match) continue;
    const values = [];
    slots.forEach((slot, i) => { values[slot] = translateText(match[i+1], language, depth+1); });
    return value.replace(/\{(\d+)\}/g, (token,n) => n in values ? values[n] : token);
  }
  const parts = text.split(/([：、\n])/);
  if (parts.length > 1) return parts.map(p => p === '：' ? ': ' : p === '、' ? ', ' : translateText(p, language, depth+1)).join('');
  return text;
}
const identityFields = new Set(['id', 'uid', 'key', 'verdict', 'nickname', 'kidId', 'bladerId', 'beyId', 'cardId', 'quizId', 'sceneKey', 'image', 'imagePrompt', 'imageDataUrl', 'url']);
export function localizeTextFields(value, language = locale) {
  if (typeof value === 'string') return translateText(value, language);
  if (Array.isArray(value)) return value.map(v => localizeTextFields(v, language));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key,v]) => [key, identityFields.has(key) ? v : localizeTextFields(v, language)]));
}

// Only for authored prose stored in a save, never player names or identifiers.
// Saves may contain either language after switching back and forth.
const sourceByEnglish = Object.fromEntries(Object.entries(en).reverse().map(([source, english]) => [english, source]));
const sourcePatterns = textPatterns(Object.entries(sourceByEnglish));
export function translateSavedText(text, language = locale, depth = 0) {
  if (language === 'en') return translateText(text, language);
  if (typeof text !== 'string') return text;
  if (Object.hasOwn(sourceByEnglish, text)) return sourceByEnglish[text];
  if (depth >= 6) return text;
  for (const {re, slots, value} of sourcePatterns) {
    const match = re.exec(text);
    if (!match) continue;
    const values = [];
    slots.forEach((slot, i) => { values[slot] = translateSavedText(match[i+1], language, depth+1); });
    return value.replace(/\{(\d+)\}/g, (token,n) => n in values ? values[n] : token);
  }
  return text;
}

export function limitText(value, chineseLimit) {
  const text = String(value ?? '').trim();
  const limit = /[\u3400-\u9fff]/.test(text) ? chineseLimit : chineseLimit * 5;
  if (text.length <= limit) return text;
  let end = text.slice(0, limit - 1);
  if (!/[\u3400-\u9fff]/.test(text)) end = end.replace(/\s+\S*$/, '');
  return end + '…';
}
export function speechVoice(synth = globalThis.speechSynthesis, language = speechLocale()) {
  const voices = synth?.getVoices?.() || [];
  return voices.find(v => v.lang.toLowerCase() === language.toLowerCase())
    || voices.find(v => v.lang.toLowerCase().startsWith(language.slice(0,2))) || null;
}
