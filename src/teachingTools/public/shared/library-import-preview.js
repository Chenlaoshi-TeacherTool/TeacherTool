(function () {
  'use strict';

  var section = document.getElementById('libraryImportPreview');
  var personal = document.getElementById('libraryPersonal');
  if (!section || !personal || !window.ChenLibraryV2 || !window.ChenLibraryStore) return;
  var fileInput = document.getElementById('libraryBackupFile');
  var status = section.querySelector('[role="status"]');
  var results = section.querySelector('.library-import-results');
  var download = document.getElementById('libraryDownloadConverted');
  var save = document.getElementById('librarySaveImport');
  var check = document.getElementById('libraryCheckImport');
  var importStatus = document.getElementById('libraryImportCheck');
  var conflictLabel = document.getElementById('libraryKeepBothLabel');
  var keepBoth = document.getElementById('libraryKeepBoth');
  var draft = document.getElementById('libraryUseDraft');
  var savedStatus = document.getElementById('libraryPersonalStatus');
  var savedResults = document.getElementById('libraryPersonalResults');
  var search = document.getElementById('libraryPersonalSearch');
  var filter = document.getElementById('libraryPersonalFilter');
  var backup = document.getElementById('libraryPersonalBackup');
  var current = null;
  var plan = null;
  var saved = null;
  var request = 0;
  var libraryRequest = 0;
  var busy = false;
  var store;
  try { store = window.ChenLibraryStore.create(window.localStorage, window.navigator.locks); }
  catch (error) { savedStatus.textContent = 'Browser storage is unavailable. You can still preview and download backups.'; }

  function node(tag, value) {
    var element = document.createElement(tag);
    element.textContent = value;
    return element;
  }

  function describe(item) {
    if (item.kind === 'vocabulary') return [item.term, item.pronunciation, item.definition].filter(Boolean).join(' — ');
    var option = item.options.find(function (choice) { return choice.id === item.correctOptionId; });
    return item.prompt + ' — ' + item.answer + (option ? ' · ' + option.text : '');
  }

  function downloadData(data, filename) {
    var url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  function updateSave() {
    save.disabled = busy || !plan || !plan.entries.some(function (entry) { return entry.status !== 'duplicate'; }) || (plan.entries.some(function (entry) { return entry.status === 'conflict'; }) && !keepBoth.checked);
  }

  async function checkImport() {
    var selected = ++request;
    plan = null;
    keepBoth.checked = false;
    conflictLabel.hidden = true;
    updateSave();
    if (!current || !store) { importStatus.textContent = 'Browser saving is unavailable; download your converted backup instead.'; return; }
    importStatus.textContent = 'Checking saved collections…';
    try {
      var prepared = await store.prepare(current);
      if (selected !== request) return;
      plan = prepared;
      var counts = { new: 0, duplicate: 0, conflict: 0 };
      plan.entries.forEach(function (entry) { counts[entry.status] += 1; });
      importStatus.replaceChildren(node('p', counts.new + ' new · ' + counts.duplicate + ' already saved · ' + counts.conflict + ' conflicts. Existing collections will be kept.'));
      var list = document.createElement('ul');
      plan.entries.forEach(function (entry) { list.appendChild(node('li', entry.name + ' — ' + ({ new: 'New collection', duplicate: 'Already saved; will skip', conflict: 'Same name or ID; will keep both copies' })[entry.status])); });
      importStatus.appendChild(list);
      conflictLabel.hidden = !counts.conflict;
      updateSave();
    } catch (error) {
      if (selected === request) importStatus.textContent = error.message;
    }
  }

  async function preview(raw) {
    var selected = ++request;
    current = null;
    plan = null;
    download.disabled = true;
    check.disabled = true;
    conflictLabel.hidden = true;
    results.replaceChildren();
    importStatus.replaceChildren();
    updateSave();
    status.textContent = 'Checking your backup…';
    try {
      var previewed = await window.ChenLibraryV2.preview(await raw);
      if (selected !== request) return;
      current = previewed.data;
      status.textContent = previewed.summary.collections + ' collections · ' + previewed.summary.vocabulary + ' vocabulary items · ' + previewed.summary.questions + ' questions. Nothing has been saved yet.';
      current.collections.forEach(function (collection) {
        var list = document.createElement('ul');
        collection.items.slice(0, 8).forEach(function (item) { list.appendChild(node('li', describe(item))); });
        if (collection.items.length > 8) list.appendChild(node('li', '… ' + (collection.items.length - 8) + ' more items included.'));
        results.append(node('h3', collection.name + ' (' + collection.items.length + ')'), list);
      });
      if (previewed.warnings.length) results.appendChild(node('p', previewed.warnings.length + ' issues need review. ' + previewed.warnings.slice(0, 10).join(' ')));
      download.disabled = false;
      check.disabled = false;
      await checkImport();
    } catch (error) { if (selected === request) status.textContent = error.message || 'This backup could not be previewed.'; }
  }

  function renderSaved() {
    savedResults.replaceChildren();
    if (!saved) return;
    var query = search.value.trim().toLowerCase();
    var collections = saved.collections.filter(function (collection) {
      return (!filter.value || collection.kind === filter.value) && (!query || collection.name.toLowerCase().includes(query) || collection.items.some(function (item) { return describe(item).toLowerCase().includes(query); }));
    });
    if (!collections.length) { savedResults.appendChild(node('p', saved.collections.length ? 'No matching collections.' : 'No collections saved in your unified library yet.')); return; }
    collections.forEach(function (collection) {
      var details = document.createElement('details');
      details.appendChild(node('summary', collection.name + ' · ' + (collection.kind === 'vocabulary' ? 'Vocabulary' : 'Question bank') + ' · ' + collection.items.length + ' items'));
      details.addEventListener('toggle', function () {
        if (!details.open || details.querySelector('ul')) return;
        var list = document.createElement('ul');
        collection.items.forEach(function (item) {
          var row = node('li', describe(item));
          if (item.kind === 'question') {
            var options = document.createElement('ul');
            item.options.filter(function (option) { return option.text; }).forEach(function (option) { options.appendChild(node('li', option.label + '. ' + option.text)); });
            row.appendChild(options);
          }
          list.appendChild(row);
        });
        details.appendChild(list);
      });
      savedResults.appendChild(details);
    });
  }

  async function refreshLibrary() {
    var selected = ++libraryRequest;
    if (!store) return;
    try {
      var loaded = await store.load();
      if (selected !== libraryRequest) return;
      saved = loaded.data;
      savedStatus.textContent = saved.collections.length + ' collections saved in this browser. Both Library pages use this same library.';
      backup.disabled = !saved.collections.length;
      renderSaved();
    } catch (error) {
      if (selected !== libraryRequest) return;
      saved = null;
      backup.disabled = true;
      savedResults.replaceChildren();
      savedStatus.textContent = error.message;
    }
  }

  fileInput.addEventListener('change', function () {
    var file = fileInput.files[0];
    if (!file) { request += 1; current = null; plan = null; results.replaceChildren(); importStatus.replaceChildren(); status.textContent = 'Choose a JSON backup to preview.'; download.disabled = true; check.disabled = true; conflictLabel.hidden = true; updateSave(); return; }
    preview(file.size > window.ChenLibraryV2.maxBytes ? Promise.reject(new Error('Choose a JSON backup smaller than 5 MB.')) : file.text());
  });
  if (draft) draft.addEventListener('click', function () {
    var input = document.getElementById('wordSource');
    preview(JSON.stringify({ name: document.getElementById('listName').value || 'My vocabulary', theme: document.getElementById('listTheme').value, level: document.getElementById('listLevel').value, items: window.ChenWordlist.parseText(input.value, { spaced: true }) }));
  });
  keepBoth.addEventListener('change', updateSave);
  check.addEventListener('click', checkImport);
  download.addEventListener('click', function () { if (current) downloadData(current, 'cls-library-v2.json'); });
  search.addEventListener('input', renderSaved);
  filter.addEventListener('change', renderSaved);
  backup.addEventListener('click', async function () {
    try {
      var loaded = await store.load();
      loaded.data.exportedAt = new Date().toISOString();
      downloadData(loaded.data, 'cls-library-backup.json');
    } catch (error) { savedStatus.textContent = error.message; }
  });
  save.addEventListener('click', async function () {
    if (!plan || save.disabled) return;
    busy = true;
    fileInput.disabled = true;
    check.disabled = true;
    if (draft) draft.disabled = true;
    updateSave();
    try {
      await store.save(plan, keepBoth.checked);
      status.textContent = 'Collections saved to your unified library in this browser.';
      await refreshLibrary();
      await checkImport();
    } catch (error) { plan = null; importStatus.textContent = error.message; }
    finally { busy = false; fileInput.disabled = false; check.disabled = !current; if (draft) draft.disabled = false; updateSave(); }
  });
  window.addEventListener('storage', function (event) {
    if (event.key !== null && event.key !== window.ChenLibraryStore.key) return;
    refreshLibrary();
    if (current && !busy) checkImport();
  });
  refreshLibrary();
})();
