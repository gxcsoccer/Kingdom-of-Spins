// Own the sequence timer separately from each moment's speech/effect timers.
export function createMomentPlayback({play, onPlaying = () => {}, interval = 7600}) {
  let timer = null, generation = 0, playing = false;
  const stop = () => {
    ++generation;
    clearTimeout(timer); timer = null;
    if (playing) { playing = false; onPlaying(false); }
  };
  return {
    stop,
    start(moments) {
      stop();
      if (!moments.length) return;
      const run = ++generation, items = [...moments];
      let i = 0;
      playing = true; onPlaying(true);
      const next = () => {
        if (run !== generation) return;
        if (i === items.length) { stop(); return; }
        play(items[i++]);
        if (run === generation) timer = setTimeout(next, interval);
      };
      timer = setTimeout(next, 0);
    },
  };
}
