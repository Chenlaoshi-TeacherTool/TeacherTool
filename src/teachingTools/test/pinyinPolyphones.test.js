'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var test = require('node:test');
var vm = require('node:vm');

function loadWordlistCore() {
  var values = new Map();
  var context = {
    localStorage: {
      getItem: function (key) { return values.has(key) ? values.get(key) : null; },
      setItem: function (key, value) { values.set(key, value); },
      removeItem: function (key) { values.delete(key); }
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/shared/wordlist-core.js'), 'utf8'), context);
  return context.ChenWordlist;
}

function py(core, text) {
  return core.toPinyin(text, { spaced: true });
}

test('reads 长 as cháng on its own and zhǎng in words about growing or leaders', function () {
  var core = loadWordlistCore();
  assert.equal(py(core, '很长'), 'hěn cháng');
  assert.equal(py(core, '太长了'), 'tài cháng le');
  assert.equal(py(core, '长大'), 'zhǎng dà');
  assert.equal(py(core, '校长'), 'xiào zhǎng');
  assert.equal(py(core, '区长'), 'qū zhǎng');
});

test('reads 地 and 得 from where they sit in the sentence', function () {
  var core = loadWordlistCore();
  assert.equal(py(core, '慢慢地'), 'màn màn de');
  assert.equal(py(core, '认真地'), 'rèn zhēn de');
  assert.equal(py(core, '地方'), 'dì fāng');
  assert.equal(py(core, '跑得快'), 'pǎo de kuài');
  assert.equal(py(core, '我得走'), 'wǒ děi zǒu');
  assert.equal(py(core, '他得了第一'), 'tā dé le dì yī');
  assert.equal(py(core, '不得不'), 'bù dé bù');
  assert.equal(py(core, '觉得'), 'jué de');
});

test('keeps 一切 and 尽量 with their word readings', function () {
  var core = loadWordlistCore();
  assert.equal(py(core, '一切'), 'yí qiè');
  assert.equal(py(core, '切菜'), 'qiē cài');
  assert.equal(py(core, '尽量'), 'jǐn liàng');
  assert.equal(py(core, '尽力'), 'jìn lì');
  assert.equal(py(core, '哪儿'), 'nǎr');
});

test('remembers a teacher pinyin fix for the same word', function () {
  var core = loadWordlistCore();
  assert.equal(py(core, '数一数'), 'shù yí shù');
  assert.equal(core.rememberPinyin('数一数', 'shǔ yi shǔ'), true);
  assert.equal(py(core, '数一数'), 'shǔ yi shǔ');
  assert.equal(core.toPinyin('数一数'), 'shǔyishǔ');
  assert.equal(core.toPinyin('数一数', { spaced: true, remembered: false }), 'shù yí shù');
  core.rememberPinyin('数一数', '');
  assert.equal(py(core, '数一数'), 'shù yí shù');
});
