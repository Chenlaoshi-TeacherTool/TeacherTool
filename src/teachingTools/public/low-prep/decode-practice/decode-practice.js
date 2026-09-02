(function () {
  'use strict';

  // Pool of common Chinese characters used to fill empty grid cells so the
  // code table stays a puzzle even when the vocabulary list is short.
  var DISTRACTOR_POOL = (
    '的一是不了人我在有他这为之大来以个中上们' +
    '到说国和地也子时道出而要于就下得可你年生' +
    '自会那后能对着事其里所去行过家十用发天如' +
    '然作方成者多日都三小军二无同么经法当起与' +
    '好看学进种将还分此心前面又定见只主没公从' +
    '想活正感应意样门头电话开水火山石田土木禾' +
    '花草虫鸟鱼羊牛马车门衣食住走飞跑跳唱笑哭'
  ).split('');

  var ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  var state = {
    words: [],          // [{ text: '芦花', chars: ['芦','花'] }]
    columns: 7,
    mode: 'decode',     // 'decode' | 'encode'
    distractors: true,
    grid: [],           // [[char, char, ...], ...]
    charToCode: {},     // '芦' -> '3D'
    title: '',
    built: false
  };

  var el = {};

  document.addEventListener('DOMContentLoaded', function () {
    el.title = document.getElementById('dp-title');
    el.textInput = document.getElementById('dp-text-input');
    el.columns = document.getElementById('dp-columns');
    el.buildButton = document.getElementById('dp-build-button');
    el.status = document.getElementById('dp-status');
    el.modeButtons = document.querySelectorAll('.dp-mode-card');
    el.distractorToggle = document.getElementById('dp-distractor-toggle');
    el.answerToggle = document.getElementById('dp-answer-toggle');
    el.printButton = document.getElementById('dp-print-button');
    el.emptyState = document.getElementById('dp-empty-state');
    el.worksheet = document.getElementById('dp-worksheet');
    el.sheetTitle = document.getElementById('dp-sheet-title');
    el.gridHost = document.getElementById('dp-grid-host');
    el.questionsHost = document.getElementById('dp-questions-host');
    el.wordCount = document.getElementById('dp-word-count');

    el.modeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        el.modeButtons.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        state.mode = btn.getAttribute('data-mode');
        if (state.built) renderQuestions();
      });
    });

    el.distractorToggle.addEventListener('change', function () {
      state.distractors = el.distractorToggle.checked;
      if (state.built) build();
    });

    el.answerToggle.addEventListener('change', function () {
      if (state.built) {
        el.worksheet.classList.toggle('dp-show-answers', el.answerToggle.checked);
      }
    });

    el.buildButton.addEventListener('click', build);
    el.printButton.addEventListener('click', function () { window.print(); });
  });

  function build() {
    var words = parseWords(el.textInput.value);
    if (!words.length) {
      state.built = false;
      el.status.textContent = 'Type at least one word above, then build the worksheet.';
      return;
    }

    var cols = parseInt(el.columns.value, 10);
    if (isNaN(cols) || cols < 3) cols = 7;
    if (cols > 12) cols = 12;

    state.words = words;
    state.columns = cols;
    state.distractors = el.distractorToggle.checked;
    state.title = el.title.value.trim();

    buildGrid();
    render();
    state.built = true;
  }

  function parseWords(text) {
    // Split on newlines, commas (both widths), and spaces.
    var raw = text.split(/[\n,，、\s]+/);
    var seen = {};
    var words = [];
    raw.forEach(function (piece) {
      var word = piece.trim();
      if (!word) return;
      if (seen[word]) return;
      seen[word] = true;
      words.push({ text: word, chars: Array.from(word) });
    });
    return words;
  }

  function buildGrid() {
    // Unique characters across every word, in first-seen order.
    var seen = {};
    var uniqueChars = [];
    state.words.forEach(function (word) {
      word.chars.forEach(function (ch) {
        if (!seen[ch]) { seen[ch] = true; uniqueChars.push(ch); }
      });
    });

    var cols = state.columns;
    var rows = Math.max(1, Math.ceil(uniqueChars.length / cols));
    var totalCells = rows * cols;

    var cellChars = uniqueChars.slice();

    if (state.distractors) {
      var needed = totalCells - cellChars.length;
      var distractors = DISTRACTOR_POOL.filter(function (ch) { return !seen[ch]; });
      shuffle(distractors);
      for (var i = 0; i < needed && i < distractors.length; i++) {
        cellChars.push(distractors[i]);
        seen[distractors[i]] = true;
      }
    }

    // Shuffle the placed characters so word characters are scattered.
    shuffle(cellChars);

    // Pad any remaining cells (e.g. distractors off, or pool exhausted) with blanks.
    while (cellChars.length < totalCells) cellChars.push('');

    var grid = [];
    var charToCode = {};
    for (var r = 0; r < rows; r++) {
      var rowArr = [];
      for (var c = 0; c < cols; c++) {
        var ch = cellChars[r * cols + c];
        rowArr.push(ch);
        if (ch) {
          // Code format matches the source worksheet: column number + row letter, e.g. "3D".
          charToCode[ch] = (c + 1) + ROW_LETTERS.charAt(r);
        }
      }
      grid.push(rowArr);
    }

    state.grid = grid;
    state.charToCode = charToCode;
  }

  function render() {
    el.sheetTitle.textContent = state.title || '译码练习 · Decode Practice';
    renderGrid();
    renderQuestions();

    el.emptyState.hidden = true;
    el.worksheet.hidden = false;
    el.printButton.disabled = false;
    el.worksheet.classList.toggle('dp-show-answers', el.answerToggle.checked);

    var n = state.words.length;
    el.wordCount.textContent = String(n);
    el.status.textContent = 'Built a ' + state.grid.length + '×' + state.columns +
      ' code table for ' + n + ' word' + (n === 1 ? '' : 's') + '.';
  }

  function renderGrid() {
    var cols = state.columns;
    var rows = state.grid.length;
    var html = '<table class="dp-grid"><thead><tr><th class="dp-corner"></th>';
    for (var c = 1; c <= cols; c++) html += '<th class="dp-axis">' + c + '</th>';
    html += '<th class="dp-corner"></th></tr></thead><tbody>';

    for (var r = 0; r < rows; r++) {
      var letter = ROW_LETTERS.charAt(r);
      html += '<tr><th class="dp-axis">' + letter + '</th>';
      for (var cc = 0; cc < cols; cc++) {
        html += '<td class="dp-cell">' + escapeHtml(state.grid[r][cc]) + '</td>';
      }
      html += '<th class="dp-axis">' + letter + '</th></tr>';
    }

    html += '</tbody><tfoot><tr><th class="dp-corner"></th>';
    for (var cf = 1; cf <= cols; cf++) html += '<th class="dp-axis">' + cf + '</th>';
    html += '<th class="dp-corner"></th></tr></tfoot></table>';

    el.gridHost.innerHTML = html;
  }

  function renderQuestions() {
    var isDecode = state.mode === 'decode';
    el.questionsHost.setAttribute('data-mode', state.mode);

    var promptEl = document.getElementById('dp-questions-prompt');
    promptEl.textContent = isDecode
      ? '请根据代码找出下列词语。 Use the codes to find each word.'
      : '请写出下列词语的代码。 Write the code for each character.';

    var html = '';
    state.words.forEach(function (word, index) {
      var codes = word.chars.map(function (ch) { return state.charToCode[ch] || '—'; });

      if (isDecode) {
        var codeCells = codes.map(function (code) {
          return '<span class="dp-code">' + escapeHtml(code) + '</span>';
        }).join('');
        html +=
          '<li class="dp-question">' +
            '<span class="dp-q-num">' + (index + 1) + '</span>' +
            '<span class="dp-codes">' + codeCells + '</span>' +
            '<span class="dp-answer-line"><span class="dp-answer-text">' + escapeHtml(word.text) + '</span></span>' +
          '</li>';
      } else {
        var wordCells = word.chars.map(function (ch, i) {
          return '<span class="dp-encode-char">' +
              '<span class="dp-char">' + escapeHtml(ch) + '</span>' +
              '<span class="dp-code-blank"><span class="dp-answer-text">' + escapeHtml(codes[i]) + '</span></span>' +
            '</span>';
        }).join('');
        html +=
          '<li class="dp-question dp-question--encode">' +
            '<span class="dp-q-num">' + (index + 1) + '</span>' +
            '<span class="dp-encode-word">' + wordCells + '</span>' +
          '</li>';
      }
    });

    el.questionsHost.innerHTML = html;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }
})();
