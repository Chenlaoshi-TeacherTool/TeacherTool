(function () {
  'use strict';

  window.renderSentenceReorderWord = function (chip, showPinyin) {
    var word = chip.dataset.word;
    chip.textContent = word;
    if (!showPinyin || !/\p{Script=Han}/u.test(word) || !window.pinyinPro) return;

    var ruby = document.createElement('ruby');
    var reading = document.createElement('rt');
    ruby.textContent = word;
    reading.textContent = window.pinyinPro.pinyin(word, { nonZh: 'removed' });
    ruby.appendChild(reading);
    chip.replaceChildren(ruby);
  };
})();
