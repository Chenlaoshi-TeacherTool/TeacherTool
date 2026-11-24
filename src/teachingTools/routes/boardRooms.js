'use strict';

// Online rooms for 棋盘游戏 · Board Game Maker. See services/boardRooms.js.
//   POST /api/board-rooms                  teacher opens a room (members only)
//   GET  /api/board-rooms/:code            what a student sees before joining
//   POST /api/board-rooms/:code/join       student joins with a name and team
//   GET  /api/board-rooms/:code/events     live updates (server-sent events)
//   POST /api/board-rooms/:code/action     roll, answer, claim; teacher: start, judge, skip…
//   GET  /board, /board/:code              the student page

var express = require('express');
var crypto = require('crypto');
var rooms = require('../services/boardRooms');
var membershipLimits = require('../services/membershipLimits');

function create(options) {
  options = options || {};
  var registry = options.registry || rooms;
  var limits = options.limits || membershipLimits;
  var owner = options.owner || function (req) {
    var teacherLibrary = require('./teacherLibrary');
    var user = teacherLibrary.trustedUser(req);
    if (user) return teacherLibrary.ownerKey(user);
    return 'ip:' + crypto.createHash('sha256').update(String(req.ip || '')).digest('hex').slice(0, 16);
  };
  var router = express.Router();
  var json = express.json({ limit: '64kb' });

  // Writes come from our own pages only.
  function fromPage(req) {
    if (req.get('x-board-request') !== 'yes') return false;
    var site = req.get('sec-fetch-site');
    return !site || site === 'same-origin';
  }

  function fail(res, error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong.' });
    if (!error.status) console.error(error);
  }

  router.post('/api/board-rooms', json, async function (req, res) {
    try {
      if (!fromPage(req)) return res.status(403).json({ error: 'Not allowed.' });
      if (!(await limits.canHostOnlineRooms(req))) return res.status(403).json({ error: 'Online rooms are part of the teacher membership.', membersOnly: true });
      var room = registry.create(req.body || {}, owner(req));
      res.status(201).json({ code: room.code, hostToken: room.hostToken });
    } catch (error) { fail(res, error); }
  });

  router.get('/api/board-rooms/:code', function (req, res) {
    try {
      var room = registry.get(req.params.code);
      res.set('Cache-Control', 'no-store').json({
        code: room.code, status: room.status, board: room.data.board, title: room.data.title,
        teams: room.teams.map(function (t, i) { return { name: t.name, color: t.color, players: room.players.filter(function (p) { return p.team === i; }).length }; })
      });
    } catch (error) { fail(res, error); }
  });

  router.post('/api/board-rooms/:code/join', json, function (req, res) {
    try {
      if (!fromPage(req)) return res.status(403).json({ error: 'Not allowed.' });
      var result = registry.join(req.params.code, req.body && req.body.name, req.body && req.body.team);
      res.status(201).json({ token: result.player.token, id: result.player.id, team: result.player.team });
    } catch (error) { fail(res, error); }
  });

  router.post('/api/board-rooms/:code/action', json, function (req, res) {
    try {
      if (!fromPage(req)) return res.status(403).json({ error: 'Not allowed.' });
      var body = req.body || {};
      registry.act(req.params.code, body.token, body);
      res.json({ ok: true });
    } catch (error) { fail(res, error); }
  });

  router.get('/api/board-rooms/:code/events', function (req, res) {
    var stop;
    try {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 3000\n\n');
      stop = registry.listen(req.params.code, req.query.token, res);
    } catch (error) {
      res.write('event: gone\ndata: ' + JSON.stringify({ error: error.message, status: error.status || 500 }) + '\n\n');
      return res.end();
    }
    // Comments keep proxies (Azure closes idle connections after ~4 minutes) from closing the stream.
    var beat = setInterval(function () { res.write(': beat\n\n'); }, 20000);
    req.on('close', function () { clearInterval(beat); stop(); });
  });

  router.get(['/board', '/board/:code'], function (req, res) {
    res.render('low-prep-activities/board-room', { title: '棋盘游戏 · 加入 Join a board game', code: /^\d{6}$/.test(req.params.code || '') ? req.params.code : '' });
  });

  return router;
}

module.exports = create();
module.exports.create = create;
