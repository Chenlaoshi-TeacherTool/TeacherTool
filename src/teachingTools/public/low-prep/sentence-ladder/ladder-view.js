/*
 * 扩句阶梯 · rendering shared by the teacher page and the student link.
 * Needs ladder-core.js (SentenceLadder), /shared/zh-script.js (ChenZhScript) and,
 * for pinyin, wordlist-core.js (ChenWordlist).
 */
(function (global) {
  'use strict';

  var Core = global.SentenceLadder;
  var HAN = /[㐀-鿿豈-﫿]/;
  var EMOJI_BASE = 'https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg/';
  var Zh = global.ChenZhScript;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  // 简 ⇄ 繁 comes from the site-wide /shared/zh-script.js (ChenZhScript).
  function loadTable() {
    return Zh.load().then(function () {});
  }

  function display(model, value) {
    return model.script === 't' ? Zh.toTraditional(value) : String(value || '');
  }

  function hanCount(value) {
    return Array.from(String(value || '')).filter(function (ch) { return HAN.test(ch); }).length;
  }

  // Pinyin syllables for a piece of text, one per Chinese character.
  function syllables(value) {
    var source = Zh.toSimplified(value);
    var CW = global.ChenWordlist;
    var out = [];
    (source.match(/[㐀-鿿豈-﫿]+/g) || []).forEach(function (run) {
      var chars = Array.from(run);
      var py = CW ? CW.toPinyin(run, { spaced: true }).split(' ') : [];
      if (py.length !== chars.length) py = chars.map(function (ch) { return CW ? CW.toPinyin(ch) : ''; });
      out = out.concat(py);
    });
    return out;
  }

  // Syllables for every segment, worked out on the whole sentence so 一/不 and
  // polyphones get their context. A teacher's own pinyin (seg.py) wins when it fits.
  function segmentPinyin(model) {
    var all = syllables(model.segs.map(function (seg) { return seg.t; }).join(''));
    var at = 0;
    return model.segs.map(function (seg) {
      var count = hanCount(seg.t);
      var auto = all.slice(at, at + count);
      at += count;
      var own = seg.py ? seg.py.trim().split(/\s+/) : [];
      return own.length === count ? own : auto;
    });
  }

  // Fills seg.py with the current pinyin so other computers show the same reading.
  function freezePinyin(model) {
    var py = segmentPinyin(model);
    model.segs.forEach(function (seg, index) { seg.py = py[index].join(' '); });
    if (!model.topicPy) model.topicPy = syllables(model.topic).join(' ');
    return model;
  }

  function topicPinyin(model) {
    var own = model.topicPy ? model.topicPy.trim().split(/\s+/) : [];
    return own.length === hanCount(model.topic) ? own : syllables(model.topic);
  }

  // Characters with pinyin above. Non-Chinese characters sit on the same baseline.
  function ruby(text, py, showPy) {
    var html = '';
    var k = 0;
    Array.from(String(text || '')).forEach(function (ch) {
      if (HAN.test(ch)) {
        html += '<span class="sl-r">' + (showPy ? '<span class="sl-py">' + esc(py[k] || '') + '</span>' : '') + '<span class="sl-zh">' + esc(ch) + '</span></span>';
        k += 1;
      } else if (ch === ' ') {
        html += '<span class="sl-sp"> </span>';
      } else {
        html += '<span class="sl-r sl-punct">' + (showPy ? '<span class="sl-py"></span>' : '') + '<span class="sl-zh">' + esc(ch) + '</span></span>';
      }
    });
    return html;
  }

  // Width of a writing line, in em of the Chinese text.
  function blankWidth(seg, open) {
    var length = Array.from(seg.t.trim()).length;
    var em = Math.max(open ? 5 : 2.6, length * 1.25 + 1.2);
    return Math.min(open ? 22 : 16, em);
  }

  // One row as HTML.
  // options: { mode: 'sheet' | 'key' | 'student', answers, showPy, py, input }
  //   input(part) → HTML for a live blank (student page)
  // Punctuation that must not start a line (glued to what comes before) or
  // end a line (glued to what comes after).
  var NO_LINE_START = /^[，。、；：！？）》」』”’…,.;:!?)]$/;
  var NO_LINE_END = /^[“‘（《「『(]$/;

  // Characters of `text` as separate pieces: [{ html, ch }]
  function rubyPieces(text, py, showPy) {
    var pieces = [];
    var k = 0;
    Array.from(String(text || '')).forEach(function (ch) {
      if (HAN.test(ch)) {
        pieces.push({ ch: ch, html: '<span class="sl-r">' + (showPy ? '<span class="sl-py">' + esc(py[k] || '') + '</span>' : '') + '<span class="sl-zh">' + esc(ch) + '</span></span>' });
        k += 1;
      } else if (ch === ' ') {
        pieces.push({ ch: ch, html: '<span class="sl-sp"> </span>' });
      } else {
        pieces.push({ ch: ch, html: '<span class="sl-r sl-punct">' + (showPy ? '<span class="sl-py"></span>' : '') + '<span class="sl-zh">' + esc(ch) + '</span></span>' });
      }
    });
    return pieces;
  }

  // Joins pieces into HTML. Each piece carries the opening tag of its segment
  // (`wrap`); a closing mark is kept on the same line as the piece before it,
  // an opening mark with the piece after it (no line starts with ，or 。).
  function joinPieces(pieces) {
    var chunks = [];
    var glueNext = false;
    pieces.forEach(function (piece) {
      var current = chunks[chunks.length - 1];
      if (current && (glueNext || NO_LINE_START.test(piece.ch || ''))) {
        // Glue only the last piece before the mark, so long runs can still wrap.
        if (!current.glued && current.items.length > 1) {
          current = { glued: false, items: [current.items.pop()] };
          chunks.push(current);
        }
        current.glued = true;
        current.items.push(piece);
      } else if (current && !current.glued && !glueNext && current.items[0].wrap === piece.wrap && !NO_LINE_END.test(piece.ch || '')) {
        current.items.push(piece);
      } else {
        chunks.push({ glued: false, items: [piece] });
      }
      glueNext = NO_LINE_END.test(piece.ch || '');
    });
    return chunks.map(function (chunk) {
      var html = '';
      var openWrap = null;
      chunk.items.forEach(function (piece) {
        if (piece.wrap !== openWrap) {
          if (openWrap) html += '</span>';
          if (piece.wrap) html += piece.wrap;
          openWrap = piece.wrap || null;
        }
        html += piece.html;
      });
      if (openWrap) html += '</span>';
      return chunk.glued ? '<span class="sl-glue">' + html + '</span>' : html;
    }).join('');
  }

  function rowHtml(model, k, options) {
    options = options || {};
    var py = options.py || segmentPinyin(model);
    var showPy = options.showPy !== undefined ? options.showPy : model.showPy;
    var color = Core.COLORS[k % Core.COLORS.length];
    var last = Core.rowCount(model) - 1;
    var pieces = [];
    function add(wrap, list) {
      list.forEach(function (piece) { pieces.push({ wrap: wrap, html: piece.html, ch: piece.ch }); });
    }
    Core.rowParts(model, k).forEach(function (part) {
      var seg = part.seg;
      var cls = 'sl-seg' + (part.isNew ? ' is-new' : '');
      var style = part.isNew ? ' style="--sl-row:' + color + '"' : '';
      var wrap = '<span class="' + cls + '"' + style + '>';
      var answer = options.answers && typeof options.answers[part.index] === 'string' ? options.answers[part.index] : null;
      if (options.mode === 'student' && seg.blank > 0) {
        if (part.isNew && options.input) { add('<span class="' + cls + ' sl-live"' + style + '>', [{ html: options.input(part) }]); return; }
        if (answer) { add('<span class="' + cls + ' sl-mine"' + style + '>', rubyPieces(display(model, answer), [], false)); return; }
        add(wrap, [{ html: '<span class="sl-blank" style="width:' + blankWidth(seg, k >= last) + 'em"></span>' }]);
        return;
      }
      if (part.blank) {
        var open = seg.blank >= Core.ALWAYS || seg.row + seg.blank > last;
        var inner = options.mode === 'key' ? '<span class="sl-key">' + esc(display(model, seg.t)) + '</span>' : '';
        add(wrap, [{ html: '<span class="sl-blank' + (open ? ' is-open' : '') + '" style="width:' + blankWidth(seg, open) + 'em">' + inner + '</span>' }]);
        return;
      }
      add(wrap, rubyPieces(display(model, seg.t), py[part.index], showPy));
    });
    var ending = Core.rowEnding(model, k);
    if (ending) add('', rubyPieces(ending, [], showPy));
    return joinPieces(pieces);
  }

  function wordBoxHtml(model, k, level) {
    var box = Core.wordBox(model, k, level);
    if (!box.length) return '';
    var many = box.length > 1;
    var marks = ['①', '②', '③', '④', '⑤', '⑥'];
    return '<div class="sl-wordbox"><span class="sl-wordbox-label">' + esc(display(model, '词语框')) + '</span>' + box.map(function (group, n) {
      return '<span class="sl-wordgroup">' + (many ? '<b>' + marks[n % marks.length] + '</b>' : '') + group.words.map(function (word) {
        return '<span class="sl-word">' + esc(display(model, word)) + '</span>';
      }).join('') + '</span>';
    }).join('') + '</div>';
  }

  // Emoji positions per layout: [left%, bottom%, height%, mirror]
  function placements(layout, count) {
    if (layout === 'single' || count === 1) return [[50, 10, 72, false]];
    if (layout === 'pile') {
      var spots = [[50, 8, 62, false], [22, 8, 30, false], [78, 8, 30, true], [50, 50, 28, false], [38, 10, 22, false], [62, 10, 22, true]];
      return spots.slice(0, count);
    }
    if (layout === 'pair') {
      var out = [[20, 8, 58, false]];
      var middle = count - 2;
      for (var m = 0; m < middle; m += 1) out.push([50 + (m - (middle - 1) / 2) * 14, 30, 30, false]);
      out.push([80, 8, 58, true]);
      return out;
    }
    var row = [];
    var size = count <= 3 ? 52 : count === 4 ? 42 : 34;
    for (var i = 0; i < count; i += 1) row.push([(i + 0.5) * (100 / count), 10, size, false]);
    return row;
  }

  function sceneHtml(model) {
    if (model.image) return '<div class="sl-scene sl-scene-photo"><img src="' + esc(model.image) + '" alt=""></div>';
    var items = model.scene.items;
    var spots = placements(model.scene.layout, items.length);
    var html = '<div class="sl-scene" data-bg="' + esc(model.scene.bg) + '">';
    items.forEach(function (hex, index) {
      var spot = spots[index];
      if (!spot) return;
      html += '<img class="sl-emoji' + (spot[3] ? ' is-mirrored' : '') + '" src="' + EMOJI_BASE + encodeURIComponent(hex) + '.svg" alt="" style="left:' + spot[0] + '%;bottom:' + spot[1] + '%;height:' + spot[2] + '%">';
    });
    if (!items.length) html += '<span class="sl-scene-empty">🖼️</span>';
    return html + '</div>';
  }

  function topicHtml(model) {
    var topic = display(model, model.topic || '');
    return '<span class="sl-topic">' + ruby(topic, topicPinyin(model), model.showPy) + '</span>';
  }

  function kindLabel(model) {
    return display(model, model.kind === 'event' ? '写事' : '写物');
  }

  global.SentenceLadderView = {
    esc: esc,
    loadTable: loadTable,
    display: display,
    syllables: syllables,
    segmentPinyin: segmentPinyin,
    freezePinyin: freezePinyin,
    topicPinyin: topicPinyin,
    ruby: ruby,
    blankWidth: blankWidth,
    rowHtml: rowHtml,
    wordBoxHtml: wordBoxHtml,
    sceneHtml: sceneHtml,
    topicHtml: topicHtml,
    kindLabel: kindLabel,
    emojiUrl: function (hex) { return EMOJI_BASE + encodeURIComponent(hex) + '.svg'; }
  };
})(typeof window !== 'undefined' ? window : this);
