/*
 * 扩句阶梯 · Sentence Ladder — teacher page.
 * Model and rules: ladder-core.js. Rendering: ladder-view.js. Examples: ladder-themes.js.
 * Members' student link: services/games/sentenceLadderGame.js (collectsWork).
 */
(function () {
  'use strict';

  var Core = window.SentenceLadder;
  var View = window.SentenceLadderView;
  var Themes = window.SentenceLadderThemes;
  var zh = document.body.dataset.lang === 'zh';
  var L = function (en, cn) { return zh ? cn : en; };
  var $ = function (id) { return document.getElementById(id); };
  var esc = View.esc;
  var DRAFT_KEY = 'sentence-ladder:draft:v1';
  var MM = 96 / 25.4;

  var S = null;
  var renderTimer = null;
  var pinyinCache = null;

  // ---------- storage ----------
  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (error) { return null; }
  }
  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(S)); } catch (error) { /* private window or full storage */ }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function level() { return S.level; }
  function shownRows() { return Core.rowCount(S); }

  // ---------- Step 1: themes ----------
  function version() {
    var picked = document.querySelector('input[name="slVersion"]:checked');
    return picked ? picked.value : 'native';
  }

  function renderThemes() {
    var root = $('slThemes');
    root.replaceChildren();
    Themes.THEMES.forEach(function (theme) {
      var card = el('button', 'sl-theme');
      card.type = 'button';
      var picture = el('span', 'sl-theme-pic');
      var img = el('img');
      img.src = View.emojiUrl(theme.scene.items[theme.kind === 'event' ? 1 : 0]);
      img.alt = '';
      picture.appendChild(img);
      card.append(picture, el('strong', '', theme.topic), el('span', 'sl-theme-kind', theme.kind === 'event' ? L('写事 · event', '写事篇') : L('写物 · thing', '写物篇')));
      card.addEventListener('click', function () { loadTheme(theme.id); });
      root.appendChild(card);
    });
    [['thing', '✏️', L('Blank · things', '空白写物')], ['event', '✏️', L('Blank · events', '空白写事')]].forEach(function (entry) {
      var card = el('button', 'sl-theme sl-theme-blank');
      card.type = 'button';
      card.append(el('span', 'sl-theme-pic', entry[1]), el('strong', '', entry[2]), el('span', 'sl-theme-kind', L('your own sentence', '自己写句子')));
      card.addEventListener('click', function () {
        if (!confirmReplace()) return;
        var keep = keepOutput();
        S = Core.blank(entry[0]);
        Object.assign(S, keep);
        afterLoad();
      });
      root.appendChild(card);
    });
  }

  function confirmReplace() {
    return !S || !S.segs.length || window.confirm(L('Replace the ladder you are editing?', '替换正在编辑的阶梯吗？'));
  }

  // Output settings survive a change of theme.
  function keepOutput() {
    return S ? { showPy: S.showPy, script: S.script } : {};
  }

  function loadTheme(id) {
    if (!confirmReplace()) return;
    var keep = keepOutput();
    S = Core.normalize(Object.assign(Themes.build(id, version()), keep));
    afterLoad();
  }

  function afterLoad() {
    pinyinCache = null;
    writeControls();
    renderAllEditors();
    saveDraft();
    renderPreview();
    $('slEditHeading').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Step 2: editor ----------
  function writeControls() {
    $('slTopic').value = S.topic;
    $('slTitle').value = S.title;
    $('slKind').value = S.kind;
    $('slLayout').value = S.scene.layout;
    $('slBg').value = S.scene.bg;
    $('slScript').value = S.script;
    $('slShowPy').checked = S.showPy;
    document.querySelectorAll('input[name="slLevel"]').forEach(function (input) { input.checked = input.value === S.level; });
    $('slRemoveUpload').hidden = !S.image;
  }

  function renderAllEditors() {
    renderItems();
    renderRows();
    renderSegs();
    renderShownOptions();
    renderLevelNote();
  }

  function changed(options) {
    options = options || {};
    if (options.text) pinyinCache = null;
    saveDraft();
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPreview, options.now ? 0 : 150);
  }

  ['slTopic', 'slTitle'].forEach(function (id) {
    $(id).addEventListener('input', function () {
      S.topic = $('slTopic').value.trim();
      S.topicPy = '';
      S.title = $('slTitle').value.trim();
      changed({ text: true });
    });
  });
  $('slKind').addEventListener('change', function () { S.kind = $('slKind').value; changed(); });
  $('slLayout').addEventListener('change', function () { S.scene.layout = $('slLayout').value; changed({ now: true }); });
  $('slBg').addEventListener('change', function () { S.scene.bg = $('slBg').value; changed({ now: true }); });
  $('slScript').addEventListener('change', function () {
    S.script = $('slScript').value;
    var go = function () { renderAllEditors(); changed({ now: true }); };
    if (S.script === 't') View.loadTable().then(go, function () { window.alert(L('Traditional characters could not be loaded. Check your connection.', '繁体字表加载失败，请检查网络。')); });
    else go();
  });
  $('slShowPy').addEventListener('change', function () { S.showPy = $('slShowPy').checked; changed({ now: true }); });
  $('slShowKey').addEventListener('change', function () { changed({ now: true }); });
  document.querySelectorAll('input[name="slLevel"]').forEach(function (input) {
    input.addEventListener('change', function () {
      if (!input.checked) return;
      S.level = input.value;
      S.shown = 0;
      renderShownOptions();
      renderLevelNote();
      changed({ now: true });
    });
  });
  $('slShown').addEventListener('change', function () { S.shown = Number($('slShown').value) || 0; changed({ now: true }); });

  function renderShownOptions() {
    var select = $('slShown');
    select.replaceChildren();
    var auto = Math.min(S.rows.length, Core.LEVELS[S.level].rows);
    select.add(new Option(L('Level default (' + auto + ')', '按级别（' + auto + ' 行）'), '0'));
    for (var n = 1; n <= S.rows.length; n += 1) select.add(new Option(L(n + ' rows', n + ' 行'), String(n)));
    select.value = String(S.shown && S.shown <= S.rows.length ? S.shown : 0);
  }

  function renderLevelNote() {
    $('slLevelNote').textContent = {
      basic: L('Beginner: the first 4 rows, and a word box under each row with the answer and your distractors. On the student link, students tap a word; answers are checked.',
        '入门：只用前 4 行，每行下面有词语框（答案 + 干扰词）。学生链接里点选词语，系统自动判对错。'),
      mid: L('Middle: the first 5 rows, and a word box with the answers only (students still choose where each word goes and write it).',
        '进阶：用前 5 行，词语框里只有答案，学生要自己判断放在哪里并写出来。'),
      native: L('Native: all rows, no word box. Students write their own words; you read the answers.',
        '母语：全部的行，没有词语框，学生自由写，老师自己看。')
    }[S.level];
  }

  // ----- picture -----
  var emojiIndex = null;
  function renderItems() {
    var root = $('slItems');
    root.replaceChildren();
    if (S.image) {
      var photo = el('span', 'sl-item sl-item-photo');
      var img = el('img');
      img.src = S.image;
      img.alt = '';
      photo.appendChild(img);
      root.appendChild(photo);
      root.appendChild(el('span', 'sl-hint', L('Your own picture is used. The emoji picture is kept for later.', '正在使用你上传的图片。emoji 图片还保留着，可以换回来。')));
      return;
    }
    S.scene.items.forEach(function (hex, index) {
      var item = el('span', 'sl-item');
      var img = el('img');
      img.src = View.emojiUrl(hex);
      img.alt = '';
      var remove = el('button', 'sl-item-remove', '×');
      remove.type = 'button';
      remove.title = L('Remove', '删除');
      remove.addEventListener('click', function () { S.scene.items.splice(index, 1); renderItems(); changed({ now: true }); });
      var left = el('button', 'sl-item-move', '‹');
      left.type = 'button';
      left.title = L('Move left', '往前移');
      left.disabled = index === 0;
      left.addEventListener('click', function () { var moved = S.scene.items.splice(index, 1)[0]; S.scene.items.splice(index - 1, 0, moved); renderItems(); changed({ now: true }); });
      item.append(img, left, remove);
      root.appendChild(item);
    });
    if (S.scene.items.length < 6) {
      var add = el('button', 'sl-item sl-item-add', '+');
      add.type = 'button';
      add.title = L('Add a picture', '加一个图');
      add.addEventListener('click', openPicker);
      root.appendChild(add);
    }
  }

  function openPicker() {
    $('slPicker').hidden = false;
    $('slPickerSearch').value = S.topic || '';
    $('slPickerSearch').focus();
    $('slPickerSearch').select();
    renderPicker();
  }

  var pickerTimer = null;
  $('slPickerSearch').addEventListener('input', function () { clearTimeout(pickerTimer); pickerTimer = setTimeout(renderPicker, 200); });
  $('slPickerSearch').addEventListener('keydown', function (event) { if (event.key === 'Escape') $('slPicker').hidden = true; });

  function renderPicker() {
    var root = $('slPickerResults');
    var query = $('slPickerSearch').value.trim();
    root.replaceChildren();
    if (!window.ChenEmoji) return;
    window.ChenEmoji.load().then(function (index) {
      emojiIndex = index;
      if ($('slPickerSearch').value.trim() !== query) return;
      var results = query ? window.ChenEmoji.search(query, index, { limit: 40 }) : [];
      root.replaceChildren();
      if (!results.length) {
        root.appendChild(el('p', 'sl-hint', query ? L('No pictures found. Try another word, in English if you can.', '没有找到图片。换一个词试试，用英文更容易找到。') : L('Type a word to search.', '输入一个词来搜索。')));
        return;
      }
      results.forEach(function (entry) {
        var button = el('button', 'sl-pick');
        button.type = 'button';
        button.title = entry.annotation || '';
        var img = el('img');
        img.src = View.emojiUrl(entry.hexcode);
        img.alt = entry.annotation || '';
        img.loading = 'lazy';
        button.appendChild(img);
        button.addEventListener('click', function () {
          if (S.scene.items.length >= 6) return;
          S.scene.items.push(entry.hexcode);
          if (window.ChenEmoji.remember && S.topic) window.ChenEmoji.remember({ zh: S.topic }, entry.emoji);
          $('slPicker').hidden = S.scene.items.length >= 6;
          renderItems();
          changed({ now: true });
        });
        root.appendChild(button);
      });
    }, function () {
      root.replaceChildren(el('p', 'sl-hint', L('The pictures could not be loaded. Check your internet connection.', '图片加载失败，请检查网络连接。')));
    });
  }

  // Uploaded pictures are shrunk until the data URL fits in a student link (< 46 kB).
  $('slUpload').addEventListener('change', function (event) {
    var file = event.target.files[0];
    event.target.value = '';
    if (!file || !/^image\//.test(file.type)) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var side = 720;
      var data = '';
      for (var attempt = 0; attempt < 8 && (!data || data.length > 46000); attempt += 1) {
        var scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        var context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        data = canvas.toDataURL('image/jpeg', attempt < 3 ? 0.72 - attempt * 0.12 : 0.5);
        if (attempt >= 2) side = Math.round(side * 0.8);
      }
      if (data.length > 46000) { window.alert(L('This picture is too detailed to use. Try another one.', '这张图片太大了，请换一张。')); return; }
      S.image = data;
      $('slRemoveUpload').hidden = false;
      renderItems();
      changed({ now: true });
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      window.alert(L('This picture could not be opened. Try a PNG or JPG file.', '这张图片打不开，请换一个 PNG 或 JPG 文件。'));
    };
    img.src = url;
  });
  $('slRemoveUpload').addEventListener('click', function () {
    S.image = '';
    $('slRemoveUpload').hidden = true;
    renderItems();
    changed({ now: true });
  });

  // ----- rows -----
  Core.LABEL_SUGGESTIONS.forEach(function (label) { $('slLabelList').appendChild(new Option(label)); });

  function rowName(index) {
    return L('Row ', '第 ') + (index + 1) + L('', ' 行') + ' · ' + View.display(S, S.rows[index] ? S.rows[index].label : '');
  }

  function renderRows() {
    var root = $('slRows');
    root.replaceChildren();
    S.rows.forEach(function (row, index) {
      var line = el('div', 'sl-row-edit');
      line.style.setProperty('--sl-row', Core.COLORS[index % Core.COLORS.length]);
      line.appendChild(el('span', 'sl-row-num', String(index + 1)));
      var input = el('input', 'sl-input');
      input.value = row.label;
      input.maxLength = 12;
      input.setAttribute('list', 'slLabelList');
      input.setAttribute('aria-label', L('Row ', '第 ') + (index + 1) + L(' label', ' 行名称'));
      input.addEventListener('input', function () { row.label = input.value.trim() || '加…'; renderSegs(); changed(); });
      line.appendChild(input);
      line.appendChild(iconButton('↑', L('Move up', '上移'), index === 0, function () { swapRows(index, index - 1); }));
      line.appendChild(iconButton('↓', L('Move down', '下移'), index === S.rows.length - 1, function () { swapRows(index, index + 1); }));
      line.appendChild(iconButton('×', L('Delete row', '删除这一行'), S.rows.length <= 1, function () { deleteRow(index); }));
      root.appendChild(line);
    });
    $('slAddRow').disabled = S.rows.length >= Core.MAX_ROWS;
  }

  function iconButton(text, title, disabled, onClick) {
    var button = el('button', 'sl-icon-btn', text);
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.disabled = disabled;
    button.addEventListener('click', onClick);
    return button;
  }

  function swapRows(a, b) {
    var row = S.rows[a]; S.rows[a] = S.rows[b]; S.rows[b] = row;
    S.segs.forEach(function (seg) { if (seg.row === a) seg.row = b; else if (seg.row === b) seg.row = a; });
    renderAllEditors();
    changed({ now: true });
  }

  function deleteRow(index) {
    var used = S.segs.filter(function (seg) { return seg.row === index; }).length;
    if (used && !window.confirm(L('Pieces in this row move to the row above. Delete the row?', '这一行的句子块会移到上一行。确定删除吗？'))) return;
    S.rows.splice(index, 1);
    S.segs.forEach(function (seg) { if (seg.row >= index && seg.row > 0) seg.row -= 1; });
    if (S.shown > S.rows.length) S.shown = 0;
    renderAllEditors();
    changed({ now: true });
  }

  $('slAddRow').addEventListener('click', function () {
    if (S.rows.length >= Core.MAX_ROWS) return;
    var used = S.rows.map(function (row) { return row.label; });
    var next = Core.LABEL_SUGGESTIONS.filter(function (label) { return used.indexOf(label) < 0; })[0] || '加…';
    S.rows.push({ label: next });
    renderAllEditors();
    changed({ now: true });
  });

  // ----- segments -----
  function blankOptions() {
    var options = [[0, L('Given (printed)', '直接给出')]];
    for (var n = 1; n < Core.MAX_ROWS; n += 1) options.push([n, L('Blank for ' + n + ' row' + (n > 1 ? 's' : ''), '留空 ' + n + ' 行')]);
    options.push([Core.ALWAYS, L('Blank to the end', '一直留空')]);
    return options;
  }

  function renderSegs() {
    var root = $('slSegs');
    root.replaceChildren();
    var py = currentPinyin();
    S.segs.forEach(function (seg, index) {
      var card = el('div', 'sl-seg-edit' + (seg.blank ? ' is-blank' : ''));
      card.style.setProperty('--sl-row', Core.COLORS[seg.row % Core.COLORS.length]);
      var top = el('div', 'sl-seg-top');
      var text = el('input', 'sl-input sl-seg-text');
      text.value = seg.t;
      text.maxLength = 60;
      text.setAttribute('aria-label', L('Piece ', '第 ') + (index + 1) + L('', ' 块'));
      text.addEventListener('input', function () { seg.t = text.value; seg.py = ''; pyInput.placeholder = ''; changed({ text: true }); });
      text.addEventListener('change', function () { renderSegs(); });
      var row = el('select', 'sl-input sl-seg-row');
      row.setAttribute('aria-label', L('Row', '出现在'));
      S.rows.forEach(function (_row, rowIndex) { row.add(new Option(rowName(rowIndex), String(rowIndex))); });
      row.value = String(seg.row);
      row.addEventListener('change', function () { seg.row = Number(row.value); card.style.setProperty('--sl-row', Core.COLORS[seg.row % Core.COLORS.length]); changed({ now: true }); });
      var blank = el('select', 'sl-input sl-seg-blank');
      blank.setAttribute('aria-label', L('Blank', '留空'));
      blankOptions().forEach(function (option) { blank.add(new Option(option[1], String(option[0]))); });
      blank.value = String(seg.blank);
      blank.addEventListener('change', function () { seg.blank = Number(blank.value); card.classList.toggle('is-blank', seg.blank > 0); opts.disabled = !seg.blank; changed({ now: true }); });
      top.append(text, row, blank,
        iconButton('↑', L('Move up', '上移'), index === 0, function () { moveSeg(index, -1); }),
        iconButton('↓', L('Move down', '下移'), index === S.segs.length - 1, function () { moveSeg(index, 1); }),
        iconButton('×', L('Delete', '删除'), false, function () { S.segs.splice(index, 1); renderSegs(); changed({ now: true, text: true }); }));
      var bottom = el('div', 'sl-seg-bottom');
      var opts = el('input', 'sl-input');
      opts.value = seg.opts.join('，');
      opts.placeholder = L('Distractors for beginners, e.g. 一只，一本', '入门级的干扰词，如：一只，一本');
      opts.disabled = !seg.blank;
      opts.addEventListener('input', function () {
        seg.opts = opts.value.split(/[,，、;；/]/).map(function (word) { return word.trim(); }).filter(Boolean).slice(0, Core.MAX_OPTS);
        changed();
      });
      var pyInput = el('input', 'sl-input sl-seg-py');
      pyInput.value = seg.py || '';
      pyInput.placeholder = (py[index] || []).join(' ');
      pyInput.setAttribute('aria-label', L('Pinyin (fix if needed)', '拼音（需要时修改）'));
      pyInput.title = L('Pinyin is filled in for you. Type here only to fix it, one syllable per character.', '拼音会自动生成。只有需要改正时才在这里写，一个字一个音节，用空格分开。');
      pyInput.addEventListener('input', function () { seg.py = pyInput.value.trim(); changed({ text: true }); });
      bottom.append(opts, pyInput);
      card.append(top, bottom);
      root.appendChild(card);
    });
    $('slAddSeg').disabled = S.segs.length >= Core.MAX_SEGMENTS;
    showProblem();
  }

  function moveSeg(index, step) {
    var target = index + step;
    if (target < 0 || target >= S.segs.length) return;
    var seg = S.segs.splice(index, 1)[0];
    S.segs.splice(target, 0, seg);
    renderSegs();
    changed({ now: true, text: true });
  }

  $('slAddSeg').addEventListener('click', function () {
    var lastRow = S.segs.length ? S.segs[S.segs.length - 1].row : 0;
    S.segs.push({ t: '', row: lastRow, blank: 0, opts: [], py: '' });
    renderSegs();
    var inputs = $('slSegs').querySelectorAll('.sl-seg-text');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  $('slQuickApply').addEventListener('click', function () {
    var pieces = $('slQuickText').value.split(/[/／]/).map(function (piece) { return piece.replace(/\s+/g, ''); }).filter(Boolean);
    if (!pieces.length) { $('slQuickText').focus(); return; }
    if (S.segs.length && !window.confirm(L('Replace the pieces below?', '替换下面已有的句子块吗？'))) return;
    S.segs = pieces.slice(0, Core.MAX_SEGMENTS).map(function (piece) { return { t: piece, row: 0, blank: 0, opts: [], py: '' }; });
    renderSegs();
    changed({ now: true, text: true });
  });

  function showProblem() {
    var draft = Core.normalize(S);
    var problem = Core.validate(draft);
    var empties = S.segs.filter(function (seg) { return !seg.t.trim(); }).length;
    $('slProblem').textContent = problem || (empties ? L('Empty pieces are left out.', '空的句子块不会显示。') : '');
  }

  // ---------- pinyin ----------
  function currentPinyin() {
    if (!pinyinCache) pinyinCache = View.segmentPinyin(Core.normalize(S));
    return pinyinCache;
  }

  // ---------- the worksheet ----------
  function model() {
    return Core.normalize(S);
  }

  // The topic word must fit the 50 mm title box on one line.
  function topicSize(m) {
    var length = Math.max(1, Array.from(m.topic || '').length);
    return Math.min(11, 38 / length).toFixed(1);
  }

  function sheetHtml(m, options) {
    options = options || {};
    var py = View.segmentPinyin(m);
    var count = Core.rowCount(m);
    var head = '<div class="sl-sheet-head">' +
      '<div class="sl-title-card" style="--sl-topic-size:' + topicSize(m) + 'mm"><span class="sl-kind">' + esc(View.kindLabel(m)) + '</span>' +
      '<span class="sl-topic-label">' + esc(View.display(m, '主题')) + '</span>' + View.topicHtml(m) +
      (options.key ? '<span class="sl-key-badge">' + esc(View.display(m, '答案')) + '</span>' : '<span class="sl-name">' + esc(View.display(m, '姓名')) + '<span></span></span>') + '</div>' +
      View.sceneHtml(m) + '</div>';
    var rows = '';
    for (var k = 0; k < count; k += 1) {
      var label = View.display(m, m.rows[k].label);
      rows += '<div class="sl-row" style="--sl-row:' + Core.COLORS[k % Core.COLORS.length] + '">' +
        '<div class="sl-label">' + View.ruby(label, View.syllables(m.rows[k].label), m.showPy) + '</div>' +
        '<div class="sl-text"><div class="sl-line">' + View.rowHtml(m, k, { mode: options.key ? 'key' : 'sheet', py: py }) + '</div>' +
        (options.key ? '' : View.wordBoxHtml(m, k)) + '</div></div>';
    }
    var credit = m.image ? 'clsteachingtools.com' : 'Emoji: OpenMoji · CC BY-SA 4.0 · clsteachingtools.com';
    return '<div class="sl-sheet' + (m.showPy ? '' : ' no-py') + '"><div class="sl-sheet-body">' + head + '<div class="sl-ladder">' + rows + '</div>' +
      '<div class="sl-foot">' + esc(credit) + '</div></div></div>';
  }

  // Shrinks the text until the sheet fits one A4 page.
  function fitSheet(sheet) {
    var body = sheet.querySelector('.sl-sheet-body');
    var size = 7.4;
    sheet.style.setProperty('--sl-fs', size + 'mm');
    var style = getComputedStyle(sheet);
    var limit = sheet.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    var guard = 0;
    while (body.scrollHeight > limit && size > 3.4 && guard < 40) {
      size -= 0.2;
      sheet.style.setProperty('--sl-fs', size.toFixed(2) + 'mm');
      guard += 1;
    }
  }

  function renderPreview() {
    var m = model();
    var host = $('slPreview');
    host.innerHTML = '<div class="sl-preview-scale">' + sheetHtml(m, { key: $('slShowKey').checked }) + '</div>';
    var sheet = host.querySelector('.sl-sheet');
    fitSheet(sheet);
    scalePreview();
    if (pinyinCache === null) renderSegPlaceholders();
  }

  function renderSegPlaceholders() {
    var py = currentPinyin();
    $('slSegs').querySelectorAll('.sl-seg-py').forEach(function (input, index) { input.placeholder = (py[index] || []).join(' '); });
  }

  function scalePreview() {
    var host = $('slPreview');
    var wrap = host.querySelector('.sl-preview-scale');
    if (!wrap) return;
    var scale = Math.min(1, host.clientWidth / (210 * MM));
    wrap.style.transform = 'scale(' + scale + ')';
    host.style.height = Math.ceil(297 * MM * scale) + 'px';
  }
  window.addEventListener('resize', scalePreview);

  function whenReady(root) {
    var images = Array.prototype.slice.call(root.querySelectorAll('img'));
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return Promise.race([
      fonts.then(function () {
        return Promise.all(images.map(function (img) {
          return img.complete ? null : new Promise(function (resolve) { img.onload = img.onerror = resolve; });
        }));
      }),
      new Promise(function (resolve) { setTimeout(resolve, 4000); })
    ]);
  }

  function printSheet(key) {
    var m = model();
    var problem = Core.validate(m);
    if (problem) { window.alert(problem); return; }
    var area = $('slPrintArea');
    area.innerHTML = sheetHtml(m, { key: key });
    whenReady(area).then(function () {
      fitSheet(area.querySelector('.sl-sheet'));
      window.print();
    });
  }
  $('slPrint').addEventListener('click', function () { printSheet(false); });
  $('slPrintKey').addEventListener('click', function () { printSheet(true); });

  // ---------- projector ----------
  var show = null;

  function openShow(state) {
    show = state;
    $('slShow').hidden = false;
    document.body.classList.add('sl-showing');
    renderShow();
    $('slShowNext').focus();
  }

  function closeShow() {
    show = null;
    $('slShow').hidden = true;
    document.body.classList.remove('sl-showing');
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
  }

  function showSteps() {
    return show.mode === 'ladder' ? Core.rowCount(show.model) : show.items.length;
  }

  function renderShow() {
    var m = show.model;
    var stage = $('slShowStage');
    var py = View.segmentPinyin(m);
    var html = '';
    var total = showSteps();
    if (show.mode === 'ladder') {
      $('slShowCount').textContent = L('Row ', '第 ') + (show.step + 1) + ' / ' + total + L('', ' 行');
      var rows = '';
      for (var k = 0; k <= show.step; k += 1) {
        rows += '<div class="sl-row' + (k === show.step ? ' is-current' : '') + '" style="--sl-row:' + Core.COLORS[k % Core.COLORS.length] + '">' +
          '<div class="sl-label">' + View.ruby(View.display(m, m.rows[k].label), View.syllables(m.rows[k].label), m.showPy) + '</div>' +
          '<div class="sl-text"><div class="sl-line">' + View.rowHtml(m, k, { mode: show.key ? 'key' : 'sheet', py: py }) + '</div>' +
          (show.key ? '' : View.wordBoxHtml(m, k)) + '</div></div>';
      }
      html = '<div class="sl-show-side"><div class="sl-title-card"><span class="sl-kind">' + esc(View.kindLabel(m)) + '</span>' + View.topicHtml(m) + '</div>' + View.sceneHtml(m) + '</div>' +
        '<div class="sl-show-rows' + (m.showPy ? '' : ' no-py') + '">' + rows + '</div>';
    } else {
      var item = show.items[show.step];
      var last = Core.rowCount(m) - 1;
      $('slShowCount').textContent = (show.step + 1) + ' / ' + total;
      html = '<div class="sl-show-side"><div class="sl-title-card"><span class="sl-kind">' + esc(View.kindLabel(m)) + '</span>' + View.topicHtml(m) + '</div>' + View.sceneHtml(m) + '</div>' +
        '<div class="sl-show-rows' + (m.showPy ? '' : ' no-py') + '">' +
        (show.names ? '<p class="sl-show-name">' + esc(item.studentName) + '</p>' : '') +
        '<div class="sl-row is-current is-work" style="--sl-row:' + Core.COLORS[last % Core.COLORS.length] + '"><div class="sl-text"><div class="sl-line">' +
        View.rowHtml(m, last, { mode: 'student', answers: item.answers, py: py }) + '</div></div></div>' +
        (show.key ? '<div class="sl-row is-model"><div class="sl-label">' + esc(View.display(m, '示范')) + '</div><div class="sl-text"><div class="sl-line">' + View.rowHtml(m, last, { mode: 'key', py: py }) + '</div></div></div>' : '') +
        '</div>';
    }
    stage.innerHTML = html;
    fitShow();
    $('slShowPrev').disabled = show.step === 0;
    $('slShowNext').disabled = show.step >= total - 1;
    $('slShowKey').classList.toggle('is-on', show.key);
  }

  // Largest text that still fits the screen.
  function fitShow() {
    var rows = $('slShowStage').querySelector('.sl-show-rows');
    if (!rows) return;
    var size = Math.min(window.innerWidth / 26, 64);
    rows.style.fontSize = size + 'px';
    var guard = 0;
    while ((rows.scrollHeight > rows.clientHeight + 1 || rows.scrollWidth > rows.clientWidth + 1) && size > 14 && guard < 60) {
      size -= 1.5;
      rows.style.fontSize = size + 'px';
      guard += 1;
    }
  }

  $('slPresent').addEventListener('click', function () {
    var m = model();
    var problem = Core.validate(m);
    if (problem) { window.alert(problem); return; }
    openShow({ mode: 'ladder', model: m, step: 0, key: false });
  });
  $('slShowPrev').addEventListener('click', function () { if (show && show.step > 0) { show.step -= 1; renderShow(); } });
  $('slShowNext').addEventListener('click', function () { if (show && show.step < showSteps() - 1) { show.step += 1; show.key = false; renderShow(); } });
  $('slShowKey').addEventListener('click', function () { if (show) { show.key = !show.key; renderShow(); } });
  $('slShowClose').addEventListener('click', closeShow);
  $('slShowFull').addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    else $('slShow').requestFullscreen().catch(function () {});
  });
  document.addEventListener('keydown', function (event) {
    if (!show) return;
    if (event.key === 'Escape' && !document.fullscreenElement) closeShow();
    else if (event.key === ' ' || event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); $('slShowNext').click(); }
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); $('slShowPrev').click(); }
    else if (event.key === 'a' || event.key === 'A') $('slShowKey').click();
  });
  window.addEventListener('resize', function () { if (show) fitShow(); });

  // ---------- Step 3: student links and the class's work ----------
  function copy(text) {
    if (window.TeacherGameShare) return window.TeacherGameShare.copyText(text);
    return navigator.clipboard.writeText(text);
  }

  function ladderShares() {
    return window.TeacherGameShare ? window.TeacherGameShare.listShares().filter(function (share) { return share.gameType === 'sentence-ladder'; }) : [];
  }

  function renderLinks() {
    var list = $('slLinks');
    list.replaceChildren();
    ladderShares().forEach(function (share) {
      var expired = share.expiresAt && new Date(share.expiresAt).getTime() < Date.now();
      var row = el('div', 'sl-link' + (expired ? ' is-expired' : ''));
      row.appendChild(el('strong', '', share.title));
      row.appendChild(el('span', 'sl-link-meta', expired ? L('Expired', '已过期') : L('Open until ', '有效至 ') + new Date(share.expiresAt).toLocaleDateString()));
      var actions = el('span', 'sl-actions');
      if (!expired) {
        var load = el('button', 'sl-btn sl-btn-small sl-btn-primary', L('Load answers', '载入作业'));
        load.type = 'button';
        load.addEventListener('click', function () { loadGallery(share.shareId, share.deleteToken); });
        var copyButton = el('button', 'sl-btn sl-btn-small', L('Copy link', '复制链接'));
        copyButton.type = 'button';
        copyButton.addEventListener('click', function () { copy(share.url).then(function () { copyButton.textContent = L('Copied!', '已复制！'); }); });
        var open = el('a', 'sl-btn sl-btn-small', L('Open', '打开'));
        open.href = share.url; open.target = '_blank'; open.rel = 'noopener';
        actions.append(load, copyButton, open);
      }
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function shareData() {
    var m = model();
    var problem = Core.validate(m);
    if (problem) throw new Error(problem);
    return View.freezePinyin(m);
  }

  $('slShare').addEventListener('click', function () {
    var problem = Core.validate(model());
    if (problem) { window.alert(problem); return; }
    if (!window.TeacherGameShare) return;
    window.TeacherGameShare.openPublisher({
      gameType: 'sentence-ladder',
      version: 1,
      title: function () { return S.title || ((S.kind === 'event' ? '写事 · ' : '写物 · ') + (S.topic || '扩句')); },
      getData: shareData,
      onPublished: renderLinks
    });
  });

  var gallery = { shareId: '', deleteToken: '', model: null, items: [], stars: {} };

  function galleryStatus(message, isError) {
    $('slGalleryStatus').textContent = message || '';
    $('slGalleryStatus').classList.toggle('is-error', Boolean(isError));
  }

  function loadGallery(shareId, deleteToken) {
    $('slGalleryBox').hidden = false;
    galleryStatus(L('Loading…', '正在载入……'));
    fetch('/api/game-shares/' + encodeURIComponent(shareId) + '/gallery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deleteToken: deleteToken || '' })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.error || L('Could not load the answers.', '作业载入失败。'));
        return body;
      });
    }).then(function (body) {
      if (gallery.shareId !== shareId) gallery.stars = {};
      gallery.shareId = shareId;
      gallery.deleteToken = deleteToken || '';
      gallery.model = Core.normalize(body.payload);
      gallery.title = body.title;
      gallery.items = (body.submissions || []).slice().sort(function (a, b) { return String(a.submittedAt).localeCompare(String(b.submittedAt)); });
      var ready = gallery.model.script === 't' ? View.loadTable().catch(function () {}) : Promise.resolve();
      return ready.then(renderGallery);
    }).catch(function (error) { galleryStatus(error.message, true); });
  }

  function renderGallery() {
    var m = gallery.model;
    $('slGalleryTitle').textContent = gallery.title || '';
    var list = $('slGallery');
    list.replaceChildren();
    var last = Core.rowCount(m) - 1;
    var py = View.segmentPinyin(m);
    galleryStatus(gallery.items.length ? L(gallery.items.length + ' students have handed in.', '已经有 ' + gallery.items.length + ' 个学生交了作业。') : L('No answers yet. Press Refresh when students have submitted.', '还没有人交作业。学生交了以后点“刷新”。'));
    gallery.items.forEach(function (item) {
      var li = el('li', 'sl-work');
      var head = el('div', 'sl-work-head');
      var star = el('button', 'sl-star' + (gallery.stars[item.studentName] ? ' is-on' : ''), gallery.stars[item.studentName] ? '★' : '☆');
      star.type = 'button';
      star.title = L('Star to present', '加星，投影展示');
      star.addEventListener('click', function () {
        gallery.stars[item.studentName] = !gallery.stars[item.studentName];
        star.classList.toggle('is-on');
        star.textContent = gallery.stars[item.studentName] ? '★' : '☆';
      });
      head.append(star, el('strong', '', item.studentName));
      if (typeof item.score === 'number') head.appendChild(el('span', 'sl-score', item.score + ' / ' + item.total));
      if (item.submittedAt) head.appendChild(el('span', 'sl-link-meta', new Date(item.submittedAt).toLocaleString()));
      var body = el('div', 'sl-line sl-work-line' + (m.showPy ? '' : ' no-py'));
      body.innerHTML = View.rowHtml(m, last, { mode: 'student', answers: item.answers, py: py });
      li.append(head, body);
      if (item.correct) {
        var wrong = Object.keys(item.correct).filter(function (index) { return !item.correct[index]; });
        if (wrong.length) li.appendChild(el('p', 'sl-hint', L('Not right: ', '没选对：') + wrong.map(function (index) {
          return (item.answers[index] || '—') + ' → ' + View.display(m, m.segs[index].t);
        }).join('；')));
      }
      list.appendChild(li);
    });
    $('slGalleryShow').disabled = !gallery.items.length;
  }

  $('slGalleryReload').addEventListener('click', function () { if (gallery.shareId) loadGallery(gallery.shareId, gallery.deleteToken); });
  $('slGalleryShow').addEventListener('click', function () {
    var items = gallery.items;
    if ($('slGalleryPickedOnly').checked) items = items.filter(function (item) { return gallery.stars[item.studentName]; });
    if (!items.length) { galleryStatus(L('Star some answers first, or untick “Only starred”.', '请先给一些作业加星，或者取消“只投影加星的”。'), true); return; }
    openShow({ mode: 'gallery', model: gallery.model, items: items, step: 0, key: false, names: $('slGalleryNames').checked });
  });

  // ---------- template saving (members: account, others: this browser) ----------
  function bindTemplate() {
    if (!window.TeacherGameTemplate) return;
    $('slSaveTemplate').disabled = false;
    window.TeacherGameTemplate.bind({
      button: $('slSaveTemplate'),
      gameType: 'sentence-ladder',
      version: 1,
      getData: function () {
        var data = shareData();
        data.title = S.title || (S.kind === 'event' ? '写事 · ' : '写物 · ') + (S.topic || '扩句');
        return data;
      },
      restore: function (data) {
        S = Core.normalize(data);
        var ready = S.script === 't' ? View.loadTable().catch(function () { S.script = 's'; }) : Promise.resolve();
        ready.then(afterLoad);
      }
    });
  }

  // ---------- start ----------
  var draft = readDraft();
  S = draft && Array.isArray(draft.rows) && draft.rows.length ? Core.normalize(draft) : Core.normalize(Themes.build('apple', 'native'));
  renderThemes();
  writeControls();
  renderAllEditors();
  renderPreview();
  renderLinks();
  bindTemplate();

  if (S.script === 't') View.loadTable().then(function () { renderAllEditors(); renderPreview(); }, function () {});
  // Better pinyin for polyphones once CC-CEDICT is here.
  if (window.ChenWordlist && window.ChenWordlist.loadCedict) {
    window.ChenWordlist.loadCedict().then(function () { pinyinCache = null; renderPreview(); renderSegPlaceholders(); }, function () {});
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { renderPreview(); });

  // Opened from My activities: /teaching-tools/sentence-ladder?gallery=<shareId>
  var galleryId = new URLSearchParams(location.search).get('gallery');
  if (galleryId) {
    var saved = ladderShares().filter(function (share) { return share.shareId === galleryId; })[0];
    loadGallery(galleryId, saved && saved.deleteToken);
    $('slStudentsHeading').scrollIntoView();
  }
})();
