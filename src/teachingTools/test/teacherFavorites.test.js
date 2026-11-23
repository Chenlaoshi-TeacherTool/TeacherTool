'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var express = require('express');
var service = require('../routes/teacherLibrary');

var rows = [];
var failing = false;
var favorites = {
  MAX_PER_KIND: 500,
  list: async function (owner) { if (failing) throw new Error('sql'); return rows.filter(function (row) { return row.owner === owner; }).map(function (row) { return { kind: row.kind, ref: row.ref }; }); },
  add: async function (owner, kind, ref) { if (!rows.some(function (row) { return row.owner === owner && row.kind === kind && row.ref === ref; })) rows.push({ owner: owner, kind: kind, ref: ref }); },
  remove: async function (owner, kind, ref) { rows = rows.filter(function (row) { return !(row.owner === owner && row.kind === kind && row.ref === ref); }); },
  reorder: async function (owner, kind, refs) {
    rows.sort(function (a, b) { return (a.owner === owner ? refs.indexOf(a.ref) : 0) - (b.owner === owner ? refs.indexOf(b.ref) : 0); });
  }
};
var origin;
var server;
var accounts = true;
var SITE = 'https://teachers.example';

function headers(user, extra) {
  return Object.assign({ 'test-user': user || '', origin: SITE, 'x-library-request': 'favorites', 'Content-Type': 'application/json' }, extra);
}
function star(user, ref, on, extra) {
  return fetch(origin + '/api/teacher-library/favorites', { method: 'POST', headers: headers(user, extra), body: JSON.stringify({ kind: 'tool', ref: ref, on: on }) });
}
async function list(user) { return fetch(origin + '/api/teacher-library/favorites', { headers: headers(user) }); }

test.before(async function () {
  var app = express();
  app.use('/api/teacher-library', service.create({
    // Cloud library off: favorites must still work for every signed-in account.
    enabled: function () { return false; }, accountsEnabled: function () { return accounts; },
    favorites: favorites, accounts: { touch: async function () {} }, origin: SITE, providers: ['aad'],
    themeKeys: async function () { return ['halloween', 'school']; },
    toolHrefs: ['/teaching-tools/dice-story', '/teaching-tools/pixel-art', '/teaching-tools/spin-wheel?mode=hanzi'],
    getUser: function (req) { return req.get('test-user') ? { id: req.get('test-user'), name: 'T', provider: 'aad' } : null; }
  }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(function (resolve) { server.once('listening', resolve); });
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(function () { server.close(); });
test.beforeEach(function () { rows = []; failing = false; accounts = true; });

test('signed-out visitors see an empty list and cannot star', async function () {
  assert.deepEqual(await (await list('')).json(), { signedIn: false, favorites: [] });
  assert.equal((await star('', '/teaching-tools/dice-story', true)).status, 401);
  accounts = false;
  assert.equal((await (await list('ana')).json()).signedIn, false);
});

test('starring, listing, unstarring and order are per account', async function () {
  assert.equal((await star('ana', '/teaching-tools/dice-story', true)).status, 200);
  assert.equal((await star('ana', '/teaching-tools/spin-wheel?mode=hanzi', true)).status, 200);
  assert.equal((await star('ana', '/teaching-tools/dice-story', true)).status, 200);
  await star('ben', '/teaching-tools/pixel-art', true);
  var body = await (await list('ana')).json();
  assert.deepEqual(body.favorites.map(function (row) { return row.ref; }), ['/teaching-tools/dice-story', '/teaching-tools/spin-wheel?mode=hanzi']);
  var reorder = await fetch(origin + '/api/teacher-library/favorites/order', { method: 'PUT', headers: headers('ana'), body: JSON.stringify({ kind: 'tool', refs: ['/teaching-tools/spin-wheel?mode=hanzi', '/teaching-tools/dice-story'] }) });
  assert.equal(reorder.status, 200);
  body = await (await list('ana')).json();
  assert.deepEqual(body.favorites.map(function (row) { return row.ref; }), ['/teaching-tools/spin-wheel?mode=hanzi', '/teaching-tools/dice-story']);
  await star('ana', '/teaching-tools/dice-story', false);
  body = await (await list('ana')).json();
  assert.deepEqual(body.favorites.map(function (row) { return row.ref; }), ['/teaching-tools/spin-wheel?mode=hanzi']);
  assert.deepEqual((await (await list('ben')).json()).favorites.map(function (row) { return row.ref; }), ['/teaching-tools/pixel-art']);
});

test('unknown kinds and tools are refused; retired tools drop out of the list', async function () {
  assert.equal((await star('ana', '/teaching-tools/not-a-tool', true)).status, 400);
  var res = await fetch(origin + '/api/teacher-library/favorites', { method: 'POST', headers: headers('ana'), body: JSON.stringify({ kind: 'secret', ref: 'x', on: true }) });
  assert.equal(res.status, 400);
  rows.push({ owner: service.ownerKey({ id: 'ana', provider: 'aad' }), kind: 'tool', ref: '/teaching-tools/retired' });
  assert.deepEqual((await (await list('ana')).json()).favorites, []);
});

test('writes must come from this site', async function () {
  assert.equal((await star('ana', '/teaching-tools/dice-story', true, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await star('ana', '/teaching-tools/dice-story', true, { 'x-library-request': 'save' })).status, 403);
  assert.equal(rows.length, 0);
});

test('database trouble is a 503 without details', async function () {
  failing = true;
  var res = await list('ana');
  assert.equal(res.status, 503);
  assert.doesNotMatch(await res.text(), /sql/);
});

test('themes can be starred by key; unknown themes are refused', async function () {
  var post = function (ref) { return fetch(origin + '/api/teacher-library/favorites', { method: 'POST', headers: headers('ana'), body: JSON.stringify({ kind: 'theme', ref: ref, on: true }) }); };
  assert.equal((await post('halloween')).status, 200);
  assert.equal((await post('no-such-theme')).status, 400);
  await star('ana', '/teaching-tools/dice-story', true);
  var body = await (await list('ana')).json();
  assert.deepEqual(body.favorites, [{ kind: 'theme', ref: 'halloween' }, { kind: 'tool', ref: '/teaching-tools/dice-story' }]);
});
