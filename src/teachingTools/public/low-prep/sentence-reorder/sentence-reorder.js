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

  var state = {
    sentences: [],   // [{ words: ['The','quick',...] }]
    currentIndex: -1,
    order: []        // current on-screen order (array of word strings) for currentIndex
  };

  var drag = null; // { chip, pointerId }

  sentenceInput.addEventListener('input', updateSetupStatus);
  updateSetupStatus();
  initLibraryPicker();

  var SENTENCE_TEMPLATES = [
    'I like the {word}.',
    'This is a {word}.',
    'I can see a {word}.',
    'She has a {word}.',
    'We need a {word}.',
    'Where is the {word}?'
  ];

  function sentencesFromWordList(list, templateOffset) {
    return (list.items || [])
      .filter(function (item) { return item.en; })
      .map(function (item, index) {
        var template = SENTENCE_TEMPLATES[(templateOffset + index) % SENTENCE_TEMPLATES.length];
        return template.replace('{word}', String(item.en).trim().toLowerCase());
      });
  }

  function initLibraryPicker() {
    if (!window.ChenLibraryPicker) return;
    var picker = ChenLibraryPicker.create({
      root: document.getElementById('sentenceLibraryPicker'),
      source: 'wordlists',
      min: 1,
      title: 'Add example sentences from the library',
      hint: 'Choose one or more vocabulary topics. Each term becomes a simple sentence you can shuffle into a word-order puzzle.',
      importLabel: 'Add sentences from selected topics',
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
    document.body.appendChild(chip);

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

  fullscreenButton.addEventListener('click', function () {
    var isActive = document.fullscreenElement === stage || stage.classList.contains('is-pseudo-fullscreen');
    if (isActive) {
      if (document.fullscreenElement) document.exitFullscreen();
      stage.classList.remove('is-pseudo-fullscreen');
      return;
    }
    var fallback = function () {
      stage.classList.add('is-pseudo-fullscreen');
    };
    if (stage.requestFullscreen) {
      try {
        var result = stage.requestFullscreen();
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

  document.addEventListener('keydown', function (event) {
    if (event.code === 'Escape' && stage.classList.contains('is-pseudo-fullscreen')) {
      stage.classList.remove('is-pseudo-fullscreen');
    }
  });
})();
