/*
 * Dice Story (骰子故事)
 * Students roll a die and use the option under that number to say a sentence or
 * build a story. Two layouts share one data model (dice-story-core.js):
 *   table: dice across the top, one category per row
 *   story: dice down the left, one category per column, words with pictures
 * Optional extra pages: word bank, story map, writing page.
 *
 * Sheets are real paper size in mm and printed with window.print().
 * The draft (with uploaded pictures) is kept in localStorage; members can also save
 * a template to their account through TeacherGameTemplate (game-template.js).
 */
(function () {
  'use strict';

  var zh = /^zh/i.test(document.documentElement.lang || '');
  function L(en, cn) { return zh ? cn : en; }
  function $(id) { return document.getElementById(id); }

  var DS = window.DiceStoryCore;
  var core = window.ChenWordlist;
  var emojiCore = window.ChenEmoji;

  var STORE_KEY = 'chen-dice-story-v1';
  var FACES = 6;
  var PAPER = { a4: { w: 210, h: 297, css: 'A4' }, letter: { w: 215.9, h: 279.4, css: 'letter' } };
  // red, orange, yellow, green, blue, purple — one per die face
  var DICE = ['#e5484d', '#f08c00', '#d9a400', '#2f9e44', '#1c7ed6', '#7048e8'];
  var TINTS = ['#ffe9e9', '#fff0dc', '#fff6cc', '#e1f7e4', '#ddeeff', '#ece5ff'];
  var HAN = /[㐀-鿿豈-﫿]/;
  var HAN_RUN = /[㐀-鿿豈-﫿]+/g;
  var BLANK = /[（(]\s*[）)]/;
  // Words that only get in the way of finding a picture: 一只小猫 -> 小猫, 在公园 -> 公园, 很开心 -> 开心
  var MEASURE = /^[一两几半][只个本顶张束盒块封条件辆头位杯片双把朵棵碗瓶支枝根]/;
  // Colour words get a paint swatch instead of an emoji (an emoji for 红色 is a guess at best).
  var SWATCH = {
    '红色': '#e03131', '红': '#e03131', '黄色': '#fcc419', '黄': '#fcc419', '蓝色': '#1c7ed6', '蓝': '#1c7ed6',
    '绿色': '#2f9e44', '绿': '#2f9e44', '白色': '#ffffff', '白': '#ffffff', '黑色': '#212529', '黑': '#212529',
    '紫色': '#7048e8', '紫': '#7048e8', '橙色': '#f76707', '橘色': '#f76707', '粉色': '#f783ac', '粉红色': '#f783ac',
    '灰色': '#868e96', '棕色': '#8b5a2b', '咖啡色': '#8b5a2b', '金色': '#d4a017', '银色': '#adb5bd'
  };
  var PIPS = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[26, 26], [50, 50], [74, 74]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
    6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]]
  };

  var S = null;          // the worksheet (DiceStoryCore.normalize shape)
  var uploads = {};      // word -> data URL of a picture the teacher uploaded (browser only)
  var auto = {};         // word -> OpenMoji entry found automatically
  var pickerWord = '';
  var prepareToken = 0;
  var inputTimer = 0;
  var renderTimer = 0;

  // ---------- helpers ----------
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function radioValue(name) {
    var checked = document.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : '';
  }
  function setRadio(name, value) {
    var input = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (input) input.checked = true;
  }
  function filled() {
    return S.categories.some(Boolean) || S.cells.some(function (row) { return row.some(Boolean); });
  }
  function maxCats() { return DS.MAX_CATEGORIES[S.layout]; }

  // ---------- draft ----------
  function saveDraft() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ data: S, uploads: uploads }));
    } catch (error) {
      // Too big with the uploaded pictures: keep the words at least.
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ data: S })); } catch (ignored) { /* storage is optional */ }
    }
  }
  function loadDraft() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!raw || !raw.data) return false;
      S = DS.normalize(raw.data);
      uploads = {};
      if (raw.uploads && typeof raw.uploads === 'object') {
        Object.keys(raw.uploads).forEach(function (key) {
          var value = raw.uploads[key];
          if (typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(value)) uploads[key] = value;
        });
      }
      return true;
    } catch (error) { return false; }
  }

  // ---------- controls <-> state ----------
  function writeControls() {
    var o = S.options;
    setRadio('dsLayout', S.layout);
    $('dsTitle').value = S.title;
    $('dsPrompt').value = S.prompt;
    $('dsPinyin').checked = o.pinyin;
    $('dsColor').checked = o.color;
    setRadio('dsPicMode', o.picMode);
    setRadio('dsPicStyle', o.picStyle);
    setRadio('dsWriting', o.writing);
    setRadio('dsOrient', o.orient);
    $('dsPaper').value = o.paper;
    $('dsPageVocab').checked = o.pages.vocab;
    $('dsPageOrganizer').checked = o.pages.organizer;
    $('dsPageWriting').checked = o.pages.writing;
    $('dsEnglish').checked = o.english;
    syncControlState();
  }
  function readControls() {
    var o = S.options;
    S.title = $('dsTitle').value.trim().slice(0, DS.LIMITS.title);
    S.prompt = $('dsPrompt').value.replace(/\r/g, '').split('\n').slice(0, 3).join('\n').slice(0, DS.LIMITS.prompt);
    o.pinyin = $('dsPinyin').checked;
    o.color = $('dsColor').checked;
    o.picMode = radioValue('dsPicMode') || 'both';
    o.picStyle = radioValue('dsPicStyle') || 'color';
    o.writing = radioValue('dsWriting') || 'lines';
    o.orient = radioValue('dsOrient') || 'landscape';
    o.paper = $('dsPaper').value === 'letter' ? 'letter' : 'a4';
    o.pages.vocab = $('dsPageVocab').checked;
    o.pages.organizer = $('dsPageOrganizer').checked;
    o.pages.writing = $('dsPageWriting').checked;
    o.english = $('dsEnglish').checked;
    syncControlState();
  }
  function syncControlState() {
    $('dsPicStyleRow').hidden = S.options.picMode === 'text';
    $('dsEnglish').disabled = !S.options.pages.vocab;
    $('dsEnglish').closest('label').classList.toggle('is-off', !S.options.pages.vocab);
    $('dsLayoutHint').textContent = S.layout === 'story'
      ? L('Dice down the left, one category per column. Students roll once for each column, then tell the story.', '骰子在最左边，每列一个类别。学生每一列掷一次，再把故事说出来或写下来。')
      : L('Dice across the top, one category per row. Students roll once for each row and fill the sentence pattern.', '骰子在最上面，每行一个类别。学生每一行掷一次，用句型说句子。');
    $('dsAddCat').textContent = S.layout === 'story' ? L('＋ Add a column', '＋ 添加一列') : L('＋ Add a row', '＋ 添加一行');
    $('dsAddCat').disabled = S.categories.length >= maxCats();
  }

  // ---------- grid editor ----------
  function diceSvg(n, color, size) {
    var o = S ? S.options : { color: true };
    var fill = o.color ? DICE[n - 1] : '#fff';
    var pip = o.color ? '#fff' : '#1b1b1b';
    var dots = PIPS[n].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="' + pip + '"/>'; }).join('');
    return '<svg class="ds-die" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-label="' + n + '" role="img">' +
      '<rect x="5" y="5" width="90" height="90" rx="18" fill="' + fill + '" stroke="#1b1b1b" stroke-width="5"/>' + dots + '</svg>';
  }

  function cellInput(cat, face) {
    return '<input class="ds-cell-input" type="text" maxlength="' + DS.LIMITS.cell + '" data-cat="' + cat + '" data-face="' + face + '" value="' + esc(S.cells[cat][face]) +
      '" aria-label="' + esc((S.categories[cat] || L('Category ', '类别 ') + (cat + 1)) + ' · ' + (face + 1)) + '">';
  }
  function catInput(cat) {
    return '<input class="ds-cat-input" type="text" maxlength="' + DS.LIMITS.category + '" data-cat="' + cat + '" value="' + esc(S.categories[cat]) +
      '" placeholder="' + esc(L('Category', '类别')) + '" aria-label="' + esc(L('Category ', '类别 ') + (cat + 1)) + '">';
  }
  function removeButton(cat) {
    return S.categories.length > 1
      ? '<button class="ds-remove" type="button" data-remove="' + cat + '" title="' + esc(L('Remove', '删除')) + '" aria-label="' + esc(L('Remove category ', '删除类别 ') + (cat + 1)) + '">×</button>'
      : '';
  }

  function renderGridEditor() {
    var grid = $('dsGrid');
    var html = '';
    var i, j;
    grid.className = 'ds-grid-editor ds-grid-' + S.layout;
    if (S.layout === 'table') {
      html += '<thead><tr><th>' + esc(L('Category', '类别')) + '</th>';
      for (j = 0; j < FACES; j++) html += '<th>' + diceSvg(j + 1, true, 22) + '</th>';
      html += '<th></th></tr></thead><tbody>';
      for (i = 0; i < S.categories.length; i++) {
        html += '<tr><td>' + catInput(i) + '</td>';
        for (j = 0; j < FACES; j++) html += '<td>' + cellInput(i, j) + '</td>';
        html += '<td>' + removeButton(i) + '</td></tr>';
      }
      html += '</tbody>';
    } else {
      html += '<thead><tr><th></th>';
      for (i = 0; i < S.categories.length; i++) html += '<th><div class="ds-cat-head">' + catInput(i) + removeButton(i) + '</div></th>';
      html += '</tr></thead><tbody>';
      for (j = 0; j < FACES; j++) {
        html += '<tr><th>' + diceSvg(j + 1, true, 22) + '</th>';
        for (i = 0; i < S.categories.length; i++) html += '<td>' + cellInput(i, j) + '</td>';
        html += '</tr>';
      }
      html += '</tbody>';
    }
    grid.innerHTML = html;
    syncControlState();
  }

  function onGridInput(event) {
    var input = event.target;
    var cat = Number(input.dataset.cat);
    if (!Number.isInteger(cat) || !S.categories.hasOwnProperty(cat)) return;
    if (input.classList.contains('ds-cat-input')) S.categories[cat] = input.value.trim();
    else S.cells[cat][Number(input.dataset.face)] = input.value.trim();
    scheduleRefresh();
  }

  // Paste a block from Excel / Word: tabs go across, new lines go down, as the teacher sees the grid.
  function onGridPaste(event) {
    var input = event.target;
    if (!input.dataset || input.dataset.cat == null) return;
    var text = (event.clipboardData || window.clipboardData).getData('text');
    if (!/[\t\n]/.test(text.replace(/\s+$/, ''))) return;
    event.preventDefault();
    var lines = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(function (line) { return line.split('\t'); });
    var cat = Number(input.dataset.cat);
    var isLabel = input.classList.contains('ds-cat-input');
    var face = isLabel ? -1 : Number(input.dataset.face);
    function put(c, f, value) {
      if (f >= FACES || c >= maxCats()) return;
      while (S.categories.length <= c) { S.categories.push(''); S.cells.push(['', '', '', '', '', '']); }
      value = String(value || '').trim();
      if (f < 0) S.categories[c] = value.slice(0, DS.LIMITS.category);
      else S.cells[c][f] = value.slice(0, DS.LIMITS.cell);
    }
    lines.forEach(function (cols, r) {
      cols.forEach(function (value, k) {
        if (S.layout === 'table') put(cat + r, face + k, value);        // rows are categories
        else if (isLabel) { if (r === 0) put(cat + k, -1, value); else put(cat + k, r - 1, value); }
        else put(cat + k, face + r, value);                            // story: rows are die faces
      });
    });
    renderGridEditor();
    refresh();
  }

  function onGridClick(event) {
    var button = event.target.closest('[data-remove]');
    if (!button) return;
    var cat = Number(button.dataset.remove);
    if (S.categories.length <= 1) return;
    S.categories.splice(cat, 1);
    S.cells.splice(cat, 1);
    renderGridEditor();
    refresh();
  }

  // ---------- words & pictures ----------
  function canHavePicture(text) {
    return /[A-Za-z㐀-鿿]/.test(text) && Array.from(text).length <= 20 && !/^\d/.test(text);
  }
  function words() {
    var seen = Object.create(null);
    var list = [];
    S.cells.forEach(function (row) {
      row.forEach(function (value) {
        var text = DS.splitCell(value).text;
        if (text && canHavePicture(text) && !seen[text]) { seen[text] = true; list.push(text); }
      });
    });
    return list;
  }
  function hanWords() { return words().filter(function (w) { return HAN.test(w); }); }

  function searchKey(word) {
    var key = word.replace(MEASURE, '').replace(/^(在|很|非常|好|太)/, '').replace(/了$/, '');
    return key || word;
  }
  function englishFor(word) {
    if (!HAN.test(word)) return word;
    if (!core) return '';
    return core.toEnglish(searchKey(word)) || core.toEnglish(word) || '';
  }

  function prepare() {
    var token = ++prepareToken;
    if (!emojiCore) return;
    var list = words().filter(function (w) { return S.pics[w] === undefined && !SWATCH[w] && !auto.hasOwnProperty(w); });
    if (!list.length) return;
    var ready = core && core.loadCedict ? core.loadCedict().catch(function () {}) : Promise.resolve();
    ready.then(function () {
      var items = list.map(function (w) { return { zh: w, en: englishFor(w) }; });
      return emojiCore.matchAll(items, { translate: true }).then(function () {
        items.forEach(function (item) { auto[item.zh] = item.openmoji || null; });
      });
    }).then(function () {
      if (token !== prepareToken) return;
      renderChips();
      renderSheets();
    }, function () { /* pictures are optional */ });
  }

  function picUrl(hex, forceColor) {
    if (!emojiCore) return '';
    if (!forceColor && S.options.picStyle === 'line') return emojiCore.BASE_URL + '/black/svg/' + encodeURIComponent(hex) + '.svg';
    return emojiCore.svgUrl(hex);
  }
  // { src, upload } or { swatch } or null
  function picFor(word, forceColor) {
    var choice = S.pics[word];
    if (choice === '') return null;
    if (choice === undefined && SWATCH[word]) return { swatch: SWATCH[word] };
    if (choice === 'upload') return uploads[word] ? { src: uploads[word], upload: true } : (auto[word] ? { src: picUrl(auto[word].hexcode, forceColor) } : null);
    if (choice) return { src: picUrl(choice, forceColor) };
    return auto[word] && auto[word].hexcode ? { src: picUrl(auto[word].hexcode, forceColor) } : null;
  }

  function picHtml(pic, alt, lineArt) {
    if (pic.swatch) {
      var fill = lineArt ? '#fff' : pic.swatch;
      return '<svg class="ds-swatch" viewBox="0 0 100 100" role="img" aria-label="' + esc(alt) + '">' +
        '<path d="M50 8c14 0 20 9 30 12s14 16 9 28 4 24-8 33-24 12-36 9-26-6-31-20 2-20-2-32 10-22 22-25 7-5 16-5z" fill="' + fill + '" stroke="#333" stroke-width="4"/></svg>';
    }
    return '<img src="' + esc(pic.src) + '" alt="' + esc(alt) + '"' + (pic.upload && lineArt ? ' class="is-gray"' : '') + '>';
  }

  function renderChips() {
    var box = $('dsPicBox');
    var list = words();
    if (S.options.picMode === 'text' || !list.length || !emojiCore) { box.hidden = true; closePicker(true); return; }
    box.hidden = false;
    var root = $('dsChips');
    root.replaceChildren();
    list.forEach(function (word) {
      var pic = picFor(word, true);
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ds-chip' + (pic ? '' : ' is-none') + (pickerWord === word ? ' is-open' : '');
      if (pic) {
        var img = document.createElement('span');
        img.className = 'ds-chip-pic';
        img.innerHTML = picHtml(pic, '', false);
        chip.appendChild(img);
        chip.title = L('Change the picture', '换一张图片');
      } else {
        var plus = document.createElement('span');
        plus.className = 'ds-chip-plus';
        plus.textContent = '＋';
        chip.appendChild(plus);
        chip.title = L('Choose a picture', '选一张图片');
      }
      var label = document.createElement('span');
      label.textContent = word;
      chip.appendChild(label);
      chip.addEventListener('click', function () { openPicker(word); });
      root.appendChild(chip);
    });
    if (pickerWord && list.indexOf(pickerWord) < 0) closePicker(true);
  }

  function renderPickerResults() {
    var root = $('dsPickerResults');
    var query = $('dsPickerSearch').value.trim();
    root.replaceChildren();
    if (!pickerWord || !emojiCore) return;
    emojiCore.load().then(function (index) {
      if (!pickerWord || $('dsPickerSearch').value.trim() !== query) return;
      var results = query ? emojiCore.search(query, index, { limit: 48 }) : [];
      root.replaceChildren();
      if (!results.length) {
        var empty = document.createElement('p');
        empty.className = 'ds-hint';
        empty.textContent = query
          ? L('No pictures found. Try another word, in English if you can.', '没有找到图片。换一个词试试，用英文搜索更容易找到。')
          : L('Type a word to search.', '输入一个词来搜索。');
        root.appendChild(empty);
        return;
      }
      results.forEach(function (entry) {
        var current = S.pics[pickerWord] === entry.hexcode || (S.pics[pickerWord] === undefined && !SWATCH[pickerWord] && auto[pickerWord] && auto[pickerWord].hexcode === entry.hexcode);
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'ds-pick' + (current ? ' is-current' : '');
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', current ? 'true' : 'false');
        button.title = entry.annotation || '';
        var img = document.createElement('img');
        img.src = emojiCore.svgUrl(entry.hexcode);
        img.alt = entry.annotation || '';
        img.loading = 'lazy';
        button.appendChild(img);
        button.addEventListener('click', function () { choosePicture(entry); });
        root.appendChild(button);
      });
    }, function () {
      var failed = document.createElement('p');
      failed.className = 'ds-hint';
      failed.textContent = L('The pictures could not be loaded. Check your internet connection.', '图片加载失败，请检查网络连接。');
      root.replaceChildren(failed);
    });
  }

  function openPicker(word) {
    pickerWord = word;
    $('dsPickerTitle').textContent = L('Picture for ', '给这个词选图：') + word;
    $('dsPickerSearch').value = searchKey(word);
    $('dsPicker').hidden = false;
    renderChips();
    renderPickerResults();
    $('dsPickerSearch').focus();
    $('dsPickerSearch').select();
  }
  function closePicker(quiet) {
    if (!pickerWord) return;
    pickerWord = '';
    $('dsPicker').hidden = true;
    if (!quiet) renderChips();
  }
  function choosePicture(entry) {
    if (!pickerWord) return;
    S.pics[pickerWord] = entry.hexcode;
    delete uploads[pickerWord];
    if (emojiCore.remember) emojiCore.remember({ zh: pickerWord }, entry.emoji);
    afterPictureChange();
  }
  function removePicture() {
    if (!pickerWord) return;
    S.pics[pickerWord] = '';
    delete uploads[pickerWord];
    afterPictureChange();
  }
  function afterPictureChange() {
    saveDraft();
    closePicker();
    renderSheets();
  }

  // Uploaded pictures are shrunk to 360 px so the draft stays small.
  function uploadPicture(file) {
    if (!file || !pickerWord || !/^image\//.test(file.type)) return;
    var word = pickerWord;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, 360 / Math.max(img.naturalWidth, img.naturalHeight));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      var png = canvas.toDataURL('image/png');
      var data = png.length > 160000 ? canvas.toDataURL('image/jpeg', 0.85) : png;
      uploads[word] = data;
      S.pics[word] = 'upload';
      pickerWord = word;
      afterPictureChange();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      window.alert(L('This picture could not be opened. Try a PNG or JPG file.', '这张图片打不开，请换一个 PNG 或 JPG 文件。'));
    };
    img.src = url;
  }

  // ---------- text with pinyin ----------
  function syllablesFor(text, override) {
    var hanCount = Array.from(text).filter(function (ch) { return HAN.test(ch); }).length;
    if (override) {
      var parts = override.trim().split(/\s+/);
      if (parts.length === hanCount) return parts;
    }
    var out = [];
    (text.match(HAN_RUN) || []).forEach(function (run) {
      var chars = Array.from(run);
      var py = core ? core.toPinyin(run, { spaced: true }).split(' ') : [];
      if (py.length !== chars.length) py = chars.map(function (ch) { return core ? core.toPinyin(ch) : ''; });
      out = out.concat(py);
    });
    return out;
  }
  function rubyHtml(text, override, showPy) {
    if (!showPy || !HAN.test(text)) return '<span class="ds-plain">' + esc(text) + '</span>';
    var syl = syllablesFor(text, override);
    var k = 0;
    var html = '';
    var other = '';
    Array.from(text).forEach(function (ch) {
      if (HAN.test(ch)) {
        if (other) { html += '<span class="ds-o">' + esc(other) + '</span>'; other = ''; }
        html += '<span class="ds-r"><span class="ds-py">' + esc(syl[k++] || '') + '</span><span class="ds-zh">' + esc(ch) + '</span></span>';
      } else {
        other += ch;
      }
    });
    if (other) html += '<span class="ds-o">' + esc(other) + '</span>';
    return html;
  }
  function promptLineHtml(line, showPy) {
    var parts = line.split(BLANK);
    return parts.map(function (part) { return part ? rubyHtml(part, '', showPy) : ''; })
      .join('<span class="ds-o ds-blank">（<span class="ds-blank-gap"></span>）</span>');
  }

  // ---------- sheets ----------
  function paperSize() {
    var p = PAPER[S.options.paper] || PAPER.a4;
    return S.options.orient === 'portrait' ? { w: p.w, h: p.h, css: p.css } : { w: p.h, h: p.w, css: p.css };
  }
  function sheetOpen(kind, title) {
    var size = paperSize();
    return '<div class="ds-sheet ds-sheet-' + kind + ' ds-' + S.options.orient + '" style="width:' + size.w + 'mm;height:' + size.h + 'mm">' +
      '<div class="ds-head"><h3 class="ds-title">' + esc(title) + '</h3>' +
      '<div class="ds-meta"><span>名字：<i></i></span><span>日期：<i></i></span></div></div><div class="ds-body">';
  }
  function sheetClose(withPictures) {
    return '</div><div class="ds-foot"><span>骰子故事 · Chen Laoshi\'s Teaching Tools · clsteachingtools.com</span>' +
      (withPictures && emojiCore ? '<span>' + esc(emojiCore.CREDIT) + '</span>' : '') + '</div></div>';
  }
  function promptHtml() {
    var lines = S.prompt.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return '';
    return '<div class="ds-prompt">' + lines.map(function (line) {
      return '<div class="ds-prompt-line">' + promptLineHtml(line, S.options.pinyin) + '</div>';
    }).join('') + '</div>';
  }
  function writeHtml(label, style) {
    style = style || S.options.writing;
    if (style === 'none') return '';
    return '<div class="ds-write-wrap">' + (label ? '<div class="ds-write-label">' + esc(label) + '</div>' : '') +
      '<div class="ds-write ds-write-' + style + '"></div></div>';
  }

  var usedPictures = false;
  function cellHtml(value, tint) {
    var parts = DS.splitCell(value);
    var style = tint ? ' style="background:' + tint + '"' : '';
    if (!parts.text) return '<td' + style + '></td>';
    var o = S.options;
    var pic = o.picMode !== 'text' && canHavePicture(parts.text) ? picFor(parts.text) : null;
    if (pic && !pic.swatch) usedPictures = true;
    var showText = o.picMode !== 'pic' || !pic;
    var html = '<td' + style + '><div class="ds-cell' + (pic ? ' has-pic' : '') + '">';
    if (showText) html += '<div class="ds-fit ds-txt">' + rubyHtml(parts.text, parts.py, o.pinyin) + '</div>';
    if (pic) html += '<div class="ds-pic">' + picHtml(pic, parts.text, o.picStyle === 'line') + '</div>';
    return html + '</div></td>';
  }
  function labelHtml(text) {
    return '<div class="ds-label-cell"><div class="ds-fit ds-txt">' + rubyHtml(text, '', S.options.pinyin) + '</div></div>';
  }

  function mainSheet() {
    var o = S.options;
    var i, j;
    var title = S.title || (S.layout === 'story' ? '掷骰子编故事' : '掷骰子说句子');
    var html = sheetOpen('main', title) + promptHtml();
    html += '<table class="ds-sheet-table ds-t-' + S.layout + (o.color ? ' is-color' : '') + '"><colgroup>';
    if (S.layout === 'table') {
      html += '<col class="ds-col-label">';
      for (j = 0; j < FACES; j++) html += '<col>';
      html += '</colgroup><thead><tr><th class="ds-corner"></th>';
      for (j = 0; j < FACES; j++) html += '<th class="ds-die-th">' + diceSvg(j + 1, o.color, '100%') + '</th>';
      html += '</tr></thead><tbody>';
      for (i = 0; i < S.categories.length; i++) {
        html += '<tr><th class="ds-row-label">' + labelHtml(S.categories[i]) + '</th>';
        for (j = 0; j < FACES; j++) html += cellHtml(S.cells[i][j], o.color ? TINTS[j] : '');
        html += '</tr>';
      }
    } else {
      html += '<col class="ds-col-die">';
      for (i = 0; i < S.categories.length; i++) html += '<col>';
      html += '</colgroup><thead><tr><th class="ds-corner"></th>';
      for (i = 0; i < S.categories.length; i++) html += '<th class="ds-col-label-th">' + labelHtml(S.categories[i]) + '</th>';
      html += '</tr></thead><tbody>';
      for (j = 0; j < FACES; j++) {
        html += '<tr><th class="ds-die-th">' + diceSvg(j + 1, o.color, '100%') + '</th>';
        for (i = 0; i < S.categories.length; i++) html += cellHtml(S.cells[i][j], o.color ? TINTS[j] : '');
        html += '</tr>';
      }
    }
    html += '</tbody></table>';
    html += writeHtml(S.layout === 'story' ? '我的故事：' : '我的句子：');
    return html + sheetClose(usedPictures);
  }

  function vocabSheets() {
    var list = hanWords();
    if (!list.length) return [];
    var portrait = S.options.orient === 'portrait';
    var cols = portrait ? 3 : 5;
    var perPage = cols * (portrait ? 6 : 3);
    var pages = [];
    for (var start = 0; start < list.length; start += perPage) {
      var chunk = list.slice(start, start + perPage);
      var anyPic = false;
      var html = sheetOpen('vocab', '词汇参考 Word Bank') + '<div class="ds-vocab" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))" data-rows="' + Math.ceil(chunk.length / cols) + '">';
      chunk.forEach(function (word) {
        var pic = S.options.picMode !== 'text' ? picFor(word) : null;
        if (pic && !pic.swatch) anyPic = true;
        var en = S.options.english ? englishFor(word).split(/[;,/]/)[0].trim() : '';
        html += '<div class="ds-card">' + (pic ? '<div class="ds-pic">' + picHtml(pic, '', S.options.picStyle === 'line') + '</div>' : '') +
          '<div class="ds-fit ds-txt">' + rubyHtml(word, '', true) + '</div>' + (en ? '<div class="ds-fit ds-en">' + esc(en) + '</div>' : '') + '</div>';
      });
      pages.push(html + '</div>' + sheetClose(anyPic));
    }
    return pages;
  }

  function organizerSheet() {
    var n = S.categories.length;
    var portrait = S.options.orient === 'portrait';
    var cols = portrait ? Math.min(n, 2) : Math.min(n, 4);
    var title = S.layout === 'story' ? '故事构思图 Story Map' : '我的掷骰子记录 My Rolls';
    var html = sheetOpen('organizer', title) + promptHtml() + '<div class="ds-map" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">';
    S.categories.forEach(function (cat, i) {
      html += '<div class="ds-map-box"><div class="ds-map-head"><span class="ds-map-num">' + (i + 1) + '</span>' +
        '<span class="ds-fit ds-txt">' + rubyHtml(cat || '', '', S.options.pinyin) + '</span></div>' +
        '<div class="ds-map-roll">🎲 <span>我掷到了：</span><span class="ds-roll-box"></span></div>' +
        '<div class="ds-map-draw"></div><div class="ds-map-line"></div></div>';
    });
    html += '</div>' + writeHtml(S.layout === 'story' ? '把故事连起来写一写：' : '用句型写一写：', S.options.writing === 'none' ? 'lines' : S.options.writing);
    return html + sheetClose(false);
  }

  function writingSheet() {
    var title = S.title || (S.layout === 'story' ? '我的故事' : '我的句子');
    return sheetOpen('writing', title) +
      '<div class="ds-topic">题目：<i></i></div><div class="ds-frame"><span>画一画</span></div>' +
      writeHtml('', S.options.writing === 'none' ? 'lines' : S.options.writing) + sheetClose(false);
  }

  function renderSheets() {
    if (!S) return;
    usedPictures = false;
    var pages = [mainSheet()];
    var o = S.options;
    if (o.pages.vocab) pages = pages.concat(vocabSheets());
    if (o.pages.organizer) pages.push(organizerSheet());
    if (o.pages.writing) pages.push(writingSheet());
    var size = paperSize();
    $('dsPageSize').textContent = '@media print { @page { size: ' + size.css + ' ' + o.orient + '; margin: 0; } }';
    var root = $('dsSheets');
    root.innerHTML = pages.join('');
    Array.prototype.forEach.call(root.querySelectorAll('img'), function (img) {
      img.addEventListener('load', scheduleLayout, { once: true });
      img.addEventListener('error', function () { img.closest('.ds-pic') && img.closest('.ds-pic').remove(); scheduleLayout(); }, { once: true });
    });
    layoutAll();
    if (o.pages.vocab && !hanWords().length) setFitNote(L('The word bank needs Chinese words in the grid.', '表格里有中文词语才能生成词汇参考页。'));
  }

  // ---------- fitting (sizes are measured after the sheet is on the page) ----------
  function setFitNote(text) { $('dsFitNote').textContent = text || ''; }

  function pxPerMm(sheet) { return sheet.offsetWidth / paperSize().w; }

  function fitText(el, minPx) {
    el.classList.remove('is-wrap');
    el.style.fontSize = '';
    var size = parseFloat(getComputedStyle(el).fontSize);
    var box = el.parentElement;
    var guard = 0;
    while ((el.scrollWidth > el.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1) && size > minPx && guard++ < 30) {
      size *= 0.92;
      el.style.fontSize = size + 'px';
    }
    if (el.scrollWidth > el.clientWidth + 1) el.classList.add('is-wrap');
  }

  function snapWrite(sheet, mm) {
    Array.prototype.forEach.call(sheet.querySelectorAll('.ds-write'), function (write) {
      write.style.height = '';
      write.style.width = '';
      write.innerHTML = '';
      var step = write.classList.contains('ds-write-grid') ? 12 : 10;
      var h = write.clientHeight / mm;
      var w = write.parentElement.clientWidth / mm;
      var rows = Math.max(0, Math.floor(h / step));
      var cols = Math.floor(w / step);
      write.style.height = rows * step + 'mm';
      if (step === 12) write.style.width = cols * step + 'mm';
      write.parentElement.hidden = rows < 1;
      // Real elements with borders: thin background lines vanish when the preview is scaled down.
      var cell = step === 12 ? '<span class="ds-gcell"></span>' : '<span class="ds-line"></span>';
      write.style.gridTemplateColumns = step === 12 ? 'repeat(' + cols + ', 12mm)' : '';
      write.innerHTML = new Array(rows * (step === 12 ? cols : 1) + 1).join(cell);
    });
  }

  function layoutMain(sheet, mm) {
    var table = sheet.querySelector('.ds-sheet-table');
    var body = sheet.querySelector('.ds-body');
    var prompt = sheet.querySelector('.ds-prompt');
    var head = table.tHead.rows[0];
    var rows = table.tBodies[0].rows.length;
    var hasPic = !!table.querySelector('.has-pic');
    var writing = S.options.writing !== 'none';
    var story = S.layout === 'story';
    var maxRow = story ? (hasPic ? 38 : 22) : (hasPic ? 40 : 20);
    if (!writing) maxRow *= 1.5;
    var minWrite = writing ? (story ? 34 : 30) : 0;
    var avail = body.clientHeight / mm - (prompt ? prompt.offsetHeight / mm + 3 : 0) - head.offsetHeight / mm - minWrite - 4;
    var row = Math.max(9, Math.min(maxRow, avail / rows));
    table.style.setProperty('--ds-row', row + 'mm');
    return row <= 9.01 && avail / rows < 9;
  }

  function layoutVocab(sheet, mm) {
    var grid = sheet.querySelector('.ds-vocab');
    var rows = Number(grid.dataset.rows) || 1;
    var h = Math.min(44, (grid.parentElement.clientHeight / mm - (rows - 1) * 3) / rows);
    grid.style.gridAutoRows = h + 'mm';
  }

  function layoutAll() {
    var crowded = false;
    Array.prototype.forEach.call($('dsSheets').querySelectorAll('.ds-sheet'), function (sheet) {
      var mm = pxPerMm(sheet);
      if (sheet.classList.contains('ds-sheet-main') && layoutMain(sheet, mm)) crowded = true;
      if (sheet.classList.contains('ds-sheet-vocab')) layoutVocab(sheet, mm);
      Array.prototype.forEach.call(sheet.querySelectorAll('.ds-fit'), function (el) { fitText(el, 2.2 * mm); });
      snapWrite(sheet, mm);
    });
    if (!$('dsPageVocab').checked || hanWords().length) {
      setFitNote(crowded ? L('The grid is very full, so the boxes are at their smallest. Try fewer categories, Portrait paper, or no writing space.', '表格内容很多，格子已经缩到最小。可以减少类别、改成竖向，或者不要书写区。') : '');
    }
    fitPreview();
  }
  function scheduleLayout() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(layoutAll, 60);
  }

  function fitPreview() {
    var stage = $('dsStage');
    var sheets = $('dsSheets');
    sheets.style.transform = 'none';
    var width = sheets.offsetWidth;
    var scale = Math.min(1, (stage.clientWidth - 24) / Math.max(1, width));
    sheets.style.transform = 'scale(' + scale + ')';
    stage.style.height = Math.ceil(sheets.offsetHeight * scale + 24) + 'px';
  }

  // ---------- refresh ----------
  function updateCount() {
    var cats = S.categories.length;
    var pics = S.options.picMode === 'text' ? 0 : words().length;
    var empty = S.cells.reduce(function (n, row) { return n + row.filter(function (v) { return !v; }).length; }, 0);
    var parts = [S.layout === 'story' ? L(cats + ' columns', cats + ' 列') : L(cats + ' rows', cats + ' 行')];
    if (pics) parts.push(L(pics + ' words with pictures', pics + ' 个词配图'));
    if (empty) parts.push(L(empty + ' empty boxes (students fill them in)', empty + ' 个空格（留给学生填）'));
    $('dsCount').textContent = parts.join(' · ');
  }
  function refresh() {
    readControls();
    updateCount();
    saveDraft();
    renderChips();
    renderSheets();
    prepare();
  }
  function scheduleRefresh() {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(refresh, 250);
  }

  function setLayout(layout) {
    if (layout === S.layout) return;
    var max = DS.MAX_CATEGORIES[layout];
    if (S.categories.length > max) {
      var ok = window.confirm(L('The story grid has at most ' + max + ' columns. Categories after the ' + max + 'th will be removed. Continue?',
        '故事格最多 ' + max + ' 列，第 ' + max + ' 个以后的类别会被删除。继续吗？'));
      if (!ok) { setRadio('dsLayout', S.layout); return; }
      S.categories = S.categories.slice(0, max);
      S.cells = S.cells.slice(0, max);
    }
    S.layout = layout;
    S.options.orient = layout === 'story' ? 'portrait' : 'landscape';
    setRadio('dsOrient', S.options.orient);
    renderGridEditor();
    refresh();
  }

  // ---------- presets ----------
  function fillPresets() {
    var select = $('dsPreset');
    select.add(new Option(L('Blank sentence table', '空白句型表'), 'blank-table'));
    select.add(new Option(L('Blank story grid', '空白故事格'), 'blank-story'));
    DS.PRESETS.forEach(function (preset) { select.add(new Option(zh ? preset.name.zh : preset.name.en, preset.id)); });
    select.value = 'story-want';
  }
  function applyPreset(id, quiet) {
    if (!quiet && filled() && !window.confirm(L('Replace the current grid with this template?', '用这个模板替换现在的表格内容吗？'))) return;
    var paper = S ? S.options.paper : 'a4';
    var preset = DS.PRESETS.filter(function (p) { return p.id === id; })[0];
    var data = preset ? JSON.parse(JSON.stringify(preset.data)) : DS.blankData(id === 'blank-story' ? 'story' : 'table');
    S = DS.normalize(data);
    S.options.paper = paper;
    writeControls();
    renderGridEditor();
    refresh();
  }

  // ---------- template saving (members: account, others: this browser) ----------
  function bindTemplate() {
    if (!window.TeacherGameTemplate) return;
    $('dsSaveTemplate').disabled = false;
    window.TeacherGameTemplate.bind({
      button: $('dsSaveTemplate'),
      gameType: 'dice-story',
      version: 1,
      getData: function () {
        readControls();
        try {
          return Object.assign(DS.template(S), { title: S.title || L('Dice Story', '骰子故事') });
        } catch (error) {
          throw new Error(zh ? '请先在表格里填一些内容再保存。' : error.message);
        }
      },
      restore: function (data) {
        S = DS.normalize(data);
        writeControls();
        renderGridEditor();
        refresh();
      }
    });
  }

  // ---------- print ----------
  function printSheets() {
    layoutAll();
    var images = Array.prototype.slice.call($('dsSheets').querySelectorAll('img'));
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([
      ready.then(function () {
        return Promise.all(images.map(function (img) {
          return img.complete ? null : new Promise(function (resolve) { img.addEventListener('load', resolve); img.addEventListener('error', resolve); });
        }));
      }),
      new Promise(function (resolve) { setTimeout(resolve, 2500); })
    ]).then(function () { layoutAll(); window.print(); });
  }

  // ---------- init ----------
  function init() {
    if (!DS) return;
    fillPresets();
    if (!loadDraft()) {
      var first = DS.PRESETS.filter(function (p) { return p.id === 'story-want'; })[0];
      S = DS.normalize(JSON.parse(JSON.stringify(first.data)));
    }
    writeControls();
    renderGridEditor();

    var grid = $('dsGrid');
    grid.addEventListener('input', onGridInput);
    grid.addEventListener('paste', onGridPaste);
    grid.addEventListener('click', onGridClick);
    $('dsAddCat').addEventListener('click', function () {
      if (S.categories.length >= maxCats()) return;
      S.categories.push('');
      S.cells.push(['', '', '', '', '', '']);
      renderGridEditor();
      refresh();
      var inputs = grid.querySelectorAll('.ds-cat-input');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
    $('dsClear').addEventListener('click', function () {
      if (filled() && !window.confirm(L('Clear every box in the grid?', '清空表格里的所有内容吗？'))) return;
      S.categories = S.categories.map(function () { return ''; });
      S.cells = S.cells.map(function () { return ['', '', '', '', '', '']; });
      renderGridEditor();
      refresh();
    });
    $('dsApplyPreset').addEventListener('click', function () { applyPreset($('dsPreset').value); });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="dsLayout"]'), function (input) {
      input.addEventListener('change', function () { setLayout(input.value); });
    });
    ['dsTitle', 'dsPrompt'].forEach(function (id) { $(id).addEventListener('input', scheduleRefresh); });
    ['dsPinyin', 'dsColor', 'dsPaper', 'dsPageVocab', 'dsPageOrganizer', 'dsPageWriting', 'dsEnglish'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        refresh();
        if (id === 'dsColor') renderGridEditor();
      });
    });
    ['dsPicMode', 'dsPicStyle', 'dsWriting', 'dsOrient'].forEach(function (name) {
      Array.prototype.forEach.call(document.querySelectorAll('input[name="' + name + '"]'), function (input) {
        input.addEventListener('change', refresh);
      });
    });

    $('dsPickerClose').addEventListener('click', function () { closePicker(); });
    $('dsPickerNone').addEventListener('click', removePicture);
    var searchTimer = 0;
    $('dsPickerSearch').addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderPickerResults, 200);
    });
    $('dsUpload').addEventListener('change', function (event) {
      uploadPicture(event.target.files && event.target.files[0]);
      event.target.value = '';
    });
    $('dsPrint').addEventListener('click', printSheets);
    window.addEventListener('resize', function () { clearTimeout(renderTimer); renderTimer = setTimeout(fitPreview, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutAll);

    refresh();
    bindTemplate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
