'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var test = require('node:test');
var vm = require('node:vm');

function loadEmojiCore() {
  var values = Object.create(null);
  var window = {
    localStorage: {
      getItem: function (key) { return values[key] || null; },
      setItem: function (key, value) { values[key] = value; }
    }
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve('../public/shared/emoji-core.js'), 'utf8'),
    { window: window }
  );
  return window.ChenEmoji;
}

test('remembers a manual emoji choice for the Chinese and English term', function () {
  var emoji = loadEmojiCore();
  emoji.remember({ zh: '教室', en: 'classroom', word: '教室' }, '🚪');
  assert.equal(emoji.recall({ word: '教室' }), '🚪');
  assert.equal(emoji.recall({ word: 'CLASSROOM' }), '🚪');
});

function sampleIndex(emoji) {
  return emoji.buildIndex([
    { emoji: '🦭', hexcode: '1F9AD', annotation: 'seal', tags: 'animal, sea', openmoji_tags: '' },
    { emoji: '💺', hexcode: '1F4BA', annotation: 'seat', tags: 'chair', openmoji_tags: '' },
    { emoji: '🧜', hexcode: '1F9DC', annotation: 'merperson', tags: 'ocean, sea', openmoji_tags: '' },
    { emoji: '🐚', hexcode: '1F41A', annotation: 'spiral shell', tags: 'sea, shell', openmoji_tags: '' },
    { emoji: '🌊', hexcode: '1F30A', annotation: 'water wave', tags: 'ocean, water, wave', openmoji_tags: '' },
    { emoji: '🐱', hexcode: '1F431', annotation: 'cat face', tags: 'animal, cat', openmoji_tags: '' }
  ]);
}

test('a common classroom word gets its preferred picture first', function () {
  var emoji = loadEmojiCore();
  var index = sampleIndex(emoji);
  assert.equal(emoji.search('sea', index)[0].annotation, 'water wave');
  assert.equal(emoji.match({ en: 'sea' }, index).annotation, 'water wave');
});

test('whole-word tag matches rank above names that only start with the query', function () {
  var emoji = loadEmojiCore();
  var index = sampleIndex(emoji);
  var names = emoji.search('shell', index).map(function (entry) { return entry.annotation; });
  assert.equal(names[0], 'spiral shell');
  var typing = emoji.search('ca', index).map(function (entry) { return entry.annotation; });
  assert.equal(typing.join(','), 'cat face');
});
