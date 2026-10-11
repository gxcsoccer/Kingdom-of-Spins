import {playClip} from './voiceClips.js';
// Procedural battle audio (WebAudio) + spoken countdown. Uses /art/audio/*.mp3 if the user supplies them.
let ctx, master, muted=false, spinNodes=null;
const ac=()=>{if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=.55;master.connect(ctx.destination);}if(ctx.state==='suspended')ctx.resume();return ctx;};
export const setMuted=m=>{muted=m;if(master)master.gain.value=m?0:.55;};
export const isMuted=()=>muted;

function noise(dur){const c=ac(),b=c.createBuffer(1,c.sampleRate*dur,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const s=c.createBufferSource();s.buffer=b;return s;}
function env(g,t,a,peak,decay){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+decay);}

// Metallic clang: filtered noise transient + inharmonic partials, scaled by impact intensity.
export function clang(intensity=.5){
  if(muted)return;const c=ac(),t=c.currentTime,I=Math.max(.15,Math.min(1,intensity));
  const n=noise(.25),bp=c.createBiquadFilter(),g=c.createGain();bp.type='bandpass';bp.frequency.value=2500+I*2500;bp.Q.value=1.2;
  n.connect(bp).connect(g).connect(master);env(g,t,.002,.9*I,.12+.1*I);n.start(t);n.stop(t+.3);
  for(const [f,a] of [[880,1],[1390,.6],[2210,.45],[3170,.3]]){
    const o=c.createOscillator(),og=c.createGain();o.type='triangle';o.frequency.value=f*(1+(Math.random()-.5)*.04)*(I>.7?.85:1);
    o.connect(og).connect(master);env(og,t,.001,.18*a*I,.25+.35*I);o.start(t);o.stop(t+.8);
  }
  if(I>.7){const o=c.createOscillator(),og=c.createGain();o.type='sine';o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(40,t+.3);o.connect(og).connect(master);env(og,t,.002,.7,.3);o.start(t);o.stop(t+.4);}
}
export function whoosh(){
  if(muted)return;const c=ac(),t=c.currentTime,n=noise(.7),f=c.createBiquadFilter(),g=c.createGain();
  f.type='bandpass';f.Q.value=2;f.frequency.setValueAtTime(400,t);f.frequency.exponentialRampToValueAtTime(3000,t+.5);
  n.connect(f).connect(g).connect(master);env(g,t,.05,.6,.55);n.start(t);n.stop(t+.7);
}
export function beep(high=false){
  if(muted)return;const c=ac(),t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=high?1320:660;
  o.connect(g).connect(master);env(g,t,.005,.18,high?.5:.18);o.start(t);o.stop(t+.6);
}
export function fanfare(win=true){
  if(muted)return;const c=ac(),t0=c.currentTime,notes=win?[523,659,784,1047]:[392,349,311,262];
  notes.forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.type='sawtooth';o.frequency.value=f;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2400;o.connect(lp).connect(g).connect(master);env(g,t0+i*.13,.01,.16,i===3?.9:.2);o.start(t0+i*.13);o.stop(t0+i*.13+1.2);});
}
// Continuous spin hum: two detuned oscillators whose pitch follows rpm.
export function spinHum(on){
  if(muted&&on)return;const c=ac();
  if(on&&!spinNodes){const g=c.createGain();g.gain.value=.0;g.connect(master);const os=[0,1].map(()=>{const o=c.createOscillator();o.type='sawtooth';const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;o.connect(lp).connect(g);o.start();return o;});spinNodes={g,os};}
  if(!on&&spinNodes){spinNodes.g.gain.setTargetAtTime(0,c.currentTime,.05);const n=spinNodes;spinNodes=null;setTimeout(()=>n.os.forEach(o=>o.stop()),300);}
}
export function spinRpm(a=0,b=0){
  if(!spinNodes)return;const c=ac(),t=c.currentTime;
  spinNodes.os[0].frequency.setTargetAtTime(40+Math.abs(a)/30,t,.05);spinNodes.os[1].frequency.setTargetAtTime(42+Math.abs(b)/30,t,.05);
  spinNodes.g.gain.setTargetAtTime(Math.min(.05,(Math.abs(a)+Math.abs(b))/200000),t,.1);
}
export function say(text,lang='en-US',rate=1.15){
  if(muted)return;
  if(playClip(text))return;   // 预生成配音（队员招式名等）
  if(!window.speechSynthesis)return;try{const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=rate;u.pitch=1.15;speechSynthesis.cancel();speechSynthesis.speak(u);}catch{}
}
