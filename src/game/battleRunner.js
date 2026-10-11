export const slimSample = sample => ({time:sample.time, bodies:sample.bodies.map(body => ({p:body.p, q:body.q, rpm:body.rpm, tilt:body.tilt}))});

// Runs one streamed battle at a time; cancellation belongs to an individual request.
export function createBattleRunner({load, Battle, postMessage, yieldNow}) {
  let current = null;
  return {
    cancel(id) { if (current === id) current = null; },
    async run(msg) {
      const id = msg.id;
      current = id;
      let battle;
      try {
        const module = await load();
        if (current !== id) return;
        battle = new Battle(module, {beys:msg.beys, launches:msg.launches, maxTime:msg.maxTime});
        let sent = 0, evSent = 0;
        const sendChunk = () => {
          postMessage({type:'chunk', id, samples:battle.samples.slice(sent).map(slimSample), events:battle.events.slice(evSent)});
          sent = battle.samples.length;
          evSent = battle.events.length;
        };
        while (!battle.ended) {
          if (current !== id) return;
          battle.advance(500);
          sendChunk();
          await yieldNow();
        }
        if (current !== id) return;
        sendChunk();
        postMessage({type:'done', id, result:battle.ended, summary:battle.summary()});
      } catch (error) {
        if (current === id) postMessage({type:'error', id, message:String(error?.message || error)});
      } finally {
        battle?.dispose();
      }
    },
  };
}
