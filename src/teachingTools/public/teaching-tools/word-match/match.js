(() => {
  const element = id => document.getElementById(id);
  const copy = (zh, en) => document.documentElement.lang === 'zh' ? zh : en;
  const mode = element('mode');
  const words = element('words');
  const custom = element('custom');
  const board = element('board');
  const answer = element('answer');
  const again = element('again');
  const applause = element('applause');
  const confetti = element('confetti');
  const vocabularyDefault = words.value;
  let vocabulary = vocabularyDefault;
  let customPairs = '一只 | 小猫\n打开 | 书包';
  let editingCustom = false;
  let roundPairs = [];
  let remaining = [];
  let selected;
  let feedbackTimer;

  function preparePairs() {
    const pairs = [];
    const skipped = [];
    words.value.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      const [zh, py, en] = line.split(/[|\t]/).map(value => value.trim().normalize('NFC'));
      if (editingCustom && zh && py) {
        pairs.push([zh, py, zh + ' ' + py]);
      } else if (!editingCustom && mode.value === 'word' && /^\p{Script=Han}{2}$/u.test(zh)) {
        pairs.push([...zh, zh]);
      } else if (mode.value !== 'word' && zh && (mode.value === 'py' ? py : en)) {
        const translation = mode.value === 'py' ? py : en;
        pairs.push([zh, translation, zh + ' · ' + translation]);
      } else {
        skipped.push(index + 1);
      }
    });
    return { pairs: pairs.slice(0, Number(element('limit').value)), skipped };
  }

  function updatePreview() {
    element('custom-label').hidden = mode.value !== 'word';
    const useCustom = mode.value === 'word' && custom.checked;
    if (useCustom !== editingCustom) {
      if (editingCustom) customPairs = words.value;
      else vocabulary = words.value;
      words.value = useCustom ? customPairs : vocabulary;
      editingCustom = useCustom;
    }
    element('format').textContent = editingCustom
      ? copy('每行填「左卡 | 右卡」，例如「一只 | 小猫」。', 'Enter left card | right card on each line.')
      : copy('每行填「中文 | 拼音 | 英文」，用 Tab 或 | 分列。组词模式只取双字词。', 'Enter Chinese | Pinyin | English on each line. Use Tab or |. Build-a-word uses two-character words.');
    const { pairs, skipped } = preparePairs();
    const messages = [copy(`本局 ${pairs.length} 对。`, `${pairs.length} pairs this round.`)];
    if (skipped.length) {
      const lines = skipped.join(', ');
      messages.push(copy(`第 ${lines} 行不符合当前模式，已跳过。`, `Skipped lines ${lines} because they do not fit this mode.`));
    }
    if (mode.value === 'word') {
      const cards = pairs.flatMap(([left, right]) => [left, right]);
      const repeats = [...new Set(cards.filter((card, index) => cards.indexOf(card) !== index))];
      if (repeats.length) {
        messages.push(copy(`有重复卡面（${repeats.join('、')}），请核对组词搭配。`, `Repeated cards (${repeats.join(', ')}). Check the intended combinations.`));
      }
    }
    element('preview').textContent = messages.join(' ');
    return pairs;
  }

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function updateProgress() {
    const count = roundPairs.length - remaining.length;
    element('progress').textContent = copy(`已配 ${count} / ${roundPairs.length} 对`, `${count} / ${roundPairs.length} matched`);
  }

  function choose(card) {
    if (feedbackTimer) return;
    if (!selected || selected === card) {
      selected = selected === card ? null : card;
      card.setAttribute('aria-pressed', String(Boolean(selected)));
      return;
    }

    const first = selected;
    const mixed = mode.value === 'word';
    const left = mixed || first.dataset.side === 'left' ? first : card;
    const right = left === first ? card : first;
    const index = remaining.findIndex(([a, b]) =>
      (mixed || left.dataset.side !== right.dataset.side) &&
      ((a === left.textContent && b === right.textContent) ||
        (mixed && b === left.textContent && a === right.textContent)));
    const matched = index >= 0;
    const [pair] = matched ? remaining.splice(index, 1) : [];
    const state = matched ? 'correct' : 'incorrect';
    first.classList.add(state);
    card.classList.add(state);
    answer.textContent = matched ? pair[2] : copy('再试一次', 'Try again');
    if (matched) updateProgress();

    feedbackTimer = setTimeout(() => {
      feedbackTimer = null;
      const moveFocus = matched && [first, card].includes(document.activeElement);
      for (const button of [first, card]) {
        button.classList.remove(state);
        button.setAttribute('aria-pressed', 'false');
        if (matched) {
          button.classList.add('cleared');
          button.disabled = true;
        }
      }
      selected = null;
      if (!remaining.length) {
        answer.textContent = copy('全部配对完成！', 'All pairs matched!');
        board.hidden = true;
        element('prompt').hidden = true;
        applause.hidden = false;
        confetti.hidden = false;
        for (let i = 0; i < 24; i++) {
          const piece = document.createElement('span');
          piece.style.setProperty('--left', (i + 0.5) * 100 / 24 + '%');
          piece.style.setProperty('--delay', (i % 5) * 80 + 'ms');
          piece.style.setProperty('--drift', (i % 2 ? 1 : -1) * (24 + i % 4 * 12) + 'px');
          confetti.append(piece);
        }
        again.hidden = false;
        again.focus();
      } else if (moveFocus) {
        board.querySelector('button:not(.cleared)').focus();
      }
    }, matched ? 950 : 350);
  }

  function startRound() {
    selected = null;
    remaining = [...roundPairs];
    answer.textContent = '';
    again.hidden = true;
    applause.hidden = true;
    confetti.hidden = true;
    confetti.replaceChildren();
    board.hidden = false;
    updateProgress();
    const mixed = mode.value === 'word';
    const left = roundPairs.map(([label]) => ({ label, side: 'left' }));
    const right = roundPairs.map(([, label]) => ({ label, side: 'right' }));
    const groups = mixed ? [shuffle([...left, ...right])] : [shuffle(left), shuffle(right)];
    board.className = mixed ? 'mixed' : 'split';
    board.replaceChildren();
    for (const [index, cards] of groups.entries()) {
      const group = document.createElement('div');
      group.className = 'cards';
      if (!mixed) {
        const title = document.createElement('h2');
        title.textContent = index === 0 ? copy('汉字', 'Chinese') :
          mode.value === 'py' ? copy('拼音', 'Pinyin') : copy('英文', 'English');
        group.append(title);
      }
      for (const { label, side } of cards) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'card';
        button.dataset.side = side;
        button.lang = mixed || side === 'left' ? 'zh' : mode.value === 'py' ? 'zh-Latn' : 'en';
        button.setAttribute('aria-pressed', 'false');
        button.textContent = label;
        button.addEventListener('click', () => choose(button));
        group.append(button);
      }
      board.append(group);
    }
    element('setup').hidden = true;
    element('play').hidden = false;
    const prompt = element('prompt');
    prompt.hidden = false;
    prompt.textContent = mixed
      ? editingCustom ? copy('找出能搭配的两张卡', 'Find two cards that go together') : copy('找出能组成词语的两个字', 'Find two characters that form a word')
      : copy('从左右两边各选一张卡', 'Pick one card from each side');
    prompt.focus();
  }

  for (const field of [mode, custom, element('limit')]) field.addEventListener('change', updatePreview);
  words.addEventListener('input', updatePreview);
  element('settings').addEventListener('submit', event => {
    event.preventDefault();
    roundPairs = updatePreview();
    if (!roundPairs.length) {
      element('preview').textContent += copy(' 请先输入至少一对有效卡片。', ' Enter at least one valid pair to play.');
      words.focus();
      return;
    }
    startRound();
  });
  again.addEventListener('click', startRound);
  element('settings-back').addEventListener('click', () => {
    clearTimeout(feedbackTimer);
    feedbackTimer = null;
    element('play').hidden = true;
    element('setup').hidden = false;
    mode.focus();
  });
  const fullscreen = element('fullscreen');
  fullscreen.hidden = !document.fullscreenEnabled;
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await element('word-match').requestFullscreen();
    } catch {
      fullscreen.hidden = true;
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    fullscreen.setAttribute('aria-pressed', String(active));
    fullscreen.textContent = active ? copy('退出全屏', 'Exit fullscreen') : copy('全屏', 'Fullscreen');
  });
  updatePreview();
})();
