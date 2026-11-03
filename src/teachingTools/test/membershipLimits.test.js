'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var membership = require('../config/membership');
var membershipLimits = require('../services/membershipLimits');

var DAY_MS = 24 * 60 * 60 * 1000;

function limits(enabled, member) {
  return membershipLimits.create({ enabled: function () { return enabled; }, isMember: async function () { return member; } });
}

test('limits stay off by default so existing links keep their 90-day lifetime', async function () {
  assert.equal(membership.limitsEnabled, process.env.MEMBERSHIP_LIMITS_ENABLED === 'true');
  assert.equal(await limits(false, false).shareLifetimeMs({}), 90 * DAY_MS);
  assert.equal(await limits(false, false).canUseBookAudio({}), true);
});

test('once limits are on, free links last 7 days and member links a semester', async function () {
  assert.equal(await limits(true, false).shareLifetimeMs({}), 7 * DAY_MS);
  assert.equal(await limits(true, true).shareLifetimeMs({}), 180 * DAY_MS);
});

test('book narration and music need a membership only when limits are on', async function () {
  assert.equal(await limits(true, false).canUseBookAudio({}), false);
  assert.equal(await limits(true, true).canUseBookAudio({}), true);
});

test('a visitor who is not signed in is never treated as a member', async function () {
  var previous = process.env.WEBSITE_INSTANCE_ID;
  delete process.env.WEBSITE_INSTANCE_ID;
  try {
    var real = membershipLimits.create({ enabled: function () { return true; } });
    assert.equal(await real.shareLifetimeMs({ get: function () { return 'spoofed'; } }), 7 * DAY_MS);
  } finally { if (previous !== undefined) process.env.WEBSITE_INSTANCE_ID = previous; }
});

test('class quiz results are open to everyone until limits are on, then to members only', async function () {
  assert.equal(await limits(false, false).canViewQuizResults({}), true);
  assert.equal(await limits(true, false).canViewQuizResults({}), false);
  assert.equal(await limits(true, true).canViewQuizResults({}), true);
});
