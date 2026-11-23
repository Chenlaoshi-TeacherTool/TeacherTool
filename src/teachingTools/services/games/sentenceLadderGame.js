'use strict';

// 扩句阶梯 · Sentence Ladder: the teacher shares one ladder at one level;
// each student fills the blanks row by row and hands in their sentence.
// Beginner (word box) answers are checked; free writing is read by the teacher.
// Collecting student work keeps data on the server, so the link is a members' feature.
var core = require('../../public/low-prep/sentence-ladder/ladder-core');

module.exports = {
  type: 'sentence-ladder',
  version: 1,
  view: 'game-share/sentence-ladder-player',
  membersOnly: true,
  collectsWork: true,
  sanitize: core.sanitize,
  cleanWork: core.cleanWork
};
