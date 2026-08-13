'use strict';

var express = require('express');
var presetWordlists = require('../data/preset-wordlists');
var presetQuestionBanks = require('../data/preset-questionbanks');
var router = express.Router();

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
  return {
    id: bank.id,
    name: bank.name,
    description: bank.description,
    theme: bank.theme,
    level: bank.level,
    curriculum: bank.curriculum,
    count: bank.questions.length,
    questions: bank.questions
  };
}

function azureAuthEnabled() {
  return process.env.AZURE_AUTH_ENABLED === 'true';
}

function currentUser(req) {
  if (!azureAuthEnabled()) return null;
  var id = req.get('x-ms-client-principal-id');
  if (!id) return null;
  return {
    id: id,
    name: req.get('x-ms-client-principal-name') || 'Signed-in teacher',
    provider: req.get('x-ms-client-principal-idp') || 'azure'
  };
}

router.get('/wordlists/presets', function (req, res) {
  res.json({
    version: 1,
    lists: presetWordlists.map(publicList)
  });
});

router.get('/wordlists/presets/:id', function (req, res) {
  var match = presetWordlists.find(function (list) { return list.id === req.params.id; });
  if (!match) return res.status(404).json({ error: 'Preset word list not found.' });
  res.json(publicList(match));
});

router.get('/questionbanks/presets', function (req, res) {
  res.json({
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
});

router.get('/questionbanks/presets/:id', function (req, res) {
  var match = presetQuestionBanks.find(function (bank) { return bank.id === req.params.id; });
  if (!match) return res.status(404).json({ error: 'Preset question bank not found.' });
  res.json(publicQuestionBank(match));
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
