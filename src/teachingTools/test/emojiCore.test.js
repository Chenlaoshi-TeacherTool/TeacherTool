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
