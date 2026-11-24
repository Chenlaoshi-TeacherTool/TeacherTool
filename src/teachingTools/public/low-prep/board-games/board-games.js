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
  var BOARD_NAMES = {
    path: { zh: '前进游戏盘', en: 'Race Track' },
    ladder: { zh: '梯子滑梯棋', en: 'Ladders & Slides' },
    line: { zh: '连成一线', en: 'Get in a Row' },
    flight: { zh: '飞行棋', en: 'Flight Race' }
  };
  var SIZE_LABELS = {
    path: function (n) { return T(n + ' squares', n + ' 格'); },
    ladder: function (n) { return n + ' × ' + n; },
    line: function (n) { return n + ' × ' + n; },
    flight: function () { return T('52 squares', '52 格'); }
  };
  var TINTS = ['#fff4d6', '#e3f2fd', '#e8f5e9', '#fde7ef'];
  var KIND_FILL = { task: '#fff0b3', action: '#d8f3dc', card: '#eadffb', special: '#ffdcd1', start: '#bfe3c6', end: '#ffd166' };
  var INK = '#1f2d27';
  var FONT_ZH = '"KaiTi","STKaiti","Kaiti SC","Microsoft YaHei",serif';
  var FONT_PY = 'Andika,"Segoe UI",sans-serif';
  var FONT_UI = '"Microsoft YaHei","PingFang SC",sans-serif';

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

  // ---------- drawing helpers ----------

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function n(v) { return Math.round(v * 100) / 100; }
  function len(s) { return Array.from(String(s || '')).length; }

  function txt(x, y, s, size, font, fill, weight) {
    return '<text x="' + n(x) + '" y="' + n(y) + '" font-size="' + n(size) + '" font-family=\'' + font + '\' fill="' + (fill || INK) + '" text-anchor="middle" dominant-baseline="central"' + (weight ? ' font-weight="' + weight + '"' : '') + '>' + esc(s) + '</text>';
  }

  function fill(kind, i, color) {
    if (!color) return '#ffffff';
    if (kind === 'word') return TINTS[i % TINTS.length];
    return KIND_FILL[kind] || '#ffffff';
  }

  // The inside of one square: picture, word, pinyin, task line, action, card…
  function content(sq, x, y, w, h, data, opt) {
    opt = opt || {};
    var o = data.options;
    var cx = x + w / 2;
    var parts = [];   // {h, draw(yTop)}
    var word = sq.word >= 0 ? data.words[sq.word] : null;

    function line(str, ratio, maxH, font, color, weight) {
      if (!str) return;
      var fs = Math.min(maxH, (w * 0.88) / Math.max(1, len(str) * ratio));
      if (fs < 1.4) return;
      parts.push({ h: fs * 1.18, draw: function (top) { return txt(cx, top + fs * 0.6, str, fs, font, color, weight); } });
    }

    if (sq.kind === 'start' || sq.kind === 'end') {
      line(sq.kind === 'start' ? '起点' : '终点', 1, h * 0.3, FONT_ZH, INK, 700);
      line(sq.kind === 'start' ? 'START' : 'FINISH 🏁', 0.62, h * 0.15, FONT_UI, INK, 700);
    } else if (sq.kind === 'special') {
      line(sq.special.icon, 1, h * 0.3, FONT_UI);
      line(sq.special.zh, 1, h * 0.2, FONT_ZH, INK, 700);
      if (o.show !== 'zh') line(sq.special.py, 0.55, h * 0.12, FONT_PY);
    } else if (sq.kind === 'action') {
      line(sq.action.icon, 1, h * 0.28, FONT_UI);
      line(sq.action.zh, 1, h * 0.2, FONT_ZH, INK, 700);
      if (o.show !== 'zh' && sq.action.py) line(sq.action.py, 0.55, h * 0.11, FONT_PY);
    } else if (sq.kind === 'card') {
      line('⭐', 1, h * 0.34, FONT_UI);
      line('抽一张动作卡', 1, h * 0.17, FONT_ZH, INK, 700);
      if (o.show !== 'zh') line('chōu yì zhāng dòng zuò kǎ', 0.55, h * 0.1, FONT_PY);
    } else if (word) {
      var pic = o.pictures && !opt.small && state.pictures[word.zh];
      if (pic && !o.color) pic = pic.replace('/color/svg/', '/black/svg/');
      if (pic && h > 13) {
        var ph = h * (sq.kind === 'task' ? 0.3 : 0.36);
        parts.push({ h: ph, draw: function (top) { return '<image href="' + esc(pic) + '" x="' + n(cx - ph / 2) + '" y="' + n(top) + '" width="' + n(ph) + '" height="' + n(ph) + '"/>'; } });
      }
      var room = pic && h > 13 ? 0.26 : 0.38;
      if (sq.kind === 'task') room *= 0.85;
      if (o.show !== 'py') line(word.zh, 1, h * room, FONT_ZH, INK, 600);
      if (o.show !== 'zh') line(word.py, 0.55, h * (o.show === 'py' ? room * 0.75 : 0.15), FONT_PY);
      if (sq.kind === 'task') line(sq.task.icon + ' ' + sq.task.zh, 1, h * 0.12, FONT_ZH, '#7a4b00', 700);
    }
    var total = parts.reduce(function (s, p) { return s + p.h; }, 0);
    var top = y + (h - total) / 2;
    return parts.map(function (p) { var out = p.draw(top); top += p.h; return out; }).join('');
  }

  function squareRect(x, y, w, h, color, stroke, r) {
    return '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '" rx="' + n(r || 0) + '" fill="' + color + '" stroke="' + (stroke || '#4a5a52') + '" stroke-width="0.35"/>';
  }

  function svg(w, h, body) {
    return '<svg class="bg-svg" viewBox="0 0 ' + n(w) + ' ' + n(h) + '" style="width:' + n(w) + 'mm;height:' + n(h) + 'mm">' + body + '</svg>';
  }

  // ---------- boards ----------

  function drawPath(layout, W, H) {
    var data = layout.data, color = data.options.color;
    var cols = layout.cols, rows = layout.rows, gx = 1.6, gy = 6;
    var cw = (W - (cols - 1) * gx) / cols;
    var ch = Math.min((H - (rows - 1) * gy) / rows, cw * 0.95);
    var totalH = rows * ch + (rows - 1) * gy;
    var oy = (H - totalH) / 2;
    var pos = function (sq) { return { x: sq.col * (cw + gx), y: oy + sq.row * (ch + gy) }; };
    var road = layout.squares.map(function (sq) { var p = pos(sq); return n(p.x + cw / 2) + ',' + n(p.y + ch / 2); }).join(' ');
    var body = '<polyline points="' + road + '" fill="none" stroke="' + (color ? '#e6d8b8' : '#dddddd') + '" stroke-width="' + n(ch * 0.42) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    // arrows between rows
    layout.squares.forEach(function (sq, i) {
      var next = layout.squares[i + 1];
      if (!next || next.row === sq.row) return;
      var p = pos(sq), q = pos(next);
      var x = p.x + cw / 2, y1 = p.y, y2 = q.y + ch;
      body += '<path d="M' + n(x) + ' ' + n(y1 - 0.6) + ' L' + n(x) + ' ' + n(y2 + 1.6) + '" stroke="' + INK + '" stroke-width="0.7"/>' +
        '<path d="M' + n(x - 1.6) + ' ' + n(y2 + 2.4) + ' L' + n(x) + ' ' + n(y2 + 0.4) + ' L' + n(x + 1.6) + ' ' + n(y2 + 2.4) + '" fill="none" stroke="' + INK + '" stroke-width="0.7"/>';
    });
    layout.squares.forEach(function (sq, i) {
      var p = pos(sq);
      body += squareRect(p.x, p.y, cw, ch, fill(sq.kind, i, color), null, 2.2) + content(sq, p.x, p.y, cw, ch, data);
    });
    return svg(W, H, body);
  }

  function drawLadder(layout, W, H) {
    var data = layout.data, color = data.options.color, size = layout.size;
    var S = Math.min(W, H), c = S / size, ox = (W - S) / 2;
    var pos = function (i) { var sq = layout.squares[i]; return { x: ox + sq.col * c, y: sq.row * c }; };
    var body = '';
    layout.squares.forEach(function (sq, i) {
      var p = pos(i);
      body += squareRect(p.x, p.y, c, c, fill(sq.kind, sq.row + sq.col, color), null, 0) +
        '<text x="' + n(p.x + 1) + '" y="' + n(p.y + c * 0.13) + '" font-size="' + n(c * 0.14) + '" font-family=\'' + FONT_UI + '\' fill="#6b7d74">' + (i + 1) + '</text>' +
        content(sq, p.x, p.y + c * 0.08, c, c * 0.92, data, { small: c < 16 });
    });
    layout.links.forEach(function (link) {
      var a = pos(link.from), b = pos(link.to);
      var x1 = a.x + c / 2, y1 = a.y + c / 2, x2 = b.x + c / 2, y2 = b.y + c / 2;
      var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy), ux = -dy / L, uy = dx / L;
      if (link.kind === 'ladder') {
        var d = c * 0.15, stroke = color ? '#8d5a2b' : '#333';
        body += '<g opacity="0.85" stroke="' + stroke + '" stroke-width="0.9" stroke-linecap="round">' +
          '<line x1="' + n(x1 + ux * d) + '" y1="' + n(y1 + uy * d) + '" x2="' + n(x2 + ux * d) + '" y2="' + n(y2 + uy * d) + '"/>' +
          '<line x1="' + n(x1 - ux * d) + '" y1="' + n(y1 - uy * d) + '" x2="' + n(x2 - ux * d) + '" y2="' + n(y2 - uy * d) + '"/>';
        var rungs = Math.max(2, Math.floor(L / (c * 0.32)));
        for (var k = 1; k < rungs; k++) {
          var t = k / rungs, rx = x1 + dx * t, ry = y1 + dy * t;
          body += '<line x1="' + n(rx + ux * d) + '" y1="' + n(ry + uy * d) + '" x2="' + n(rx - ux * d) + '" y2="' + n(ry - uy * d) + '"/>';
        }
        body += '</g>';
      } else {
        var mx = (x1 + x2) / 2 + ux * c * 0.6, my = (y1 + y2) / 2 + uy * c * 0.6;
        var path = 'M' + n(x1) + ' ' + n(y1) + ' Q' + n(mx) + ' ' + n(my) + ' ' + n(x2) + ' ' + n(y2);
        body += '<g opacity="0.55" fill="none" stroke-linecap="round">' +
          '<path d="' + path + '" stroke="' + (color ? '#c2185b' : '#444') + '" stroke-width="' + n(c * 0.2) + '"/>' +
          '<path d="' + path + '" stroke="' + (color ? '#f8a5c2' : '#ddd') + '" stroke-width="' + n(c * 0.12) + '"/>' +
          '</g><circle cx="' + n(x2) + '" cy="' + n(y2) + '" r="' + n(c * 0.1) + '" fill="' + (color ? '#c2185b' : '#444') + '" opacity="0.85"/>';
      }
    });
    return svg(W, S, body);
  }

  function drawLine(layout, W, H) {
    var data = layout.data, color = data.options.color, size = layout.size;
    var S = Math.min(W, H), c = S / size, ox = (W - S) / 2;
    var body = '';
    layout.squares.forEach(function (sq) {
      var x = ox + sq.col * c, y = sq.row * c;
      body += squareRect(x + 0.6, y + 0.6, c - 1.2, c - 1.2, fill(sq.kind, sq.row + sq.col, color), null, 1.6) + content(sq, x + 0.6, y + 0.6, c - 1.2, c - 1.2, data);
    });
    return svg(W, S, body);
  }

  function drawFlight(layout, W, H) {
    var data = layout.data, color = data.options.color;
    var S = Math.min(W, H), c = S / 15, ox = (W - S) / 2;
    var teams = core.TEAMS;
    var body = '';
    var at = function (col, row) { return { x: ox + col * c, y: row * c }; };
    // bases
    layout.teams.forEach(function (ft, t) {
      var team = teams[t], p = at(ft.base[0], ft.base[1]);
      body += '<rect x="' + n(p.x + 0.5) + '" y="' + n(p.y + 0.5) + '" width="' + n(6 * c - 1) + '" height="' + n(6 * c - 1) + '" rx="3" fill="' + (color ? team.soft : '#fff') + '" stroke="' + (color ? team.color : INK) + '" stroke-width="0.8"/>';
      body += txt(p.x + 3 * c, p.y + c * 1.1, team.shape + ' ' + team.zh + (ZH ? '队' : ' · ' + team.en), c * 0.62, FONT_UI, color ? team.color : INK, 700);
      [[2, 3.4], [4, 3.4]].forEach(function (spot) {
        body += '<circle cx="' + n(p.x + spot[0] * c) + '" cy="' + n(p.y + spot[1] * c) + '" r="' + n(c * 0.75) + '" fill="#fff" stroke="' + (color ? team.color : INK) + '" stroke-width="0.5" stroke-dasharray="1 0.8"/>';
      });
      body += txt(p.x + 3 * c, p.y + 5.1 * c, T('Base', '基地'), c * 0.45, FONT_UI, '#4a5a52');
      // home column
      ft.home.forEach(function (xy) {
        var q = at(xy[0], xy[1]);
        body += squareRect(q.x, q.y, c, c, color ? team.color : '#fff', null, 0) + (color ? '' : txt(q.x + c / 2, q.y + c / 2, team.shape, c * 0.5, FONT_UI));
      });
    });
    // centre
    var m = at(6, 6), mid = { x: m.x + 1.5 * c, y: m.y + 1.5 * c };
    var corners = [[m.x, m.y + 3 * c, m.x, m.y], [m.x, m.y, m.x + 3 * c, m.y], [m.x + 3 * c, m.y, m.x + 3 * c, m.y + 3 * c], [m.x + 3 * c, m.y + 3 * c, m.x, m.y + 3 * c]];
    corners.forEach(function (k, t) {
      body += '<path d="M' + n(k[0]) + ' ' + n(k[1]) + ' L' + n(k[2]) + ' ' + n(k[3]) + ' L' + n(mid.x) + ' ' + n(mid.y) + ' Z" fill="' + (color ? teams[t].color : '#fff') + '" stroke="' + INK + '" stroke-width="0.35"/>';
    });
    body += '<circle cx="' + n(mid.x) + '" cy="' + n(mid.y) + '" r="' + n(c * 0.7) + '" fill="#fff" stroke="' + INK + '" stroke-width="0.35"/>' + txt(mid.x, mid.y, '终点', c * 0.42, FONT_ZH, INK, 700);
    // track
    layout.squares.forEach(function (sq) {
      var p = at(sq.col, sq.row), team = teams[sq.team];
      var bg = sq.kind === 'start' ? (color ? team.color : '#fff') : (color ? team.soft : '#fff');
      body += squareRect(p.x, p.y, c, c, bg, null, 0);
      if (!color) body += '<text x="' + n(p.x + c - 0.4) + '" y="' + n(p.y + c * 0.22) + '" font-size="' + n(c * 0.2) + '" text-anchor="end" font-family=\'' + FONT_UI + '\'>' + team.shape + '</text>';
      if (sq.kind === 'start') body += txt(p.x + c / 2, p.y + c * 0.4, '✈', c * 0.42, FONT_UI, color ? '#fff' : INK) + txt(p.x + c / 2, p.y + c * 0.78, '起飞', c * 0.24, FONT_ZH, color ? '#fff' : INK, 700);
      else body += content(sq, p.x + 0.3, p.y + 0.3, c - 0.6, c - 0.6, data, { small: true });
    });
    return svg(W, S, body);
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
    var draw = { path: drawPath, ladder: drawLadder, line: drawLine, flight: drawFlight }[data.board];
    return sheet('<div class="bg-sheet-head"><h2>' + esc(title) + '</h2><span>' + esc(sub) + '</span></div>' +
      '<div class="bg-board">' + draw(layout, W, H) + '</div>', land);
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

  // ---------- start ----------

  buildPickLists();
  var handoff = window.ChenWordlistHandoff;
  var handed = handoff && handoff.active();
  if (handed) {
    $('bgWords').value = handed.items.map(function (item) { return [item.zh, item.py, item.en].filter(Boolean).join(' | '); }).join('\n');
    if (handed.name) $('bgTitle').value = handed.name;
    handoff.mountBar(handed);
  }
  render();
  if (document.readyState === 'complete') bindTemplate();
  else window.addEventListener('load', bindTemplate);
})();
