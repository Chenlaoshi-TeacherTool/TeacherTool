'use strict';

// Teacher community rules: which tags exist, what a post may contain, and
// how the listing is searched. Storage is services/communityRepository.js;
// pages and API are routes/community.js.

var crypto = require('crypto');

var STAGES = [
  { key: 'heritage', group: 'learner', zh: '母语/华裔', en: 'Heritage' },
  { key: 'non-native', group: 'learner', zh: '非母语', en: 'Non-native' },
  { key: 'primary', group: 'grade', zh: '小学', en: 'Elementary' },
  { key: 'middle', group: 'grade', zh: '初中', en: 'Middle school' },
  { key: 'high', group: 'grade', zh: '高中', en: 'High school' },
  { key: 'adult', group: 'grade', zh: '成人', en: 'Adult' }
];

var TEXTBOOKS = [
  { key: 'bubian', zh: '部编版', en: 'PEP (部编版)' },
  { key: 'nihao', zh: '你好华语', en: 'Hello Chinese' },
  { key: 'qingsong', zh: '轻松学中文', en: 'Easy Steps to Chinese' },
  { key: 'jinan', zh: '暨南中文', en: 'Jinan Chinese' },
  { key: 'kuaile', zh: '快乐汉语', en: 'Kuaile Hanyu' },
  { key: 'meihua', zh: '美洲华语', en: 'Meihua Chinese' },
  { key: 'hsk', zh: 'HSK', en: 'HSK' },
  { key: 'yct', zh: 'YCT', en: 'YCT' },
  { key: 'other', zh: '其他', en: 'Other' }
];

// Games that can be shared (services/gameShareRegistry.js) and the tool page that makes them.
var GAME_TYPES = {
  'measure-words': { zh: '量词大挑战', en: 'Measure Word Challenge', icon: '🍎', tool: '/teaching-tools/measure-words' },
  'sentence-reorder': { zh: '句子排序', en: 'Sentence Reorder', icon: '🧩', tool: '/teaching-tools/sentence-reorder' },
  'word-sudoku': { zh: '词语数独', en: 'Word Sudoku', icon: '🔢', tool: '/low-prep/word-sudoku/word-sudoku-widget.html' }
};

var KINDS = ['wordlist', 'game', 'contest', 'website', 'grant'];
// Kinds that link to another site and wait for review before they go live.
var EXTERNAL_KINDS = ['contest', 'website', 'grant'];

// Today's date in Los Angeles (YYYY-MM-DD), used for registration and application deadlines.
function today(now) {
  return new Date(now == null ? Date.now() : now).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

// A competition or grant whose deadline has passed. Rolling grants (no deadline) never close.
function isClosed(post, now) {
  return Boolean((post.kind === 'contest' || post.kind === 'grant') && post.payload && post.payload.deadline && post.payload.deadline < today(now));
}

function cleanExternal(body) {
  var value = text(body.url, 2000, 'Website URL', true);
  var url;
  try { url = new URL(value); } catch (error) { fail('Enter a valid http or https website URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('Enter a valid http or https website URL.');
  var payload = { url: url.href };
  if (body.kind === 'grant') {
    payload.funder = text(body.funder, 120, 'Funder', false);
    payload.amount = text(body.amount, 80, 'Amount', false);
    payload.eligibility = text(body.eligibility, 300, 'Who can apply', false);
  }
  if (body.kind === 'contest' || body.kind === 'grant') {
    if (body.kind === 'contest') payload.audience = text(body.audience, 120, 'Suitable ages', false);
    payload.deadline = text(body.deadline, 10, 'Deadline', false);
    if (payload.deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(payload.deadline) || !Number.isFinite(Date.parse(payload.deadline)) || new Date(payload.deadline).toISOString().slice(0, 10) !== payload.deadline)) fail('Enter a valid deadline date.');
  }
  return payload;
}

function kindLabel(kind, lang) {
  var labels = { wordlist: ['Vocabulary & materials', '词汇与材料'], game: ['Classroom games', '课堂游戏'], contest: ['Competitions & events', '比赛与活动'], website: ['Teaching websites', '教学网站'], grant: ['Teacher grants', '教师资助'] };
  return labels[kind] ? labels[kind][lang === 'zh' ? 1 : 0] : '';
}

var MAX_WORDS = 300;
var PAGE_SIZE = 24;

function fail(message, status) {
  var error = new Error(message);
  error.status = status || 400;
  throw error;
}

function text(value, max, label, required) {
  var clean = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (required && !clean) fail(label + ' is required.');
  if (clean.length > max) fail(label + ' must be ' + max + ' characters or fewer.');
  return clean;
}

function newId() {
  return crypto.randomBytes(6).toString('base64url');
}

function validId(id) {
  return /^[A-Za-z0-9_-]{8,16}$/.test(String(id || ''));
}

function cleanStages(value) {
  var keys = STAGES.map(function (stage) { return stage.key; });
  return (Array.isArray(value) ? value : []).filter(function (key, index, all) {
    return keys.indexOf(key) !== -1 && all.indexOf(key) === index;
  });
}

function cleanTextbook(value) {
  return TEXTBOOKS.some(function (book) { return book.key === value; }) ? value : '';
}

// Word list items in the same shape as ChenWordlist: { zh, py, en }.
function cleanWords(items) {
  if (!Array.isArray(items)) fail('Add some words to the list.');
  var words = items.slice(0, MAX_WORDS + 1).map(function (item) {
    item = item || {};
    return { zh: text(item.zh, 40, 'A word', false), py: text(item.py, 80, 'Pinyin', false), en: text(item.en, 120, 'An English meaning', false) };
  }).filter(function (item) { return item.zh; });
  if (!words.length) fail('Add some words to the list.');
  if (words.length > MAX_WORDS) fail('A shared word list can have at most ' + MAX_WORDS + ' words.');
  return words;
}

// Shared fields of every post. Content (words or game data) is checked by the caller.
function cleanPost(body) {
  body = body || {};
  return {
    authorName: text(body.authorName, 40, 'Your display name', true),
    title: text(body.title, 120, 'Title', true),
    description: text(body.description, 500, 'Description', false),
    stages: cleanStages(body.stages),
    textbook: cleanTextbook(body.textbook)
  };
}

// Search and filter the live posts in memory (there are a few hundred at most).
function search(posts, query) {
  query = query || {};
  var q = String(query.q || '').trim().toLowerCase().slice(0, 60);
  var stage = cleanStages([query.stage])[0] || '';
  var textbook = cleanTextbook(query.textbook);
  var kind = KINDS.indexOf(query.kind) !== -1 ? query.kind : '';
  var matches = posts.filter(function (post) {
    if (stage && post.stages.indexOf(stage) === -1) return false;
    if (textbook && post.textbook !== textbook) return false;
    if (kind && post.kind !== kind) return false;
    if (q && (post.title + ' ' + post.description + ' ' + post.authorName + ' ' + (post.kind === 'grant' && post.payload ? post.payload.funder || '' : '')).toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
  var pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  var page = Math.min(pages, Math.max(1, parseInt(query.page, 10) || 1));
  return { q: q, stage: stage, textbook: textbook, kind: kind, page: page, pages: pages, total: matches.length,
    posts: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

// Plain text lines "字 | pinyin | English" that every tool's word box accepts.
function wordsAsText(words) {
  return words.map(function (word) { return [word.zh, word.py, word.en].join(' | ').replace(/( \| )+$/, ''); }).join('\n');
}

function label(list, key, lang) {
  var found = list.find(function (item) { return item.key === key; });
  return found ? found[lang === 'zh' ? 'zh' : 'en'] : '';
}

module.exports = {
  KINDS: KINDS, EXTERNAL_KINDS: EXTERNAL_KINDS, isClosed: isClosed, today: today, cleanExternal: cleanExternal, kindLabel: kindLabel, STAGES: STAGES, TEXTBOOKS: TEXTBOOKS, GAME_TYPES: GAME_TYPES, MAX_WORDS: MAX_WORDS, PAGE_SIZE: PAGE_SIZE,
  newId: newId, validId: validId, cleanPost: cleanPost, cleanWords: cleanWords, search: search, wordsAsText: wordsAsText,
  stageLabel: function (key, lang) { return label(STAGES, key, lang); },
  textbookLabel: function (key, lang) { return label(TEXTBOOKS, key, lang); },
  gameLabel: function (type, lang) { var game = GAME_TYPES[type]; return game ? game[lang === 'zh' ? 'zh' : 'en'] : ''; }
};
