'use strict';

// 像素画猜猜看: the teacher shares a word list; each student draws one word as
// pixel art (plus a few sentences) and submits it. Nothing is graded — the
// teacher shows the drawings and the class guesses. Collecting student work
// keeps data on the server, so making this link is a members' feature.

const GRID_SIZES = [12, 16, 20, 24];
const MAX_WORDS = 80;
const MAX_PROMPTS = 6;
const PIXEL_CHARS = /^[0-9a-f]*$/;

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function text(value, max) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function sanitize(data) {
  const grid = Number(data?.grid);
  if (!GRID_SIZES.includes(grid)) fail('Grid size must be 12, 16, 20 or 24.');
  if (!Array.isArray(data?.words) || data.words.length < 1 || data.words.length > MAX_WORDS) fail('请提供 1–80 个词。');
  const seen = new Set();
  const words = data.words.map(word => {
    const zh = text(word?.zh, 20);
    if (!zh) fail('每个词都需要中文。');
    if (seen.has(zh)) fail('词表里有重复的词：' + zh);
    seen.add(zh);
    return { zh, py: text(word.py, 60), en: text(word.en, 60), group: text(word.group, 30) };
  });
  const prompts = Array.isArray(data.prompts) ? data.prompts.map(prompt => text(prompt, 80)).filter(Boolean) : [];
  if (prompts.length > MAX_PROMPTS) fail('最多 6 个句子。');
  // Which helpers students and the class see next to the Chinese.
  const show = { py: data.show?.py !== false, en: data.show?.en !== false };
  return { title: text(data.title, 120), grid, words, prompts, show };
}

// What a student sends when they submit their drawing.
function cleanWork(payload, work) {
  const word = text(work?.word, 20);
  if (!payload.words.some(entry => entry.zh === word)) fail('请先选一个词。');
  const pixels = typeof work.pixels === 'string' ? work.pixels : '';
  if (pixels.length !== payload.grid * payload.grid || !PIXEL_CHARS.test(pixels)) fail('The drawing could not be read. Please try again.');
  if (!/[1-9a-f]/.test(pixels)) fail('请先画一画再提交。');
  const sentences = Array.isArray(work.sentences) ? work.sentences.slice(0, payload.prompts.length).map(sentence => text(sentence, 160)) : [];
  return { word, pixels, sentences };
}

module.exports = {
  type: 'pixel-art',
  version: 1,
  view: 'game-share/pixel-art-player',
  membersOnly: true,
  collectsWork: true,
  GRID_SIZES,
  sanitize,
  cleanWork
};
