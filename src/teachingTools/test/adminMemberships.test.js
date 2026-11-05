'use strict';

var assert = require('node:assert/strict');
var path = require('node:path');
var test = require('node:test');
var ejs = require('ejs');

var view = path.join(__dirname, '../views/admin/memberships.ejs');
function render(locals) {
  return ejs.renderFile(view, Object.assign({ title: 'Memberships', batches: [], created: null, planDays: [30, 90, 180, 365], adminUser: { name: 'Admin' }, adminNav: [] }, locals));
}

test('the memberships page offers code deactivation and reports each outcome', async function () {
  var plain = await render({});
  assert.match(plain, /action="\/admin\/memberships\/revoke"/);
  assert.match(await render({ revoked: { outcome: 'revoked', wasUsed: true, days: 30, writeUntil: new Date('2026-12-05T00:00:00Z') } }), /30 days were taken back[\s\S]*now until 2026-12-05/);
  assert.match(await render({ revoked: { outcome: 'revoked', wasUsed: false, days: 30 } }), /Nobody had used it/);
  assert.match(await render({ revoked: { outcome: 'already' } }), /already deactivated/);
  assert.match(await render({ revoked: { outcome: 'not-found' } }), /No code matches/);
  assert.match(await render({ batches: [{ created_at: new Date(), batch_label: 'order 12', days: 365, total: 3, redeemed: 2, revoked: 1 }] }), /2 \/ 3<\/td><td>1<\/td>/);
});

test('the memberships page finds teachers by email and shows their membership', async function () {
  var page = await render({ search: { email: 'lin', teachers: [
    { email: 'lin@school.example', name: 'Ms Lin', createdAt: new Date('2026-11-01T00:00:00Z'), lastSeenAt: new Date('2026-11-04T00:00:00Z'), writeUntil: new Date('2099-01-01T00:00:00Z'), trialStartedAt: new Date('2026-11-01T00:00:00Z'), codesUsed: 1, activities: 4 },
    { email: 'lin2@school.example', name: '<b>x</b>', createdAt: new Date(), lastSeenAt: new Date(), writeUntil: new Date('2026-01-01T00:00:00Z'), trialStartedAt: null, codesUsed: 0, activities: 0 }
  ] } });
  assert.match(page, /action="\/admin\/memberships"/);
  assert.match(page, /lin@school\.example[\s\S]*2099-01-01 \(active\)/);
  assert.match(page, /2026-01-01 \(ended\)/);
  assert.doesNotMatch(page, /<b>x<\/b>/);
  assert.match(await render({ search: { email: 'nobody', teachers: [] } }), /No account matches/);
  assert.doesNotMatch(await render({}), /No account matches/);
});
