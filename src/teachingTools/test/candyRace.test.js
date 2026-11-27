'use strict';

const test = require('node:test');
const assert = require('node:assert');
const core = require('../public/low-prep/candy-race/candy-race-core');
const shared = require('../public/low-prep/escape-the-path/escape-the-path-core');

function game(teams = 2) {
  return core.newGame({ teams, shared, zh: true });
}
const forks = Object.keys(core.NEXT).map(Number).filter((i) => core.NEXT[i].length > 1);
const bridge = Number(Object.keys(core.GATE)[0]);

test('board: every square can reach 终点, forks offer two ways, side paths link back', () => {
  assert.equal(core.BOARD[0][2], 'start');
  assert.equal(core.BOARD[core.FINISH][2], 'finish');
  core.BOARD.forEach((square, i) => {
    assert.ok(Number.isFinite(core.DIST[i]), 'square ' + i + ' cannot reach the end');
    assert.ok(square[0] > 0 && square[0] < core.FRAME.w && square[1] > 0 && square[1] < core.FRAME.h);
  });
  assert.equal(forks.length, 4);
  assert.equal(core.GATE[bridge], 200);
  core.LINKS.forEach(([from, to]) => assert.deepEqual(core.nextOf(from), [to]));
  assert.equal(core.BOARD.filter((s) => s[2] === 'jail').length, 2);
});

test('a roll that passes a fork stops and asks; choosing finishes the roll', () => {
  const s = game();
  const team = core.current(s);
  const fork = forks[0];
  team.pos = fork - 2;
  const events = core.roll(s, 5);
  assert.equal(s.phase, 'fork');
  assert.equal(team.pos, fork);
  assert.equal(s.steps, 3);
  assert.deepEqual(events.map((e) => e.type), ['walk', 'fork']);
  const far = core.NEXT[fork][1];
  core.choose(s, far);
  assert.equal(team.pos, far + 2);
  assert.notEqual(s.phase, 'fork');
  assert.equal(team.prev, fork - 2);
});

test('the bridge is closed without $2000', () => {
  const s = game();
  const team = core.current(s);
  const fork = forks.find((f) => core.NEXT[f].includes(bridge));
  team.pos = fork;
  core.roll(s, 2);
  assert.equal(s.phase, 'fork');
  assert.deepEqual(core.choose(s, bridge), []);
  assert.equal(s.phase, 'fork');
  const s2 = game();
  const rich = core.current(s2);
  rich.pos = fork;
  rich.money = core.GATE[bridge];
  core.roll(s2, 1);
  core.choose(s2, bridge);
  assert.equal(rich.pos, bridge);
});

test('cards: right earns the square money, wrong goes back to where the roll started', () => {
  const cardSquare = core.BOARD.findIndex((s, i) => i > 3 && s[2] === 'money' && !core.NEXT[i - 2] && !core.NEXT[i - 1]);
  const s = game();
  const team = core.current(s);
  team.pos = cardSquare - 2;
  core.roll(s, 2);
  assert.equal(s.phase, 'card');
  core.judge(s, true);
  assert.equal(team.money, core.BOARD[cardSquare][3]);
  assert.equal(team.pos, cardSquare);

  const t = game();
  const other = core.current(t);
  other.pos = cardSquare - 2;
  core.roll(t, 2);
  const events = core.judge(t, false);
  assert.equal(other.money, 0);
  assert.equal(other.pos, cardSquare - 2);
  assert.equal(events[0].type, 'back');
});

test('jail: two turns, or the RV gets you out at once (3 times)', () => {
  const jail = core.BOARD.findIndex((s) => s[2] === 'jail');
  const s = game();
  const team = core.current(s);
  team.pos = jail - 1;
  core.roll(s, 1);
  assert.equal(team.jail, 2);
  s.phase = 'jail';
  core.wait(s);
  s.phase = 'jail';
  const out = core.wait(s);
  assert.equal(out[0].type, 'released');
  assert.equal(team.pos, jail + 1);

  const t = game();
  const driver = core.current(t);
  driver.money = core.RV_PRICE + 100;
  core.buyRv(t);
  assert.equal(t.phase, 'buy');
  core.judge(t, true);
  assert.equal(driver.rv, 3);
  assert.equal(driver.money, 100);
  assert.equal(core.RV_PRICE, 350);
  assert.equal(t.phase, 'roll');
  driver.pos = jail - 1;
  core.roll(t, 1);
  t.phase = 'jail';
  core.useRv(t);
  assert.equal(driver.rv, 2);
  assert.equal(driver.jail, 0);
  assert.equal(t.phase, 'roll');
});

test('a wrong answer when buying keeps the money and the turn', () => {
  const s = game();
  const team = core.current(s);
  team.money = 400;
  core.buyRv(s);
  core.judge(s, false);
  assert.equal(team.money, 400);
  assert.equal(team.rv, 0);
  assert.equal(s.phase, 'roll');
});

test('three places end the game; the rest rank by distance to 终点', () => {
  const s = game(5);
  s.teams[3].pos = 10;
  s.teams[4].pos = 50;
  for (let place = 1; place <= 3; place++) {
    s.turn = place - 1;
    s.phase = 'roll';
    s.teams[place - 1].pos = core.BOARD.findIndex((sq, i) => core.nextOf(i).includes(core.FINISH));
    core.roll(s, 3);
    assert.equal(s.teams[place - 1].place, place);
  }
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.places, [0, 1, 2, 4, 3]);
});
