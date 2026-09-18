(() => {
  'use strict';

  const game = window.__SHARED_GAME__;
  if (!game || !game.data || !Array.isArray(game.data.sentences) || !game.data.sentences.length) return;

  const data = game.data;
  const progressKey = `shared-sentence-reorder-progress:${game.shareId}`;
  const elements = {
    stage: document.getElementById('studentSentenceStage'),
    progress: document.getElementById('progressCount'),
    sentenceProgress: document.getElementById('sentenceProgress'),
    status: document.getElementById('gameStatus'),
    check: document.getElementById('checkButton'),
    shuffle: document.getElementById('shuffleButton'),
    reveal: document.getElementById('revealButton'),
    prev: document.getElementById('prevButton'),
    next: document.getElementById('nextButton'),
    reset: document.getElementById('resetButton'),
    completion: document.getElementById('completionPanel'),
    completionMessage: document.getElementById('completionMessage'),
    closeCompletion: document.getElementById('closeCompletionButton')
  };

  let drag = null;
  const saved = loadProgress();
  const state = {
    currentIndex: saved.currentIndex,
    solved: saved.solved,
    order: []
  };

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey));
      const solved = Array.isArray(saved.solved) && saved.solved.length === data.sentences.length
        ? saved.solved.map(Boolean)
        : Array(data.sentences.length).fill(false);
      return {
        currentIndex: Math.max(0, Math.min(Number(saved.currentIndex) || 0, data.sentences.length - 1)),
        solved
      };
    } catch (_error) {
      return { currentIndex: 0, solved: Array(data.sentences.length).fill(false) };
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(progressKey, JSON.stringify({
        currentIndex: state.currentIndex,
        solved: state.solved
      }));
    } catch (_error) {
      /* Storage may be disabled. */
    }
  }

  function shuffle(words) {
    const result = words.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    if (result.every((word, index) => word === words[index]) && result.length > 1) {
      const tmp = result[0];
      result[0] = result[1];
      result[1] = tmp;
    }
    return result;
  }

  function sentenceWords() {
    return data.sentences[state.currentIndex].words;
  }

  function setStatus(message, className) {
    elements.status.textContent = message;
    elements.status.className = `reorder-student-status${className ? ` ${className}` : ''}`;
  }

  function normalize(word) {
    if (!data.relaxed) return word;
    return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  }

  function makeChip(word) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'reorder-student-chip';
    chip.textContent = word;
    chip.dataset.word = word;
    chip.setAttribute('aria-label', `Word: ${word}`);
    chip.addEventListener('pointerdown', onPointerDown);
    chip.addEventListener('keydown', onChipKeyDown);
    return chip;
  }

  function renderStage() {
    elements.stage.replaceChildren();
    const track = document.createElement('div');
    track.id = 'studentWordTrack';
    track.className = 'reorder-student-track';
    state.order.forEach((word) => track.append(makeChip(word)));
    elements.stage.append(track);
    refreshLockedChips();
  }

  function isLockedChip(chip) {
    return chip && chip.classList.contains('is-locked');
  }

  function unlockedSegment(chip) {
    let segment = 0;
    let node = chip && chip.parentElement ? chip.parentElement.firstElementChild : null;
    while (node && node !== chip) {
      if (isLockedChip(node)) segment += 1;
      node = node.nextElementSibling;
    }
    return segment;
  }

  function refreshLockedChips() {
    const words = sentenceWords();
    const track = document.getElementById('studentWordTrack');
    if (!track) return;
    let wordIndex = 0;
    Array.from(track.children).forEach((chip) => {
      if (!chip.classList.contains('reorder-student-chip')) return;
      const isCorrect = normalize(chip.dataset.word) === normalize(words[wordIndex]);
      chip.classList.toggle('is-correct', isCorrect);
      chip.classList.toggle('is-locked', isCorrect);
      chip.disabled = isCorrect;
      chip.setAttribute('aria-disabled', isCorrect ? 'true' : 'false');
      if (isCorrect) chip.classList.remove('is-incorrect');
      wordIndex += 1;
    });
  }

  function renderProgress() {
    const complete = state.solved.filter(Boolean).length;
    const words = sentenceWords();
    elements.progress.textContent = `${complete} / ${data.sentences.length}`;
    elements.sentenceProgress.textContent = `Sentence ${state.currentIndex + 1} of ${data.sentences.length} · ${words.length} words`;
    elements.prev.disabled = state.currentIndex === 0;
    elements.next.disabled = state.currentIndex >= data.sentences.length - 1;
  }

  function loadPuzzle(index, reshuffle) {
    state.currentIndex = index;
    state.order = reshuffle ? shuffle(sentenceWords()) : sentenceWords().slice();
    if (reshuffle) setStatus('Arrange the words, then check your answer.', '');
    renderStage();
    renderProgress();
    saveProgress();
  }

  function syncOrderFromDom() {
    const track = document.getElementById('studentWordTrack');
    if (!track) return;
    state.order = Array.from(track.children).map((chip) => chip.dataset.word);
    refreshLockedChips();
  }

  function checkAnswers() {
    const words = sentenceWords();
    const track = document.getElementById('studentWordTrack');
    const chips = Array.from(track.children);
    let correct = 0;
    chips.forEach((chip, index) => {
      const isCorrect = normalize(chip.dataset.word) === normalize(words[index]);
      chip.classList.remove('is-correct', 'is-incorrect');
      chip.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
      if (isCorrect) correct += 1;
    });
    refreshLockedChips();
    if (correct === words.length) {
      state.solved[state.currentIndex] = true;
      saveProgress();
      renderProgress();
      setStatus('Correct! This sentence is complete.', 'is-success');
      elements.completionMessage.textContent = state.solved.every(Boolean)
        ? 'Excellent work — every shared sentence is complete.'
        : 'Excellent work — this sentence is in the right order.';
      elements.completion.hidden = false;
      elements.closeCompletion.focus();
    } else {
      setStatus(`${correct} of ${words.length} words are in the correct position. Keep trying.`, 'is-error');
    }
  }

  function revealAnswer() {
    state.order = sentenceWords().slice();
    renderStage();
    setStatus('This is the correct order.', '');
  }

  function resetProgress() {
    if (!window.confirm('Clear your answers and start this game again?')) return;
    state.currentIndex = 0;
    state.solved = Array(data.sentences.length).fill(false);
    loadPuzzle(0, true);
  }

  function onChipKeyDown(event) {
    const track = document.getElementById('studentWordTrack');
    if (!track) return;
    if (isLockedChip(event.currentTarget)) return;
    const chips = Array.from(track.children);
    const index = chips.indexOf(event.currentTarget);
    if (event.key === 'ArrowLeft' && index > 0 && !isLockedChip(chips[index - 1])) {
      track.insertBefore(chips[index], chips[index - 1]);
      event.currentTarget.focus();
      syncOrderFromDom();
      event.preventDefault();
    } else if (event.key === 'ArrowRight' && index < chips.length - 1 && !isLockedChip(chips[index + 1])) {
      track.insertBefore(chips[index + 1], chips[index]);
      event.currentTarget.focus();
      syncOrderFromDom();
      event.preventDefault();
    }
  }

  function onPointerDown(event) {
    const chip = event.currentTarget;
    if (drag || chip.disabled || isLockedChip(chip)) return;
    drag = {
      chip,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      segment: unlockedSegment(chip),
      started: false
    };
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    event.preventDefault();
  }

  function beginDrag(event) {
    const chip = drag.chip;
    const rect = chip.getBoundingClientRect();
    const placeholder = document.createElement('div');
    placeholder.className = 'reorder-student-placeholder';
    placeholder.style.width = rect.width + 'px';
    placeholder.style.height = rect.height + 'px';
    chip.parentElement.insertBefore(placeholder, chip);

    drag.placeholder = placeholder;
    drag.offsetX = drag.startX - rect.left;
    drag.offsetY = drag.startY - rect.top;
    chip.classList.add('is-dragging');
    chip.style.left = rect.left + 'px';
    chip.style.top = rect.top + 'px';
    chip.style.width = rect.width + 'px';
    chip.style.height = rect.height + 'px';
    chip.style.margin = '0';
    document.body.append(chip);
    drag.started = true;
    onPointerMove(event);
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.started) {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      beginDrag(event);
    }

    drag.chip.style.left = `${event.clientX - drag.offsetX}px`;
    drag.chip.style.top = `${event.clientY - drag.offsetY}px`;

    const track = document.getElementById('studentWordTrack');
    const nearest = findNearestChip(track, event.clientX, event.clientY);
    if (nearest) {
      const insertAfter = event.clientX > nearest.rect.left + nearest.rect.width / 2;
      track.insertBefore(drag.placeholder, insertAfter ? nearest.chip.nextSibling : nearest.chip);
    }
  }

  function findNearestChip(track, x, y) {
    let best = null;
    let bestDist = Infinity;
    Array.from(track.children).forEach((chip) => {
      if (!chip.classList.contains('reorder-student-chip')) return;
      if (isLockedChip(chip)) return;
      if (drag && unlockedSegment(chip) !== drag.segment) return;
      const rect = chip.getBoundingClientRect();
      const dx = x - (rect.left + rect.width / 2);
      const dy = y - (rect.top + rect.height / 2);
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = { chip, rect };
      }
    });
    return best;
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);

    if (drag.started) {
      drag.placeholder.parentElement.insertBefore(drag.chip, drag.placeholder);
      drag.placeholder.remove();
      drag.chip.classList.remove('is-dragging');
      drag.chip.removeAttribute('style');
      syncOrderFromDom();
    }
    drag = null;
  }

  elements.check.addEventListener('click', checkAnswers);
  elements.shuffle.addEventListener('click', () => loadPuzzle(state.currentIndex, true));
  elements.reveal.addEventListener('click', revealAnswer);
  elements.prev.addEventListener('click', () => {
    if (state.currentIndex > 0) loadPuzzle(state.currentIndex - 1, true);
  });
  elements.next.addEventListener('click', () => {
    if (state.currentIndex < data.sentences.length - 1) loadPuzzle(state.currentIndex + 1, true);
  });
  elements.reset.addEventListener('click', resetProgress);
  elements.closeCompletion.addEventListener('click', () => {
    elements.completion.hidden = true;
    elements.check.focus();
  });

  loadPuzzle(state.currentIndex, true);
})();
