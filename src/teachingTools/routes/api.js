'use strict';

var express = require('express');
var dabWordLists = require('../services/dabWordListsClient');
var dabQuestionBanks = require('../services/dabQuestionBanksClient');
var authUser = require('../services/authUser');
var wordTranslator = require('../services/wordTranslator');
var router = express.Router();

var azureAuthEnabled = authUser.azureAuthEnabled;
var currentUser = authUser.currentUser;

router.get('/wordlists/presets', function (req, res) {
  dabWordLists.getAllPublicLists()
    .then(function (lists) { res.json({ version: 1, lists: lists }); })
    .catch(function (err) {
      res.status(502).json({ error: 'Could not reach the word list database.', detail: err.message });
    });
});

router.get('/wordlists/presets/:id', function (req, res) {
  dabWordLists.getPublicListBySlug(req.params.id)
    .then(function (list) {
      if (!list) return res.status(404).json({ error: 'Preset word list not found.' });
      res.json(list);
    })
    .catch(function (err) {
      res.status(502).json({ error: 'Could not reach the word list database.', detail: err.message });
    });
});

router.get('/questionbanks/presets', function (req, res) {
  dabQuestionBanks.getAllPublicBankSummaries()
    .then(function (banks) { res.json({ version: 1, banks: banks }); })
    .catch(function (err) {
      res.status(502).json({ error: 'Could not reach the question bank database.', detail: err.message });
    });
});

router.get('/questionbanks/presets/:id', function (req, res) {
  dabQuestionBanks.getPublicBankBySlug(req.params.id)
    .then(function (bank) {
      if (!bank) return res.status(404).json({ error: 'Preset question bank not found.' });
      res.json(bank);
    })
    .catch(function (err) {
      res.status(502).json({ error: 'Could not reach the question bank database.', detail: err.message });
    });
});

router.get('/auth/me', function (req, res) {
  var user = currentUser(req);
  res.json({
    signedIn: Boolean(user),
    authConfigured: azureAuthEnabled(),
    user: user
  });
});

router.get('/wordlists/mine', function (req, res) {
  var user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in is required to access cloud word lists.' });
  return res.status(501).json({
    error: 'Cloud word-list storage is not configured yet.',
    next: 'Provision the Azure storage resource described in docs/vocabulary-cloud-sync.md.'
  });
});


// Worksheet generator: translate vocabulary into up to 4 extra languages.
// Small per-IP budget so the free Translator tier can't be drained by one visitor.
var TRANSLATE_WINDOW_MS = 10 * 60 * 1000;
var TRANSLATE_MAX_REQUESTS = 30;
var translateHits = new Map();

function translateAllowed(ip) {
  var now = Date.now();
  var hits = (translateHits.get(ip) || []).filter(function (t) { return now - t < TRANSLATE_WINDOW_MS; });
  if (hits.length >= TRANSLATE_MAX_REQUESTS) {
    translateHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  translateHits.set(ip, hits);
  if (translateHits.size > 10000) translateHits.delete(translateHits.keys().next().value);
  return true;
}

router.post('/translate-words', function (req, res) {
  if (!wordTranslator.isConfigured()) {
    return res.status(503).json({ error: 'Translation is not set up on this server yet.' });
  }
  var clean = wordTranslator.cleanRequest(req.body);
  if (clean.error) return res.status(400).json({ error: clean.error });
  if (!translateAllowed(req.ip)) {
    return res.status(429).json({ error: 'Too many translation requests. Please wait a few minutes.' });
  }
  wordTranslator.translateWords(clean.words, clean.to)
    .then(function (result) { res.json(result); })
    .catch(function (err) {
      res.status(502).json({ error: 'The translation service is unavailable right now.', detail: err.message });
    });
});

module.exports = router;
