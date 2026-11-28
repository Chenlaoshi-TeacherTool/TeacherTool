'use strict';

// Small in-memory limits for upload routes. The site runs on one instance,
// so counting in this process is enough (see services/boardRooms.js for the
// same assumption). Both run BEFORE multer, so a refused upload is never
// buffered into memory.

// At most `max` requests per client IP in each `windowMs`. Schools share one
// IP, so keep `max` generous: this stops runaway scripts, not busy classes.
function perClient(options) {
  var windowMs = options.windowMs;
  var max = options.max;
  var now = options.now || Date.now;
  var hits = new Map();
  var lastSweep = now();

  function sweep(time) {
    if (time - lastSweep < windowMs) return;
    lastSweep = time;
    hits.forEach(function (entry, key) { if (entry.resetAt <= time) hits.delete(key); });
  }

  return function (req, res, next) {
    var time = now();
    sweep(time);
    var key = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    var entry = hits.get(key);
    if (!entry || entry.resetAt <= time) { entry = { count: 0, resetAt: time + windowMs }; hits.set(key, entry); }
    entry.count++;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - time) / 1000)));
      return res.status(429).json({ error: options.message });
    }
    next();
  };
}

// At most `max` of these requests in progress at once, across all clients.
// Caps how many uploads sit in memory together.
function concurrency(options) {
  var max = options.max;
  var active = 0;
  var middleware = function (req, res, next) {
    if (active >= max) {
      res.set('Retry-After', String(options.retryAfterSeconds || 2));
      return res.status(503).json({ error: options.message, busy: true });
    }
    active++;
    var released = false;
    function release() { if (!released) { released = true; active--; } }
    res.once('finish', release);
    res.once('close', release);
    next();
  };
  middleware.active = function () { return active; };
  return middleware;
}

module.exports = { perClient: perClient, concurrency: concurrency };
