(() => {
  const defaultItems = [
    { word: "apple", icon: "🍎", manual: false },
    { word: "banana", icon: "🍌", manual: false },
    { word: "grape", icon: "🍇", manual: false },
    { word: "watermelon", icon: "🍉", manual: false },
    { word: "strawberry", icon: "🍓", manual: false },
    { word: "cherry", icon: "🍒", manual: false },
    { word: "peach", icon: "🍑", manual: false },
    { word: "orange", icon: "🍊", manual: false },
    { word: "pineapple", icon: "🍍", manual: false }
  ];

  const iconPalette = [
    "🐼", "🐧", "🦁", "🐭", "🦉", "🐰", "🐶", "🐱", "🐵", "🐟",
    "🍎", "🍌", "🍇", "🍉", "🍓", "🍒", "🍑", "🍊", "🍍", "🍐", "🥕",
    "📦", "🏠", "🏫", "📚", "✏️", "🎒", "🪑", "🧸", "⚽", "🎵",
    "☀️", "🌧️", "❄️", "🌈", "🌳", "🌸", "🚗", "🚌", "🚲", "✈️",
    "🍚", "🍜", "🥟", "🍞", "🥛", "💧", "🧃", "🎂", "🍦", "🍬",
    "👨", "👩", "👧", "👦", "👶", "👵", "👴", "👨‍🏫", "👩‍🏫", "👨‍👩‍👧",
    "👀", "👂", "👃", "👄", "✋", "🦶", "❤️", "🧠", "🦷", "💪",
    "⬆️", "⬇️", "⬅️", "➡️", "↔️", "📍", "🔭", "🚪", "🗺️", "🧭",
    "🏃", "🚶", "🧘", "💃", "🎨", "📖", "✍️", "👋", "👏", "💬",
    "⭐", "🎯", "🔔", "🎈", "🎁", "💡", "🧩", "🌱", "☂️", "⏰"
  ];

  // Prefer clear classroom-friendly pictures for common vocabulary before
  // falling back to the wider OpenMoji search results.
  const preferredIconsByTerm = {
    "你好": ["👋"], hello: ["👋"], "谢谢": ["🙏"], "thank you": ["🙏"],
    "再见": ["👋", "🚪"], goodbye: ["👋", "🚪"], "老师": ["👩‍🏫"], teacher: ["👩‍🏫"],
    "学生": ["🧑‍🎓"], student: ["🧑‍🎓"], "朋友": ["🧑‍🤝‍🧑"], friend: ["🧑‍🤝‍🧑"],
    "人": ["🧑"], person: ["🧑"], "喜欢": ["❤️"], like: ["❤️"],
    "苹果": ["🍎"], apple: ["🍎"], "香蕉": ["🍌"], banana: ["🍌"],
    "草莓": ["🍓"], strawberry: ["🍓"], "西瓜": ["🍉"], watermelon: ["🍉"],
    "葡萄": ["🍇"], grape: ["🍇"], grapes: ["🍇"], "橘子": ["🍊"], orange: ["🍊"],
    "梨": ["🍐"], pear: ["🍐"], "桃子": ["🍑"], peach: ["🍑"],
    "米饭": ["🍚"], rice: ["🍚"], "面条": ["🍜"], noodles: ["🍜"],
    "饺子": ["🥟"], dumpling: ["🥟"], dumplings: ["🥟"], "水": ["💧"], water: ["💧"],
    "果汁": ["🧃"], juice: ["🧃"], "茶": ["🍵"], tea: ["🍵"],
    "书": ["📖"], book: ["📖"], "本子": ["📓"], notebook: ["📓"],
    "铅笔": ["✏️"], pencil: ["✏️"], "橡皮": ["🧽"], eraser: ["🧽"],
    "尺子": ["📏"], ruler: ["📏"], "桌子": ["🪑"], desk: ["🪑"],
    "椅子": ["💺"], chair: ["💺"], "黑板": ["⬛"], blackboard: ["⬛"],
    "请坐": ["🪑"], "sit down": ["🪑"], "请听": ["👂"], listen: ["👂"],
    "请说": ["💬"], speak: ["💬"], "请看": ["👀"], look: ["👀"],
    "请读": ["📖"], read: ["📖"], "请写": ["✍️"], write: ["✍️"],
    "头": ["👤"], head: ["👤"], "眼睛": ["👀"], eye: ["👀"], eyes: ["👀"],
    "耳朵": ["👂"], ear: ["👂"], ears: ["👂"], "鼻子": ["👃"], nose: ["👃"],
    "嘴": ["👄"], mouth: ["👄"], "牙": ["🦷"], tooth: ["🦷"], teeth: ["🦷"],
    "手": ["✋"], hand: ["✋"], "脚": ["🦶"], foot: ["🦶"], "腿": ["🦵"], leg: ["🦵"],
    "天气": ["🌦️"], weather: ["🌦️"], "太阳": ["☀️"], sun: ["☀️"],
    "云": ["☁️"], cloud: ["☁️"], "雨": ["🌧️"], rain: ["🌧️"],
    "雪": ["❄️"], snow: ["❄️"], "风": ["💨"], wind: ["💨"],
    "热": ["🔥"], hot: ["🔥"], "冷": ["🥶"], cold: ["🥶"],
    "春天": ["🌸"], spring: ["🌸"], "夏天": ["🏖️", "☀️"], summer: ["🏖️", "☀️"],
    "秋天": ["🍂"], autumn: ["🍂"], fall: ["🍂"], "冬天": ["⛄", "❄️"], winter: ["⛄", "❄️"],
    "一": ["1️⃣"], one: ["1️⃣"], "二": ["2️⃣"], two: ["2️⃣"],
    "三": ["3️⃣"], three: ["3️⃣"], "四": ["4️⃣"], four: ["4️⃣"],
    "五": ["5️⃣"], five: ["5️⃣"], "六": ["6️⃣"], six: ["6️⃣"],
    "七": ["7️⃣"], seven: ["7️⃣"], "八": ["8️⃣"], eight: ["8️⃣"],
    "九": ["9️⃣"], nine: ["9️⃣"], "十": ["🔟"], ten: ["🔟"]
  };

  // Emoji 由通用模块 ChenEmoji（/shared/emoji-core.js）提供：搜索、自动匹配、显示都用 OpenMoji。
  const CE = window.ChenEmoji;
  let emojiIndex = null;

  const difficultyTargets = { easy: 46, medium: 36, hard: 28 };
  const difficultyNames = { easy: "Easy", medium: "Medium", hard: "Hard" };

  const state = {
    items: defaultItems.map((item) => ({ ...item })),
    title: "Word Sudoku",
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
    toggleTopicLibrary: document.getElementById("toggleTopicLibrary"),
    topicLibraryPanel: document.getElementById("topicLibraryPanel"),
    sudokuLibraryPicker: document.getElementById("sudokuLibraryPicker"),
    iconPicker: document.getElementById("iconPicker"),
    pickerTitle: document.getElementById("pickerTitle"),
    pickerGrid: document.getElementById("pickerGrid"),
    pickerClose: document.getElementById("pickerClose"),
    emojiSearchInput: document.getElementById("emojiSearchInput"),
    emojiSearchStatus: document.getElementById("emojiSearchStatus"),
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
    shareButton: document.getElementById("shareButton"),
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

  function setTopicLibraryExpanded(expanded) {
    elements.toggleTopicLibrary.setAttribute("aria-expanded", String(Boolean(expanded)));
    elements.topicLibraryPanel.hidden = !expanded;
  }

  function balancedTopicEntries(lists, limit = 9) {
    const entries = [];
    const seen = new Set();
    const queues = lists.map((list) => (list.items || []).slice());
    const positions = queues.map(() => 0);
    let foundCandidate = true;

    // Take one term from each selected topic in turn. With two topics this
    // produces a 5/4 split; with three topics it produces a 3/3/3 split.
    while (entries.length < limit && foundCandidate) {
      foundCandidate = false;
      for (let listIndex = 0; listIndex < queues.length && entries.length < limit; listIndex += 1) {
        const queue = queues[listIndex];
        while (positions[listIndex] < queue.length) {
          const item = queue[positions[listIndex]] || {};
          positions[listIndex] += 1;
          foundCandidate = true;
          const word = item.zh || item.en || item.py;
          const key = normalized(word || "");
          if (!key || seen.has(key)) continue;
          seen.add(key);
          entries.push({
            word,
            zh: item.zh || "",
            en: item.en || "",
            py: item.py || "",
            theme: item.theme || lists[listIndex].theme || "",
            icon: item.emoji || (item.openmoji && item.openmoji.emoji) || "",
            manual: Boolean(item.emoji || (item.openmoji && item.openmoji.emoji))
          });
          break;
        }
      }
    }
    return entries;
  }

  async function useSelectedTopics(lists) {
    const entries = balancedTopicEntries(lists);
    if (entries.length < 9) {
      showToast("Choose topics with at least 9 combined terms");
      return;
    }

    // Do not lock in random fallback icons just because the OpenMoji index is
    // still loading. Wait briefly for the same shared load promise instead.
    if (CE && !emojiIndex) {
      showToast("Matching the selected words with pictures…");
      try {
        emojiIndex = await CE.load();
      } catch (_error) {
        // The curated fallback palette still keeps the activity usable offline.
      }
    }

    const nextItems = entries.map((item) => ({ ...item }));
    autoMatchItems(nextItems);
    state.items = nextItems;
    state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
    state.title = `${lists.map((list) => list.theme || list.name).join(" · ")} Word Sudoku`;
    closePicker();
    renderInputs();
    renderLegends();
    generatePuzzle();
    showToast(`Loaded 9 terms from ${lists.length} selected topic${lists.length === 1 ? "" : "s"}`);
    setTopicLibraryExpanded(false);
  }

  function initLibraryPicker() {
    if (!window.ChenLibraryPicker) return;
    const picker = ChenLibraryPicker.create({
      root: elements.sudokuLibraryPicker,
      source: "wordlists",
      min: 1,
      max: 6,
      title: "Create a Sudoku from published vocabulary topics",
      hint: "Choose one or more topics. Nine terms are shared as evenly as possible across your selections and automatically matched with icons.",
      importLabel: "Use selected topics",
      onImport: (lists) => {
        useSelectedTopics(lists).then(() => picker.reset());
      }
    });
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

  function semanticQueries(item) {
    const values = [item.en, item.zh, item.word];
    const seen = new Set();
    const queries = [];
    values.forEach((value) => {
      String(value || "").split(/[;,/]+/).forEach((part) => {
        const query = part.trim();
        const key = normalized(query);
        if (!key || seen.has(key)) return;
        seen.add(key);
        queries.push(query);
      });
    });
    return queries;
  }

  function preferredIconCandidates(item) {
    const colorIcons = {
      red: "🔴", yellow: "🟡", blue: "🔵", green: "🟢", black: "⚫",
      white: "⚪", purple: "🟣", orange: "🟠", brown: "🟤", pink: "🩷"
    };
    if (normalized(item.theme || "").includes("color")) {
      const color = semanticQueries(item)
        .map((query) => colorIcons[normalized(query)])
        .find(Boolean);
      if (color) return [color];
    }
    return semanticQueries(item).flatMap((query) =>
      preferredIconsByTerm[normalized(query)] || []
    );
  }

  function suggestIcon(itemOrWord, index, items = state.items) {
    const item = typeof itemOrWord === "string"
      ? { word: itemOrWord }
      : (itemOrWord || {});
    const value = normalized(item.word || item.zh || item.en || "");
    const used = new Set(
      items
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item) => item.icon)
        .filter(Boolean)
    );

    const preferred = preferredIconCandidates(item).find((icon) => !used.has(icon));
    if (preferred) return preferred;

    // First use the strict matcher with the list's English definition. It is
    // much more reliable than searching only the displayed Chinese word.
    if (CE && emojiIndex && value) {
      const exact = CE.match({
        zh: item.zh || (/[一-鿿]/.test(item.word || "") ? item.word : ""),
        en: item.en || (!/[一-鿿]/.test(item.word || "") ? item.word : "")
      }, emojiIndex, { translate: true });
      if (exact && !used.has(exact.emoji)) return exact.emoji;

      const queries = semanticQueries(item);
      for (let queryIndex = 0; queryIndex < queries.length; queryIndex += 1) {
        const results = CE.search(queries[queryIndex], emojiIndex, { limit: 40 });
        const pick = results.find((entry) => !used.has(entry.emoji));
        if (pick) return pick.emoji;
      }
    }
    // 兜底（索引未就绪或没搜到）：从精选调色板里轮流取一个没被占用的。
    const candidates = iconPalette.slice(index).concat(iconPalette.slice(0, index));
    return (
      candidates.find((icon) => !used.has(icon)) ||
      iconPalette[index % iconPalette.length]
    );
  }

  function autoMatchItems(items) {
    items.forEach((item) => {
      if (!item.manual) item.icon = "";
    });
    items.forEach((item, index) => {
      if (!item.manual) item.icon = suggestIcon(item, index, items);
    });
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
        state.items[index].zh = "";
        state.items[index].en = "";
        state.items[index].py = "";
        if (!state.items[index].manual) {
          state.items[index].icon = suggestIcon(state.items[index], index);
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
    renderEmojiArt(elements.wordGrid);
  }

  function openPicker(index) {
    state.pickerIndex = index;
    const item = state.items[index];
    elements.pickerTitle.textContent =
      `Choose an icon for "${item.word || `word ${index + 1}`}"`;
    elements.customIconInput.value = item.icon;
    elements.emojiSearchInput.value = "";
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
    const raw = elements.emojiSearchInput.value.trim();
    const query = normalized(raw);

    let matches;
    if (!query) {
      // 空查询：展示精选的课堂常用 emoji 作为起点。
      matches = iconPalette.slice();
      elements.emojiSearchStatus.textContent =
        "Search in English or Chinese to find a classroom-ready emoji.";
    } else if (CE && emojiIndex) {
      // 有查询：搜整个 OpenMoji 库（中文自动翻译）。
      matches = CE.search(raw, emojiIndex, { limit: 80 }).map((entry) => entry.emoji);
      elements.emojiSearchStatus.textContent =
        `${matches.length} OpenMoji result${matches.length === 1 ? "" : "s"} for “${raw}”`;
    } else {
      // 索引还没加载好：先在精选集里做子串匹配。
      matches = iconPalette.filter((icon) => icon.includes(query));
      elements.emojiSearchStatus.textContent = "Loading emoji library…";
    }

    if (!matches.length) {
      const emptyState = document.createElement("p");
      emptyState.className = "picker-empty";
      emptyState.textContent = "No result yet — try another word or paste an emoji copied from the web.";
      elements.pickerGrid.append(emptyState);
      return;
    }

    matches.forEach((icon) => {
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

    renderEmojiArt(elements.pickerGrid);
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
    state.items.forEach((item) => {
      item.manual = false;
    });
    autoMatchItems(state.items);
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
    elements.shareButton.disabled = !isValid;
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
    renderEmojiArt(elements.screenLegend);
    renderEmojiArt(elements.printLegend);
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
      ? `${state.title} (Answer)`
      : state.title;
    renderEmojiArt(elements.sudoku);
  }

  function renderEmojiArt(container) {
    // 把容器里的 emoji 字符替换成 OpenMoji SVG 图。索引未就绪时保持原生 emoji。
    if (!container || !CE || !emojiIndex || !window.Intl?.Segmenter) return;
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const emojiPattern = /\p{Extended_Pictographic}/u;
    const textNodes = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      if (walker.currentNode.parentElement?.closest("script, style")) continue;
      if (emojiPattern.test(walker.currentNode.nodeValue)) textNodes.push(walker.currentNode);
    }

    textNodes.forEach((textNode) => {
      const fragment = document.createDocumentFragment();
      let changed = false;

      for (const { segment } of segmenter.segment(textNode.nodeValue)) {
        if (!emojiPattern.test(segment)) {
          fragment.append(segment);
          continue;
        }

        // 用 OpenMoji 自己的 hexcode，保证文件名正确（含 ZWJ 序列）。
        const entry = emojiIndex.byEmoji[segment.replace(/️/g, "")];
        if (!entry) {
          // OpenMoji 没有这个字符（少数 ZWJ 组合等）→ 保留原生 emoji。
          fragment.append(segment);
          continue;
        }

        const image = document.createElement("img");
        image.className = "twemoji";
        image.alt = segment;
        image.draggable = false;
        image.src = CE.svgUrl(entry.hexcode);
        fragment.append(image);
        changed = true;
      }

      if (changed) textNode.replaceWith(fragment);
    });
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

  elements.toggleTopicLibrary.addEventListener("click", () => {
    setTopicLibraryExpanded(elements.toggleTopicLibrary.getAttribute("aria-expanded") !== "true");
  });

  elements.pickerClose.addEventListener("click", closePicker);
  elements.emojiSearchInput.addEventListener("input", renderPickerOptions);
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

  elements.shareButton.addEventListener("click", () => {
    if (!validWords() || !window.TeacherGameShare) {
      showToast("Please enter 9 different words first");
      return;
    }
    window.TeacherGameShare.openPublisher({
      gameType: "word-sudoku",
      version: 1,
      title: () => state.title,
      getData: () => ({
        title: state.title,
        items: state.items.map((item) => ({ word: item.word, icon: item.icon })),
        level: state.level,
        seed: state.seed,
        puzzle: state.puzzle.slice(),
        solution: state.solution.slice()
      }),
      onPublished: () => showToast("Student game link created")
    });
  });

  renderInputs();
  renderLegends();
  generatePuzzle();
  initLibraryPicker();

  // 异步加载 OpenMoji 索引；就绪后重绘，把原生 emoji 升级成 OpenMoji 图。
  if (CE) {
    CE.load()
      .then((index) => {
        emojiIndex = index;
        autoMatchItems(state.items);
        renderInputs();
        renderLegends();
        renderPuzzle();
        if (!elements.iconPicker.hidden) renderPickerOptions();
      })
      .catch(() => {
        // 加载失败：继续用系统原生 emoji 显示，功能不受影响。
      });
  }
})();
