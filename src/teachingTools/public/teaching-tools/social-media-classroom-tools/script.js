(function () {
  'use strict';

  document.querySelectorAll('.hub-card').forEach(function (card) {
    var link = card.querySelector('a');
    if (!link) return;
    card.addEventListener('click', function (event) {
      if (event.target.closest('a')) return;
      link.click();
    });
    card.tabIndex = 0;
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') link.click();
    });
  });
})();
