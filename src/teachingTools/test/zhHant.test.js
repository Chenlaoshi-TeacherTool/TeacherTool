'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var store = require('../services/siteContentStore');
store.refresh = async function() {};
store.get = function() { return { articles: [], toolGuides: {}, recommendations: [] }; };
var zhHant = require('../services/zhHant');
var app = require('../app');
var server;
var base;

test.before(async function() {
  server = app.listen(0, '127.0.0.1');
  await new Promise(function(resolve) { server.once('listening', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(function() { server.close(); });

test('page text and text attributes are converted; code, values and links are not', function() {
  var html = '<!DOCTYPE html><html lang="zh"><head><title>汉字练习</title><meta name="description" content="打印练习纸">' +
    '<style>.a::after{content:"头发"}</style></head><body>' +
    '<h1 title="头发">我的头发</h1><img alt="面条" src="/面条.png">' +
    '<input placeholder="输入汉字" value="头发" data-word="头发"><option value="面条">面条</option>' +
    '<a href="/textbook/面条">面条</a><textarea>头发</textarea><!-- 头发 -->' +
    '<script>var w = "头发";</script></body></html>';
  var out = zhHant.convertHtml(html);
  assert.match(out, /<html lang="zh-Hant">/);
  assert.match(out, /<title>漢字練習<\/title>/);
  assert.match(out, /content="打印練習紙"/);
  assert.match(out, /content:"头发"/);
  assert.match(out, /<h1 title="頭髮">我的頭髮<\/h1>/);
  assert.match(out, /alt="麵條" src="\/面条.png"/);
  assert.match(out, /placeholder="輸入漢字" value="头发" data-word="头发"/);
  assert.match(out, /<option value="面条">麵條<\/option>/);
  assert.match(out, /<a href="\/textbook\/面条">麵條<\/a>/);
  assert.match(out, /<textarea>头发<\/textarea>/);
  assert.match(out, /<!-- 头发 -->/);
  assert.match(out, /var w = "头发";/);
  assert.ok(out.endsWith(zhHant.UI_SCRIPTS + '</body></html>'));
});

test('set-language stores 简 / 繁 next to lang=zh', async function() {
  var hant = await fetch(base + '/set-language?lang=zh&script=hant&redirect=/about', { redirect: 'manual' });
  assert.equal(hant.status, 302);
  assert.equal(hant.headers.get('location'), '/about');
  var cookies = hant.headers.getSetCookie().join('\n');
  assert.match(cookies, /lang=zh/);
  assert.match(cookies, /zhScript=hant/);

  var hans = await fetch(base + '/set-language?lang=zh&script=hans', { redirect: 'manual' });
  assert.match(hans.headers.getSetCookie().join('\n'), /zhScript=;/);

  var en = await fetch(base + '/set-language?lang=en', { redirect: 'manual' });
  assert.doesNotMatch(en.headers.getSetCookie().join('\n'), /zhScript/);
});

test('pages are sent in 繁体 only for lang=zh with zhScript=hant', async function() {
  var hant = await (await fetch(base + '/about', { headers: { cookie: 'lang=zh; zhScript=hant' } })).text();
  assert.match(hant, /<html lang="zh-Hant">/);
  assert.match(hant, /\/shared\/zh-ui\.js/);
  assert.match(hant, /關於|老師|陳/);

  var hans = await (await fetch(base + '/about', { headers: { cookie: 'lang=zh' } })).text();
  assert.doesNotMatch(hans, /zh-ui\.js/);
  assert.doesNotMatch(hans, /lang="zh-Hant"/);

  var en = await (await fetch(base + '/about', { headers: { cookie: 'lang=en; zhScript=hant' } })).text();
  assert.doesNotMatch(en, /zh-ui\.js/);
});
