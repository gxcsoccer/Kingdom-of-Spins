// Browser speech recognition helper (Chrome/Edge/Safari). Returns null when unsupported.
export const voiceSupported=()=>typeof window!=='undefined'&&!!(window.SpeechRecognition||window.webkitSpeechRecognition);
export function listen({lang='en-US',onText,onEnd,continuous=true}={}){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return null;
  const r=new SR();r.lang=lang;r.continuous=continuous;r.interimResults=true;
  r.onresult=e=>{let t='';for(let i=e.resultIndex;i<e.results.length;i++)t+=e.results[i][0].transcript;onText?.(t,e);};
  r.onend=()=>onEnd?.();r.onerror=()=>{};
  try{r.start();}catch{}
  return {stop:()=>{try{r.stop();}catch{}}};
}
