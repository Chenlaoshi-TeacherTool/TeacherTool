'use strict';

var adapters = new Map();

function register(adapter) {
  if (!adapter || !adapter.type || !adapter.version || (!adapter.view && !adapter.templateOnly) || typeof adapter.sanitize !== 'function') {
    throw new Error('Invalid shared game adapter.');
  }
  adapters.set(adapter.type + '@' + adapter.version, adapter);
  return adapter;
}

function get(gameType, version) {
  return adapters.get(String(gameType || '') + '@' + Number(version || 1)) || null;
}

register(require('./games/wordSudokuGame'));
register(require('./games/sentenceReorderGame'));
register(require('./games/measureWordsGame'));
register(require('./games/hanziWordChoiceGame'));
register(require('./games/vocabularyGachaGame'));
register(require('./games/pixelArtGame'));

module.exports = { register: register, get: get };
