'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var test = require('node:test');

function loadMatcher() {
  var source = fs.readFileSync(require.resolve('../public/low-prep/word-sudoku/word-sudoku-widget.js'), 'utf8');
  var data = source.slice(source.indexOf('  const iconPalette'), source.indexOf('  // Emoji 由'));
  var normalized = source.slice(source.indexOf('  function normalized'), source.indexOf('  function validWords'));
  var helpers = source.slice(source.indexOf('  function semanticQueries'), source.indexOf('  function renderInputs'));
  return new Function('CE', 'emojiIndex', 'state', data + normalized + helpers + '\nreturn { autoMatchItems, suggestIcon };')(
    null,
    null,
    { items: [] }
  );
}

test('matches common school vocabulary without random animal fallbacks', function () {
  var items = [
    ['学校', 'school'], ['老师', 'teacher'], ['同学', 'classmate'],
    ['书包', 'backpack'], ['课本', 'textbook'], ['铅笔', 'pencil'],
    ['橡皮', 'eraser'], ['尺子', 'ruler'], ['笔记本', 'notebook']
  ].map(function (values) {
    return { word: values[0], zh: values[0], en: values[1], theme: 'School', icon: '', manual: false };
  });
  var matcher = loadMatcher();
  matcher.autoMatchItems(items);
  assert.deepEqual(items.map(function (item) { return item.icon; }), [
    '🏫', '👩‍🏫', '🧑‍🤝‍🧑', '🎒', '📘', '✏️', '🧽', '📏', '📓'
  ]);
});

test('uses a distinct action icon when chair icons are already taken', function () {
  var matcher = loadMatcher();
  var items = [
    { word: '桌子', zh: '桌子', en: 'desk', icon: '🪑', manual: true },
    { word: '椅子', zh: '椅子', en: 'chair', icon: '💺', manual: true },
    { word: '请坐', zh: '请坐', en: 'please sit down', icon: '', manual: false }
  ];
  matcher.autoMatchItems(items);
  assert.equal(items[2].icon, '🧎');
});

test('avoids known misleading matches for abstract and body vocabulary', function () {
  var matcher = loadMatcher();
  assert.equal(matcher.suggestIcon({ word: '是', zh: '是', en: 'to be' }, 0, []), '✅');
  assert.equal(matcher.suggestIcon({ word: '脸', zh: '脸', en: 'face' }, 0, []), '🙂');
  assert.equal(matcher.suggestIcon({ word: '活动', zh: '活动', en: 'activity' }, 0, []), '🎯');
});

test('marks an unmatched word for review instead of assigning a random picture', function () {
  var matcher = loadMatcher();
  var item = { word: 'xyzzy', icon: '', manual: false };
  assert.equal(matcher.suggestIcon(item, 4, [item]), '5️⃣');
  assert.equal(item.needsReview, true);
});
