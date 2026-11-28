'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var i18n = require('../services/i18n');
var tools = require('../config/tools');
var toolSearch = require('../services/toolSearch');
var match = require('../public/shared/tool-search').matches;

function textFor(titleKey) {
  var tool = tools.TOOLS.find(function (t) { return t.titleKey === titleKey; });
  var keys = [tool.titleKey, tool.scopeKey, tool.descKey];
  return toolSearch.buildSearchText(keys.map(function (k) { return i18n.t('zh', k) + ' ' + i18n.t('en', k); }), tool.keywords);
}

function found(query) {
  return tools.TOOLS.filter(function (tool) { return match(textFor(tool.titleKey), query); })
    .map(function (tool) { return tool.titleKey.split('.').pop(); });
}

test('synonym groups attach to tools that mention one of their words', function () {
  var text = toolSearch.buildSearchText(['Flash card generator'], []);
  assert.ok(match(text, '字卡'));
  assert.ok(match(text, '闪卡'));
  assert.ok(match(text, 'flashcards'));
});

test('latin synonyms match whole words only', function () {
  assert.equal(toolSearch.mentions('start the timer', 'art'), false);
  assert.equal(toolSearch.mentions('a fun game', 'game'), true);
  assert.equal(toolSearch.mentions('two games', 'game'), true);
});

test('traditional characters find the same tools as simplified', function () {
  assert.deepEqual(found('遊戲'), found('游戏'));
  assert.ok(found('筆順').includes('strokeOrderTitle'));
  assert.ok(found('賓果').includes('bingoTitle'));
});

test('English finds tools by their Chinese meaning and the other way round', function () {
  assert.ok(found('宾果').includes('bingoTitle'));
  assert.ok(found('stroke order').includes('strokeOrderTitle'));
  assert.ok(found('worksheet').includes('strokeOrderTitle'), '练习纸 → worksheet');
  assert.ok(found('量词').includes('measureWordsTitle'));
  assert.ok(found('measure word').includes('measureWordsTitle'));
});

test('several words must all match', function () {
  var both = found('bingo 听力');
  assert.ok(both.includes('tearPaperBingoTitle'));
  assert.deepEqual(found('bingo 迷宫'), []);
});

test('tool keywords are searchable in both scripts', function () {
  assert.ok(found('抢答').includes('jeopardyTitle'));
  assert.ok(found('搶答').includes('jeopardyTitle'));
});
