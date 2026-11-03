'use strict';

var TYPE = 'measure-words';
var VERSION = 1;
var HAN = /^[㐀-鿿]+$/;
var KINDS = ['thing', 'big', 'course', 'person', 'animal', 'food', 'clothes', 'nature', 'body'];

function fail(message) {
  var error = new Error(message);
  error.status = 400;
  throw error;
}

function cleanText(value, maxLength) {
  var text = typeof value === 'string' ? value.trim() : '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function cleanMw(value) {
  var mw = cleanText(value, 2);
  return HAN.test(mw) ? mw : '';
}

function cleanNumber(value, allowed, fallback) {
  var number = Number(value);
  return allowed.indexOf(number) === -1 ? fallback : number;
}

function sanitize(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('Game data is required.');

  var mws = (Array.isArray(payload.mws) ? payload.mws : []).map(cleanMw).filter(Boolean)
    .filter(function (mw, index, list) { return list.indexOf(mw) === index; }).slice(0, 30);
  if (mws.length < 2) fail('Choose at least 2 measure words.');

  var items = (Array.isArray(payload.items) ? payload.items : []).slice(0, 300).map(function (item) {
    if (!item || typeof item !== 'object') return null;
    var noun = cleanText(item.noun, 8);
    var mw = cleanMw(item.mw);
    if (!noun || !HAN.test(noun) || mws.indexOf(mw) === -1) return null;
    return {
      noun: noun,
      mw: mw,
      alt: (Array.isArray(item.alt) ? item.alt : []).map(cleanMw).filter(Boolean).slice(0, 3),
      emoji: cleanText(item.emoji, 16),
      kind: KINDS.indexOf(item.kind) === -1 ? 'thing' : item.kind,
      challenge: !!item.challenge
    };
  }).filter(Boolean);

  var sentences = (Array.isArray(payload.sentences) ? payload.sentences : []).slice(0, 100).map(function (sentence) {
    if (!sentence || typeof sentence !== 'object') return null;
    var answer = cleanMw(sentence.answer);
    if (!answer || mws.indexOf(answer) === -1) return null;
    return { before: cleanText(sentence.before, 60), answer: answer, after: cleanText(sentence.after, 60) };
  }).filter(Boolean);

  if (!items.length && !sentences.length) fail('Add some words or sentences first.');

  var options = payload.options && typeof payload.options === 'object' ? payload.options : {};
  return {
    title: cleanText(payload.title, 120) || '量词大挑战',
    mws: mws,
    items: items,
    sentences: sentences,
    options: {
      pinyin: options.pinyin !== false,
      speak: options.speak !== false,
      challenge: !!options.challenge,
      randomNumbers: options.randomNumbers !== false,
      duration: cleanNumber(options.duration, [30, 60, 90, 120], 60),
      rounds: cleanNumber(options.rounds, [5, 10, 15, 20], 10)
    }
  };
}

module.exports = {
  type: TYPE,
  version: VERSION,
  view: 'game-share/measure-words-player',
  sanitize: sanitize
};
