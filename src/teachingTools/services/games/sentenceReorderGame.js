'use strict';

var TYPE = 'sentence-reorder';
var VERSION = 1;
var MAX_SENTENCES = 50;
var MAX_WORDS_PER_SENTENCE = 40;
var MAX_WORD_LENGTH = 80;

function fail(message) {
  var error = new Error(message);
  error.status = 400;
  throw error;
}

function cleanText(value, label, maxLength, required) {
  var text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) fail(label + ' is required.');
  if (text.length > maxLength) fail(label + ' is too long.');
  return text;
}

function cleanSentence(value, sentenceIndex) {
  var words = Array.isArray(value && value.words)
    ? value.words
    : (typeof value === 'string' ? value.split(/\s+/) : []);
  words = words
    .map(function (word, wordIndex) {
      return cleanText(word, 'Sentence ' + (sentenceIndex + 1) + ', word ' + (wordIndex + 1), MAX_WORD_LENGTH, true);
    })
    .filter(Boolean);
  if (words.length < 2) fail('Each sentence needs at least two words.');
  if (words.length > MAX_WORDS_PER_SENTENCE) fail('Each sentence can have at most ' + MAX_WORDS_PER_SENTENCE + ' words.');
  return { words: words };
}

function sanitize(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('Game data is required.');
  }
  if (!Array.isArray(payload.sentences) || payload.sentences.length < 1) {
    fail('Sentence Reorder requires at least one sentence.');
  }
  if (payload.sentences.length > MAX_SENTENCES) {
    fail('Sentence Reorder can share at most ' + MAX_SENTENCES + ' sentences.');
  }

  return {
    title: cleanText(payload.title, 'Game title', 120, false) || 'Sentence Reorder',
    relaxed: Boolean(payload.relaxed),
    sentences: payload.sentences.map(cleanSentence)
  };
}

module.exports = {
  type: TYPE,
  version: VERSION,
  view: 'game-share/sentence-reorder-player',
  sanitize: sanitize
};
