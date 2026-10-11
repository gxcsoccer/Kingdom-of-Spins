// Own both speech recognition and the separate loudness stream, including pending permissions.
export function createMicrophoneSession({getUserMedia, startMeter, listen, onText, onEnd}) {
  let active = false, generation = 0, recognition = null, stopMeter = null;
  const stop = () => {
    if (!active) return;
    active = false;
    generation++;
    const rec = recognition, meter = stopMeter;
    recognition = stopMeter = null;
    try { rec?.stop(); } finally { try { meter?.(); } finally { onEnd?.(); } }
  };
  return {
    stop,
    get active() { return active; },
    async start() {
      stop();
      active = true;
      const version = ++generation;
      const current = () => active && generation === version;
      let stream;
      try {
        stream = await getUserMedia();
        if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
        const endMeter = startMeter(stream);
        stopMeter = () => {
          try { endMeter?.(); } finally { stream.getTracks().forEach(track => track.stop()); }
        };
      } catch {
        stream?.getTracks().forEach(track => track.stop());
        // Recognition can still work when a separate loudness stream is unavailable.
      }
      if (!current()) return;
      try {
        const rec = listen({onText: text => { if (current()) onText?.(text); }, onEnd: () => { if (current()) stop(); }});
        if (current()) { recognition = rec; if (!rec) stop(); }
        else rec?.stop();
      } catch { stop(); }
    },
  };
}
