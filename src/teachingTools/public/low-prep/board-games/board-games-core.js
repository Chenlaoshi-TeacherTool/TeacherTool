/*
 * 棋盘游戏 · Board Game Maker — shared data model and board generator.
 * Used in the browser (window.BoardGamesCore) and on the server
 * (template sanitizer for account saving, services/games/boardGamesGame.js).
 *
 * One word list fills any of four boards:
 *   path    前进游戏盘   a snake-shaped track with forward / back / roll-again squares
 *   ladder  梯子滑梯棋   a numbered N×N grid with ladders and slides
 *   line    连成一线     an N×N grid: claim squares, get N-in-a-row
 *   flight  飞行棋       a four-colour cross-shaped track with bases and home columns
 *
 * Squares can also be task squares (say a sentence with the word…) and action
 * squares (clap three times…), either written on the square or as "draw an
 * action card" with a printed card deck.
 *
 * generate(data) is deterministic for a given seed, so a saved board prints the same.
 */
(function (global) {
  'use strict';

  var BOARDS = ['path', 'ladder', 'line', 'flight'];
  var LIMITS = { title: 60, words: 60, word: 24, py: 60, en: 60, custom: 12, customText: 30 };
  var SIZES = { path: [24, 30, 36], ladder: [6, 8, 10], line: [3, 4, 5, 6, 7], flight: [52] };
  var DEFAULT_SIZE = { path: 30, ladder: 8, line: 5, flight: 52 };
  var SHOWS = ['zh', 'zhpy', 'py'];
  var ACTION_MODES = ['off', 'cell', 'card'];
  var PAPERS = ['a4', 'letter'];

  // Language tasks done with the word on that square.
  var TASKS = [
    { key: 'sentence', zh: '用它说一句话', py: 'yòng tā shuō yí jù huà', en: 'Say a sentence with it', icon: '💬' },
    { key: 'question', zh: '用它问一个问题', py: 'yòng tā wèn yí gè wèn tí', en: 'Ask a question with it', icon: '❓' },
    { key: 'english', zh: '说出英文意思', py: 'shuō chū Yīng wén yì si', en: 'Say what it means in English', icon: '🔤' },
    { key: 'related', zh: '说三个相关的词', py: 'shuō sān gè xiāng guān de cí', en: 'Say three related words', icon: '🧠' },
    { key: 'act', zh: '演一演', py: 'yǎn yi yǎn', en: 'Act it out', icon: '🎭' },
    { key: 'draw', zh: '画一画', py: 'huà yi huà', en: 'Draw it', icon: '✏️' },
    { key: 'pinyin', zh: '说出拼音', py: 'shuō chū pīn yīn', en: 'Say its pinyin', icon: '🅿️' },
    { key: 'write', zh: '写一写', py: 'xiě yi xiě', en: 'Write it', icon: '✍️' }
  ];

  // Body actions. contact: true ones are off unless the teacher ticks them.
  var ACTIONS = [
    { key: 'clap', zh: '拍手三下', py: 'pāi shǒu sān xià', en: 'Clap three times', icon: '👏' },
    { key: 'spin', zh: '转一圈', py: 'zhuàn yì quān', en: 'Turn around once', icon: '🔄' },
    { key: 'jump', zh: '跳两下', py: 'tiào liǎng xià', en: 'Jump twice', icon: '🦘' },
    { key: 'nose', zh: '摸摸鼻子', py: 'mō mo bí zi', en: 'Touch your nose', icon: '👃' },
    { key: 'head', zh: '摸摸头', py: 'mō mo tóu', en: 'Touch your head', icon: '🙆' },
    { key: 'stamp', zh: '跺跺脚', py: 'duò duo jiǎo', en: 'Stamp your feet', icon: '🦶' },
    { key: 'hands', zh: '举起双手', py: 'jǔ qǐ shuāng shǒu', en: 'Raise both hands', icon: '🙌' },
    { key: 'squat', zh: '蹲下再站起来', py: 'dūn xià zài zhàn qǐ lái', en: 'Squat down and stand up', icon: '🧎' },
    { key: 'cat', zh: '学猫叫', py: 'xué māo jiào', en: 'Meow like a cat', icon: '🐱' },
    { key: 'dog', zh: '学狗叫', py: 'xué gǒu jiào', en: 'Bark like a dog', icon: '🐶' },
    { key: 'bird', zh: '学小鸟飞', py: 'xué xiǎo niǎo fēi', en: 'Fly like a bird', icon: '🐦' },
    { key: 'bunny', zh: '学兔子跳', py: 'xué tù zi tiào', en: 'Hop like a bunny', icon: '🐰' },
    { key: 'smile', zh: '笑一笑', py: 'xiào yi xiào', en: 'Give a big smile', icon: '😄' },
    { key: 'face', zh: '做个鬼脸', py: 'zuò ge guǐ liǎn', en: 'Make a funny face', icon: '😜' },
    { key: 'foot', zh: '单脚站五秒', py: 'dān jiǎo zhàn wǔ miǎo', en: 'Stand on one foot for 5 seconds', icon: '🦩' },
    { key: 'stretch', zh: '伸个懒腰', py: 'shēn ge lǎn yāo', en: 'Have a big stretch', icon: '🙆‍♀️' },
    { key: 'wave', zh: '挥挥手', py: 'huī hui shǒu', en: 'Wave your hand', icon: '👋' },
    { key: 'nod', zh: '点点头', py: 'diǎn dian tóu', en: 'Nod your head', icon: '🙂' },
    { key: 'shake', zh: '摇摇头', py: 'yáo yao tóu', en: 'Shake your head', icon: '🙃' },
    { key: 'count', zh: '用中文数到十', py: 'yòng Zhōng wén shǔ dào shí', en: 'Count to ten in Chinese', icon: '🔟' },
    { key: 'sing', zh: '唱一句歌', py: 'chàng yí jù gē', en: 'Sing one line of a song', icon: '🎵' },
    { key: 'cheer', zh: '大声说“加油！”', py: 'dà shēng shuō “jiā yóu!”', en: 'Shout “jiāyóu!”', icon: '📣' },
    { key: 'shoulders', zh: '拍拍肩膀', py: 'pāi pai jiān bǎng', en: 'Tap your shoulders', icon: '🤷' },
    { key: 'blink', zh: '眨眨眼睛', py: 'zhǎ zha yǎn jing', en: 'Blink your eyes', icon: '😉' },
    { key: 'run', zh: '原地跑五步', py: 'yuán dì pǎo wǔ bù', en: 'Run on the spot for 5 steps', icon: '🏃' },
    { key: 'breathe', zh: '做三个深呼吸', py: 'zuò sān gè shēn hū xī', en: 'Take three deep breaths', icon: '🌬️' },
    { key: 'kungfu', zh: '摆一个功夫姿势', py: 'bǎi yí gè gōng fu zī shì', en: 'Strike a kung fu pose', icon: '🥋' },
    { key: 'robot', zh: '学机器人走路', py: 'xué jī qì rén zǒu lù', en: 'Walk like a robot', icon: '🤖' },
    { key: 'highfive', zh: '和旁边的同学击掌', py: 'hé páng biān de tóng xué jī zhǎng', en: 'High-five the person next to you', icon: '✋', contact: true },
    { key: 'handshake', zh: '和同学握握手', py: 'hé tóng xué wò wo shǒu', en: 'Shake hands with a classmate', icon: '🤝', contact: true }
  ];

  // Game squares on the path board.
  var SPECIALS = [
    { key: 'forward', zh: '前进两格', py: 'qián jìn liǎng gé', en: 'Go forward 2', icon: '⏩', move: 2 },
    { key: 'back', zh: '后退一格', py: 'hòu tuì yí gé', en: 'Go back 1', icon: '⏪', move: -1 },
    { key: 'again', zh: '再掷一次', py: 'zài zhì yí cì', en: 'Roll again', icon: '🎲' },
    { key: 'skip', zh: '停一次', py: 'tíng yí cì', en: 'Miss a turn', icon: '⏸️' }
  ];

  var TEAMS = [
    { key: 'red', zh: '红', en: 'Red', color: '#e8594a', soft: '#fbd5cf', shape: '●' },
    { key: 'yellow', zh: '黄', en: 'Yellow', color: '#f2b705', soft: '#fdeeb5', shape: '▲' },
    { key: 'blue', zh: '蓝', en: 'Blue', color: '#3a86d4', soft: '#cfe2f7', shape: '■' },
    { key: 'green', zh: '绿', en: 'Green', color: '#3aa35b', soft: '#cdeccf', shape: '★' }
  ];

  var DEFAULT_OPTIONS = {
    size: null,
    show: 'zhpy',
    pictures: true,
    color: true,
    paper: 'a4',
    tasks: false,
    taskRate: 20,
    taskKeys: ['sentence', 'question', 'english', 'act'],
    customTasks: [],
    actionMode: 'off',
    actionRate: 15,
    actionKeys: ['clap', 'spin', 'jump', 'nose', 'cat', 'bunny', 'smile', 'face', 'foot', 'count', 'cheer', 'robot'],
    customActions: [],
    specials: true,
    seed: 1
  };

  function badRequest(message) {
    var error = new Error(message);
    error.status = 400;
    return error;
  }

  function text(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function pick(value, list, fallback) { return list.indexOf(value) !== -1 ? value : fallback; }

  function clampInt(value, min, max, fallback) {
    var n = Math.round(Number(value));
    return isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function keys(list, allowed, fallback) {
    if (!Array.isArray(list)) return fallback.slice();
    var seen = {};
    return list.filter(function (k) {
      if (allowed.indexOf(k) === -1 || seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  function customList(list) {
    return (Array.isArray(list) ? list : []).map(function (t) { return text(t, LIMITS.customText); }).filter(Boolean).slice(0, LIMITS.custom);
  }

  // Clean any input into a complete, safe board description.
  function normalize(input) {
    var src = input && typeof input === 'object' ? input : {};
    var o = src.options && typeof src.options === 'object' ? src.options : {};
    var board = pick(src.board, BOARDS, 'path');
    var seen = {};
    var words = (Array.isArray(src.words) ? src.words : []).map(function (w) {
      return { zh: text(w && w.zh, LIMITS.word), py: text(w && w.py, LIMITS.py), en: text(w && w.en, LIMITS.en) };
    }).filter(function (w) {
      if (!w.zh || seen[w.zh]) return false;
      seen[w.zh] = true;
      return true;
    }).slice(0, LIMITS.words);
    var d = DEFAULT_OPTIONS;
    return {
      title: text(src.title, LIMITS.title),
      board: board,
      words: words,
      options: {
        size: pick(Number(o.size), SIZES[board], DEFAULT_SIZE[board]),
        show: pick(o.show, SHOWS, d.show),
        pictures: o.pictures === undefined ? d.pictures : Boolean(o.pictures),
        color: o.color === undefined ? d.color : Boolean(o.color),
        paper: pick(o.paper, PAPERS, d.paper),
        tasks: Boolean(o.tasks),
        taskRate: clampInt(o.taskRate, 5, 40, d.taskRate),
        taskKeys: keys(o.taskKeys, TASKS.map(function (t) { return t.key; }), d.taskKeys),
        customTasks: customList(o.customTasks),
        actionMode: pick(o.actionMode, ACTION_MODES, d.actionMode),
        actionRate: clampInt(o.actionRate, 5, 40, d.actionRate),
        actionKeys: keys(o.actionKeys, ACTIONS.map(function (a) { return a.key; }), d.actionKeys),
        customActions: customList(o.customActions),
        specials: o.specials === undefined ? d.specials : Boolean(o.specials),
        seed: clampInt(o.seed, 1, 2147483646, 1)
      }
    };
  }

  // Account copy: needs at least four words.
  function template(input) {
    var data = normalize(input);
    if (data.words.length < 4) throw badRequest('Add at least 4 words before saving.');
    return data;
  }

  // ---------- generation ----------

  function rng(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  }

  function shuffled(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function taskPool(o) {
    return TASKS.filter(function (t) { return o.taskKeys.indexOf(t.key) !== -1; })
      .concat(o.customTasks.map(function (t, i) { return { key: 'custom-task-' + i, zh: t, py: '', en: '', icon: '⭐' }; }));
  }

  function actionPool(o) {
    return ACTIONS.filter(function (a) { return o.actionKeys.indexOf(a.key) !== -1; })
      .concat(o.customActions.map(function (t, i) { return { key: 'custom-action-' + i, zh: t, py: '', en: '', icon: '🌟' }; }));
  }

  // Fill playable squares: words in a shuffled cycle, then turn some into task / action squares.
  function fillSquares(slots, data, rand) {
    var o = data.options;
    var order = shuffled(data.words.map(function (w, i) { return i; }), rand);
    var k = 0;
    slots.forEach(function (sq) {
      sq.kind = 'word';
      sq.word = order.length ? order[k++ % order.length] : -1;
      if (k % order.length === 0) order = shuffled(order, rand);
    });
    var free = shuffled(slots, rand);
    var tasks = taskPool(o), actions = actionPool(o);
    var at = 0;
    if (o.actionMode !== 'off' && actions.length) {
      var nAct = Math.round(slots.length * o.actionRate / 100);
      var deck = shuffled(actions, rand);
      for (var a = 0; a < nAct && at < free.length; a++, at++) {
        var sq = free[at];
        if (o.actionMode === 'card') { sq.kind = 'card'; sq.word = -1; }
        else { sq.kind = 'action'; sq.action = deck[a % deck.length]; sq.word = -1; }
      }
    }
    if (o.tasks && tasks.length) {
      var nTask = Math.round(slots.length * o.taskRate / 100);
      var tdeck = shuffled(tasks, rand);
      for (var t = 0; t < nTask && at < free.length; t++, at++) { free[at].kind = 'task'; free[at].task = tdeck[t % tdeck.length]; }
    }
  }

  // 前进游戏盘: rows of `cols` squares, alternating direction, read bottom-left to top.
  function pathBoard(data, rand) {
    var n = data.options.size;
    var cols = 6;
    var rows = Math.ceil(n / cols);
    var squares = [];
    for (var i = 0; i < n; i++) {
      var row = Math.floor(i / cols), col = i % cols;
      if (row % 2 === 1) col = cols - 1 - col;
      squares.push({ i: i, row: rows - 1 - row, col: col });
    }
    squares[0].kind = 'start';
    squares[n - 1].kind = 'end';
    var middle = squares.slice(1, n - 1);
    var specials = [];
    if (data.options.specials) {
      // One game square every ~6, never two in a row.
      var spots = [];
      for (var s = 3; s < n - 2; s += 5 + Math.floor(rand() * 3)) spots.push(s);
      var deck = shuffled(SPECIALS, rand);
      spots.forEach(function (idx, j) { squares[idx].kind = 'special'; squares[idx].special = deck[j % deck.length]; specials.push(idx); });
    }
    fillSquares(middle.filter(function (sq) { return !sq.kind; }), data, rand);
    return { board: 'path', cols: cols, rows: rows, squares: squares };
  }

  // 梯子滑梯棋: numbered 1..N² from bottom-left, ladders go up, slides go down.
  function ladderBoard(data, rand) {
    var size = data.options.size;
    var total = size * size;
    var squares = [];
    for (var i = 0; i < total; i++) {
      var row = Math.floor(i / size), col = i % size;
      if (row % 2 === 1) col = size - 1 - col;
      squares.push({ i: i, row: size - 1 - row, col: col });
    }
    squares[0].kind = 'start';
    squares[total - 1].kind = 'end';
    var count = { 6: 3, 8: 4, 10: 5 }[size];
    var used = {};
    used[0] = used[total - 1] = true;
    var links = [];
    function place(up) {
      for (var tries = 0; tries < 200; tries++) {
        var a = 1 + Math.floor(rand() * (total - 2));
        var rowsApart = 1 + Math.floor(rand() * Math.min(3, size - 2));
        var b = a + (up ? 1 : -1) * (rowsApart * size + Math.floor(rand() * 3) - 1);
        if (b <= 0 || b >= total - 1 || used[a] || used[b]) continue;
        if (Math.floor(a / size) === Math.floor(b / size)) continue;
        used[a] = used[b] = true;
        links.push({ from: a, to: b, kind: up ? 'ladder' : 'slide' });
        return;
      }
    }
    for (var k = 0; k < count; k++) { place(true); place(false); }
    fillSquares(squares.slice(1, total - 1), data, rand);
    return { board: 'ladder', size: size, squares: squares, links: links };
  }

  // 连成一线: every square holds a word; claim squares to get `win` in a row.
  function lineBoard(data, rand) {
    var size = data.options.size;
    var squares = [];
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) squares.push({ i: r * size + c, row: r, col: c });
    fillSquares(squares, data, rand);
    return { board: 'line', size: size, win: size <= 4 ? 3 : size <= 6 ? 4 : 5, squares: squares };
  }

  // 飞行棋: 15×15 cross. 52 track squares, each team has a base corner, a start
  // square and a 5-square home column leading to the centre.
  var FLIGHT_TRACK = (function () {
    var t = [];
    function run(x0, y0, dx, dy, n) { for (var i = 0; i < n; i++) t.push([x0 + dx * i, y0 + dy * i]); }
    run(1, 6, 1, 0, 5);   // left arm, top row, going right
    run(6, 5, 0, -1, 6);  // up the top arm
    run(7, 0, 1, 0, 1);
    run(8, 0, 0, 1, 6);   // down the top arm
    run(9, 6, 1, 0, 6);   // right arm, top row
    run(14, 7, 0, 1, 1);
    run(14, 8, -1, 0, 6); // right arm, bottom row, going left
    run(8, 9, 0, 1, 6);   // down the bottom arm
    run(7, 14, -1, 0, 1);
    run(6, 14, 0, -1, 6); // up the bottom arm
    run(5, 8, -1, 0, 6);  // left arm, bottom row, going left
    run(0, 7, 0, -1, 1);
    run(0, 6, 1, 0, 1);
    return t;
  }());
  // Team order around the track: red (left), yellow (top), blue (right), green (bottom).
  var FLIGHT_TEAMS = [
    { start: 0, home: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], base: [0, 0] },
    { start: 13, home: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], base: [9, 0] },
    { start: 26, home: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]], base: [9, 9] },
    { start: 39, home: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], base: [0, 9] }
  ];

  function flightBoard(data, rand) {
    var squares = FLIGHT_TRACK.map(function (xy, i) {
      var team = ((i % 4) + 4) % 4;
      var sq = { i: i, col: xy[0], row: xy[1], team: team };
      FLIGHT_TEAMS.forEach(function (ft, t) { if (ft.start === i) { sq.kind = 'start'; sq.team = t; } });
      return sq;
    });
    fillSquares(squares.filter(function (sq) { return !sq.kind; }), data, rand);
    return { board: 'flight', size: 15, squares: squares, teams: FLIGHT_TEAMS };
  }

  function generate(input) {
    var data = normalize(input);
    var rand = rng(data.options.seed);
    var build = { path: pathBoard, ladder: ladderBoard, line: lineBoard, flight: flightBoard }[data.board];
    var layout = build(data, rand);
    layout.data = data;
    return layout;
  }

  // Bilingual rules for the printed rule card.
  var RULES = {
    path: {
      zh: ['每人放一个棋子在“起点”。', '轮流掷骰子，走相应的格数。', '读出你停的格子上的词；做到格子上的任务或动作。', '停在⏩⏪🎲⏸️格子上，照着做。', '先到“终点”的人赢！'],
      en: ['Everyone puts a pawn on START.', 'Take turns rolling the die and move that many squares.', 'Read the word you land on, or do the task or action on the square.', 'On ⏩ ⏪ 🎲 ⏸️ squares, do what they say.', 'First to reach FINISH wins!']
    },
    ladder: {
      zh: ['每人放一个棋子在 1 号格。', '轮流掷骰子，按数字顺序往前走。', '读出你停的格子上的词，或做任务、动作。', '停在梯子底下就爬上去；停在滑梯顶上就滑下来。', '先到最后一格的人赢！'],
      en: ['Everyone starts on square 1.', 'Take turns rolling the die and move up the numbers.', 'Read the word you land on, or do the task or action.', 'Land at the bottom of a ladder: climb up. Land at the top of a slide: slide down.', 'First to reach the last square wins!']
    },
    line: {
      zh: ['两人或两队，各用一种记号（比如 ○ 和 ×）。', '轮流选一个格子，读出上面的词（或做任务、动作）。', '做对了，就在格子上画你的记号。', '先把 {win} 个记号连成一条线（横、竖、斜都可以）的赢！'],
      en: ['Two players or teams, each with a mark (for example ○ and ×).', 'Take turns choosing a square and reading its word (or doing its task or action).', 'Get it right and draw your mark on the square.', 'First to get {win} marks in a line (across, down or diagonal) wins!']
    },
    flight: {
      zh: ['2–4 人，每人选一种颜色，两个棋子放在自己的基地。', '掷到 6 才能把一个棋子放到起飞格。', '轮流掷骰子往前走，读出你停的格子上的词，或做任务、动作。', '停在和自己同颜色的格子上，可以再往前跳到下一个同颜色的格子。', '绕一圈后走进自己颜色的回家路，两个棋子都到中间的人赢！'],
      en: ['2–4 players. Each picks a colour and puts two pawns in their base.', 'Roll a 6 to move a pawn onto your start square.', 'Take turns rolling and moving. Read the word you land on, or do the task or action.', 'Land on a square of your own colour: jump ahead to the next square of your colour.', 'After one lap, go up your colour\'s home path. Get both pawns to the centre to win!']
    }
  };

  var api = {
    BOARDS: BOARDS, SIZES: SIZES, DEFAULT_SIZE: DEFAULT_SIZE, LIMITS: LIMITS,
    TASKS: TASKS, ACTIONS: ACTIONS, SPECIALS: SPECIALS, TEAMS: TEAMS, RULES: RULES,
    DEFAULT_OPTIONS: DEFAULT_OPTIONS,
    FLIGHT_TRACK: FLIGHT_TRACK,
    normalize: normalize, template: template, generate: generate
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.BoardGamesCore = api;
})(typeof window !== 'undefined' ? window : this);
