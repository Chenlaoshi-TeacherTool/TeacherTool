'use strict';

var crypto = require('node:crypto');

// No 0/O/1/I so codes survive being read aloud or copied from a screenshot.
var ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
var PLAN_DAYS = [30, 90, 180, 365];

// CLS-XXXX-XXXX-XXXX: 12 random characters, 60 bits.
function generate() {
  var bytes = crypto.randomBytes(12);
  var chars = Array.from(bytes, function (byte) { return ALPHABET[byte % 32]; }).join('');
  return 'CLS-' + chars.slice(0, 4) + '-' + chars.slice(4, 8) + '-' + chars.slice(8);
}

// Accepts lower case, spaces and missing dashes; returns null for anything that cannot be a code.
function normalize(input) {
  var text = String(input || '').toUpperCase().replace(/[\s-]/g, '');
  if (text.indexOf('CLS') === 0) text = text.slice(3);
  return /^[2-9A-HJ-NP-Z]{12}$/.test(text) ? text : null;
}

function hash(input) {
  var code = normalize(input);
  return code ? crypto.createHash('sha256').update(code).digest('hex') : null;
}

module.exports = { generate: generate, normalize: normalize, hash: hash, PLAN_DAYS: PLAN_DAYS };
