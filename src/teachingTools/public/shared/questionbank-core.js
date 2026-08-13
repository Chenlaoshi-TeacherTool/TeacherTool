/*!
 * Question bank core · Chen Laoshi Teaching Tools
 * Keeps reusable question banks in the current browser.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'chenlaoshi-questionbanks-v1';

  function getStorage() {
    try {
      var probe = '__chenlaoshi_questionbank_probe__';
      global.localStorage.setItem(probe, '1');
      global.localStorage.removeItem(probe);
      return global.localStorage;
    } catch (error) {
      return null;
    }
  }

  function readAll() {
    var storage = getStorage();
    if (!storage) return [];
    try {
      var value = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function writeAll(banks) {
    var storage = getStorage();
    if (!storage) throw new Error('Browser storage is unavailable. Download a backup instead.');
    storage.setItem(STORAGE_KEY, JSON.stringify(banks));
  }

  function cleanText(value) {
    return String(value == null ? '' : value).trim();
  }

  function cleanTags(value) {
    if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
    return cleanText(value).split(/[,，、]/).map(cleanText).filter(Boolean);
  }

  function createId(prefix) {
    return (prefix || 'qb') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function normalizeQuestion(question) {
    var source = question || {};
    return {
      id: cleanText(source.id || source.questionId) || createId('question'),
      theme: cleanText(source.theme),
      level: cleanText(source.level),
      prompt: cleanText(source.prompt || source.question),
      answer: cleanText(source.answer),
      tags: cleanTags(source.tags),
      type: cleanText(source.type) || 'Question',
      options: Array.isArray(source.options)
        ? source.options.map(cleanText).slice(0, 4)
        : [source.optionA, source.optionB, source.optionC, source.optionD].map(cleanText),
      note: cleanText(source.note)
    };
  }

  function normalizeBank(bank) {
    var source = bank || {};
    var questions = Array.isArray(source.questions) ? source.questions.map(normalizeQuestion).filter(function (question) {
      return question.prompt;
    }) : [];

    return {
      id: cleanText(source.id) || createId('bank'),
      name: cleanText(source.name) || 'Untitled question bank',
      importedAt: Number(source.importedAt) || Date.now(),
      updatedAt: Date.now(),
      source: cleanText(source.source) || 'Browser import',
      questions: questions
    };
  }

  function save(bank) {
    var normalized = normalizeBank(bank);
    var banks = readAll();
    var index = banks.findIndex(function (item) { return item.id === normalized.id; });
    if (index >= 0) {
      normalized.importedAt = banks[index].importedAt || normalized.importedAt;
      banks[index] = normalized;
    } else {
      banks.unshift(normalized);
    }
    writeAll(banks);
    return normalized;
  }

  function listAll() {
    return readAll().map(function (bank) {
      var questions = Array.isArray(bank.questions) ? bank.questions : [];
      return {
        id: bank.id,
        name: bank.name,
        questionCount: questions.length,
        themeCount: new Set(questions.map(function (question) { return question.theme; }).filter(Boolean)).size,
        updatedAt: bank.updatedAt || bank.importedAt
      };
    });
  }

  function load(id) {
    var bank = readAll().find(function (item) { return item.id === id; });
    return bank ? normalizeBank(bank) : null;
  }

  function remove(id) {
    writeAll(readAll().filter(function (bank) { return bank.id !== id; }));
  }

  global.ChenQuestionBank = {
    hasStorage: !!getStorage(),
    createId: createId,
    normalizeBank: normalizeBank,
    normalizeQuestion: normalizeQuestion,
    save: save,
    listAll: listAll,
    load: load,
    remove: remove
  };
})(window);
