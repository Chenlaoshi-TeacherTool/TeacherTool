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

function canonicalSolution() {
  return Array.from({ length: 81 }, function (_, index) {
    var row = Math.floor(index / 9);
    var column = index % 9;
    return (row * 3 + Math.floor(row / 3) + column) % 9 + 1;
  });
}

function validGameData() {
  var solution = canonicalSolution();
  return {
    title: 'Class Fruit Sudoku',
    items: ['apple', 'banana', 'grape', 'melon', 'berry', 'cherry', 'peach', 'orange', 'pear']
      .map(function (word, index) { return { word: word, icon: String(index + 1) }; }),
    level: 'medium',
    seed: 42,
    puzzle: solution.map(function (value, index) { return index < 36 ? value : 0; }),
    solution: solution
  };
}

test.before(async function () {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-tool-game-share-'));
  delete process.env.AZURE_STORAGE_CONNECTION_STRING;
  process.env.GAME_SHARE_LOCAL_ROOT = tempRoot;
  process.env.COOKIE_SECRET = 'game-share-test-secret';
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

test('publishes, password-protects, opens, and deletes a shared game', async function () {
  var publishResponse = await fetch(baseUrl + '/api/game-shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameType: 'word-sudoku',
      version: 1,
      title: 'Class Fruit Sudoku',
      password: 'fruit9',
      data: validGameData()
    })
  });
  assert.equal(publishResponse.status, 201);
  var published = await publishResponse.json();
  assert.match(published.shareId, /^[0-9a-f-]{36}$/i);
  assert.equal(published.url, '/play/' + published.shareId);

  var gateResponse = await fetch(baseUrl + published.url);
  assert.equal(gateResponse.status, 200);
  assert.match(await gateResponse.text(), /Game password/);

  var wrongPassword = await fetch(baseUrl + published.url + '/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: 'wrong' }),
    redirect: 'manual'
  });
  assert.equal(wrongPassword.status, 401);

  var unlockResponse = await fetch(baseUrl + published.url + '/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: 'fruit9' }),
    redirect: 'manual'
  });
  assert.equal(unlockResponse.status, 302);
  var cookie = unlockResponse.headers.get('set-cookie').split(';')[0];

  var playerResponse = await fetch(baseUrl + published.url, { headers: { Cookie: cookie } });
  assert.equal(playerResponse.status, 200);
  var playerHtml = await playerResponse.text();
  assert.match(playerHtml, /Choose a square, then choose a word/);
  assert.match(playerHtml, /Class Fruit Sudoku/);

  var deleteResponse = await fetch(baseUrl + '/api/game-shares/' + published.shareId, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deleteToken: published.deleteToken })
  });
  assert.equal(deleteResponse.status, 200);

  var missingResponse = await fetch(baseUrl + published.url);
  assert.equal(missingResponse.status, 404);
});

test('rejects unsupported game types and malformed Sudoku data', async function () {
  var unsupported = await fetch(baseUrl + '/api/game-shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameType: 'unknown-game', version: 1, password: 'abcd', data: {} })
  });
  assert.equal(unsupported.status, 400);

  var invalidData = validGameData();
  invalidData.solution[0] = invalidData.solution[1];
  var invalid = await fetch(baseUrl + '/api/game-shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameType: 'word-sudoku', version: 1, password: 'abcd', data: invalidData })
  });
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /solution is invalid/i);
});
