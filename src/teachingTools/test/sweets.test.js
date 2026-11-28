'use strict';

const test = require('node:test');
const assert = require('node:assert');
const core = require('../public/low-prep/sweets/sweets-core');
const shared = require('../public/low-prep/escape-the-path/escape-the-path-core');

function game(teams = 2) {
  return core.newGame({ teams, shared, zh: true });
}
const first = (kind, from = 1) => core.BOARD.findIndex((sq, i) => i >= from && sq[2] === kind);
function landOn(s, i) {
  core.current(s).pos = i - 1;
  return core.roll(s, 1);
}

test('board: 起点 to 完成; slides and moon paths point at real squares', () => {
  assert.equal(core.BOARD[0][2], 'start');
  assert.equal(core.BOARD[core.FINISH][2], 'finish');
  core.BOARD.forEach((sq, i) => {
    if (sq[2] === 'slide' || sq[2] === 'moon') assert.ok(sq[3] >= 0 && sq[3] < core.FINISH && sq[3] !== i);
    assert.ok(sq[0] > 0 && sq[0] < core.FRAME.w && sq[1] > 0 && sq[1] < core.FRAME.h);
  });
});

test('普通 and 抽卡: right stays, wrong goes back one', () => {
  const s = game();
  const c = first('card');
  landOn(s, c);
  assert.equal(s.phase, 'card');
  core.judge(s, false);
  assert.equal(core.current(s).pos, c - 1);
  const t = game();
  const p = first('plain');
  landOn(t, p);
  core.judge(t, true);
  assert.equal(core.current(t).pos, p);
});

test('再走一步 steps on, 再来一次 rolls again, 黑洞 goes back to the row start', () => {
  const s = game();
  const st = first('step');
  landOn(s, st);
  assert.ok(core.current(s).pos >= st + 1);
  const t = game();
  landOn(t, first('again'));
  assert.equal(t.phase, 'roll');
  const u = game();
  const h = first('hole', 10);
  landOn(u, h);
  assert.equal(core.current(u).pos, core.ROW_START[h]);
});

test('slides and moonlight paths jump to their square', () => {
  const s = game();
  const sl = first('slide');
  landOn(s, sl);
  assert.ok(core.current(s).pos !== sl);
  const t = game();
  const m = first('moon');
  landOn(t, m);
  assert.ok(core.current(t).pos > m);
});

test('three places end the game', () => {
  const s = game(4);
  for (let p = 1; p <= 3; p++) {
    s.turn = p - 1;
    s.phase = 'roll';
    s.teams[p - 1].pos = core.FINISH - 1;
    core.roll(s, 1);
    assert.equal(s.teams[p - 1].place, p);
  }
  assert.equal(s.phase, 'over');
  assert.equal(shared.template({ cards: '题|答', game: 'sweets' }).game, 'sweets');
});
