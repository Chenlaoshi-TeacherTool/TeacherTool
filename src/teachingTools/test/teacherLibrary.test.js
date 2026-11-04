'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var express = require('express');
var service = require('../routes/teacherLibrary');
var activationCodes = require('../services/activationCodes');
var core = require('../public/shared/library-v2');

var records = new Map();
var grants = new Set();
var trials = new Set();
var codes = new Map();
var origin;
var server;
var active = true;
var writes = 0;
var storageFailure = false;
var repository = {
  load: async function (owner) {
    if (storageFailure) throw new Error('private sql detail');
    var row = records.get(owner);
    return { content: row ? row.content : null, revision: row ? row.revision : 0, canWrite: grants.has(owner), writeUntil: grants.has(owner) ? '2099-01-01T00:00:00.000Z' : null, trial: trials.has(owner) };
  },
  save: async function (owner, revision, content) {
    if (storageFailure) throw new Error('private sql detail');
    if (!grants.has(owner)) return { outcome: 'forbidden' };
    var previous = records.get(owner);
    if ((previous ? previous.revision : 0) !== revision) return { outcome: 'conflict' };
    records.set(owner, { content: content, revision: revision + 1 });
    writes += 1;
    return { outcome: 'saved', revision: revision + 1 };
  },
  ensureTrial: async function (owner) { if (!trials.has(owner) && !grants.has(owner)) { trials.add(owner); grants.add(owner); } },
  redeem: async function (owner, codeHash) {
    var code = codes.get(codeHash);
    if (!code || code.redeemedBy) return { outcome: 'invalid' };
    code.redeemedBy = owner; grants.add(owner);
    return { outcome: 'redeemed', days: code.days, writeUntil: '2099-01-01T00:00:00.000Z' };
  }
};

function owner(id, provider) { return service.ownerKey({ id: id, provider: provider || 'aad' }); }
async function data(name) { return (await core.preview(JSON.stringify({ name: name, items: [{ zh: '苹果', en: 'apple' }] }))).data; }
async function save(id, library, revision, extra) {
  return fetch(origin + '/api/teacher-library/mine', { method: 'PUT', headers: Object.assign({ 'test-user': id, origin: 'https://teachers.example', 'x-library-request': 'save', 'x-library-account': owner(id), 'Content-Type': 'application/vnd.cls-library+json', 'If-Match': '"' + revision + '"' }, extra), body: typeof library === 'string' ? library : JSON.stringify(library) });
}

test.before(async function () {
  var app = express();
  app.use(express.json());
  app.use('/api/teacher-library', service.create({ repository: repository, enabled: function () { return active; }, origin: 'https://teachers.example', providers: ['aad', 'google'], getUser: function (req) { return req.get('test-user') ? { id: req.get('test-user'), name: req.get('test-user'), provider: req.get('test-provider') || 'aad' } : null; } }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(function (resolve) { server.once('listening', resolve); });
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(function () { server.close(); });
test.beforeEach(function () { records.clear(); grants.clear(); trials.clear(); codes.clear(); writes = 0; active = true; storageFailure = false; });

test('anonymous requests cannot read or save; session exposes only fixed login destinations', async function () {
  var response = await fetch(origin + '/api/teacher-library/mine');
  assert.equal(response.status, 401);
  var session = await (await fetch(origin + '/api/teacher-library/session')).json();
  assert.equal(session.signedIn, false);
  assert(session.login.every(function (login) { return login.url.startsWith('/.auth/login/'); }));
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('two teachers read only their own library and client ownership claims cannot select another account', async function () {
  grants.add(owner('alice')); grants.add(owner('bob'));
  assert.equal((await save('alice', await data('Alice library'), 0)).status, 200);
  var bob = await data('Bob library');
  bob.ownerId = owner('alice');
  assert.equal((await save('bob', bob, 0)).status, 200);
  var aliceResult = await (await fetch(origin + '/api/teacher-library/mine?owner=' + owner('bob'), { headers: { 'test-user': 'alice' } })).json();
  var bobResult = await (await fetch(origin + '/api/teacher-library/mine?owner=' + owner('alice'), { headers: { 'test-user': 'bob' } })).json();
  assert.equal(aliceResult.library.collections[0].name, 'Alice library');
  assert.equal(bobResult.library.collections[0].name, 'Bob library');
  assert.notEqual(owner('same', 'aad'), owner('same', 'google'));
});

test('an expired account can read and export existing content but cannot save or grant itself access', async function () {
  grants.add(owner('alice'));
  await save('alice', await data('Original'), 0);
  grants.delete(owner('alice'));
  var changed = await data('Changed'); changed.paid = true;
  assert.equal((await save('alice', changed, 1, { 'x-paid': 'true' })).status, 403);
  var result = await (await fetch(origin + '/api/teacher-library/mine', { headers: { 'test-user': 'alice' } })).json();
  assert.equal(result.canWrite, false);
  assert.equal(result.library.collections[0].name, 'Original');
});

test('requires same-origin custom save headers and a reviewed revision', async function () {
  grants.add(owner('alice'));
  var library = await data('Protected');
  assert.equal((await save('alice', library, 0, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await save('alice', library, 0, { 'x-library-request': '' })).status, 403);
  assert.equal((await save('alice', library, 0, { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await save('alice', library, 0, { 'If-Match': '' })).status, 428);
  assert.equal((await save('alice', library, 0, { 'x-library-account': owner('bob') })).status, 409);
  assert.equal(writes, 0);
});

test('optimistic concurrency rejects a stale device instead of overwriting a newer cloud copy', async function () {
  grants.add(owner('alice'));
  assert.equal((await save('alice', await data('First device'), 0)).status, 200);
  assert.equal((await save('alice', await data('Stale device'), 0)).status, 409);
  assert.equal(JSON.parse(records.get(owner('alice')).content).collections[0].name, 'First device');
  assert.equal(writes, 1);
});

test('validates versions and malformed files; larger valid bodies bypass the app’s default JSON limit safely', async function () {
  grants.add(owner('alice'));
  assert.equal((await save('alice', '{broken', 0)).status, 400);
  var invalid = await data('Invalid'); invalid.schemaVersion = 99;
  assert.equal((await save('alice', invalid, 0)).status, 400);
  var large = await data('Large'); large.collections[0].items[0].note = '文'.repeat(50000);
  assert.equal((await save('alice', large, 0)).status, 200);
  assert.equal((await save('alice', ' '.repeat(5 * 1024 * 1024 + 1), 1)).status, 413);
});

test('disabled rollout and storage failures fail closed without leaking database errors', async function () {
  active = false;
  assert.equal((await fetch(origin + '/api/teacher-library/mine', { headers: { 'test-user': 'alice' } })).status, 503);
  var session = await (await fetch(origin + '/api/teacher-library/session')).json();
  assert.equal(session.available, false); assert.deepEqual(session.login, []);
  active = true; storageFailure = true;
  var response = await fetch(origin + '/api/teacher-library/mine', { headers: { 'test-user': 'alice' } });
  assert.equal(response.status, 503);
  assert(!(await response.text()).includes('private sql detail'));
});

test('spoofed platform headers are not trusted on a normal local server', function () {
  var previous = process.env.WEBSITE_INSTANCE_ID;
  delete process.env.WEBSITE_INSTANCE_ID;
  try { assert.equal(service.trustedUser({ get: function () { return 'spoofed'; } }), null); }
  finally { if (previous !== undefined) process.env.WEBSITE_INSTANCE_ID = previous; }
});

test('teacher sign-in stays available when cloud storage is disabled and exposes only the dedicated provider', async function () {
  var app = express();
  app.use(service.create({ accountsEnabled: function () { return true; }, enabled: function () { return false; }, googleEnabled: true, getUser: function () { return { id: 'teacher', provider: 'teachers', name: 'Teacher' }; }, repository: { load: function () { throw new Error('Cloud should not be queried'); } } }));
  var temporary = app.listen(0, '127.0.0.1');
  await new Promise(function (resolve) { temporary.once('listening', resolve); });
  try {
    var result = await (await fetch('http://127.0.0.1:' + temporary.address().port + '/session')).json();
    assert.equal(result.available, true); assert.equal(result.signedIn, true); assert.equal(result.cloudAvailable, false);
    assert.equal(result.canWrite, false); assert(result.methods.includes('google'));
    assert.equal(result.login[0].provider, 'teachers');
  } finally { temporary.close(); }
});

test('teacher identities cannot use an administrator ID, while the original aad administrator still works', function () {
  var saved = { enabled: process.env.AZURE_AUTH_ENABLED, instance: process.env.WEBSITE_INSTANCE_ID, admins: process.env.ADMIN_USER_IDS };
  process.env.AZURE_AUTH_ENABLED = 'true'; process.env.WEBSITE_INSTANCE_ID = 'test-instance'; process.env.ADMIN_USER_IDS = 'same-id';
  var requireAdmin = require('../middleware/requireAdmin');
  function request(provider) { return { get: function (name) { return { 'x-ms-client-principal-id': 'same-id', 'x-ms-client-principal-name': 'Teacher', 'x-ms-client-principal-idp': provider }[name]; } }; }
  try {
    var status;
    var response = { status: function (value) { status = value; return this; }, send: function () {} };
    var advanced = false;
    requireAdmin(request('teachers'), response, function () { advanced = true; });
    assert.equal(status, 403); assert.equal(advanced, false);
    requireAdmin(request('aad'), response, function () { advanced = true; });
    assert.equal(advanced, true);
    assert.equal(service.trustedUser(request('teachers')).provider, 'teachers');
  } finally {
    [['AZURE_AUTH_ENABLED', saved.enabled], ['WEBSITE_INSTANCE_ID', saved.instance], ['ADMIN_USER_IDS', saved.admins]].forEach(function (entry) { if (entry[1] === undefined) delete process.env[entry[0]]; else process.env[entry[0]] = entry[1]; });
  }
});

function redeem(id, code, extra) {
  return fetch(origin + '/api/teacher-library/redeem', { method: 'POST', headers: Object.assign({ 'test-user': id, origin: 'https://teachers.example', 'x-library-request': 'redeem', 'Content-Type': 'application/json' }, extra), body: JSON.stringify({ code: code }) });
}

test('a new teacher gets one automatic trial on first sign-in; an expired trial is not renewed', async function () {
  var session = await (await fetch(origin + '/api/teacher-library/session', { headers: { 'test-user': 'carol' } })).json();
  assert.equal(session.canWrite, true);
  assert.equal(session.membership.trial, true);
  grants.delete(owner('carol'));
  session = await (await fetch(origin + '/api/teacher-library/session', { headers: { 'test-user': 'carol' } })).json();
  assert.equal(session.canWrite, false);
  assert.equal(session.membership.canWrite, false);
});

test('an activation code works once, accepts loose formatting, and only from this website', async function () {
  var code = activationCodes.generate();
  codes.set(activationCodes.hash(code), { days: 30 });
  assert.equal((await redeem('dave', code, { origin: 'https://evil.example' })).status, 403);
  var response = await redeem('dave', code.toLowerCase().replace(/-/g, ' '));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).days, 30);
  assert(grants.has(owner('dave')));
  assert.equal((await redeem('erin', code)).status, 400);
  assert.equal((await redeem('anonymous', code, { 'test-user': '' })).status, 401);
});

test('repeated wrong codes are rate limited per account', async function () {
  for (var i = 0; i < 5; i += 1) assert.equal((await redeem('frank', 'CLS-2222-2222-2222')).status, 400);
  assert.equal((await redeem('frank', 'CLS-2222-2222-2222')).status, 429);
  assert.equal((await redeem('grace', 'CLS-2222-2222-2222')).status, 400);
});

test('activation codes avoid look-alike characters and are stored only as hashes', function () {
  var code = activationCodes.generate();
  assert.match(code, /^CLS-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(activationCodes.hash(code), activationCodes.hash(' ' + code.toLowerCase().replace(/-/g, '') + ' '));
  assert.equal(activationCodes.hash('CLS-0000-OOOO-IIII'), null);
  assert.notEqual(activationCodes.hash(code), code);
});

test('signed-in teachers list, claim, and remove their shared activities; tokens prove ownership', async function () {
  var rows = [];
  var manifests = {
    '11111111-1111-4111-8111-111111111111': { title: 'Quiz A', gameType: 'sentence-reorder', deleteToken: 'token-a', createdAt: '2026-11-01T00:00:00.000Z', expiresAt: '2099-01-01T00:00:00.000Z' },
    '22222222-2222-4222-8222-222222222222': { title: 'Taken', gameType: 'word-sudoku', deleteToken: 'token-b', ownerKey: owner('bob'), expiresAt: '2099-01-01T00:00:00.000Z' }
  };
  var activityRepo = {
    list: async function (key) { return rows.filter(function (row) { return row.owner === key; }); },
    add: async function (key, item) { if (!rows.some(function (row) { return row.owner === key && row.id === item.id; })) rows.push(Object.assign({ owner: key }, item)); },
    remove: async function (key, kind, id) { rows = rows.filter(function (row) { return !(row.owner === key && row.kind === kind && row.id === id); }); }
  };
  var gameStore = {
    validShareId: function (id) { return /^[0-9a-f-]{36}$/.test(id); },
    getManifest: async function (id) { return manifests[id] ? JSON.parse(JSON.stringify(manifests[id])) : null; },
    saveManifest: async function (id, manifest) { manifests[id] = manifest; }
  };
  var app = express();
  app.use(service.create({ repository: repository, enabled: function () { return true; }, origin: 'https://teachers.example', providers: ['aad'], activities: activityRepo, stores: { game: gameStore, book: gameStore },
    getUser: function (req) { return req.get('test-user') ? { id: req.get('test-user'), name: req.get('test-user'), provider: 'aad' } : null; } }));
  var temporary = app.listen(0, '127.0.0.1');
  await new Promise(function (resolve) { temporary.once('listening', resolve); });
  var url = 'http://127.0.0.1:' + temporary.address().port;
  function call(method, pathname, user, body, extra) {
    return fetch(url + pathname, { method: method, headers: Object.assign({ 'test-user': user || '', 'Content-Type': 'application/json', origin: 'https://teachers.example', 'x-library-request': 'activities' }, extra), body: body ? JSON.stringify(body) : undefined });
  }
  try {
    assert.equal((await call('GET', '/activities', '')).status, 401);
    var claim = { items: [
      { kind: 'game', id: '11111111-1111-4111-8111-111111111111', deleteToken: 'token-a' },
      { kind: 'game', id: '11111111-1111-4111-8111-111111111111', deleteToken: 'wrong' },
      { kind: 'game', id: '22222222-2222-4222-8222-222222222222', deleteToken: 'token-b' }
    ] };
    assert.equal((await call('POST', '/activities/claim', 'alice', claim, { origin: 'https://evil.example' })).status, 403);
    var claimed = await (await call('POST', '/activities/claim', 'alice', claim)).json();
    assert.deepEqual(claimed, { added: 1, skipped: 2 });
    assert.equal(manifests['11111111-1111-4111-8111-111111111111'].ownerKey, owner('alice'));
    assert.equal(manifests['22222222-2222-4222-8222-222222222222'].ownerKey, owner('bob'));
    var aliceList = (await (await call('GET', '/activities', 'alice')).json()).activities;
    assert.deepEqual(aliceList.map(function (row) { return row.title; }), ['Quiz A']);
    assert.deepEqual((await (await call('GET', '/activities', 'bob')).json()).activities, []);
    assert.equal((await call('DELETE', '/activities/game/11111111-1111-4111-8111-111111111111', 'alice', null, { 'x-library-request': '' })).status, 403);
    assert.equal((await call('DELETE', '/activities/game/11111111-1111-4111-8111-111111111111', 'alice')).status, 200);
    assert.deepEqual((await (await call('GET', '/activities', 'alice')).json()).activities, []);
  } finally { temporary.close(); }
});

test('the account activity list and claim are members-only when limits say so', async function () {
  var app = express();
  app.use(service.create({ repository: repository, enabled: function () { return true; }, origin: 'https://teachers.example', providers: ['aad'],
    activities: { list: async function () { return []; }, add: async function () {} }, limits: { canUseMyActivities: async function () { return false; } },
    getUser: function () { return { id: 'free', name: 'free', provider: 'aad' }; } }));
  var temporary = app.listen(0, '127.0.0.1');
  await new Promise(function (resolve) { temporary.once('listening', resolve); });
  var url = 'http://127.0.0.1:' + temporary.address().port;
  try {
    var list = await fetch(url + '/activities');
    assert.equal(list.status, 403);
    assert.equal((await list.json()).membersOnly, true);
    var claim = await fetch(url + '/activities/claim', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://teachers.example', 'x-library-request': 'activities' }, body: JSON.stringify({ items: [] }) });
    assert.equal(claim.status, 403);
  } finally { temporary.close(); }
});
