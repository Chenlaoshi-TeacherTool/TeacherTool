'use strict';

const test = require('node:test');
const assert = require('node:assert');
const core = require('../public/low-prep/escape-classroom/escape-classroom-core');
const shared = require('../public/low-prep/escape-the-path/escape-the-path-core');

function game(teams = 2) {
  return core.newGame({ teams, shared, zh: true });
}
const desk = (from) => core.BOARD.findIndex((s, i) => i >= from && s[2] === 'desk');
const aisle = (from) => core.BOARD.findIndex((s, i) => i >= from && s[2] === 'aisle');

test('board: start, desks and aisles alternate, door at the end, teacher on an aisle', () => {
  assert.equal(core.BOARD[0][2], 'start');
  assert.equal(core.BOARD[core.FINISH][2], 'finish');
  for (let i = 1; i < core.FINISH - 1; i++) {
    assert.equal(core.BOARD[i][2], i % 2 ? 'aisle' : 'desk', 'square ' + i);
  }
  assert.equal(core.BOARD[core.newGame({ teams: 2 }).teacher][2], 'aisle');
  core.BOARD.forEach((s) => assert.ok(s[0] > 0 && s[0] < core.FRAME.w && s[1] > 0 && s[1] < core.FRAME.h));
});

test('dice move half a table, one table or one and a half', () => {
  [[1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3]].forEach(([face, steps]) => {
    const s = game();
    core.roll(s, face);
    assert.equal(core.current(s).pos, steps);
  });
});

test('a desk asks a card; wrong moves back half a table, right flips a special card', () => {
  const s = game();
  const team = core.current(s);
  s.teacher = 0;
  core.roll(s, 3);                       // 0 → 2, a desk
  assert.equal(s.phase, 'card');
  core.judge(s, false);
  assert.equal(team.pos, 1);
  const t = game();
  t.teacher = 0;
  core.roll(t, 3);
  core.judge(t, true, 'shield');
  assert.equal(core.current(t).shield, 1);
  assert.equal(t.phase, 'next');
});

test('bullet goes one and a half tables; dang it goes to prison', () => {
  const s = game();
  s.teacher = 0;
  core.roll(s, 3);
  core.judge(s, true, 'bullet');
  assert.equal(core.current(s).pos, 5);
  const t = game();
  t.teacher = 0;
  core.roll(t, 3);
  core.judge(t, true, 'dang');
  assert.equal(core.current(t).jail, 2);
});

test('the teacher catches a team on an aisle; desks are safe; a shield blocks once', () => {
  const s = game();
  const team = core.current(s);
  const a = aisle(5);
  s.teacher = a;
  team.pos = a - 1;
  core.roll(s, 1);
  assert.equal(team.jail, 2);
  const t = game();
  const sheltered = core.current(t);
  const d = desk(5);
  t.teacher = d;
  sheltered.pos = d - 1;
  core.roll(t, 1);
  assert.equal(sheltered.jail, 0);
  const u = game();
  const shielded = core.current(u);
  shielded.shield = 1;
  u.teacher = a;
  shielded.pos = a - 1;
  core.roll(u, 1);
  assert.equal(shielded.jail, 0);
  assert.equal(shielded.shield, 0);
});

test('after a round the teacher walks toward the leading team and catches it', () => {
  const s = game(2);
  const leader = s.teams[1];
  leader.pos = aisle(10);
  s.teacher = leader.pos + 2;
  s.phase = 'next';
  s.turn = 1;
  const events = core.next(s);
  assert.equal(s.teacher, leader.pos);
  assert.ok(events.some((e) => e.type === 'caught' && e.team === 1));
  assert.equal(leader.jail, 2);
});

test('prison: two turns, or a Yay card frees the team at once', () => {
  const s = game();
  const team = core.current(s);
  team.pos = aisle(7);
  team.jail = 2;
  team.jailFrom = team.pos;
  s.phase = 'jail';
  core.wait(s);
  s.phase = 'jail';
  core.wait(s);
  assert.equal(team.jail, 0);
  assert.equal(core.BOARD[team.pos][2], 'desk');
  const t = game();
  const lucky = core.current(t);
  lucky.yay = 1;
  lucky.jail = 2;
  lucky.jailFrom = desk(9);
  t.phase = 'jail';
  core.useRv(t);
  assert.equal(lucky.jail, 0);
  assert.equal(lucky.yay, 0);
  assert.equal(t.phase, 'roll');
});

test('desk phrases give situation cards; three teams out ends the game', () => {
  const card = core.situation('对不起', true);
  assert.equal(card.a, '对不起');
  assert.equal(core.situation('', true), null);
  const s = game(5);
  s.teacher = 0;
  for (let place = 1; place <= 3; place++) {
    s.turn = place - 1;
    s.phase = 'roll';
    s.teams[place - 1].pos = core.FINISH - 1;
    core.roll(s, 2);
    assert.equal(s.teams[place - 1].place, place);
  }
  assert.equal(s.phase, 'over');
  assert.equal(shared.template({ cards: '题|答', game: 'escape-classroom' }).game, 'escape-classroom');
});

test('the teacher can choose the desk words; empty keeps the student\'s', () => {
  const words = core.parseWords('苹果\n香蕉，西瓜 | xī guā\n\n');
  assert.deepEqual(words, ['苹果', '香蕉', '西瓜']);
  const s = core.newGame({ teams: 2, words });
  const [d0, d1, , d3] = core.DESK_SQUARES;
  assert.equal(core.phrase(d0, s), '苹果');
  assert.equal(core.phrase(d1, s), '香蕉');
  assert.equal(core.phrase(d3, s), '苹果');            // repeats when there are fewer words than desks
  assert.equal(core.phrase(core.DESK_SQUARES[1], core.newGame({ teams: 2 })), '再见');
  const card = core.situation('苹果', true);
  assert.equal(card.q, '苹果');
  assert.ok(card.hint);
  s.teacher = 0;
  const events = core.roll(s, 3);
  assert.equal(events.find((e) => e.type === 'card').phrase, '苹果');
  assert.equal(shared.template({ cards: '题|答', game: 'escape-classroom', deskWords: '猫\n狗' }).deskWords, '猫\n狗');
});
