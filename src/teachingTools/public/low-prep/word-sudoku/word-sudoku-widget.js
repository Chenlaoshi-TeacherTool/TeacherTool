(() => {
  const defaultItems = [
    { word: "前面", icon: "🐧📦", manual: false },
    { word: "后面", icon: "📦🐭", manual: false },
    { word: "上面", icon: "🐟⬆️", manual: false },
    { word: "下面", icon: "🦉⬇️", manual: false },
    { word: "旁边", icon: "🦁📦", manual: false },
    { word: "里面", icon: "📦🦉", manual: false },
    { word: "之间", icon: "↔️", manual: false },
    { word: "近", icon: "📍", manual: false },
    { word: "远", icon: "🔭", manual: false }
  ];

  const iconPalette = [
    "🐼", "🐧", "🦁", "🐭", "🦉", "🐰", "🐶", "🐱", "🐵", "🐟",
    "🍎", "🍌", "🍇", "🍉", "🍓", "🍒", "🍑", "🍊", "🍍", "🥕",
    "📦", "🏠", "🏫", "📚", "✏️", "🎒", "🪑", "🧸", "⚽", "🎵",
    "☀️", "🌧️", "❄️", "🌈", "🌳", "🌸", "🚗", "🚌", "🚲", "✈️",
    "🍚", "🍜", "🥟", "🍞", "🥛", "💧", "🧃", "🎂", "🍦", "🍬",
    "👨", "👩", "👧", "👦", "👶", "👵", "👴", "👨‍🏫", "👩‍🏫", "👨‍👩‍👧",
    "👀", "👂", "👃", "👄", "✋", "🦶", "❤️", "🧠", "🦷", "💪",
    "⬆️", "⬇️", "⬅️", "➡️", "↔️", "📍", "🔭", "🚪", "🗺️", "🧭",
    "🏃", "🚶", "🧘", "💃", "🎨", "📖", "✍️", "👋", "👏", "💬",
    "⭐", "🎯", "🔔", "🎈", "🎁", "💡", "🧩", "🌱", "☂️", "⏰"
  ];

  const iconRules = [
    { words: ["苹果", "apple"], icons: ["🍎", "🍏"] },
    { words: ["香蕉", "banana"], icons: ["🍌"] },
    { words: ["葡萄", "grape"], icons: ["🍇"] },
    { words: ["西瓜", "watermelon"], icons: ["🍉"] },
    { words: ["草莓", "strawberry"], icons: ["🍓"] },
    { words: ["樱桃", "cherry"], icons: ["🍒"] },
    { words: ["桃", "peach"], icons: ["🍑"] },
    { words: ["橙", "桔", "orange"], icons: ["🍊"] },
    { words: ["菠萝", "凤梨", "pineapple"], icons: ["🍍"] },
    { words: ["熊猫", "panda"], icons: ["🐼"] },
    { words: ["企鹅", "penguin"], icons: ["🐧"] },
    { words: ["狮子", "lion"], icons: ["🦁"] },
    { words: ["老鼠", "mouse"], icons: ["🐭"] },
    { words: ["猫头鹰", "owl"], icons: ["🦉"] },
    { words: ["兔", "rabbit"], icons: ["🐰"] },
    { words: ["狗", "dog"], icons: ["🐶"] },
    { words: ["猫", "cat"], icons: ["🐱"] },
    { words: ["猴", "monkey"], icons: ["🐵"] },
    { words: ["鱼", "fish"], icons: ["🐟"] },
    { words: ["前面", "前方", "front"], icons: ["🐧📦", "➡️"] },
    { words: ["后面", "后方", "behind", "back"], icons: ["📦🐭", "⬅️"] },
    { words: ["上面", "上方", "above", "top"], icons: ["🐟⬆️", "⬆️"] },
    { words: ["下面", "下方", "below", "under"], icons: ["🦉⬇️", "⬇️"] },
    { words: ["旁边", "旁", "beside", "next to"], icons: ["🦁📦", "↔️"] },
    { words: ["里面", "内", "inside", "in"], icons: ["📦🦉", "📦"] },
    { words: ["外面", "outside"], icons: ["🚪", "🏠"] },
    { words: ["之间", "between"], icons: ["↔️", "📦🐟📦"] },
    { words: ["附近", "近", "near"], icons: ["📍", "🚶"] },
    { words: ["远", "far"], icons: ["🔭", "🗺️"] },
    { words: ["学校", "教室", "school", "classroom"], icons: ["🏫", "🎒"] },
    { words: ["书", "阅读", "read", "book"], icons: ["📚", "📖"] },
    { words: ["写", "笔", "write", "pencil"], icons: ["✏️", "✍️"] },
    { words: ["老师", "teacher"], icons: ["👩‍🏫", "👨‍🏫"] },
    { words: ["家", "房子", "home", "house"], icons: ["🏠"] },
    { words: ["爸爸", "父亲", "father", "dad"], icons: ["👨"] },
    { words: ["妈妈", "母亲", "mother", "mom"], icons: ["👩"] },
    { words: ["哥哥", "弟弟", "男孩", "boy"], icons: ["👦"] },
    { words: ["姐姐", "妹妹", "女孩", "girl"], icons: ["👧"] },
    { words: ["爷爷", "祖父", "grandpa"], icons: ["👴"] },
    { words: ["奶奶", "祖母", "grandma"], icons: ["👵"] },
    { words: ["眼", "eye"], icons: ["👀"] },
    { words: ["耳", "ear"], icons: ["👂"] },
    { words: ["鼻", "nose"], icons: ["👃"] },
    { words: ["嘴", "mouth"], icons: ["👄"] },
    { words: ["手", "hand"], icons: ["✋"] },
    { words: ["脚", "foot"], icons: ["🦶"] },
    { words: ["太阳", "晴", "sunny", "sun"], icons: ["☀️"] },
    { words: ["雨", "rain"], icons: ["🌧️", "☂️"] },
    { words: ["雪", "snow"], icons: ["❄️"] },
    { words: ["彩虹", "rainbow"], icons: ["🌈"] },
    { words: ["树", "tree"], icons: ["🌳"] },
    { words: ["花", "flower"], icons: ["🌸"] },
    { words: ["汽车", "车", "car"], icons: ["🚗"] },
    { words: ["公交", "巴士", "bus"], icons: ["🚌"] },
    { words: ["自行车", "单车", "bike"], icons: ["🚲"] },
    { words: ["飞机", "airplane"], icons: ["✈️"] },
    { words: ["米饭", "rice"], icons: ["🍚"] },
    { words: ["面条", "noodle"], icons: ["🍜"] },
    { words: ["饺子", "dumpling"], icons: ["🥟"] },
    { words: ["面包", "bread"], icons: ["🍞"] },
    { words: ["牛奶", "milk"], icons: ["🥛"] },
    { words: ["水", "water"], icons: ["💧"] },
    { words: ["生日", "蛋糕", "birthday", "cake"], icons: ["🎂"] },
    { words: ["跑", "run"], icons: ["🏃"] },
    { words: ["走", "walk"], icons: ["🚶"] },
    { words: ["跳舞", "舞", "dance"], icons: ["💃"] },
    { words: ["画", "paint", "draw"], icons: ["🎨"] },
    { words: ["说", "聊天", "speak", "talk"], icons: ["💬"] },
    { words: ["音乐", "唱歌", "music", "sing"], icons: ["🎵"] },
    { words: ["球", "足球", "ball"], icons: ["⚽"] },
    { words: ["时间", "钟", "time", "clock"], icons: ["⏰"] }
  ];

  const difficultyTargets = { easy: 46, medium: 36, hard: 28 };
  const difficultyNames = { easy: "Easy", medium: "Medium", hard: "Hard" };

  const state = {
    items: defaultItems.map((item) => ({ ...item })),
    level: "medium",
    seed: 20260724,
    solution: [],
    puzzle: [],
    clueCount: 36,
    showAnswer: false,
    pickerIndex: null
  };

  const elements = {
    wordGrid: document.getElementById("wordGrid"),
    wordCount: document.getElementById("wordCount"),
    iconPicker: document.getElementById("iconPicker"),
    pickerTitle: document.getElementById("pickerTitle"),
    pickerGrid: document.getElementById("pickerGrid"),
    pickerClose: document.getElementById("pickerClose"),
    customIconInput: document.getElementById("customIconInput"),
    applyCustomIcon: document.getElementById("applyCustomIcon"),
    rematchAll: document.getElementById("rematchAll"),
    matchStatus: document.getElementById("matchStatus"),
    sudoku: document.getElementById("sudoku"),
    screenLegend: document.getElementById("screenLegend"),
    printLegend: document.getElementById("printLegend"),
    difficultyControls: document.getElementById("difficultyControls"),
    clueText: document.getElementById("clueText"),
    readyPill: document.getElementById("readyPill"),
    paperTitle: document.getElementById("paperTitle"),
    answerButton: document.getElementById("answerButton"),
    generateButton: document.getElementById("generateButton"),
    printButton: document.getElementById("printButton"),
    toast: document.getElementById("toast")
  };

  let toastTimer;

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 1900);
  }

  function makeRng(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(values, rng) {
    const copy = values.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = Math.floor(rng() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  function createSolution(rng) {
    const bands = shuffle([0, 1, 2], rng);
    const stacks = shuffle([0, 1, 2], rng);
    const rows = bands.flatMap((band) =>
      shuffle([0, 1, 2], rng).map((row) => band * 3 + row)
    );
    const columns = stacks.flatMap((stack) =>
      shuffle([0, 1, 2], rng).map((column) => stack * 3 + column)
    );
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
    const pattern = (row, column) =>
      (row * 3 + Math.floor(row / 3) + column) % 9;
    return rows.flatMap((row) =>
      columns.map((column) => digits[pattern(row, column)])
    );
  }

  function countSolutions(board, limit = 2) {
    const fullMask = 0x3fe;
    const rowMasks = Array(9).fill(0);
    const columnMasks = Array(9).fill(0);
    const boxMasks = Array(9).fill(0);
    let total = 0;

    for (let index = 0; index < 81; index += 1) {
      const digit = board[index];
      if (!digit) continue;
      const row = Math.floor(index / 9);
      const column = index % 9;
      const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
      const bit = 1 << digit;
      rowMasks[row] |= bit;
      columnMasks[column] |= bit;
      boxMasks[box] |= bit;
    }

    function bitCount(mask) {
      let count = 0;
      let value = mask;
      while (value) {
        value &= value - 1;
        count += 1;
      }
      return count;
    }

    function search() {
      if (total >= limit) return;

      let bestIndex = -1;
      let bestMask = 0;
      let fewest = 10;

      for (let index = 0; index < 81; index += 1) {
        if (board[index]) continue;
        const row = Math.floor(index / 9);
        const column = index % 9;
        const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);
        const mask =
          fullMask & ~(rowMasks[row] | columnMasks[column] | boxMasks[box]);
        const choices = bitCount(mask);
        if (choices === 0) return;
        if (choices < fewest) {
          fewest = choices;
          bestIndex = index;
          bestMask = mask;
          if (choices === 1) break;
        }
      }

      if (bestIndex === -1) {
        total += 1;
        return;
      }

      const row = Math.floor(bestIndex / 9);
      const column = bestIndex % 9;
      const box = Math.floor(row / 3) * 3 + Math.floor(column / 3);

      for (let digit = 1; digit <= 9; digit += 1) {
        const bit = 1 << digit;
        if (!(bestMask & bit)) continue;
        board[bestIndex] = digit;
        rowMasks[row] |= bit;
        columnMasks[column] |= bit;
        boxMasks[box] |= bit;
        search();
        board[bestIndex] = 0;
        rowMasks[row] &= ~bit;
        columnMasks[column] &= ~bit;
        boxMasks[box] &= ~bit;
        if (total >= limit) return;
      }
    }

    search();
    return total;
  }

  function createPuzzle(solution, target, rng) {
    const puzzle = solution.slice();
    const positions = shuffle(
      Array.from({ length: 81 }, (_, index) => index),
      rng
    );
    let clues = 81;

    for (const position of positions) {
      if (clues <= target) break;
      const previous = puzzle[position];
      puzzle[position] = 0;
      if (countSolutions(puzzle.slice(), 2) !== 1) {
        puzzle[position] = previous;
      } else {
        clues -= 1;
      }
    }

    return { puzzle, clues };
  }

  function generatePuzzle({ announce = false } = {}) {
    const rng = makeRng(state.seed);
    state.solution = createSolution(rng);
    const result = createPuzzle(
      state.solution,
      difficultyTargets[state.level],
      rng
    );
    state.puzzle = result.puzzle;
    state.clueCount = result.clues;
    state.showAnswer = false;
    renderPuzzle();
    renderControls();
    if (announce) {
      showToast(`Generated a new ${difficultyNames[state.level]} word sudoku`);
    }
  }

  function normalized(value) {
    return value.trim().toLocaleLowerCase();
  }

  function validWords() {
    const words = state.items.map((item) => normalized(item.word));
    return words.every(Boolean) && new Set(words).size === 9;
  }

  function suggestIcon(word, index, items = state.items) {
    const value = normalized(word);
    const match = iconRules.find((rule) =>
      rule.words.some((keyword) => value.includes(keyword))
    );
    const used = new Set(
      items
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item) => item.icon)
    );
    const candidates = match
      ? match.icons.concat(iconPalette)
      : iconPalette.slice(index).concat(iconPalette.slice(0, index));
    return (
      candidates.find((icon) => !used.has(icon)) ||
      iconPalette[index % iconPalette.length]
    );
  }

  function renderInputs() {
    elements.wordGrid.replaceChildren();

    state.items.forEach((item, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "word-item";

      const number = document.createElement("span");
      number.className = "item-number";
      number.textContent = String(index + 1);

      const iconButton = document.createElement("button");
      iconButton.type = "button";
      iconButton.className = "picture-box";
      iconButton.textContent = item.icon;
      iconButton.title = `Change the icon for "${item.word || `word ${index + 1}`}"`;
      iconButton.setAttribute("aria-label", iconButton.title);
      iconButton.addEventListener("click", () => openPicker(index));

      const input = document.createElement("input");
      input.type = "text";
      input.className = "word-input";
      input.maxLength = 12;
      input.value = item.word;
      input.placeholder = `Word ${index + 1}`;
      input.setAttribute("aria-label", `Word ${index + 1}`);
      input.addEventListener("input", (event) => {
        state.items[index].word = event.target.value;
        if (!state.items[index].manual) {
          state.items[index].icon = suggestIcon(event.target.value, index);
          iconButton.textContent = state.items[index].icon;
        }
        updateValidation();
        renderLegends();
        renderPuzzle();
      });

      wrapper.append(number, iconButton, input);
      elements.wordGrid.append(wrapper);
    });

    updateValidation();
  }

  function openPicker(index) {
    state.pickerIndex = index;
    const item = state.items[index];
    elements.pickerTitle.textContent =
      `Choose an icon for "${item.word || `word ${index + 1}`}"`;
    elements.customIconInput.value = item.icon;
    elements.iconPicker.hidden = false;
    renderPickerOptions();
    elements.iconPicker.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function closePicker() {
    state.pickerIndex = null;
    elements.iconPicker.hidden = true;
  }

  function renderPickerOptions() {
    elements.pickerGrid.replaceChildren();
    iconPalette.forEach((icon) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "picker-option";
      if (
        state.pickerIndex !== null &&
        state.items[state.pickerIndex].icon === icon
      ) {
        button.classList.add("selected");
      }
      button.textContent = icon;
      button.setAttribute("aria-label", `Choose icon ${icon}`);
      button.addEventListener("click", () => applyIcon(icon));
      elements.pickerGrid.append(button);
    });
  }

  function applyIcon(icon) {
    const cleanIcon = icon.trim();
    if (state.pickerIndex === null || !cleanIcon) return;
    state.items[state.pickerIndex].icon = cleanIcon;
    state.items[state.pickerIndex].manual = true;
    renderInputs();
    renderLegends();
    renderPuzzle();
    closePicker();
    showToast("Icon updated");
  }

  function rematchAll() {
    state.items.forEach((item, index) => {
      item.manual = false;
      item.icon = suggestIcon(item.word, index);
    });
    renderInputs();
    renderLegends();
    renderPuzzle();
    closePicker();
    showToast("Icons re-matched based on the words");
  }

  function updateValidation() {
    const completed = state.items.filter((item) =>
      normalized(item.word)
    ).length;
    const isValid = validWords();
    elements.wordCount.textContent = isValid
      ? "9/9 complete"
      : `${completed}/9 filled in`;
    elements.wordCount.classList.toggle("warning", !isValid);
    elements.matchStatus.textContent = isValid
      ? "Auto-matching complete"
      : "Please enter 9 different words";
    elements.readyPill.textContent = isValid
      ? "✓ Layout Ready"
      : "Please check your words";
    elements.printButton.disabled = !isValid;
    elements.generateButton.disabled = !isValid;
  }

  function makeLegendItem(item) {
    const wrapper = document.createElement("div");
    wrapper.className = "legend-item";
    const icon = document.createElement("span");
    icon.className = "legend-emoji";
    icon.textContent = item.icon;
    const word = document.createElement("span");
    word.className = "legend-word";
    word.textContent = item.word || "Not filled in";
    wrapper.append(icon, word);
    return wrapper;
  }

  function renderLegends() {
    elements.screenLegend.replaceChildren();
    elements.printLegend.replaceChildren();
    state.items.forEach((item) => {
      elements.screenLegend.append(makeLegendItem(item));
      elements.printLegend.append(makeLegendItem(item));
    });
  }

  function renderPuzzle() {
    elements.sudoku.replaceChildren();
    const board = state.showAnswer ? state.solution : state.puzzle;

    board.forEach((digit, index) => {
      const cell = document.createElement("div");
      const row = Math.floor(index / 9);
      const column = index % 9;
      cell.className = "cell";
      if (column === 2 || column === 5) cell.classList.add("block-right");
      if (column === 8) cell.classList.add("last-column");
      if (row === 2 || row === 5) cell.classList.add("block-bottom");
      if (row === 8) cell.classList.add("last-row");

      const wasBlank = state.puzzle[index] === 0;
      if (state.showAnswer && wasBlank) cell.classList.add("answer");

      if (digit) {
        const item = state.items[digit - 1];
        const usePicture = ((index * 17 + state.seed) % 7) < 3;
        cell.textContent = usePicture ? item.icon : (item.word || `Word ${digit}`);
        if (usePicture) cell.classList.add("picture");
      }

      elements.sudoku.append(cell);
    });

    elements.paperTitle.textContent = state.showAnswer
      ? "Word Sudoku (Answer)"
      : "Word Sudoku";
  }

  function renderControls() {
    elements.difficultyControls
      .querySelectorAll("button")
      .forEach((button) => {
        const active = button.dataset.level === state.level;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    elements.clueText.textContent =
      `Currently keeping ${state.clueCount} hint cells`;
    elements.answerButton.innerHTML = state.showAnswer
      ? '<span aria-hidden="true">□</span> Back to Puzzle'
      : '<span aria-hidden="true">✓</span> Show Answer';
  }

  elements.pickerClose.addEventListener("click", closePicker);
  elements.applyCustomIcon.addEventListener("click", () =>
    applyIcon(elements.customIconInput.value)
  );
  elements.customIconInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      applyIcon(elements.customIconInput.value);
    }
  });
  elements.rematchAll.addEventListener("click", rematchAll);

  elements.difficultyControls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-level]");
    if (!button || button.dataset.level === state.level) return;
    state.level = button.dataset.level;
    state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
    generatePuzzle({ announce: true });
  });

  elements.generateButton.addEventListener("click", () => {
    state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
    generatePuzzle({ announce: true });
  });

  elements.answerButton.addEventListener("click", () => {
    state.showAnswer = !state.showAnswer;
    renderPuzzle();
    renderControls();
  });

  elements.printButton.addEventListener("click", () => {
    if (!validWords()) {
      showToast("Please enter 9 different words first");
      return;
    }
    window.print();
  });

  renderInputs();
  renderLegends();
  generatePuzzle();
})();
