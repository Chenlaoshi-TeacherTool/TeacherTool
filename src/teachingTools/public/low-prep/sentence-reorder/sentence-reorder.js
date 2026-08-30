(function () {
  'use strict';

  var sentenceInput = document.getElementById('sentence-input');
  var relaxedCheckbox = document.getElementById('hide-punctuation-case');
  var generateButton = document.getElementById('generate-button');
  var setupStatus = document.getElementById('setup-status');

  var stage = document.getElementById('puzzle-stage');
  var progressText = document.getElementById('progress-text');
  var feedbackText = document.getElementById('feedback-text');

  var checkButton = document.getElementById('check-button');
  var shuffleButton = document.getElementById('shuffle-button');
  var revealButton = document.getElementById('reveal-button');
  var fullscreenButton = document.getElementById('fullscreen-button');
  var prevButton = document.getElementById('prev-button');
  var nextButton = document.getElementById('next-button');
  var fullscreenShell = document.getElementById('reorder-fullscreen-shell');
  var celebration = document.getElementById('reorder-celebration');
  var confetti = document.getElementById('reorder-confetti');

  var state = {
    sentences: [],   // [{ words: ['The','quick',...] }]
    currentIndex: -1,
    order: []        // current on-screen order (array of word strings) for currentIndex
  };

  var drag = null; // { chip, pointerId }
  var celebrationTimer = null;

  sentenceInput.addEventListener('input', updateSetupStatus);
  updateSetupStatus();
  initLibraryPicker();
  buildCelebrationConfetti();

  var CHINESE_SENTENCE_TEMPLATES = [
    '我 喜欢 {word}。',
    '这 是 {word}。',
    '我 能 看到 {word}。',
    '她 有 {word}。',
    '我们 需要 {word}。',
    '{word} 在 哪里？'
  ];

  function sentencesFromWordList(list, templateOffset) {
    return (list.items || [])
      .filter(function (item) { return item.zh; })
      .map(function (item, index) {
        var template = CHINESE_SENTENCE_TEMPLATES[(templateOffset + index) % CHINESE_SENTENCE_TEMPLATES.length];
        var chineseWord = String(item.zh).trim().replace(/\s+/g, ' ');
        return template.replace('{word}', chineseWord);
      });
  }

  function initLibraryPicker() {
    if (!window.ChenLibraryPicker) return;
    var picker = ChenLibraryPicker.create({
      root: document.getElementById('sentenceLibraryPicker'),
      source: 'wordlists',
      min: 1,
      title: 'Add Chinese example sentences from the library',
      hint: 'Choose one or more vocabulary topics. Each Chinese term becomes a simple sentence you can shuffle into a word-order puzzle.',
      importLabel: 'Add Chinese sentences from selected topics',
      onImport: function (lists) {
        var lines = [];
        lists.forEach(function (list, listIndex) {
          lines = lines.concat(sentencesFromWordList(list, listIndex));
        });
        if (lines.length) {
          var existing = sentenceInput.value.trim();
          sentenceInput.value = (existing ? existing + '\n' : '') + lines.join('\n');
          updateSetupStatus();
        }
        picker.reset();
      }
    });
  }

  function updateSetupStatus() {
    var count = parseSentences(sentenceInput.value).length;
    if (!count) {
      setupStatus.textContent = 'Enter at least one sentence to begin.';
    } else {
      setupStatus.textContent = count + ' sentence' + (count === 1 ? '' : 's') + ' ready to generate.';
    }
  }

  function parseSentences(raw) {
    return raw.split('\n')
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line.length > 0; })
      .map(function (line) {
        return { words: line.split(/\s+/).filter(function (w) { return w.length > 0; }) };
      })
      .filter(function (s) { return s.words.length > 1; });
  }

  function shuffle(array) {
    var result = array.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    // avoid accidentally shuffling back into the original order when possible
    var isSame = result.every(function (w, idx) { return w === array[idx]; });
    if (isSame && result.length > 1) {
      var t = result[0];
      result[0] = result[1];
      result[1] = t;
    }
    return result;
  }

  generateButton.addEventListener('click', function () {
    var sentences = parseSentences(sentenceInput.value);
    if (!sentences.length) {
      updateSetupStatus();
      return;
    }
    state.sentences = sentences;
    state.currentIndex = 0;
    loadPuzzle(0);
  });

  function loadPuzzle(index) {
    var entry = state.sentences[index];
    if (!entry) return;
    hideCelebration();
    state.currentIndex = index;
    state.order = shuffle(entry.words);
    renderStage();
    feedbackText.textContent = '';
    feedbackText.className = 'reorder-feedback';
    updateProgressText();
    updateControlsAvailability();
  }

  function renderStage() {
    stage.innerHTML = '';
    var track = document.createElement('div');
    track.className = 'reorder-track';
    track.id = 'word-track';
    state.order.forEach(function (word) {
      track.appendChild(makeChip(word));
    });
    stage.appendChild(track);
    attachDragHandlers(track);
  }

  function makeChip(word) {
    var chip = document.createElement('div');
    chip.className = 'word-chip';
    chip.textContent = word;
    chip.dataset.word = word;
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-label', 'Word: ' + word);
    return chip;
  }

  function attachDragHandlers(track) {
    Array.prototype.forEach.call(track.children, function (chip) {
      chip.addEventListener('pointerdown', onPointerDown);
      chip.addEventListener('keydown', onChipKeyDown);
    });
  }

  function onChipKeyDown(event) {
    var track = document.getElementById('word-track');
    if (!track) return;
    var chips = Array.prototype.slice.call(track.children);
    var index = chips.indexOf(event.currentTarget);
    if (event.key === 'ArrowLeft' && index > 0) {
      track.insertBefore(chips[index], chips[index - 1]);
      event.currentTarget.focus();
      syncOrderFromDom();
      event.preventDefault();
    } else if (event.key === 'ArrowRight' && index < chips.length - 1) {
      track.insertBefore(chips[index + 1], chips[index]);
      event.currentTarget.focus();
      syncOrderFromDom();
      event.preventDefault();
    }
  }

  var DRAG_START_THRESHOLD = 4;

  function onPointerDown(event) {
    var chip = event.currentTarget;
    if (drag) return;
    drag = {
      chip: chip,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      started: false
    };
    // Listen on the document, not the chip itself: once the chip is
    // detached from the flow (position: fixed) or the pointer moves fast,
    // relying on the chip's own listeners (or native pointer capture, which
    // can silently fail) would leave the drag stuck under the cursor.
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    event.preventDefault();
  }

  function beginDrag(event) {
    var chip = drag.chip;
    var rect = chip.getBoundingClientRect();
    drag.offsetX = drag.startX - rect.left;
    drag.offsetY = drag.startY - rect.top;
    drag.width = rect.width;
    drag.height = rect.height;

    var placeholder = document.createElement('div');
    placeholder.className = 'word-chip-placeholder';
    placeholder.style.width = rect.width + 'px';
    placeholder.style.height = rect.height + 'px';
    chip.parentElement.insertBefore(placeholder, chip);
    drag.placeholder = placeholder;

    chip.classList.add('is-dragging');
    chip.style.position = 'fixed';
    chip.style.left = rect.left + 'px';
    chip.style.top = rect.top + 'px';
    chip.style.width = rect.width + 'px';
    chip.style.height = rect.height + 'px';
    chip.style.margin = '0';
    (isFullscreenActive() ? fullscreenShell : document.body).appendChild(chip);

    drag.started = true;
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;

    if (!drag.started) {
      var dx = event.clientX - drag.startX;
      var dy = event.clientY - drag.startY;
      if (Math.abs(dx) < DRAG_START_THRESHOLD && Math.abs(dy) < DRAG_START_THRESHOLD) return;
      beginDrag(event);
    }

    drag.chip.style.left = (event.clientX - drag.offsetX) + 'px';
    drag.chip.style.top = (event.clientY - drag.offsetY) + 'px';

    var track = document.getElementById('word-track');
    if (!track) return;

    var nearest = findNearestChip(track, event.clientX, event.clientY);
    if (nearest) {
      var insertAfter = event.clientX > (nearest.rect.left + nearest.rect.width / 2);
      track.insertBefore(drag.placeholder, insertAfter ? nearest.chip.nextSibling : nearest.chip);
    }
  }

  function findNearestChip(track, x, y) {
    var best = null;
    var bestDist = Infinity;
    Array.prototype.forEach.call(track.children, function (chip) {
      if (!chip.classList.contains('word-chip')) return;
      var rect = chip.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dist = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { chip: chip, rect: rect };
      }
    });
    return best;
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    var chip = drag.chip;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);

    if (drag.started) {
      drag.placeholder.parentElement.insertBefore(chip, drag.placeholder);
      drag.placeholder.remove();
      chip.classList.remove('is-dragging');
      chip.style.position = '';
      chip.style.left = '';
      chip.style.top = '';
      chip.style.width = '';
      chip.style.height = '';
      chip.style.margin = '';
      syncOrderFromDom();
    }

    drag = null;
  }

  function syncOrderFromDom() {
    var track = document.getElementById('word-track');
    if (!track) return;
    state.order = Array.prototype.map.call(track.children, function (chip) {
      return chip.dataset.word;
    });
  }

  function normalize(word) {
    if (!relaxedCheckbox.checked) return word;
    return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  }

  checkButton.addEventListener('click', function () {
    var entry = state.sentences[state.currentIndex];
    if (!entry) return;
    var track = document.getElementById('word-track');
    var chips = Array.prototype.slice.call(track.children);
    var correctCount = 0;
    chips.forEach(function (chip, idx) {
      var isCorrect = normalize(chip.dataset.word) === normalize(entry.words[idx]);
      chip.classList.remove('is-correct', 'is-incorrect');
      chip.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
      if (isCorrect) correctCount++;
    });
    var total = entry.words.length;
    if (correctCount === total) {
      feedbackText.textContent = '🎉 Correct! All ' + total + ' words are in the right order.';
      feedbackText.className = 'reorder-feedback is-success';
      showCelebration();
    } else {
      feedbackText.textContent = correctCount + ' of ' + total + ' words are in the correct position. Keep dragging!';
      feedbackText.className = 'reorder-feedback is-partial';
    }
  });

  shuffleButton.addEventListener('click', function () {
    if (state.currentIndex === -1) return;
    loadPuzzle(state.currentIndex);
  });

  revealButton.addEventListener('click', function () {
    var entry = state.sentences[state.currentIndex];
    if (!entry) return;
    state.order = entry.words.slice();
    renderStage();
    feedbackText.textContent = 'This is the correct order.';
    feedbackText.className = 'reorder-feedback is-partial';
  });

  prevButton.addEventListener('click', function () {
    if (state.currentIndex > 0) loadPuzzle(state.currentIndex - 1);
  });

  nextButton.addEventListener('click', function () {
    if (state.currentIndex < state.sentences.length - 1) loadPuzzle(state.currentIndex + 1);
  });

  function updateProgressText() {
    if (state.currentIndex === -1) {
      progressText.textContent = 'No puzzle loaded yet.';
    } else {
      progressText.textContent = 'Sentence ' + (state.currentIndex + 1) + ' of ' + state.sentences.length +
        ' · ' + state.sentences[state.currentIndex].words.length + ' words';
    }
  }

  function updateControlsAvailability() {
    var hasPuzzle = state.currentIndex >= 0;
    checkButton.disabled = !hasPuzzle;
    shuffleButton.disabled = !hasPuzzle;
    revealButton.disabled = !hasPuzzle;
    fullscreenButton.disabled = !hasPuzzle;
    prevButton.disabled = !hasPuzzle || state.currentIndex === 0;
    nextButton.disabled = !hasPuzzle || state.currentIndex >= state.sentences.length - 1;
  }

  function buildCelebrationConfetti() {
    if (!confetti) return;
    var colors = ['#ffcf56', '#f47c68', '#8fca78', '#65b9d7', '#b78ce2', '#fffdf7'];
    for (var i = 0; i < 36; i++) {
      var piece = document.createElement('span');
      piece.className = 'reorder-confetti-piece';
      piece.style.left = ((i * 29) % 97 + 1) + '%';
      piece.style.backgroundColor = colors[i % colors.length];
      piece.style.setProperty('--confetti-delay', ((i % 9) * 0.07) + 's');
      piece.style.setProperty('--confetti-drift', (((i % 7) - 3) * 24) + 'px');
      piece.style.setProperty('--confetti-spin', ((i % 2 ? 1 : -1) * (360 + i * 19)) + 'deg');
      confetti.appendChild(piece);
    }
  }

  function isFullscreenActive() {
    return document.fullscreenElement === fullscreenShell || fullscreenShell.classList.contains('is-pseudo-fullscreen');
  }

  function updateFullscreenUi() {
    var active = isFullscreenActive();
    fullscreenButton.textContent = active ? fullscreenButton.dataset.exitLabel : fullscreenButton.dataset.enterLabel;
    fullscreenButton.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (!active) hideCelebration();
  }

  function hideCelebration() {
    if (!celebration) return;
    celebration.classList.remove('is-active');
    celebration.setAttribute('aria-hidden', 'true');
    if (celebrationTimer) {
      window.clearTimeout(celebrationTimer);
      celebrationTimer = null;
    }
  }

  function showCelebration() {
    if (!celebration) return;
    hideCelebration();
    // Restart the animation when a student checks the same correct answer again.
    void celebration.offsetWidth;
    celebration.classList.add('is-active');
    celebration.setAttribute('aria-hidden', 'false');
    celebrationTimer = window.setTimeout(hideCelebration, 2800);
  }

  fullscreenButton.addEventListener('click', function () {
    if (isFullscreenActive()) {
      if (document.fullscreenElement === fullscreenShell) document.exitFullscreen();
      fullscreenShell.classList.remove('is-pseudo-fullscreen');
      updateFullscreenUi();
      return;
    }
    var fallback = function () {
      fullscreenShell.classList.add('is-pseudo-fullscreen');
      updateFullscreenUi();
    };
    if (fullscreenShell.requestFullscreen) {
      try {
        var result = fullscreenShell.requestFullscreen();
        if (result && result.catch) {
          result.catch(fallback);
          return;
        }
        return;
      } catch (err) {
        fallback();
        return;
      }
    }
    fallback();
  });

  document.addEventListener('fullscreenchange', updateFullscreenUi);

  document.addEventListener('keydown', function (event) {
    if (event.code === 'Escape' && fullscreenShell.classList.contains('is-pseudo-fullscreen')) {
      fullscreenShell.classList.remove('is-pseudo-fullscreen');
      updateFullscreenUi();
    }
  });
})();
