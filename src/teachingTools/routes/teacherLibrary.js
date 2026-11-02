'use strict';

var express = require('express');
var crypto = require('node:crypto');
var auth = require('../services/authUser');
var repository = require('../services/teacherLibraryRepository');
var core = require('../public/shared/library-v2');
var PAGE = '/teaching-tools/word-list-library/word-list-library.html';

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
  var router = express.Router();
  router.use(function (req, res, next) { res.set('Cache-Control', 'private, no-store'); res.set('X-Content-Type-Options', 'nosniff'); next(); });
  router.get('/session', async function (req, res) {
    var available = accountsEnabled();
    var user = available ? getUser(req) : null;
    var saved = null;
    var cloudAvailable = enabled();
    try {
      saved = user && cloudAvailable ? await store.load(ownerKey(user)) : null;
    } catch (error) { cloudAvailable = false; }
      res.json({ available: available, cloudAvailable: cloudAvailable, signedIn: Boolean(user), user: user ? { name: user.name, provider: user.provider } : null,
        accountId: user ? ownerKey(user) : null, canWrite: Boolean(saved && saved.canWrite),
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
      res.json({ library: library, revision: saved.revision, canWrite: saved.canWrite, accountId: req.libraryOwner });
    } catch (error) { res.status(503).json({ error: 'Your private library could not be loaded. Existing data has been kept.' }); }
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
