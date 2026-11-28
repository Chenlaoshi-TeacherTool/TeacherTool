'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var EventEmitter = require('node:events');
var rateLimit = require('../services/rateLimit');

function fakeRes() {
  var res = new EventEmitter();
  res.headers = {};
  res.set = function (k, v) { res.headers[k] = v; return res; };
  res.status = function (code) { res.statusCode = code; return res; };
  res.json = function (body) { res.body = body; return res; };
  return res;
}
function run(middleware, ip) {
  var res = fakeRes();
  var passed = false;
  middleware({ ip: ip || '1.2.3.4' }, res, function () { passed = true; });
  return { res: res, passed: passed };
}

test('perClient lets max requests through per IP, then 429 until the window resets', function () {
  var time = 0;
  var limit = rateLimit.perClient({ windowMs: 1000, max: 2, message: 'slow down', now: function () { return time; } });
  assert.ok(run(limit).passed);
  assert.ok(run(limit).passed);
  var third = run(limit);
  assert.equal(third.passed, false);
  assert.equal(third.res.statusCode, 429);
  assert.equal(third.res.body.error, 'slow down');
  assert.equal(third.res.headers['Retry-After'], '1');
  assert.ok(run(limit, '5.6.7.8').passed, 'another IP has its own budget');
  time = 1000;
  assert.ok(run(limit).passed, 'budget resets after the window');
});

test('concurrency refuses with 503 while max requests are in progress, and frees a slot when one ends', function () {
  var limit = rateLimit.concurrency({ max: 2, message: 'busy' });
  var a = run(limit);
  var b = run(limit);
  assert.ok(a.passed && b.passed);
  var c = run(limit);
  assert.equal(c.passed, false);
  assert.equal(c.res.statusCode, 503);
  assert.equal(c.res.body.busy, true);
  a.res.emit('finish');
  a.res.emit('close');
  assert.equal(limit.active(), 1, 'finish and close release one slot, not two');
  assert.ok(run(limit).passed);
  b.res.emit('close');
  assert.equal(limit.active(), 1);
});
