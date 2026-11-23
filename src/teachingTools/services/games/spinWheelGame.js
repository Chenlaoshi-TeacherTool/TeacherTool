'use strict';

// Spin Wheel Craft (转盘手工) is saved as a template only (no student link).
// The page sends its draft; this keeps known fields with the right types and sizes.

var LANGS = ['en', 'th', 'vi', 'ru', 'es', 'fr'];
var MAX_KEYS = 60;

function fail(message) {
  var error = new Error(message);
  error.status = 400;
  throw error;
}

function text(value, max) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').slice(0, max) : '';
}

function oneOf(value, list, fallback) {
  return list.indexOf(value) !== -1 ? value : fallback;
}

// { word: true } for the words whose picture the teacher turned off.
function wordFlags(value) {
  var out = {};
  if (!value || typeof value !== 'object') return out;
  Object.keys(value).slice(0, MAX_KEYS).forEach(function (key) {
    if (value[key] === true && key.length <= 40) out[key] = true;
  });
  return out;
}

// { word: OpenMoji hexcode } for the pictures the teacher chose by hand.
function wordPictures(value) {
  var out = {};
  if (!value || typeof value !== 'object') return out;
  Object.keys(value).slice(0, MAX_KEYS).forEach(function (key) {
    var hex = value[key];
    if (key.length <= 40 && typeof hex === 'string' && /^[0-9A-Fa-f]{2,8}(-[0-9A-Fa-f]{2,8}){0,7}$/.test(hex)) out[key] = hex.toUpperCase();
  });
  return out;
}

function sanitize(input) {
  if (!input || typeof input !== 'object') fail('This spin wheel template is empty.');
  var options = input.options && typeof input.options === 'object' ? input.options : {};
  var sectors = Math.round(Number(input.sectors));
  var data = {
    title: text(input.title, 120),
    heading: text(input.heading, 40),
    mode: oneOf(input.mode, ['word', 'hanzi'], 'word'),
    fixed: text(input.fixed, 3),
    side: oneOf(input.side, ['left', 'right', 'top', 'bottom'], 'left'),
    sentences: text(input.sentences, 600),
    words: text(input.words, 2000),
    parts: text(input.parts, 2000),
    sectors: sectors >= 2 && sectors <= 12 ? sectors : 6,
    sectorsTouched: input.sectorsTouched === true,
    picOff: wordFlags(input.picOff),
    picPick: wordPictures(input.picPick),
    options: {
      emoji: options.emoji !== false,
      pinyin: options.pinyin !== false,
      english: options.english === true,
      lang: oneOf(options.lang, LANGS, 'en'),
      color: oneOf(options.color, ['color', 'bw'], 'color'),
      layout: oneOf(options.layout, ['same', 'separate'], 'same'),
      paper: oneOf(options.paper, ['a4', 'letter'], 'a4'),
      write: oneOf(options.write, ['zh', 'grid', 'trace'], 'zh')
    }
  };
  var filled = data.mode === 'hanzi' ? data.parts.trim() : data.words.trim();
  if (!filled) fail(data.mode === 'hanzi' ? 'Add some radicals before saving.' : 'Add some words before saving.');
  if (Buffer.byteLength(JSON.stringify(data)) > 48 * 1024) fail('This spin wheel template is too large.');
  return data;
}

module.exports = {
  type: 'spin-wheel',
  version: 1,
  templateOnly: true,
  sanitize: sanitize
};
