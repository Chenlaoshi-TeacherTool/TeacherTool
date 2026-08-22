(function () {
  'use strict';

  var PAGE_WIDTH = 816;
  var PAGE_HEIGHT = 1056;
  var STORAGE_KEY = 'chen-laoshi-tarsia-puzzle-v1';
  var TWEMOJI_BASE = 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/';
  var $ = function (selector) { return document.querySelector(selector); };
  var $$ = function (selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); };
  var toastTimer;
  var activeEmojiRow = -1;
  var wordLists = [];
  var questionBanks = [];
  var wordIndex = new Map();

  var vocabularySample = [
    ['苹果', 'apple', 'píng guǒ', '🍎'], ['香蕉', 'banana', 'xiāng jiāo', '🍌'],
    ['葡萄', 'grapes', 'pú tao', '🍇'], ['西瓜', 'watermelon', 'xī guā', '🍉'],
    ['草莓', 'strawberry', 'cǎo méi', '🍓'], ['橘子', 'orange', 'jú zi', '🍊'],
    ['熊猫', 'panda', 'xióng māo', '🐼'], ['兔子', 'rabbit', 'tù zi', '🐰'],
    ['小狗', 'dog', 'xiǎo gǒu', '🐶'], ['小猫', 'cat', 'xiǎo māo', '🐱'],
    ['学校', 'school', 'xué xiào', '🏫'], ['老师', 'teacher', 'lǎo shī', '👩‍🏫'],
    ['书', 'book', 'shū', '📚'], ['铅笔', 'pencil', 'qiān bǐ', '✏️'],
    ['太阳', 'sun', 'tài yáng', '☀️'], ['下雨', 'rain', 'xià yǔ', '🌧️'],
    ['下雪', 'snow', 'xià xuě', '❄️'], ['彩虹', 'rainbow', 'cǎi hóng', '🌈']
  ];

  var qaSample = [
    ['What is 1/2 as a decimal?', '0.5'], ['What is 3 × 4?', '12'],
    ['A triangle has how many sides?', '3'], ['What is the opposite of hot?', 'cold'],
    ['Water freezes at what temperature in °C?', '0°C'], ['Which planet is known as the Red Planet?', 'Mars'],
    ['What gas do plants take in?', 'carbon dioxide'], ['What is the capital of France?', 'Paris'],
    ['Past tense of go', 'went'], ['A synonym for quick', 'fast'],
    ['The largest ocean', 'Pacific Ocean'], ['7 + 8', '15'],
    ['100 centimeters', '1 meter'], ['An animal that begins life as a tadpole', 'frog'],
    ['A shape with four equal sides', 'square'], ['The season after summer', 'autumn'],
    ['The first month of the year', 'January'], ['A baby dog', 'puppy']
  ];

  var emojiCatalog = [
    ['🍎', 'apple apples 苹果 red fruit 水果'], ['🍌', 'banana 香蕉 yellow fruit 水果'],
    ['🍇', 'grape grapes 葡萄 purple fruit 水果'], ['🍉', 'watermelon 西瓜 fruit 水果'],
    ['🍓', 'strawberry 草莓 berry fruit 水果'], ['🍒', 'cherry cherries 樱桃 fruit 水果'],
    ['🍑', 'peach 桃 桃子 fruit 水果'], ['🍊', 'orange 橙子 橘子 桔子 fruit 水果'],
    ['🍍', 'pineapple 菠萝 凤梨 fruit 水果'], ['🍐', 'pear 梨 fruit 水果'],
    ['🥕', 'carrot 胡萝卜 vegetable 蔬菜'], ['🌽', 'corn 玉米 vegetable 蔬菜'],
    ['🍚', 'rice 米饭 食物 food'], ['🍜', 'noodles noodle 面条 food 食物'],
    ['🥟', 'dumpling dumplings 饺子 food 食物'], ['🍞', 'bread 面包 food 食物'],
    ['🥛', 'milk 牛奶 drink 饮料'], ['💧', 'water 水 drink 饮料'],
    ['🧃', 'juice 果汁 drink 饮料'], ['🍵', 'tea 茶 drink 饮料'],
    ['🎂', 'cake birthday 蛋糕 生日'], ['🍦', 'ice cream 冰淇淋 dessert'],
    ['🐼', 'panda 熊猫 animal 动物'], ['🐰', 'rabbit bunny 兔 兔子 animal 动物'],
    ['🐶', 'dog puppy 狗 小狗 animal 动物'], ['🐱', 'cat kitten 猫 小猫 animal 动物'],
    ['🐭', 'mouse rat 老鼠 animal 动物'], ['🦁', 'lion 狮子 animal 动物'],
    ['🐵', 'monkey 猴子 animal 动物'], ['🐧', 'penguin 企鹅 animal 动物'],
    ['🦉', 'owl 猫头鹰 animal 动物'], ['🐟', 'fish 鱼 animal 动物'],
    ['🐸', 'frog 青蛙 tadpole animal 动物'], ['🐯', 'tiger 老虎 animal 动物'],
    ['🐻', 'bear 熊 animal 动物'], ['🦋', 'butterfly 蝴蝶 animal 动物'],
    ['🏠', 'house home 家 房子'], ['🏫', 'school classroom 学校 教室'],
    ['📚', 'book books 书 阅读 read'], ['✏️', 'pencil pen 铅笔 笔 写 write'],
    ['📓', 'notebook 本子 作业本'], ['📏', 'ruler 尺子'], ['🎒', 'backpack schoolbag 书包'],
    ['🪑', 'chair seat 椅子'], ['👩‍🏫', 'teacher 老师 教师'], ['👨‍🏫', 'male teacher 老师 教师'],
    ['👨', 'man father dad 爸爸 父亲'], ['👩', 'woman mother mom 妈妈 母亲'],
    ['👧', 'girl daughter 女孩 女儿 姐姐 妹妹'], ['👦', 'boy son 男孩 儿子 哥哥 弟弟'],
    ['👶', 'baby 婴儿 宝宝'], ['👵', 'grandma grandmother 奶奶 外婆 祖母'],
    ['👴', 'grandpa grandfather 爷爷 外公 祖父'], ['👨‍👩‍👧', 'family 家庭 家人'],
    ['☀️', 'sun sunny 太阳 晴天 weather 天气'], ['🌧️', 'rain rainy 下雨 雨 weather 天气'],
    ['❄️', 'snow snowy 下雪 雪 winter 冬天'], ['🌈', 'rainbow 彩虹 weather 天气'],
    ['☁️', 'cloud cloudy 云 阴天'], ['💨', 'wind windy 风 刮风'],
    ['🌳', 'tree 树 plant 植物'], ['🌸', 'flower 花 spring 春天'], ['🌱', 'seed plant sprout 种子 发芽'],
    ['🚗', 'car automobile 汽车 车 transport 交通'], ['🚌', 'bus 公交 巴士 transport 交通'],
    ['🚲', 'bike bicycle 自行车 单车 transport 交通'], ['✈️', 'airplane plane 飞机 transport 交通'],
    ['🚂', 'train 火车 transport 交通'], ['🚢', 'ship boat 船 transport 交通'],
    ['👀', 'eye eyes 眼睛 看'], ['👂', 'ear ears 耳朵 听'], ['👃', 'nose 鼻子'],
    ['👄', 'mouth 嘴巴 说'], ['✋', 'hand 手'], ['🦶', 'foot feet 脚'],
    ['❤️', 'heart love 心 爱 red'], ['🧠', 'brain 大脑'], ['🦷', 'tooth teeth 牙齿'],
    ['🏃', 'run running 跑 动作'], ['🚶', 'walk walking 走 动作'], ['💃', 'dance dancing 跳舞'],
    ['🎨', 'paint draw art 画 画画 美术'], ['📖', 'read reading book 阅读 读书'],
    ['✍️', 'write writing 写 写字'], ['🎵', 'music song sing 音乐 唱歌'], ['⚽', 'ball soccer football 球 足球'],
    ['⬆️', 'up above top 上面 上方'], ['⬇️', 'down below under 下面 下方'],
    ['⬅️', 'left 左边'], ['➡️', 'right 右边'], ['↔️', 'between beside next to 之间 旁边'],
    ['📍', 'near location place 附近 地点'], ['🗺️', 'map 地图'], ['🧭', 'compass direction 方向'],
    ['⭐', 'star reward 星星 奖励'], ['🎯', 'target goal 目标'], ['🔔', 'bell 铃铛'],
    ['🎈', 'balloon 气球'], ['🎁', 'gift present 礼物'], ['💡', 'idea light 灯 想法'],
    ['🧩', 'puzzle match 拼图 配对'], ['⏰', 'clock time 时间 钟'], ['📅', 'calendar date month year 日期 月 年'],
    ['🔺', 'triangle 三角形 three sides'], ['🟦', 'square blue 正方形 蓝色'], ['🔴', 'circle red 圆形 红色'],
    ['🌍', 'earth world planet 地球 世界'], ['🔴', 'mars red planet 火星'], ['🌊', 'ocean sea water 海洋 大海'],
    ['🍂', 'autumn fall 秋天 season'], ['🌷', 'spring 春天 season'], ['🏖️', 'summer 夏天 season']
  ].map(function (item) { return { emoji: item[0], terms: item[1] }; });

  var state = {
    mode: 'vocabulary',
    size: 4,
    matchType: 'english',
    title: 'Vocabulary Tarsia Puzzle',
    seed: 20260821,
    pairs: [],
    board: null,
    preview: 'cut',
    dirty: false
  };

  var elements = {};

  function cacheElements() {
    [
      'puzzleTitle', 'puzzleSize', 'matchType', 'vocabularyControls', 'qaControls', 'contentHeading',
      'pairCount', 'wordListSelect', 'addWordList', 'wordListStatus', 'vocabularyInput',
      'buildVocabularyPairs', 'questionBankSelect', 'addQuestionBank', 'questionBankStatus',
      'qaInput', 'buildQaPairs', 'pairEditor', 'validationMessage', 'loadSample', 'generatePuzzle',
      'reshufflePuzzle', 'clearPuzzle', 'previewStatus', 'pagePreview', 'previewNote', 'printPuzzle',
      'downloadPdf', 'downloadPptx', 'emojiPicker', 'closeEmojiPicker', 'emojiSearch', 'emojiGrid',
      'customEmoji', 'useCustomEmoji', 'printPages', 'tarsiaToast'
    ].forEach(function (id) { elements[id] = document.getElementById(id); });
  }

  function requiredPairCount() { return state.size === 3 ? 9 : 18; }

  function sampleVocabularyText(count) {
    return vocabularySample.slice(0, count || 18).map(function (row) { return row.join(' | '); }).join('\n');
  }

  function sampleQaText(count) {
    return qaSample.slice(0, count || 18).map(function (row) { return row[0] + ' | ' + row[1]; }).join('\n');
  }

  function bindEvents() {
    $$('.mode-switch button[data-mode]').forEach(function (button) {
      button.addEventListener('click', function () { setMode(button.dataset.mode); });
    });

    $$('.preview-tabs button[data-preview]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.preview = button.dataset.preview;
        $$('.preview-tabs button').forEach(function (item) {
          var active = item === button;
          item.classList.toggle('active', active);
          item.setAttribute('aria-selected', String(active));
        });
        renderPreview();
      });
    });

    elements.puzzleTitle.addEventListener('input', function () {
      state.title = elements.puzzleTitle.value.trim() || 'Tarsia Puzzle';
      markDirty();
      saveDraft();
    });
    elements.puzzleSize.addEventListener('change', function () {
      state.size = Number(elements.puzzleSize.value) === 3 ? 3 : 4;
      rebuildFromActiveInput();
    });
    elements.matchType.addEventListener('change', function () {
      state.matchType = elements.matchType.value;
      buildVocabularyPairs(false);
    });
    elements.vocabularyInput.addEventListener('input', function () { markDirty(); saveDraft(); });
    elements.qaInput.addEventListener('input', function () { markDirty(); saveDraft(); });
    elements.buildVocabularyPairs.addEventListener('click', function () { buildVocabularyPairs(false); });
    elements.buildQaPairs.addEventListener('click', function () { buildQaPairs(false); });
    elements.loadSample.addEventListener('click', loadSample);
    elements.generatePuzzle.addEventListener('click', function () { generatePuzzle(false); });
    elements.reshufflePuzzle.addEventListener('click', function () {
      state.seed = (state.seed + 2654435761) >>> 0;
      generatePuzzle(false);
    });
    elements.clearPuzzle.addEventListener('click', clearAll);
    elements.addWordList.addEventListener('click', addSelectedWordList);
    elements.addQuestionBank.addEventListener('click', addSelectedQuestionBank);
    elements.wordListSelect.addEventListener('change', function () { elements.addWordList.disabled = !elements.wordListSelect.value; });
    elements.questionBankSelect.addEventListener('change', function () { elements.addQuestionBank.disabled = !elements.questionBankSelect.value; });
    elements.pairEditor.addEventListener('input', editPairValue);
    elements.pairEditor.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-emoji-row]');
      if (trigger) openEmojiPicker(Number(trigger.dataset.emojiRow));
    });
    elements.closeEmojiPicker.addEventListener('click', closeEmojiPicker);
    elements.emojiPicker.addEventListener('click', function (event) {
      if (event.target === elements.emojiPicker) closeEmojiPicker();
    });
    elements.emojiSearch.addEventListener('input', renderEmojiGrid);
    elements.emojiGrid.addEventListener('click', function (event) {
      var button = event.target.closest('button[data-emoji]');
      if (button) chooseEmoji(button.dataset.emoji);
    });
    elements.useCustomEmoji.addEventListener('click', function () { chooseEmoji(elements.customEmoji.value); });
    elements.customEmoji.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); chooseEmoji(elements.customEmoji.value); }
    });
    elements.printPuzzle.addEventListener('click', printPuzzle);
    elements.downloadPdf.addEventListener('click', function () { exportPuzzle('pdf'); });
    elements.downloadPptx.addEventListener('click', function () { exportPuzzle('pptx'); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !elements.emojiPicker.hidden) closeEmojiPicker();
    });
  }

  function setMode(mode) {
    state.mode = mode === 'qa' ? 'qa' : 'vocabulary';
    $$('.mode-switch button[data-mode]').forEach(function (button) {
      var active = button.dataset.mode === state.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    elements.vocabularyControls.hidden = state.mode !== 'vocabulary';
    elements.qaControls.hidden = state.mode !== 'qa';
    elements.contentHeading.textContent = state.mode === 'vocabulary' ? 'Choose vocabulary' : 'Add sentences and answers';
    state.title = state.mode === 'vocabulary' ? 'Vocabulary Tarsia Puzzle' : 'Question & Answer Tarsia Puzzle';
    elements.puzzleTitle.value = state.title;
    rebuildFromActiveInput();
  }

  function parseVocabularyLine(line) {
    var parts = line.split('|').map(function (part) { return part.trim(); });
    return { source: parts[0] || '', en: parts[1] || '', py: parts[2] || '', emoji: parts[3] || '' };
  }

  function parsePairLine(line) {
    var normalized = line.replace(/^\s*\d+[.)]\s*/, '');
    var separator = normalized.indexOf('|') >= 0 ? '|' : (normalized.indexOf('→') >= 0 ? '→' : null);
    if (!separator) return { a: normalized.trim(), b: '' };
    var index = normalized.indexOf(separator);
    return { a: normalized.slice(0, index).trim(), b: normalized.slice(index + separator.length).trim() };
  }

  function lookupWord(record) {
    var sourceKey = normalizeSearch(record.source);
    var englishKey = normalizeSearch(record.en);
    return wordIndex.get(sourceKey) || wordIndex.get(englishKey) || null;
  }

  function buildVocabularyPairs(silent) {
    state.matchType = elements.matchType.value;
    var lines = elements.vocabularyInput.value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    var records = lines.map(parseVocabularyLine).slice(0, requiredPairCount());
    state.pairs = records.map(function (record) {
      var known = lookupWord(record);
      var en = record.en || (known && known.en) || '';
      var py = record.py || (known && known.py) || '';
      var emoji = normalizeEmoji(record.emoji) || matchEmoji([record.source, en, py].join(' '));
      var target = state.matchType === 'pinyin' ? py : (state.matchType === 'emoji' ? emoji : en);
      return { a: record.source, b: target };
    });
    padPairs();
    markDirty();
    renderPairEditor();
    saveDraft();
    if (!silent) showToast('Matches filled. Review any unfamiliar terms before generating.');
  }

  function buildQaPairs(silent) {
    var lines = elements.qaInput.value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    state.pairs = lines.map(parsePairLine).slice(0, requiredPairCount());
    padPairs();
    markDirty();
    renderPairEditor();
    saveDraft();
    if (!silent) showToast('Question-and-answer pairs are ready to review.');
  }

  function padPairs() {
    var count = requiredPairCount();
    state.pairs = state.pairs.slice(0, count);
    while (state.pairs.length < count) state.pairs.push({ a: '', b: '' });
  }

  function rebuildFromActiveInput() {
    state.matchType = elements.matchType.value;
    elements.puzzleSize.value = String(state.size);
    if (state.mode === 'qa') buildQaPairs(true); else buildVocabularyPairs(true);
  }

  function renderPairEditor() {
    padPairs();
    var emojiMode = state.mode === 'vocabulary' && state.matchType === 'emoji';
    elements.pairEditor.innerHTML = state.pairs.map(function (pair, index) {
      var target = emojiMode
        ? '<button class="emoji-choice" type="button" data-emoji-row="' + index + '"><span class="emoji-preview">' + escapeHtml(pair.b || '🧩') + '</span><span class="change-label">Change</span></button>'
        : '<input type="text" maxlength="72" data-pair-index="' + index + '" data-side="b" value="' + escapeAttribute(pair.b) + '" aria-label="Match ' + (index + 1) + ' second side">';
      return '<div class="pair-row">' +
        '<span class="pair-index">' + (index + 1) + '</span>' +
        '<input type="text" maxlength="72" data-pair-index="' + index + '" data-side="a" value="' + escapeAttribute(pair.a) + '" aria-label="Match ' + (index + 1) + ' first side">' +
        '<span class="pair-arrow" aria-hidden="true">↔</span>' + target + '</div>';
    }).join('');
    if (emojiMode) renderTwemoji(elements.pairEditor);
    updateValidation(false);
  }

  function editPairValue(event) {
    var input = event.target.closest('input[data-pair-index]');
    if (!input) return;
    var index = Number(input.dataset.pairIndex);
    var side = input.dataset.side;
    if (!state.pairs[index] || (side !== 'a' && side !== 'b')) return;
    state.pairs[index][side] = input.value;
    markDirty();
    updateValidation(false);
    saveDraft();
  }

  function completedPairCount() {
    return state.pairs.filter(function (pair) { return pair.a.trim() && pair.b.trim(); }).length;
  }

  function validatePairs(strict) {
    var needed = requiredPairCount();
    var completed = completedPairCount();
    if (strict && completed < needed) return { ok: false, message: 'Complete all ' + needed + ' matching pairs before generating.' };

    var filled = [];
    state.pairs.forEach(function (pair) {
      if (pair.a.trim()) filled.push(normalizeSearch(pair.a));
      if (pair.b.trim()) filled.push(normalizeSearch(pair.b));
    });
    var duplicates = filled.filter(function (value, index) { return value && filled.indexOf(value) !== index; });
    var longSide = state.pairs.some(function (pair) { return pair.a.length > 58 || pair.b.length > 58; });
    if (duplicates.length) return { ok: true, warning: true, message: 'Some edge labels repeat. Students may find more than one plausible placement.' };
    if (longSide) return { ok: true, warning: true, message: 'One or more labels are long. Check the preview closely before printing.' };
    if (completed < needed) return { ok: false, message: completed + ' of ' + needed + ' pairs are complete.' };
    return { ok: true, message: 'All ' + needed + ' matching pairs are ready.' };
  }

  function updateValidation(strict) {
    var needed = requiredPairCount();
    var completed = completedPairCount();
    elements.pairCount.textContent = completed + ' / ' + needed + ' ready';
    elements.pairCount.classList.toggle('incomplete', completed !== needed);
    var result = validatePairs(strict);
    elements.validationMessage.textContent = result.message;
    elements.validationMessage.className = 'validation-message' + (result.ok ? (result.warning ? '' : ' success') : (strict ? ' error' : ''));
    return result;
  }

  function generatePuzzle(silent) {
    state.title = elements.puzzleTitle.value.trim() || 'Tarsia Puzzle';
    var result = updateValidation(true);
    if (!result.ok) {
      if (!silent) showToast(result.message);
      elements.pairEditor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    state.board = buildBoard(state.size, state.pairs, state.seed);
    state.dirty = false;
    elements.previewStatus.textContent = result.warning ? 'Ready · check repeats' : 'Ready to print';
    elements.previewStatus.classList.remove('incomplete');
    renderPreview();
    renderPrintPages();
    saveDraft();
    if (!silent) showToast('Puzzle generated with a cut sheet and answer key.');
    return true;
  }

  function markDirty() {
    state.dirty = true;
    elements.previewStatus.textContent = 'Needs update';
    elements.previewStatus.classList.add('incomplete');
  }

  function buildBoard(size, pairs, seed) {
    var h = Math.sqrt(3) / 2;
    var pieces = [];
    var row;
    var col;
    for (row = 0; row < size; row++) {
      for (col = 0; col <= row; col++) {
        pieces.push(makePiece('u-' + row + '-' + col, 'up', row, col, [
          { x: (size - row) / 2 + col, y: row * h },
          { x: (size - row + 1) / 2 + col, y: (row + 1) * h },
          { x: (size - row - 1) / 2 + col, y: (row + 1) * h }
        ]));
        if (col < row) {
          pieces.push(makePiece('d-' + row + '-' + col, 'down', row, col, [
            { x: (size - row) / 2 + col, y: row * h },
            { x: (size - row) / 2 + col + 1, y: row * h },
            { x: (size - row) / 2 + col + .5, y: (row + 1) * h }
          ]));
        }
      }
    }

    var edgeGroups = new Map();
    pieces.forEach(function (piece) {
      piece.vertices.forEach(function (point, index) {
        var next = piece.vertices[(index + 1) % 3];
        var key = edgeKey(point, next);
        if (!edgeGroups.has(key)) edgeGroups.set(key, []);
        edgeGroups.get(key).push({ piece: piece, edgeIndex: index });
      });
    });

    var internalEdges = [];
    edgeGroups.forEach(function (group) { if (group.length === 2) internalEdges.push(group); });
    internalEdges = seededShuffle(internalEdges, seed ^ 0x2f6e2b1);
    var orderedPairs = seededShuffle(pairs.map(function (pair, index) {
      return { a: pair.a.trim(), b: pair.b.trim(), originalIndex: index };
    }), seed ^ 0x93ab741);
    var random = seededRandom(seed ^ 0x6d2b79f5);

    internalEdges.forEach(function (group, index) {
      var pair = orderedPairs[index];
      var swap = random() > .5;
      var first = swap ? pair.b : pair.a;
      var second = swap ? pair.a : pair.b;
      group[0].piece.labels[group[0].edgeIndex] = makeContent(first, pair.originalIndex, swap);
      group[1].piece.labels[group[1].edgeIndex] = makeContent(second, pair.originalIndex, !swap);
    });

    var cutOrder = seededShuffle(pieces.slice(), seed ^ 0x7f4a7c15).map(function (piece, index) {
      return { piece: piece, rotation: Math.floor(seededRandom(seed + index * 7919)() * 3) };
    });
    return { size: size, pieces: pieces, cutOrder: cutOrder, seed: seed };
  }

  function makePiece(id, orientation, row, col, vertices) {
    return { id: id, orientation: orientation, row: row, col: col, vertices: vertices, labels: [null, null, null] };
  }

  function makeContent(value, pairIndex, isSecond) {
    return {
      value: value,
      pairIndex: pairIndex,
      kind: state.mode === 'vocabulary' && state.matchType === 'emoji' && isSecond ? 'emoji' : 'text'
    };
  }

  function edgeKey(a, b) {
    var aKey = a.x.toFixed(4) + ',' + a.y.toFixed(4);
    var bKey = b.x.toFixed(4) + ',' + b.y.toFixed(4);
    return aKey < bKey ? aKey + '|' + bKey : bKey + '|' + aKey;
  }

  function seededRandom(seed) {
    var value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      var t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(items, seed) {
    var result = items.slice();
    var random = seededRandom(seed);
    for (var index = result.length - 1; index > 0; index--) {
      var target = Math.floor(random() * (index + 1));
      var temp = result[index];
      result[index] = result[target];
      result[target] = temp;
    }
    return result;
  }

  function renderPreview() {
    if (!state.board) return;
    var svg = state.preview === 'answer' ? renderAnswerPage(state.board, null) : renderCutPage(state.board, null);
    elements.pagePreview.innerHTML = svg;
    elements.previewNote.textContent = state.preview === 'answer'
      ? 'Use this completed triangle to check the puzzle after students finish.'
      : 'Print this page, cut out the triangles, and mix the pieces before students begin.';
  }

  function renderPrintPages(assetMap) {
    if (!state.board) return;
    elements.printPages.innerHTML = '<div class="print-page">' + renderCutPage(state.board, assetMap || null) + '</div>' +
      '<div class="print-page">' + renderAnswerPage(state.board, assetMap || null) + '</div>';
  }

  function pageFrame(title, subtitle, body, footer) {
    var titleLength = Array.from(title).length;
    var titleSize = titleLength > 36 ? 21 : (titleLength > 29 ? 24 : 28);
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + PAGE_WIDTH + ' ' + PAGE_HEIGHT + '" width="' + PAGE_WIDTH + '" height="' + PAGE_HEIGHT + '">' +
      '<rect width="816" height="1056" fill="#ffffff"/>' +
      '<rect x="30" y="30" width="756" height="996" rx="5" fill="none" stroke="#17352d" stroke-width="2"/>' +
      '<text x="52" y="68" text-anchor="start" fill="#17352d" font-family="Segoe Print, Comic Sans MS, cursive" font-size="' + titleSize + '" font-weight="700">' + escapeXml(title) + '</text>' +
      '<text x="52" y="96" fill="#65766f" font-family="Arial, sans-serif" font-size="13">' + escapeXml(subtitle) + '</text>' +
      '<text x="764" y="67" text-anchor="end" fill="#17352d" font-family="Arial, sans-serif" font-size="12">Name: ____________________</text>' +
      '<text x="764" y="91" text-anchor="end" fill="#17352d" font-family="Arial, sans-serif" font-size="12">Date: ____________________</text>' +
      body +
      '<text x="52" y="1000" fill="#65766f" font-family="Arial, sans-serif" font-size="10">' + escapeXml(footer) + '</text>' +
      '<text x="764" y="1000" text-anchor="end" fill="#65766f" font-family="Arial, sans-serif" font-size="10">Chen Laoshi\'s Teaching Toolkit · Tarsia Puzzle</text>' +
      '</svg>';
  }

  function renderCutPage(board, assetMap) {
    var count = board.pieces.length;
    var columns = board.size === 3 ? 3 : 4;
    var side = board.size === 3 ? 190 : 150;
    var triangleHeight = side * Math.sqrt(3) / 2;
    var marginX = board.size === 3 ? 50 : 42;
    var gapX = (PAGE_WIDTH - marginX * 2 - side * columns) / Math.max(1, columns - 1);
    var gapY = board.size === 3 ? 66 : 45;
    var startY = board.size === 3 ? 174 : 155;
    var body = '<text x="52" y="127" fill="#17352d" font-family="Arial, sans-serif" font-size="12" font-weight="700">Cut out every triangle, mix the pieces, then match the edges to rebuild one large triangle.</text>';

    board.cutOrder.forEach(function (entry, index) {
      var row = Math.floor(index / columns);
      var col = index % columns;
      var x = marginX + col * (side + gapX);
      var y = startY + row * (triangleHeight + gapY);
      var vertices = [{ x: x + side / 2, y: y }, { x: x + side, y: y + triangleHeight }, { x: x, y: y + triangleHeight }];
      var rotatedLabels = [0, 1, 2].map(function (edge) { return entry.piece.labels[(edge + entry.rotation) % 3]; });
      body += renderPiece(vertices, rotatedLabels, assetMap, {
        fill: index % 2 ? '#fffdf8' : '#ffffff',
        strokeWidth: 2,
        textBase: board.size === 3 ? 13 : 11.5,
        inset: board.size === 3 ? 21 : 17
      });
      body += '<text x="' + (x + side / 2).toFixed(1) + '" y="' + (y + triangleHeight * .63).toFixed(1) + '" text-anchor="middle" fill="#b5c2ba" font-family="Arial, sans-serif" font-size="8">' + (index + 1) + '</text>';
    });

    return pageFrame(state.title, 'STUDENT CUT SHEET · ' + count + ' pieces / ' + requiredPairCount() + ' matches', body,
      'Tip: Print on cardstock when students will reuse the puzzle. Keep pieces in a labeled envelope.');
  }

  function renderAnswerPage(board, assetMap) {
    var side = board.size === 3 ? 218 : 168;
    var totalWidth = side * board.size;
    var xOffset = (PAGE_WIDTH - totalWidth) / 2;
    var yOffset = board.size === 3 ? 190 : 180;
    var body = '<text x="52" y="127" fill="#17352d" font-family="Arial, sans-serif" font-size="12" font-weight="700">Every touching edge below is one correct match.</text>';

    board.pieces.forEach(function (piece, index) {
      var vertices = piece.vertices.map(function (point) {
        return { x: xOffset + point.x * side, y: yOffset + point.y * side };
      });
      body += renderPiece(vertices, piece.labels, assetMap, {
        fill: index % 2 ? '#fbf7ea' : '#eef5ef',
        strokeWidth: 2.4,
        textBase: board.size === 3 ? 14 : 12.5,
        inset: board.size === 3 ? 24 : 19
      });
    });
    body += '<path d="M' + (xOffset + totalWidth / 2).toFixed(1) + ' ' + yOffset.toFixed(1) + ' L' + xOffset.toFixed(1) + ' ' + (yOffset + board.size * side * Math.sqrt(3) / 2).toFixed(1) + ' L' + (xOffset + totalWidth).toFixed(1) + ' ' + (yOffset + board.size * side * Math.sqrt(3) / 2).toFixed(1) + ' Z" fill="none" stroke="#17352d" stroke-width="3.2"/>';
    return pageFrame(state.title + ' · Answer Key', 'COMPLETED TARSIA TRIANGLE', body,
      'Teacher check: Matching labels should meet on all interior edges; the outer border stays blank.');
  }

  function renderPiece(vertices, labels, assetMap, options) {
    var points = vertices.map(function (point) { return point.x.toFixed(1) + ',' + point.y.toFixed(1); }).join(' ');
    var output = '<g><polygon points="' + points + '" fill="' + options.fill + '" stroke="#101b17" stroke-width="' + options.strokeWidth + '" stroke-linejoin="round"/>';
    labels.forEach(function (content, edgeIndex) {
      if (content && content.value) output += renderEdgeContent(vertices, edgeIndex, content, assetMap, options);
    });
    return output + '</g>';
  }

  function renderEdgeContent(vertices, edgeIndex, content, assetMap, options) {
    var a = vertices[edgeIndex];
    var b = vertices[(edgeIndex + 1) % 3];
    var centroid = {
      x: (vertices[0].x + vertices[1].x + vertices[2].x) / 3,
      y: (vertices[0].y + vertices[1].y + vertices[2].y) / 3
    };
    var midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    var inwardX = centroid.x - midpoint.x;
    var inwardY = centroid.y - midpoint.y;
    var inwardLength = Math.sqrt(inwardX * inwardX + inwardY * inwardY) || 1;
    var x = midpoint.x + inwardX / inwardLength * options.inset;
    var y = midpoint.y + inwardY / inwardLength * options.inset;
    var edgeLength = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));

    if (content.kind === 'emoji') {
      var emojiSize = Math.min(31, edgeLength * .2);
      var asset = assetMap && assetMap[content.value] ? assetMap[content.value] : twemojiUrl(content.value);
      if (asset) {
        return '<image x="' + (x - emojiSize / 2).toFixed(1) + '" y="' + (y - emojiSize / 2).toFixed(1) + '" width="' + emojiSize.toFixed(1) + '" height="' + emojiSize.toFixed(1) + '" href="' + escapeAttribute(asset) + '" xlink:href="' + escapeAttribute(asset) + '" preserveAspectRatio="xMidYMid meet"/>';
      }
      return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" dominant-baseline="middle" font-size="' + emojiSize.toFixed(1) + '">' + escapeXml(content.value) + '</text>';
    }

    var text = content.value.trim();
    var textLength = Array.from(text).length;
    var fontSize = options.textBase;
    if (textLength > 20) fontSize *= .86;
    if (textLength > 34) fontSize *= .78;
    if (textLength > 52) fontSize *= .72;
    fontSize = Math.max(7.2, fontSize);
    var maxChars = Math.max(9, Math.floor(edgeLength * .72 / (fontSize * .56)));
    var lines = wrapLabel(text, maxChars, 2);
    var angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    if (angle > 90 || angle < -90) angle += 180;
    var lineHeight = fontSize * 1.03;
    var firstY = lines.length === 1 ? 0 : -lineHeight * .43;
    var tspans = lines.map(function (line, index) {
      return '<tspan x="0" y="' + (firstY + index * lineHeight).toFixed(1) + '">' + escapeXml(line) + '</tspan>';
    }).join('');
    return '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + angle.toFixed(2) + ')"><text text-anchor="middle" dominant-baseline="middle" fill="#101b17" font-family="Arial, Noto Sans SC, Microsoft YaHei, sans-serif" font-size="' + fontSize.toFixed(1) + '" font-weight="650">' + tspans + '</text></g>';
  }

  function wrapLabel(text, maxChars, maxLines) {
    var characters = Array.from(text);
    if (characters.length <= maxChars) return [text];
    var words = text.split(/\s+/).filter(Boolean);
    var lines = [];
    if (words.length > 1) {
      var current = '';
      words.forEach(function (word) {
        var candidate = current ? current + ' ' + word : word;
        if (Array.from(candidate).length <= maxChars || !current) current = candidate;
        else { lines.push(current); current = word; }
      });
      if (current) lines.push(current);
    } else {
      for (var index = 0; index < characters.length; index += maxChars) lines.push(characters.slice(index, index + maxChars).join(''));
    }
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = Array.from(lines[maxLines - 1]);
      lines[maxLines - 1] = last.slice(0, Math.max(1, maxChars - 1)).join('') + '…';
    }
    return lines;
  }

  function loadSample() {
    if (state.mode === 'qa') {
      elements.qaInput.value = sampleQaText(requiredPairCount());
      buildQaPairs(true);
    } else {
      elements.vocabularyInput.value = sampleVocabularyText(requiredPairCount());
      buildVocabularyPairs(true);
    }
    state.seed = (state.seed + 1013904223) >>> 0;
    generatePuzzle(true);
    showToast('Sample loaded. You can edit every match.');
  }

  function clearAll() {
    elements.vocabularyInput.value = '';
    elements.qaInput.value = '';
    state.pairs = [];
    padPairs();
    state.board = null;
    state.dirty = true;
    elements.pagePreview.innerHTML = '<div style="display:grid;place-items:center;height:100%;padding:28px;text-align:center;color:#65766f">Add ' + requiredPairCount() + ' complete pairs, then generate your puzzle.</div>';
    elements.printPages.innerHTML = '';
    elements.previewStatus.textContent = 'Waiting for pairs';
    renderPairEditor();
    saveDraft();
  }

  async function loadWordLists() {
    try {
      var response = await fetch('/api/wordlists/presets');
      if (!response.ok) throw new Error('Word-list request failed');
      var data = await response.json();
      wordLists = data.lists || [];
      wordLists.forEach(function (list) {
        (list.items || []).forEach(function (item) {
          var record = { zh: item.zh || '', py: item.py || '', en: item.en || '' };
          if (record.zh) wordIndex.set(normalizeSearch(record.zh), record);
          if (record.en) wordIndex.set(normalizeSearch(record.en), record);
        });
      });
      elements.wordListSelect.innerHTML = '<option value="">Choose a preset list…</option>' + wordLists.map(function (list) {
        return '<option value="' + escapeAttribute(list.id) + '">' + escapeHtml(list.name) + ' · ' + list.count + ' terms</option>';
      }).join('');
      elements.wordListStatus.textContent = wordLists.length + ' teacher-curated word lists available. Add more than one list if you want to mix topics.';
      if (state.mode === 'vocabulary') {
        buildVocabularyPairs(true);
        if (completedPairCount() === requiredPairCount()) generatePuzzle(true);
      }
    } catch (error) {
      elements.wordListSelect.innerHTML = '<option value="">Library unavailable</option>';
      elements.wordListStatus.textContent = 'You can still paste vocabulary and edit every generated match manually.';
    }
  }

  async function loadQuestionBanks() {
    try {
      var response = await fetch('/api/questionbanks/presets');
      if (!response.ok) throw new Error('Question-bank request failed');
      var data = await response.json();
      questionBanks = data.banks || [];
      elements.questionBankSelect.innerHTML = '<option value="">Choose a question bank…</option>' + questionBanks.map(function (bank) {
        return '<option value="' + escapeAttribute(bank.id) + '">' + escapeHtml(bank.name) + ' · ' + bank.count + ' questions</option>';
      }).join('');
      elements.questionBankStatus.textContent = questionBanks.length + ' teacher-curated question banks available. Answers can be edited after import.';
    } catch (error) {
      elements.questionBankSelect.innerHTML = '<option value="">Library unavailable</option>';
      elements.questionBankStatus.textContent = 'You can still paste your own questions and answers.';
    }
  }

  function addSelectedWordList() {
    var selected = wordLists.find(function (list) { return list.id === elements.wordListSelect.value; });
    if (!selected) return;
    var existing = elements.vocabularyInput.value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    var keys = new Set(existing.map(function (line) { return normalizeSearch(parseVocabularyLine(line).source); }));
    (selected.items || []).forEach(function (item) {
      if (existing.length >= requiredPairCount()) return;
      if (keys.has(normalizeSearch(item.zh))) return;
      var emoji = matchEmoji((item.zh || '') + ' ' + (item.en || ''));
      existing.push([item.zh || '', item.en || '', item.py || '', emoji].join(' | '));
      keys.add(normalizeSearch(item.zh));
    });
    elements.vocabularyInput.value = existing.join('\n');
    buildVocabularyPairs(true);
    showToast('Added terms from ' + selected.name + '.');
  }

  async function addSelectedQuestionBank() {
    var id = elements.questionBankSelect.value;
    var meta = questionBanks.find(function (bank) { return bank.id === id; });
    if (!id) return;
    elements.addQuestionBank.disabled = true;
    try {
      var response = await fetch('/api/questionbanks/presets/' + encodeURIComponent(id));
      if (!response.ok) throw new Error('Question bank unavailable');
      var bank = await response.json();
      var existing = elements.qaInput.value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
      (bank.questions || []).forEach(function (question) {
        if (existing.length >= requiredPairCount()) return;
        var prompt = question.prompt || question.question || question.text || '';
        var answer = resolveQuestionAnswer(question);
        if (prompt && answer) existing.push(prompt.replace(/\|/g, '/') + ' | ' + answer.replace(/\|/g, '/'));
      });
      elements.qaInput.value = existing.join('\n');
      buildQaPairs(true);
      showToast('Added questions from ' + ((meta && meta.name) || bank.name || 'the selected bank') + '.');
    } catch (error) {
      showToast('That question bank could not be loaded.');
    } finally {
      elements.addQuestionBank.disabled = false;
    }
  }

  function resolveQuestionAnswer(question) {
    var answer = String(question.answer || question.correctAnswer || '').trim();
    if (/^[A-D]$/i.test(answer) && Array.isArray(question.options)) {
      var index = answer.toUpperCase().charCodeAt(0) - 65;
      return String(question.options[index] || answer).trim();
    }
    return answer;
  }

  function matchEmoji(value) {
    var query = normalizeSearch(value);
    if (!query) return '🧩';
    var best = null;
    var bestScore = 0;
    emojiCatalog.forEach(function (item) {
      item.terms.split(/\s+/).forEach(function (term) {
        var normalized = normalizeSearch(term);
        if (!normalized || query.indexOf(normalized) < 0) return;
        var score = normalized.length * 10 + (query === normalized ? 1000 : 0);
        if (score > bestScore) { best = item.emoji; bestScore = score; }
      });
    });
    return best || '🧩';
  }

  function openEmojiPicker(index) {
    activeEmojiRow = index;
    elements.emojiSearch.value = '';
    elements.customEmoji.value = '';
    elements.emojiPicker.hidden = false;
    renderEmojiGrid();
    setTimeout(function () { elements.emojiSearch.focus(); }, 20);
  }

  function closeEmojiPicker() {
    elements.emojiPicker.hidden = true;
    activeEmojiRow = -1;
  }

  function renderEmojiGrid() {
    var query = normalizeSearch(elements.emojiSearch.value);
    var matches = emojiCatalog.filter(function (item) {
      return !query || normalizeSearch(item.terms).indexOf(query) >= 0 || item.emoji === query;
    }).slice(0, 72);
    elements.emojiGrid.innerHTML = matches.map(function (item) {
      return '<button type="button" data-emoji="' + escapeAttribute(item.emoji) + '" title="' + escapeAttribute(item.terms.split(' ').slice(0, 4).join(', ')) + '">' + escapeHtml(item.emoji) + '</button>';
    }).join('') || '<p>No matches yet. Try another word or paste an emoji below.</p>';
    renderTwemoji(elements.emojiGrid);
  }

  function chooseEmoji(value) {
    var emoji = normalizeEmoji(value);
    if (!emoji || activeEmojiRow < 0 || !state.pairs[activeEmojiRow]) {
      showToast('Choose or paste one emoji picture.');
      return;
    }
    state.pairs[activeEmojiRow].b = emoji;
    closeEmojiPicker();
    markDirty();
    renderPairEditor();
    saveDraft();
  }

  function normalizeEmoji(value) {
    var text = String(value || '').trim();
    if (!text) return '';
    var emojiPattern;
    try { emojiPattern = /\p{Extended_Pictographic}/u; } catch (error) { return Array.from(text)[0] || ''; }
    if (window.Intl && Intl.Segmenter) {
      var segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      var segments = Array.from(segmenter.segment(text));
      var match = segments.find(function (item) { return emojiPattern.test(item.segment); });
      return match ? match.segment : '';
    }
    return Array.from(text).find(function (character) { return emojiPattern.test(character); }) || '';
  }

  function twemojiUrl(emoji) {
    var codepoints = Array.from(emoji || '').map(function (character) { return character.codePointAt(0).toString(16); })
      .filter(function (codepoint) { return codepoint !== 'fe0f'; }).join('-');
    return codepoints ? TWEMOJI_BASE + codepoints + '.svg' : '';
  }

  function renderTwemoji(container) {
    if (!container || !window.Intl || !Intl.Segmenter) return;
    var emojiPattern;
    try { emojiPattern = /\p{Extended_Pictographic}/u; } catch (error) { return; }
    var segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    var nodes = [];
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.parentElement && walker.currentNode.parentElement.closest('script, style')) continue;
      if (emojiPattern.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    }
    nodes.forEach(function (node) {
      var fragment = document.createDocumentFragment();
      var changed = false;
      Array.from(segmenter.segment(node.nodeValue)).forEach(function (part) {
        if (!emojiPattern.test(part.segment)) { fragment.append(part.segment); return; }
        var image = document.createElement('img');
        image.className = 'twemoji';
        image.alt = part.segment;
        image.draggable = false;
        image.src = twemojiUrl(part.segment);
        fragment.append(image);
        changed = true;
      });
      if (changed) node.replaceWith(fragment);
    });
  }

  async function printPuzzle() {
    if (!ensureCurrentPuzzle()) return;
    renderPrintPages();
    setTimeout(function () { window.print(); }, 80);
  }

  function ensureCurrentPuzzle() {
    if (!state.board || state.dirty) return generatePuzzle(false);
    return true;
  }

  async function exportPuzzle(format) {
    if (!ensureCurrentPuzzle()) return;
    var button = format === 'pdf' ? elements.downloadPdf : elements.downloadPptx;
    var original = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparing…';
    try {
      var assets = await embedUsedTwemoji();
      var svgs = [renderCutPage(state.board, assets), renderAnswerPage(state.board, assets)];
      var images = await Promise.all(svgs.map(function (svg) {
        return window.DeckExport.svgToJpeg(svg, PAGE_WIDTH, PAGE_HEIGHT, 2, .94);
      }));
      var filename = slugify(state.title) || 'tarsia-puzzle';
      if (format === 'pdf') {
        var pdf = window.DeckExport.buildPDF(images, { pageWidth: 612, pageHeight: 792 });
        window.DeckExport.download(filename + '.pdf', pdf, 'application/pdf');
      } else {
        var pptx = window.DeckExport.buildPPTX(images, { pageWidth: 612, pageHeight: 792 });
        window.DeckExport.download(filename + '.pptx', pptx, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      }
      showToast((format === 'pdf' ? 'PDF' : 'PowerPoint') + ' downloaded with both pages.');
    } catch (error) {
      console.error(error);
      showToast('The download could not be prepared. Try Print / Save PDF instead.');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function embedUsedTwemoji() {
    var values = [];
    if (state.mode === 'vocabulary' && state.matchType === 'emoji') {
      state.pairs.forEach(function (pair) { if (pair.b && values.indexOf(pair.b) < 0) values.push(pair.b); });
    }
    var results = await Promise.all(values.map(async function (emoji) {
      try {
        var response = await fetch(twemojiUrl(emoji));
        if (!response.ok) throw new Error('Twemoji asset unavailable');
        var svg = await response.text();
        return [emoji, 'data:image/svg+xml;base64,' + utf8Base64(svg)];
      } catch (error) {
        return [emoji, twemojiUrl(emoji)];
      }
    }));
    return results.reduce(function (map, item) { map[item[0]] = item[1]; return map; }, {});
  }

  function utf8Base64(value) {
    var bytes = new TextEncoder().encode(value);
    var binary = '';
    for (var index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
    return btoa(binary);
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        mode: state.mode,
        size: state.size,
        matchType: state.matchType,
        title: elements.puzzleTitle.value,
        vocabulary: elements.vocabularyInput.value,
        qa: elements.qaInput.value,
        seed: state.seed
      }));
    } catch (error) { /* Browser storage is optional. */ }
  }

  function loadDraft() {
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (error) { draft = null; }
    if (!draft) {
      elements.vocabularyInput.value = sampleVocabularyText(18);
      elements.qaInput.value = sampleQaText(18);
      buildVocabularyPairs(true);
      generatePuzzle(true);
      return;
    }
    state.size = draft.size === 3 ? 3 : 4;
    state.matchType = ['english', 'pinyin', 'emoji'].indexOf(draft.matchType) >= 0 ? draft.matchType : 'english';
    state.seed = Number(draft.seed) || state.seed;
    elements.puzzleSize.value = String(state.size);
    elements.matchType.value = state.matchType;
    elements.vocabularyInput.value = draft.vocabulary || sampleVocabularyText(requiredPairCount());
    elements.qaInput.value = draft.qa || sampleQaText(requiredPairCount());
    setMode(draft.mode === 'qa' ? 'qa' : 'vocabulary');
    if (draft.title) { state.title = draft.title; elements.puzzleTitle.value = draft.title; }
    generatePuzzle(true);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.tarsiaToast.textContent = message;
    elements.tarsiaToast.classList.add('show');
    toastTimer = setTimeout(function () { elements.tarsiaToast.classList.remove('show'); }, 3200);
  }

  function normalizeSearch(value) {
    return String(value || '').toLowerCase().normalize('NFKC').replace(/[“”"'‘’.,!?;:()（）]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function slugify(value) {
    return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\u3400-\u9fff]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 70);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function escapeAttribute(value) { return escapeHtml(value); }
  function escapeXml(value) { return escapeHtml(value); }

  function initialize() {
    cacheElements();
    bindEvents();
    loadDraft();
    loadWordLists();
    loadQuestionBanks();
  }

  initialize();
})();
