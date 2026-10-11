import test from 'node:test';
import assert from 'node:assert/strict';
import {joinRoom} from '../src/net/room.js';
import {installGlobal} from './helpers/fakes.mjs';

function setup(t, handlers = {}) {
  t.mock.timers.enable({apis: ['setTimeout', 'setInterval']});
  const sockets = [];
  class Socket {
    constructor() { this.readyState = 0; this.sent = []; sockets.push(this); }
    send(raw) { this.sent.push(JSON.parse(raw)); }
    open() { this.readyState = 1; this.onopen(); }
    close() { this.readyState = 3; this.onclose(); }
    receive(message) { this.onmessage({data: JSON.stringify(message)}); }
  }
  installGlobal(t, 'WebSocket', Socket);
  const api = joinRoom('ABCDE', {nickname: 'A', pid: 'A'}, handlers);
  return {api, sockets};
}

test('client queues actions until connected and joins before sending them', t => {
  const {api, sockets} = setup(t);
  api.ready({rpm: 5000});
  sockets[0].open();
  assert.deepEqual(sockets[0].sent.map(m => m.type), ['join', 'ready']);
  assert.equal(sockets[0].sent[1].launch.rpm, 5000);
});

test('client reconnects after an unexpected disconnect', t => {
  const {sockets} = setup(t);
  sockets[0].open(); sockets[0].close();
  t.mock.timers.tick(500);
  assert.equal(sockets.length, 2);
  sockets[1].open();
  assert.equal(sockets[1].sent[0].pid, 'A');
});

test('leaving during the reconnect delay never reopens the room', t => {
  const {api, sockets} = setup(t);
  sockets[0].open(); sockets[0].close();
  api.leave();
  t.mock.timers.tick(8000);
  assert.equal(sockets.length, 1, 'leaving must cancel an already scheduled reconnect');
});

test('a room rejection does not start a reconnect loop', t => {
  const errors = [];
  const {sockets} = setup(t, {onError: e => errors.push(e.code)});
  sockets[0].open();
  sockets[0].receive({type: 'error', code: 'full'});
  sockets[0].close();
  t.mock.timers.tick(8000);
  assert.deepEqual(errors, ['full']);
  assert.equal(sockets.length, 1);
});
