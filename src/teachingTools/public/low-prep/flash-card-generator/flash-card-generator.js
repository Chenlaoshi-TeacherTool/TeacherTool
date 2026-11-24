(function () {
  'use strict';

  var Core = window.FlashCardCore;
  var Wordlist = window.ChenWordlist;
  var Emoji = window.ChenEmoji;
  var Exporter = window.DeckExport;
  if (!Core) return;

  var isZh = window.FLASH_CARD_LANG === 'zh';
  var termsInput = document.getElementById('terms');
  var countEl = document.getElementById('term-count');
  var autoEmojiButton = document.getElementById('auto-emoji');
  var autoEmojiStatus = document.getElementById('auto-emoji-status');
  var matchingEmoji = false;
  var detectedList = document.getElementById('detected-list');
  var previewGrid = document.getElementById('preview-grid');
  var sheetSize = document.getElementById('cards-per-sheet');
  var showPictures = document.getElementById('show-card-images');
  var borderColorInput = document.getElementById('border-color');
  var downloadButton = document.getElementById('download-pdf');
  var statusEl = document.getElementById('generation-status');
  var prevButton = document.getElementById('prev-sheet');
  var nextButton = document.getElementById('next-sheet');
  var pageStatus = document.getElementById('page-status');
  var sideButtons = Array.prototype.slice.call(document.querySelectorAll('[data-side]'));
  var displayInputs = Array.prototype.slice.call(document.querySelectorAll('input[name="frontDisplay"], input[name="backDisplay"]'));
  var displayStatus = document.getElementById('display-status');
  var frontKey = document.getElementById('front-key');
  var backKey = document.getElementById('back-key');
  var swatches = Array.prototype.slice.call(document.querySelectorAll('.color-swatch'));
  var loadExampleButton = document.getElementById('load-example');
  var state = {
    entries: [],
    media: Object.create(null),
    exporting: false,
    page: 0,
    side: 'front',
    borderColor: '#2f6f5e',
    overrides: { py: Object.create(null), en: Object.create(null) }
  };
  var updateTimer = null;

  // 简 / 繁 for the cards. The word list keeps what was typed (pinyin, English,
  // pictures and edits are keyed by it); only the printed Chinese is converted.
  var zh = window.ChenZhContent ? window.ChenZhContent.create({
    mount: '#zh-script-slot',
    label: isZh ? '卡片用字' : 'Card characters',
    onChange: function () { renderPreview(); }
  }) : null;
  if (zh) zh.region(previewGrid);
  function T(value) { return zh ? zh.text(value) : value; }

  function pinyinFor(value) {
    if (Wordlist && typeof Wordlist.toPinyin === 'function') {
      return Wordlist.toPinyin(value, { spaced: true });
    }
    return '';
  }

  function englishFor(value) {
    if (Wordlist && typeof Wordlist.toEnglish === 'function') return Wordlist.toEnglish(value);
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
    if (zh) zh.suggest(termsInput.value);
    var entries = Core.parseEntries(termsInput.value, pinyinFor, englishFor);
    entries.forEach(function (item) {
      if (Object.prototype.hasOwnProperty.call(state.overrides.py, item.zh)) item.py = state.overrides.py[item.zh];
      if (Object.prototype.hasOwnProperty.call(state.overrides.en, item.zh)) item.en = state.overrides.en[item.zh];
    });
    state.entries = entries;
    autoEmojiButton.disabled = !Emoji || matchingEmoji || !entries.length;
    var pageCount = Math.max(1, Core.paginate(entries, Number(sheetSize.value)).length);
    if (state.page >= pageCount) state.page = pageCount - 1;
    renderDetectedList();
    renderPreview();
    updateCount();
    downloadButton.disabled = state.exporting || !entries.length;
  }

  function updateCount() {
    var count = state.entries.length;
    var sheets = Math.max(1, Math.ceil(count / Number(sheetSize.value)));
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
      empty.textContent = isZh ? '输入生词后，这里会显示自动生成的拼音和英文。' : 'Your automatically generated pinyin and English will appear here.';
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
      var pinyinInput = document.createElement('input');
      pinyinInput.type = 'text';
      pinyinInput.value = item.py;
      pinyinInput.placeholder = isZh ? '拼音' : 'Pinyin';
      pinyinInput.setAttribute('aria-label', (isZh ? '修改拼音：' : 'Edit pinyin for ') + item.zh);
      pinyinInput.addEventListener('input', function () {
        state.entries[index].py = pinyinInput.value.trim();
        state.overrides.py[item.zh] = pinyinInput.value.trim();
        renderPreview();
      });
      var englishInput = document.createElement('input');
      englishInput.type = 'text';
      englishInput.value = item.en;
      englishInput.placeholder = isZh ? '英文' : 'English';
      englishInput.setAttribute('aria-label', (isZh ? '修改英文：' : 'Edit English for ') + item.zh);
      englishInput.addEventListener('input', function () {
        state.entries[index].en = englishInput.value.trim();
        state.overrides.en[item.zh] = englishInput.value.trim();
        renderPreview();
      });
      row.appendChild(zh);
      row.appendChild(arrow);
      row.appendChild(pinyinInput);
      row.appendChild(englishInput);
      row.appendChild(mediaEditor(item.zh));
      fragment.appendChild(row);
    });
    detectedList.appendChild(fragment);
  }

  function setEmoji(media, value) {
    media.emoji = value.trim();
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    var context = canvas.getContext('2d');
    context.font = '138px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(media.emoji, 96, 96, 176);
    media.emojiImage = media.emoji ? canvas.toDataURL() : '';
  }

  async function autoMatchEmoji() {
    matchingEmoji = true;
    autoEmojiButton.disabled = true;
    autoEmojiStatus.textContent = isZh ? '正在匹配 Emoji…' : 'Matching emoji…';
    try {
      var index = await Emoji.load();
      var matched = 0;
      var unmatched = 0;
      state.entries.forEach(function (item) {
        var media = state.media[item.zh];
        if (media.mode) return;
        var result = Emoji.match(item, index, { translate: true });
        if (result && result.emoji) {
          setEmoji(media, result.emoji);
          media.mode = 'emoji';
          matched++;
        } else {
          unmatched++;
        }
      });
      if (matched) {
        renderDetectedList();
        renderPreview();
      }
      autoEmojiStatus.textContent = isZh
        ? '已配图 ' + matched + ' 张，未匹配 ' + unmatched + ' 张。'
        : 'Matched ' + matched + ' cards. ' + unmatched + ' had no match.';
    } catch (error) {
      autoEmojiStatus.textContent = isZh ? '暂时无法加载 Emoji，请重试。' : 'Could not load emoji. Please try again.';
    } finally {
      matchingEmoji = false;
      autoEmojiButton.disabled = !state.entries.length;
    }
  }

  function mediaEditor(word) {
    var media = state.media[word] || (state.media[word] = {});
    var editor = document.createElement('div');
    editor.className = 'card-media';
    var mode = document.createElement('select');
    mode.setAttribute('aria-label', (isZh ? '配图：' : 'Picture for ') + word);
    mode.add(new Option(isZh ? '无图' : 'No picture', 'none'));
    mode.add(new Option('Emoji', 'emoji'));
    mode.add(new Option(isZh ? '上传图片' : 'Upload picture', 'upload'));
    mode.value = media.mode || 'none';

    var emoji = document.createElement('input');
    emoji.type = 'text';
    emoji.maxLength = 32;
    emoji.placeholder = isZh ? '输入或粘贴 Emoji' : 'Type or paste an emoji';
    emoji.setAttribute('aria-label', 'Emoji · ' + word);
    emoji.value = media.emoji || '';

    var upload = document.createElement('input');
    upload.type = 'file';
    upload.accept = 'image/*';
    upload.setAttribute('aria-label', (isZh ? '上传图片：' : 'Upload picture for ') + word);
    var status = document.createElement('span');
    status.className = 'card-media-status';
    status.setAttribute('role', 'status');

    function updateEditor() {
      emoji.hidden = media.mode !== 'emoji';
      upload.hidden = status.hidden = media.mode !== 'upload';
      status.textContent = media.error || media.filename || '';
    }

    mode.addEventListener('change', function () {
      media.mode = mode.value;
      updateEditor();
      renderPreview();
      if (media.mode === 'emoji') emoji.focus();
    });
    emoji.addEventListener('input', function () {
      setEmoji(media, emoji.value);
      renderPreview();
    });
    upload.addEventListener('change', async function () {
      var file = upload.files[0];
      if (!file) return;
      upload.value = '';
      var url = URL.createObjectURL(file);
      media.pendingUpload = url;
      try {
        var image = new Image();
        image.src = url;
        await image.decode();
        if (media.pendingUpload !== url) return;
        var scale = Math.min(1, 680 / Math.max(image.naturalWidth, image.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        media.uploadImage = canvas.toDataURL('image/webp', .9);
        media.filename = file.name;
        media.error = '';
      } catch (error) {
        if (media.pendingUpload !== url) return;
        media.error = isZh ? '无法读取这张图片。' : 'This image could not be opened.';
      } finally {
        URL.revokeObjectURL(url);
      }
      if (state.media[word] === media) {
        if (editor.isConnected) updateEditor();
        else renderDetectedList();
        renderPreview();
      }
    });
    updateEditor();
    editor.append(mode, emoji, upload, status);
    return editor;
  }

  function selectedDisplayTypes(side) {
    var name = side === 'front' ? 'frontDisplay' : 'backDisplay';
    return displayInputs.filter(function (input) {
      return input.name === name && input.checked;
    }).map(function (input) { return input.value; });
  }

  function displayValues(item, side) {
    return selectedDisplayTypes(side).map(function (type) {
      var text = String(item[type] || '').trim();
      return { type: type, text: (type === 'zh' ? T(text) : text) || '—' };
    });
  }

  function displayLabel(side) {
    var labels = isZh
      ? { zh: '中文', py: '拼音', en: '英文' }
      : { zh: 'Chinese', py: 'Pinyin', en: 'English' };
    var selected = selectedDisplayTypes(side).map(function (type) { return labels[type]; }).join(' + ');
    return (side === 'front' ? (isZh ? '正面：' : 'Front: ') : (isZh ? '背面：' : 'Back: ')) + selected;
  }

  function renderPreview() {
    var count = Number(sheetSize.value);
    var pages = Core.paginate(state.entries, count);
    previewGrid.innerHTML = buildPageSvg(pages[state.page] || [], state.side, count, true);

    if (kaiCoverage) {
      var missing = selectedDisplayTypes(state.side).includes('zh')
        ? missingKaiCharacters((pages[state.page] || []).map(function (item) { return T(item.zh); }).join(' '))
        : [];
      setKaiFontStatus(missing.length ? kaiMissingMessage(missing) : '');
    }

    var total = Math.max(1, pages.length);
    pageStatus.textContent = isZh
      ? '第 ' + (state.page + 1) + ' / ' + total + ' 组'
      : 'Sheet ' + (state.page + 1) + ' of ' + total;
    prevButton.disabled = state.page <= 0;
    nextButton.disabled = state.page >= total - 1;
    sideButtons.forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.side === state.side);
    });
    frontKey.textContent = displayLabel('front');
    backKey.textContent = displayLabel('back');
  }

  function setBorderColor(color, selectedSwatch) {
    state.borderColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#2f6f5e';
    borderColorInput.value = state.borderColor;
    swatches.forEach(function (button) { button.classList.toggle('is-selected', button === selectedSwatch); });
    renderPreview();
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

  function wrapEnglish(value) {
    var wrapped = wrapPinyin(value);
    wrapped.size = String(value || '').length <= 20 ? 24 : (String(value || '').length <= 42 ? 19 : 16);
    return wrapped;
  }

  function textBlocks(item, side) {
    var values = displayValues(item, side);
    var blocks = values.map(function (value) {
      var wrapped = value.type === 'zh'
        ? Core.layoutChinese(value.text)
        : (value.type === 'py' ? wrapPinyin(value.text) : wrapEnglish(value.text));
      if (values.length > 1) {
        if (value.type === 'zh') wrapped.size = Math.min(wrapped.size, 34);
        if (value.type === 'py') wrapped.size = Math.min(wrapped.size, 20);
        if (value.type === 'en') wrapped.size = Math.min(wrapped.size, 17);
      }
      return { type: value.type, lines: wrapped.lines, size: wrapped.size };
    });

    var gap = blocks.length > 1 ? 8 : 0;
    var availableTextHeight = 142 - gap * Math.max(0, blocks.length - 1);
    var textHeight = blocks.reduce(function (sum, block) {
      return sum + block.lines.length * block.size * 1.16;
    }, 0);
    if (textHeight > availableTextHeight) {
      var scale = availableTextHeight / textHeight;
      blocks.forEach(function (block) {
        block.size = Math.max(8, Math.floor(block.size * scale));
      });
    }

    return blocks;
  }

  var kaiFontStatus = document.getElementById('kai-font-status');
  var kaiCoverage;
  var kaiFontPromise;

  function loadKaiFont() {
    if (!kaiFontPromise) {
      var face = new FontFace('Flash Card Kai', 'url(/fonts/LXGWWenKai-Regular.ttf)');
      kaiFontPromise = Promise.all([
        face.load(),
        fetch('/fonts/LXGWWenKai-coverage.json').then(function (response) {
          if (!response.ok) throw new Error('Chinese font coverage could not be loaded');
          return response.json();
        })
      ]).then(function (result) {
        document.fonts.add(result[0]);
        kaiCoverage = result[1];
      }).catch(function (error) {
        kaiFontPromise = null;
        throw error;
      });
    }
    return kaiFontPromise;
  }

  function missingKaiCharacters(text) {
    return Array.from(new Set(Array.from(text).filter(function (character) {
      if (/\s/u.test(character)) return false;
      var code = character.codePointAt(0);
      return !kaiCoverage.some(function (range) {
        return code >= range[0] && code <= range[1];
      });
    })));
  }

  function setKaiFontStatus(message) {
    kaiFontStatus.textContent = message;
    kaiFontStatus.hidden = !message;
  }

  function kaiMissingMessage(characters) {
    return (isZh ? '楷体字库缺少以下字符：' : 'The Kai font is missing these characters: ') +
      characters.slice(0, 12).join(' ') + (characters.length > 12 ? ' …' : '');
  }

  // Both the preview and PDF use the same rendered glyphs.
  function kaiLineImage(line, size, y, scale) {
    if (!kaiCoverage || missingKaiCharacters(line).length) return '';
    var canvas = document.createElement('canvas');
    var density = Math.max(2, Math.ceil(scale * 2));
    var width = 256;
    var height = Math.ceil(size * 1.4);
    canvas.width = width * density;
    canvas.height = height * density;
    var context = canvas.getContext('2d');
    context.scale(density, density);
    context.font = size + 'px "Flash Card Kai"';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#c3c3c3';
    context.fillText(line, width / 2, height / 2, width - 8);
    return '<image x="' + (-width / 2) + '" y="' + (y - height / 2) + '" width="' + width +
      '" height="' + height + '" href="' + canvas.toDataURL() + '"><title>' + escapeXml(line) + '</title></image>';
  }

  function svgText(item, side, centerX, centerY, scale) {
    var blocks = textBlocks(item, side);
    var gap = blocks.length > 1 ? 8 : 0;
    var totalHeight = blocks.reduce(function (sum, block) {
      return sum + block.lines.length * block.size * 1.2;
    }, 0) + gap * Math.max(0, blocks.length - 1);
    var cursorY = -totalHeight / 2;
    var output = '';

    blocks.forEach(function (block, blockIndex) {
      var fill = block.type === 'en' ? '#60756d' : '#315f55';
      var lineHeight = block.size * 1.2;
      block.lines.forEach(function (line) {
        var y = cursorY + lineHeight / 2;
        if (block.type === 'zh') {
          output += kaiLineImage(line, block.size, y, scale);
        } else {
          output += '<text x="0" y="' + y.toFixed(2) + '" ' +
            'text-anchor="middle" dominant-baseline="middle" fill="' + fill + '" font-family="Nunito,Arial,sans-serif" ' +
            'font-size="' + block.size + '" font-weight="700">' + escapeXml(line) + '</text>';
        }
        cursorY += lineHeight;
      });
      if (blockIndex < blocks.length - 1) cursorY += gap;
    });
    return '<g transform="translate(' + centerX + ' ' + centerY + ') scale(' + scale + ')">' + output + '</g>';
  }

  function buildPageSvg(entries, side, count, preview) {
    var layout = Core.sheetLayout(count);
    var marginX = 27;
    var marginY = 24;
    var gap = 8;
    var cardWidth = (612 - marginX * 2 - gap * (layout.columns - 1)) / layout.columns;
    var cardHeight = (792 - marginY * 2 - gap * (layout.rows - 1)) / layout.rows;
    var slots = side === 'back' ? Core.mirrorBackSlots(entries, count) : Core.makeSlots(entries, count);
    var content = '<rect x="0" y="0" width="612" height="792" fill="#ffffff"/>';

    slots.forEach(function (item, index) {
      if (!item && !preview) return;
      var column = index % layout.columns;
      var row = Math.floor(index / layout.columns);
      var x = marginX + column * (cardWidth + gap);
      var y = marginY + row * (cardHeight + gap);
      content += '<rect x="' + x + '" y="' + y + '" width="' + cardWidth + '" height="' + cardHeight +
        '" rx="10" fill="#ffffff" stroke="' + (item ? state.borderColor : '#e5e9e4') + '" stroke-width="' + (item ? '4' : '2') + '"' +
        (item ? '' : ' stroke-dasharray="6 5"') + '/>';
      if (!item) return;
      var media = showPictures.checked && side === 'front' && state.media[item.zh];
      var picture = media && (media.mode === 'emoji' ? media.emojiImage : media.mode === 'upload' && media.uploadImage);
      var pictureSpace = picture ? cardHeight * .46 : 0;
      if (picture) {
        content += '<image x="' + (x + cardWidth * .12) + '" y="' + (y + cardHeight * .06) +
          '" width="' + (cardWidth * .76) + '" height="' + (cardHeight * .4) +
          '" href="' + escapeXml(picture) + '"/>';
      }
      var textHeight = cardHeight - pictureSpace;
      var scale = Math.min(cardWidth / 275, textHeight / 180);
      content += svgText(item, side, x + cardWidth / 2, y + pictureSpace + textHeight / 2, scale);
    });

    return '<svg xmlns="http://www.w3.org/2000/svg" width="612" height="792" viewBox="0 0 612 792">' + content + '</svg>';
  }

  async function downloadPdf() {
    if (!state.entries.length || !Exporter || state.exporting) return;
    state.exporting = true;
    downloadButton.disabled = true;
    setStatus(isZh ? '正在排版 PDF…' : 'Building your PDF…');

    try {
      if (selectedDisplayTypes('front').includes('zh') || selectedDisplayTypes('back').includes('zh')) {
        try {
          await loadKaiFont();
          renderPreview();
        } catch (error) {
          setStatus(isZh ? '楷体加载失败，请重新下载。' : 'The Kai font failed to load. Try downloading again.', 'error');
          return;
        }
        var missing = missingKaiCharacters(state.entries.map(function (item) { return item.zh; }).join(' '));
        if (missing.length) {
          setStatus(kaiMissingMessage(missing), 'error');
          return;
        }
      }
      var count = Number(sheetSize.value);
      var sheets = Core.paginate(state.entries, count).map(function (chunk) {
        return [buildPageSvg(chunk, 'front', count), buildPageSvg(chunk, 'back', count)];
      });
      if (document.fonts && document.fonts.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise(function (resolve) { window.setTimeout(resolve, 1800); })
        ]);
      }
      var images = [];
      for (var index = 0; index < sheets.length; index++) {
        setStatus(isZh
          ? '正在生成第 ' + (index + 1) + ' / ' + sheets.length + ' 组正反面…'
          : 'Rendering duplex sheet ' + (index + 1) + ' of ' + sheets.length + '…');
        images.push(await Exporter.svgToJpeg(sheets[index][0], 612, 792, 2, .96));
        images.push(await Exporter.svgToJpeg(sheets[index][1], 612, 792, 2, .96));
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
      state.exporting = false;
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
      hint: isZh ? '选择一个或多个主题，词语、拼音和英文会自动加入上方输入框。' : 'Choose one or more topics. Terms, pinyin, and English will be added above.',
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
            var en = String(item.en || '').trim() || englishFor(zh);
            lines.push(zh + ' | ' + py + ' | ' + en);
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

  displayInputs.forEach(function (input) {
    input.addEventListener('change', function () {
      var side = input.name === 'frontDisplay' ? 'front' : 'back';
      if (!selectedDisplayTypes(side).length) {
        input.checked = true;
        displayStatus.textContent = isZh ? '正面和反面都要至少选择一项。' : 'Choose at least one item for both the front and back.';
      } else {
        displayStatus.textContent = '';
      }
      renderPreview();
    });
  });

  swatches.forEach(function (button) {
    button.addEventListener('click', function () { setBorderColor(button.dataset.color, button); });
  });
  borderColorInput.addEventListener('input', function () { setBorderColor(borderColorInput.value, null); });
  prevButton.addEventListener('click', function () { if (state.page > 0) { state.page--; renderPreview(); } });
  nextButton.addEventListener('click', function () {
    if (state.page < Core.paginate(state.entries, Number(sheetSize.value)).length - 1) { state.page++; renderPreview(); }
  });
  sheetSize.addEventListener('change', function () {
    state.page = 0;
    renderPreview();
    updateCount();
  });
  autoEmojiButton.addEventListener('click', autoMatchEmoji);
  showPictures.addEventListener('change', renderPreview);
  downloadButton.addEventListener('click', downloadPdf);
  loadExampleButton.addEventListener('click', function () {
    termsInput.value = ['苹果', '香蕉', '草莓', '西瓜', '葡萄', '橘子', '桃子', '梨'].join('\n');
    state.overrides = { py: Object.create(null), en: Object.create(null) };
    state.media = Object.create(null);
    refreshEntries();
    setStatus('');
  });

  refreshEntries();
  // Once the 简/繁 table is in, typed 繁 words get their pinyin from the simplified form.
  if (zh) zh.ready().then(refreshEntries, function () {});
  setKaiFontStatus(isZh ? '正在加载楷体…' : 'Loading the Kai font…');
  loadKaiFont().then(renderPreview).catch(function () {
    setKaiFontStatus(isZh ? '楷体加载失败，请刷新页面。' : 'The Kai font failed to load. Refresh the page.');
  });
  initLibraryPicker();

  var pack = window.ChenPrintPack;
  if (pack) {
    pack.provide({
      duplex: true,
      pages: function () {
        return loadKaiFont().catch(function () {}).then(function () {
          return new Promise(function (resolve) { setTimeout(resolve, 600); });
        }).then(function () {
          refreshEntries();
          if (!state.entries.length) return [];
          var count = Number(sheetSize.value);
          var out = [];
          Core.paginate(state.entries, count).forEach(function (chunk) {
            out.push('<div class="pp-letter">' + buildPageSvg(chunk, 'front', count) + '</div>');
            out.push('<div class="pp-letter">' + buildPageSvg(chunk, 'back', count) + '</div>');
          });
          return out;
        });
      }
    });
  }
})();
