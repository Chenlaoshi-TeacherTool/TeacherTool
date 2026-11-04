'use strict';

var express = require('express');
var crypto = require('node:crypto');
var auth = require('../services/authUser');
var repository = require('../services/teacherLibraryRepository');
var core = require('../public/shared/library-v2');
var activationCodes = require('../services/activationCodes');
var PAGE = '/teaching-tools/word-list-library/word-list-library.html';
var REDEEM_LIMIT = 5;
var REDEEM_WINDOW_MS = 15 * 60 * 1000;

function accountProvider() {
  var provider = process.env.TEACHER_ACCOUNT_PROVIDER || 'teachers';
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(provider) || ['aad', 'admin'].includes(provider)) throw new Error('Configure a separate teacher identity provider.');
  return provider;
}

function trustedUser(req) {
  if (!process.env.WEBSITE_INSTANCE_ID || !auth.azureAuthEnabled()) return null;
  var user = auth.currentUser(req);
  if (!user || !user.id || user.id.length > 200 || !['aad', 'google', 'microsoftaccount', accountProvider()].includes(user.provider)) return null;
  return user;
}

function ownerKey(user) {
  return crypto.createHash('sha256').update(user.provider + '\0' + user.id).digest('hex');
}

function create(options) {
  options = options || {};
  var store = options.repository || repository;
  var getUser = options.getUser || trustedUser;
  var accountsEnabled = options.accountsEnabled || options.enabled || function () { return process.env.TEACHER_ACCOUNTS_ENABLED === 'true' && Boolean(process.env.WEBSITE_INSTANCE_ID) && auth.azureAuthEnabled(); };
  var enabled = options.enabled || function () { return accountsEnabled() && process.env.LIBRARY_CLOUD_ENABLED === 'true'; };
  var origin = options.origin || process.env.SITE_URL || 'https://clsteachingtools.com';
  origin = new URL(origin).origin;
  var providers = options.providers || [accountProvider()];
  var trialDays = options.trialDays || Number(process.env.TEACHER_TRIAL_DAYS) || 3;
  var failedRedeems = new Map();
  var router = express.Router();
  function sameSite(req, purpose) {
    return req.get('origin') === origin && req.get('x-library-request') === purpose && (!req.get('sec-fetch-site') || req.get('sec-fetch-site') === 'same-origin');
  }
  function membership(saved) { return saved ? { canWrite: saved.canWrite, writeUntil: saved.writeUntil || null, trial: Boolean(saved.trial) } : null; }
  router.use(function (req, res, next) { res.set('Cache-Control', 'private, no-store'); res.set('X-Content-Type-Options', 'nosniff'); next(); });
  router.get('/session', async function (req, res) {
    var available = accountsEnabled();
    var user = available ? getUser(req) : null;
    var saved = null;
    var cloudAvailable = enabled();
    try {
      if (user && cloudAvailable) {
        await store.ensureTrial(ownerKey(user), trialDays);
        saved = await store.load(ownerKey(user));
      }
    } catch (error) { cloudAvailable = false; saved = null; }
      res.json({ available: available, cloudAvailable: cloudAvailable, signedIn: Boolean(user), user: user ? { name: user.name, provider: user.provider } : null,
        accountId: user ? ownerKey(user) : null, canWrite: Boolean(saved && saved.canWrite), membership: membership(saved),
        methods: ['email'].concat((options.googleEnabled || process.env.TEACHER_GOOGLE_ENABLED === 'true') ? ['google'] : []),
        login: available ? providers.map(function (provider) { return { provider: provider, url: '/.auth/login/' + provider + '?post_login_redirect_uri=' + encodeURIComponent(PAGE) }; }) : [],
        logout: '/.auth/logout?post_logout_redirect_uri=' + encodeURIComponent(PAGE) });
  });
  router.use(function (req, res, next) {
    if (!enabled()) return res.status(503).json({ error: 'Cloud library access is not open yet. Browser saving remains available.' });
    var user = getUser(req);
    if (!user) return res.status(401).json({ error: 'Sign in to access your private library.' });
    req.libraryOwner = ownerKey(user);
    next();
  });
  router.get('/mine', async function (req, res) {
    try {
      var saved = await store.load(req.libraryOwner);
      var library = saved.content === null ? null : (await core.preview(saved.content)).data;
      res.set('ETag', '"' + saved.revision + '"');
      res.json({ library: library, revision: saved.revision, canWrite: saved.canWrite, membership: membership(saved), accountId: req.libraryOwner });
    } catch (error) { res.status(503).json({ error: 'Your private library could not be loaded. Existing data has been kept.' }); }
  });
  router.post('/redeem', function (req, res, next) {
    if (!sameSite(req, 'redeem') || !req.is('application/json')) return res.status(403).json({ error: 'Activation requests must come from this website.' });
    var failed = failedRedeems.get(req.libraryOwner);
    if (failed && failed.until > Date.now() && failed.count >= REDEEM_LIMIT) return res.status(429).json({ error: 'Too many incorrect codes. Please wait 15 minutes and try again.' });
    next();
  }, express.json({ limit: '2kb' }), async function (req, res) {
    var codeHash = activationCodes.hash(req.body && req.body.code);
    try {
      var result = codeHash ? await store.redeem(req.libraryOwner, codeHash) : { outcome: 'invalid' };
      if (result.outcome !== 'redeemed') {
        var failed = failedRedeems.get(req.libraryOwner);
        if (!failed || failed.until <= Date.now()) failed = { count: 0, until: Date.now() + REDEEM_WINDOW_MS };
        failed.count += 1;
        if (failedRedeems.size > 5000) failedRedeems.forEach(function (entry, key) { if (entry.until <= Date.now()) failedRedeems.delete(key); });
        failedRedeems.set(req.libraryOwner, failed);
        return res.status(400).json({ error: 'This activation code is not valid or has already been used.' });
      }
      failedRedeems.delete(req.libraryOwner);
      res.json({ days: result.days, writeUntil: result.writeUntil });
    } catch (error) { res.status(503).json({ error: 'The code could not be checked right now. Please try again later.' }); }
  });
  router.put('/mine', function (req, res, next) {
    if (req.get('x-library-account') !== req.libraryOwner) return res.status(409).json({ error: 'The signed-in account changed. Reload your private library before saving.' });
    if (req.get('origin') !== origin || req.get('x-library-request') !== 'save' || !req.is('application/vnd.cls-library+json') || (req.get('sec-fetch-site') && req.get('sec-fetch-site') !== 'same-origin')) {
      return res.status(403).json({ error: 'Save requests must come from this website.' });
    }
    next();
  }, express.json({ type: 'application/vnd.cls-library+json', limit: '5mb' }), async function (req, res) {
    var match = /^"(0|[1-9]\d{0,8})"$/.exec(req.get('if-match') || '');
    if (!match) return res.status(428).json({ error: 'Load the cloud library before saving so its version can be checked.' });
    var validated;
    try {
      if (!req.body || req.body.format !== 'cls-teaching-library' || req.body.schemaVersion !== 2) throw new Error('Choose a unified library backup.');
      validated = (await core.preview(JSON.stringify(req.body))).data;
    } catch (error) { return res.status(400).json({ error: error.message }); }
    try {
      var result = await store.save(req.libraryOwner, Number(match[1]), JSON.stringify(validated));
      if (result.outcome === 'forbidden') return res.status(403).json({ error: 'Your account has read/export access only. Cloud saving requires active access.' });
      if (result.outcome === 'conflict') return res.status(409).json({ error: 'The cloud copy changed on another device. Reload and review before saving again.' });
      res.set('ETag', '"' + result.revision + '"').json({ revision: result.revision });
    } catch (error) { res.status(503).json({ error: 'Cloud saving failed. Keep your browser copy or download a backup.' }); }
  });
  // ===== My activities across devices =====
  var activities = options.activities || require('../services/teacherActivitiesRepository');
  var stores = options.stores || { game: require('../services/gameShareStorage'), book: require('../services/bookGeneratorStorage') };
  var limits = options.limits || require('../services/membershipLimits');
  async function membersOnly(req, res) {
    if (await limits.canUseMyActivities(req)) return false;
    res.status(403).json({ error: 'My activities is part of the teacher membership.', membersOnly: true });
    return true;
  }
  function activityRequest(req) { return sameSite(req, 'activities'); }
  function expired(manifest) { return !manifest.expiresAt || new Date(manifest.expiresAt).getTime() < Date.now(); }
  function tokenMatches(left, right) {
    var a = Buffer.from(String(left || '')); var b = Buffer.from(String(right || ''));
    return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  router.get('/activities', async function (req, res) {
    if (await membersOnly(req, res)) return;
    try { res.json({ activities: await activities.list(req.libraryOwner) }); }
    catch (error) { res.status(503).json({ error: 'Your activities could not be loaded right now.' }); }
  });

  // Adds activities this browser created (proved by their delete tokens) to the signed-in account.
  router.post('/activities/claim', express.json({ limit: '64kb' }), async function (req, res) {
    if (!activityRequest(req)) return res.status(403).json({ error: 'Requests must come from this website.' });
    if (await membersOnly(req, res)) return;
    var items = Array.isArray(req.body && req.body.items) ? req.body.items.slice(0, 100) : [];
    var added = 0; var skipped = 0;
    try {
      for (var item of items) {
        var kind = item && item.kind === 'book' ? 'book' : 'game';
        var id = String(item && item.id || '');
        var valid = kind === 'game' ? stores.game.validShareId(id) : /^[a-zA-Z0-9-]{1,64}$/.test(id);
        var manifest = valid ? await stores[kind].getManifest(id) : null;
        if (!manifest || expired(manifest) || !tokenMatches(item.deleteToken, manifest.deleteToken) || (manifest.ownerKey && manifest.ownerKey !== req.libraryOwner)) { skipped += 1; continue; }
        if (!manifest.ownerKey) {
          manifest.ownerKey = req.libraryOwner;
          await stores[kind].saveManifest(id, manifest);
        }
        await activities.add(req.libraryOwner, { kind: kind, id: id, gameType: kind === 'book' ? 'book' : manifest.gameType, title: manifest.title, createdAt: manifest.createdAt });
        added += 1;
      }
      res.json({ added: added, skipped: skipped });
    } catch (error) { res.status(503).json({ error: 'Your activities could not be added right now. Please try again.' }); }
  });

  // Removes an item from the account's list only; the shared link itself is untouched.
  router.delete('/activities/:kind/:id', async function (req, res) {
    if (!activityRequest(req)) return res.status(403).json({ error: 'Requests must come from this website.' });
    if (['game', 'book'].indexOf(req.params.kind) === -1 || !/^[a-zA-Z0-9-]{1,64}$/.test(req.params.id)) return res.status(400).json({ error: 'Unknown activity.' });
    try { await activities.remove(req.libraryOwner, req.params.kind, req.params.id); res.json({ ok: true }); }
    catch (error) { res.status(503).json({ error: 'This activity could not be removed right now.' }); }
  });
  router.use(function (error, req, res, next) {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'This cloud library exceeds 5 MB.' });
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'The cloud library is not valid JSON.' });
    next(error);
  });
  return router;
}

module.exports = create();
module.exports.create = create;
module.exports.ownerKey = ownerKey;
module.exports.trustedUser = trustedUser;
module.exports.accountProvider = accountProvider;
