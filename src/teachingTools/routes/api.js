'use strict';

var express = require('express');
var presetWordlists = require('../data/preset-wordlists');
var presetQuestionBanks = require('../data/preset-questionbanks');
var dabWordLists = require('../services/dabWordListsClient');
var dabQuestionBanks = require('../services/dabQuestionBanksClient');
var authUser = require('../services/authUser');
var router = express.Router();

function usingDab() {
  return Boolean(process.env.DAB_BASE_URL);
}

function publicList(list) {
  return {
    id: list.id,
    name: list.name,
    description: list.description,
    theme: list.theme,
    level: list.level,
    curriculum: list.curriculum,
    count: list.items.length,
    items: list.items.map(function (item) {
      return {
        zh: item.zh,
        py: item.py,
        en: item.en,
        theme: list.theme,
        level: list.level,
        img: '',
        note: ''
      };
    })
  };
}

function publicQuestionBank(bank) {
  var levelLabels = { '初级': 'Beginner', '中级': 'Intermediate', '高级': 'Advanced' };
  var typeLabels = { '单选题': 'Multiple Choice', '填空题': 'Fill in the Blank', '情境题': 'Scenario' };
  return {
    id: bank.id,
    name: bank.name,
    description: bank.description,
    theme: bank.theme,
    level: bank.level,
    curriculum: bank.curriculum,
    count: bank.questions.length,
    questions: bank.questions.map(function (question) {
      return Object.assign({}, question, {
        theme: bank.theme,
        level: levelLabels[question.level] || question.level,
        type: typeLabels[question.type] || question.type
      });
    })
  };
}

var azureAuthEnabled = authUser.azureAuthEnabled;
var currentUser = authUser.currentUser;

router.get('/wordlists/presets', function (req, res) {
  if (!usingDab()) {
    return res.json({ version: 1, lists: presetWordlists.map(publicList) });
  }
  dabWordLists.getAllPublicLists()
    .then(function (lists) { res.json({ version: 1, lists: lists }); })
    .catch(function (err) {
      res.status(502).json({ error: 'Could not reach the word list database.', detail: err.message });
    });
});

router.get('/wordlists/presets/:id', function (req, res) {
  if (!usingDab()) {
    var match = presetWordlists.find(function (list) { return list.id === req.params.id; });
    if (!match) return res.status(404).json({ error: 'Preset word list not found.' });
    return res.json(publicList(match));
  }
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
  if (!usingDab()) {
    return res.json({
      version: 1,
      banks: presetQuestionBanks.map(function (bank) {
        return {
          id: bank.id,
          name: bank.name,
          description: bank.description,
          theme: bank.theme,
          level: bank.level,
          curriculum: bank.curriculum,
          count: bank.questions.length
        };
      })
    });
  }
  dabQuestionBanks.getAllPublicBankSummaries()
    .then(function (banks) { res.json({ version: 1, banks: banks }); })
    .catch(function (err) {
      res.status(502).json({ error: 'Could not reach the question bank database.', detail: err.message });
    });
});

router.get('/questionbanks/presets/:id', function (req, res) {
  if (!usingDab()) {
    var match = presetQuestionBanks.find(function (bank) { return bank.id === req.params.id; });
    if (!match) return res.status(404).json({ error: 'Preset question bank not found.' });
    return res.json(publicQuestionBank(match));
  }
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
