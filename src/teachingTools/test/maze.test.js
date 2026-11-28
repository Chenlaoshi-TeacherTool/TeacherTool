'use strict';

const test = require('node:test');
const assert = require('node:assert');
const core = require('../public/low-prep/maze/maze-core');
const shared = require('../public/low-prep/escape-the-path/escape-the-path-core');

function game(teams = 2) {
  return core.newGame({ teams, shared, zh: true });
}
const first = (kind, from = 1) => core.BOARD.findIndex((sq, i) => i >= from && sq[2] === kind);
// put the team so a roll of 1 (2 steps) lands on square i
function landOn(s, i) {
  core.current(s).pos = i - core.STEP_FACTOR;
  return core.roll(s, 1);
}

test('board: spiral from 开始 to 终点, every square on the board', () => {
  assert.equal(core.BOARD[0][2], 'start');
  assert.equal(core.BOARD[core.FINISH][2], 'finish');
  assert.ok(core.BOARD.length > 150);
  core.BOARD.forEach((sq) => assert.ok(sq[0] > 0 && sq[0] < core.FRAME.w && sq[1] > 0 && sq[1] < core.FRAME.h));
});

test('a roll moves twice the number', () => {
  const s = game();
  core.roll(s, 3);
  assert.equal(core.current(s).pos, 6);
});

test('词语: right earns the square money, wrong loses $5 (never below $0)', () => {
  const s = game();
  const team = core.current(s);
  const w = first('word', 3);
  landOn(s, w);
  assert.equal(s.qkind, 'word');
  core.judge(s, true);
  assert.equal(team.money, core.BOARD[w][3]);
  const t = game();
  landOn(t, w);
  core.judge(t, false);
  assert.equal(core.current(t).money, 0);
});

test('star, -10, sad, skip(N), skip, jail, black hole', () => {
  const s = game();
  landOn(s, first('star', 3));
  assert.ok(core.current(s).money >= 100);
  const t = game();
  core.current(t).money = 50;
  landOn(t, first('minus', 3));
  assert.equal(core.current(t).money, 40);
  const u = game();
  const sk = first('skipn', 3);
  landOn(u, sk);
  assert.equal(core.current(u).pos, sk + core.BOARD[sk][3]);
  const v = game();
  landOn(v, first('jail', 3));
  assert.ok(core.current(v).skip);
  const w = game();
  const hole = first('hole');
  landOn(w, hole);
  assert.equal(core.current(w).pos, hole - core.BACK);
});

test('slide: right slides forward 5', () => {
  const s = game();
  const sl = first('slide', 3);
  landOn(s, sl);
  assert.equal(s.qkind, 'slide');
  core.judge(s, true);
  assert.equal(core.current(s).pos, sl + core.SLIDE);
});

test('finish pays $1000/$500/$300; three in ends the game, ranked by money', () => {
  const s = game(4);
  s.teams[3].money = 5000;
  for (let p = 1; p <= 3; p++) {
    s.turn = p - 1;
    s.phase = 'roll';
    s.teams[p - 1].pos = core.FINISH - 2;
    core.roll(s, 1);
    assert.equal(s.teams[p - 1].money, core.PRIZES[p - 1]);
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.places[0], 3);         // most money wins
  assert.equal(shared.template({ cards: '题|答', game: 'maze' }).game, 'maze');
});
