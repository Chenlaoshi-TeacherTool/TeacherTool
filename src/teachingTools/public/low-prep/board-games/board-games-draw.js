/*
 * 棋盘游戏 · Board Game Maker — board drawing, shared by the print page,
 * projector play and the online room pages. Boards are SVG in millimetres.
 *
 *   BoardGamesDraw.draw(layout, W, H, geom, pictures)
 *     layout   BoardGamesCore.generate(data)
 *     geom     optional object; filled with each square's rectangle (for pawns)
 *     pictures optional { word: emoji image URL }
 */
(function (global) {
  'use strict';

  var core = global.BoardGamesCore;
  var ZH = global.BG_LANG === 'zh' || (!global.BG_LANG && /^zh/i.test(document.documentElement.lang || ''));
  function T(en, zh) { return ZH ? zh : en; }
  var pictures = {};

  var BOARD_NAMES = {
    path: { zh: '前进游戏盘', en: 'Race Track' },
    ladder: { zh: '梯子滑梯棋', en: 'Ladders & Slides' },
    line: { zh: '连成一线', en: 'Get in a Row' },
    flight: { zh: '飞行棋', en: 'Flight Race' }
  };
  var TINTS = ['#fff4d6', '#e3f2fd', '#e8f5e9', '#fde7ef'];
  var KIND_FILL = { task: '#fff0b3', action: '#d8f3dc', card: '#eadffb', special: '#ffdcd1', start: '#bfe3c6', end: '#ffd166' };
  var INK = '#1f2d27';
  var FONT_ZH = '"KaiTi","STKaiti","Kaiti SC","Microsoft YaHei",serif';
  var FONT_PY = 'Andika,"Segoe UI",sans-serif';
  var FONT_UI = '"Microsoft YaHei","PingFang SC",sans-serif';

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
      var pic = o.pictures && !opt.small && pictures[word.zh];
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

  function drawPath(layout, W, H, geom) {
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
      if (geom) geom[i] = { x: p.x, y: p.y, w: cw, h: ch };
      body += squareRect(p.x, p.y, cw, ch, fill(sq.kind, i, color), null, 2.2) + content(sq, p.x, p.y, cw, ch, data);
    });
    return svg(W, H, body);
  }

  function drawLadder(layout, W, H, geom) {
    var data = layout.data, color = data.options.color, size = layout.size;
    var S = Math.min(W, H), c = S / size, ox = (W - S) / 2;
    var pos = function (i) { var sq = layout.squares[i]; return { x: ox + sq.col * c, y: sq.row * c }; };
    var body = '';
    layout.squares.forEach(function (sq, i) {
      var p = pos(i);
      if (geom) geom[i] = { x: p.x, y: p.y, w: c, h: c };
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

  function drawLine(layout, W, H, geom) {
    var data = layout.data, color = data.options.color, size = layout.size;
    var S = Math.min(W, H), c = S / size, ox = (W - S) / 2;
    var body = '';
    layout.squares.forEach(function (sq) {
      var x = ox + sq.col * c, y = sq.row * c;
      if (geom) geom[sq.i] = { x: x, y: y, w: c, h: c };
      body += squareRect(x + 0.6, y + 0.6, c - 1.2, c - 1.2, fill(sq.kind, sq.row + sq.col, color), null, 1.6) + content(sq, x + 0.6, y + 0.6, c - 1.2, c - 1.2, data);
    });
    return svg(W, S, body);
  }

  function drawFlight(layout, W, H, geom) {
    var data = layout.data, color = data.options.color;
    var S = Math.min(W, H), c = S / 15, ox = (W - S) / 2;
    var teams = core.TEAMS;
    var body = '';
    var at = function (col, row) { return { x: ox + col * c, y: row * c }; };
    // bases
    layout.teams.forEach(function (ft, t) {
      var team = teams[t], p = at(ft.base[0], ft.base[1]);
      if (geom) geom['base' + t] = { x: p.x + 1.5 * c, y: p.y + 2.6 * c, w: 3 * c, h: 1.6 * c };
      body += '<rect x="' + n(p.x + 0.5) + '" y="' + n(p.y + 0.5) + '" width="' + n(6 * c - 1) + '" height="' + n(6 * c - 1) + '" rx="3" fill="' + (color ? team.soft : '#fff') + '" stroke="' + (color ? team.color : INK) + '" stroke-width="0.8"/>';
      body += txt(p.x + 3 * c, p.y + c * 1.1, team.shape + ' ' + team.zh + (ZH ? '队' : ' · ' + team.en), c * 0.62, FONT_UI, color ? team.color : INK, 700);
      [[2, 3.4], [4, 3.4]].forEach(function (spot) {
        body += '<circle cx="' + n(p.x + spot[0] * c) + '" cy="' + n(p.y + spot[1] * c) + '" r="' + n(c * 0.75) + '" fill="#fff" stroke="' + (color ? team.color : INK) + '" stroke-width="0.5" stroke-dasharray="1 0.8"/>';
      });
      body += txt(p.x + 3 * c, p.y + 5.1 * c, T('Base', '基地'), c * 0.45, FONT_UI, '#4a5a52');
      // home column
      ft.home.forEach(function (xy, k) {
        var q = at(xy[0], xy[1]);
        if (geom) geom['home' + t + '_' + k] = { x: q.x, y: q.y, w: c, h: c };
        body += squareRect(q.x, q.y, c, c, color ? team.color : '#fff', null, 0) + (color ? '' : txt(q.x + c / 2, q.y + c / 2, team.shape, c * 0.5, FONT_UI));
      });
    });
    // centre
    var m = at(6, 6), mid = { x: m.x + 1.5 * c, y: m.y + 1.5 * c };
    if (geom) geom.centre = { x: m.x + c, y: m.y + c, w: c, h: c };
    var corners = [[m.x, m.y + 3 * c, m.x, m.y], [m.x, m.y, m.x + 3 * c, m.y], [m.x + 3 * c, m.y, m.x + 3 * c, m.y + 3 * c], [m.x + 3 * c, m.y + 3 * c, m.x, m.y + 3 * c]];
    corners.forEach(function (k, t) {
      body += '<path d="M' + n(k[0]) + ' ' + n(k[1]) + ' L' + n(k[2]) + ' ' + n(k[3]) + ' L' + n(mid.x) + ' ' + n(mid.y) + ' Z" fill="' + (color ? teams[t].color : '#fff') + '" stroke="' + INK + '" stroke-width="0.35"/>';
    });
    body += '<circle cx="' + n(mid.x) + '" cy="' + n(mid.y) + '" r="' + n(c * 0.7) + '" fill="#fff" stroke="' + INK + '" stroke-width="0.35"/>' + txt(mid.x, mid.y, '终点', c * 0.42, FONT_ZH, INK, 700);
    // track
    layout.squares.forEach(function (sq) {
      var p = at(sq.col, sq.row), team = teams[sq.team];
      if (geom) geom[sq.i] = { x: p.x, y: p.y, w: c, h: c };
      var bg = sq.kind === 'start' ? (color ? team.color : '#fff') : (color ? team.soft : '#fff');
      body += squareRect(p.x, p.y, c, c, bg, null, 0);
      if (!color) body += '<text x="' + n(p.x + c - 0.4) + '" y="' + n(p.y + c * 0.22) + '" font-size="' + n(c * 0.2) + '" text-anchor="end" font-family=\'' + FONT_UI + '\'>' + team.shape + '</text>';
      if (sq.kind === 'start') body += txt(p.x + c / 2, p.y + c * 0.4, '✈', c * 0.42, FONT_UI, color ? '#fff' : INK) + txt(p.x + c / 2, p.y + c * 0.78, '起飞', c * 0.24, FONT_ZH, color ? '#fff' : INK, 700);
      else body += content(sq, p.x + 0.3, p.y + 0.3, c - 0.6, c - 0.6, data, { small: true });
    });
    return svg(W, S, body);
  }

  global.BoardGamesDraw = {
    draw: function (layout, W, H, geom, pics) {
      pictures = pics || {};
      return { path: drawPath, ladder: drawLadder, line: drawLine, flight: drawFlight }[layout.data.board](layout, W, H, geom);
    },
    BOARD_NAMES: BOARD_NAMES, INK: INK, FONT_UI: FONT_UI, FONT_ZH: FONT_ZH, FONT_PY: FONT_PY,
    esc: esc, n: n, txt: txt, svg: svg
  };
})(window);
