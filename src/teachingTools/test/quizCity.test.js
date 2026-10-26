'use strict';
var assert = require('node:assert/strict');
var test = require('node:test');
var engine = require('../public/teaching-tools/quiz-city/engine');
function game(count) { return engine.create(['A', 'B', 'C', 'D'].slice(0, count || 4), 10, engine.parse('One? | 1 | 1; 2\nTwo? | 2').questions); }
function land(state, position, correct, chance) { state.teams[state.active].position = position; state.phase = 'question'; engine.judge(state, Boolean(correct), chance || 0); }
test('question parser supports oral and exact multiple choice and reports malformed lines', function() {
  var parsed = engine.parse('Say hello | Hello\n2+2? | 4 | 3; 4\n\nBad\nWrong | Z | A; B');
  assert.equal(parsed.questions.length, 2); assert.deepEqual(parsed.invalid, [4, 5]);
  assert.equal(engine.parse('').questions.length, 0);
});
test('roll moves one square at a time and cannot be rerolled or judged early', function() {
  var state = game(); state.teams[0].position = 22;
  assert.equal(engine.roll(state, 4), true); assert.equal(engine.roll(state, 6), false);
  engine.judge(state, true); assert.equal(state.teams[0].coins, 200);
  engine.step(state); assert.equal(state.phase, 'moving');
  engine.step(state); assert.equal(state.teams[0].position, 23);
  engine.step(state); engine.step(state); engine.step(state);
  assert.equal(state.teams[0].position, 2); assert.equal(state.phase, 'question');
  engine.judge(state, true, 1); assert.equal(state.teams[0].coins, 250);
  engine.judge(state, true); assert.equal(state.teams[0].coins, 250);
});
test('buying exchanges cash for asset value, ownership cannot be purchased twice', function() {
  var state = game(); land(state, 1, true);
  assert.equal(engine.buy(state), true); assert.equal(state.owners[1], 0);
  assert.equal(state.teams[0].coins, 140); assert.equal(engine.ranking(state).find(function(row) { return row.index === 0; }).total, 220);
  assert.equal(engine.buy(state), false);
});
test('visiting fee transfers only available coins and cannot make balances negative', function() {
  var state = game(); state.owners[1] = 1; state.teams[0].coins = 7; land(state, 1);
  assert.equal(state.teams[0].coins, 0); assert.equal(state.teams[1].coins, 207); assert.equal(state.event.amount, 7);
  engine.next(state); land(state, 1); assert.equal(state.event.kind, 'own');
});
test('cannot buy an unaffordable building; penalties clamp; chance covers both outcomes', function() {
  var state = game(); state.teams[0].coins = 10; land(state, 1); assert.equal(engine.buy(state), false);
  land(state, 8); assert.equal(state.teams[0].coins, 0);
  land(state, 4, false, 1); assert.equal(state.teams[0].coins, 35);
  land(state, 4, false, .1); assert.equal(state.teams[0].coins, 20);
});
test('challenge draws an extra reusable question and rewards it exactly once', function() {
  var state = game(); land(state, 6, true);
  assert.equal(state.phase, 'question'); assert.equal(state.challenge, true);
  assert.equal(engine.question(state).answer, '2'); engine.judge(state, true);
  assert.equal(state.teams[0].coins, 250); assert.equal(state.phase, 'event');
  assert.equal(engine.question(state).answer, '1'); engine.judge(state, true); assert.equal(state.teams[0].coins, 250);
});
test('all supported team counts complete the entire final round and preserve shared ranks', function() {
  [2, 3, 4].forEach(function(count) {
    var state = game(count); engine.tick(state, 601); assert.equal(state.closing, true);
    for (var index = 0; index < count; index++) { assert.equal(state.active, index); land(state, 1); engine.next(state); }
    assert.equal(state.phase, 'finished'); assert.equal(state.round, 1);
    assert.ok(engine.ranking(state).every(function(row) { return row.rank === 1 && row.total === 200; }));
  });
});
test('pause freezes actions and clock; restore is paused and retains movement/question/event', function() {
  var state = game(); engine.roll(state, 3); engine.step(state); engine.step(state);
  var restored = engine.restore(JSON.stringify(state)); assert.equal(restored.steps, 2); assert.equal(restored.paused, true);
  engine.step(restored); engine.tick(restored, 100); assert.equal(restored.steps, 2); assert.equal(restored.remaining, 600);
  restored.paused = false; engine.step(restored); engine.step(restored); assert.equal(restored.phase, 'question');
  restored = engine.restore(JSON.stringify(restored)); assert.equal(engine.question(restored).answer, '1');
  restored.paused = false; engine.judge(restored, true); restored = engine.restore(JSON.stringify(restored)); assert.equal(restored.phase, 'event');
  assert.equal(engine.buy(restored), false); engine.next(restored); assert.equal(restored.active, 0);
});
test('corrupt and invalid snapshots fail safely', function() {
  assert.equal(engine.restore('broken'), null); assert.equal(engine.restore('null'), null);
  var state = game(); state.questions = []; assert.equal(engine.restore(JSON.stringify(state)), null);
  state = game(); state.owners[2] = 0; assert.equal(engine.restore(JSON.stringify(state)), null);
  state = game(); state.active = 8; assert.equal(engine.restore(JSON.stringify(state)), null);
  state = game(); state.log = [null]; assert.equal(engine.restore(JSON.stringify(state)), null);
});
test('game route renders both languages, assets load, and directory and sitemap link to game', async function() {
  var store = require('../services/siteContentStore'); store.refresh = async function() {};
  var app = require('../app'); var server = app.listen(0, '127.0.0.1');
  await new Promise(function(resolve) { server.once('listening', resolve); });
  var base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (var lang of ['en', 'zh']) {
      var response = await fetch(base + '/teaching-tools/quiz-city', { headers: { Cookie: 'lang=' + lang } });
      assert.equal(response.status, 200); var html = await response.text();
      assert.ok(html.includes('<html lang="' + lang + '">')); assert.ok(html.includes('CLS Quiz City'));
    }
    for (var asset of ['engine.js', 'quiz-city.js', 'quiz-city.css']) { assert.equal((await fetch(base + '/teaching-tools/quiz-city/' + asset)).status, 200); }
    for (var route of ['/teaching-tools', '/sitemap.xml']) { assert.ok((await (await fetch(base + route)).text()).includes('/teaching-tools/quiz-city')); }
  } finally { server.closeAllConnections(); await new Promise(function(resolve) { server.close(resolve); }); }
});
