(function () {
  'use strict';

  // Longest headword length we bother matching during segmentation. Keeps the
  // greedy max-match bounded; covers 4-character idioms and most compounds.
  var MAX_WORD_LEN = 8;

  // Single-character function words dropped when "skip common words" is on.
  var STOPWORDS = {};
  ('的 了 是 在 我 你 他 她 它 们 和 与 及 或 这 那 就 都 也 而 又 还 把 被 让 给 从 向 对 于 之 者 所 得 着 过 呢 吗 吧 啊 呀 哦 嗯 一 个 不 没 有 会 要 能 可 上 下 中 里 内 外')
    .split(/\s+/).forEach(function (w) { STOPWORDS[w] = true; });

  var CJK = /[㐀-鿿豈-﫿]/;

  var dict = null;        // { simplified: [ { py, d: [defs] }, ... ] }
  var dictPromise = null; // in-flight load

  var state = {
    title: '',
    text: '',
    rows: []              // [{ word, pinyin, meaning, at, len, edited }]
  };

  // 简 / 繁: the article is segmented and looked up in simplified (the
  // dictionary is keyed that way); the list and the Word file show the chosen
  // script. A word is cut from the converted article at the same place, so it
  // keeps its context (头发 → 頭髮 even though 发 alone is 發).
  var zh = null;
  function T(value) { return zh ? zh.text(value) : value; }
  function simplified(text) {
    var Zh = window.ChenZhScript;
    return Zh && Zh.hasTable() ? Zh.toSimplified(text) : text;
  }
  function shownWord(row) {
    if (row.at == null || row.edited) return T(row.word);
    return Array.from(T(state.text)).slice(row.at, row.at + row.len).join('');
  }

  var el = {};

  document.addEventListener('DOMContentLoaded', function () {
    el.title = document.getElementById('vg-title');
    el.textInput = document.getElementById('vg-text-input');
    el.minLength = document.getElementById('vg-min-length');
    el.pinyinToggle = document.getElementById('vg-pinyin-toggle');
    el.stopwordsToggle = document.getElementById('vg-stopwords-toggle');
    el.buildButton = document.getElementById('vg-build-button');
    el.dictStatus = document.getElementById('vg-dict-status');
    el.status = document.getElementById('vg-status');
    el.emptyState = document.getElementById('vg-empty-state');
    el.result = document.getElementById('vg-result');
    el.tableBody = document.getElementById('vg-table-body');
    el.addRow = document.getElementById('vg-add-row');
    el.downloadButton = document.getElementById('vg-download-button');
    el.wordCount = document.getElementById('vg-word-count');

    el.buildButton.addEventListener('click', build);
    el.addRow.addEventListener('click', addEmptyRow);
    el.downloadButton.addEventListener('click', downloadDocx);
    el.pinyinToggle.addEventListener('change', updatePinyinColumn);

    if (window.ChenZhContent) {
      zh = window.ChenZhContent.create({
        mount: '#vg-zh-slot',
        label: '生词表用字 Characters',
        onChange: function () {
          state.rows.forEach(function (row) { row.word = shownWord(row); });
          if (state.rows.length) renderTable();
        }
      });
      zh.region(el.result);
    }

    // Start loading the dictionary right away so the first build is instant.
    loadDictionary().then(function () {
      el.dictStatus.textContent = 'Dictionary ready.';
      el.dictStatus.classList.add('is-ready');
    }).catch(function (err) {
      el.dictStatus.textContent = 'Could not load the dictionary: ' + err.message;
      el.dictStatus.classList.add('is-error');
    });
  });

  // ---- Dictionary loading (gzip, decompressed in the browser) ----------------

  function loadDictionary() {
    if (dict) return Promise.resolve(dict);
    if (dictPromise) return dictPromise;

    dictPromise = fetch('/low-prep/vocab-glossary/cedict.json.gz').then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (typeof DecompressionStream === 'undefined' || !res.body) {
        // Very old browser: fall back to letting the browser handle it as text.
        return res.text().catch(function () {
          throw new Error('this browser cannot decompress the dictionary');
        });
      }
      var stream = res.body.pipeThrough(new DecompressionStream('gzip'));
      return new Response(stream).text();
    }).then(function (text) {
      dict = JSON.parse(text);
      return dict;
    });

    return dictPromise;
  }

  // ---- Segmentation (forward maximum matching against the dictionary) --------

  function segment(text) {
    var tokens = [];       // recognized Chinese words, with duplicates: { word, at }
    var chars = Array.from(text);
    var i = 0;
    while (i < chars.length) {
      var ch = chars[i];
      if (!CJK.test(ch)) { i++; continue; }

      var matched = null;
      var maxTry = Math.min(MAX_WORD_LEN, chars.length - i);
      for (var len = maxTry; len >= 2; len--) {
        var candidate = chars.slice(i, i + len).join('');
        if (dict[candidate]) { matched = candidate; break; }
      }
      if (matched) {
        tokens.push({ word: matched, at: i });
        i += Array.from(matched).length;
      } else {
        // No multi-character word here: emit the single character and move on.
        tokens.push({ word: ch, at: i });
        i += 1;
      }
    }
    return tokens;
  }

  function build() {
    var text = el.textInput.value || '';
    if (!text.trim()) {
      el.status.textContent = 'Paste an article above, then click “Find words”.';
      return;
    }

    if (!dict) {
      el.status.textContent = 'Still loading the dictionary — try again in a moment.';
      loadDictionary().then(build).catch(function () {});
      return;
    }
    if (zh && !window.ChenZhScript.hasTable()) {
      zh.ready().then(build, function () { zh = null; build(); });
      return;
    }
    if (zh) zh.suggest(text);

    state.title = el.title.value.trim();
    state.text = text.replace(/\r\n/g, '\n');

    var minLen = parseInt(el.minLength.value, 10) === 1 ? 1 : 2;
    var skipStop = el.stopwordsToggle.checked;

    var tokens = segment(simplified(state.text));
    var seen = {};
    var rows = [];
    tokens.forEach(function (found) {
      var token = found.word;
      if (Array.from(token).length < minLen) return;
      if (seen[token]) return;
      if (skipStop && STOPWORDS[token]) return;
      var entry = dict[token];
      if (!entry) return; // single characters not in the dictionary
      seen[token] = true;
      var row = {
        word: token,
        pinyin: entry[0].py || '',
        meaning: formatMeaning(entry),
        at: found.at,
        len: Array.from(token).length
      };
      row.word = shownWord(row);
      rows.push(row);
    });

    state.rows = rows;
    renderTable();

    el.emptyState.hidden = true;
    el.result.hidden = false;
    el.downloadButton.disabled = rows.length === 0;
    el.status.textContent = 'Found ' + rows.length + ' word' + (rows.length === 1 ? '' : 's') +
      '. Edit the list below, then download the Word document.';
  }

  // Join the definitions of the first (most common) reading; keep it concise.
  function formatMeaning(entry) {
    var first = entry[0];
    var defs = (first && first.d) ? first.d.slice(0, 3) : [];
    return defs.join('; ');
  }

  // ---- Editable table --------------------------------------------------------

  function renderTable() {
    el.tableBody.innerHTML = '';
    state.rows.forEach(function (row, index) {
      el.tableBody.appendChild(makeRow(row, index));
    });
    updatePinyinColumn();
    updateCount();
  }

  function makeRow(row, index) {
    var tr = document.createElement('tr');
    tr.className = 'vg-row';

    var num = document.createElement('td');
    num.className = 'vg-col-num';
    tr.appendChild(num);

    tr.appendChild(makeEditableCell(row, 'word', 'vg-col-word'));
    tr.appendChild(makeEditableCell(row, 'pinyin', 'vg-col-pinyin'));
    tr.appendChild(makeEditableCell(row, 'meaning', 'vg-col-meaning'));

    var removeCell = document.createElement('td');
    removeCell.className = 'vg-col-remove';
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'vg-remove-btn';
    removeBtn.setAttribute('aria-label', 'Remove ' + row.word);
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function () {
      var pos = state.rows.indexOf(row);
      if (pos !== -1) state.rows.splice(pos, 1);
      renderTable();
    });
    removeCell.appendChild(removeBtn);
    tr.appendChild(removeCell);

    return tr;
  }

  function makeEditableCell(row, field, className) {
    var td = document.createElement('td');
    td.className = className + ' vg-editable';
    td.contentEditable = 'true';
    td.spellcheck = false;
    td.textContent = row[field] || '';
    td.addEventListener('input', function () {
      row[field] = td.textContent.trim();
      if (field === 'word') {
        row.edited = true;
        var lookup = dict && (dict[row[field]] || dict[simplified(row[field])]);
        // Live-fill pinyin/meaning when a freshly typed word is in the dictionary
        // and those cells are still empty.
        if (lookup) autofillSiblings(td.parentNode, row, lookup);
      }
    });
    return td;
  }

  function autofillSiblings(tr, row, entry) {
    var pinyinCell = tr.querySelector('.vg-col-pinyin');
    var meaningCell = tr.querySelector('.vg-col-meaning');
    if (pinyinCell && !pinyinCell.textContent.trim()) {
      row.pinyin = entry[0].py || '';
      pinyinCell.textContent = row.pinyin;
    }
    if (meaningCell && !meaningCell.textContent.trim()) {
      row.meaning = formatMeaning(entry);
      meaningCell.textContent = row.meaning;
    }
  }

  function addEmptyRow() {
    var row = { word: '', pinyin: '', meaning: '' };
    state.rows.push(row);
    var tr = makeRow(row, state.rows.length - 1);
    el.tableBody.appendChild(tr);
    updatePinyinColumn();
    updateCount();
    var wordCell = tr.querySelector('.vg-col-word');
    if (wordCell) wordCell.focus();
  }

  function updatePinyinColumn() {
    var show = el.pinyinToggle.checked;
    document.querySelectorAll('.vg-col-pinyin').forEach(function (cell) {
      cell.hidden = !show;
    });
  }

  function updateCount() {
    el.wordCount.textContent = String(state.rows.length);
    el.downloadButton.disabled = state.rows.length === 0;
  }

  // ---- Word (.docx) export ---------------------------------------------------

  function downloadDocx() {
    if (typeof window.docx === 'undefined') {
      el.status.textContent = 'The Word export library did not load. Please refresh and try again.';
      return;
    }
    var rows = state.rows.filter(function (r) { return (r.word || '').trim(); });
    if (!rows.length) {
      el.status.textContent = 'Add at least one word before downloading.';
      return;
    }

    var d = window.docx;
    var showPinyin = el.pinyinToggle.checked;
    var title = T(state.title || '生词表 · Vocabulary');
    var children = [];
    // Chinese runs in 繁体 files get a traditional face (正黑體); 简体 files keep Word's default.
    var hant = zh && zh.value === 't';
    function run(options) {
      if (hant) options.font = { eastAsia: 'Microsoft JhengHei' };
      return new d.TextRun(options);
    }

    // Title
    children.push(new d.Paragraph({
      heading: d.HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      children: [run({ text: title, size: 32, bold: true })]
    }));

    // Article section
    children.push(new d.Paragraph({
      heading: d.HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120 },
      children: [run({ text: T('课文') + ' · Text', size: 26, bold: true })]
    }));

    T(state.text).split('\n').forEach(function (line) {
      children.push(new d.Paragraph({
        spacing: { after: 120, line: 360 },
        children: [run({ text: line, size: 24 })]
      }));
    });

    // Vocabulary section
    children.push(new d.Paragraph({
      heading: d.HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 120 },
      children: [run({ text: T('生词表') + ' · Vocabulary', size: 26, bold: true })]
    }));

    children.push(buildTable(d, rows, showPinyin, run));

    var doc = new d.Document({
      creator: "Chen Laoshi's Teaching Toolkit",
      title: title,
      sections: [{
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
        children: children
      }]
    });

    var fileName = (state.title ? state.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() : '生词表') + '.docx';

    el.status.textContent = 'Building the Word document…';
    d.Packer.toBlob(doc).then(function (blob) {
      triggerDownload(blob, fileName);
      el.status.textContent = 'Downloaded “' + fileName + '” with ' + rows.length +
        ' word' + (rows.length === 1 ? '' : 's') + '.';
    }).catch(function (err) {
      el.status.textContent = 'Sorry, the Word export failed: ' + err.message;
    });
  }

  function buildTable(d, rows, showPinyin, run) {
    var BORDER = { style: d.BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
    var borders = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

    function cell(runs, opts) {
      opts = opts || {};
      return new d.TableCell({
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        shading: opts.header ? { fill: 'EFF5F1' } : undefined,
        children: [new d.Paragraph({ children: runs })]
      });
    }
    function textRuns(text, o) {
      o = o || {};
      return [run({ text: text || '', bold: !!o.bold, size: o.size || 22 })];
    }

    var headerCells = [
      cell(textRuns(T('词语') + ' Word', { bold: true }), { header: true })
    ];
    if (showPinyin) headerCells.push(cell(textRuns(T('拼音') + ' Pinyin', { bold: true }), { header: true }));
    headerCells.push(cell(textRuns('英文 English', { bold: true }), { header: true }));

    var tableRows = [new d.TableRow({ tableHeader: true, children: headerCells })];

    rows.forEach(function (r) {
      var cells = [cell(textRuns(r.word, { bold: true, size: 24 }))];
      if (showPinyin) cells.push(cell(textRuns(r.pinyin)));
      cells.push(cell(textRuns(r.meaning)));
      tableRows.push(new d.TableRow({ children: cells }));
    });

    var columnWidths = showPinyin ? [1800, 2400, 5000] : [2200, 7000];

    return new d.Table({
      width: { size: 100, type: d.WidthType.PERCENTAGE },
      columnWidths: columnWidths,
      borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER },
      rows: tableRows
    });
  }

  function triggerDownload(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
})();
