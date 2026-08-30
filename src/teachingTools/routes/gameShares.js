'use strict';

var crypto = require('crypto');
var express = require('express');
var bcrypt = require('bcryptjs');
var registry = require('../services/gameShareRegistry');
var storage = require('../services/gameShareStorage');

var router = express.Router();
var SHARE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
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
      expiresAt: new Date(now.getTime() + SHARE_TTL_MS).toISOString(),
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

module.exports = router;
