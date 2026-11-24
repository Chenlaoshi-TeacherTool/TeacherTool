'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createRegistry } = require('../services/boardRooms');

const words = [
  { zh: '猫', py: 'māo', en: 'cat' }, { zh: '狗', py: 'gǒu', en: 'dog' }, { zh: '鸟', py: 'niǎo', en: 'bird' },
  { zh: '鱼', py: 'yú', en: 'fish' }, { zh: '马', py: 'mǎ', en: 'horse' }, { zh: '牛', py: 'niú', en: 'cow' }
];

function fakeRes() { return { out: [], write(s) { this.out.push(s); }, end() { this.ended = true; } }; }
function last(res) {
  const msg = res.out.filter((s) => s.startsWith('data: ')).pop();
  return JSON.parse(msg.slice(6));
}

function room(board, extra) {
  const rolls = [];
  const reg = createRegistry({ random: (n) => (rolls.length ? rolls.shift() % n : 0) });
  const created = reg.create(Object.assign({ data: { board, words, options: { seed: 7 } }, teams: ['红队', '蓝队'] }, extra), 'owner');
  return { reg, room: created, rolls };
}

test('students join teams, the teacher starts, and only the active student may roll', () => {
  const { reg, room: r } = room('path');
  const a = reg.join(r.code, 'Ana', 0).player;
  const b = reg.join(r.code, 'Ben', 1).player;
  assert.throws(() => reg.act(r.code, a.token, { type: 'start' }), { status: 400 });
  reg.act(r.code, r.hostToken, { type: 'start' });
  assert.equal(r.status, 'playing');
  assert.throws(() => reg.act(r.code, b.token, { type: 'roll' }), { status: 409 });
  reg.act(r.code, a.token, { type: 'roll' });
  assert.ok(r.teams[0].pos > 0);
});

test('the answer stays on the server; a right answer keeps the move, a wrong one goes back', () => {
  const { reg, room: r } = room('line');
  const a = reg.join(r.code, 'Ana', 0).player;
  const b = reg.join(r.code, 'Ben', 1).player;
  reg.act(r.code, r.hostToken, { type: 'start' });
  const res = fakeRes();
  reg.listen(r.code, a.token, res);
  const wordSquare = r.layout.squares.find((sq) => sq.kind === 'word');
  reg.act(r.code, a.token, { type: 'claim', square: wordSquare.i });
  const seen = last(res);
  assert.equal(seen.pending.type, 'question');
  assert.equal(seen.pending.choices.length, 3);
  assert.equal(seen.pending.answer, undefined, 'students never see the answer');
  const hostView = reg.view(r, { role: 'host' });
  assert.equal(typeof hostView.pending.answer, 'number');
  reg.act(r.code, a.token, { type: 'answer', choice: hostView.pending.answer });
  assert.equal(r.claims[wordSquare.i], 0);
  assert.equal(r.turn, 1);
  assert.throws(() => reg.act(r.code, b.token, { type: 'claim', square: wordSquare.i }), { status: 409 });
});

test('task and action squares wait for the teacher to judge', () => {
  const { reg, room: r } = room('line', { data: { board: 'line', words, options: { seed: 3, tasks: true, taskRate: 40 } } });
  const a = reg.join(r.code, 'Ana', 0).player;
  reg.join(r.code, 'Ben', 1);
  reg.act(r.code, r.hostToken, { type: 'start' });
  const task = r.layout.squares.find((sq) => sq.kind === 'task');
  reg.act(r.code, a.token, { type: 'claim', square: task.i });
  assert.equal(r.pending.type, 'judge');
  assert.throws(() => reg.act(r.code, a.token, { type: 'answer', choice: 0 }), { status: 409 });
  reg.act(r.code, r.hostToken, { type: 'judge', correct: true });
  assert.equal(r.claims[task.i], 0);
});

test('a wrong answer sends the pawn back when that option is on', () => {
  const { reg, room: r, rolls } = room('path', { data: { board: 'path', words, options: { seed: 11, specials: false } } });
  const a = reg.join(r.code, 'Ana', 0).player;
  reg.join(r.code, 'Ben', 1);
  reg.act(r.code, r.hostToken, { type: 'start' });
  rolls.push(2); // die shows 3
  reg.act(r.code, a.token, { type: 'roll' });
  assert.equal(r.teams[0].pos, 3);
  const wrong = (r.pending.answer + 1) % 3;
  reg.act(r.code, a.token, { type: 'answer', choice: wrong });
  assert.equal(r.teams[0].pos, 0);
});

test('teams nobody joined drop out when the game starts; rooms per host are capped', () => {
  const reg = createRegistry();
  const r = reg.create({ data: { board: 'path', words }, teams: ['A', 'B', 'C'] }, 'me');
  reg.join(r.code, 'Ana', 2);
  reg.act(r.code, r.hostToken, { type: 'start' });
  assert.equal(r.teams.length, 1);
  assert.equal(r.players[0].team, 0);
  for (let i = 0; i < 4; i++) reg.create({ data: { board: 'path', words }, teams: ['A', 'B'] }, 'me');
  assert.equal(reg.size(), reg.LIMITS.roomsPerHost);
});

test('bad input is refused: fewer than 4 words, one team, foreign picture links', () => {
  const reg = createRegistry();
  assert.throws(() => reg.create({ data: { words: words.slice(0, 3) }, teams: ['A', 'B'] }, 'me'), { status: 400 });
  assert.throws(() => reg.create({ data: { words }, teams: ['A'] }, 'me'), { status: 400 });
  const r = reg.create({ data: { words }, teams: ['A', 'B'], pictures: { 猫: 'https://evil.example/x.svg', 狗: 'https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg/1F415.svg' } }, 'me');
  assert.deepEqual(Object.keys(r.pictures), ['狗']);
  assert.throws(() => reg.join(r.code, '   ', 0), { status: 400 });
  assert.throws(() => reg.join('000000', 'Ana', 0), { status: 404 });
});

test('only members open rooms, writes need the page header, and events stream the state', async () => {
  const express = require('express');
  const routes = require('../routes/boardRooms');
  const registry = createRegistry();
  let member = false;
  const app = express();
  app.use(routes.create({ registry, limits: { canHostOnlineRooms: async () => member }, owner: () => 'me' }));
  const server = app.listen(0);
  const origin = 'http://127.0.0.1:' + server.address().port;
  const post = (path, body, headers) => fetch(origin + path, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'X-Board-Request': 'yes' }, headers), body: JSON.stringify(body) });
  try {
    const body = { data: { board: 'path', words }, teams: ['A', 'B'] };
    let res = await post('/api/board-rooms', body);
    assert.equal(res.status, 403);
    assert.equal((await res.json()).membersOnly, true);
    member = true;
    res = await post('/api/board-rooms', body, { 'X-Board-Request': 'no' });
    assert.equal(res.status, 403);
    res = await post('/api/board-rooms', body);
    assert.equal(res.status, 201);
    const created = await res.json();
    assert.match(created.code, /^\d{6}$/);
    const peek = await (await fetch(origin + '/api/board-rooms/' + created.code)).json();
    assert.equal(peek.teams.length, 2);
    const joined = await (await post('/api/board-rooms/' + created.code + '/join', { name: 'Ana', team: 0 })).json();
    const controller = new AbortController();
    const stream = await fetch(origin + '/api/board-rooms/' + created.code + '/events?token=' + joined.token, { signal: controller.signal });
    assert.match(stream.headers.get('content-type'), /text\/event-stream/);
    const reader = stream.body.getReader();
    let text = '';
    while (!text.includes('data: ')) text += new TextDecoder().decode((await reader.read()).value);
    const state = JSON.parse(text.split('data: ')[1].split('\n')[0]);
    assert.equal(state.you.name, 'Ana');
    assert.equal(state.status, 'lobby');
    controller.abort();
  } finally {
    server.close();
    server.closeAllConnections && server.closeAllConnections();
  }
});
