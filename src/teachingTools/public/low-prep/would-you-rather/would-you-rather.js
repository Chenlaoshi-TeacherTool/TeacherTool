(function () {
  'use strict';

  var MAX_CARDS = 30;
  var MAX_IMAGE_BYTES = 3 * 1024 * 1024;
  var CW = window.ChenWordlist || null;
  var ICONS = window.WyrMaterialIcons || {};
  var $ = function (selector) { return document.querySelector(selector); };
  var els = {
    pairs: $('#pairInput'),
    template: $('#questionTemplate'),
    templateSample: $('#templateSample'),
    status: $('#statusMessage'),
    preview: $('#slidePreview'),
    cardList: $('#cardList'),
    cardCount: $('#cardCount'),
    libraryPicker: $('#wyrLibraryPicker'),
    presentation: $('#presentation'),
    presentationSlide: $('#presentationSlide'),
    presentationCount: $('#presentationCount'),
    printArea: $('#printArea'),
    picker: $('#artPicker'),
    iconSearch: $('#iconSearch'),
    iconGrid: $('#iconGrid'),
    imageUpload: $('#imageUpload')
  };
  var state = {
    cards: [],
    selected: 0,
    presentationIndex: 0,
    votes: {},
    picker: null,
    lastFocused: null
  };
  var examples = [
    'explain with a diagram / explain with a table',
    'read a biography / read historical fiction',
    'work alone / work with a partner',
    'show your answer in writing / explain it aloud',
    'start with an example / start with a rule'
  ];

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function safeFileName(value) {
    return clean(value || 'would-you-rather').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 64) || 'would-you-rather';
  }

  function setStatus(message, kind) {
    els.status.textContent = message;
    els.status.dataset.kind = kind || 'success';
  }

  function shuffle(items) {
    return CW && CW.shuffle ? CW.shuffle(items) : items.slice().sort(function () { return Math.random() - .5; });
  }

  function iconSvg(name, size, color) {
    var icon = ICONS[name];
    if (!icon) return '';
    return '<svg viewBox="' + icon.vb + '" width="' + size + '" height="' + size + '" aria-hidden="true"><path d="' + icon.d + '" fill="' + (color || '#194f45') + '"/></svg>';
  }

  function guessIcon(word) {
    var needle = clean(word).toLowerCase();
    if (!needle) return '';
    var keys = Object.keys(ICONS);
    var partial = '';
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var tags = ((ICONS[key].zh || '') + ' ' + (ICONS[key].en || '') + ' ' + key).toLowerCase();
      if (tags.split(/\s+/).indexOf(needle) !== -1) return key;
      if (!partial && needle.length > 1 && tags.indexOf(needle) !== -1) partial = key;
    }
    return partial;
  }

  function createSide(text) {
    var value = clean(text);
    return {
      text: value,
      pinyin: CW && CW.toPinyin ? clean(CW.toPinyin(value, { spaced: true })) : '',
      english: CW && CW.toEnglish ? clean(CW.toEnglish(value)) : '',
      icon: guessIcon(value),
      image: ''
    };
  }

  function splitPair(line) {
    var pieces = String(line || '').split(/\s*(?:\/|／|\||｜|,|，|、)\s*/).map(clean).filter(Boolean);
    if (pieces.length < 2) return null;
    return { a: createSide(pieces[0]), b: createSide(pieces.slice(1).join(' / ')), question: '' };
  }

  function getCardsFromText(text) {
    var cards = [];
    var skipped = 0;
    String(text || '').split(/\r?\n/).forEach(function (line) {
      if (cards.length >= MAX_CARDS || !clean(line)) return;
      var card = splitPair(line);
      if (card) cards.push(card);
      else skipped++;
    });
    return { cards: cards, skipped: skipped };
  }

  function templateQuestion(a, b) {
    var question = clean(els.template.value) || 'Would you rather {A} or {B}?';
    if (question.indexOf('{A}') === -1 && question.indexOf('{B}') === -1) question += ' {A} or {B}?';
    return question.replace(/\{A\}/g, a || '＿＿').replace(/\{B\}/g, b || '＿＿');
  }

  function questionFor(card) {
    return clean(card.question) || templateQuestion(card.a.text, card.b.text);
  }

  function updateTemplateSample() {
    els.templateSample.textContent = 'Sample: ' + templateQuestion('explain with a diagram', 'explain with a table');
  }

  function applyTemplateToAll() {
    state.cards.forEach(function (card) { card.question = templateQuestion(card.a.text, card.b.text); });
    renderCards();
    renderPreview();
    setStatus(state.cards.length ? 'The template was applied to all ' + state.cards.length + ' cards.' : 'Your template is ready for the next cards you make.');
  }

  function wrapText(value, maxChars, maxLines) {
    var text = clean(value);
    if (!text) return [''];
    var tokens = /[\u4e00-\u9fff]/.test(text) && !/\s/.test(text) ? text.split('') : text.split(/\s+/);
    var lines = [];
    var current = '';
    tokens.forEach(function (token) {
      var next = current ? (/^[\u4e00-\u9fff]$/.test(token) ? current + token : current + ' ' + token) : token;
      if (next.length > maxChars && current) { lines.push(current); current = token; }
      else current = next;
    });
    if (current) lines.push(current);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, Math.max(1, maxChars - 1)) + '…';
    }
    return lines;
  }

  function textBlock(lines, x, y, style, lineHeight) {
    return '<text x="' + x + '" y="' + y + '" ' + style + '>' + lines.map(function (line, index) {
      return '<tspan x="' + x + '" dy="' + (index ? lineHeight : 0) + '">' + escapeXml(line) + '</tspan>';
    }).join('') + '</text>';
  }

  function sunflower(cx, cy, radius) {
    var petals = '';
    for (var i = 0; i < 10; i++) {
      petals += '<ellipse cx="' + cx + '" cy="' + (cy - radius * .67) + '" rx="' + (radius * .23) + '" ry="' + (radius * .55) + '" fill="#f8c63f" transform="rotate(' + (i * 36) + ' ' + cx + ' ' + cy + ')"/>';
    }
    return '<g opacity=".95">' + petals + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (radius * .38) + '" fill="#794316"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (radius * .18) + '" fill="#f2b62b"/></g>';
  }

  function sideArt(side, x, y, accent) {
    if (side.image) {
      var id = 'clip-' + x + '-' + y + '-' + Math.round(Math.random() * 1000000);
      return '<defs><clipPath id="' + id + '"><circle cx="' + x + '" cy="' + y + '" r="76"/></clipPath></defs>' +
        '<image href="' + side.image + '" x="' + (x - 76) + '" y="' + (y - 76) + '" width="152" height="152" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + id + ')"/>' +
        '<circle cx="' + x + '" cy="' + y + '" r="78" fill="none" stroke="' + accent + '" stroke-width="6"/>';
    }
    if (side.icon && ICONS[side.icon]) {
      var icon = ICONS[side.icon];
      var box = icon.vb.split(/[ ,]+/).map(Number);
      var width = box[2] || 960;
      var height = box[3] || 960;
      var scale = 148 / Math.max(width, height);
      var tx = x - width * scale / 2 - box[0] * scale;
      var ty = y - height * scale / 2 - box[1] * scale;
      return '<g transform="translate(' + tx + ',' + ty + ') scale(' + scale + ')"><path d="' + icon.d + '" fill="' + accent + '"/></g>';
    }
    return '<circle cx="' + x + '" cy="' + y + '" r="64" fill="#fffdf7" stroke="' + accent + '" stroke-width="5"/><text x="' + x + '" y="' + (y + 12) + '" text-anchor="middle" fill="' + accent + '" font-size="44" font-family="Arial, sans-serif">?</text>';
  }

  function choicePanel(side, choice, index, votes) {
    var x = side === 'A' ? 95 : 850;
    var fill = side === 'A' ? '#fff3cb' : '#dff0dc';
    var accent = side === 'A' ? '#e6aa2b' : '#4b9169';
    var textLines = wrapText(choice.text, 10, 3);
    var textSize = choice.text.length > 18 ? 50 : choice.text.length > 10 ? 62 : 78;
    var voteCount = votes && votes[side] ? votes[side] : 0;
    var textY = choice.image || choice.icon ? 592 : 514;
    var details = '';
    if (choice.pinyin && choice.pinyin !== choice.text) details += textBlock(wrapText(choice.pinyin, 24, 2), x + 325, textY + 67 + textLines.length * 22, 'text-anchor="middle" fill="#416359" font-size="27" font-family="Arial, Noto Sans SC, sans-serif"', 34);
    if (choice.english && choice.english.toLowerCase() !== choice.text.toLowerCase()) details += textBlock(wrapText(choice.english, 25, 2), x + 325, textY + 115 + textLines.length * 22, 'text-anchor="middle" fill="#416359" font-size="25" font-family="Arial, Noto Sans SC, sans-serif"', 31);
    return '<g data-vote="' + side + '" role="button" tabindex="0" aria-label="Vote for choice ' + side + '">' +
      '<rect x="' + x + '" y="315" width="650" height="410" rx="42" fill="' + fill + '" stroke="' + accent + '" stroke-width="8"/>' +
      '<circle cx="' + (x + 70) + '" cy="385" r="39" fill="' + accent + '"/>' +
      '<text x="' + (x + 70) + '" y="399" text-anchor="middle" fill="#fffdf7" font-size="34" font-weight="800" font-family="Arial, Noto Sans SC, sans-serif">' + side + '</text>' +
      sideArt(choice, x + 325, 430, accent) +
      '<text x="' + (x + 325) + '" y="' + (textY - (textLines.length - 1) * 38) + '" text-anchor="middle" fill="#164c43" font-size="' + textSize + '" font-weight="800" font-family="Arial, Noto Sans SC, sans-serif">' + textLines.map(function (line, n) { return '<tspan x="' + (x + 325) + '" dy="' + (n ? 82 : 0) + '">' + escapeXml(line) + '</tspan>'; }).join('') + '</text>' +
      details + '<g transform="translate(' + (x + 277) + ' 672)"><rect width="96" height="35" rx="17" fill="#fffdf7" stroke="' + accent + '" stroke-width="2"/><text x="48" y="24" text-anchor="middle" fill="' + accent + '" font-size="19" font-weight="800" font-family="Arial, Noto Sans SC, sans-serif">♥ ' + voteCount + '</text></g></g>';
  }

  function cardSvg(card, index) {
    var question = questionFor(card);
    var questionLines = wrapText(question, 30, 2);
    var votes = state.votes[index] || { A: 0, B: 0 };
    return '<svg class="wyr-card-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="Would You Rather slide ' + (index + 1) + '">' +
      '<rect width="1600" height="900" fill="#fff9e9"/><circle cx="1440" cy="102" r="240" fill="#dff0dc" opacity=".85"/><circle cx="145" cy="810" r="210" fill="#fff0bd" opacity=".74"/><rect x="0" y="0" width="1600" height="20" fill="#f8c63f"/>' +
      '<text x="90" y="82" fill="#356e57" font-size="25" font-weight="800" letter-spacing="3" font-family="Arial, Noto Sans SC, sans-serif">CHEN LAOSHI’S TEACHING TOOLKIT</text><text x="1510" y="82" text-anchor="end" fill="#356e57" font-size="25" font-weight="800" font-family="Arial, Noto Sans SC, sans-serif">' + (index + 1) + ' / ' + state.cards.length + '</text>' +
      sunflower(800, 142, 42) + textBlock(questionLines, 800, 294 - (questionLines.length - 1) * 24, 'text-anchor="middle" fill="#164c43" font-size="52" font-weight="800" font-family="Arial, Noto Sans SC, sans-serif"', 63) +
      choicePanel('A', card.a, index, votes) + choicePanel('B', card.b, index, votes) +
      '<text x="800" y="825" text-anchor="middle" fill="#547267" font-size="27" font-family="Arial, Noto Sans SC, sans-serif">I choose ______ because ______.</text><text x="800" y="864" text-anchor="middle" fill="#8b5f1a" font-size="21" font-weight="700" font-family="Arial, Noto Sans SC, sans-serif">Choose a side · Give evidence · Listen to a classmate</text></svg>';
  }

  function renderPreview() {
    var card = state.cards[state.selected];
    els.preview.innerHTML = card ? cardSvg(card, state.selected) : '<p class="wyr-empty">Add at least one pair, then generate your deck.</p>';
  }

  function thumbnail(side) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'wyr-thumbnail' + (side.icon || side.image ? ' has-art' : '');
    button.title = 'Change icon or upload photo';
    if (side.image) {
      var image = document.createElement('img'); image.src = side.image; image.alt = ''; button.appendChild(image);
    } else if (side.icon) {
      button.innerHTML = iconSvg(side.icon, 34);
    } else button.textContent = 'Choose';
    return button;
  }

  function field(value, label, change) {
    var input = document.createElement('input');
    input.value = value || '';
    input.setAttribute('aria-label', label);
    input.addEventListener('click', function (event) { event.stopPropagation(); });
    input.addEventListener('input', change);
    return input;
  }

  function miniButton(text, title, action, danger) {
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'wyr-mini-button' + (danger ? ' danger' : ''); button.textContent = text; button.title = title;
    button.addEventListener('click', function (event) { event.stopPropagation(); action(); });
    return button;
  }

  function renderCards() {
    els.cardList.innerHTML = '';
    els.cardCount.textContent = state.cards.length + (state.cards.length === 1 ? ' slide' : ' slides');
    if (!state.cards.length) { els.cardList.innerHTML = '<p class="wyr-empty">Your generated cards will appear here.</p>'; return; }
    state.cards.forEach(function (card, index) {
      var row = document.createElement('article');
      row.className = 'wyr-card-row' + (index === state.selected ? ' active' : '');
      row.tabIndex = 0;
      row.addEventListener('click', function (event) {
        if (event.target.closest('input, button')) return;
        state.selected = index; renderCards(); renderPreview();
      });
      row.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.selected = index; renderCards(); renderPreview(); }
      });
      var questionRow = document.createElement('div'); questionRow.className = 'wyr-question-row';
      var number = document.createElement('span'); number.className = 'wyr-row-num'; number.textContent = index + 1;
      var questionInput = field(questionFor(card), 'Question for card ' + (index + 1), function () { card.question = questionInput.value; if (state.selected === index) renderPreview(); });
      questionInput.className = 'wyr-question-input';
      questionRow.append(number, questionInput,
        miniButton('↑', 'Move card earlier', function () { moveCard(index, -1); }),
        miniButton('↓', 'Move card later', function () { moveCard(index, 1); }),
        miniButton('×', 'Remove card', function () { removeCard(index); }, true));
      row.appendChild(questionRow);
      var choices = document.createElement('div'); choices.className = 'wyr-choice-editor';
      ['a', 'b'].forEach(function (key) {
        var side = card[key];
        var box = document.createElement('div'); box.className = 'wyr-choice-box ' + key;
        var tag = document.createElement('span'); tag.className = 'wyr-choice-tag'; tag.textContent = key.toUpperCase();
        var thumb = thumbnail(side);
        thumb.addEventListener('click', function (event) { event.stopPropagation(); openPicker(index, key, thumb); });
        var fields = document.createElement('div'); fields.className = 'wyr-choice-fields';
        var wordInput = field(side.text, (key === 'a' ? 'First' : 'Second') + ' choice', function () {
          var usedTemplateQuestion = !card.question || card.question === templateQuestion(card.a.text, card.b.text);
          side.text = clean(wordInput.value);
          side.pinyin = CW && CW.toPinyin ? clean(CW.toPinyin(side.text, { spaced: true })) : side.pinyin;
          side.english = CW && CW.toEnglish ? clean(CW.toEnglish(side.text)) || side.english : side.english;
          if (!side.image) side.icon = guessIcon(side.text) || side.icon;
          if (usedTemplateQuestion) card.question = templateQuestion(card.a.text, card.b.text);
          if (state.selected === index) renderPreview();
        });
        wordInput.placeholder = 'word or short phrase';
        var pinyinInput = field(side.pinyin, 'Pinyin', function () { side.pinyin = pinyinInput.value; if (state.selected === index) renderPreview(); }); pinyinInput.placeholder = 'Pinyin';
        var englishInput = field(side.english, 'English', function () { side.english = englishInput.value; if (state.selected === index) renderPreview(); }); englishInput.placeholder = 'English';
        fields.append(wordInput, pinyinInput, englishInput); box.append(tag, thumb, fields); choices.appendChild(box);
      });
      row.appendChild(choices);
      els.cardList.appendChild(row);
    });
  }

  function replaceDeck() {
    var result = getCardsFromText(els.pairs.value);
    state.cards = result.cards;
    state.selected = 0; state.presentationIndex = 0; state.votes = {};
    renderCards(); renderPreview();
    setStatus(result.cards.length ? result.cards.length + ' cards are ready to edit.' : 'Each line needs two choices, such as diagram / table.', result.cards.length ? 'success' : 'warning');
  }

  function appendDeck() {
    var result = getCardsFromText(els.pairs.value);
    if (!result.cards.length) { setStatus('Each line needs two choices, such as diagram / table.', 'warning'); return; }
    var remaining = MAX_CARDS - state.cards.length;
    var added = result.cards.slice(0, Math.max(0, remaining));
    state.cards = state.cards.concat(added);
    state.selected = Math.max(0, state.cards.length - added.length);
    renderCards(); renderPreview();
    setStatus(added.length + ' card' + (added.length === 1 ? '' : 's') + ' were added to your deck.');
  }

  function addBlankCard() {
    if (state.cards.length >= MAX_CARDS) { setStatus('A deck can have up to ' + MAX_CARDS + ' cards.', 'warning'); return; }
    state.cards.push({ a: createSide('Option A'), b: createSide('Option B'), question: templateQuestion('Option A', 'Option B') });
    state.selected = state.cards.length - 1; renderCards(); renderPreview(); setStatus('A new card was added.');
  }

  function clearDeck() {
    state.cards = []; state.selected = 0; state.presentationIndex = 0; state.votes = {};
    renderCards(); renderPreview(); setStatus('Your deck is clear.');
  }

  function moveCard(index, direction) {
    var target = index + direction;
    if (target < 0 || target >= state.cards.length) return;
    var card = state.cards[index]; state.cards[index] = state.cards[target]; state.cards[target] = card;
    state.selected = target; renderCards(); renderPreview();
  }

  function removeCard(index) {
    state.cards.splice(index, 1);
    state.selected = Math.max(0, Math.min(state.selected, state.cards.length - 1));
    renderCards(); renderPreview(); setStatus('Card removed.');
  }

  function makePairsFromLists(lists) {
    var items = [];
    lists.forEach(function (list) {
      (list.items || []).forEach(function (item) {
        if (item && clean(item.zh)) items.push(item);
      });
    });
    if (items.length < 2) { setStatus('Choose topics with at least two words combined to make pairs.', 'warning'); return; }
    var mixed = shuffle(items); var lines = [];
    for (var i = 0; i + 1 < mixed.length && lines.length < MAX_CARDS; i += 2) lines.push(clean(mixed[i].zh) + ' / ' + clean(mixed[i + 1].zh));
    els.pairs.value = lines.join('\n'); replaceDeck();
    setStatus(lines.length + ' random pairs were made from ' + lists.length + ' selected topic' + (lists.length === 1 ? '' : 's') + '.');
  }

  function initLibraryPicker() {
    if (!window.ChenLibraryPicker || !els.libraryPicker) return;
    var picker = ChenLibraryPicker.create({
      root: els.libraryPicker,
      source: 'wordlists',
      min: 1,
      title: 'Make pairs from the library',
      hint: 'Choose one or more vocabulary topics. Terms are shuffled and randomly paired into either-or choices.',
      importLabel: 'Make pairs from selected topics',
      onImport: function (lists) {
        makePairsFromLists(lists);
        picker.reset();
      }
    });
  }

  function drawIcons(query) {
    var needle = clean(query).toLowerCase();
    els.iconGrid.innerHTML = '';
    Object.keys(ICONS).forEach(function (name) {
      var icon = ICONS[name];
      var searchable = ((icon.zh || '') + ' ' + (icon.en || '') + ' ' + name).toLowerCase();
      if (needle && searchable.indexOf(needle) === -1) return;
      var button = document.createElement('button'); button.type = 'button'; button.className = 'wyr-icon-choice';
      button.innerHTML = iconSvg(name, 31) + '<span>' + escapeXml((icon.zh || name).split(' ')[0]) + '</span>';
      button.addEventListener('click', function () { chooseIcon(name); }); els.iconGrid.appendChild(button);
    });
    if (!els.iconGrid.children.length) els.iconGrid.innerHTML = '<p class="wyr-empty">No matching icon. Try a different Chinese or English word.</p>';
  }

  function openPicker(index, key, trigger) {
    state.picker = { index: index, key: key, trigger: trigger };
    els.iconSearch.value = ''; drawIcons(''); els.picker.hidden = false; document.body.style.overflow = 'hidden'; window.setTimeout(function () { els.iconSearch.focus(); }, 20);
  }

  function closePicker() {
    els.picker.hidden = true; document.body.style.overflow = '';
    if (state.picker && state.picker.trigger && state.picker.trigger.focus) state.picker.trigger.focus();
    state.picker = null; els.imageUpload.value = '';
  }

  function chooseIcon(iconName) {
    if (!state.picker) return;
    var side = state.cards[state.picker.index][state.picker.key]; side.icon = iconName; side.image = '';
    var selected = state.picker.index; closePicker(); renderCards(); if (state.selected === selected) renderPreview();
  }

  function uploadImage(file) {
    if (!file || !state.picker) return;
    if (!/^image\//.test(file.type)) { setStatus('Please choose an image file.', 'warning'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setStatus('Please choose an image smaller than 3 MB.', 'warning'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      if (!state.picker) return;
      var selected = state.picker.index;
      var side = state.cards[state.picker.index][state.picker.key]; side.image = reader.result; side.icon = '';
      closePicker(); renderCards(); if (state.selected === selected) renderPreview(); setStatus('Your image was added to this card.');
    };
    reader.readAsDataURL(file);
  }

  function renderPresentation() {
    var card = state.cards[state.presentationIndex]; if (!card) return;
    els.presentationSlide.innerHTML = cardSvg(card, state.presentationIndex);
    els.presentationCount.textContent = (state.presentationIndex + 1) + ' / ' + state.cards.length;
    els.presentationSlide.querySelectorAll('[data-vote]').forEach(function (element) {
      function vote() {
        var key = element.getAttribute('data-vote'); var votes = state.votes[state.presentationIndex] || { A: 0, B: 0 };
        votes[key] = (votes[key] || 0) + 1; state.votes[state.presentationIndex] = votes; renderPresentation(); renderPreview();
      }
      element.addEventListener('click', vote);
      element.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); vote(); } });
    });
  }

  function openPresentation() {
    if (!state.cards.length) { setStatus('Add a pair before starting the presentation.', 'warning'); return; }
    state.lastFocused = document.activeElement; state.presentationIndex = state.selected; els.presentation.hidden = false; document.body.style.overflow = 'hidden'; renderPresentation(); $('#closePresentation').focus();
  }

  function closePresentation() { els.presentation.hidden = true; document.body.style.overflow = ''; if (state.lastFocused && state.lastFocused.focus) state.lastFocused.focus(); }
  function movePresentation(direction) { if (!state.cards.length) return; state.presentationIndex = (state.presentationIndex + direction + state.cards.length) % state.cards.length; state.selected = state.presentationIndex; renderPresentation(); renderCards(); renderPreview(); }

  function preparePrint() {
    if (!state.cards.length) { setStatus('Add a pair before printing.', 'warning'); return; }
    els.printArea.innerHTML = state.cards.map(function (card, index) { return '<section class="print-slide">' + cardSvg(card, index) + '</section>'; }).join('');
    window.setTimeout(function () { window.print(); }, 80);
  }

  async function exportDeck(format) {
    if (!state.cards.length) { setStatus('Add a pair before exporting.', 'warning'); return; }
    if (!window.DeckExport) { setStatus('The export helper is not available yet. Refresh and try again.', 'warning'); return; }
    setStatus('Preparing ' + state.cards.length + ' slide' + (state.cards.length === 1 ? '' : 's') + ' for ' + format.toUpperCase() + '…');
    try {
      var images = await Promise.all(state.cards.map(function (card, index) { return window.DeckExport.svgToJpeg(cardSvg(card, index), 1600, 900, 1.25); }));
      var filename = safeFileName('would-you-rather');
      if (format === 'pdf') window.DeckExport.download(filename + '.pdf', window.DeckExport.buildPDF(images, { pageWidth: 792, pageHeight: 445.5 }), 'application/pdf');
      else window.DeckExport.download(filename + '.pptx', window.DeckExport.buildPPTX(images), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      setStatus('Your ' + format.toUpperCase() + ' is ready to save.');
    } catch (error) { console.error(error); setStatus('The export could not be created. Please try again after refreshing this page.', 'warning'); }
  }

  function bindEvents() {
    $('#generateDeck').addEventListener('click', replaceDeck);
    $('#appendDeck').addEventListener('click', appendDeck);
    $('#shuffleDeck').addEventListener('click', function () { if (state.cards.length > 1) { state.cards = shuffle(state.cards); state.selected = 0; state.votes = {}; renderCards(); renderPreview(); setStatus('Your prompt order has been shuffled.'); } });
    $('#clearDeck').addEventListener('click', clearDeck);
    $('#addBlankCard').addEventListener('click', addBlankCard);
    $('#loadExample').addEventListener('click', function () { els.pairs.value = examples.join('\n'); replaceDeck(); });
    $('#applyTemplate').addEventListener('click', applyTemplateToAll);
    $('#presentDeck').addEventListener('click', openPresentation);
    $('#closePresentation').addEventListener('click', closePresentation);
    $('#previousSlide').addEventListener('click', function () { movePresentation(-1); });
    $('#nextSlide').addEventListener('click', function () { movePresentation(1); });
    $('#printDeck').addEventListener('click', preparePrint);
    $('#exportPdf').addEventListener('click', function () { exportDeck('pdf'); });
    $('#exportPptx').addEventListener('click', function () { exportDeck('pptx'); });
    els.template.addEventListener('input', function () { updateTemplateSample(); document.querySelectorAll('.wyr-template').forEach(function (button) { button.classList.toggle('active', button.dataset.template === els.template.value); }); renderPreview(); });
    document.querySelectorAll('.wyr-template').forEach(function (button) { button.addEventListener('click', function () { els.template.value = button.dataset.template; updateTemplateSample(); document.querySelectorAll('.wyr-template').forEach(function (item) { item.classList.toggle('active', item === button); }); renderPreview(); }); });
    els.iconSearch.addEventListener('input', function () { drawIcons(els.iconSearch.value); });
    els.imageUpload.addEventListener('change', function () { uploadImage(els.imageUpload.files && els.imageUpload.files[0]); });
    $('#closePicker').addEventListener('click', closePicker);
    document.addEventListener('keydown', function (event) {
      if (!els.picker.hidden && event.key === 'Escape') closePicker();
      else if (!els.presentation.hidden) { if (event.key === 'Escape') closePresentation(); if (event.key === 'ArrowLeft') movePresentation(-1); if (event.key === 'ArrowRight') movePresentation(1); }
    });
  }

  initLibraryPicker(); bindEvents(); updateTemplateSample(); replaceDeck();
})();
