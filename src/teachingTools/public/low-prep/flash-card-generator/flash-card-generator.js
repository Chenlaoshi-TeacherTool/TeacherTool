(function () {
  'use strict';

  var Core = window.FlashCardCore;
  var Wordlist = window.ChenWordlist;
  var Exporter = window.DeckExport;
  if (!Core) return;

  var isZh = window.FLASH_CARD_LANG === 'zh';
  var termsInput = document.getElementById('terms');
  var countEl = document.getElementById('term-count');
  var detectedList = document.getElementById('detected-list');
  var previewGrid = document.getElementById('preview-grid');
  var sheetPreview = document.getElementById('sheet-preview');
  var borderColorInput = document.getElementById('border-color');
  var downloadButton = document.getElementById('download-pdf');
  var statusEl = document.getElementById('generation-status');
  var prevButton = document.getElementById('prev-sheet');
  var nextButton = document.getElementById('next-sheet');
  var pageStatus = document.getElementById('page-status');
  var sideButtons = Array.prototype.slice.call(document.querySelectorAll('[data-side]'));
  var swatches = Array.prototype.slice.call(document.querySelectorAll('.color-swatch'));
  var loadExampleButton = document.getElementById('load-example');
  var state = { entries: [], page: 0, side: 'front', borderColor: '#2f6f5e', overrides: Object.create(null) };
  var updateTimer = null;

  function pinyinFor(value) {
    if (Wordlist && typeof Wordlist.toPinyin === 'function') {
      return Wordlist.toPinyin(value, { spaced: true });
    }
    return '';
  }

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function setStatus(message, stateName) {
    statusEl.textContent = message || '';
    if (stateName) statusEl.dataset.state = stateName;
    else statusEl.removeAttribute('data-state');
  }

  function refreshEntries() {
    var entries = Core.parseEntries(termsInput.value, pinyinFor);
    entries.forEach(function (item) {
      if (Object.prototype.hasOwnProperty.call(state.overrides, item.zh)) item.py = state.overrides[item.zh];
    });
    state.entries = entries;
    var pageCount = Math.max(1, Core.paginate(entries).length);
    if (state.page >= pageCount) state.page = pageCount - 1;
    renderDetectedList();
    renderPreview();
    updateCount();
    downloadButton.disabled = !entries.length;
  }

  function updateCount() {
    var count = state.entries.length;
    var sheets = Math.max(1, Math.ceil(count / Core.CARD_COUNT));
    if (!count) {
      countEl.textContent = isZh ? '还没有生词' : 'No terms yet';
      return;
    }
    countEl.textContent = isZh
      ? count + ' 个生词 · ' + sheets + ' 组正反面'
      : count + ' term' + (count === 1 ? '' : 's') + ' · ' + sheets + ' duplex sheet' + (sheets === 1 ? '' : 's');
  }

  function renderDetectedList() {
    detectedList.innerHTML = '';
    if (!state.entries.length) {
      var empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = isZh ? '输入生词后，这里会显示自动生成的拼音。' : 'Your automatically generated pinyin will appear here.';
      detectedList.appendChild(empty);
      return;
    }

    var fragment = document.createDocumentFragment();
    state.entries.forEach(function (item, index) {
      var row = document.createElement('div');
      row.className = 'detected-row';
      var zh = document.createElement('span');
      zh.className = 'detected-zh';
      zh.textContent = item.zh;
      zh.title = item.zh;
      var arrow = document.createElement('span');
      arrow.className = 'detected-arrow';
      arrow.textContent = '→';
      arrow.setAttribute('aria-hidden', 'true');
      var input = document.createElement('input');
      input.type = 'text';
      input.value = item.py;
      input.setAttribute('aria-label', (isZh ? '修改拼音：' : 'Edit pinyin for ') + item.zh);
      input.addEventListener('input', function () {
        state.entries[index].py = input.value.trim();
        state.overrides[item.zh] = input.value.trim();
        renderPreview();
      });
      row.appendChild(zh);
      row.appendChild(arrow);
      row.appendChild(input);
      fragment.appendChild(row);
    });
    detectedList.appendChild(fragment);
  }

  function currentSlots() {
    var pages = Core.paginate(state.entries);
    var chunk = pages[state.page] || [];
    var frontSlots = Core.makeSlots(chunk);
    return state.side === 'back' ? Core.mirrorBackSlots(frontSlots) : frontSlots;
  }

  function renderPreview() {
    sheetPreview.style.setProperty('--card-border', state.borderColor);
    sheetPreview.dataset.side = state.side;
    previewGrid.innerHTML = '';

    currentSlots().forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'preview-card' + (item ? '' : ' is-empty');
      if (item) {
        var text = document.createElement('span');
        text.className = 'preview-card-main';
        text.textContent = state.side === 'front' ? item.zh : (item.py || '—');
        card.appendChild(text);
      }
      previewGrid.appendChild(card);
    });

    var total = Math.max(1, Core.paginate(state.entries).length);
    pageStatus.textContent = isZh
      ? '第 ' + (state.page + 1) + ' / ' + total + ' 组'
      : 'Sheet ' + (state.page + 1) + ' of ' + total;
    prevButton.disabled = state.page <= 0;
    nextButton.disabled = state.page >= total - 1;
    sideButtons.forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.side === state.side);
    });
  }

  function setBorderColor(color, selectedSwatch) {
    state.borderColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#2f6f5e';
    borderColorInput.value = state.borderColor;
    swatches.forEach(function (button) { button.classList.toggle('is-selected', button === selectedSwatch); });
    renderPreview();
  }

  function wrapChinese(value) {
    var text = String(value || '').trim();
    if (text.length <= 5) return { lines: [text], size: text.length <= 3 ? 51 : 41 };
    if (text.length <= 9) return { lines: [text], size: 30 };
    var chunkSize = text.length <= 16 ? Math.ceil(text.length / 2) : Math.ceil(text.length / 3);
    var lines = [];
    for (var i = 0; i < text.length && lines.length < 3; i += chunkSize) lines.push(text.slice(i, i + chunkSize));
    if (lines.join('').length < text.length) lines[2] = lines[2].slice(0, Math.max(1, lines[2].length - 1)) + '…';
    return { lines: lines, size: lines.length === 2 ? 27 : 21 };
  }

  function wrapPinyin(value) {
    var text = String(value || '').trim() || '—';
    var words = text.split(/\s+/);
    var lines = [];
    var line = '';
    var limit = text.length <= 24 ? 24 : 20;
    words.forEach(function (word) {
      var candidate = line ? line + ' ' + word : word;
      if (line && candidate.length > limit && lines.length < 2) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    if (lines.length > 3) {
      lines = lines.slice(0, 3);
      lines[2] = lines[2].slice(0, Math.max(1, lines[2].length - 1)) + '…';
    }
    return { lines: lines, size: text.length <= 18 ? 28 : (text.length <= 38 ? 22 : 17) };
  }

  function svgText(item, side, centerX, centerY) {
    var wrapped = side === 'front' ? wrapChinese(item.zh) : wrapPinyin(item.py);
    var lineHeight = wrapped.size * 1.28;
    var startY = centerY - ((wrapped.lines.length - 1) * lineHeight / 2);
    var family = side === 'front'
      ? "'Noto Sans SC','Microsoft YaHei','SimHei',sans-serif"
      : "'Nunito','Arial',sans-serif";
    return wrapped.lines.map(function (line, index) {
      return '<text x="' + centerX.toFixed(2) + '" y="' + (startY + index * lineHeight).toFixed(2) + '" ' +
        'text-anchor="middle" dominant-baseline="middle" fill="#173d34" font-family="' + family + '" ' +
        'font-size="' + wrapped.size + '" font-weight="700">' + escapeXml(line) + '</text>';
    }).join('');
  }

  function buildPageSvg(entries, side) {
    var width = 612;
    var height = 792;
    var marginX = 27;
    var marginY = 24;
    var gapX = 8;
    var gapY = 8;
    var cardWidth = (width - marginX * 2 - gapX) / 2;
    var cardHeight = (height - marginY * 2 - gapY * 3) / 4;
    var frontSlots = Core.makeSlots(entries);
    var slots = side === 'back' ? Core.mirrorBackSlots(frontSlots) : frontSlots;
    var content = '<rect x="0" y="0" width="612" height="792" fill="#ffffff"/>';

    slots.forEach(function (item, index) {
      if (!item) return;
      var column = index % 2;
      var row = Math.floor(index / 2);
      var x = marginX + column * (cardWidth + gapX);
      var y = marginY + row * (cardHeight + gapY);
      content += '<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + cardWidth.toFixed(2) + '" height="' + cardHeight.toFixed(2) + '" rx="10" fill="#ffffff" stroke="' + escapeXml(state.borderColor) + '" stroke-width="4"/>';
      content += svgText(item, side, x + cardWidth / 2, y + cardHeight / 2);
    });

    return '<svg xmlns="http://www.w3.org/2000/svg" width="612" height="792" viewBox="0 0 612 792">' + content + '</svg>';
  }

  async function downloadPdf() {
    if (!state.entries.length || !Exporter) return;
    downloadButton.disabled = true;
    setStatus(isZh ? '正在排版 PDF…' : 'Building your PDF…');

    try {
      if (document.fonts && document.fonts.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise(function (resolve) { window.setTimeout(resolve, 1800); })
        ]);
      }
      var chunks = Core.paginate(state.entries);
      var images = [];
      for (var index = 0; index < chunks.length; index++) {
        setStatus(isZh
          ? '正在生成第 ' + (index + 1) + ' / ' + chunks.length + ' 组正反面…'
          : 'Rendering duplex sheet ' + (index + 1) + ' of ' + chunks.length + '…');
        images.push(await Exporter.svgToJpeg(buildPageSvg(chunks[index], 'front'), 612, 792, 2, .96));
        images.push(await Exporter.svgToJpeg(buildPageSvg(chunks[index], 'back'), 612, 792, 2, .96));
      }
      var pdf = Exporter.buildPDF(images, { pageWidth: 612, pageHeight: 792 });
      Exporter.download('chinese-flash-cards-letter-duplex.pdf', pdf, 'application/pdf');
      setStatus(isZh
        ? 'PDF 已下载：请选择双面打印、长边翻页、实际大小 100%。'
        : 'PDF downloaded. Print double-sided, flip on the long edge, at Actual Size (100%).', 'success');
    } catch (error) {
      console.error(error);
      setStatus(isZh ? 'PDF 生成失败，请刷新页面后重试。' : 'The PDF could not be generated. Refresh and try again.', 'error');
    } finally {
      downloadButton.disabled = !state.entries.length;
    }
  }

  function initLibraryPicker() {
    if (!window.ChenLibraryPicker) return;
    var picker = window.ChenLibraryPicker.create({
      root: document.getElementById('flashCardLibraryPicker'),
      source: 'wordlists',
      min: 1,
      title: isZh ? '从已发布主题中添加生词' : 'Add words from published topics',
      hint: isZh ? '选择一个或多个主题，词语和已有拼音会自动加入上方输入框。' : 'Choose one or more topics. Terms and saved pinyin will be added above.',
      importLabel: isZh ? '添加所选主题词' : 'Add selected topic words',
      libraryLinkText: isZh ? '浏览完整词库' : 'Browse the full word list library',
      onImport: function (lists) {
        var existing = state.entries.map(function (item) { return item.zh; });
        var seen = Object.create(null);
        existing.forEach(function (word) { seen[word] = true; });
        var lines = String(termsInput.value || '').trim() ? [String(termsInput.value).trim()] : [];
        var added = 0;
        lists.forEach(function (list) {
          (list.items || []).forEach(function (item) {
            var zh = String(item.zh || '').trim();
            if (!zh || seen[zh]) return;
            var py = String(item.py || '').trim() || pinyinFor(zh);
            lines.push(zh + (py ? ' | ' + py : ''));
            seen[zh] = true;
            added++;
          });
        });
        termsInput.value = lines.join('\n');
        picker.reset();
        refreshEntries();
        setStatus(isZh ? '已从主题词库添加 ' + added + ' 个生词。' : 'Added ' + added + ' term' + (added === 1 ? '' : 's') + ' from the topic library.', 'success');
      }
    });
  }

  termsInput.addEventListener('input', function () {
    window.clearTimeout(updateTimer);
    updateTimer = window.setTimeout(function () {
      setStatus('');
      refreshEntries();
    }, 100);
  });

  sideButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      state.side = button.dataset.side;
      renderPreview();
    });
  });

  swatches.forEach(function (button) {
    button.addEventListener('click', function () { setBorderColor(button.dataset.color, button); });
  });
  borderColorInput.addEventListener('input', function () { setBorderColor(borderColorInput.value, null); });
  prevButton.addEventListener('click', function () { if (state.page > 0) { state.page--; renderPreview(); } });
  nextButton.addEventListener('click', function () {
    if (state.page < Core.paginate(state.entries).length - 1) { state.page++; renderPreview(); }
  });
  downloadButton.addEventListener('click', downloadPdf);
  loadExampleButton.addEventListener('click', function () {
    termsInput.value = ['苹果', '香蕉', '草莓', '西瓜', '葡萄', '橘子', '桃子', '梨'].join('\n');
    state.overrides = Object.create(null);
    refreshEntries();
    setStatus('');
  });

  refreshEntries();
  initLibraryPicker();
})();
