'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');
var source = fs.readFileSync(path.join(__dirname, '../public/shared/library-i18n.js'), 'utf8');
function localization(lang) {
  var context = { window: {}, NodeFilter: { SHOW_TEXT: 4 }, document: {
    cookie: 'lang=' + lang, documentElement: {},
    createTreeWalker: function () { return { nextNode: function () { return null; } }; },
    querySelectorAll: function () { return []; }
  } };
  vm.runInNewContext(source, context);
  return context;
}
test('library language follows the site cookie and retains complete English labels', function () {
  var en = localization('en');
  var zh = localization('zh');
  assert.equal(en.document.documentElement.lang, 'en');
  assert.equal(zh.document.documentElement.lang, 'zh');
  for (var label of ['My materials', 'Build preview', 'Download library backup', 'Saved in this browser', 'Coming soon']) {
    assert.equal(en.window.LibraryI18n.t(label), label);
    assert.match(zh.window.LibraryI18n.t(label), /[\u4e00-\u9fff]/);
  }
});
test('all static library interface text has a Chinese translation, excluding sample vocabulary', function () {
  var t = localization('zh').window.LibraryI18n.t;
  for (var name of ['word-list', 'question-bank']) {
    var html = fs.readFileSync(path.join(__dirname, '../public/teaching-tools/' + name + '-library/' + name + '-library.html'), 'utf8');
    html = html.replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/g, '');
    for (var match of html.matchAll(/>([^<>]+)</g)) {
      var text = match[1].trim().replace(/&amp;/g, '&').replace(/&nbsp;/g, '\u00a0');
      if (/[A-Za-z]/.test(text)) assert.notEqual(t(text), text, name + ': ' + text);
    }
  }
});
test('library warnings translate their interface text while retaining names and original IDs', function () {
  var t = localization('zh').window.LibraryI18n.t;
  assert.equal(t('English 原文: duplicate original ID Apple; both entries were kept.'), 'English 原文：原始编号重复：Apple；两个条目均已保留。');
  assert.equal(t('English 原文: question 2 is missing a prompt or answer; it was kept.'), 'English 原文：题目 2 缺少题干或答案，已保留。');
  assert.equal(t('Invalid text field: definition.'), '无效文本字段：definition.');
  assert.equal(t('My English question?'), 'My English question?');
});
