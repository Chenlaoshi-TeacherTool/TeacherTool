'use strict';

const test = require('node:test');
const assert = require('node:assert');
const core = require('../public/low-prep/mpy/mpy-core');
const shared = require('../public/low-prep/escape-the-path/escape-the-path-core');

function game(teams = 2, laps = 2) {
  return core.newGame({ teams, laps, shared, zh: true });
}
const first = (pred) => core.BOARD.findIndex((sq, i) => i > 0 && pred(sq));
function landOn(s, i) {
  core.current(s).pos = (i - 1 + core.BOARD.length) % core.BOARD.length;
  return core.roll(s, 1);
}

test('board: start, jail and go-to-jail corners; land has prices', () => {
  assert.equal(core.BOARD[0][2], 'start');
  assert.equal(core.BOARD[core.JAIL][2], 'jail');
  assert.ok(first((sq) => sq[2] === 'gojail') > core.JAIL);
  core.BOARD.forEach((sq) => {
    if (sq[2] === 'prop') assert.ok(sq[3] > 0);
    assert.ok(sq[0] > 0 && sq[0] < core.FRAME.w && sq[1] > 0 && sq[1] < core.FRAME.h);
  });
});

test('a square with a Chinese word asks about that word; right lets you buy it', () => {
  const s = game();
  const team = core.current(s);
  const sq = first((x) => x[2] === 'prop' && x[4]);
  landOn(s, sq);
  assert.equal(s.qkind, 'buy');
  assert.equal(core.cardFor(s, true).q, core.BOARD[sq][4]);
  core.judge(s, true);
  core.choose(s, 1);
  assert.equal(s.owner[sq], team.id);
  assert.equal(team.money, core.START_MONEY - core.BOARD[sq][3]);
  const plain = first((x) => x[2] === 'prop' && !x[4]);
  const t = game();
  landOn(t, plain);
  assert.equal(core.cardFor(t, true), null);
});

test('rent is a fifth of the price, rounded to 10', () => {
  const s = game(2);
  const sq = first((x) => x[2] === 'prop' && x[3] === 770);
  assert.equal(core.rent(sq), 150);
  s.owner[sq] = 1;
  landOn(s, sq);
  assert.equal(s.teams[0].money, core.START_MONEY - 150);
  assert.equal(s.teams[1].money, core.START_MONEY + 150);
});

test('go to jail: off to the jail corner, then wait a turn or pay M50', () => {
  const s = game(2);
  const team = core.current(s);
  landOn(s, first((x) => x[2] === 'gojail'));
  assert.equal(team.pos, core.JAIL);
  assert.equal(team.jail, 1);
  core.next(s);                 // team 1
  s.phase = 'next';
  core.next(s);                 // back to team 0, in jail
  assert.equal(s.phase, 'jail');
  core.useRv(s);
  assert.equal(team.money, core.START_MONEY - core.JAIL_FEE);
  assert.equal(s.phase, 'roll');
  const t = game(2);
  t.teams[0].jail = 1;
  t.turn = 1;
  t.phase = 'next';
  core.next(t);
  core.wait(t);
  assert.equal(t.teams[0].jail, 0);
});

test('passing Start pays M200; laps end the game', () => {
  const s = game(2, 1);
  s.teams[0].pos = core.BOARD.length - 1;
  core.roll(s, 1);
  assert.equal(s.teams[0].money, core.START_MONEY + core.SALARY);
  assert.ok(s.teams[0].done);
  s.phase = 'next';
  core.next(s);
  s.teams[1].pos = core.BOARD.length - 1;
  core.roll(s, 1);
  assert.equal(s.phase, 'over');
  assert.equal(shared.template({ cards: '题|答', game: 'mpy' }).game, 'mpy');
});

test('the teacher can choose the words on the land squares; empty keeps the student\'s', () => {
  const words = core.parseWords('苹果\n香蕉，西瓜');
  const s = core.newGame({ teams: 2, words });
  const [a, b, , d] = core.WORD_SQUARES;
  assert.equal(core.phrase(a, s), '苹果');
  assert.equal(core.phrase(b, s), '香蕉');
  assert.equal(core.phrase(d, s), '苹果');
  assert.equal(core.phrase(a, core.newGame({ teams: 2 })), core.DEFAULT_WORDS[0]);
  core.current(s).pos = b - 1;
  core.roll(s, 1);
  assert.equal(core.cardFor(s, true).q, '香蕉');
});
