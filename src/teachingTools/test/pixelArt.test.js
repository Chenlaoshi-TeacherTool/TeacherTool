'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs/promises');
var http = require('node:http');
var os = require('node:os');
var path = require('node:path');
var test = require('node:test');

var tempRoot;
var server;
var baseUrl;

function pixelData() {
  return {
    title: '我的爱好像素画',
    grid: 12,
    words: [{ zh: '看书', py: 'kàn shū', en: 'read books', group: '在家' }, { zh: '游泳', py: 'yóu yǒng', en: 'swim', group: '运动' }],
    prompts: ['我的爱好是____。']
  };
}

function post(pathname, body, cookie) {
  return fetch(baseUrl + pathname, {
    method: 'POST', redirect: 'manual',
    headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
    body: JSON.stringify(body)
  });
}

test.before(async function () {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-tool-pixel-art-'));
  delete process.env.AZURE_STORAGE_CONNECTION_STRING;
  process.env.GAME_SHARE_LOCAL_ROOT = tempRoot;
  process.env.COOKIE_SECRET = 'pixel-art-test-secret';
  process.env.DAB_BASE_URL = 'http://127.0.0.1:1/api';
  process.env.NODE_ENV = 'test';
  var app = require('../app');
  server = http.createServer(app);
  await new Promise(function (resolve) { server.listen(0, '127.0.0.1', resolve); });
  baseUrl = 'http://127.0.0.1:' + server.address().port;
});

test.after(async function () {
  if (server) await new Promise(function (resolve) { server.close(resolve); });
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
});

test('pixel-art link collects one drawing per student and shows them in the gallery', async function () {
  var created = await post('/api/game-shares', { gameType: 'pixel-art', version: 1, title: 'Hobbies', password: 'draw-it', data: pixelData() });
  assert.equal(created.status, 201);
  var share = await created.json();

  var unlock = await post(share.url + '/unlock', { password: 'draw-it' });
  assert.equal(unlock.status, 302);
  var cookie = unlock.headers.get('set-cookie').split(';')[0];
  var page = await fetch(baseUrl + share.url, { headers: { Cookie: cookie } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /pixel-draw\.js/);

  var blank = '0'.repeat(144);
  var drawn = '4' + blank.slice(1);
  assert.equal((await post(share.url + '/submit', { studentName: '小明', work: { word: '跳舞', pixels: drawn } }, cookie)).status, 400, 'word must be on the list');
  assert.equal((await post(share.url + '/submit', { studentName: '小明', work: { word: '看书', pixels: blank } }, cookie)).status, 400, 'empty drawing');
  assert.equal((await post(share.url + '/submit', { studentName: '小明', work: { word: '看书', pixels: 'z'.repeat(144) } }, cookie)).status, 400, 'bad pixels');
  var ok = await post(share.url + '/submit', { studentName: '小明', work: { word: '看书', pixels: drawn, sentences: ['我的爱好是看书。', 'extra'] } }, cookie);
  assert.equal(ok.status, 201);
  assert.equal((await post(share.url + '/submit', { studentName: ' 小明 ', work: { word: '游泳', pixels: drawn } }, cookie)).status, 409);

  assert.equal((await post('/api/game-shares/' + share.shareId + '/gallery', { deleteToken: 'wrong' })).status, 404);
  var gallery = await post('/api/game-shares/' + share.shareId + '/gallery', { deleteToken: share.deleteToken });
  assert.equal(gallery.status, 200);
  var body = await gallery.json();
  assert.equal(body.payload.grid, 12);
  assert.deepEqual(body.payload.show, { py: true, en: true }, 'pinyin and English shown unless the teacher turns them off');
  assert.equal(body.submissions.length, 1);
  assert.deepEqual([body.submissions[0].studentName, body.submissions[0].word, body.submissions[0].pixels], ['小明', '看书', drawn]);
  assert.deepEqual(body.submissions[0].sentences, ['我的爱好是看书。']);

  var summary = await (await post('/api/game-shares/summary', { shares: [{ shareId: share.shareId, deleteToken: share.deleteToken }] })).json();
  assert.equal(summary.shares[0].gallery, true);
  assert.equal(summary.shares[0].submissions, 1);
});

test('only members can make a pixel-art link or open its gallery once limits are on', async function () {
  var limits = require('../services/membershipLimits');
  var original = limits.canCollectStudentWork;
  limits.canCollectStudentWork = async function () { return true; };
  var share = await (await post('/api/game-shares', { gameType: 'pixel-art', version: 1, password: 'draw-it', data: pixelData() })).json();
  limits.canCollectStudentWork = async function () { return false; };
  try {
    var refused = await post('/api/game-shares', { gameType: 'pixel-art', version: 1, password: 'draw-it', data: pixelData() });
    assert.equal(refused.status, 403);
    assert.equal((await refused.json()).membersOnly, true);
    var gallery = await post('/api/game-shares/' + share.shareId + '/gallery', { deleteToken: share.deleteToken });
    assert.equal(gallery.status, 403);
  } finally {
    limits.canCollectStudentWork = original;
  }
});

test('the teacher can hide pinyin or English', async function () {
  var data = pixelData();
  data.show = { py: false, en: true };
  var share = await (await post('/api/game-shares', { gameType: 'pixel-art', version: 1, password: 'draw-it', data: data })).json();
  var gallery = await (await post('/api/game-shares/' + share.shareId + '/gallery', { deleteToken: share.deleteToken })).json();
  assert.deepEqual(gallery.payload.show, { py: false, en: true });
});

test('pixel-art word lists are checked', async function () {
  var bad = pixelData();
  bad.grid = 15;
  assert.equal((await post('/api/game-shares', { gameType: 'pixel-art', version: 1, password: 'draw-it', data: bad })).status, 400);
  bad = pixelData();
  bad.words.push({ zh: '看书' });
  assert.equal((await post('/api/game-shares', { gameType: 'pixel-art', version: 1, password: 'draw-it', data: bad })).status, 400);
});

test('tool pages render', async function () {
  var page = await fetch(baseUrl + '/teaching-tools/pixel-art');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /pixel-art\.js/);
  assert.equal((await fetch(baseUrl + '/teaching-tools/pixel-art/draw')).status, 200);
});
