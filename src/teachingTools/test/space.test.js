'use strict';

const test = require('node:test');
const assert = require('node:assert');
const core = require('../public/low-prep/space/space-core');
const shared = require('../public/low-prep/escape-the-path/escape-the-path-core');

function game(teams = 2) {
  return core.newGame({ teams, shared, zh: true });
}
// put the current team one roll of 1 before square i
function landOn(s, i) {
  core.current(s).pos = i - 1;
  return core.roll(s, 1);
}
const first = (kind, from = 1) => core.BOARD.findIndex((sq, i) => i >= from && sq[2] === kind);

test('board: start, loop, diagonal to 结果; every move stays on the board', () => {
  assert.equal(core.BOARD[0][2], 'start');
  assert.equal(core.BOARD[core.FINISH][2], 'finish');
  assert.ok(core.DIAG > 40 && core.DIAG < core.FINISH);
  core.BOARD.forEach((sq, i) => {
    assert.ok(sq[0] > 0 && sq[0] < core.FRAME.w && sq[1] > 0 && sq[1] < core.FRAME.h);
    if (sq[2] === 'fwd') assert.ok(i + sq[3] < core.FINISH);
  });
});

test('colour squares move once; the black hole goes back 6; the cobweb restarts', () => {
  const s = game();
  const fwd = first('fwd');
  const events = landOn(s, fwd);
  assert.ok(events.some((e) => e.type === 'move' && e.steps === 3));
  assert.equal(core.current(s).pos, fwd + 3);
  const t = game();
  const hole = first('hole');
  landOn(t, hole);
  assert.equal(core.current(t).pos, hole - 6);
  const u = game();
  landOn(u, first('web'));
  assert.equal(core.current(u).pos, 0);
});

test('拿卡片: right grows moon → dwarf planet → planet → star; wrong goes back one', () => {
  const s = game();
  const team = core.current(s);
  const card = first('card');
  for (let k = 1; k <= 5; k++) {
    s.phase = 'roll';
    landOn(s, card);
    assert.equal(s.phase, 'card');
    core.judge(s, true);
    assert.equal(team.level, Math.min(k, core.STAR));
  }
  s.phase = 'roll';
  landOn(s, card);
  core.judge(s, false);
  assert.equal(team.pos, card - 1);
});

test('rolling past 结果 goes back to the start of the diagonal', () => {
  const s = game();
  core.current(s).pos = core.FINISH - 2;
  const events = core.roll(s, 5);
  assert.ok(events.some((e) => e.type === 'overshoot'));
  assert.equal(core.current(s).pos, core.DIAG);
});

test('结果 needs a star: without one the team answers a card each turn there', () => {
  const s = game(2);
  const team = core.current(s);
  team.level = 3;
  team.pos = core.FINISH - 1;
  core.roll(s, 1);
  assert.equal(s.phase, 'card');
  assert.ok(s.quest);
  core.judge(s, false);
  assert.equal(team.pos, core.FINISH);            // a wrong answer keeps it on 结果
  core.next(s);                                  // other team
  s.phase = 'next';
  core.next(s);                                  // back to the waiting team: a card, not a roll
  assert.equal(s.phase, 'card');
  core.judge(s, true);
  assert.equal(team.place, 1);
});

test('three places end the game', () => {
  const s = game(4);
  for (let p = 1; p <= 3; p++) {
    s.turn = p - 1;
    s.phase = 'roll';
    s.teams[p - 1].pos = core.FINISH - 1;
    s.teams[p - 1].level = core.STAR;
    core.roll(s, 1);
    assert.equal(s.teams[p - 1].place, p);
  }
  assert.equal(s.phase, 'over');
  assert.equal(shared.template({ cards: '题|答', game: 'space' }).game, 'space');
});
