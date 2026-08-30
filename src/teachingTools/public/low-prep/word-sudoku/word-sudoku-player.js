(() => {
  'use strict';

  const game = window.__SHARED_GAME__;
  if (!game || !game.data) return;

  const data = game.data;
  const progressKey = `shared-game-progress:${game.shareId}`;
  const blankIndexes = data.puzzle
    .map((cell, index) => (cell === 0 ? index : -1))
    .filter((index) => index !== -1);
  let selectedIndex = blankIndexes[0] ?? null;
  let entries = loadProgress();
  let checked = false;

  const elements = {
    grid: document.getElementById('studentSudoku'),
    choices: document.getElementById('answerChoices'),
    progress: document.getElementById('progressCount'),
    status: document.getElementById('gameStatus'),
    clear: document.getElementById('clearCellButton'),
    check: document.getElementById('checkButton'),
    reset: document.getElementById('resetButton'),
    completion: document.getElementById('completionPanel'),
    closeCompletion: document.getElementById('closeCompletionButton')
  };

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey));
      if (!Array.isArray(saved) || saved.length !== 81) throw new Error('Invalid progress');
      return saved.map((value, index) => {
        if (data.puzzle[index]) return 0;
        return Number.isInteger(value) && value >= 0 && value <= 9 ? value : 0;
      });
    } catch (_error) {
      return Array(81).fill(0);
    }
  }

  function saveProgress() {
    try { localStorage.setItem(progressKey, JSON.stringify(entries)); } catch (_error) { /* Storage may be disabled. */ }
  }

  function cellClasses(index, editable) {
    const row = Math.floor(index / 9);
    const column = index % 9;
    const classes = ['student-cell'];
    if (column === 2 || column === 5) classes.push('block-right');
    if (column === 8) classes.push('last-column');
    if (row === 2 || row === 5) classes.push('block-bottom');
    if (row === 8) classes.push('last-row');
    classes.push(editable ? 'editable' : 'given');
    return classes;
  }

  function displayValue(digit, index, given) {
    if (!digit) return '';
    const item = data.items[digit - 1];
    const usePicture = given && ((index * 17 + data.seed) % 7) < 3 && item.icon;
    return usePicture ? item.icon : item.word;
  }

  function renderGrid() {
    elements.grid.replaceChildren();
    data.puzzle.forEach((given, index) => {
      const editable = given === 0;
      const cell = document.createElement(editable ? 'button' : 'div');
      cell.className = cellClasses(index, editable).join(' ');
      cell.setAttribute('role', 'gridcell');

      if (editable) {
        cell.type = 'button';
        const answer = entries[index];
        cell.textContent = displayValue(answer, index, false);
        cell.setAttribute('aria-label', `Row ${Math.floor(index / 9) + 1}, column ${index % 9 + 1}${answer ? `: ${data.items[answer - 1].word}` : ': empty'}`);
        if (index === selectedIndex) cell.classList.add('selected');
        if (checked && answer) cell.classList.add(answer === data.solution[index] ? 'correct' : 'incorrect');
        cell.addEventListener('click', () => selectCell(index));
      } else {
        const item = data.items[given - 1];
        const usePicture = ((index * 17 + data.seed) % 7) < 3 && item.icon;
        cell.textContent = displayValue(given, index, true);
        cell.setAttribute('aria-label', `Given: ${item.word}`);
        if (usePicture) cell.classList.add('is-picture');
      }
      elements.grid.append(cell);
    });
  }

  function renderChoices() {
    elements.choices.replaceChildren();
    data.items.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sudoku-choice';
      button.disabled = selectedIndex === null;
      button.innerHTML = `<span class="sudoku-choice-icon"></span><span class="sudoku-choice-word"></span>`;
      button.querySelector('.sudoku-choice-icon').textContent = item.icon || String(index + 1);
      button.querySelector('.sudoku-choice-word').textContent = item.word;
      button.setAttribute('aria-label', `Put ${item.word} in the selected square`);
      button.addEventListener('click', () => enterValue(index + 1));
      elements.choices.append(button);
    });
  }

  function updateProgress() {
    const filled = blankIndexes.filter((index) => entries[index]).length;
    elements.progress.textContent = `${filled} / ${blankIndexes.length}`;
    elements.clear.disabled = selectedIndex === null || !entries[selectedIndex];
  }

  function selectCell(index) {
    selectedIndex = index;
    checked = false;
    setStatus('Choose a word from the word bank.', '');
    renderGrid();
    renderChoices();
    updateProgress();
  }

  function enterValue(value) {
    if (selectedIndex === null) return;
    entries[selectedIndex] = value;
    checked = false;
    saveProgress();
    const currentPosition = blankIndexes.indexOf(selectedIndex);
    const nextEmpty = blankIndexes.slice(currentPosition + 1).concat(blankIndexes.slice(0, currentPosition))
      .find((index) => !entries[index]);
    if (nextEmpty !== undefined) selectedIndex = nextEmpty;
    renderAll();
  }

  function clearSelected() {
    if (selectedIndex === null) return;
    entries[selectedIndex] = 0;
    checked = false;
    saveProgress();
    renderAll();
  }

  function setStatus(message, className) {
    elements.status.textContent = message;
    elements.status.className = `sudoku-status${className ? ` ${className}` : ''}`;
  }

  function checkAnswers() {
    checked = true;
    const remaining = blankIndexes.filter((index) => !entries[index]).length;
    const incorrect = blankIndexes.filter((index) => entries[index] && entries[index] !== data.solution[index]).length;
    renderGrid();
    if (remaining) {
      setStatus(`${remaining} square${remaining === 1 ? '' : 's'} still need an answer.`, 'is-error');
    } else if (incorrect) {
      setStatus(`${incorrect} answer${incorrect === 1 ? '' : 's'} need another look.`, 'is-error');
    } else {
      selectedIndex = null;
      setStatus('Everything is correct. Puzzle complete!', 'is-success');
      elements.completion.hidden = false;
      elements.closeCompletion.focus();
      renderChoices();
    }
  }

  function resetProgress() {
    if (!window.confirm('Clear every answer and start this puzzle again?')) return;
    entries = Array(81).fill(0);
    selectedIndex = blankIndexes[0] ?? null;
    checked = false;
    saveProgress();
    setStatus('Your progress has been reset.', '');
    renderAll();
  }

  function renderAll() {
    renderGrid();
    renderChoices();
    updateProgress();
  }

  elements.clear.addEventListener('click', clearSelected);
  elements.check.addEventListener('click', checkAnswers);
  elements.reset.addEventListener('click', resetProgress);
  elements.closeCompletion.addEventListener('click', () => {
    elements.completion.hidden = true;
    elements.check.focus();
  });
  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Backspace' || event.key === 'Delete') && selectedIndex !== null) {
      event.preventDefault();
      clearSelected();
    }
    const digit = Number(event.key);
    if (digit >= 1 && digit <= 9 && selectedIndex !== null) enterValue(digit);
  });

  renderAll();
})();
