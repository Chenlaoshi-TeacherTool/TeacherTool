'use strict';

var crypto = require('crypto');
var bcrypt = require('bcryptjs');
var registry = require('./gameShareRegistry');
var storage = require('./gameShareStorage');

var MAX_GAME_DATA_BYTES = 64 * 1024;

function fail(message, status) {
  var error = new Error(message);
  error.status = status || 400;
  throw error;
}

function cleanTitle(value) {
  var title = typeof value === 'string' ? value.trim() : '';
  if (title.length > 120) fail('Title must be 120 characters or fewer.');
  return title || 'Shared Classroom Game';
}

function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 4 || password.length > 64) fail('Password must be between 4 and 64 characters.');
}

// Validates a game and stores a new share link for it. Used for a teacher's
// first share and for a new link made from a saved activity in My activities.
// Errors carry .status (400 / 413) with a message safe to show the teacher.
async function publish(options) {
  checkPassword(options.password);
  var adapter = registry.get(options.gameType, options.version);
  if (!adapter) fail('This game type or version is not supported.');
  if (Buffer.byteLength(JSON.stringify(options.data || null), 'utf8') > MAX_GAME_DATA_BYTES) fail('Game data is too large to share.', 413);

  var payload = adapter.sanitize(options.data);
  var now = new Date();
  var manifest = {
    shareId: crypto.randomUUID(),
    gameType: adapter.type,
    version: adapter.version,
    title: cleanTitle(options.title || payload.title),
    passwordHash: await bcrypt.hash(options.password, 10),
    deleteToken: crypto.randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + options.lifetimeMs).toISOString(),
    payload: payload
  };
  if (options.owner) manifest.ownerKey = options.owner;
  await storage.saveManifest(manifest.shareId, manifest);
  return manifest;
}

module.exports = { publish: publish, checkPassword: checkPassword, MAX_GAME_DATA_BYTES: MAX_GAME_DATA_BYTES };
