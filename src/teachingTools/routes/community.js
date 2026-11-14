'use strict';

// Teacher community (/community): resources and links teachers share with
// each other. Browsing and using posts needs no account; publishing needs a
// signed-in teacher account. External links wait for review; reports flag posts for
// /admin/community (routes/admin.js), where they can be hidden or deleted.

var express = require('express');
var crypto = require('crypto');
var community = require('../services/community');
var promotion = require('../services/teacherResourcePromotion');

var POSTS_PER_DAY = 20;
var REPORTS_PER_HOUR = 10;
var DAY_MS = 24 * 60 * 60 * 1000;

function create(options) {
  options = options || {};
  var repository = options.repository || require('../services/communityRepository');
  var activities = options.activities || require('../services/teacherActivitiesRepository');
  var registry = options.registry || require('../services/gameShareRegistry');
  var teacherLibrary = function () { return require('./teacherLibrary'); };
  var accountsOn = options.accountsOn || function () { return teacherLibrary().accountsAvailable(); };
  var getUser = options.getUser || function (req) { return teacherLibrary().trustedUser(req); };
  var ownerKey = options.ownerKey || function (user) { return teacherLibrary().ownerKey(user); };
  var loginProvider = options.loginProvider || function () { return teacherLibrary().accountProvider(); };
  var origin = new URL(options.origin || process.env.SITE_URL || 'https://clsteachingtools.com').origin;
  var now = options.now || Date.now;

  var router = express.Router();
  var cache = { at: 0, posts: null };
  var counters = new Map();

  function owner(req) {
    if (!accountsOn()) return null;
    var user = getUser(req);
    return user ? ownerKey(user) : null;
  }

  function sameSite(req) {
    return req.get('origin') === origin && req.get('x-community-request') === 'yes' &&
      (!req.get('sec-fetch-site') || req.get('sec-fetch-site') === 'same-origin');
  }

  // Counts per key within a time window; returns false once the limit is reached.
  function allow(key, limit, windowMs) {
    var entry = counters.get(key);
    if (!entry || entry.until <= now()) entry = { count: 0, until: now() + windowMs };
    if (entry.count >= limit) return false;
    entry.count += 1;
    counters.set(key, entry);
    if (counters.size > 20000) counters.forEach(function (value, name) { if (value.until <= now()) counters.delete(name); });
    return true;
  }

  function clientKey(req) {
    return crypto.createHash('sha256').update(String(req.ip || '')).digest('hex').slice(0, 24);
  }

  async function livePosts() {
    if (!cache.posts || now() - cache.at > 30000) cache = { at: now(), posts: await repository.listAll('live') };
    return cache.posts;
  }
  function changed() { cache = { at: 0, posts: null }; }

  function loginUrl(path) {
    if (!accountsOn()) return null;
    return '/.auth/login/' + loginProvider() + '?post_login_redirect_uri=' + encodeURIComponent(path);
  }

  function viewHelpers(res) {
    var lang = res.locals.lang;
    return {
      community: community,
      promotionBadges: function(item) { return promotion.badges(item,lang,now()); },
      stageLabel: function (key) { return community.stageLabel(key, lang); },
      textbookLabel: function (key) { return community.textbookLabel(key, lang); },
      gameLabel: function (type) { return community.gameLabel(type, lang); }
    };
  }

  router.use(require('./communityWebsites').create({
    store: options.resourceStore || require('../services/teacherResources'), owner: owner, origin: origin,
    loginUrl: loginUrl, allow: function(key) { return allow('website:' + key, POSTS_PER_DAY, DAY_MS); }
  }));

  // ===== Pages =====
  router.get('/community', async function (req, res, next) {
    var posts = [], postsUnavailable = false;
    try { posts = await livePosts(); }
    catch (error) { postsUnavailable = true; console.error('community list error:', error.message); }
    var resourceRows = [], resourcesUnavailable = false;
    try { resourceRows = await (options.resourceStore || require('../services/teacherResources')).list(); }
    catch (error) { resourcesUnavailable = true; console.error('teacher resources list error:', error.message); }
    var resources = resourceRows.filter(function(row) { return row.published && promotion.state(row.published,now()).visible; }).map(function(row) {
      var item = Object.assign({ id: row.id }, row.published);
      return { id: 'resource-' + row.id, kind: 'website', title: item.name, description: [item.summary, item.category, item.features, item.audience].filter(Boolean).join(' '), promoted: promotion.state(item,now()).pinned, authorName: item.authorName || 'CLS Teaching Tools', stages: [], textbook: '', resource: item };
    });
    var result = community.search(posts.concat(resources).sort(function(a,b) { return Number(Boolean(b.promoted)) - Number(Boolean(a.promoted)); }), req.query);
    result.unavailable = postsUnavailable;
    res.render('community/index', Object.assign({ title: 'Teacher Community', result: result, teacherResources: result.posts.filter(function(post) { return post.resource; }).map(function(post) { return post.resource; }), resourcesUnavailable: resourcesUnavailable }, viewHelpers(res)));
  });

  router.get('/community/share', function (req, res) {
    res.render('community/share', Object.assign({ title: 'Share with Teachers' }, viewHelpers(res)));
  });

  router.get('/community/:id', async function (req, res, next) {
    if (!community.validId(req.params.id)) return next();
    try {
      var post = await repository.get(req.params.id);
      var me = owner(req);
      var mine = Boolean(me && post && post.ownerKey === me);
      if (!post || (post.status !== 'live' && !mine)) return next();
      res.render('community/detail', Object.assign({
        title: post.title, post: post, mine: mine,
        wordsText: post.kind === 'wordlist' ? community.wordsAsText(post.payload) : '',
        game: post.kind === 'game' ? community.GAME_TYPES[post.gameType] || null : null
      }, viewHelpers(res)));
    } catch (error) { next(error); }
  });

  // ===== API =====
  var api = express.Router();
  api.use(function (req, res, next) { res.set('Cache-Control', 'private, no-store'); next(); });

  api.get('/me', async function (req, res) {
    var me = owner(req);
    var displayName = '';
    if (me) { try { displayName = await repository.lastAuthorName(me); } catch (error) { displayName = ''; } }
    res.json({ accountsOn: accountsOn(), signedIn: Boolean(me), displayName: displayName,
      loginUrl: loginUrl(/^\/community(\/[\w?=&%.-]*)?$/.test(String(req.query.back || '')) ? String(req.query.back) : '/community/share') });
  });

  function writeGuard(req, res) {
    if (!sameSite(req)) { res.status(403).json({ error: 'Requests must come from this website.' }); return null; }
    var me = owner(req);
    if (!me) { res.status(401).json({ error: 'Sign in to share with other teachers.' }); return null; }
    return me;
  }

  api.post('/posts', express.json({ limit: '200kb' }), async function (req, res) {
    var me = writeGuard(req, res);
    if (!me) return;
    var body = req.body || {};
    var post;
    try {
      post = community.cleanPost(body);
      if (body.kind === 'wordlist') {
        var words = community.cleanWords(body.words);
        Object.assign(post, { kind: 'wordlist', payload: words, itemCount: words.length });
      } else if (body.kind === 'game') {
        if (!/^[a-zA-Z0-9-]{1,64}$/.test(String(body.activityId || ''))) return res.status(400).json({ error: 'Choose a game from My activities.' });
        var saved = await activities.getGame(me, body.activityId);
        if (!saved) return res.status(404).json({ error: 'This game has no saved content. Make it again in the tool, then share it.' });
        var adapter = registry.get(saved.gameType, saved.version);
        if (!adapter || !community.GAME_TYPES[adapter.type]) return res.status(400).json({ error: 'This kind of game cannot be shared yet.' });
        var payload = adapter.sanitize(saved.payload);
        var count = ['sentences', 'items', 'words', 'questions', 'rounds'].map(function (key) { return Array.isArray(payload[key]) ? payload[key].length : 0; })
          .reduce(function (a, b) { return Math.max(a, b); }, 0);
        Object.assign(post, { kind: 'game', gameType: adapter.type, gameVersion: adapter.version, payload: payload, itemCount: count });
      } else if (body.kind === 'contest' || body.kind === 'website') {
        Object.assign(post, { kind: body.kind, payload: community.cleanExternal(body), itemCount: 0, status: 'pending' });
      } else {
        return res.status(400).json({ error: 'Choose a supported category to share.' });
      }
    } catch (error) {
      if (error.status === 400 || error.status === 413) return res.status(400).json({ error: error.message });
      console.error('community publish check error:', error.message);
      return res.status(503).json({ error: 'Sharing is not available right now. Please try again later.' });
    }
    if (!allow('post:' + me, POSTS_PER_DAY, DAY_MS)) return res.status(429).json({ error: 'You have shared a lot today. Please try again tomorrow.' });
    try {
      post.id = community.newId();
      post.ownerKey = me;
      var created = await repository.create(post);
      changed();
      res.status(201).json({ id: created.id, url: '/community/' + created.id });
    } catch (error) {
      console.error('community publish error:', error.message);
      res.status(503).json({ error: 'Sharing is not available right now. Please try again later.' });
    }
  });

  api.delete('/posts/:id', async function (req, res) {
    var me = writeGuard(req, res);
    if (!me) return;
    if (!community.validId(req.params.id)) return res.status(404).json({ error: 'This post was not found.' });
    try {
      if (!(await repository.remove(req.params.id, me))) return res.status(404).json({ error: 'This post was not found.' });
      changed();
      res.json({ ok: true });
    } catch (error) { res.status(503).json({ error: 'This post could not be deleted right now.' }); }
  });

  api.post('/posts/:id/report', express.json({ limit: '4kb' }), async function (req, res) {
    if (!sameSite(req)) return res.status(403).json({ error: 'Requests must come from this website.' });
    if (!community.validId(req.params.id)) return res.status(404).json({ error: 'This post was not found.' });
    var who = clientKey(req);
    if (!allow('report:' + who + ':' + req.params.id, 1, DAY_MS)) return res.json({ ok: true });
    if (!allow('reports:' + who, REPORTS_PER_HOUR, 60 * 60 * 1000)) return res.status(429).json({ error: 'Please try again later.' });
    try {
      var reason = typeof (req.body && req.body.reason) === 'string' ? req.body.reason.trim().slice(0, 300) : '';
      if (!(await repository.report(req.params.id, reason))) return res.status(404).json({ error: 'This post was not found.' });
      res.json({ ok: true });
    } catch (error) { res.status(503).json({ error: 'The report could not be sent right now.' }); }
  });

  // A teacher saved, copied or made a link from a post. Counted once per visitor per day.
  api.post('/posts/:id/used', async function (req, res) {
    if (!sameSite(req) || !community.validId(req.params.id)) return res.status(204).end();
    if (allow('use:' + clientKey(req) + ':' + req.params.id, 1, DAY_MS)) {
      try { await repository.countUse(req.params.id); changed(); } catch (error) { /* best effort */ }
    }
    res.status(204).end();
  });

  router.use('/api/community', api);
  router.invalidate = changed; // admin changes show at once instead of after the 30 s cache
  return router;
}

module.exports = create();
module.exports.create = create;
