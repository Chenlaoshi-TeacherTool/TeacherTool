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

test('each teacher found shows their membership history', async function () {
  var page = await render({ search: { email: 'lin', teachers: [
    { email: 'lin@school.example', name: 'Ms Lin', createdAt: new Date(), lastSeenAt: new Date(), writeUntil: new Date('2027-11-04T00:00:00Z'), trialStartedAt: null, codesUsed: 1, activities: 0, events: [
      { kind: 'refund', days: -365, untilBefore: new Date('2027-11-04T00:00:00Z'), untilAfter: new Date('2026-11-04T00:00:00Z'), actor: 'Admin Chen', createdAt: new Date('2026-11-06T00:00:00Z'), batchLabel: 'paypal 123' },
      { kind: 'code', days: 365, untilBefore: new Date('2026-11-04T00:00:00Z'), untilAfter: new Date('2027-11-04T00:00:00Z'), actor: null, createdAt: new Date('2026-11-05T00:00:00Z'), batchLabel: 'paypal 123' },
      { kind: 'trial', days: 3, untilBefore: null, untilAfter: null, actor: null, createdAt: new Date('2026-11-01T00:00:00Z') }
    ] },
    { email: 'lin2@school.example', name: '', createdAt: new Date(), lastSeenAt: new Date(), writeUntil: null, trialStartedAt: null, codesUsed: 0, activities: 0, events: [] }
  ] } });
  assert.match(page, /Membership history \(3\)/);
  assert.match(page, /Refund \(code deactivated\) · paypal 123<\/td>\s*<td>-365<\/td>\s*<td>2027-11-04<\/td>\s*<td>2026-11-04<\/td>\s*<td>Admin Chen/);
  assert.match(page, /Activation code · paypal 123<\/td>\s*<td>\+365/);
  assert.match(page, /Free trial<\/td>\s*<td>\+3<\/td>\s*<td>—<\/td>\s*<td>—<\/td>\s*<td>teacher \/ site/);
  assert.match(page, /No membership changes recorded/);
});


test('directory shows all-account totals, selected status, persistent pagination and lazy history', async function() {
  var directory = { email: 'lin & chen', status: 'trial', page: 2, pages: 3, total: 60, teachers: [
    { ownerKey: 'a'.repeat(64), email: 'lin@example.org', name: '<img onerror=alert(1)>', status: 'trial', createdAt: new Date(), events: [{ kind: 'code', days: 30, createdAt: new Date() }] },
    { ownerKey: 'b'.repeat(64), email: null, name: 'Teacher B', status: 'expired', createdAt: new Date() }
  ] };
  var html = await render({ directory: directory, selectedTeacher: '', membershipTab: 'teachers' });
  assert.match(html, /共 60 位老师/);
  assert.match(html, /data-copy-email="lin@example.org"/);
  assert.match(html, /未提供邮箱/);
  assert.match(html, /试用中/);
  assert.match(html, /value="trial" selected/);
  assert.ok(html.includes('email=lin+%26+chen'));
  assert.ok(html.includes('status=trial&amp;page=1'));
  assert.ok(html.includes('status=trial&amp;page=3'));
  assert.ok(!html.includes('<img onerror'));
  assert.ok(!html.includes('Membership history (1)'));
  html = await render({ directory: directory, selectedTeacher: 'a'.repeat(64) });
  assert.ok(html.includes('Membership history (1)'));
  assert.ok(!html.includes('No membership changes recorded.'));
});

test('account listing escapes LIKE patterns, searches names, bounds pages and fetches only 25 accounts', async function() {
  var inputs = {}, query;
  var client = { sql: { NVarChar: function() {}, VarChar: function() {}, Int: 'Int' }, getPool: async function() {
    return { request: function() { return { input: function(key,type,value) { inputs[key]=value; return this; }, query: async function(sql) { query=sql; return { recordsets: [[{ total: 0, page: 1, pages: 1 }], []] }; } }; } };
  } };
  var repo = require('../services/teacherAccountsRepository');
  var result = await repo.list({ email: '  a%_[  ', status: 'invalid', page: '-4' }, client);
  assert.equal(inputs.query, '%a\\%\\_\\[%');
  assert.equal(inputs.status, 'all');
  assert.equal(inputs.page, 1);
  assert.match(query, /a.display_name LIKE @query/);
  assert.match(query, /@query=N'%%'/);
  assert.match(query, /revoked_at IS NULL/);
  assert.match(query, /ORDER BY created_at DESC, owner_key/);
  assert.match(query, /FETCH NEXT 25 ROWS ONLY/);
  assert.equal(result.total,0);
  await repo.list({ status: 'active', page: '9999999' }, client);
  assert.equal(inputs.page,9999999);
  assert.equal(inputs.status,'active');
  assert.match(query,/IF @page > @pages SET @page=@pages/);
});
