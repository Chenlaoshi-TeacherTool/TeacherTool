'use strict';

var adapters = new Map();

function register(adapter) {
  if (!adapter || !adapter.type || !adapter.version || !adapter.view || typeof adapter.sanitize !== 'function') {
    throw new Error('Invalid shared game adapter.');
  }
  adapters.set(adapter.type + '@' + adapter.version, adapter);
  return adapter;
}

function get(gameType, version) {
  return adapters.get(String(gameType || '') + '@' + Number(version || 1)) || null;
}

register(require('./games/wordSudokuGame'));

module.exports = { register: register, get: get };
