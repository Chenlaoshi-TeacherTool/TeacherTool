/* 量词大挑战 · 学生分享页：只有抓量词和填句子两种模式。 */
(function () {
  'use strict';

  var game = window.__SHARED_GAME__ || {};
  var data = game.data || {};
  var bestKey = 'shared-game-progress:' + game.shareId;
  var menu = document.getElementById('mw-menu');
  var host = document.getElementById('mw-stage-host');
  var bestEl = document.getElementById('mw-best');
  var hasNouns = (data.items || []).length > 0;

  function readBest() {
    try { return JSON.parse(localStorage.getItem(bestKey) || '{}') || {}; } catch (_e) { return {}; }
  }
  function showBest() {
    var best = readBest();
    var parts = [];
    if (best.catch) parts.push('🎯 最高分 Best: ' + best.catch);
    if (best.fill) parts.push('✏️ 最好 Best: ' + best.fill + '%');
    bestEl.textContent = parts.join(' · ');
  }

  document.querySelectorAll('.mw-mode').forEach(function (button) {
    var mode = button.getAttribute('data-mode');
    if (mode === 'catch' && !hasNouns) button.disabled = true;
    button.addEventListener('click', function () {
      menu.hidden = true;
      host.hidden = false;
      var current = window.MWGame.mount(host, data, {
        onExit: function () {
          host.hidden = true;
          host.innerHTML = '';
          menu.hidden = false;
          showBest();
        },
        onFinish: function (stats, finished) {
          var best = readBest();
          if (finished.mode === 'catch') {
            best.catch = Math.max(best.catch || 0, finished.score);
          } else if (stats.answered) {
            best.fill = Math.max(best.fill || 0, Math.round(stats.correct / stats.answered * 100));
          }
          try { localStorage.setItem(bestKey, JSON.stringify(best)); } catch (_e) { /* ignore */ }
        }
      });
      current.start(mode);
      host.scrollIntoView({ block: 'start' });
    });
  });
  showBest();
})();
