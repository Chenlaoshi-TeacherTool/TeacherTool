'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var test = require('node:test');
var vm = require('node:vm');

test('wraps long Jeopardy questions and answers without dropping text', function () {
  var source = fs.readFileSync(require.resolve('../public/low-prep/jeopardy/jeopardy.js'), 'utf8');
  var exportFunctions = source.slice(source.indexOf('function wrapText'), source.indexOf('function renderAll'));
  var question = 'What should students bring when they visit the school library tomorrow?';
  var answer = 'Students should bring their library card and a notebook for taking notes.';
  var context = {
    G: { name: 'School', base: 100, step: 100, categories: [{ name: 'Library', clues: [{ q: question, a: answer }] }] },
    esc: function (value) { return String(value); },
    valueOf: function () { return 100; }
  };
  vm.runInNewContext(exportFunctions, context);
  var pages = context.bankPages().join('');
  assert.equal(pages.replace(/<[^>]+>/g, '').includes(question), true);
  assert.equal(pages.replace(/<[^>]+>/g, '').includes(answer), true);
});
