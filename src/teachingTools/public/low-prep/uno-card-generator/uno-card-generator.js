(function () {
  'use strict';

  var COLORS = ['red', 'blue', 'green', 'yellow'];

  var state = {
    targetCount: 40,
    words: [],   // [{ hanzi, pinyin, english }]
    extras: { skip: false, reverse: false, draw2: false, wild: false },
    deck: []     // rendered card descriptors
  };

  var modeButtons = document.querySelectorAll('.uno-mode-card');
  var textInput = document.getElementById('uno-text-input');
  var buildButton = document.getElementById('build-from-text-button');
  var aiButton = document.getElementById('ai-generate-button');
  var setupStatus = document.getElementById('uno-setup-status');
  var extraChips = document.querySelectorAll('.uno-extra-chip');
  var totalCountEl = document.getElementById('uno-total-count');
  var printButton = document.getElementById('print-deck-button');
  var emptyState = document.getElementById('uno-empty-state');
  var cardGrid = document.getElementById('uno-card-grid');

  modeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      modeButtons.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      state.targetCount = parseInt(btn.getAttribute('data-count'), 10);
      if (state.words.length) buildDeck();
    });
  });

  extraChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var key = chip.getAttribute('data-extra');
      state.extras[key] = !state.extras[key];
      chip.setAttribute('aria-pressed', state.extras[key] ? 'true' : 'false');
      if (state.words.length) buildDeck();
    });
  });

  aiButton.addEventListener('click', function () {
    setupStatus.textContent = 'AI deck generation is coming soon — use "Build Deck from Text" below for now.';
  });

  buildButton.addEventListener('click', function () {
    var parsed = parseWordList(textInput.value);
    if (!parsed.length) {
      setupStatus.textContent = 'Could not find any valid lines. Use the format: 中文 拼音, English';
      return;
    }
    state.words = parsed;
    buildDeck();
  });

  printButton.addEventListener('click', function () {
    window.print();
  });

  function parseWordList(text) {
    var lines = text.split('\n');
    var words = [];
    lines.forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line) return;
      var commaIndex = line.indexOf(',');
      if (commaIndex === -1) return;
      var head = line.slice(0, commaIndex).trim();
      var english = line.slice(commaIndex + 1).trim();
      if (!english) return;
      var spaceIndex = head.indexOf(' ');
      if (spaceIndex === -1) return;
      var hanzi = head.slice(0, spaceIndex).trim();
      var pinyin = head.slice(spaceIndex + 1).trim();
      if (!hanzi || !pinyin) return;
      words.push({ hanzi: hanzi, pinyin: pinyin, english: english });
    });
    return words;
  }

  function buildDeck() {
    var deck = [];
    var count = state.targetCount;
    var colorIndex = 0;

    for (var i = 0; i < count; i++) {
      var word = state.words[i % state.words.length];
      deck.push({
        type: 'word',
        color: COLORS[colorIndex % COLORS.length],
        hanzi: word.hanzi,
        pinyin: word.pinyin,
        english: word.english
      });
      colorIndex++;
    }

    if (state.extras.skip) COLORS.forEach(function (c) { deck.push({ type: 'skip', color: c }); });
    if (state.extras.reverse) COLORS.forEach(function (c) { deck.push({ type: 'reverse', color: c }); });
    if (state.extras.draw2) COLORS.forEach(function (c) { deck.push({ type: 'draw2', color: c }); });
    if (state.extras.wild) { deck.push({ type: 'wild' }); deck.push({ type: 'wild' }); deck.push({ type: 'wild' }); deck.push({ type: 'wild' }); }

    state.deck = deck;
    renderDeck();
  }

  function renderDeck() {
    cardGrid.innerHTML = '';
    var fragment = document.createDocumentFragment();

    state.deck.forEach(function (card) {
      fragment.appendChild(buildCardEl(card));
    });

    cardGrid.appendChild(fragment);
    totalCountEl.textContent = String(state.deck.length);

    var hasCards = state.deck.length > 0;
    emptyState.hidden = hasCards;
    cardGrid.hidden = !hasCards;
    printButton.disabled = !hasCards;
    setupStatus.textContent = hasCards
      ? 'Built ' + state.deck.length + ' cards from ' + state.words.length + ' word' + (state.words.length === 1 ? '' : 's') + '.'
      : 'Paste at least one word to build a deck.';
  }

  function buildCardEl(card) {
    var el = document.createElement('div');

    if (card.type === 'word') {
      el.className = 'uno-card uno-card--' + card.color;
      el.innerHTML =
        '<span class="uno-card__corner uno-card__corner--tl" aria-hidden="true">🌻</span>' +
        '<span class="uno-card__corner uno-card__corner--br" aria-hidden="true">🌻</span>' +
        '<div class="uno-card__hanzi">' + escapeHtml(card.hanzi) + '</div>' +
        '<div class="uno-card__pinyin">' + escapeHtml(card.pinyin) + '</div>' +
        '<div class="uno-card__english">' + escapeHtml(card.english) + '</div>';
      return el;
    }

    var specialLabels = {
      skip: { icon: '⛔', title: 'Skip', sub: '跳过' },
      reverse: { icon: '🔄', title: 'Reverse', sub: '反转' },
      draw2: { icon: '+2', title: 'Draw Two', sub: '罚抽两张' },
      wild: { icon: '🌻', title: 'Wild', sub: '万能卡' }
    };
    var info = specialLabels[card.type];
    var colorClass = card.type === 'wild' ? 'uno-card--wild' : 'uno-card--' + card.color;
    el.className = 'uno-card uno-card--special ' + colorClass;
    el.innerHTML =
      '<span class="uno-card__corner uno-card__corner--tl" aria-hidden="true">🌻</span>' +
      '<span class="uno-card__corner uno-card__corner--br" aria-hidden="true">🌻</span>' +
      '<div class="uno-card__hanzi">' + info.icon + '</div>' +
      '<div class="uno-card__pinyin">' + info.sub + '</div>' +
      '<div class="uno-card__english">' + info.title + '</div>';
    return el;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
