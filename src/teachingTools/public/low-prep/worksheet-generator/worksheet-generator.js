(function () {
  'use strict';

  var STORAGE_KEY = 'wg-worksheet-v1';
  var CJK = /[㐀-鿿豈-﫿]/;
  var END_PUNCT = /[。？！?!.，,；;：:]+$/;
  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Shared with vocab-glossary / vocab-puzzle so the dictionary is cached once.
  var CEDICT_URL = '/low-prep/vocab-glossary/cedict.json.gz';

  // Filler characters for the word search grid (very common characters).
  var FILLER = '的一是不了人我在有他这中大来上个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可她里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长';

  // Each question type renders a section. `count` = default number of items;
  // `max` caps it; `needs: 'sentences'` means it uses the example sentences.
  var TYPES = [
    { key: 'vocab', zh: '词汇表', en: 'Vocabulary List', on: true, count: 0,
      instr: '读一读，记住这些词语。Read each word aloud.' },
    { key: 'match', zh: '连线题', en: 'Matching', on: true, count: 6, max: 8,
      instr: '把中文和英文连起来。Draw a line to match each word to its meaning.' },
    { key: 'mc', zh: '选择题', en: 'Multiple Choice', on: true, count: 5, max: 12,
      instr: '选出正确的词语，圈出字母。Circle the letter of the correct Chinese word.' },
    { key: 'tf', zh: '判断题', en: 'True or False', on: false, count: 5, max: 12,
      instr: '意思对的写 ✓，错的写 ✗。Write ✓ if the meaning is correct and ✗ if it is not.' },
    { key: 'pinyin', zh: '看拼音写汉字', en: 'Pinyin to Characters', on: true, count: 6, max: 15,
      instr: '看拼音，写汉字。Write the characters for each pinyin.' },
    { key: 'fill', zh: '选词填空', en: 'Fill in the Blanks', on: true, count: 5, max: 12, needs: 'sentences',
      instr: '从词库中选词填空。Choose a word from the word bank to complete each sentence.' },
    { key: 'reorder', zh: '句子排序', en: 'Sentence Order', on: false, count: 4, max: 10, needs: 'sentences',
      instr: '把词语排成正确的句子，写在线上。Put the words in order and write the sentence on the line.' },
    { key: 'translate', zh: '翻译题', en: 'Translation', on: false, count: 5, max: 12,
      instr: '写出英文的中文意思。Write the Chinese for each English word.' },
    { key: 'makeSentence', zh: '造句题', en: 'Make a Sentence', on: false, count: 3, max: 8,
      instr: '用下面的词语造句。Write a sentence using each word.' },
    { key: 'dictation', zh: '听写题', en: 'Dictation', on: false, count: 8, max: 15,
      instr: '听老师读词语，写在格子里。Listen to your teacher and write each word.' },
    { key: 'wordsearch', zh: '汉字搜索', en: 'Word Search', on: false, count: 8, max: 10,
      instr: '在格子里找出下面的词语，圈起来（横着或竖着）。Find and circle each word (across or down).' },
    { key: 'trace', zh: '田字格描红', en: 'Character Tracing', on: true, count: 6, max: 24,
      instr: '先描红，再自己写。Trace the grey characters, then write on your own.' }
  ];

  var SAMPLE_WORDS = [
    '爸爸 | bà ba | dad',
    '妈妈 | mā ma | mum',
    '哥哥 | gē ge | older brother',
    '姐姐 | jiě jie | older sister',
    '弟弟 | dì di | younger brother',
    '妹妹 | mèi mei | younger sister',
    '家 | jiā | home; family',
    '学校 | xué xiào | school'
  ].join('\n');

  var SAMPLE_SENTENCES = [
    '这是我的爸爸。',
    '我妈妈是老师。',
    '我的哥哥今年十岁。',
    '妹妹喜欢画画。',
    '弟弟每天去学校。'
  ].join('\n');

  var dict = null;
  var dictPromise = null;
  var seed = 1;
  var renderTimer = null;
  var el = {};
  var typeInputs = {};

  document.addEventListener('DOMContentLoaded', function () {
    ['words', 'sentences', 'autofill', 'dict-status', 'types', 'all', 'none', 'title', 'subtitle',
      'paper', 'font', 'versions', 'size', 'pinyin', 'info', 'answers', 'shuffle', 'print',
      'status', 'output', 'page-size'].forEach(function (id) {
      el[id.replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })] = document.getElementById('wg-' + id);
    });

    buildTypeControls();
    restore();

    el.autofill.addEventListener('click', autofillWords);
    el.all.addEventListener('click', function () { setAllTypes(true); });
    el.none.addEventListener('click', function () { setAllTypes(false); });
    el.shuffle.addEventListener('click', function () {
      seed = Math.floor(Math.random() * 1e6) + 1;
      scheduleRender();
    });
    el.print.addEventListener('click', function () { window.print(); });

    document.querySelector('.wg-controls').addEventListener('input', scheduleRender);
    document.querySelector('.wg-controls').addEventListener('change', scheduleRender);

    window.addEventListener('resize', fitPreview);
    render();

    loadDictionary().then(function () {
      el.dictStatus.textContent = '词典已就绪 Dictionary ready.';
      el.dictStatus.classList.add('is-ready');
      render();
    }).catch(function (err) {
      el.dictStatus.textContent = 'Could not load the dictionary (' + err.message + '). Type English yourself.';
      el.dictStatus.classList.add('is-error');
    });
  });

  // ---- Controls --------------------------------------------------------------

  function buildTypeControls() {
    TYPES.forEach(function (type) {
      var row = document.createElement('div');
      row.className = 'wg-type-row';

      var label = document.createElement('label');
      label.className = 'wg-check';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = type.on;
      var text = document.createElement('span');
      text.innerHTML = esc(type.zh) + ' <small>' + esc(type.en) +
        (type.needs ? ' · 需要例句' : '') + '</small>';
      label.appendChild(box);
      label.appendChild(text);
      row.appendChild(label);

      var count = null;
      if (type.count) {
        count = document.createElement('input');
        count.type = 'number';
        count.min = '1';
        count.max = String(type.max || 20);
        count.value = String(type.count);
        count.className = 'wg-count';
        count.setAttribute('aria-label', type.en + ' item count');
        row.appendChild(count);
      }
      typeInputs[type.key] = { box: box, count: count };
      el.types.appendChild(row);
    });
  }

  function setAllTypes(on) {
    TYPES.forEach(function (type) { typeInputs[type.key].box.checked = on; });
    scheduleRender();
  }

  function readSettings() {
    var types = {};
    TYPES.forEach(function (type) {
      var input = typeInputs[type.key];
      var n = input.count ? parseInt(input.count.value, 10) : 0;
      if (input.count && (!n || n < 1)) n = type.count;
      if (type.max && n > type.max) n = type.max;
      types[type.key] = { on: input.box.checked, count: n };
    });
    return {
      words: el.words.value,
      sentences: el.sentences.value,
      title: el.title.value,
      subtitle: el.subtitle.value,
      paper: el.paper.value,
      font: el.font.value,
      versions: parseInt(el.versions.value, 10) || 1,
      size: el.size.value,
      pinyin: el.pinyin.checked,
      info: el.info.checked,
      answers: el.answers.checked,
      types: types,
      seed: seed
    };
  }

  function save(settings) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* storage unavailable */ }
  }

  function restore() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { saved = null; }
    if (!saved) {
      el.words.value = SAMPLE_WORDS;
      el.sentences.value = SAMPLE_SENTENCES;
      el.title.value = '我的家人';
      el.subtitle.value = 'My Family';
      return;
    }
    el.words.value = saved.words || '';
    el.sentences.value = saved.sentences || '';
    el.title.value = saved.title || '';
    el.subtitle.value = saved.subtitle || '';
    if (saved.paper) el.paper.value = saved.paper;
    if (saved.font) el.font.value = saved.font;
    if (saved.versions) el.versions.value = String(saved.versions);
    if (saved.size) el.size.value = saved.size;
    el.pinyin.checked = saved.pinyin !== false;
    el.info.checked = saved.info !== false;
    el.answers.checked = saved.answers !== false;
    if (saved.seed) seed = saved.seed;
    if (saved.types) {
      TYPES.forEach(function (type) {
        var t = saved.types[type.key];
        if (!t) return;
        typeInputs[type.key].box.checked = !!t.on;
        if (typeInputs[type.key].count && t.count) typeInputs[type.key].count.value = String(t.count);
      });
    }
  }

  // ---- Dictionary + pinyin ----------------------------------------------------

  function loadDictionary() {
    if (dict) return Promise.resolve(dict);
    if (dictPromise) return dictPromise;
    dictPromise = fetch(CEDICT_URL).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (typeof DecompressionStream === 'undefined' || !res.body) {
        throw new Error('this browser cannot decompress the dictionary');
      }
      return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
    }).then(function (text) {
      dict = JSON.parse(text);
      return dict;
    });
    return dictPromise;
  }

  function lookupPinyin(word) {
    if (window.pinyinPro && typeof window.pinyinPro.pinyin === 'function') {
      try { return window.pinyinPro.pinyin(word, { toneType: 'symbol' }) || ''; } catch (e) { /* fall through */ }
    }
    var entry = dict && dict[word];
    return entry ? (entry[0].py || '') : '';
  }

  function lookupEnglish(word) {
    var entry = dict && dict[word];
    if (!entry) return '';
    var defs = [];
    entry.forEach(function (reading) {
      (reading.d || []).forEach(function (d) {
        if (/^(CL:|variant of|old variant|see |surname |also written)/i.test(d)) return;
        d = d.replace(/^\((coll\.|fig\.|lit\.|literary|dialect|loanword)\)\s*/i, '').trim();
        if (d && defs.indexOf(d) === -1) defs.push(d);
      });
    });
    var out = defs.slice(0, 2).join('; ');
    return out.length > 40 ? defs[0] || '' : out;
  }

  // Per-character pinyin aligned with Array.from(text); non-Chinese chars map to ''.
  function sentencePinyin(text) {
    var chars = Array.from(text);
    var arr = null;
    if (window.pinyinPro) {
      try { arr = window.pinyinPro.pinyin(text, { type: 'array', toneType: 'symbol' }); } catch (e) { arr = null; }
    }
    return chars.map(function (ch, i) {
      if (!CJK.test(ch)) return '';
      return arr && arr.length === chars.length ? arr[i] : '';
    });
  }

  function parseWords(text) {
    var seen = {};
    var items = [];
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var parts;
      if (/[|｜\t]/.test(line)) {
        parts = line.split(/\s*[|｜\t]\s*/);
      } else {
        // "爸爸 dad" → leading Chinese run, the rest as English.
        var m = line.match(/^([^\sA-Za-z]+)\s*(.*)$/);
        parts = m ? [m[1], '', m[2]] : [line];
      }
      var hz = (parts[0] || '').replace(/\s+/g, '');
      if (!hz || !CJK.test(hz) || seen[hz]) return;
      seen[hz] = true;
      var py = (parts[1] || '').trim();
      var en = (parts[2] || '').trim();
      items.push({ hz: hz, py: py || lookupPinyin(hz), en: en || lookupEnglish(hz), pyGiven: !!py, enGiven: !!en });
    });
    return items;
  }

  function autofillWords() {
    loadDictionary().catch(function () {}).then(function () {
      var items = parseWords(el.words.value);
      el.words.value = items.map(function (it) {
        return it.hz + ' | ' + it.py + ' | ' + it.en;
      }).join('\n');
      var missing = items.filter(function (it) { return !it.en; }).length;
      el.dictStatus.textContent = missing
        ? '已补全。' + missing + ' 个词没找到英文，请自己填写。Filled in — ' + missing + ' word(s) need English typed by hand.'
        : '已补全，请检查一下。Filled in — please check them.';
      render();
    });
  }

  // ---- Helpers ------------------------------------------------------------------

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pick(items, n, rng) {
    return shuffle(items, rng).slice(0, Math.min(n, items.length));
  }

  // Word with pinyin above each character (or above the whole word if the
  // syllable count doesn't line up).
  function rubyWord(hz, py, show) {
    if (!show || !py) return '<span class="wg-hz">' + esc(hz) + '</span>';
    var chars = Array.from(hz);
    var syl = py.trim().split(/\s+/);
    if (syl.length === chars.length) {
      return '<span class="wg-hz">' + chars.map(function (c, i) {
        return '<ruby>' + esc(c) + '<rt>' + esc(syl[i]) + '</rt></ruby>';
      }).join('') + '</span>';
    }
    return '<span class="wg-hz"><ruby>' + esc(hz) + '<rt>' + esc(py) + '</rt></ruby></span>';
  }

  function rubyChars(chars, pys, show) {
    return chars.map(function (c, i) {
      if (show && pys[i]) return '<ruby>' + esc(c) + '<rt>' + esc(pys[i]) + '</rt></ruby>';
      return esc(c);
    }).join('');
  }

  function tzg(ch, kind) {
    return '<span class="wg-tzg' + (kind ? ' is-' + kind : '') + '">' + (ch ? esc(ch) : '') + '</span>';
  }

  function tzgWord(word, answers) {
    return '<span class="wg-tzg-word">' + Array.from(word).map(function (c) {
      return tzg(answers ? c : '', answers ? 'answer' : '');
    }).join('') + '</span>';
  }

  // Forward max-match segmentation; vocabulary words win over dictionary words.
  function segmentSentence(text, vocabSet) {
    var chars = Array.from(text);
    var out = [];
    var i = 0;
    function vocabAt(pos) {
      for (var len = Math.min(8, chars.length - pos); len >= 1; len--) {
        var cand = chars.slice(pos, pos + len).join('');
        if (vocabSet[cand] && (len > 1 || CJK.test(cand))) return cand;
      }
      return '';
    }
    function crossesVocab(pos, len) {
      for (var k = 1; k < len; k++) {
        var v = vocabAt(pos + k);
        if (v && k + Array.from(v).length > len) return true;
      }
      return false;
    }
    while (i < chars.length) {
      var ch = chars[i];
      if (!CJK.test(ch)) {
        if (/\s/.test(ch)) { i++; continue; }
        // Punctuation / latin sticks to the previous chunk.
        if (out.length && !/[A-Za-z0-9]/.test(ch)) out[out.length - 1] += ch;
        else out.push(ch);
        i++;
        continue;
      }
      var matched = vocabAt(i) || ch;
      if (matched === ch) {
        for (var len = Math.min(8, chars.length - i); len >= 2; len--) {
          var cand = chars.slice(i, i + len).join('');
          // Don't let a dictionary word swallow the start of a vocabulary word (的哥 vs 哥哥).
          if (dict && dict[cand] && !crossesVocab(i, len)) { matched = cand; break; }
        }
      }
      out.push(matched);
      i += Array.from(matched).length;
    }
    // Keep the puzzle manageable: merge neighbouring single characters.
    while (out.length > 7) {
      var best = -1;
      for (var k = 0; k < out.length - 1; k++) {
        if (best === -1 || out[k].length + out[k + 1].length < out[best].length + out[best + 1].length) best = k;
      }
      out.splice(best, 2, out[best] + out[best + 1]);
    }
    return out;
  }

  // ---- Section renderers ----------------------------------------------------------
  // Each returns { body, needsNote } HTML; `ctx.answers` renders the answer key.

  var RENDER = {
    vocab: function (ctx) {
      var rows = ctx.items.map(function (it, i) {
        return '<tr><td class="wg-num">' + (i + 1) + '</td><td class="wg-cell-hz">' + esc(it.hz) +
          '</td><td>' + esc(it.py) + '</td><td>' + esc(it.en) + '</td></tr>';
      }).join('');
      return '<table class="wg-vocab"><thead><tr><th></th><th>汉字 Hanzi</th><th>拼音 Pinyin</th><th>英文 English</th></tr></thead><tbody>' +
        rows + '</tbody></table>';
    },

    match: function (ctx) {
      var left = pick(ctx.items, ctx.count, ctx.rng);
      var right = shuffle(left, ctx.rng);
      var html = '<div class="wg-match">';
      left.forEach(function (it, i) {
        var target = right[i];
        var ansLetter = LETTERS[right.indexOf(it)];
        html += '<div class="wg-match-row wg-item">' +
          '<span class="wg-match-left"><span class="wg-num">' + (i + 1) + '.</span> ' + rubyWord(it.hz, it.py, ctx.pinyin) +
          (ctx.answers ? ' <span class="wg-answer">→ ' + ansLetter + '</span>' : '') + '</span>' +
          '<span class="wg-dot"></span><span class="wg-match-gap"></span><span class="wg-dot"></span>' +
          '<span class="wg-match-right"><span class="wg-num">' + LETTERS[i] + '.</span> ' + esc(target.en || target.py) + '</span>' +
          '</div>';
      });
      return html + '</div>';
    },

    mc: function (ctx) {
      var qs = pick(ctx.items, ctx.count, ctx.rng);
      return '<ol class="wg-list">' + qs.map(function (it) {
        var others = shuffle(ctx.items.filter(function (o) { return o !== it; }), ctx.rng).slice(0, 3);
        var options = shuffle(others.concat([it]), ctx.rng);
        return '<li class="wg-item"><div class="wg-q">' + esc(it.en || it.py) + '</div><div class="wg-options">' +
          options.map(function (o, i) {
            var correct = ctx.answers && o === it;
            return '<span class="wg-option' + (correct ? ' is-correct' : '') + '"><b>' + LETTERS[i] + '.</b> ' +
              rubyWord(o.hz, o.py, ctx.pinyin) + '</span>';
          }).join('') + '</div></li>';
      }).join('') + '</ol>';
    },

    tf: function (ctx) {
      var qs = pick(ctx.items, ctx.count, ctx.rng);
      return '<ol class="wg-list wg-cols-2">' + qs.map(function (it) {
        var others = ctx.items.filter(function (o) { return o !== it && o.en && o.en !== it.en; });
        var isTrue = !others.length || ctx.rng() < 0.5;
        var shown = isTrue ? it.en : others[Math.floor(ctx.rng() * others.length)].en;
        return '<li class="wg-item wg-tf">' + rubyWord(it.hz, it.py, ctx.pinyin) + ' <span class="wg-eq">=</span> ' + esc(shown) +
          ' <span class="wg-paren">（' + (ctx.answers ? '<span class="wg-answer">' + (isTrue ? '✓' : '✗') + '</span>' : '&emsp;') + '）</span></li>';
      }).join('') + '</ol>';
    },

    pinyin: function (ctx) {
      var qs = pick(ctx.items, ctx.count, ctx.rng);
      return '<ol class="wg-list wg-cols-3">' + qs.map(function (it) {
        return '<li class="wg-item wg-py-item"><div class="wg-py-label">' + esc(it.py) + '</div>' + tzgWord(it.hz, ctx.answers) + '</li>';
      }).join('') + '</ol>';
    },

    fill: function (ctx) {
      var rows = [];
      ctx.sentences.forEach(function (s) {
        var hits = ctx.items.filter(function (it) { return s.indexOf(it.hz) !== -1; });
        if (!hits.length) return;
        hits.sort(function (a, b) { return b.hz.length - a.hz.length; });
        rows.push({ sentence: s, word: hits[0] });
      });
      if (!rows.length) return ctx.note('填空题需要包含生词的例句。Add example sentences that use your words.');
      rows = pick(rows, ctx.count, ctx.rng);
      var bank = shuffle(rows.map(function (r) { return r.word; }).filter(function (w, i, a) { return a.indexOf(w) === i; }), ctx.rng);
      var html = '<div class="wg-bank"><span class="wg-bank-label">词库 Word bank</span>' + bank.map(function (w) {
        return '<span class="wg-bank-word">' + rubyWord(w.hz, w.py, ctx.pinyin) + '</span>';
      }).join('') + '</div><ol class="wg-list">';
      rows.forEach(function (r) {
        var chars = Array.from(r.sentence);
        var pys = sentencePinyin(r.sentence);
        var start = chars.join('').indexOf(r.word.hz);
        var startIdx = Array.from(r.sentence.slice(0, start)).length;
        var endIdx = startIdx + Array.from(r.word.hz).length;
        var blank = ctx.answers
          ? '<span class="wg-blank is-filled"><span class="wg-answer">' + esc(r.word.hz) + '</span></span>'
          : '<span class="wg-blank" style="min-width:' + (endIdx - startIdx + 1.5) + 'em"></span>';
        html += '<li class="wg-item wg-sentence">' +
          rubyChars(chars.slice(0, startIdx), pys.slice(0, startIdx), ctx.pinyin) + blank +
          rubyChars(chars.slice(endIdx), pys.slice(endIdx), ctx.pinyin) + '</li>';
      });
      return html + '</ol>';
    },

    reorder: function (ctx) {
      var vocabSet = {};
      ctx.items.forEach(function (it) { vocabSet[it.hz] = true; });
      var sentences = pick(ctx.sentences.filter(function (s) { return Array.from(s).length >= 3; }), ctx.count, ctx.rng);
      if (!sentences.length) return ctx.note('句子排序需要例句。Add example sentences for this section.');
      return '<ol class="wg-list">' + sentences.map(function (s) {
        var punct = (s.match(END_PUNCT) || [''])[0];
        var core = s.replace(END_PUNCT, '');
        var chunks = segmentSentence(core, vocabSet);
        var mixed = chunks;
        for (var tries = 0; tries < 6 && mixed.join('') === chunks.join('') && chunks.length > 1; tries++) {
          mixed = shuffle(chunks, ctx.rng);
        }
        var cards = mixed.map(function (c) {
          return '<span class="wg-chunk">' + rubyChars(Array.from(c), sentencePinyin(c), ctx.pinyin) + '</span>';
        }).join('');
        return '<li class="wg-item"><div class="wg-chunks">' + cards + '</div><div class="wg-line-wrap"><div class="wg-line">' +
          (ctx.answers ? '<span class="wg-answer">' + esc(core) + '</span>' : '') + '</div><span class="wg-line-end">' + esc(punct || '。') + '</span></div></li>';
      }).join('') + '</ol>';
    },

    translate: function (ctx) {
      var qs = pick(ctx.items.filter(function (it) { return it.en; }), ctx.count, ctx.rng);
      if (!qs.length) return ctx.note('翻译题需要英文释义。Add English meanings to your words.');
      return '<ol class="wg-list wg-cols-2">' + qs.map(function (it) {
        return '<li class="wg-item wg-translate"><span class="wg-en">' + esc(it.en) + '</span><span class="wg-line">' +
          (ctx.answers ? '<span class="wg-answer">' + esc(it.hz) + '</span>' : '') + '</span></li>';
      }).join('') + '</ol>';
    },

    makeSentence: function (ctx) {
      var qs = pick(ctx.items, ctx.count, ctx.rng);
      return '<ol class="wg-list">' + qs.map(function (it) {
        return '<li class="wg-item wg-make"><div class="wg-make-word">' + rubyWord(it.hz, it.py, ctx.pinyin) +
          (it.en ? ' <small>' + esc(it.en) + '</small>' : '') + '</div>' +
          (ctx.answers ? '<div class="wg-line"><span class="wg-answer">答案不唯一 Answers will vary</span></div>'
            : '<div class="wg-line"></div><div class="wg-line"></div>') + '</li>';
      }).join('') + '</ol>';
    },

    dictation: function (ctx) {
      var qs = pick(ctx.items, ctx.count, ctx.rng);
      var html = '<ol class="wg-list wg-cols-3">' + qs.map(function (it) {
        return '<li class="wg-item wg-py-item">' + tzgWord(it.hz, ctx.answers) + '</li>';
      }).join('') + '</ol>';
      if (ctx.answers) {
        html = '<p class="wg-teacher-note">老师按这个顺序读 Read in this order: ' +
          qs.map(function (it, i) { return (i + 1) + '. ' + esc(it.hz); }).join('　') + '</p>' + html;
      }
      return html;
    },

    wordsearch: function (ctx) {
      var words = pick(ctx.items.filter(function (it) { return Array.from(it.hz).length >= 2; }), ctx.count, ctx.rng);
      if (!words.length) return ctx.note('汉字搜索需要两个字以上的词语。Word search needs words of 2+ characters.');
      var puzzle = ctx.cache.wordsearch || (ctx.cache.wordsearch = buildWordSearch(words, ctx.rng));
      var html = '<div class="wg-ws"><table class="wg-ws-grid"><tbody>';
      puzzle.grid.forEach(function (row, r) {
        html += '<tr>' + row.map(function (c, col) {
          var hit = ctx.answers && puzzle.used[r][col];
          return '<td' + (hit ? ' class="is-hit"' : '') + '>' + esc(c) + '</td>';
        }).join('') + '</tr>';
      });
      html += '</tbody></table><ul class="wg-ws-words">' + puzzle.placed.map(function (it) {
        return '<li><span class="wg-ws-box"></span>' + esc(ctx.pinyin ? it.py : '') + (ctx.pinyin && it.en ? ' · ' : '') + esc(it.en) +
          (ctx.answers || (!it.en && !ctx.pinyin) ? ' <span class="wg-answer">' + esc(it.hz) + '</span>' : '') + '</li>';
      }).join('') + '</ul></div>';
      return html;
    },

    trace: function (ctx) {
      var seen = {};
      var chars = [];
      ctx.items.forEach(function (it) {
        var pys = it.py.trim().split(/\s+/);
        var hzChars = Array.from(it.hz);
        hzChars.forEach(function (c, i) {
          if (seen[c] || !CJK.test(c)) return;
          seen[c] = true;
          chars.push({ c: c, py: pys.length === hzChars.length ? pys[i] : lookupPinyin(c) });
        });
      });
      chars = chars.slice(0, ctx.count);
      var perRow = ctx.paper === 'letter' ? 11 : 10;
      return '<div class="wg-trace">' + chars.map(function (ch) {
        var boxes = [tzg(ch.c, 'model')];
        for (var i = 0; i < 3; i++) boxes.push(tzg(ch.c, 'trace'));
        while (boxes.length < perRow) boxes.push(tzg('', ''));
        return '<div class="wg-trace-row wg-item">' + (ctx.pinyin ? '<span class="wg-trace-py">' + esc(ch.py) + '</span>' : '') +
          '<div class="wg-trace-boxes">' + boxes.join('') + '</div></div>';
      }).join('') + '</div>';
    }
  };

  // Words go across or down; overlaps allowed when the characters agree.
  function buildWordSearch(words, rng) {
    var longest = Math.max.apply(null, words.map(function (w) { return Array.from(w.hz).length; }));
    var total = words.reduce(function (s, w) { return s + Array.from(w.hz).length; }, 0);
    var size = Math.min(12, Math.max(7, longest + 2, Math.ceil(Math.sqrt(total * 2.6))));
    var grid = [];
    var used = [];
    for (var r = 0; r < size; r++) { grid.push(new Array(size).fill('')); used.push(new Array(size).fill(false)); }
    var placed = [];
    words.forEach(function (w) {
      var chars = Array.from(w.hz);
      for (var attempt = 0; attempt < 200; attempt++) {
        var down = rng() < 0.5;
        var r0 = Math.floor(rng() * (down ? size - chars.length + 1 : size));
        var c0 = Math.floor(rng() * (down ? size : size - chars.length + 1));
        var ok = chars.every(function (ch, i) {
          var cell = grid[r0 + (down ? i : 0)][c0 + (down ? 0 : i)];
          return !cell || cell === ch;
        });
        if (!ok) continue;
        chars.forEach(function (ch, i) {
          var rr = r0 + (down ? i : 0), cc = c0 + (down ? 0 : i);
          grid[rr][cc] = ch;
          used[rr][cc] = true;
        });
        placed.push(w);
        break;
      }
    });
    var pool = Array.from(FILLER).concat(Array.from(words.map(function (w) { return w.hz; }).join('')));
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        if (!grid[y][x]) grid[y][x] = pool[Math.floor(rng() * pool.length)];
      }
    }
    return { grid: grid, used: used, placed: placed };
  }

  // ---- Document assembly -------------------------------------------------------------

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 200);
  }

  function render() {
    var s = readSettings();
    save(s);

    el.pageSize.textContent = '@page { size: ' + (s.paper === 'letter' ? 'letter' : 'A4') + '; margin: 12mm; }';
    el.output.className = 'wg-output wg-paper-' + s.paper + ' wg-font-' + s.font + ' wg-size-' + s.size;

    var items = parseWords(s.words);
    var sentences = s.sentences.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);

    if (!items.length) {
      el.output.innerHTML = '<div class="wg-sheet wg-empty"><p>在左边输入生词，练习单会出现在这里。<br>Type some words on the left and your worksheet appears here.</p></div>';
      el.status.textContent = '';
      el.print.disabled = true;
      fitPreview();
      return;
    }
    el.print.disabled = false;

    var active = TYPES.filter(function (t) { return s.types[t.key].on; });
    var sheets = [];
    var keys = [];
    for (var v = 0; v < s.versions; v++) {
      var label = s.versions > 1 ? LETTERS[v] : '';
      var caches = {};
      sheets.push(renderSheet(s, items, sentences, active, v, label, false, caches));
      if (s.answers) keys.push(renderSheet(s, items, sentences, active, v, label, true, caches));
    }
    el.output.innerHTML = sheets.concat(keys).join('');
    fitPreview();

    el.status.textContent = items.length + ' 个词 words · ' + active.length + ' 种题型 sections' +
      (s.versions > 1 ? ' · ' + s.versions + ' 个版本 versions' : '') + (s.answers ? ' · 含答案 with key' : '');
  }

  // Shrink the paper preview to fit narrow screens (print resets zoom to 1).
  function fitPreview() {
    el.output.style.zoom = '';
    var avail = el.output.parentNode.clientWidth - 4;
    var natural = el.output.scrollWidth;
    if (natural > avail && avail > 0) el.output.style.zoom = String(Math.max(0.35, avail / natural));
  }

  function renderSheet(s, items, sentences, active, version, label, answers, caches) {
    var html = '<article class="wg-sheet' + (answers ? ' is-key' : '') + '">';
    html += '<header class="wg-sheet-head"><div class="wg-sheet-titles"><h2>' + esc(s.title || '练习单') +
      (answers ? ' <span class="wg-key-tag">答案 Answer Key</span>' : '') + '</h2>' +
      (s.subtitle ? '<p>' + esc(s.subtitle) + '</p>' : '') + '</div>' +
      (label ? '<span class="wg-version">' + (answers ? '' : 'Version ') + label + '</span>' : '') + '</header>';
    if (s.info && !answers) {
      html += '<div class="wg-info"><span>姓名 Name <i></i></span><span>班级 Class <i></i></span><span>日期 Date <i></i></span></div>';
    }

    var num = 0;
    active.forEach(function (type, typeIndex) {
      num++;
      if (answers && (type.key === 'vocab' || type.key === 'trace')) return;
      var cache = caches[type.key] || (caches[type.key] = {});
      var ctx = {
        items: items,
        sentences: sentences,
        count: s.types[type.key].count || items.length,
        pinyin: s.pinyin,
        answers: answers,
        paper: s.paper,
        // Same seed for the student sheet and its answer key so they line up.
        rng: mulberry32(s.seed * 7919 + version * 104729 + typeIndex * 131),
        cache: cache,
        note: function (msg) { return '<p class="wg-note wg-no-print">⚠️ ' + esc(msg) + '</p>'; }
      };
      html += '<section class="wg-section"><div class="wg-section-head"><span class="wg-section-num">' + num + '</span>' +
        '<h3>' + esc(type.zh) + ' <small>' + esc(type.en) + '</small></h3></div>' +
        (answers ? '' : '<p class="wg-instr">' + esc(type.instr) + '</p>') +
        RENDER[type.key](ctx) + '</section>';
    });
    if (!active.length) html += '<p class="wg-note wg-no-print">请至少选择一种题型。Pick at least one question type.</p>';
    return html + '</article>';
  }
})();
