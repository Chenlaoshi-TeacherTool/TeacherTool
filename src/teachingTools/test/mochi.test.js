'use strict';

const test = require('node:test');
const assert = require('node:assert');
const core = require('../public/low-prep/mochi/mochi-core');
const shared = require('../public/low-prep/escape-the-path/escape-the-path-core');

function game(teams = 2) {
  return core.newGame({ teams, shared, zh: true });
}
const kindAt = (k) => core.BOARD.findIndex((s) => s[2] === k);

test('board: 16 squares, links both ways, every square reaches the exit', () => {
  assert.equal(core.BOARD.length, 16);
  assert.equal(core.BOARD[0][2], 'start');
  assert.equal(core.BOARD[core.FINISH][2], 'finish');
  core.ADJ.forEach((ns, a) => ns.forEach((b) => assert.ok(core.ADJ[b].includes(a))));
  core.DIST.forEach((d, i) => assert.ok(Number.isFinite(d), 'square ' + i));
  ['q1', 'q2', 'q3', 'action', 'step'].forEach((k) => assert.ok(kindAt(k) >= 0, k));
});

test('a colour card goes to the nearest square of that colour', () => {
  for (let face = 1; face <= 4; face++) {
    const s = game();
    const colour = core.FACES[face];
    const near = core.nearest(0, colour);
    core.roll(s, face);
    if (near.length > 1) {
      assert.equal(s.phase, 'fork');
      assert.deepEqual(s.options.map((o) => o.to).sort(), near.slice().sort());
    } else {
      assert.equal(core.current(s).pos, near[0]);
    }
  }
});

test('6 steps to a chosen neighbour; a plain square asks a card, wrong goes back', () => {
  const s = game();
  const team = core.current(s);
  core.roll(s, 6);
  assert.equal(s.phase, 'fork');
  const plain = s.options.find((o) => core.BOARD[o.to][2] === 'plain');
  core.choose(s, plain.to);
  assert.equal(s.phase, 'card');
  core.judge(s, false);
  assert.equal(team.pos, 0);
});

test('L1 right = an extra step, L2 right = a shield, L3 right = an action card', () => {
  for (const [k, check] of [['q1', (s) => s.phase === 'fork' && s.mode === 'extra'], ['q2', (s) => core.current(s).shield === 1],
    ['q3', (s) => core.current(s).actions.length === 1]]) {
    const s = game();
    const team = core.current(s);
    const sq = kindAt(k);
    team.pos = core.ADJ[sq][0];
    s.phase = 'fork'; s.mode = 'step'; s.options = [{ to: sq, ok: true }];
    core.choose(s, sq);
    assert.equal(s.phase, 'card');
    core.judge(s, true);
    assert.ok(check(s), k);
  }
});

test('alarm: right rescues a salamander; wrong goes back one unless a shield blocks', () => {
  const s = game();
  const team = core.current(s);
  team.pos = 8;
  core.roll(s, 5);
  assert.equal(s.phase, 'alarm');
  core.judge(s, true);
  assert.equal(team.rescued, 1);
  const t = game();
  const other = core.current(t);
  other.pos = 8;
  core.roll(t, 5);
  core.judge(t, false);
  assert.ok(core.DIST[other.pos] > core.DIST[8]);
  const u = game();
  const safe = core.current(u);
  safe.pos = 8; safe.shield = 1;
  core.roll(u, 5);
  core.judge(u, false);
  assert.equal(safe.pos, 8);
  assert.equal(safe.shield, 0);
});

test('action cards wait a round and need a right answer', () => {
  const s = game();
  const team = core.current(s);
  team.actions.push({ card: 'again', round: s.round });
  assert.equal(core.canBuy(s), false);
  s.round += 1;
  assert.equal(core.canBuy(s), true);
  core.buyRv(s);
  core.judge(s, false);
  assert.equal(team.actions.length, 1);
  core.buyRv(s);
  core.judge(s, true);
  assert.equal(team.actions.length, 0);
  assert.equal(team.again, true);
  s.phase = 'next';
  core.next(s);
  assert.equal(core.current(s), team);
  assert.equal(s.phase, 'roll');
});

test('reaching the exit takes places; three places end the game', () => {
  const s = game(4);
  const beside = core.ADJ[core.FINISH][0];
  for (let p = 1; p <= 3; p++) {
    s.turn = p - 1;
    s.phase = 'roll';
    s.teams[p - 1].pos = beside;
    core.roll(s, 6);
    core.choose(s, core.FINISH);
    assert.equal(s.teams[p - 1].place, p);
  }
  assert.equal(s.phase, 'over');
  assert.equal(shared.template({ cards: '题|答', game: 'mochi' }).game, 'mochi');
});
