(function(root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine'));
  else root.QuizCityPrintModel = factory(root.QuizCity);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(engine) {
  'use strict';
  function boards(questions) {
    if (!questions.length) return [];
    return Array.from({ length: Math.ceil(questions.length / 24) }, function(unused, boardIndex) {
      return engine.tiles.map(function(tile, index) {
        var questionIndex = (boardIndex * 24 + index) % questions.length;
        return { tile: tile, position: index + 1, questionNumber: questionIndex + 1, question: questions[questionIndex] };
      });
    });
  }
  function position(index) {
    if (index < 8) return [index + 1, 1];
    if (index < 12) return [8, index - 6];
    if (index < 20) return [20 - index, 6];
    return [1, 25 - index];
  }
  function paper(format) { return format === 'letter' ? { width: 259.4, height: 195.9, name: 'Letter' } : { width: 277, height: 190, name: 'A4' }; }
  return { boards: boards, position: position, paper: paper };
});
