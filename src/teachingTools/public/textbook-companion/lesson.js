(function () {
  'use strict';

  var root = document.getElementById('tcLesson');
  var data = document.getElementById('tcWords');
  if (!root || !data) return;
  var text = window.TC_TEXT || {};
  var words = JSON.parse(data.textContent);
  var status = document.getElementById('tcStatus');

  function say(message) { status.textContent = message; }

  async function copy(value) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(value);
    var area = document.createElement('textarea');
    area.value = value; document.body.appendChild(area); area.select();
    var ok = document.execCommand('copy'); area.remove();
    if (!ok) throw new Error('copy');
  }

  root.addEventListener('click', async function (event) {
    var button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'save') {
      try {
        window.ChenWordlist.save({ name: root.dataset.title, theme: '', level: '', items: words.map(function (word) {
          return { zh: word.zh, py: word.py, en: word.en, theme: '', level: '', img: '', note: '' };
        }) });
        say(text.saved);
      } catch (error) { say(text.saveFailed); }
    } else if (button.dataset.action === 'copy') {
      try {
        await copy(words.map(function (word) { return [word.zh, word.py, word.en].filter(Boolean).join(' | '); }).join('\n'));
        say(text.copied);
      } catch (error) { say(text.copyFailed); }
    }
  });
}());
