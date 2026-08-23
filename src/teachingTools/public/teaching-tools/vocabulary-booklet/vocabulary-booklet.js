(function () {
  'use strict';

  var MAX_TERMS = 100;
  var TERMS_PER_PAGE = 10;
  var DRAFT_KEY = 'chenlaoshi-wordlist-booklet-draft';
  var els = {};
  var currentList = null;
  var displayLanguages = ['zh'];
  var wordFont = 'kaiti';

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    els.title = document.getElementById('bookletTitle');
    els.source = document.getElementById('wordSource');
    els.itemTotal = document.getElementById('itemTotal');
    els.status = document.getElementById('status');
    els.buildButton = document.getElementById('buildButton');
    els.printButton = document.getElementById('printButton');
    els.pages = document.getElementById('bookletPages');
    els.summary = document.getElementById('bookletSummary');
    els.fontSelect = document.getElementById('fontSelect');
    els.fontPreview = document.getElementById('fontPreview');
    els.savedListSelect = document.getElementById('savedListSelect');
    els.loadSavedButton = document.getElementById('loadSavedButton');
    els.librarySourceMessage = document.getElementById('librarySourceMessage');
    els.libraryPicker = document.getElementById('bookletLibraryPicker');

    if (!window.ChenWordlist) {
      setStatus('The vocabulary core did not load. Please refresh this page.');
      return;
    }

    els.buildButton.addEventListener('click', buildBooklet);
    els.printButton.addEventListener('click', printBooklet);
    els.loadSavedButton.addEventListener('click', loadSavedList);
    els.fontSelect.addEventListener('change', function () {
      wordFont = els.fontSelect.value;
      els.fontPreview.dataset.wordFont = wordFont;
      renderBooklet();
    });
    document.querySelectorAll('input[name="displayLanguage"]').forEach(function (input) {
      input.addEventListener('change', function () {
        displayLanguages = selectedDisplayLanguages();
        if (!displayLanguages.length) {
          input.checked = true;
          displayLanguages = [input.value];
        }
        renderBooklet();
      });
    });

    refreshSavedLists();
    initLibraryPicker();
    if (!loadLibraryDraft()) buildBooklet();
  }

  function initLibraryPicker() {
    if (!window.ChenLibraryPicker || !els.libraryPicker) return;
    var picker = ChenLibraryPicker.create({
      root: els.libraryPicker,
      source: 'wordlists',
      min: 1,
      title: 'Add terms from the library',
      hint: 'Choose one or more vocabulary topics to add their terms to your booklet.',
      importLabel: 'Add terms from selected topics',
      onImport: function (lists) {
        var existing = els.source.value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
        var seen = {};
        existing.forEach(function (line) { seen[line.split(/\s*\|\s*/)[0]] = true; });
        var added = 0;
        lists.forEach(function (list) {
          (list.items || []).forEach(function (item) {
            if (existing.length >= MAX_TERMS || !item.zh || seen[item.zh]) return;
            existing.push([item.zh, item.py || '', item.en || ''].join(' | '));
            seen[item.zh] = true;
            added += 1;
          });
        });
        els.source.value = existing.join('\n');
        buildBooklet();
        if (added) setStatus('Added ' + added + ' term' + (added === 1 ? '' : 's') + ' from the library.');
        picker.reset();
      }
    });
  }

  function loadLibraryDraft() {
    try {
      var raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      var list = JSON.parse(raw);
      if (!list || !Array.isArray(list.items) || !list.items.length) return false;
      applyList(list, 'Loaded “' + (list.name || 'Vocabulary Library list') + '” from Vocabulary Library.');
      els.librarySourceMessage.textContent = 'Current list loaded from Vocabulary Library. You can edit it here before printing.';
      return true;
    } catch (error) {
      return false;
    }
  }

  function refreshSavedLists() {
    els.savedListSelect.replaceChildren();
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose a saved word list…';
    els.savedListSelect.append(placeholder);
    var lists = window.ChenWordlist.listAll();
    lists.forEach(function (list) {
      var option = document.createElement('option');
      option.value = list.id;
      option.textContent = list.name + ' (' + list.count + ' terms)';
      els.savedListSelect.append(option);
    });
    els.loadSavedButton.disabled = !lists.length;
  }

  function loadSavedList() {
    var id = els.savedListSelect.value;
    if (!id) { setStatus('Choose a saved word list first.'); return; }
    var list = window.ChenWordlist.load(id);
    if (!list) { setStatus('That saved word list could not be found.'); refreshSavedLists(); return; }
    applyList(list, 'Loaded “' + list.name + '” from this browser.');
    els.librarySourceMessage.textContent = 'Saved browser list loaded. You can edit it here before printing.';
  }

  function applyList(list, message) {
    currentList = {
      id: list.id || '',
      name: list.name || 'My vocabulary booklet',
      items: limitTerms(list.items || [])
    };
    els.title.value = currentList.name;
    els.source.value = currentList.items.map(function (item) {
      return [item.zh || '', item.py || '', item.en || ''].join(' | ');
    }).join('\n');
    renderBooklet();
    setStatus(message);
  }

  function buildBooklet() {
    var parsed = window.ChenWordlist.dedupe(window.ChenWordlist.parseText(els.source.value, { spaced: true }));
    var wasLimited = parsed.length > MAX_TERMS;
    currentList = {
      id: '',
      name: els.title.value.trim() || 'My vocabulary booklet',
      items: limitTerms(parsed)
    };
    renderBooklet();
    setStatus(currentList.items.length
      ? (wasLimited ? 'Your first 100 unique terms are ready. Extra terms are not included in this booklet.' : currentList.items.length + ' terms are ready for your booklet.')
      : 'Add at least one vocabulary item to build a booklet.');
  }

  function limitTerms(items) {
    return (items || []).slice(0, MAX_TERMS);
  }

  function renderBooklet() {
    var itemCount = currentList && currentList.items ? currentList.items.length : 0;
    var groupCount = Math.ceil(itemCount / TERMS_PER_PAGE);
    els.itemTotal.textContent = itemCount + ' / ' + MAX_TERMS + ' terms';
    els.printButton.disabled = !itemCount;
    els.pages.replaceChildren();
    if (!itemCount) {
      els.summary.textContent = 'Add words to see your booklet plan.';
      var empty = document.createElement('p');
      empty.className = 'empty-preview';
      empty.textContent = 'Your A4 booklet preview will appear here.';
      els.pages.append(empty);
      return;
    }

    var sheetCount = Math.ceil((groupCount + 2) / 4);
    var pageCount = sheetCount * 4;
    els.summary.textContent = groupCount + ' numbered vocabulary page' + (groupCount === 1 ? '' : 's') + ' · ' + sheetCount + ' double-sided A4 sheet' + (sheetCount === 1 ? '' : 's') + ' · ' + itemCount + ' terms';
    var pages = makeBookletPages(groupCount, pageCount);

    for (var sheet = 0; sheet < sheetCount; sheet += 1) {
      appendSheet('Sheet ' + (sheet + 1) + ' · Front', pages[pageCount - 1 - (sheet * 2)], pages[sheet * 2]);
      appendSheet('Sheet ' + (sheet + 1) + ' · Back', pages[(sheet * 2) + 1], pages[pageCount - 2 - (sheet * 2)]);
    }
  }

  function makeBookletPages(groupCount, pageCount) {
    var pages = [];
    for (var page = 1; page <= pageCount; page += 1) {
      if (page === 1) pages.push({ type: 'cover', page: page });
      else if (page === pageCount) pages.push({ type: 'back', page: page });
      else if (page <= groupCount + 1) pages.push({ type: 'words', page: page, group: page - 1 });
      else pages.push({ type: 'notes', page: page });
    }
    return pages;
  }

  function appendSheet(label, leftPage, rightPage) {
    var wrapper = document.createElement('div');
    wrapper.className = 'booklet-sheet-wrap';
    var sheetLabel = document.createElement('div');
    sheetLabel.className = 'sheet-label';
    sheetLabel.textContent = label;
    var sheet = document.createElement('article');
    sheet.className = 'booklet-sheet';
    sheet.append(createPanel(leftPage), createPanel(rightPage));
    wrapper.append(sheetLabel, sheet);
    els.pages.append(wrapper);
  }

  function createPanel(page) {
    var panel = document.createElement('section');
    panel.className = 'booklet-panel ' + page.type + (page.type === 'words' ? ' word-panel' : '');
    if (page.type === 'cover') buildCover(panel);
    else if (page.type === 'words') buildWordPage(panel, page.group);
    else if (page.type === 'back') buildBack(panel);
    else buildNotes(panel);
    return panel;
  }

  function buildCover(panel) {
    appendText(panel, 'p', 'panel-kicker', 'Chen Laoshi’s Teaching Toolkit');
    appendText(panel, 'h3', '', currentList.name);
    appendText(panel, 'p', 'cover-subtitle', 'A self-paced vocabulary booklet');
    var name = document.createElement('div');
    name.className = 'student-name';
    name.innerHTML = 'Name: <span></span>';
    panel.append(name);
    appendText(panel, 'p', 'progress-title', 'My progress');
    var groupCount = Math.ceil(currentList.items.length / TERMS_PER_PAGE);
    var progress = document.createElement('div');
    progress.className = 'progress-grid';
    for (var number = 1; number <= 10; number += 1) {
      progress.append(createProgressSunflower(number, number <= groupCount));
    }
    panel.append(progress);
    appendText(panel, 'p', 'panel-footer', 'Colour, sticker, or add a check mark to a sunflower after you have learned each set of ten words.');
  }

  function createProgressSunflower(number, isReady) {
    var namespace = 'http://www.w3.org/2000/svg';
    var flower = document.createElement('div');
    flower.className = 'progress-sunflower ' + (isReady ? 'ready' : 'unavailable');
    flower.setAttribute('role', 'img');
    flower.setAttribute('aria-label', 'Progress set ' + number);
    var svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    for (var petal = 0; petal < 8; petal += 1) {
      var ellipse = document.createElementNS(namespace, 'ellipse');
      ellipse.setAttribute('class', 'sunflower-petal');
      ellipse.setAttribute('cx', '50');
      ellipse.setAttribute('cy', '23');
      ellipse.setAttribute('rx', '12');
      ellipse.setAttribute('ry', '21');
      ellipse.setAttribute('transform', 'rotate(' + (petal * 45) + ' 50 50)');
      svg.append(ellipse);
    }
    var center = document.createElementNS(namespace, 'circle');
    center.setAttribute('class', 'sunflower-center');
    center.setAttribute('cx', '50');
    center.setAttribute('cy', '50');
    center.setAttribute('r', '19');
    svg.append(center);
    var label = document.createElementNS(namespace, 'text');
    label.setAttribute('class', 'sunflower-number');
    label.setAttribute('x', '50');
    label.setAttribute('y', '57');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = number;
    svg.append(label);
    flower.append(svg);
    return flower;
  }

  function buildWordPage(panel, group) {
    panel.dataset.languageCount = displayLanguages.length;
    panel.dataset.wordFont = wordFont;
    var pageCircle = document.createElement('div');
    pageCircle.className = 'page-number';
    pageCircle.textContent = group;
    panel.append(pageCircle);
    appendText(panel, 'p', 'panel-kicker', 'Vocabulary practice');
    appendText(panel, 'h3', '', currentList.name);
    var start = ((group - 1) * TERMS_PER_PAGE) + 1;
    var end = Math.min(group * TERMS_PER_PAGE, currentList.items.length);
    var pageTerms = currentList.items.slice(start - 1, end);
    panel.style.setProperty('--terms-on-page', pageTerms.length);
    appendText(panel, 'p', 'word-range', 'Words ' + start + '–' + end + ' · Set ' + group);
    var list = document.createElement('ol');
    list.className = 'word-list';
    pageTerms.forEach(function (item, index) {
      var entry = document.createElement('li');
      var number = document.createElement('span');
      number.className = 'term-number';
      number.textContent = String(start + index).padStart(2, '0');
      var term = document.createElement('span');
      term.className = 'term';
      displayLanguages.forEach(function (language) {
        var piece = document.createElement('span');
        piece.className = 'term-piece term-' + language;
        piece.textContent = displayTerm(item, language);
        term.append(piece);
      });
      entry.append(number, term);
      list.append(entry);
    });
    panel.append(list);
    appendText(panel, 'p', 'panel-footer', 'Learn these ten, then mark circle ' + group + ' on your cover.');
  }

  function buildNotes(panel) {
    appendText(panel, 'p', 'panel-kicker', 'Extra practice');
    appendText(panel, 'h3', '', 'My notes');
    appendText(panel, 'p', '', 'Use this page for tricky words, drawings, or your own example sentences.');
    var lines = document.createElement('div');
    lines.className = 'note-lines';
    for (var line = 0; line < 7; line += 1) lines.append(document.createElement('span'));
    panel.append(lines);
  }

  function buildBack(panel) {
    appendText(panel, 'p', 'panel-kicker', 'Keep going');
    appendText(panel, 'h3', '', 'You did it!');
    appendText(panel, 'p', '', 'Finish a numbered page, mark the matching circle, and come back for a quick review anytime.');
    var logo = document.createElement('img');
    logo.className = 'back-logo';
    logo.src = '/images/chen-laoshi-logo.svg';
    logo.alt = 'Chen Laoshi';
    panel.append(logo);
  }

  function selectedDisplayLanguages() {
    return Array.from(document.querySelectorAll('input[name="displayLanguage"]:checked')).map(function (input) {
      return input.value;
    });
  }

  function displayTerm(item, language) {
    if (language === 'py') return item.py || item.zh || '—';
    if (language === 'en') return item.en || item.zh || '—';
    return item.zh || item.en || item.py || '—';
  }

  function appendText(parent, tag, className, value) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    parent.append(element);
    return element;
  }

  function printBooklet() {
    if (!currentList || !currentList.items.length) return;
    setStatus('Your print dialog is ready. Choose double-sided printing and flip on the short edge; select Save as PDF to download a copy.');
    window.print();
  }

  function setStatus(message) {
    els.status.textContent = message;
  }
})();
