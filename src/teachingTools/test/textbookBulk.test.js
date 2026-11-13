'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var preview = require('../public/admin-textbook-bulk').preview;
function lessons() { return [{ id: 1, lesson_no: 1, title: '你好', items: [{ zh: '老师' }], sentence_patterns: '老师好！' }, { id: 2, lesson_no: 2, title: '学生', items: [], sentence_patterns: '' }]; }
test('assigns pasted words by lesson number and preserves optional columns', function () {
  var data = lessons(), rows = preview('1\t你好\tnǐ hǎo\thello\t词语\n2\t学生', data, 'book', 'words');
  assert.equal(rows[0].lesson.id, 1); assert.equal(rows[0].en, 'hello'); assert.equal(rows[0].kind, '词语');
  assert.equal(rows[1].lesson.id, 2); assert.equal(rows[1].py, ''); assert.equal(data[1].items.length, 0);
});
test('skips existing and repeated words and sentences without mutating lessons', function () {
  var data = lessons();
  assert.deepEqual(preview('1\t老师\n1\t你好\n1\t你好', data, 'book', 'words').map(function (r) { return r.duplicate; }), [true, false, true]);
  assert.deepEqual(preview('老师好！\n你好！\n你好！', data, '1', 'sentences').map(function (r) { return r.duplicate; }), [true, false, true]);
  assert.equal(data[0].sentence_patterns, '老师好！');
});
test('reports missing and ambiguous lessons, extra columns, blank words, and size limits', function () {
  var data = lessons();
  assert.ok(preview('3\t你好', data, 'book', 'words')[0].error);
  data[1].lesson_no = 1;
  assert.match(preview('1\t你好', data, 'book', 'words')[0].error, /重复/);
  assert.ok(preview('你好\textra', data, '1', 'sentences')[0].error);
  assert.ok(preview('\t拼音', data, '1', 'words')[0].error);
  assert.ok(preview('词'.repeat(101), data, '1', 'words')[0].error);
  data[0].items = Array.from({ length: 500 }, function (_, i) { return { zh: '字' + i }; });
  assert.match(preview('新词', data, '1', 'words')[0].error, /500/);
});
