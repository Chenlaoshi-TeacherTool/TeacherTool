'use strict';

const test = require('node:test');
const assert = require('node:assert');
const core = require('../public/low-prep/money/money-core');
const shared = require('../public/low-prep/escape-the-path/escape-the-path-core');

function game(teams = 2, laps = 2) {
  return core.newGame({ teams, laps, shared, zh: true });
}
const first = (kind, from = 1) => core.BOARD.findIndex((sq, i) => i >= from && sq[2] === kind);
function landOn(s, i) {
  core.current(s).pos = (i - 1 + core.BOARD.length) % core.BOARD.length;
  return core.roll(s, 1);
}

test('board: a loop starting at 起点, every property has a price', () => {
  assert.equal(core.BOARD[0][2], 'start');
  core.BOARD.forEach((sq) => {
    if (sq[2] === 'prop') assert.ok([100, 150, 200].includes(sq[3]));
    assert.ok(sq[0] > 0 && sq[0] < core.FRAME.w && sq[1] > 0 && sq[1] < core.FRAME.h);
  });
  ['chance', 'banana', 'jail', 'plane'].forEach((k) => assert.ok(first(k) >= 0, k));
});

test('buying: right answer offers the property, buying pays the price', () => {
  const s = game();
  const team = core.current(s);
  const prop = first('prop');
  landOn(s, prop);
  assert.equal(s.phase, 'card');
  assert.equal(s.qkind, 'buy');
  core.judge(s, true);
  assert.equal(s.phase, 'fork');
  core.choose(s, 1);
  assert.equal(s.owner[prop], team.id);
  assert.equal(team.money, core.START_MONEY - core.BOARD[prop][3]);
  const t = game();
  landOn(t, prop);
  core.judge(t, false);
  assert.equal(t.owner[prop], -1);
  assert.equal(t.phase, 'next');
});

test('rent: landing on another team\'s property pays $100; a team that cannot pay is out', () => {
  const s = game(3);
  const prop = first('prop');
  s.owner[prop] = 1;
  const team = core.current(s);
  landOn(s, prop);
  assert.equal(team.money, core.START_MONEY - core.RENT);
  assert.equal(s.teams[1].money, core.START_MONEY + core.RENT);
  const t = game(3);
  t.owner[prop] = 1;
  t.owner[first('prop', prop + 1)] = 0;
  core.current(t).money = 50;
  landOn(t, prop);
  assert.ok(core.current(t).out);
  assert.equal(t.owner.filter((o) => o === 0).length, 0);   // properties go back to the bank
});

test('? pays $100, other squares $50, only for right answers', () => {
  const s = game();
  const team = core.current(s);
  landOn(s, first('chance'));
  assert.equal(s.qkind, 'special');
  core.judge(s, true);
  assert.equal(team.money, core.START_MONEY + core.SPECIAL_PRIZE);
  const t = game();
  landOn(t, first('fish'));
  core.judge(t, false);
  assert.equal(core.current(t).money, core.START_MONEY);
});

test('passing 起点 pays $200; the airplane flies home; bananas skip a turn', () => {
  const s = game();
  const team = core.current(s);
  team.pos = core.BOARD.length - 2;
  core.roll(s, 4);
  assert.equal(team.money >= core.START_MONEY + core.SALARY, true);
  assert.equal(team.laps, 1);
  const t = game();
  landOn(t, first('plane'));
  assert.equal(core.current(t).pos, 0);
  assert.equal(core.current(t).laps, 1);
  const u = game(2);
  landOn(u, first('banana'));
  assert.ok(u.teams[0].skip);
  core.next(u);                    // team 1
  u.phase = 'next';
  const ev = core.next(u);         // team 0 skips, back to team 1
  assert.ok(ev.some((e) => e.type === 'skipped'));
  assert.equal(u.turn, 1);
});

test('the game ends after the laps and ranks by money + property value', () => {
  const s = game(2, 1);
  s.owner[first('prop')] = 1;
  s.teams[0].money = 900;
  s.teams[1].money = 850;          // 850 + 100 property > 900
  s.teams[0].pos = core.BOARD.length - 1;
  core.roll(s, 1);                 // team 0 finishes its lap
  assert.ok(s.teams[0].done);
  s.phase = 'next';
  core.next(s);
  s.teams[1].pos = core.BOARD.length - 1;
  core.roll(s, 1);
  assert.equal(s.phase, 'over');
  assert.equal(s.places[0], 1);
  assert.equal(shared.template({ cards: '题|答', game: 'money', laps: 3 }).game, 'money');
});
