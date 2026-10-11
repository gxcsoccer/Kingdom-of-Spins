// A component's delayed work may finish only while its owner and generation are current.
export function createTaskScope(getOwner = () => undefined) {
  let active = true, generation = 0;
  const timers = new Set();
  const ticket = () => {
    const version = generation, owner = getOwner();
    return () => active && version === generation && owner === getOwner();
  };
  const cancel = () => {
    generation++;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
  return {
    ticket,
    cancel,
    begin() { cancel(); return ticket(); },
    schedule(callback, ms) {
      if (!active) return;
      const current = ticket();
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (current()) callback();
      }, ms);
      timers.add(timer);
      return timer;
    },
    dispose() { active = false; cancel(); },
    resume() { cancel(); active = true; },
  };
}
