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

function validSentenceReorderData() {
  return {
    title: 'Chinese Sentence Practice',
    relaxed: true,
    sentences: [
      { words: ['我', '喜欢', '苹果。'] },
      { words: ['她', '有', '一只', '小猫。'] }
    ]
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

test('publishes and opens a shared Sentence Reorder game', async function () {
  var publishResponse = await fetch(baseUrl + '/api/game-shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameType: 'sentence-reorder',
      version: 1,
      title: 'Chinese Sentence Practice',
      password: 'sentences',
      data: validSentenceReorderData()
    })
  });
  assert.equal(publishResponse.status, 201);
  var published = await publishResponse.json();

  var unlockResponse = await fetch(baseUrl + published.url + '/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: 'sentences' }),
    redirect: 'manual'
  });
  assert.equal(unlockResponse.status, 302);
  var cookie = unlockResponse.headers.get('set-cookie').split(';')[0];

  var playerResponse = await fetch(baseUrl + published.url, { headers: { Cookie: cookie } });
  assert.equal(playerResponse.status, 200);
  var playerHtml = await playerResponse.text();
  assert.match(playerHtml, /Put this sentence in order/);
  assert.match(playerHtml, /Chinese Sentence Practice/);
  assert.match(playerHtml, /sentence-reorder-player\.js/);
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

  var invalidSentence = await fetch(baseUrl + '/api/game-shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameType: 'sentence-reorder',
      version: 1,
      password: 'abcd',
      data: { sentences: [{ words: ['hello'] }] }
    })
  });
  assert.equal(invalidSentence.status, 400);
  assert.match((await invalidSentence.json()).error, /at least two words/i);
});

test('assessment links retain their mode through publishing and unlocking', async function () {
  var data = validSentenceReorderData();
  data.mode = 'assessment';
  var response = await fetch(baseUrl + '/api/game-shares', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameType: 'sentence-reorder', version: 1, password: 'quiz1234', data: data })
  });
  assert.equal(response.status, 201);
  var published = await response.json();
  var unlock = await fetch(baseUrl + published.url + '/unlock', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: 'quiz1234' }), redirect: 'manual'
  });
  assert.equal(unlock.status, 302);
  var cookie = unlock.headers.get('set-cookie').split(';')[0];
  var player = await fetch(baseUrl + published.url, { headers: { Cookie: cookie } });
  assert.equal(player.status, 200);
  var html = await player.text();
  assert.match(html, /"mode":"assessment"/);
  assert.match(html, /id="checkButton"[^>]*hidden/);
  assert.doesNotMatch(html, /id="submitButton"[^>]*hidden/);
  assert.match(html, /sentences visited/);
});

test('quiz submissions are scored once per normalised student name across sessions', async function () {
  var data = validSentenceReorderData();
  data.mode = 'assessment';
  var publishedResponse = await fetch(baseUrl + '/api/game-shares', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameType: 'sentence-reorder', version: 1, password: 'quiz-once', data: data })
  });
  var published = await publishedResponse.json();
  async function unlock() {
    var response = await fetch(baseUrl + published.url + '/unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: 'quiz-once' }), redirect: 'manual'
    });
    return response.headers.get('set-cookie').split(';')[0];
  }
  var cookie = await unlock();
  function request(action, body, auth) {
    return fetch(baseUrl + published.url + '/' + action, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: auth || '' }, body: JSON.stringify(body)
    });
  }
  assert.equal((await request('attempt', { studentName: 'Alice' })).status, 401);
  assert.equal((await request('attempt', { studentName: ' ' }, cookie)).status, 400);
  var fresh = await request('attempt', { studentName: 'Alice' }, cookie);
  assert.equal((await fresh.json()).submission, null);
  assert.equal((await request('submit', { studentName: 'Alice', answers: [] }, cookie)).status, 400);
  var answers = [data.sentences[0].words, data.sentences[1].words.slice().reverse()];
  var response = await request('submit', { studentName: 'Alice', answers: answers, score: 999 }, cookie);
  assert.equal(response.status, 201);
  var submission = (await response.json()).submission;
  assert.equal(submission.score, 1);
  assert.deepEqual(submission.correct, [true, false]);
  var anotherSession = await unlock();
  var restored = (await (await request('attempt', { studentName: '  ALICE  ' }, anotherSession)).json()).submission;
  assert.deepEqual(restored, submission);
  var repeat = await request('submit', { studentName: 'alice', answers: data.sentences.map(s => s.words) }, anotherSession);
  assert.equal(repeat.status, 409);
  assert.deepEqual((await repeat.json()).submission, submission);
  var simultaneous = await Promise.all([0, 1].map(function () {
    return request('submit', { studentName: 'Bob', answers: answers }, cookie);
  }));
  assert.deepEqual(simultaneous.map(r => r.status).sort(), [201, 409]);
  assert.equal((await (await request('attempt', { studentName: 'Carol' }, cookie)).json()).submission, null);
});
