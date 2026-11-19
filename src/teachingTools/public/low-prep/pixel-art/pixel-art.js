/* 像素画猜猜看 · teacher page: set up the word list, hand out a student page,
 * collect drawings (members' link or imported PNGs), then present or print. */
(function () {
  'use strict';

  var Core = window.PixelArtCore;
  var zh = document.body.dataset.lang === 'zh';
  var L = function (en, cn) { return zh ? cn : en; };
  var find = function (id) { return document.getElementById(id); };
  var SETUP_KEY = 'pixel-art-setup:v1';
  var GALLERY_KEY = 'pixel-art-gallery:v1';

  var gallery = [];
  var showAnswers = false;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function readJson(key, fallback) {
    try { var value = JSON.parse(localStorage.getItem(key) || 'null'); return value == null ? fallback : value; }
    catch (error) { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* storage unavailable */ }
  }

  // ---------- Step 1: setup ----------
  var titleInput = find('pxTitle');
  var gridInput = find('pxGrid');
  var wordsInput = find('pxWords');
  var promptsInput = find('pxPrompts');
  var showPyInput = find('pxShowPy');
  var showEnInput = find('pxShowEn');

  function loadSetup() {
    var saved = readJson(SETUP_KEY, null) || {};
    titleInput.value = saved.title || Core.DEFAULT_TITLE;
    gridInput.value = String(Core.GRID_SIZES.indexOf(Number(saved.grid)) === -1 ? 16 : saved.grid);
    wordsInput.value = typeof saved.words === 'string' ? saved.words : Core.DEFAULT_WORDS;
    promptsInput.value = typeof saved.prompts === 'string' ? saved.prompts : Core.DEFAULT_PROMPTS;
    showPyInput.checked = saved.showPy !== false;
    showEnInput.checked = saved.showEn !== false;
  }

  function config() {
    var words = Core.parseWords(wordsInput.value);
    words.forEach(function (word) { if (!word.en && english[word.zh]) word.en = english[word.zh]; });
    return Core.cleanConfig({
      title: titleInput.value, grid: Number(gridInput.value),
      words: words, prompts: Core.parsePrompts(promptsInput.value),
      show: { py: showPyInput.checked, en: showEnInput.checked }
    });
  }

  function onSetupChange() {
    writeJson(SETUP_KEY, { title: titleInput.value, grid: Number(gridInput.value), words: wordsInput.value, prompts: promptsInput.value, showPy: showPyInput.checked, showEn: showEnInput.checked });
    var current = config();
    var count = current.words.length;
    var countNode = find('pxWordCount');
    countNode.textContent = count > 80 ? L('Up to 80 words — only the first 80 are used.', '最多 80 个词，只用前 80 个。') : L(count + ' words', '共 ' + count + ' 个词');
    countNode.classList.toggle('is-error', count === 0);
    renderPreview(current);
    updateFreeLink();
    renderGallery();
    if (cedictReady) queueTranslation(current.words);
  }

  // Words the dictionary doesn't know (弹钢琴, 养狗…) get English from the
  // site's translation service, like the worksheet generator. Saved per browser.
  var ENGLISH_KEY = 'pixel-art-english:v1';
  var english = readJson(ENGLISH_KEY, {});
  var asked = {};
  var translateTimer = null;
  function queueTranslation(words) {
    var missing = words.filter(function (word) { return !word.en && !asked[word.zh]; }).map(function (word) { return word.zh; }).slice(0, 60);
    if (!missing.length) return;
    clearTimeout(translateTimer);
    translateTimer = setTimeout(function () {
      missing.forEach(function (zh) { asked[zh] = true; });
      fetch('/api/translate-words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words: missing, to: ['en'] }) })
        .then(function (response) { return response.ok ? response.json() : {}; })
        .then(function (data) {
          var found = false;
          Object.keys(data.translations || {}).forEach(function (zh) {
            var value = data.translations[zh] && data.translations[zh].en;
            if (value) { english[zh] = String(value).slice(0, 60); found = true; }
          });
          if (found) { writeJson(ENGLISH_KEY, english); onSetupChange(); }
        })
        .catch(function () {});
    }, 700);
  }

  // What students will see: the Chinese plus the pinyin and English filled in for each word.
  function renderPreview(current) {
    var box = find('pxWordPreview');
    box.replaceChildren();
    box.classList.toggle('hide-py', !current.show.py);
    box.classList.toggle('hide-en', !current.show.en);
    var group = null;
    current.words.forEach(function (word) {
      if (word.group !== group) {
        group = word.group;
        if (group) box.appendChild(el('p', 'px-preview-group', group));
      }
      var row = el('div', 'px-preview-word');
      row.appendChild(el('strong', 'px-kai', word.zh));
      row.appendChild(el('span', 'px-preview-py', word.py || '—'));
      row.appendChild(el('span', 'px-preview-en' + (word.en ? '' : ' is-missing'), word.en || (cedictReady ? L('no English found', '没找到英文') : L('looking up…', '正在查词典…'))));
      box.appendChild(row);
    });
  }

  [titleInput, gridInput, wordsInput, promptsInput].forEach(function (input) { input.addEventListener('input', onSetupChange); });
  [showPyInput, showEnInput].forEach(function (input) { input.addEventListener('change', onSetupChange); });

  // English for typed words comes from the CC-CEDICT dictionary, loaded once in the background.
  var cedictReady = false;
  if (window.ChenWordlist && window.ChenWordlist.loadCedict) {
    window.ChenWordlist.loadCedict().catch(function () {}).then(function () { cedictReady = true; onSetupChange(); });
  } else {
    cedictReady = true;
  }
  find('pxReset').addEventListener('click', function () {
    if (!window.confirm(L('Replace the words and sentences with the hobby list?', '把词表和句子换回默认的爱好词表？'))) return;
    titleInput.value = Core.DEFAULT_TITLE;
    wordsInput.value = Core.DEFAULT_WORDS;
    promptsInput.value = Core.DEFAULT_PROMPTS;
    onSetupChange();
  });

  // ---------- Step 2a: free drawing page ----------
  function freeUrl() {
    return location.origin + '/teaching-tools/pixel-art/draw#c=' + Core.encodeConfig(config());
  }

  function updateFreeLink() {
    var url = freeUrl();
    find('pxFreeLink').value = url;
    find('pxOpenFree').href = url;
    if (!find('pxQr').hidden) renderQr();
  }

  find('pxCopyFree').addEventListener('click', function (event) {
    var button = event.currentTarget;
    copy(freeUrl()).then(function () { button.textContent = L('Copied!', '已复制！'); }, function () { button.textContent = L('Copy failed', '复制失败'); });
    setTimeout(function () { button.textContent = L('Copy link', '复制链接'); }, 1800);
  });

  var qrLoader = null;
  function loadQr() {
    if (typeof window.QRCode === 'function') return Promise.resolve();
    if (!qrLoader) {
      qrLoader = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        script.onload = resolve;
        script.onerror = function () { qrLoader = null; reject(); };
        document.head.appendChild(script);
      });
    }
    return qrLoader;
  }

  function renderQr() {
    var target = find('pxQr');
    target.hidden = false;
    target.textContent = L('Making QR code…', '正在生成二维码…');
    loadQr().then(function () {
      target.replaceChildren();
      new window.QRCode(target, { text: freeUrl(), width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.L });
    }, function () { target.textContent = L('The QR code could not load.', '二维码加载失败。'); });
  }

  find('pxQrFree').addEventListener('click', function () {
    if (!find('pxQr').hidden) { find('pxQr').hidden = true; return; }
    renderQr();
  });

  function copy(text) {
    if (window.TeacherGameShare) return window.TeacherGameShare.copyText(text);
    return navigator.clipboard.writeText(text);
  }

  // ---------- Step 2b: members' student link ----------
  function pixelShares() {
    return window.TeacherGameShare ? window.TeacherGameShare.listShares().filter(function (share) { return share.gameType === 'pixel-art'; }) : [];
  }

  function renderLinks() {
    var list = find('pxLinks');
    list.replaceChildren();
    pixelShares().forEach(function (share) {
      var expired = share.expiresAt && new Date(share.expiresAt).getTime() < Date.now();
      var row = el('div', 'px-link' + (expired ? ' is-expired' : ''));
      row.appendChild(el('strong', '', share.title));
      row.appendChild(el('span', 'px-link-meta', expired ? L('Expired', '已过期') : L('Open until ', '有效至 ') + new Date(share.expiresAt).toLocaleDateString()));
      var actions = el('span', 'px-link-actions');
      if (!expired) {
        var load = el('button', 'px-btn px-btn-small px-btn-primary', L('Load drawings', '载入作品'));
        load.type = 'button';
        load.addEventListener('click', function () { loadFromLink(share.shareId, share.deleteToken); });
        var copyButton = el('button', 'px-btn px-btn-small', L('Copy link', '复制链接'));
        copyButton.type = 'button';
        copyButton.addEventListener('click', function () { copy(share.url).then(function () { copyButton.textContent = L('Copied!', '已复制！'); }); });
        var open = el('a', 'px-btn px-btn-small', L('Open', '打开'));
        open.href = share.url; open.target = '_blank'; open.rel = 'noopener';
        actions.append(load, copyButton, open);
      }
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  find('pxShare').addEventListener('click', function () {
    var current = config();
    if (!current.words.length) { wordsInput.focus(); return; }
    if (!window.TeacherGameShare) return;
    window.TeacherGameShare.openPublisher({
      gameType: 'pixel-art',
      version: 1,
      title: function () { return current.title; },
      getData: function () { return config(); },
      onPublished: renderLinks
    });
  });

  // ---------- Step 3: gallery ----------
  function status(message, isError) {
    var node = find('pxGalleryStatus');
    node.textContent = message;
    node.classList.toggle('is-error', Boolean(isError));
  }

  function entryFor(word, words) {
    return (words || config().words).filter(function (w) { return w.zh === word; })[0] || { zh: word, py: '', en: '' };
  }

  function saveGallery() { writeJson(GALLERY_KEY, gallery); }

  function loadFromLink(shareId, deleteToken) {
    status(L('Loading drawings…', '正在载入作品…'));
    fetch('/api/game-shares/' + encodeURIComponent(shareId) + '/gallery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deleteToken: deleteToken || '' })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.error || L('The drawings could not be loaded.', '作品载入失败。'));
        return body;
      });
    }).then(function (body) {
      var fresh = body.submissions.map(function (submission) {
        return {
          id: 'link:' + shareId + ':' + submission.studentName.toLowerCase(), source: 'link', shareId: shareId,
          studentName: submission.studentName, word: submission.word, entry: entryFor(submission.word, body.payload.words),
          grid: body.payload.grid, pixels: submission.pixels, sentences: submission.sentences || [], prompts: body.payload.prompts
        };
      }).reverse();
      var known = {};
      gallery.forEach(function (item) { known[item.id] = true; });
      var added = fresh.filter(function (item) { return !known[item.id]; });
      gallery = gallery.concat(added);
      saveGallery();
      renderGallery();
      status(L(body.submissions.length + ' drawings handed in; ' + added.length + ' new.', '共交了 ' + body.submissions.length + ' 幅，新载入 ' + added.length + ' 幅。'));
    }).catch(function (error) { status(error.message, true); });
  }

  function importFiles(files) {
    var list = Array.prototype.filter.call(files, function (file) { return /png$/i.test(file.type) || /\.png$/i.test(file.name); });
    if (!list.length) return status(L('Choose the PNG pictures students downloaded.', '请选择学生下载的 PNG 图片。'), true);
    var added = 0;
    var failed = [];
    Promise.all(list.map(function (file) {
      return file.arrayBuffer().then(function (buffer) {
        var work = Core.readWorkFromPng(buffer);
        if (!work) { failed.push(file.name); return; }
        var id = 'file:' + work.studentName.toLowerCase() + ':' + work.word + ':' + work.pixels;
        if (gallery.some(function (item) { return item.id === id; })) return;
        gallery.push({ id: id, source: 'file', studentName: work.studentName, word: work.word, entry: work.entry || entryFor(work.word), grid: work.grid, pixels: work.pixels, sentences: work.sentences, prompts: [] });
        added += 1;
      }).catch(function () { failed.push(file.name); });
    })).then(function () {
      saveGallery();
      renderGallery();
      var message = L(added + ' added.', '导入了 ' + added + ' 幅。');
      if (failed.length) message += ' ' + L('These are not pictures from this tool (maybe a screenshot or a compressed copy): ', '这些不是本工具下载的原图（可能是截图或被压缩过）：') + failed.join(', ');
      status(message, Boolean(failed.length));
    });
  }

  find('pxImport').addEventListener('change', function (event) { importFiles(event.target.files); event.target.value = ''; });
  var drop = find('pxDrop');
  drop.addEventListener('dragover', function (event) { event.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', function () { drop.classList.remove('is-over'); });
  drop.addEventListener('drop', function (event) { event.preventDefault(); drop.classList.remove('is-over'); importFiles(event.dataTransfer.files); });

  function renderGallery() {
    var list = find('pxGallery');
    if (!list) return;
    var shown = config().show;
    list.replaceChildren();
    find('pxEmpty').hidden = gallery.length > 0;
    ['pxPresent', 'pxPrint', 'pxShuffle', 'pxClear'].forEach(function (id) { find(id).disabled = !gallery.length; });
    gallery.forEach(function (item, index) {
      var card = el('li', 'px-card');
      card.appendChild(el('span', 'px-card-no', String(index + 1)));
      var img = el('img', 'px-card-art');
      img.src = Core.artDataUrl(item.pixels, item.grid, 192);
      img.alt = L('Drawing ', '作品 ') + (index + 1);
      card.appendChild(img);
      card.appendChild(el('p', 'px-card-name', item.studentName || L('(no name)', '（没写名字）')));
      var answer = el('p', 'px-card-word' + (showAnswers ? '' : ' is-hidden'));
      answer.appendChild(el('span', 'px-kai', item.word));
      if (shown.py && item.entry && item.entry.py) answer.appendChild(el('span', 'px-card-py', item.entry.py));
      card.appendChild(answer);
      var remove = el('button', 'px-card-remove', '×');
      remove.type = 'button';
      remove.title = L('Remove from gallery', '从画廊移除');
      remove.addEventListener('click', function () {
        gallery.splice(index, 1);
        saveGallery();
        renderGallery();
      });
      card.appendChild(remove);
      list.appendChild(card);
    });
  }

  find('pxShowAnswers').addEventListener('change', function (event) { showAnswers = event.target.checked; renderGallery(); });
  find('pxShuffle').addEventListener('click', function () {
    for (var i = gallery.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = gallery[i]; gallery[i] = gallery[j]; gallery[j] = swap;
    }
    saveGallery();
    renderGallery();
  });
  find('pxClear').addEventListener('click', function () {
    if (!window.confirm(L('Remove every drawing from this gallery? Drawings handed in through a student link can be loaded again.', '清空画廊里的所有作品？通过学生链接交的作品之后还可以重新载入。'))) return;
    gallery = [];
    saveGallery();
    renderGallery();
    status('');
  });

  // ---------- Present on the projector ----------
  var show = { index: 0, revealed: false };
  var overlay = find('pxShow');

  function tally() {
    var counts = {};
    gallery.forEach(function (item) { counts[item.word] = (counts[item.word] || 0) + 1; });
    return Object.keys(counts).map(function (word) { return { word: word, count: counts[word] }; })
      .sort(function (a, b) { return b.count - a.count || a.word.localeCompare(b.word, 'zh'); });
  }

  function renderShow() {
    var summary = show.index >= gallery.length;
    find('pxShowStage').hidden = summary;
    find('pxShowSummary').hidden = !summary;
    find('pxShowReveal').hidden = summary;
    find('pxShowPrev').disabled = show.index === 0;
    find('pxShowNext').disabled = summary;
    document.querySelector('.px-show-frame').hidden = summary;
    if (summary) {
      find('pxShowCount').textContent = L('Class results', '全班统计');
      var box = find('pxShowSummary');
      box.replaceChildren();
      var rows = tally();
      box.appendChild(el('h2', '', L('What did our class draw?', '我们班画了什么？')));
      var max = rows.length ? rows[0].count : 1;
      var chart = el('ol', 'px-tally');
      rows.forEach(function (row) {
        var entry = entryFor(row.word, gallery.map(function (item) { return item.entry; }).filter(Boolean));
        var line = el('li', '');
        var label = el('span', 'px-tally-word', row.word);
        if (entry.py && config().show.py) label.appendChild(el('small', '', entry.py));
        var bar = el('span', 'px-tally-bar');
        bar.style.width = Math.max(6, row.count / max * 100) + '%';
        line.append(label, bar, el('span', 'px-tally-count', String(row.count)));
        chart.appendChild(line);
      });
      box.appendChild(chart);
      if (rows.length) {
        var top = rows.filter(function (row) { return row.count === rows[0].count; }).map(function (row) { return row.word; });
        var hobbies = /爱好|hobb/i.test(config().title);
        box.appendChild(el('p', 'px-tally-frame', (hobbies ? '我们班很多同学喜欢' : '画得最多的是：') + top.join('、') + '。'));
      }
      return;
    }
    var item = gallery[show.index];
    find('pxShowCount').textContent = L('Picture ', '第 ') + (show.index + 1) + L(' of ', ' 幅 / 共 ') + gallery.length + L('', ' 幅');
    find('pxShowArt').src = Core.artDataUrl(item.pixels, item.grid, 720);
    find('pxShowArt').alt = L('Drawing ', '作品 ') + (show.index + 1);
    var answer = find('pxShowAnswer');
    answer.hidden = !show.revealed;
    find('pxShowReveal').textContent = show.revealed ? L('Hide answer', '隐藏答案') : L('Reveal (space)', '揭晓（空格）');
    answer.replaceChildren();
    if (show.revealed) {
      answer.appendChild(el('p', 'px-answer-name', item.studentName || ''));
      var word = el('p', 'px-answer-word', item.word);
      answer.appendChild(word);
      var shown = config().show;
      if (shown.py && item.entry && item.entry.py) answer.appendChild(el('p', 'px-answer-py', item.entry.py));
      if (shown.en && item.entry && item.entry.en) answer.appendChild(el('p', 'px-answer-en', item.entry.en));
      var sentences = (item.sentences || []).filter(Boolean);
      if (sentences.length) {
        var list = el('ol', 'px-answer-sentences');
        sentences.forEach(function (sentence) { list.appendChild(el('li', '', sentence)); });
        answer.appendChild(list);
      }
    }
  }

  function openShow() {
    if (!gallery.length) return;
    show.index = 0;
    show.revealed = false;
    overlay.hidden = false;
    document.body.classList.add('px-showing');
    renderShow();
    find('pxShowReveal').focus();
  }

  function closeShow() {
    overlay.hidden = true;
    document.body.classList.remove('px-showing');
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
  }

  function move(step) {
    var next = Math.min(gallery.length, Math.max(0, show.index + step));
    if (next === show.index) return;
    show.index = next;
    show.revealed = false;
    renderShow();
  }

  find('pxPresent').addEventListener('click', openShow);
  find('pxShowClose').addEventListener('click', closeShow);
  find('pxShowPrev').addEventListener('click', function () { move(-1); });
  find('pxShowNext').addEventListener('click', function () { move(1); });
  find('pxShowReveal').addEventListener('click', function () { show.revealed = !show.revealed; renderShow(); });
  find('pxShowFull').addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    else if (overlay.requestFullscreen) overlay.requestFullscreen().catch(function () {});
  });
  document.addEventListener('keydown', function (event) {
    if (overlay.hidden) return;
    if (event.key === 'Escape' && !document.fullscreenElement) closeShow();
    else if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); move(-1); }
    else if ((event.key === ' ' || event.key === 'Enter') && show.index < gallery.length && event.target.tagName !== 'BUTTON') {
      event.preventDefault();
      show.revealed = !show.revealed;
      renderShow();
    }
  });

  // ---------- Print ----------
  function buildPrint() {
    var area = find('pxPrintArea');
    area.replaceChildren();
    var perPage = Number(find('pxPerPage').value) || 6;
    var names = find('pxPrintNames').checked;
    var title = config().title;
    for (var start = 0; start < gallery.length; start += perPage) {
      var page = el('section', 'px-print-page px-per-' + perPage);
      page.appendChild(el('h2', 'px-print-title', title + ' · 猜一猜：他/她喜欢什么？'));
      var cards = el('div', 'px-print-grid');
      gallery.slice(start, start + perPage).forEach(function (item, offset) {
        var card = el('figure', 'px-print-card');
        card.appendChild(el('span', 'px-print-no', String(start + offset + 1)));
        var img = el('img', '');
        img.src = Core.artDataUrl(item.pixels, item.grid, 480);
        img.alt = '';
        card.appendChild(img);
        if (names) card.appendChild(el('figcaption', '', item.studentName || ''));
        cards.appendChild(card);
      });
      page.appendChild(cards);
      area.appendChild(page);
    }
    if (find('pxPrintKey').checked) {
      var key = el('section', 'px-print-page px-print-key');
      key.appendChild(el('h2', 'px-print-title', title + ' · 答案 Answer key'));
      var table = el('table', '');
      var head = el('tr', '');
      var shown = config().show;
      var columns = ['#', '名字 Name', '词 Word'].concat(shown.py ? ['拼音 Pinyin'] : [], shown.en ? ['English'] : []);
      columns.forEach(function (label) { head.appendChild(el('th', '', label)); });
      table.appendChild(head);
      gallery.forEach(function (item, index) {
        var row = el('tr', '');
        [String(index + 1), item.studentName || '', item.word].concat(shown.py ? [item.entry ? item.entry.py : ''] : [], shown.en ? [item.entry ? item.entry.en : ''] : [])
          .forEach(function (value, column) { row.appendChild(el('td', column === 2 ? 'px-kai' : '', value)); });
        table.appendChild(row);
      });
      key.appendChild(table);
      area.appendChild(key);
    }
  }

  find('pxPrint').addEventListener('click', function () {
    if (!gallery.length) return;
    buildPrint();
    var images = Array.prototype.slice.call(find('pxPrintArea').querySelectorAll('img'));
    Promise.all(images.map(function (img) { return img.decode ? img.decode().catch(function () {}) : null; })).then(function () { window.print(); });
  });

  // ---------- start ----------
  loadSetup();
  onSetupChange();
  gallery = readJson(GALLERY_KEY, []).filter(function (item) { return item && Core.validPixels(item.pixels, item.grid); });
  renderGallery();
  renderLinks();

  // Opened from My activities: /teaching-tools/pixel-art?gallery=<shareId>
  var galleryId = new URLSearchParams(location.search).get('gallery');
  if (galleryId) {
    var saved = pixelShares().filter(function (share) { return share.shareId === galleryId; })[0];
    loadFromLink(galleryId, saved && saved.deleteToken);
    find('pxGalleryHeading').scrollIntoView();
  }
})();
