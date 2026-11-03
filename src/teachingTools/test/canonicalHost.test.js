'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var store = require('../services/siteContentStore');
store.refresh = async function() {};
store.get = function() { return { articles: [], toolGuides: {}, recommendations: [] }; };
var app = require('../app');
var server;
var base;
var previous = process.env.SITE_URL;

test.before(async function() {
  process.env.SITE_URL = 'https://clsteachingtools.com';
  server = app.listen(0, '127.0.0.1');
  await new Promise(function(resolve) { server.once('listening', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(function() {
  server.close();
  if (previous === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = previous;
});

test('www pages forward to the canonical host with the same path and query', async function() {
  var response = await fetch(base + '/membership?lang=zh', { redirect: 'manual', headers: { 'x-forwarded-host': 'www.clsteachingtools.com' } });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), 'https://clsteachingtools.com/membership?lang=zh');
});

test('the canonical host and non-GET requests are served normally', async function() {
  assert.equal((await fetch(base + '/membership', { redirect: 'manual', headers: { 'x-forwarded-host': 'clsteachingtools.com' } })).status, 200);
  var post = await fetch(base + '/api/teacher-library/redeem', { method: 'POST', redirect: 'manual', headers: { 'x-forwarded-host': 'www.clsteachingtools.com' } });
  assert.notEqual(post.status, 301);
});
