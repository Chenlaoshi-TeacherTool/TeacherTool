'use strict';

var core = require('../../public/low-prep/dice-story/dice-story-core');

// Dice Story is saved as a template only (no student link).
module.exports = {
  type: 'dice-story',
  version: 1,
  templateOnly: true,
  sanitize: core.template
};
