/*
 * Generic "pick 2-6 topics from a published library" widget.
 * Renders the picker into a container and calls onImport with the full
 * detail objects for the selected topics, in selection order.
 *
 * Usage:
 *   ChenLibraryPicker.create({
 *     root: document.getElementById('bankSource'),
 *     source: 'questionbanks', // or 'wordlists'
 *     title: 'Create a board from published question banks',
 *     hint: 'Choose 2-6 topics. Each topic becomes a category, with questions selected to fill the board.',
 *     importLabel: 'Create a board from selected topics',
 *     onImport: function (items) { ... }
 *   });
 */
(function (global) {
  'use strict';

  var TOPIC_ICONS_BY_THEME = {
    'seasons-weather': 0x1f326, 'weather': 0x1f326,
    'animals': 0x1f43e,
    'numbers': 0x1f522,
    'body-parts': 0x1f9cd,
    'colors': 0x1f3a8,
    'family': 0x1f46a,
    'rooms': 0x1f3e0, 'home': 0x1f3e0,
    'clothing': 0x1f455,
    'jobs': 0x1f4bc, 'jobs-occupations': 0x1f4bc,
    'countries': 0x1f5fa,
    'hobbies': 0x26bd,
    'school': 0x1f3eb,
    'back-to-school': 0x1f392,
    'festivals': 0x1f389,
    'self-introduction': 0x1f4ac,
    'pinyin': 0x1f524,
    'core-high-frequency': 0x2b50, 'hsk-1': 0x2b50,
    'food': 0x1f34e
  };

  var QUESTION_BANK_ICONS = {
    'chenlaoshi-seasons-weather': 0x1f326,
    'chenlaoshi-animals': 0x1f43e,
    'chenlaoshi-numbers': 0x1f522,
    'chenlaoshi-body-parts': 0x1f9cd,
    'chenlaoshi-colors': 0x1f3a8,
    'chenlaoshi-family': 0x1f46a,
    'chenlaoshi-rooms': 0x1f3e0,
    'chenlaoshi-clothing': 0x1f455,
    'chenlaoshi-jobs': 0x1f4bc,
    'chenlaoshi-countries': 0x1f5fa,
    'chenlaoshi-hobbies': 0x26bd,
    'chenlaoshi-school': 0x1f3eb,
    'chenlaoshi-back-to-school': 0x1f392,
    'chenlaoshi-festivals': 0x1f389,
    'chenlaoshi-self-introduction': 0x1f4ac,
    'chenlaoshi-pinyin': 0x1f524,
    'chenlaoshi-core-high-frequency': 0x2b50
  };

  var WORD_LIST_ICONS = {
    'preset-hsk-1-essentials': 0x2b50,
    'preset-food-and-fruit': 0x1f34e,
    'preset-classroom-basics': 0x1f392,
    'preset-weather-and-seasons': 0x1f326,
    'topic-animals': 0x1f43e,
    'topic-back-to-school': 0x1f392,
    'topic-body-parts': 0x1f9cd,
    'topic-clothing': 0x1f455,
    'topic-colors': 0x1f3a8,
    'topic-countries': 0x1f5fa,
    'topic-family': 0x1f46a,
    'topic-festivals': 0x1f389,
    'topic-hobbies': 0x26bd,
    'topic-jobs-occupations': 0x1f4bc,
    'topic-numbers': 0x1f522,
    'topic-pinyin': 0x1f524,
    'topic-rooms': 0x1f3e0,
    'topic-school': 0x1f3eb,
    'topic-seasons-weather': 0x1f326,
    'topic-self-introduction': 0x1f4ac
  };

  var SOURCE_CONFIG = {
    questionbanks: {
      listEndpoint: '/api/questionbanks/presets',
      listKey: 'banks',
      kicker: 'Chen Laoshi Question Banks',
      libraryHref: '/teaching-tools/question-bank-library/question-bank-library.html',
      libraryLinkText: 'Browse the full question library',
      noun: 'question bank topic',
      icons: QUESTION_BANK_ICONS,
      defaultIcon: 0x1f4dd
    },
    wordlists: {
      listEndpoint: '/api/wordlists/presets',
      listKey: 'lists',
      kicker: 'Chen Laoshi Word Lists',
      libraryHref: '/teaching-tools/word-list-library/word-list-library.html',
      libraryLinkText: 'Browse the full word list library',
      noun: 'vocabulary topic',
      icons: WORD_LIST_ICONS,
      defaultIcon: 0x1f004
    }
  };

  function themeSlug(value) {
    return String(value || '').toLowerCase().trim().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function el(tag, className) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  function itemId(item) { return item.id || item.slug; }
  function itemLabel(item) { return item.theme || item.name || 'Untitled topic'; }

  function create(options) {
    options = options || {};
    var config = SOURCE_CONFIG[options.source];
    if (!config) throw new Error('ChenLibraryPicker: unknown source "' + options.source + '"');

    var root = options.root;
    if (!root) throw new Error('ChenLibraryPicker: options.root is required');

    var min = options.min || 2;
    var max = options.max || 6;
    var icons = options.icons || config.icons;
    var getIcon = options.getIcon || function (item) {
      var codePoint = icons[itemId(item)] || TOPIC_ICONS_BY_THEME[themeSlug(item.theme)] || config.defaultIcon;
      return String.fromCodePoint(codePoint);
    };
    var getLabel = options.getLabel || itemLabel;
    var onSelectionChange = options.onSelectionChange || function () {};
    var onImport = options.onImport || function () {};

    var items = [];
    var selectedIds = [];

    root.innerHTML = '';
    root.className = (root.className ? root.className + ' ' : '') + 'lib-picker';

    var head = el('div', 'lib-picker-head');
    var headText = el('div');
    var kicker = el('p', 'lib-picker-kicker');
    kicker.textContent = options.kicker || config.kicker;
    var title = el('h3');
    title.textContent = options.title || 'Create a board from published topics';
    var hint = el('p', 'hint');
    hint.textContent = options.hint || ('Choose ' + min + '-' + max + ' topics.');
    headText.appendChild(kicker); headText.appendChild(title); headText.appendChild(hint);
    head.appendChild(headText);
    if (options.libraryHref !== false) {
      var link = el('a', 'lib-picker-library-link');
      link.href = options.libraryHref || config.libraryHref;
      link.textContent = options.libraryLinkText || config.libraryLinkText;
      head.appendChild(link);
    }

    var status = el('p', 'lib-picker-status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Loading ' + config.noun + 's…';

    var choices = el('div', 'lib-picker-choices');
    choices.setAttribute('aria-label', 'Choose ' + config.noun + 's');

    var actions = el('div', 'row lib-picker-actions');
    var importButton = el('button', 'primary');
    importButton.type = 'button';
    importButton.disabled = true;
    importButton.textContent = options.importLabel || 'Create from selected topics';
    var note = el('span', 'lib-picker-note');
    note.textContent = 'Choose ' + min + '-' + max + ' topics';
    actions.appendChild(importButton); actions.appendChild(note);

    root.appendChild(head);
    root.appendChild(status);
    root.appendChild(choices);
    root.appendChild(actions);

    function selectedItems() {
      return selectedIds.map(function (id) {
        return items.find(function (item) { return itemId(item) === id; });
      }).filter(Boolean);
    }

    function renderChoices() {
      choices.innerHTML = '';

      if (!items.length) {
        status.textContent = 'Published ' + config.noun + 's are unavailable right now. Please try again later.';
        note.textContent = 'Topics will appear when the library loads.';
        importButton.disabled = true;
        return;
      }

      items.forEach(function (item) {
        var id = itemId(item);
        var chosen = selectedIds.indexOf(id) !== -1;
        var button = el('button', 'lib-picker-choice');
        button.type = 'button';
        button.dataset.itemId = id;
        button.setAttribute('aria-pressed', chosen ? 'true' : 'false');
        button.setAttribute('aria-label', (chosen ? 'Remove ' : 'Select ') + getLabel(item));
        var icon = el('span', 'lib-picker-choice-icon');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = getIcon(item);
        var label = el('span');
        label.textContent = getLabel(item);
        button.appendChild(icon); button.appendChild(label);
        button.addEventListener('click', function () { toggleSelection(id); });
        choices.appendChild(button);
      });

      status.textContent = items.length + ' published ' + config.noun + (items.length === 1 ? '' : 's') + ' are available.';
      note.textContent = selectedIds.length
        ? selectedIds.length + ' topics selected · each topic will become a category'
        : 'Choose ' + min + '-' + max + ' topics';
      importButton.disabled = selectedIds.length < min;
    }

    function toggleSelection(id) {
      var index = selectedIds.indexOf(id);
      if (index !== -1) {
        selectedIds.splice(index, 1);
      } else {
        if (selectedIds.length >= max) {
          note.textContent = 'Choose no more than ' + max + ' topics.';
          return;
        }
        selectedIds.push(id);
      }
      renderChoices();
      onSelectionChange(selectedItems());
    }

    function load() {
      status.textContent = 'Loading ' + config.noun + 's…';
      return fetch(config.listEndpoint)
        .then(function (response) {
          if (!response.ok) throw new Error(config.noun + ' list unavailable');
          return response.json();
        })
        .then(function (payload) {
          items = payload[config.listKey] || [];
          renderChoices();
        })
        .catch(function () {
          items = [];
          renderChoices();
        });
    }

    function importSelected() {
      var selected = selectedItems();
      if (selected.length < min) {
        note.textContent = 'Choose at least ' + min + ' topics.';
        return;
      }
      importButton.disabled = true;
      status.textContent = 'Loading the chosen topics…';
      Promise.all(selected.map(function (item) {
        return fetch(config.listEndpoint + '/' + encodeURIComponent(itemId(item))).then(function (response) {
          if (!response.ok) throw new Error(config.noun + ' unavailable');
          return response.json();
        });
      })).then(function (details) {
        renderChoices();
        onImport(details);
      }).catch(function () {
        status.textContent = 'The ' + config.noun + 's could not be loaded. Please try again later.';
        renderChoices();
      });
    }

    importButton.addEventListener('click', importSelected);
    load();

    return {
      getSelected: selectedItems,
      reload: load,
      reset: function () { selectedIds = []; renderChoices(); }
    };
  }

  global.ChenLibraryPicker = { create: create };
})(window);
