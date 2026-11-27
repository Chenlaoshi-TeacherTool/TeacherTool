'use strict';

const test = require('node:test');
const assert = require('node:assert');
const core = require('../public/low-prep/escape-the-path/escape-the-path-core');
const registry = require('../services/gameShareRegistry');
const community = require('../services/community');

function game(teams = 2, jail = 5) {
  return core.newGame({ teams, jail });
}

// Put the current team on a square, then roll so it lands on `target`.
function landOn(state, target) {
  const team = core.current(state);
  team.pos = target - 1;
  return core.roll(state, 1);
}

test('board starts at 开始, ends at 结束 and every jump points forward', () => {
  assert.equal(core.BOARD[0][2], 'start');
  assert.equal(core.BOARD[core.FINISH][2], 'finish');
  assert.equal(core.BOARD.length, 109);
  core.BOARD.forEach((square, i) => {
    assert.ok(square[0] > 0 && square[0] < core.FRAME.w && square[1] > 0 && square[1] < core.FRAME.h);
    if (square[2] === 'slide') assert.ok(square[3] > i && square[3] < core.FINISH);
    if (square[2] === 'move') assert.ok(i + square[3] > 0 && i + square[3] < core.FINISH);
  });
});

test('card square: correct stays, wrong moves back one; 抽四张卡 asks four', () => {
  const s = game();
  landOn(s, 1);
  assert.equal(s.phase, 'card');
  core.judge(s, false);
  assert.equal(core.current(s).pos, 0);
  assert.equal(s.phase, 'next');

  core.next(s);
  landOn(s, 106); // 抽四张卡
  assert.equal(s.left, 4);
  for (let i = 0; i < 3; i++) {
    core.judge(s, true);
    assert.equal(s.phase, 'card');
  }
  core.judge(s, true);
  assert.equal(s.phase, 'next');
  assert.equal(core.current(s).pos, 106);
});

test('move and slide squares resolve once, then the destination counts', () => {
  const s = game();
  const events = landOn(s, 25); // 从蛇身上滑下去 → 35 (抽卡)
  assert.deepEqual(events.map((e) => e.type), ['walk', 'slide', 'card']);
  assert.equal(core.current(s).pos, 35);

  const t = game();
  landOn(t, 24); // 往前走两步 → 26 (blank)
  assert.equal(core.current(t).pos, 26);
  assert.equal(t.phase, 'next');

  const u = game();
  landOn(u, 77); // 往后走十三步 → 64 (抽卡)
  assert.equal(core.current(u).pos, 64);
  assert.equal(u.phase, 'card');
});

test('jail lasts two turns and releases to the square after the jail square', () => {
  const s = game();
  landOn(s, 4);
  const team = core.current(s);
  assert.equal(team.jail, 2);
  core.next(s);              // other team's turn
  s.phase = 'next';
  core.next(s);              // back to the jailed team
  assert.equal(s.phase, 'jail');
  core.wait(s);
  assert.equal(team.jail, 1);
  core.next(s);
  s.phase = 'next';
  core.next(s);
  const events = core.wait(s);
  assert.equal(events[0].type, 'released');
  assert.equal(team.pos, 5);
  assert.equal(team.jail, 0);
});

test('jail challenge: all correct leaves at once, a miss counts as a waited turn', () => {
  const s = game(2, 3);
  landOn(s, 4);
  const team = core.current(s);
  s.turn = team.id;
  s.phase = 'jail';
  core.challenge(s);
  assert.equal(s.left, 3);
  core.judge(s, true);
  core.judge(s, false);
  assert.equal(team.jail, 1);
  s.phase = 'jail';
  core.challenge(s);
  core.judge(s, true); core.judge(s, true); core.judge(s, true);
  assert.equal(team.jail, 0);
  assert.equal(team.pos, 5);
});

test('game runs until three teams finish; the rest are ranked by position', () => {
  const s = game(5);
  s.teams[3].pos = 40;
  s.teams[4].pos = 60;
  for (let place = 1; place <= 3; place++) {
    s.turn = place - 1;
    s.phase = 'roll';
    s.teams[place - 1].pos = core.FINISH - 2;
    core.roll(s, 6);
    assert.equal(s.teams[place - 1].place, place);
  }
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.places, [0, 1, 2, 4, 3]);
});

test('two teams: the game ends when the first team finishes', () => {
  const s = game(2);
  s.teams[0].pos = core.FINISH - 1;
  core.roll(s, 3);
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.places, [0, 1]);
});

test('the jail right before 结束 cannot be left by answering cards', () => {
  const s = game();
  landOn(s, core.FINISH - 1);
  const team = core.current(s);
  assert.equal(team.jail, 2);
  s.phase = 'jail';
  assert.equal(core.canChallenge(s), false);
  assert.deepEqual(core.challenge(s), []);
  core.wait(s);
  s.phase = 'jail';
  const events = core.wait(s);
  assert.deepEqual(events.map((e) => e.type), ['released', 'finish', 'over']);
});

test('roll again, and a pending skip costs one turn', () => {
  const r = game();
  landOn(r, 19); // 再来一次
  assert.equal(r.phase, 'roll');

  const s = game(3);
  s.teams[0].skip = true;
  s.phase = 'next';
  core.next(s);
  s.phase = 'next';
  core.next(s);
  s.phase = 'next';
  const events = core.next(s);
  assert.equal(events[0].type, 'skipped');
  assert.equal(s.teams[0].skip, false);
});

test('cards: own lines and word-list cards', () => {
  assert.deepEqual(core.parseCards('请读「猫」| māo\n\n说一说'), [{ label: '', q: '请读「猫」', a: 'māo' }, { label: '', q: '说一说', a: '' }]);
  const cards = core.wordCards([{ zh: '猫', py: 'māo', en: 'cat' }, { zh: '狗', py: 'gǒu', en: '' }], ['read', 'meaning', 'say', 'sentence'], true);
  assert.equal(cards.length, 4 + 2);
});

test('templates are sanitized, empty ones rejected, and the tool is registered', () => {
  assert.throws(() => core.template({}), { status: 400 });
  assert.throws(() => core.template({ source: 'words', words: '  ' }), { status: 400 });
  const data = core.template({ cards: '题|答', teams: 99, jail: 0, types: ['read', 'bogus'], names: ['x'.repeat(50)] });
  assert.equal(data.teams, core.MAX_TEAMS);
  assert.equal(data.jail, 1);
  assert.deepEqual(data.types, ['read']);
  assert.equal(data.names[0].length, core.LIMITS.name);
  const adapter = registry.get('escape-the-path', 1);
  assert.ok(adapter && adapter.templateOnly);
  assert.ok(community.GAME_TYPES['escape-the-path'].templateEditor);
});
