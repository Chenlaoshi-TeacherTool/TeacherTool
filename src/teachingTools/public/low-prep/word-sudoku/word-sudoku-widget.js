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

  const emojiSearchTerms = {
    "🐼": "panda 熊猫 animal 动物",
    "🐧": "penguin 企鹅 animal 动物",
    "🦁": "lion 狮子 animal 动物",
    "🐭": "mouse 老鼠 animal 动物",
    "🦉": "owl 猫头鹰 animal 动物",
    "🐰": "rabbit 兔子 animal 动物",
    "🐶": "dog 狗 animal 动物",
    "🐱": "cat 猫 animal 动物",
    "🐵": "monkey 猴子 animal 动物",
    "🐟": "fish 鱼 animal 动物",
    "🍎": "apple 苹果 fruit 水果 red",
    "🍌": "banana 香蕉 fruit 水果 yellow",
    "🍇": "grape 葡萄 fruit 水果 purple",
    "🍉": "watermelon 西瓜 fruit 水果",
    "🍓": "strawberry 草莓 fruit 水果 berry",
    "🍒": "cherry 樱桃 fruit 水果",
    "🍑": "peach 桃子 fruit 水果",
    "🍊": "orange 橙子 桔子 橘子 fruit 水果",
    "🍍": "pineapple 菠萝 凤梨 fruit 水果",
    "🍐": "pear 梨 fruit 水果",
    "🥕": "carrot 胡萝卜 vegetable 蔬菜 food 食物",
    "📦": "box 箱子 package",
    "🏠": "house home 家 房子",
    "🏫": "school 学校 教室 classroom",
    "📚": "books book 书 阅读 read",
    "✏️": "pencil 笔 写字 write",
    "🎒": "backpack school 书包 学校",
    "🪑": "chair 椅子 classroom 教室",
    "🧸": "teddy toy 玩具",
    "⚽": "ball football soccer 球 足球",
    "🎵": "music 音乐 song 唱歌",
    "☀️": "sun sunny 太阳 晴天 weather 天气",
    "🌧️": "rain 雨 weather 天气",
    "❄️": "snow 雪 weather 天气",
    "🌈": "rainbow 彩虹 weather 天气",
    "🌳": "tree 树 plant 植物",
    "🌸": "flower 花 plant 植物",
    "🚗": "car 汽车 车 transport 交通",
    "🚌": "bus 公交 巴士 transport 交通",
    "🚲": "bike 自行车 单车 transport 交通",
    "✈️": "airplane 飞机 transport 交通",
    "🍚": "rice 米饭 food 食物",
    "🍜": "noodles 面条 food 食物",
    "🥟": "dumpling 饺子 food 食物",
    "🍞": "bread 面包 food 食物",
    "🥛": "milk 牛奶 drink 饮料",
    "💧": "water 水 drink 饮料",
    "🧃": "juice 果汁 drink 饮料",
    "🎂": "cake 蛋糕 birthday 生日",
    "🍦": "ice cream 冰淇淋 dessert 甜点",
    "🍬": "candy 糖果 sweet 甜",
    "👨": "man father 爸爸 男 人 family 家庭",
    "👩": "woman mother 妈妈 女 人 family 家庭",
    "👧": "girl 女孩 姐姐 妹妹 family 家庭",
    "👦": "boy 男孩 哥哥 弟弟 family 家庭",
    "👶": "baby 婴儿 宝宝 family 家庭",
    "👵": "grandma 奶奶 祖母 family 家庭",
    "👴": "grandpa 爷爷 祖父 family 家庭",
    "👨‍🏫": "teacher 老师 男教师 school 学校",
    "👩‍🏫": "teacher 老师 女教师 school 学校",
    "👨‍👩‍👧": "family 家庭 家人",
    "👀": "eyes eye 眼睛 身体",
    "👂": "ear 耳朵 身体",
    "👃": "nose 鼻子 身体",
    "👄": "mouth 嘴巴 身体",
    "✋": "hand 手 身体",
    "🦶": "foot 脚 身体",
    "❤️": "heart 爱 心 feeling",
    "🧠": "brain 大脑 身体",
    "🦷": "tooth 牙齿 身体",
    "💪": "muscle 强壮 手臂 身体",
    "⬆️": "up 上面 上方 direction 方向",
    "⬇️": "down 下面 下方 direction 方向",
    "⬅️": "left 左边 direction 方向",
    "➡️": "right 右边 direction 方向",
    "↔️": "between 之间 旁边 direction 方向",
    "📍": "near 附近 近 location 地点",
    "🔭": "far 远 telescope 望远镜",
    "🚪": "door 门 outside 外面",
    "🗺️": "map 地图 far 远",
    "🧭": "compass 指南针 direction 方向",
    "🏃": "run 跑 action 动作",
    "🚶": "walk 走 action 动作",
    "🧘": "yoga 瑜伽 action 动作",
    "💃": "dance 跳舞 action 动作",
    "🎨": "paint draw 画画 action 动作",
    "📖": "read book 阅读 书",
    "✍️": "write 写字 action 动作",
    "👋": "hello wave 你好 挥手",
    "👏": "clap 鼓掌",
    "💬": "speak talk 说话 聊天",
    "⭐": "star 星星 reward 奖励",
    "🎯": "target 目标",
    "🔔": "bell 铃铛",
    "🎈": "balloon 气球",
    "🎁": "gift 礼物",
    "💡": "idea light 灯 想法",
    "🧩": "puzzle 拼图",
    "🌱": "plant seed 幼苗 植物",
    "☂️": "umbrella 雨伞 weather 天气",
    "⏰": "clock time 时间 钟"
  };

  const iconRules = [
    { words: ["苹果", "apple"], icons: ["🍎", "🍏"] },
    { words: ["香蕉", "banana"], icons: ["🍌"] },
    { words: ["葡萄", "grape"], icons: ["🍇"] },
    { words: ["西瓜", "watermelon"], icons: ["🍉"] },
    { words: ["草莓", "strawberry"], icons: ["🍓"] },
    { words: ["樱桃", "cherry"], icons: ["🍒"] },
    { words: ["桃", "peach"], icons: ["🍑"] },
    { words: ["橙", "桔", "橘", "orange"], icons: ["🍊"] },
    { words: ["菠萝", "凤梨", "pineapple"], icons: ["🍍"] },
    { words: ["梨", "pear"], icons: ["🍐"] },
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
  const topicIcons = {
    "preset-hsk-1-essentials": "⭐",
    "preset-food-and-fruit": "🍎",
    "preset-classroom-basics": "🎒",
    "preset-weather-and-seasons": "🌦️"
  };
  let topicLists = [];
  let selectedTopicValue = "";

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
    topicLibraryStatus: document.getElementById("topicLibraryStatus"),
    topicLibraryChoices: document.getElementById("topicLibraryChoices"),
    topicLibrarySelectionNote: document.getElementById("topicLibrarySelectionNote"),
    useSelectedTopic: document.getElementById("useSelectedTopic"),
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

  function topicIcon(list) {
    return list.source === "saved" ? "📚" : (topicIcons[list.id] || "🀄");
  }

  function renderTopicChoices() {
    if (!topicLists.some((list) => list.selectValue === selectedTopicValue)) {
      selectedTopicValue = "";
    }
    elements.topicLibraryChoices.replaceChildren();
    topicLists.forEach((list) => {
      const count = list.count || (list.items || []).length;
      const selected = list.selectValue === selectedTopicValue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "topic-choice";
      button.dataset.topicValue = list.selectValue;
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-label", `${selected ? "Remove" : "Select"} ${list.name || "vocabulary topic"}`);
      button.disabled = count < 9;
      if (button.disabled) button.title = "This list needs at least 9 terms for a Sudoku.";

      const icon = document.createElement("span");
      icon.className = "topic-choice-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = topicIcon(list);

      const copy = document.createElement("span");
      copy.className = "topic-choice-copy";
      copy.textContent = list.name || "Untitled list";
      const detail = document.createElement("small");
      detail.textContent = `${list.source === "saved" ? "Saved list" : (list.theme || "Published topic")} · ${count} terms`;
      copy.appendChild(detail);
      button.append(icon, copy);
      elements.topicLibraryChoices.appendChild(button);
    });

    if (!topicLists.length) {
      const empty = document.createElement("p");
      empty.className = "topic-library-empty";
      empty.textContent = "No vocabulary topics are available yet.";
      elements.topicLibraryChoices.appendChild(empty);
    }

    const publishedCount = topicLists.filter((list) => list.source === "published").length;
    const savedCount = topicLists.length - publishedCount;
    elements.topicLibraryStatus.textContent = `${publishedCount} published vocabulary topic${publishedCount === 1 ? "" : "s"}` +
      `${savedCount ? ` and ${savedCount} saved list${savedCount === 1 ? "" : "s"}` : ""} are available.`;
    const selected = topicLists.find((list) => list.selectValue === selectedTopicValue);
    elements.topicLibrarySelectionNote.textContent = selected
      ? `${selected.name} selected · first 9 terms will be used`
      : "Choose 1 topic with at least 9 terms";
    elements.useSelectedTopic.disabled = !selected;
  }

  async function loadTopicLists() {
    try {
      const response = await fetch("/api/wordlists/presets");
      if (!response.ok) throw new Error("Vocabulary topics unavailable");
      const payload = await response.json();
      const published = (payload.lists || []).map((list) => ({
        ...list,
        source: "published",
        selectValue: `published:${list.id}`
      }));
      const saved = window.ChenWordlist
        ? window.ChenWordlist.listAll().map((summary) => {
            const list = window.ChenWordlist.load(summary.id);
            return list && Array.isArray(list.items)
              ? { ...list, count: list.items.length, source: "saved", selectValue: `saved:${list.id}` }
              : null;
          }).filter(Boolean)
        : [];
      topicLists = published.concat(saved);
      renderTopicChoices();
    } catch (error) {
      topicLists = [];
      selectedTopicValue = "";
      renderTopicChoices();
      elements.topicLibraryStatus.textContent = "Vocabulary topics are unavailable right now. You can still enter words manually.";
    }
  }

  function selectTopic(value) {
    selectedTopicValue = selectedTopicValue === value ? "" : value;
    renderTopicChoices();
  }

  function useSelectedTopic() {
    const selected = topicLists.find((list) => list.selectValue === selectedTopicValue);
    if (!selected) return;
    const entries = (selected.items || []).filter((item) => item.zh || item.en || item.py).slice(0, 9);
    if (entries.length < 9) {
      showToast("Choose a vocabulary topic with at least 9 terms");
      return;
    }
    const nextItems = entries.map((item) => ({
      word: item.zh || item.en || item.py,
      icon: "",
      manual: false
    }));
    nextItems.forEach((item, index) => {
      item.icon = suggestIcon(item.word, index, nextItems);
    });
    state.items = nextItems;
    state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
    state.title = `${selected.theme || selected.name || "Vocabulary"} Word Sudoku`;
    closePicker();
    renderInputs();
    renderLegends();
    generatePuzzle();
    showToast(`Loaded 9 terms from ${selected.name}`);
    selectedTopicValue = "";
    renderTopicChoices();
    setTopicLibraryExpanded(false);
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
    renderTwemoji(elements.wordGrid);
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
    const query = normalized(elements.emojiSearchInput.value);
    const matches = iconPalette.filter((icon) => {
      if (!query) return true;
      const terms = `${icon} ${emojiSearchTerms[icon] || ""}`.toLocaleLowerCase();
      return terms.includes(query);
    });

    elements.emojiSearchStatus.textContent = query
      ? `${matches.length} Twemoji result${matches.length === 1 ? "" : "s"} for “${elements.emojiSearchInput.value.trim()}”`
      : "Search in English or Chinese to find a classroom-ready emoji.";

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

    renderTwemoji(elements.pickerGrid);
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
    renderTwemoji(elements.screenLegend);
    renderTwemoji(elements.printLegend);
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
    renderTwemoji(elements.sudoku);
  }

  function renderTwemoji(container) {
    if (!container || !window.Intl?.Segmenter) return;
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

        const image = document.createElement("img");
        const codepoints = Array.from(segment)
          .map((character) => character.codePointAt(0).toString(16))
          .filter((codepoint) => codepoint !== "fe0f")
          .join("-");
        image.className = "twemoji";
        image.alt = segment;
        image.draggable = false;
        image.src = `https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/${codepoints}.svg`;
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
  elements.topicLibraryChoices.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-topic-value]");
    if (button) selectTopic(button.dataset.topicValue);
  });
  elements.useSelectedTopic.addEventListener("click", useSelectedTopic);
  window.addEventListener("storage", (event) => {
    if (event.key && event.key.startsWith("clwl:")) loadTopicLists();
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

  renderInputs();
  renderLegends();
  generatePuzzle();
  loadTopicLists();
})();
