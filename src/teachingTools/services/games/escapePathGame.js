'use strict';

var core = require('../../public/low-prep/escape-the-path/escape-the-path-core');

// Escape the Path is saved as a template only (cards + team setup, no student link).
module.exports = {
  type: 'escape-the-path',
  version: 1,
  templateOnly: true,
  sanitize: core.template
};
