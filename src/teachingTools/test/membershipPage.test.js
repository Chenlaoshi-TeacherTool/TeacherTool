'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var store = require('../services/siteContentStore');
store.refresh = async function() {};
store.get = function() { return { articles: [], toolGuides: {}, recommendations: [] }; };
var membership = require('../config/membership');
var app = require('../app');
var server;
var base;

test.before(async function() {
  server = app.listen(0, '127.0.0.1');
  await new Promise(function(resolve) { server.once('listening', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(function() { server.close(); membership.paymentsOpen = false; membership.foundingEndsAt = null; });

test('while sales are closed the plans show "Coming soon" and no payment links', async function() {
  var html = await (await fetch(base + '/membership')).text();
  assert.match(html, /disabled>Coming soon</);
  assert.doesNotMatch(html, /paypal\.me/);
  assert.match(html, /Can I get a refund\?/);
  assert.match(html, /within the first 3 months/);
});

test('when sales open, each plan pays its founding price through PayPal with buying steps', async function() {
  membership.paymentsOpen = true;
  membership.foundingEndsAt = '2027-02-15';
  var html = await (await fetch(base + '/membership')).text();
  assert.match(html, /href="https:\/\/paypal\.me\/chenlaoshitoolkit\/12USD"/);
  assert.match(html, /href="https:\/\/paypal\.me\/chenlaoshitoolkit\/19USD"/);
  assert.match(html, /id="buy"/);
  assert.match(html, /Founding member prices are available until February 15, 2027/);
  var zh = await (await fetch(base + '/membership', { headers: { Cookie: 'lang=zh' } })).text();
  assert.match(zh, /PayPal 付款 \$19/);
  assert.match(zh, /创始会员价有效期至 2027年2月15日/);
});
