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
