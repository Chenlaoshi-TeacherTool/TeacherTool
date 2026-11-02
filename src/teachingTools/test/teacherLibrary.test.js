'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var express = require('express');
var service = require('../routes/teacherLibrary');
var core = require('../public/shared/library-v2');

var records = new Map();
var grants = new Set();
var origin;
var server;
var active = true;
var writes = 0;
var storageFailure = false;
var repository = {
  load: async function (owner) {
    if (storageFailure) throw new Error('private sql detail');
    var row = records.get(owner);
    return { content: row ? row.content : null, revision: row ? row.revision : 0, canWrite: grants.has(owner) };
  },
  save: async function (owner, revision, content) {
    if (storageFailure) throw new Error('private sql detail');
    if (!grants.has(owner)) return { outcome: 'forbidden' };
    var previous = records.get(owner);
    if ((previous ? previous.revision : 0) !== revision) return { outcome: 'conflict' };
    records.set(owner, { content: content, revision: revision + 1 });
    writes += 1;
    return { outcome: 'saved', revision: revision + 1 };
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
test.beforeEach(function () { records.clear(); grants.clear(); writes = 0; active = true; storageFailure = false; });

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
