'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var path = require('path');
var express = require('express');
var i18n = require('../services/i18n');
var community = require('../services/community');
var communityRoutes = require('../routes/community');

var SITE = 'https://teachers.example';
var posts = new Map();
var games = new Map();
var accountsOn = true;
var origin;
var server;

var repository = {
  create: async function (post) {
    var row = Object.assign({ status: 'live', reportCount: 0, useCount: 0, createdAt: new Date().toISOString() }, post);
    posts.set(post.id, row);
    return row;
  },
  listAll: async function (status) {
    return Array.from(posts.values()).filter(function (post) { return !status || post.status === status; }).reverse();
  },
  get: async function (id) { return posts.get(id) || null; },
  remove: async function (id, owner) {
    var post = posts.get(id);
    if (!post || (owner && post.ownerKey !== owner)) return false;
    return posts.delete(id);
  },
  report: async function (id) { var post = posts.get(id); if (!post) return false; post.reportCount += 1; return true; },
  reports: async function () { return []; },
  countUse: async function (id) { var post = posts.get(id); if (post) post.useCount += 1; return true; },
  setStatus: async function (id, status) { var post = posts.get(id); if (!post) return false; post.status = status; return true; },
  lastAuthorName: async function (owner) {
    var mine = Array.from(posts.values()).filter(function (post) { return post.ownerKey === owner; });
    return mine.length ? mine[mine.length - 1].authorName : '';
  }
};

var activities = {
  getGame: async function (owner, id) { return games.get(owner + ':' + id) || null; }
};

function headers(user, extra) {
  return Object.assign({ origin: SITE, 'x-community-request': 'yes', 'Content-Type': 'application/json' }, user ? { 'test-user': user } : {}, extra || {});
}

function publish(user, body, extra) {
  return fetch(origin + '/api/community/posts', { method: 'POST', headers: headers(user, extra), body: JSON.stringify(body) });
}

function wordList(extra) {
  return Object.assign({ kind: 'wordlist', title: '轻松学中文 3A 第一课', authorName: '王老师', stages: ['non-native', 'primary', 'bogus'], textbook: 'qingsong',
    words: [{ zh: '苹果', py: 'píng guǒ', en: 'apple' }, { zh: '香蕉', py: 'xiāng jiāo', en: 'banana' }] }, extra);
}

test.before(async function () {
  var app = express();
  app.set('views', path.join(__dirname, '../views'));
  app.set('view engine', 'ejs');
  app.use(express.json());
  app.use(function (req, res, next) {
    res.locals.lang = req.get('test-lang') === 'zh' ? 'zh' : 'en';
    res.locals.t = function (key) { return i18n.t(res.locals.lang, key); };
    next();
  });
  app.use('/', communityRoutes.create({
    repository: repository, activities: activities, origin: SITE,
    accountsOn: function () { return accountsOn; },
    getUser: function (req) { return req.get('test-user') ? { id: req.get('test-user'), provider: 'teachers' } : null; },
    ownerKey: function (user) { return 'owner-' + user.id; },
    loginProvider: function () { return 'teachers'; }
  }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(function (resolve) { server.once('listening', resolve); });
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(function () { server.close(); });
test.beforeEach(function () { posts.clear(); games.clear(); accountsOn = true; });

test('a signed-in teacher publishes a word list; tags are cleaned and it shows on the list and detail pages', async function () {
  var response = await publish('alice', wordList());
  assert.equal(response.status, 201);
  var created = await response.json();
  assert.match(created.url, /^\/community\/[A-Za-z0-9_-]{8}$/);
  var saved = posts.get(created.id);
  assert.deepEqual(saved.stages, ['non-native', 'primary']);
  assert.equal(saved.itemCount, 2);
  assert.equal(saved.ownerKey, 'owner-alice');

  var list = await (await fetch(origin + '/community?stage=primary', { headers: { 'test-lang': 'zh' } })).text();
  assert.match(list, /轻松学中文 3A 第一课/);
  assert.match(list, /王老师/);
  var detail = await (await fetch(origin + created.url)).text();
  assert.match(detail, /píng guǒ/);
  assert.doesNotMatch(detail, /Delete my post/);
  var ownDetail = await (await fetch(origin + created.url, { headers: { 'test-user': 'alice' } })).text();
  assert.match(ownDetail, /Delete my post/);
});

test('publishing needs an account, a same-site request, and real content', async function () {
  assert.equal((await publish(null, wordList())).status, 401);
  assert.equal((await publish('alice', wordList(), { origin: 'https://evil.example' })).status, 403);
  assert.equal((await publish('alice', wordList({ words: [] }))).status, 400);
  assert.equal((await publish('alice', wordList({ authorName: ' ' }))).status, 400);
  var many = []; for (var i = 0; i <= community.MAX_WORDS; i += 1) many.push({ zh: '字' + i });
  assert.equal((await publish('alice', wordList({ words: many }))).status, 400);
  accountsOn = false;
  assert.equal((await publish('alice', wordList())).status, 401);
  assert.equal(posts.size, 0);
});

test('a game is shared from the teacher\'s own saved activity only', async function () {
  games.set('owner-alice:game-1', { gameType: 'sentence-reorder', version: 1, title: 'Lesson 3',
    payload: { title: 'Lesson 3', sentences: ['我 喜欢 吃 苹果', '他 是 老师'] } });
  var other = await publish('bob', { kind: 'game', activityId: 'game-1', title: 'Stolen', authorName: 'Bob' });
  assert.equal(other.status, 404);
  var response = await publish('alice', { kind: 'game', activityId: 'game-1', title: 'Lesson 3 sentences', authorName: '王老师' });
  assert.equal(response.status, 201);
  var saved = posts.get((await response.json()).id);
  assert.equal(saved.gameType, 'sentence-reorder');
  assert.equal(saved.itemCount, 2);
  var detail = await (await fetch(origin + '/community/' + saved.id)).text();
  assert.match(detail, /Make my own student link/);
});

test('only the author can delete; hidden posts disappear for everyone else', async function () {
  var created = await (await publish('alice', wordList())).json();
  var del = function (user) { return fetch(origin + '/api/community/posts/' + created.id, { method: 'DELETE', headers: headers(user) }); };
  assert.equal((await del('bob')).status, 404);
  posts.get(created.id).status = 'hidden';
  assert.equal((await fetch(origin + created.url)).status, 404);
  assert.equal((await fetch(origin + created.url, { headers: { 'test-user': 'alice' } })).status, 200);
  assert.equal((await del('alice')).status, 200);
  assert.equal(posts.size, 0);
});

test('reports and uses are counted once per visitor', async function () {
  var created = await (await publish('alice', wordList())).json();
  var report = function () { return fetch(origin + '/api/community/posts/' + created.id + '/report', { method: 'POST', headers: headers(null), body: JSON.stringify({ reason: 'spam' }) }); };
  assert.equal((await report()).status, 200);
  assert.equal((await report()).status, 200);
  assert.equal(posts.get(created.id).reportCount, 1);
  var use = function () { return fetch(origin + '/api/community/posts/' + created.id + '/used', { method: 'POST', headers: headers(null) }); };
  await use(); await use();
  assert.equal(posts.get(created.id).useCount, 1);
});

test('the sign-in link only returns to community pages', async function () {
  var me = await (await fetch(origin + '/api/community/me?back=' + encodeURIComponent('https://evil.example/'))).json();
  assert.equal(me.signedIn, false);
  assert.equal(me.loginUrl, '/.auth/login/teachers?post_login_redirect_uri=' + encodeURIComponent('/community/share'));
  me = await (await fetch(origin + '/api/community/me?back=' + encodeURIComponent('/community/share?game=abc'))).json();
  assert.equal(me.loginUrl, '/.auth/login/teachers?post_login_redirect_uri=' + encodeURIComponent('/community/share?game=abc'));
});

test('search filters by text, type, stage and textbook and pages the results', function () {
  var list = [];
  for (var i = 0; i < 30; i += 1) list.push({ id: 'p' + i, kind: i % 2 ? 'game' : 'wordlist', title: 'Lesson ' + i, description: '', authorName: 'T', stages: i < 5 ? ['adult'] : [], textbook: i < 3 ? 'hsk' : '' });
  assert.equal(community.search(list, {}).posts.length, community.PAGE_SIZE);
  assert.equal(community.search(list, { page: 2 }).posts.length, 30 - community.PAGE_SIZE);
  assert.equal(community.search(list, { kind: 'game' }).total, 15);
  assert.equal(community.search(list, { stage: 'adult' }).total, 5);
  assert.equal(community.search(list, { textbook: 'hsk', q: 'lesson 1' }).total, 1);
  assert.equal(community.search(list, { stage: 'not-a-stage' }).total, 30);
});

test('external submissions wait for review, then filter and open safely when approved', async function () {
  for (var kind of ['contest', 'website']) {
    var response = await publish('external-' + kind, { kind: kind, title: kind + ' recommendation', authorName: 'Teacher',
      url: 'https://example.org/events?year=2026', audience: 'Ages 6–12', deadline: '2020-01-01' });
    assert.equal(response.status, 201);
    var created = await response.json();
    var saved = posts.get(created.id);
    assert.equal(saved.status, 'pending');
    assert.equal(saved.payload.url, 'https://example.org/events?year=2026');
    assert.equal((await fetch(origin + created.url)).status, 404);
    var own = await (await fetch(origin + created.url, { headers: { 'test-user': 'external-' + kind } })).text();
    assert.match(own, /awaiting review/);
    assert.match(own, /target="_blank" rel="noopener noreferrer"/);
    if (kind === 'contest') {
      assert.match(own, /Ages 6–12/);
      assert.match(own, /Registration closed/);
    } else assert.equal(saved.payload.deadline, undefined);
    var pendingList = await (await fetch(origin + '/community?kind=' + kind)).text();
    assert.doesNotMatch(pendingList, new RegExp(kind + ' recommendation'));
    await repository.setStatus(created.id, 'live');
    // Publishing invalidates the list cache, just as admin approval does.
    await publish('cache-' + kind, wordList());
    var list = await (await fetch(origin + '/community?kind=' + kind)).text();
    assert.match(list, new RegExp(kind + ' recommendation'));
    assert.doesNotMatch(list, /轻松学中文 3A 第一课/);
    assert.equal((await fetch(origin + created.url)).status, 200);
  }
});

test('external links reject unsafe URLs and invalid competition deadlines', async function () {
  for (var url of ['', 'javascript:alert(1)', 'data:text/html,test', '/relative', 'https://user:pass@example.org', 'not a url']) {
    var response = await publish('invalid-external', { kind: 'website', title: 'Test', authorName: 'T', url: url });
    assert.equal(response.status, 400, url);
  }
  for (var deadline of ['2026-02-30', 'yesterday', '2026-13-01']) {
    var response = await publish('invalid-date', { kind: 'contest', title: 'Test', authorName: 'T', url: 'https://example.org', deadline: deadline });
    assert.equal(response.status, 400, deadline);
  }
  assert.equal(posts.size, 0);
});

test('teacher grants wait for review, show funder, amount, eligibility and deadline, and closed grants sort last', async function () {
  var response = await publish('grant-teacher', { kind: 'grant', title: 'Classroom library grant', authorName: 'Teacher', url: 'https://grants.example.org/apply',
    funder: 'Example Foundation', amount: 'Up to $2,000', eligibility: 'K-12 public school teachers in the US', deadline: '2099-03-01' });
  assert.equal(response.status, 201);
  var open = await response.json();
  var saved = posts.get(open.id);
  assert.equal(saved.status, 'pending');
  assert.deepEqual(saved.payload, { url: 'https://grants.example.org/apply', funder: 'Example Foundation', amount: 'Up to $2,000', eligibility: 'K-12 public school teachers in the US', deadline: '2099-03-01' });
  assert.doesNotMatch(await (await fetch(origin + '/community?kind=grant')).text(), /Classroom library grant/);
  // A rolling grant (no deadline) and one already closed.
  var rolling = await (await publish('grant-teacher', { kind: 'grant', title: 'Rolling supplies grant', authorName: 'Teacher', url: 'https://grants.example.org/rolling' })).json();
  var closed = await (await publish('grant-teacher', { kind: 'grant', title: 'Expired travel grant', authorName: 'Teacher', url: 'https://grants.example.org/old', deadline: '2020-01-01' })).json();
  for (var id of [closed.id, open.id, rolling.id]) await repository.setStatus(id, 'live');
  await publish('cache-grant', wordList());
  var list = await (await fetch(origin + '/community?kind=grant')).text();
  assert.match(list, /Up to \$2,000/);
  assert.match(list, /Example Foundation/);
  assert.match(list, /Rolling \/ open year-round/);
  assert.match(list, /Applications closed/);
  assert.ok(list.indexOf('Expired travel grant') > list.indexOf('Classroom library grant'), 'closed grant is listed after open ones');
  assert.ok(list.indexOf('Expired travel grant') > list.indexOf('Rolling supplies grant'));
  assert.doesNotMatch(list, /轻松学中文 3A 第一课/);
  assert.match(await (await fetch(origin + '/community?q=example%20foundation')).text(), /Classroom library grant/);
  var detail = await (await fetch(origin + open.url)).text();
  assert.match(detail, /K-12 public school teachers in the US/);
  assert.match(detail, /See grant details and apply/);
  assert.match(detail, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(detail, /Applications closed/);
  for (var bad of [{ deadline: '2026-02-30' }, { url: 'javascript:alert(1)' }, { amount: 'x'.repeat(81) }]) {
    response = await publish('grant-invalid', Object.assign({ kind: 'grant', title: 'Bad', authorName: 'T', url: 'https://example.org' }, bad));
    assert.equal(response.status, 400, JSON.stringify(bad));
  }
});
