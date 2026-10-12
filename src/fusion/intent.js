// Spoken questions often arrive without punctuation. Keep design requests on the fusion path.
export function isScienceQuestion(value) {
  const text = String(value || '').trim();
  return /[？?]$|为什么|什么是|怎么|是什么|会不会/.test(text)
    || /^(?:why|how|what|which|where|when|who)\b/i.test(text);
}
