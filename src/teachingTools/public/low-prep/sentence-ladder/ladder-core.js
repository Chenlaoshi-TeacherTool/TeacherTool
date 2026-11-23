/*
 * 扩句阶梯 · Sentence Ladder — shared model (browser + server).
 *
 * A ladder is one finished sentence cut into segments. Each segment says
 *   row   — the row (0-based) where it first appears, and
 *   blank — for how many rows it is a blank before it is printed as text
 *           (0 = given text, ALWAYS = stays a blank to the end).
 * Row k shows every segment with row <= k; it is a blank while k < row + blank.
 * The segments with row === k are "new" in that row and get its colour.
 *
 * Levels change the scaffolding, not the sentence:
 *   basic  — first 4 rows, word box with the answer + distractors
 *   mid    — first 5 rows, word box with the answers only
 *   native — all rows, no word box
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SentenceLadder = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ALWAYS = 9;
  var MAX_ROWS = 8;
  var MAX_SEGMENTS = 60;
  var MAX_OPTS = 3;
  var LAYOUTS = ['single', 'pile', 'row', 'pair'];
  var BACKGROUNDS = ['room', 'outdoor', 'snow', 'sky', 'plain'];
  var KINDS = ['thing', 'event'];
  var LEVELS = {
    basic: { rows: 4, bank: 'choices' },
    mid: { rows: 5, bank: 'answers' },
    native: { rows: MAX_ROWS, bank: 'none' }
  };
  // Soft row colours; row i uses COLORS[i % length].
  var COLORS = ['#f2dfb4', '#c9e4f0', '#f4cbd3', '#f8d6b8', '#d6eac2', '#ddd2f0', '#c8e6dd', '#f5e3a3'];

  // Default dimension ladders for each kind (the teacher can rename, add, drop, reorder).
  var DIMENSIONS = {
    thing: ['加量词', '加地点', '加颜色', '加外形', '加修辞', '加感受'],
    event: ['加人物', '加地点', '加时间', '加环境', '加动作', '加对话']
  };
  // Suggestions offered when the teacher adds a row.
  var LABEL_SUGGESTIONS = ['加量词', '加人物', '加地点', '加时间', '加颜色', '加外形', '加大小', '加环境', '加动作',
    '加声音', '加味道', '加功能', '加修辞', '加对话', '加心情', '加感受'];

  var HAN = /[㐀-鿿豈-﫿]/;
  var END_PUNCT = /[。！？!?…”」』]$/;

  function fail(message) {
    var error = new Error(message);
    error.status = 400;
    throw error;
  }

  function text(value, max) {
    return typeof value === 'string' ? value.normalize('NFC').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').slice(0, max) : '';
  }

  function trimText(value, max) {
    return text(value, max).trim();
  }

  function clampInt(value, min, max, fallback) {
    var n = Math.round(Number(value));
    return isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function cleanScene(scene) {
    scene = scene && typeof scene === 'object' ? scene : {};
    var items = Array.isArray(scene.items) ? scene.items.filter(function (hex) {
      return typeof hex === 'string' && /^[0-9A-F]{4,6}(-[0-9A-F]{4,6}){0,6}$/.test(hex);
    }).slice(0, 6) : [];
    return {
      layout: LAYOUTS.indexOf(scene.layout) >= 0 ? scene.layout : 'single',
      bg: BACKGROUNDS.indexOf(scene.bg) >= 0 ? scene.bg : 'plain',
      items: items
    };
  }

  // Uploaded pictures travel as small JPEG/PNG data URLs (the share limit is 64 kB).
  function cleanImage(value) {
    if (typeof value !== 'string' || !value) return '';
    if (value.length > 48000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return '';
    return value;
  }

  // Turns anything (a draft, a template, a share payload) into a clean ladder.
  // Never throws; use validate() to check it is usable.
  function normalize(data) {
    data = data && typeof data === 'object' ? data : {};
    var rows = (Array.isArray(data.rows) ? data.rows : []).slice(0, MAX_ROWS).map(function (row) {
      return { label: trimText(row && row.label, 12) || '加…' };
    });
    var rowCount = rows.length;
    var segs = (Array.isArray(data.segs) ? data.segs : []).slice(0, MAX_SEGMENTS).map(function (seg) {
      seg = seg || {};
      var opts = (Array.isArray(seg.opts) ? seg.opts : []).map(function (opt) { return trimText(opt, 20); }).filter(Boolean).slice(0, MAX_OPTS);
      return {
        t: text(seg.t, 60),
        row: clampInt(seg.row, 0, Math.max(0, rowCount - 1), 0),
        blank: clampInt(seg.blank, 0, ALWAYS, 0),
        opts: opts,
        py: trimText(seg.py, 120)
      };
    }).filter(function (seg) { return seg.t.trim(); });
    return {
      v: 1,
      title: trimText(data.title, 60),
      kind: KINDS.indexOf(data.kind) >= 0 ? data.kind : 'thing',
      topic: trimText(data.topic, 12),
      topicPy: trimText(data.topicPy, 60),
      level: LEVELS[data.level] ? data.level : 'native',
      shown: clampInt(data.shown, 0, MAX_ROWS, 0),
      showPy: data.showPy !== false,
      script: data.script === 't' ? 't' : 's',
      scene: cleanScene(data.scene),
      image: cleanImage(data.image),
      rows: rows,
      segs: segs
    };
  }

  function validate(model) {
    if (!model.rows.length) return '请至少加一行。 Add at least one row.';
    if (!model.segs.length) return '请先写句子。 Write the sentence first.';
    if (!model.segs.some(function (seg) { return seg.blank > 0; })) return '请至少留一个空。 Leave at least one blank.';
    return '';
  }

  // The server-side sanitizer for templates and student links.
  function sanitize(data) {
    var model = normalize(data);
    var problem = validate(model);
    if (problem) fail(problem);
    return model;
  }

  // How many rows this level shows. `shown` (0 = level default) is the teacher's override.
  function rowCount(model, level) {
    var settings = LEVELS[level || model.level] || LEVELS.native;
    var limit = model.shown || settings.rows;
    return Math.max(1, Math.min(model.rows.length, limit));
  }

  function isBlankIn(seg, k) {
    return seg.blank > 0 && k < seg.row + seg.blank;
  }

  // The parts of row k: [{ index, seg, blank, isNew }]
  function rowParts(model, k) {
    var parts = [];
    model.segs.forEach(function (seg, index) {
      if (seg.row > k) return;
      parts.push({ index: index, seg: seg, blank: isBlankIn(seg, k), isNew: seg.row === k });
    });
    return parts;
  }

  // Row k needs a full stop when its visible text does not already end with one.
  function rowEnding(model, k) {
    var parts = rowParts(model, k);
    var last = parts[parts.length - 1];
    if (!last) return '';
    if (!last.blank && END_PUNCT.test(last.seg.t.trim())) return '';
    return '。';
  }

  // Blanks a student answers: every segment that is ever a blank inside the shown rows.
  function answerSlots(model, level) {
    var count = rowCount(model, level);
    var slots = [];
    model.segs.forEach(function (seg, index) {
      if (seg.blank > 0 && seg.row < count) slots.push(index);
    });
    return slots;
  }

  // Deterministic shuffle so a printed sheet and its key match.
  function seededShuffle(list, seed) {
    var out = list.slice();
    var s = 0;
    String(seed).split('').forEach(function (ch) { s = (s * 31 + ch.charCodeAt(0)) >>> 0; });
    for (var i = out.length - 1; i > 0; i -= 1) {
      s = (s * 1103515245 + 12345) >>> 0;
      var j = s % (i + 1);
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  // Choices for one blank (answer + distractors), in a stable mixed order.
  function choicesFor(seg, index) {
    var all = [seg.t.trim()].concat(seg.opts.filter(function (opt) { return opt !== seg.t.trim(); }));
    return seededShuffle(all, seg.t + '|' + index);
  }

  // The word box shown under row k: [{ index, words }] for each new blank in that row.
  function wordBox(model, k, level) {
    var bank = (LEVELS[level || model.level] || LEVELS.native).bank;
    if (bank === 'none') return [];
    return rowParts(model, k).filter(function (part) { return part.isNew && part.blank; }).map(function (part) {
      return { index: part.index, words: bank === 'choices' ? choicesFor(part.seg, part.index) : [part.seg.t.trim()] };
    });
  }

  // The finished sentence (all segments), e.g. for the answer key and the gallery.
  function fullText(model, answers) {
    return model.segs.map(function (seg, index) {
      if (answers && seg.blank > 0) return typeof answers[index] === 'string' ? answers[index] : '';
      return seg.t;
    }).join('');
  }

  function normalizeAnswer(value) {
    return String(value || '').normalize('NFC').replace(/\s+/g, '').replace(/[，。！？、,.!?]/g, '');
  }

  // What a student sends: { answers: { segIndex: text } }.
  function cleanWork(payload, work) {
    var model = normalize(payload);
    var slots = answerSlots(model);
    var given = work && work.answers && typeof work.answers === 'object' ? work.answers : {};
    var answers = {};
    var filled = 0;
    slots.forEach(function (index) {
      var value = trimText(given[index], 80);
      answers[index] = value;
      if (value) filled += 1;
    });
    if (!filled) fail('请先填一填再提交。 Fill in at least one blank first.');
    var result = { answers: answers };
    // Word-box choices can be checked; free writing is read by the teacher.
    if ((LEVELS[model.level] || {}).bank === 'choices') {
      var correct = {};
      var score = 0;
      slots.forEach(function (index) {
        var right = normalizeAnswer(answers[index]) === normalizeAnswer(model.segs[index].t);
        correct[index] = right;
        if (right) score += 1;
      });
      result.correct = correct;
      result.score = score;
      result.total = slots.length;
    }
    return result;
  }

  // A ready-to-edit blank ladder for a kind.
  function blank(kind) {
    kind = KINDS.indexOf(kind) >= 0 ? kind : 'thing';
    return normalize({
      kind: kind,
      rows: DIMENSIONS[kind].map(function (label) { return { label: label }; }),
      segs: [],
      level: 'native',
      scene: { layout: 'single', bg: kind === 'event' ? 'outdoor' : 'room', items: [] }
    });
  }

  return {
    ALWAYS: ALWAYS,
    MAX_ROWS: MAX_ROWS,
    MAX_SEGMENTS: MAX_SEGMENTS,
    MAX_OPTS: MAX_OPTS,
    LAYOUTS: LAYOUTS,
    BACKGROUNDS: BACKGROUNDS,
    LEVELS: LEVELS,
    COLORS: COLORS,
    DIMENSIONS: DIMENSIONS,
    LABEL_SUGGESTIONS: LABEL_SUGGESTIONS,
    HAN: HAN,
    normalize: normalize,
    validate: validate,
    sanitize: sanitize,
    rowCount: rowCount,
    isBlankIn: isBlankIn,
    rowParts: rowParts,
    rowEnding: rowEnding,
    answerSlots: answerSlots,
    choicesFor: choicesFor,
    wordBox: wordBox,
    fullText: fullText,
    normalizeAnswer: normalizeAnswer,
    cleanWork: cleanWork,
    blank: blank
  };
});
