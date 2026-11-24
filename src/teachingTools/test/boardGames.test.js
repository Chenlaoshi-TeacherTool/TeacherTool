'use strict';

const test = require('node:test');
const assert = require('node:assert');
const core = require('../public/low-prep/board-games/board-games-core');
const registry = require('../services/gameShareRegistry');
const community = require('../services/community');

const words = ['猫', '狗', '鸟', '鱼', '马', '牛', '羊', '鸡'].map((zh) => ({ zh }));

test('every board is generated with the right number of squares, and the same seed prints the same board', () => {
  const expected = { path: 30, ladder: 64, line: 25, flight: 52 };
  core.BOARDS.forEach((board) => {
    const data = { board, words, options: { seed: 42, tasks: true, actionMode: 'card' } };
    const a = core.generate(data), b = core.generate(data);
    assert.equal(a.squares.length, expected[board], board);
    assert.deepEqual(a.squares, b.squares, board + ' is deterministic');
    a.squares.filter((sq) => sq.kind === 'word' || sq.kind === 'task').forEach((sq) => assert.ok(sq.word >= 0 && sq.word < words.length));
  });
});

test('the flight track is one closed loop of neighbouring squares with each team starting on its own colour', () => {
  const track = core.FLIGHT_TRACK;
  assert.equal(track.length, 52);
  assert.equal(new Set(track.map(String)).size, 52);
  track.forEach((a, i) => {
    const b = track[(i + 1) % track.length];
    assert.equal(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])), 1, 'step ' + i);
  });
  const layout = core.generate({ board: 'flight', words });
  layout.squares.filter((sq) => sq.kind === 'start').forEach((sq) => assert.equal(sq.i % 4, sq.team));
});

test('ladders go up, slides go down, and none touch the first or last square', () => {
  for (let seed = 1; seed < 30; seed++) {
    const layout = core.generate({ board: 'ladder', words, options: { seed, size: 10 } });
    const total = layout.size * layout.size;
    const used = new Set();
    layout.links.forEach((link) => {
      assert.ok(link.kind === 'ladder' ? link.to > link.from : link.to < link.from);
      [link.from, link.to].forEach((sq) => {
        assert.ok(sq > 0 && sq < total - 1);
        assert.ok(!used.has(sq), 'squares are not shared between links');
        used.add(sq);
      });
    });
  }
});

test('action squares are off by default, and contact actions are never picked unless ticked', () => {
  const plain = core.generate({ board: 'path', words });
  assert.ok(!plain.squares.some((sq) => sq.kind === 'action' || sq.kind === 'card'));
  const actions = core.generate({ board: 'ladder', words, options: { actionMode: 'cell', actionRate: 40 } });
  const contact = core.ACTIONS.filter((a) => a.contact).map((a) => a.key);
  assert.ok(actions.squares.some((sq) => sq.kind === 'action'));
  actions.squares.filter((sq) => sq.kind === 'action').forEach((sq) => assert.ok(!contact.includes(sq.action.key)));
});

test('the account copy is cleaned and needs at least four words', () => {
  assert.throws(() => core.template({ words: words.slice(0, 3) }), { status: 400 });
  const data = core.template({
    board: 'nope', title: '<b>' + 'x'.repeat(100),
    words: words.concat({ zh: '猫' }, { zh: '' }),
    options: { size: 999, actionMode: 'card', actionKeys: ['clap', 'bogus'], customActions: ['学老虎叫', '<script>'], taskRate: 500 }
  });
  assert.equal(data.board, 'path');
  assert.equal(data.options.size, core.DEFAULT_SIZE.path);
  assert.equal(data.words.length, words.length);
  assert.ok(!/[<>]/.test(data.title) && data.title.length <= core.LIMITS.title);
  assert.deepEqual(data.options.actionKeys, ['clap']);
  assert.ok(data.options.customActions.every((t) => !/[<>]/.test(t)));
  assert.equal(data.options.taskRate, 40);
});

test('Board Game Maker is registered as a template-only tool', () => {
  const adapter = registry.get('board-games', 1);
  assert.ok(adapter && adapter.templateOnly);
  assert.ok(community.GAME_TYPES['board-games'].templateEditor);
});
