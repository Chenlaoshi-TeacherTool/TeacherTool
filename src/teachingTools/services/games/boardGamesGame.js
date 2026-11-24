'use strict';

var core = require('../../public/low-prep/board-games/board-games-core');

// Board Game Maker is saved as a template only (no student link yet).
module.exports = {
  type: 'board-games',
  version: 1,
  templateOnly: true,
  sanitize: core.template
};
