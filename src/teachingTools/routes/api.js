'use strict';

var express = require('express');
var dabWordLists = require('../services/dabWordListsClient');
var dabQuestionBanks = require('../services/dabQuestionBanksClient');
var authUser = require('../services/authUser');
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

module.exports = router;
