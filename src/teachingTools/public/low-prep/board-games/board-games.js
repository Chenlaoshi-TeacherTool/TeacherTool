/*
 * 棋盘游戏 · Board Game Maker — page logic and print rendering.
 * The board itself comes from board-games-core.js (BoardGamesCore.generate);
 * this file draws it as SVG at real paper size (mm), plus action cards,
 * a rule card, a die net and fold-up pawns.
 */
(function () {
  'use strict';

  var core = window.BoardGamesCore;
  var ZH = window.BG_LANG === 'zh';
  function T(en, zh) { return ZH ? zh : en; }
  var $ = function (id) { return document.getElementById(id); };

  var PAPER = { a4: [210, 297], letter: [215.9, 279.4] };
  var MARGIN = 12;
  var SIZE_LABELS = {
    path: function (n) { return T(n + ' squares', n + ' 格'); },
    ladder: function (n) { return n + ' × ' + n; },
    line: function (n) { return n + ' × ' + n; },
    flight: function () { return T('52 squares', '52 格'); }
  };
  var D = window.BoardGamesDraw;
  var BOARD_NAMES = D.BOARD_NAMES, INK = D.INK, FONT_UI = D.FONT_UI;
  var esc = D.esc, n = D.n, txt = D.txt, svg = D.svg;

  var state = {
    board: 'path',
    actionMode: 'off',
    color: true,
    seed: Math.floor(Math.random() * 1e6) + 1,
    sizes: {},
    words: [],
    pictures: {}
  };

  // ---------- inputs ----------

  function parseWords() {
    var text = $('bgWords').value;
    var list = window.ChenWordlist ? window.ChenWordlist.parseText(text) : text.split(/\n/).map(function (l) { return { zh: l.trim() }; });
    var seen = {};
    return list.filter(function (w) {
      if (!w || !w.zh || seen[w.zh]) return false;
      seen[w.zh] = true;
      return true;
    }).slice(0, core.LIMITS.words).map(function (w) { return { zh: w.zh, py: w.py || '', en: w.en || '' }; });
  }

  function lines(id) { return $(id).value.split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean); }

  function checked(id) {
    return Array.prototype.filter.call($(id).querySelectorAll('input[type=checkbox]'), function (b) { return b.checked; })
      .map(function (b) { return b.value; });
  }

  function currentData() {
    return core.normalize({
      title: $('bgTitle').value,
      board: state.board,
      words: state.words,
      options: {
        size: Number($('bgSize').value),
        show: $('bgShow').value,
        pictures: $('bgPictures').checked,
        color: state.color,
        paper: $('bgPaper').value,
        tasks: $('bgTasks').checked,
        taskRate: Number($('bgTaskRate').value),
        taskKeys: checked('bgTaskList'),
        customTasks: lines('bgCustomTasks'),
        actionMode: state.actionMode,
        actionRate: Number($('bgActionRate').value),
        actionKeys: checked('bgActionList'),
        customActions: lines('bgCustomActions'),
        specials: $('bgSpecials').checked,
        seed: state.seed
      }
    });
  }

  function writeControls(data) {
    var o = data.options;
    $('bgTitle').value = data.title;
    $('bgWords').value = data.words.map(function (w) { return [w.zh, w.py, w.en].join(' | '); }).join('\n');
    state.board = data.board;
    state.actionMode = o.actionMode;
    state.color = o.color;
    state.seed = o.seed;
    state.sizes[data.board] = o.size;
    $('bgShow').value = o.show;
    $('bgPictures').checked = o.pictures;
    $('bgPaper').value = o.paper;
    $('bgTasks').checked = o.tasks;
    $('bgTaskRate').value = o.taskRate;
    $('bgActionRate').value = o.actionRate;
    $('bgSpecials').checked = o.specials;
    $('bgCustomTasks').value = o.customTasks.join('\n');
    $('bgCustomActions').value = o.customActions.join('\n');
    Array.prototype.forEach.call($('bgTaskList').querySelectorAll('input'), function (b) { b.checked = o.taskKeys.indexOf(b.value) !== -1; });
    Array.prototype.forEach.call($('bgActionList').querySelectorAll('input'), function (b) { b.checked = o.actionKeys.indexOf(b.value) !== -1; });
    syncControls();
  }

  function buildPickLists() {
    var d = core.DEFAULT_OPTIONS;
    $('bgTaskList').innerHTML = core.TASKS.map(function (t) {
      return '<label class="bg-pick"><input type="checkbox" value="' + t.key + '"' + (d.taskKeys.indexOf(t.key) !== -1 ? ' checked' : '') + '> ' +
        t.icon + ' ' + t.zh + (ZH ? '' : ' <small>' + esc(t.en) + '</small>') + '</label>';
    }).join('');
    $('bgActionList').innerHTML = core.ACTIONS.map(function (a) {
      return '<label class="bg-pick"><input type="checkbox" value="' + a.key + '"' + (d.actionKeys.indexOf(a.key) !== -1 ? ' checked' : '') + '> ' +
        a.icon + ' ' + a.zh + (a.contact ? ' 🤝' : '') + (ZH ? '' : ' <small>' + esc(a.en) + '</small>') + '</label>';
    }).join('');
  }

  function syncControls() {
    document.querySelectorAll('[data-board]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.board === state.board)); });
    document.querySelectorAll('[data-action]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.action === state.actionMode)); });
    document.querySelectorAll('[data-color]').forEach(function (b) { b.setAttribute('aria-checked', String((b.dataset.color === '1') === state.color)); });
    document.querySelectorAll('[data-board-only]').forEach(function (el) { el.hidden = el.dataset.boardOnly !== state.board; });
    var sizes = core.SIZES[state.board];
    var size = state.sizes[state.board] || core.DEFAULT_SIZE[state.board];
    $('bgSize').innerHTML = sizes.map(function (n) { return '<option value="' + n + '"' + (n === size ? ' selected' : '') + '>' + SIZE_LABELS[state.board](n) + '</option>'; }).join('');
    $('bgSize').disabled = sizes.length < 2;
    $('bgTaskBox').hidden = !$('bgTasks').checked;
    $('bgActionBox').hidden = state.actionMode === 'off';
    $('bgTaskRateOut').textContent = $('bgTaskRate').value + '%';
    $('bgActionRateOut').textContent = $('bgActionRate').value + '%';
  }

  // ---------- pictures ----------

  var pictureToken = 0;
  function loadPictures() {
    var token = ++pictureToken;
    var missing = state.words.filter(function (w) { return !(w.zh in state.pictures); });
    if (!$('bgPictures').checked || !missing.length || !window.ChenEmoji) return;
    var items = missing.map(function (w) { return { zh: w.zh, en: w.en }; });
    var ready = window.ChenWordlist && window.ChenWordlist.loadCedict ? window.ChenWordlist.loadCedict().catch(function () {}) : Promise.resolve();
    ready.then(function () { return window.ChenEmoji.matchAll(items, { translate: true }); }).then(function () {
      items.forEach(function (item) {
        state.pictures[item.zh] = item.openmoji && item.openmoji.hexcode ? window.ChenEmoji.svgUrl(item.openmoji.hexcode) : null;
      });
      if (token === pictureToken) render();
    }).catch(function () {
      items.forEach(function (item) { state.pictures[item.zh] = null; });
    });
  }

  // ---------- sheets ----------

  function pageSize(land) {
    var p = PAPER[currentPaper()];
    return land ? [p[1], p[0]] : p;
  }
  function currentPaper() { return $('bgPaper').value; }

  function sheet(inner, land) {
    var size = pageSize(land);
    return '<div class="bg-sheet ' + (land ? 'is-land' : 'is-port') + '" style="width:' + size[0] + 'mm;height:' + size[1] + 'mm;padding:' + MARGIN + 'mm">' +
      '<div class="bg-sheet-inner">' + inner +
      '<div class="bg-sheet-foot"><span>CLS Teaching Tools</span><span>clsteachingtools.com</span></div></div></div>';
  }

  function boardSheet(layout) {
    var data = layout.data;
    var land = data.board === 'path';
    var size = pageSize(land);
    var W = size[0] - MARGIN * 2, H = size[1] - MARGIN * 2 - 20;
    var name = BOARD_NAMES[data.board];
    var title = data.title || name.zh;
    var sub = data.board === 'line' ? T('Get ' + layout.win + ' in a row', '连成 ' + layout.win + ' 个就赢') : (ZH ? name.zh : name.en + ' · ' + name.zh);

    return sheet('<div class="bg-sheet-head"><h2>' + esc(title) + '</h2><span>' + esc(sub) + '</span></div>' +
      '<div class="bg-board">' + D.draw(layout, W, H, null, state.pictures) + '</div>', land);
  }

  function actionPool(data) {
    var o = data.options;
    return core.ACTIONS.filter(function (a) { return o.actionKeys.indexOf(a.key) !== -1; })
      .concat(o.customActions.map(function (t) { return { zh: t, py: window.ChenWordlist ? window.ChenWordlist.toPinyin(t, { spaced: true }) : '', en: '', icon: '🌟' }; }));
  }

  function cardSheets(data) {
    var pool = actionPool(data);
    if (!pool.length) return '';
    var cards = pool.slice();
    while (cards.length % 9) cards.push(pool[cards.length % pool.length]);
    var color = data.options.color;
    var out = '';
    for (var i = 0; i < cards.length; i += 9) {
      out += sheet('<div class="bg-sheet-head"><h2>' + T('Action cards', '动作卡') + '</h2><span>' + T('Cut along the dashed lines', '沿虚线剪开') + '</span></div>' +
        '<div class="bg-cards">' + cards.slice(i, i + 9).map(function (a) {
          return '<div class="bg-card' + (color ? '' : ' is-bw') + '"><span class="bg-card-star">⭐ ' + T('Action', '动作卡') + '</span>' +
            '<span class="bg-card-icon">' + a.icon + '</span><b>' + esc(a.zh) + '</b>' +
            (a.py ? '<span class="bg-card-py">' + esc(a.py) + '</span>' : '') + (a.en ? '<small>' + esc(a.en) + '</small>' : '') + '</div>';
        }).join('') + '</div>', false);
    }
    return out;
  }

  function dieNet(color) {
    var s = 24;
    var spots = { 1: [[0.5, 0.5]], 2: [[0.25, 0.25], [0.75, 0.75]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], 4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.25, 0.22], [0.75, 0.22], [0.25, 0.5], [0.75, 0.5], [0.25, 0.78], [0.75, 0.78]] };
    var faces = [[1, 0, 1], [0, 1, 2], [1, 1, 3], [2, 1, 5], [3, 1, 4], [1, 2, 6]];
    var body = '';
    faces.forEach(function (f) {
      var x = f[0] * s, y = f[1] * s;
      body += '<rect x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" fill="#fff" stroke="' + INK + '" stroke-width="0.4" stroke-dasharray="1.2 0.8"/>';
      spots[f[2]].forEach(function (p) { body += '<circle cx="' + n(x + p[0] * s) + '" cy="' + n(y + p[1] * s) + '" r="2.1" fill="' + (color && f[2] === 1 ? '#e8594a' : INK) + '"/>'; });
    });
    return svg(4 * s + 1, 3 * s + 1, body);
  }

  function pawns(color) {
    var w = 18, flap = 6, face = 17, h = flap * 2 + face * 2;
    var body = '';
    core.TEAMS.forEach(function (team, t) {
      for (var k = 0; k < 2; k++) {
        var x = (t * 2 + k) * (w + 4), y = 0;
        body += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + (color ? team.soft : '#fff') + '" stroke="' + INK + '" stroke-width="0.4" stroke-dasharray="1.2 0.8"/>';
        [flap, flap + face, flap + face * 2].forEach(function (fy) { body += '<line x1="' + x + '" y1="' + (y + fy) + '" x2="' + (x + w) + '" y2="' + (y + fy) + '" stroke="#9aa79f" stroke-width="0.3"/>'; });
        body += txt(x + w / 2, y + flap + face / 2, team.shape, 10, FONT_UI, color ? team.color : INK) +
          '<g transform="rotate(180 ' + n(x + w / 2) + ' ' + n(y + flap + face * 1.5) + ')">' + txt(x + w / 2, y + flap + face * 1.5, team.shape, 10, FONT_UI, color ? team.color : INK) + '</g>';
      }
    });
    return svg(8 * (w + 4), h + 1, body);
  }

  function kitSheet(layout) {
    var data = layout.data;
    var rules = core.RULES[data.board];
    var fillWin = function (s) { return s.replace('{win}', layout.win || 3); };
    var rule = '<div class="bg-rule"><h3>📜 ' + T('How to play', '游戏规则') + ' · ' + BOARD_NAMES[data.board].zh + '</h3><ol>' +
      rules.zh.map(function (z, i) { return '<li><b>' + esc(fillWin(z)) + '</b><small>' + esc(fillWin(rules.en[i])) + '</small></li>'; }).join('') + '</ol>' +
      (data.options.actionMode === 'card' ? '<p>⭐ ' + T('Land on ⭐: draw an action card and do the action.', '停在 ⭐ 格：抽一张动作卡，做卡上的动作。') + '</p>' : '') + '</div>';
    var parts = data.board === 'line' ? '' :
      '<div class="bg-kit-row"><div><h3>🎲 ' + T('Die: cut, fold, glue', '骰子：剪下、折好、粘起来') + '</h3>' + dieNet(data.options.color) + '</div></div>' +
      '<div><h3>♟️ ' + T('Pawns: cut, fold along the lines, glue the bottom flaps', '棋子：剪下，沿线折成三角形，底部粘好') + '</h3>' + pawns(data.options.color) + '</div>';
    return sheet('<div class="bg-kit">' + rule + parts + '</div>', false);
  }

  // ---------- render ----------

  var renderTimer = null;
  function schedule() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 250); }

  function render() {
    state.words = parseWords();
    syncControls();
    $('bgCount').textContent = T(state.words.length + ' words', '共 ' + state.words.length + ' 个词');
    if (state.words.length < 4) {
      $('bgSheets').innerHTML = '<p class="bg-empty">' + T('Type at least 4 words.', '请至少输入 4 个词。') + '</p>';
      return;
    }
    var data = currentData();
    var layout = core.generate(data);
    var html = boardSheet(layout);
    if (data.options.actionMode === 'card' && $('bgIncCards').checked) html += cardSheets(data);
    if ($('bgIncKit').checked) html += kitSheet(layout);
    $('bgSheets').innerHTML = html;
    var playable = layout.squares.filter(function (sq) { return sq.kind === 'word' || sq.kind === 'task'; }).length;
    $('bgStatus').textContent = data.words.length < playable
      ? T(playable + ' word squares, ' + data.words.length + ' words: each word appears about ' + Math.round(playable / data.words.length) + ' times.', '共 ' + playable + ' 个词语格、' + data.words.length + ' 个词，每个词大约出现 ' + Math.round(playable / data.words.length) + ' 次。')
      : '';
    fitPreview();
    loadPictures();
  }

  function fitPreview() {
    var stage = $('bgStage'), sheets = $('bgSheets');
    sheets.style.zoom = 1;
    var widest = Array.prototype.reduce.call(sheets.querySelectorAll('.bg-sheet'), function (m, s) { return Math.max(m, s.offsetWidth); }, 0);
    if (widest) sheets.style.zoom = Math.min(1, (stage.clientWidth - 24) / widest);
  }

  // ---------- events ----------

  document.querySelector('.bg-boards').addEventListener('click', function (e) {
    var b = e.target.closest('[data-board]');
    if (!b) return;
    state.sizes[state.board] = Number($('bgSize').value);
    state.board = b.dataset.board;
    render();
  });
  document.querySelectorAll('[data-action]').forEach(function (b) { b.addEventListener('click', function () { state.actionMode = b.dataset.action; render(); }); });
  document.querySelectorAll('[data-color]').forEach(function (b) { b.addEventListener('click', function () { state.color = b.dataset.color === '1'; render(); }); });
  $('bgSize').addEventListener('change', function () { state.sizes[state.board] = Number($('bgSize').value); render(); });
  $('bgShuffle').addEventListener('click', function () { state.seed = Math.floor(Math.random() * 1e6) + 1; render(); });
  $('bgPaper').addEventListener('change', function () {
    var p = currentPaper() === 'letter' ? 'letter' : 'A4';
    $('bgPageSize').textContent = '@page port { size: ' + p + ' portrait; margin: 0; } @page land { size: ' + p + ' landscape; margin: 0; }';
    render();
  });
  ['bgWords', 'bgTitle', 'bgCustomTasks', 'bgCustomActions'].forEach(function (id) { $(id).addEventListener('input', schedule); });
  ['bgShow', 'bgPictures', 'bgSpecials', 'bgTasks', 'bgIncCards', 'bgIncKit'].forEach(function (id) { $(id).addEventListener('change', render); });
  ['bgTaskRate', 'bgActionRate'].forEach(function (id) { $(id).addEventListener('input', schedule); });
  $('bgTaskList').addEventListener('change', render);
  $('bgActionList').addEventListener('change', render);
  $('bgPrint').addEventListener('click', function () {
    if (state.words.length < 4) return;
    var images = Array.prototype.slice.call($('bgSheets').querySelectorAll('image'));
    var wait = images.map(function (img) {
      return new Promise(function (resolve) {
        var probe = new Image();
        probe.onload = probe.onerror = resolve;
        probe.src = img.getAttribute('href');
      });
    });
    Promise.race([Promise.all(wait), new Promise(function (r) { setTimeout(r, 4000); })]).then(function () { window.print(); });
  });
  window.addEventListener('resize', fitPreview);

  function bindTemplate() {
    if (!window.TeacherGameTemplate) return;
    $('bgSave').disabled = false;
    window.TeacherGameTemplate.bind({
      button: $('bgSave'),
      gameType: 'board-games',
      version: 1,
      getData: function () {
        state.words = parseWords();
        var data = currentData();
        try { core.template(data); } catch (error) { throw new Error(T('Add at least 4 words before saving.', '请先输入至少 4 个词再保存。')); }
        return Object.assign(data, { title: data.title || BOARD_NAMES[data.board].zh });
      },
      restore: function (data) {
        writeControls(core.normalize(data));
        render();
      }
    });
  }

  // For the projector view (board-games-play.js).
  window.BoardGamesRender = {
    draw: function (layout, W, H, geom) { return D.draw(layout, W, H, geom, state.pictures); },
    current: function () { state.words = parseWords(); return state.words.length < 4 ? null : core.generate(currentData()); },
    picture: function (zh) { return state.pictures[zh] || null; },
    actionPool: actionPool,
    boardName: function (board) { return BOARD_NAMES[board]; }
  };

  // ---------- start ----------

  buildPickLists();
  var handoff = window.ChenWordlistHandoff;
  var handed = handoff && handoff.active();
  if (handed) {
    $('bgWords').value = handed.items.map(function (item) { return [item.zh, item.py, item.en].filter(Boolean).join(' | '); }).join('\n');
    // A real list name makes a good title; the switcher's default name does not.
    if (handed.name && ['我的词表', 'My word list'].indexOf(handed.name) === -1) $('bgTitle').value = handed.name;
    handoff.mountBar(handed);
  }
  render();
  if (document.readyState === 'complete') bindTemplate();
  else window.addEventListener('load', bindTemplate);
})();
