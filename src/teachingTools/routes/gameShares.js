'use strict';

var crypto = require('crypto');
var express = require('express');
var bcrypt = require('bcryptjs');
var registry = require('../services/gameShareRegistry');
var storage = require('../services/gameShareStorage');
var membershipLimits = require('../services/membershipLimits');
var ExcelJS = require('exceljs');

var router = express.Router();
var AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
var MAX_GAME_DATA_BYTES = 64 * 1024;
var ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
var MAX_ATTEMPTS = 10;
var attempts = new Map();

function isExpired(manifest) {
  return !manifest.expiresAt || new Date(manifest.expiresAt).getTime() < Date.now();
}

function cookieName(shareId) {
  return 'game_auth_' + shareId;
}

function cleanTitle(value) {
  var title = typeof value === 'string' ? value.trim() : '';
  if (title.length > 120) {
    var error = new Error('Title must be 120 characters or fewer.');
    error.status = 400;
    throw error;
  }
  return title || 'Shared Classroom Game';
}

function safeEqual(left, right) {
  var leftBuffer = Buffer.from(String(left || ''));
  var rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function attemptKey(req, shareId) {
  return String(req.ip || req.socket.remoteAddress || 'unknown') + ':' + shareId;
}

function getAttemptState(key) {
  var state = attempts.get(key);
  if (!state || state.resetAt <= Date.now()) {
    state = { count: 0, resetAt: Date.now() + ATTEMPT_WINDOW_MS };
    attempts.set(key, state);
  }
  return state;
}

function renderGate(res, manifest, error, status) {
  return res.status(status || 200).render('game-share/password-gate', {
    title: manifest.title,
    shareId: manifest.shareId,
    error: error || null
  });
}

async function loadManifest(req, res, next) {
  try {
    if (!storage.validShareId(req.params.id)) return next('route');
    var manifest = await storage.getManifest(req.params.id);
    if (!manifest) return next('route');
    if (isExpired(manifest)) {
      await storage.deleteShare(req.params.id);
      return res.status(410).render('game-share/expired', { title: 'Game Link Expired' });
    }
    req.gameShareManifest = manifest;
    next();
  } catch (error) {
    next(error);
  }
}

router.post('/api/game-shares', async function (req, res) {
  try {
    var body = req.body || {};
    var password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 4 || password.length > 64) {
      return res.status(400).json({ error: 'Password must be between 4 and 64 characters.' });
    }

    var adapter = registry.get(body.gameType, body.version);
    if (!adapter) return res.status(400).json({ error: 'This game type or version is not supported.' });
    if (Buffer.byteLength(JSON.stringify(body.data || null), 'utf8') > MAX_GAME_DATA_BYTES) {
      return res.status(413).json({ error: 'Game data is too large to share.' });
    }

    var payload = adapter.sanitize(body.data);
    var now = new Date();
    var shareId = crypto.randomUUID();
    var manifest = {
      shareId: shareId,
      gameType: adapter.type,
      version: adapter.version,
      title: cleanTitle(body.title || payload.title),
      passwordHash: await bcrypt.hash(password, 10),
      deleteToken: crypto.randomUUID(),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + await membershipLimits.shareLifetimeMs(req)).toISOString(),
      payload: payload
    };

    await storage.saveManifest(shareId, manifest);
    res.status(201).json({
      shareId: shareId,
      url: '/play/' + shareId,
      deleteToken: manifest.deleteToken,
      expiresAt: manifest.expiresAt
    });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    console.error('game-share publish error:', error);
    res.status(500).json({ error: 'Could not create the game link.' });
  }
});

router.delete('/api/game-shares/:id', async function (req, res, next) {
  try {
    if (!storage.validShareId(req.params.id)) return next();
    var manifest = await storage.getManifest(req.params.id);
    if (!manifest) return res.status(404).json({ error: 'Game link not found.' });
    if (!safeEqual(req.body && req.body.deleteToken, manifest.deleteToken)) {
      return res.status(403).json({ error: 'Not authorized to delete this game link.' });
    }
    await storage.deleteShare(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

function requireAssessment(req, res, next) {
  var manifest = req.gameShareManifest;
  if (!req.signedCookies || req.signedCookies[cookieName(manifest.shareId)] !== '1') {
    return res.status(401).json({ error: 'Enter the game password first.' });
  }
  if (manifest.gameType !== 'sentence-reorder' || manifest.payload.mode !== 'assessment') {
    return res.status(400).json({ error: 'This link is not a quiz.' });
  }
  var name = typeof req.body.studentName === 'string' ? req.body.studentName.normalize('NFKC').trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > 80) return res.status(400).json({ error: 'Enter your name (up to 80 characters).' });
  req.studentName = name;
  res.set('Cache-Control', 'no-store');
  next();
}

router.post('/play/:id/attempt', loadManifest, requireAssessment, async function (req, res, next) {
  try {
    var submission = await storage.getSubmission(req.params.id, req.studentName);
    res.json({ studentName: req.studentName, submission: submission });
  } catch (error) { next(error); }
});

router.post('/play/:id/submit', loadManifest, requireAssessment, async function (req, res, next) {
  try {
    var existing = await storage.getSubmission(req.params.id, req.studentName);
    if (existing) return res.status(409).json({ error: 'This name has already submitted this quiz.', submission: existing });
    var data = req.gameShareManifest.payload;
    var answers = req.body.answers;
    if (!Array.isArray(answers) || answers.length !== data.sentences.length || answers.some(function (answer, index) {
      return !Array.isArray(answer) || answer.some(function (word) { return typeof word !== 'string'; }) ||
        JSON.stringify(answer.slice().sort()) !== JSON.stringify(data.sentences[index].words.slice().sort());
    })) return res.status(400).json({ error: 'Complete every sentence before submitting.' });
    function normalize(word) { return data.relaxed ? word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') : word; }
    var correct = answers.map(function (answer, index) {
      return answer.every(function (word, wordIndex) { return normalize(word) === normalize(data.sentences[index].words[wordIndex]); });
    });
    var submission = { studentName: req.studentName, answers: answers, correct: correct, score: correct.filter(Boolean).length, submittedAt: new Date().toISOString() };
    if (!(await storage.saveSubmission(req.params.id, req.studentName, submission))) {
      return res.status(409).json({ error: 'This name has already submitted this quiz.', submission: await storage.getSubmission(req.params.id, req.studentName) });
    }
    res.status(201).json({ submission: submission });
  } catch (error) { next(error); }
});

router.get('/play/:id', loadManifest, function (req, res, next) {
  var manifest = req.gameShareManifest;
  var authorized = req.signedCookies && req.signedCookies[cookieName(manifest.shareId)] === '1';
  if (!authorized) return renderGate(res, manifest);

  var adapter = registry.get(manifest.gameType, manifest.version);
  if (!adapter) return next();
  var safeJson = JSON.stringify({
    shareId: manifest.shareId,
    gameType: manifest.gameType,
    version: manifest.version,
    title: manifest.title,
    data: manifest.payload
  }).replace(/</g, '\\u003c');
  res.render(adapter.view, { title: manifest.title, gameDataJson: safeJson });
});

router.post('/play/:id/unlock', loadManifest, async function (req, res, next) {
  try {
    var manifest = req.gameShareManifest;
    var key = attemptKey(req, manifest.shareId);
    var state = getAttemptState(key);
    if (state.count >= MAX_ATTEMPTS) {
      res.set('Retry-After', String(Math.ceil((state.resetAt - Date.now()) / 1000)));
      return renderGate(res, manifest, 'Too many attempts. Please wait 15 minutes and try again.', 429);
    }

    var password = req.body && req.body.password;
    var matches = password && await bcrypt.compare(String(password), manifest.passwordHash);
    if (!matches) {
      state.count += 1;
      return renderGate(res, manifest, 'Incorrect password. Please try again.', 401);
    }

    attempts.delete(key);
    res.cookie(cookieName(manifest.shareId), '1', {
      signed: true,
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
      httpOnly: true,
      sameSite: 'Lax',
      secure: req.secure || process.env.NODE_ENV === 'production'
    });
    res.redirect('/play/' + manifest.shareId);
  } catch (error) {
    next(error);
  }
});

// ===== Teacher views (My activities). Proof of ownership is the delete token the
// creating browser keeps; it travels in the request body, never in a URL. =====

function isQuiz(manifest) {
  return manifest.gameType === 'sentence-reorder' && manifest.payload && manifest.payload.mode === 'assessment';
}

async function ownedManifest(shareId, deleteToken) {
  if (!storage.validShareId(shareId)) return null;
  var manifest = await storage.getManifest(shareId);
  if (!manifest || isExpired(manifest) || !safeEqual(deleteToken, manifest.deleteToken)) return null;
  return manifest;
}

router.post('/api/game-shares/summary', async function (req, res, next) {
  try {
    var shares = Array.isArray(req.body && req.body.shares) ? req.body.shares.slice(0, 100) : [];
    var results = await Promise.all(shares.map(async function (share) {
      var shareId = String(share && share.shareId || '');
      var manifest = await ownedManifest(shareId, share && share.deleteToken);
      if (!manifest) return { shareId: shareId, exists: false };
      var summary = { shareId: shareId, exists: true, title: manifest.title, gameType: manifest.gameType, expiresAt: manifest.expiresAt, quiz: isQuiz(manifest) };
      if (summary.quiz) summary.submissions = (await storage.listSubmissions(shareId)).length;
      return summary;
    }));
    res.set('Cache-Control', 'private, no-store').json({ shares: results });
  } catch (error) { next(error); }
});

async function loadResults(req, res) {
  var manifest = await ownedManifest(req.params.id, req.body && req.body.deleteToken);
  if (!manifest || !isQuiz(manifest)) { res.status(404).json({ error: 'Quiz results were not found for this link.' }); return null; }
  if (!(await membershipLimits.canViewQuizResults(req))) { res.status(403).json({ error: 'Class results are part of the teacher membership.' }); return null; }
  res.set('Cache-Control', 'private, no-store');
  return {
    title: manifest.title,
    expiresAt: manifest.expiresAt,
    sentences: manifest.payload.sentences.map(function (sentence) { return sentence.words; }),
    submissions: await storage.listSubmissions(req.params.id)
  };
}

router.post('/api/game-shares/:id/results', async function (req, res, next) {
  try {
    var results = await loadResults(req, res);
    if (results) res.json(results);
  } catch (error) { next(error); }
});

router.post('/api/game-shares/:id/results.xlsx', async function (req, res, next) {
  try {
    var results = await loadResults(req, res);
    if (!results) return;
    var workbook = new ExcelJS.Workbook();
    var count = results.sentences.length;
    var sheet = workbook.addWorksheet('Results 结果');
    sheet.addRow(['Student 学生', 'Score 得分', 'Percent 百分比', 'Submitted 提交时间'].concat(results.sentences.map(function (_words, index) { return 'S' + (index + 1); })));
    results.submissions.forEach(function (submission) {
      sheet.addRow([submission.studentName, submission.score + ' / ' + count, count ? Math.round(submission.score / count * 100) / 100 : 0, submission.submittedAt ? new Date(submission.submittedAt) : '']
        .concat(results.sentences.map(function (_words, index) { return submission.correct[index] ? '✓' : '✗'; })));
    });
    var submitted = results.submissions.length;
    sheet.addRow(['Class correct rate 全班正确率', '', '', ''].concat(results.sentences.map(function (_words, index) {
      return submitted ? Math.round(results.submissions.filter(function (submission) { return submission.correct[index]; }).length / submitted * 100) / 100 : 0;
    })));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(sheet.rowCount).font = { bold: true };
    sheet.getColumn(1).width = 24; sheet.getColumn(2).width = 10; sheet.getColumn(3).width = 12; sheet.getColumn(4).width = 20;
    sheet.getColumn(3).numFmt = '0%'; sheet.getColumn(4).numFmt = 'yyyy-mm-dd hh:mm';
    for (var column = 5; column < 5 + count; column += 1) { sheet.getColumn(column).width = 7; sheet.getColumn(column).alignment = { horizontal: 'center' }; sheet.getCell(sheet.rowCount, column).numFmt = '0%'; }
    sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
    var answers = workbook.addWorksheet('Answers 答案');
    answers.addRow(['Student 学生', 'Sentence 句子', 'Result 结果', 'Student answer 学生答案', 'Correct answer 正确答案']);
    results.submissions.forEach(function (submission) {
      results.sentences.forEach(function (words, index) {
        answers.addRow([submission.studentName, index + 1, submission.correct[index] ? '✓' : '✗', (submission.answers[index] || []).join(' '), words.join(' ')]);
      });
    });
    answers.getRow(1).font = { bold: true };
    answers.columns.forEach(function (column, index) { column.width = [24, 10, 10, 40, 40][index]; });
    var buffer = await workbook.xlsx.writeBuffer();
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', "attachment; filename=quiz-results.xlsx; filename*=UTF-8''" + encodeURIComponent((results.title || 'quiz').slice(0, 60) + ' - results.xlsx'));
    res.send(Buffer.from(buffer));
  } catch (error) { next(error); }
});

module.exports = router;
