'use strict';

var core = require('../../public/teaching-tools/vocabulary-gacha/gacha-core');

module.exports = {
  type: 'vocabulary-gacha',
  version: 1,
  templateOnly: true,
  sanitize: core.template
};
