(function () {
  'use strict';

  var els = {};
  var currentList = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    els.name = document.getElementById('listName');
    if (els.name.value === els.name.defaultValue) els.name.value = window.LibraryI18n.t(els.name.defaultValue);
    els.theme = document.getElementById('listTheme');
    els.level = document.getElementById('listLevel');
    els.source = document.getElementById('wordSource');
    els.itemTotal = document.getElementById('itemTotal');
    els.previewRows = document.getElementById('previewRows');
    els.status = document.getElementById('status');
    els.buildButton = document.getElementById('buildButton');
    els.saveButton = document.getElementById('saveButton');
    els.downloadButton = document.getElementById('downloadButton');
    els.printButton = document.getElementById('printButton');
    els.bookletButton = document.getElementById('bookletButton');
    els.printListTitle = document.getElementById('printListTitle');
    els.printListMeta = document.getElementById('printListMeta');
    els.savedLists = document.getElementById('savedLists');
    els.storageNote = document.getElementById('storageNote');
    els.presetLists = document.getElementById('presetLists');

    if (!window.ChenWordlist) {
      setStatus(window.LibraryI18n.t('The vocabulary core did not load. Please refresh this page.'));
      return;
    }

    els.buildButton.addEventListener('click', buildList);
    els.saveButton.addEventListener('click', saveList);
    els.downloadButton.addEventListener('click', downloadCurrentList);
    els.printButton.addEventListener('click', printCurrentList);
    els.bookletButton.addEventListener('click', openBooklet);
    els.savedLists.addEventListener('click', handleSavedListAction);
    els.presetLists.addEventListener('click', handlePresetAction);
    els.storageNote.textContent = window.ChenWordlist.hasStorage
      ? window.LibraryI18n.t('Saved lists stay in this browser until you remove them.')
      : window.LibraryI18n.t('Browser saving is unavailable in this session; download a JSON backup instead.');

    buildList();
    renderSavedLists();
    loadPresetLists();
  }

  function buildList() {
    var items = window.ChenWordlist.parseText(els.source.value, { spaced: true });
    currentList = {
      id: currentList && currentList.id,
      name: els.name.value.trim() || window.LibraryI18n.t('My classroom vocabulary'),
      theme: els.theme.value.trim(),
      level: els.level.value.trim(),
      items: window.ChenWordlist.dedupe(items)
    };
    renderPreview();
    els.saveButton.disabled = !currentList.items.length || !window.ChenWordlist.hasStorage;
    els.downloadButton.disabled = !currentList.items.length;
    els.printButton.disabled = !currentList.items.length;
    els.bookletButton.disabled = !currentList.items.length;
    setStatus(currentList.items.length
      ? currentList.items.length + window.LibraryI18n.t(' terms are ready for classroom activities.')
      : window.LibraryI18n.t('Add at least one vocabulary item to build a list.'));
  }

  function renderPreview() {
    els.itemTotal.textContent = currentList.items.length + window.LibraryI18n.t(' term') + (window.LibraryI18n.chinese || currentList.items.length === 1 ? '' : 's');
    els.printListTitle.textContent = currentList.name || window.LibraryI18n.t('My classroom vocabulary');
    els.printListMeta.textContent = [
      currentList.theme,
      currentList.level,
      currentList.items.length + window.LibraryI18n.t(' term') + (window.LibraryI18n.chinese || currentList.items.length === 1 ? '' : 's')
    ].filter(Boolean).join(' · ');
    els.previewRows.replaceChildren();
    if (!currentList.items.length) {
      var empty = document.createElement('tr');
      empty.className = 'empty-row';
      empty.innerHTML = (window.LibraryI18n.chinese ? "<td colspan=\"3\">生成词汇表后，将在这里显示词条。</td>" : '<td colspan="3">Build a list to see its vocabulary here.</td>');
      els.previewRows.append(empty);
      return;
    }
    currentList.items.forEach(function (item) {
      var row = document.createElement('tr');
      [item.zh, item.py || '—', item.en || '—'].forEach(function (value) {
        var cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });
      els.previewRows.append(row);
    });
  }

  function saveList() {
    try {
      currentList = window.ChenWordlist.save(currentList);
      setStatus(window.LibraryI18n.t('Saved “') + currentList.name + window.LibraryI18n.t('” in this browser.'));
      renderSavedLists();
    } catch (error) {
      setStatus(window.LibraryI18n.t(error.message) || window.LibraryI18n.t('This list could not be saved. Download a JSON backup instead.'));
    }
  }

  function downloadCurrentList() {
    if (!currentList || !currentList.items.length) return;
    var file = new Blob([JSON.stringify(currentList, null, 2)], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = safeFilename(currentList.name) + '.json';
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus(window.LibraryI18n.t('Downloaded a JSON copy of “') + currentList.name + '”.');
  }

  function printCurrentList() {
    if (!currentList || !currentList.items.length) return;
    setStatus(window.LibraryI18n.t('Your print dialog is ready. Choose "Save as PDF" to download a PDF copy.'));
    window.print();
  }

  function openBooklet() {
    if (!currentList || !currentList.items.length) return;
    try {
      sessionStorage.setItem('chenlaoshi-wordlist-booklet-draft', JSON.stringify(currentList));
      window.location.href = '/teaching-tools/vocabulary-booklet/vocabulary-booklet.html';
    } catch (error) {
      setStatus(window.LibraryI18n.t('This browser could not pass the list to the booklet tool. Save the list in this browser first, then open the booklet generator.'));
    }
  }

  function renderSavedLists() {
    els.savedLists.replaceChildren();
    var lists = window.ChenWordlist.listAll();
    els.savedLists.closest('section').hidden = lists.length === 0;
    if (!lists.length) {
      var empty = document.createElement('p');
      empty.className = 'saved-empty';
      empty.textContent = window.LibraryI18n.t('No word lists have been saved in this browser yet.');
      els.savedLists.append(empty);
      return;
    }
    lists.forEach(function (summary) {
      var card = document.createElement('article');
      card.className = 'saved-list';
      var title = document.createElement('h3');
      title.textContent = summary.name;
      var detail = document.createElement('p');
      detail.textContent = [summary.count + window.LibraryI18n.t(' terms'), summary.theme, summary.level].filter(Boolean).join(' · ');
      var actions = document.createElement('div');
      actions.className = 'saved-actions';
      actions.append(createActionButton(window.LibraryI18n.t('Load'), 'load', summary.id), createActionButton(window.LibraryI18n.t('Remove'), 'remove', summary.id, true));
      card.append(title, detail, actions);
      els.savedLists.append(card);
    });
  }

  function loadPresetLists() {
    fetch('/api/wordlists/presets')
      .then(function (response) {
        if (!response.ok) throw new Error(window.LibraryI18n.t('Starter packs could not be loaded.'));
        return response.json();
      })
      .then(function (payload) { renderPresetLists(payload.lists || []); })
      .catch(function () {
        els.presetLists.innerHTML = (window.LibraryI18n.chinese ? "<p class=\"saved-empty\">暂时无法加载示例词汇表，您仍可创建自己的词汇表。</p>" : '<p class="saved-empty">Starter packs are unavailable right now. You can still build your own list.</p>');
      });
  }

  function renderPresetLists(lists) {
    els.presetLists.replaceChildren();
    lists.forEach(function (list) {
      var card = document.createElement('article');
      card.className = 'preset-list';
      var title = document.createElement('h3');
      title.textContent = list.name;
      var description = document.createElement('p');
      description.textContent = list.description;
      var meta = document.createElement('div');
      meta.className = 'preset-meta';
      meta.textContent = list.count + window.LibraryI18n.t(' terms · ') + list.level;
      var button = document.createElement('button');
      button.className = 'preset-button';
      button.type = 'button';
      button.dataset.presetId = list.id;
      button.textContent = window.LibraryI18n.t('Use this list');
      card.append(title, description, meta, button);
      els.presetLists.append(card);
    });
  }

  function handlePresetAction(event) {
    var button = event.target.closest('button[data-preset-id]');
    if (!button) return;
    button.disabled = true;
    fetch('/api/wordlists/presets/' + encodeURIComponent(button.dataset.presetId))
      .then(function (response) {
        if (!response.ok) throw new Error(window.LibraryI18n.t('That starter pack could not be loaded.'));
        return response.json();
      })
      .then(function (list) {
        currentList = { id: '', name: list.name, theme: list.theme || '', level: list.level || '', items: list.items || [] };
        els.name.value = currentList.name;
        els.theme.value = currentList.theme;
        els.level.value = currentList.level;
        els.source.value = currentList.items.map(function (item) {
          return item.zh + ' | ' + (item.py || '') + ' | ' + (item.en || '');
        }).join('\n');
        renderPreview();
        els.itemTotal.textContent = currentList.items.length + window.LibraryI18n.t(' term') + (window.LibraryI18n.chinese || currentList.items.length === 1 ? '' : 's');
        els.saveButton.disabled = !currentList.items.length || !window.ChenWordlist.hasStorage;
        els.downloadButton.disabled = !currentList.items.length;
        els.printButton.disabled = !currentList.items.length;
        els.bookletButton.disabled = !currentList.items.length;
        setStatus(window.LibraryI18n.t('Loaded “') + list.name + window.LibraryI18n.t('”. You can adapt it, then save your own copy.'));
        document.getElementById('builderTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function (error) { setStatus(window.LibraryI18n.t(error.message) || window.LibraryI18n.t('That starter pack could not be loaded.')); })
      .finally(function () { button.disabled = false; });
  }

  function createActionButton(label, action, id, danger) {
    var button = document.createElement('button');
    button.className = 'small-button' + (danger ? ' danger' : '');
    button.type = 'button';
    button.dataset.action = action;
    button.dataset.id = id;
    button.textContent = label;
    return button;
  }

  function handleSavedListAction(event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var id = button.dataset.id;
    if (button.dataset.action === 'remove') {
      window.ChenWordlist.remove(id);
      if (currentList && currentList.id === id) currentList.id = '';
      renderSavedLists();
      setStatus(window.LibraryI18n.t('Removed the saved word list from this browser.'));
      return;
    }
    var list = window.ChenWordlist.load(id);
    if (!list) { setStatus(window.LibraryI18n.t('That saved word list could not be found.')); return; }
    currentList = list;
    els.name.value = list.name || '';
    els.theme.value = list.theme || '';
    els.level.value = list.level || '';
    els.source.value = list.items.map(function (item) {
      return item.zh + ' | ' + (item.py || '') + ' | ' + (item.en || '');
    }).join('\n');
    renderPreview();
    els.saveButton.disabled = !list.items.length || !window.ChenWordlist.hasStorage;
    els.downloadButton.disabled = !list.items.length;
    els.printButton.disabled = !list.items.length;
    els.bookletButton.disabled = !list.items.length;
    setStatus(window.LibraryI18n.t('Loaded “') + list.name + '”.');
  }

  function safeFilename(name) {
    return String(name || 'vocabulary-list').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'vocabulary-list';
  }

  function setStatus(message) {
    els.status.textContent = message;
  }
})();
