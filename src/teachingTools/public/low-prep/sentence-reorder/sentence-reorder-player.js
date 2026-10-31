(() => {
  'use strict';

  const game = window.__SHARED_GAME__;
  if (!game || !game.data || !Array.isArray(game.data.sentences) || !game.data.sentences.length) return;

  const data = game.data;
  const assessment = data.mode === 'assessment';
  let progressKey = `shared-sentence-reorder-progress:${game.shareId}`;
  const elements = {
    nameGate: document.getElementById('studentNameGate'),
    nameForm: document.getElementById('studentNameForm'),
    nameInput: document.getElementById('studentNameInput'),
    nameError: document.getElementById('studentNameError'),
    start: document.getElementById('startQuizButton'),
    puzzleCard: document.getElementById('sentencePuzzleCard'),
    reviewName: document.getElementById('assessmentReviewName'),
    stage: document.getElementById('studentSentenceStage'),
    progress: document.getElementById('progressCount'),
    sentenceProgress: document.getElementById('sentenceProgress'),
    status: document.getElementById('gameStatus'),
    check: document.getElementById('checkButton'),
    submit: document.getElementById('submitButton'),
    shuffle: document.getElementById('shuffleButton'),
    prev: document.getElementById('prevButton'),
    next: document.getElementById('nextButton'),
    reset: document.getElementById('resetButton'),
    review: document.getElementById('assessmentReview'),
    reviewTitle: document.getElementById('assessmentReviewTitle'),
    reviewScore: document.getElementById('assessmentReviewScore'),
    reviewList: document.getElementById('assessmentReviewList'),
    completion: document.getElementById('completionPanel'),
    completionMessage: document.getElementById('completionMessage'),
    playAgain: document.getElementById('playAgainButton'),
    closeCompletion: document.getElementById('closeCompletionButton')
  };

  let drag = null;
  const saved = loadProgress();
  const state = {
    studentName: '',
    submitting: false,
    currentIndex: saved.currentIndex,
    solved: saved.solved,
    answers: saved.answers,
    submitted: saved.submitted,
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
        solved,
        answers: data.sentences.map((sentence, index) => {
          const answer = saved.answers && saved.answers[index];
          return Array.isArray(answer) && JSON.stringify(answer.slice().sort()) === JSON.stringify(sentence.words.slice().sort())
            ? answer : null;
        }),
        submitted: assessment && saved.submitted === true
      };
    } catch (_error) {
      return { currentIndex: 0, solved: Array(data.sentences.length).fill(false), answers: Array(data.sentences.length).fill(null), submitted: false };
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(progressKey, JSON.stringify({
        currentIndex: state.currentIndex,
        solved: state.solved,
        answers: state.answers,
        submitted: state.submitted
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
    chip.disabled = assessment && (state.submitted || state.submitting);
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

  function restoreLockedPositions(track, originalChips) {
    var movable = Array.from(track.children).filter(function (chip) { return !isLockedChip(chip); });
    originalChips.forEach(function (chip) {
      track.appendChild(isLockedChip(chip) ? chip : movable.shift());
    });
  }

  function refreshLockedChips() {
    if (assessment) return;
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
    const complete = assessment ? state.answers.filter(Boolean).length : state.solved.filter(Boolean).length;
    const words = sentenceWords();
    elements.progress.textContent = `${complete} / ${data.sentences.length}`;
    elements.sentenceProgress.textContent = `Sentence ${state.currentIndex + 1} of ${data.sentences.length} · ${words.length} words`;
    elements.submit.disabled = state.submitted || state.submitting || complete < data.sentences.length;
    elements.shuffle.disabled = assessment && (state.submitted || state.submitting);
    elements.prev.disabled = state.submitting || state.currentIndex === 0;
    elements.next.disabled = state.submitting || state.currentIndex >= data.sentences.length - 1;
    renderAssessmentReview();
  }

  function loadPuzzle(index, reshuffle) {
    state.currentIndex = index;
    state.order = assessment
      ? (state.answers[index] || shuffle(sentenceWords())).slice()
      : reshuffle ? shuffle(sentenceWords()) : sentenceWords().slice();
    if (assessment) {
      state.answers[index] = state.order.slice();
      setStatus(state.submitted ? assessmentResult() : 'Arrange every sentence, then submit all answers. No hints are shown before submission.', '');
    }
    if (reshuffle && !assessment) setStatus('Arrange the words, then check your answer.', '');
    renderStage();
    renderProgress();
    saveProgress();
  }

  function syncOrderFromDom() {
    const track = document.getElementById('studentWordTrack');
    if (!track) return;
    state.order = Array.from(track.children).map((chip) => chip.dataset.word);
    if (assessment) {
      state.answers[state.currentIndex] = state.order.slice();
      saveProgress();
    }
    refreshLockedChips();
  }

  function checkAnswers() {
    if (assessment) return;
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

  function isSentenceCorrect(index) {
    const words = data.sentences[index].words;
    const answer = state.answers[index];
    return Boolean(answer && answer.length === words.length && answer.every((word, wordIndex) => normalize(word) === normalize(words[wordIndex])));
  }

  function assessmentResult() {
    const correct = data.sentences.filter((_sentence, index) => isSentenceCorrect(index)).length;
    return `You got ${correct} of ${data.sentences.length} sentences correct.`;
  }

  function renderAssessmentReview() {
    elements.review.hidden = !assessment || !state.submitted;
    elements.reviewList.replaceChildren();
    if (elements.review.hidden) return;
    elements.reviewName.textContent = 'Student / 学生：' + state.studentName;
    elements.reviewScore.textContent = assessmentResult();
    data.sentences.forEach((_sentence, index) => {
      const correct = isSentenceCorrect(index);
      const item = document.createElement('li');
      item.className = correct ? 'is-correct' : 'is-incorrect';
      const heading = document.createElement('strong');
      heading.textContent = `${index + 1}. ${correct ? '✓ Correct / 正确' : '✗ Incorrect / 错误'}`;
      const answer = document.createElement('p');
      answer.textContent = 'Your answer / 你的答案：' + (state.answers[index] || []).join(' ');
      item.append(heading, answer);
      elements.reviewList.append(item);
    });
  }

  async function quizRequest(action, body) {
    const response = await fetch(`/play/${encodeURIComponent(game.shareId)}/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok && !(response.status === 409 && result.submission)) {
      throw new Error(result.error || 'Could not connect. Please try again.');
    }
    return result;
  }

  function applySubmission(submission) {
    state.studentName = submission.studentName;
    state.answers = submission.answers;
    state.submitted = true;
  }

  async function startAssessment(event) {
    event.preventDefault();
    if (!elements.nameInput.reportValidity()) return;
    elements.start.disabled = true;
    elements.nameError.hidden = true;
    try {
      const result = await quizRequest('attempt', { studentName: elements.nameInput.value });
      state.studentName = result.studentName;
      const nameKey = state.studentName.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
      progressKey = `shared-sentence-reorder-progress:${game.shareId}:${nameKey}`;
      Object.assign(state, loadProgress(), { submitted: false });
      if (result.submission) applySubmission(result.submission);
      elements.nameGate.hidden = true;
      elements.puzzleCard.hidden = false;
      loadPuzzle(state.currentIndex, true);
      if (state.submitted) elements.review.scrollIntoView({ block: 'start' });
    } catch (error) {
      elements.nameError.textContent = error.message;
      elements.nameError.hidden = false;
    } finally {
      elements.start.disabled = false;
    }
  }

  async function submitAssessment() {
    if (!assessment || !state.studentName || state.submitted || state.submitting || drag || state.answers.some((answer) => !answer)) return;
    if (!window.confirm('Submit all answers? Each name can submit only once. You cannot change them afterwards.')) return;
    state.submitting = true;
    renderStage();
    renderProgress();
    try {
      const result = await quizRequest('submit', { studentName: state.studentName, answers: state.answers });
      applySubmission(result.submission);
      saveProgress();
      loadPuzzle(state.currentIndex, false);
      elements.completionMessage.textContent = assessmentResult();
      elements.completion.hidden = false;
      elements.closeCompletion.focus();
    } catch (error) {
      setStatus(error.message, 'is-error');
    } finally {
      state.submitting = false;
      renderStage();
      renderProgress();
    }
  }

  function resetProgress() {
    if (assessment) return;
    if (!window.confirm('Clear your answers and start this game again?')) return;
    elements.completion.hidden = true;
    state.currentIndex = 0;
    state.solved = Array(data.sentences.length).fill(false);
    state.answers = Array(data.sentences.length).fill(null);
    state.submitted = false;
    loadPuzzle(0, true);
  }

  function onChipKeyDown(event) {
    const track = document.getElementById('studentWordTrack');
    if (!track) return;
    if (isLockedChip(event.currentTarget) || (assessment && (state.submitted || state.submitting))) return;
    var originalChips = Array.from(track.children);
    var chips = originalChips.filter(function (chip) { return !isLockedChip(chip); });
    var index = chips.indexOf(event.currentTarget);
    var target = event.key === 'ArrowLeft' ? index - 1 : event.key === 'ArrowRight' ? index + 1 : -1;
    if (target < 0 || target >= chips.length) return;
    if (target < index) track.insertBefore(chips[index], chips[target]);
    else track.insertBefore(chips[target], chips[index]);
    restoreLockedPositions(track, originalChips);
    event.currentTarget.focus();
    syncOrderFromDom();
    event.preventDefault();
  }

  function onPointerDown(event) {
    const chip = event.currentTarget;
    if (drag || chip.disabled || isLockedChip(chip)) return;
    drag = {
      chip,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originalChips: Array.from(chip.parentElement.children),
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
      restoreLockedPositions(document.getElementById('studentWordTrack'), drag.originalChips);
      drag.chip.classList.remove('is-dragging');
      drag.chip.removeAttribute('style');
      syncOrderFromDom();
    }
    drag = null;
  }

  elements.check.addEventListener('click', checkAnswers);
  elements.submit.addEventListener('click', submitAssessment);
  elements.shuffle.addEventListener('click', () => {
    if (assessment && state.submitted) return;
    if (assessment) state.answers[state.currentIndex] = null;
    loadPuzzle(state.currentIndex, true);
  });
  elements.prev.addEventListener('click', () => {
    if (state.currentIndex > 0) loadPuzzle(state.currentIndex - 1, true);
  });
  elements.next.addEventListener('click', () => {
    if (state.currentIndex < data.sentences.length - 1) loadPuzzle(state.currentIndex + 1, true);
  });
  elements.reset.addEventListener('click', resetProgress);
  elements.playAgain.addEventListener('click', resetProgress);
  elements.closeCompletion.addEventListener('click', () => {
    elements.completion.hidden = true;
    if (assessment) {
      elements.reviewTitle.focus({ preventScroll: true });
      elements.review.scrollIntoView({ block: 'start' });
    } else {
      elements.check.focus();
    }
  });

  if (assessment) elements.nameForm.addEventListener('submit', startAssessment);
  else loadPuzzle(state.currentIndex, true);
})();
