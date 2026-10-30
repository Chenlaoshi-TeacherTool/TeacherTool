(function (root) {
  'use strict';

  function selectQuestions(collection) {
    if (!collection || collection.kind !== 'question-bank' || !Array.isArray(collection.items)) throw new Error('Choose a personal question bank.');
    var shuffled = collection.items.slice();
    for (var index = shuffled.length - 1; index > 0; index -= 1) {
      var target = Math.floor(Math.random() * (index + 1));
      var temporary = shuffled[index]; shuffled[index] = shuffled[target]; shuffled[target] = temporary;
    }
    var seen = new Set();
    var candidates = [];
    shuffled.forEach(function (item) {
      if (item.kind !== 'question') return;
      var question = String(item.prompt || '').trim();
      var answer = String(item.answer || '').trim();
      var options = Array.isArray(item.options) ? item.options : [];
      if (item.correctOptionId != null) {
        var correct = options.find(function (option) { return option.id === item.correctOptionId; });
        answer = correct ? String(correct.text || '').trim() : '';
      } else if (/^[A-D]$/i.test(answer)) {
        var matched = options.find(function (option) { return option.label === answer.toUpperCase(); });
        answer = matched ? String(matched.text || '').trim() : '';
      }
      if (!question || !answer || question.length > 120 || answer.length > 28 || /[\r\n\t|｜→]/.test(question + answer) || (question + answer).includes('=>') || seen.has(answer)) return;
      seen.add(answer);
      candidates.push({ question: question, answer: answer, itemId: item.id });
    });
    if (candidates.length < 8) throw new Error('This bank has only ' + candidates.length + ' usable, distinct answers. Maze needs 8 complete questions, each within 120 characters and an answer within 28, without line breaks or pair separators.');
    var selected = candidates.slice(0, 8);
    return {
      pairs: selected.map(function (item) { return { question: item.question, answer: item.answer }; }),
      sourceRefs: selected.map(function (item) { return { collectionId: collection.id, itemId: item.itemId, revision: collection.revision == null ? null : collection.revision }; }),
      skipped: collection.items.length - candidates.length
    };
  }

  function mount(config) {
    var panel = document.getElementById('mazePersonalBankPicker');
    if (!panel || !root.ChenLibraryStore) return;
    var select = document.getElementById('mazePersonalBank');
    var status = document.getElementById('mazePersonalStatus');
    var preview = document.getElementById('mazePersonalPreview');
    var results = document.getElementById('mazePersonalResults');
    var apply = document.getElementById('mazePersonalApply');
    var replacement = document.getElementById('mazePersonalReplace');
    var replacementLabel = document.getElementById('mazePersonalReplaceLabel');
    var plan = null;
    var request = 0;
    var store;
    try { store = root.ChenLibraryStore.create(root.localStorage, root.navigator.locks); }
    catch (error) { status.textContent = 'Personal library storage is unavailable. You can still enter questions or use preset banks.'; return; }

    function invalidate() {
      request += 1;
      plan = null;
      results.replaceChildren();
      apply.disabled = true;
      apply.hidden = true;
      replacement.checked = false;
      replacementLabel.hidden = true;
    }

    async function refresh() {
      invalidate();
      var selected = request;
      preview.disabled = true;
      select.disabled = true;
      var previousId = select.value;
      select.replaceChildren();
      try {
        var loaded = await store.load();
        if (selected !== request) return;
        var banks = loaded.data.collections.filter(function (collection) { return collection.kind === 'question-bank'; });
        banks.forEach(function (bank) {
          var option = document.createElement('option');
          option.value = bank.id;
          option.textContent = bank.name + ' (' + bank.items.length + ' questions)';
          select.appendChild(option);
        });
        if (banks.some(function (bank) { return bank.id === previousId; })) select.value = previousId;
        select.disabled = !banks.length;
        preview.disabled = !banks.length;
        status.textContent = banks.length ? 'Choose a bank and preview 8 questions. Your maze stays unchanged until you apply them.' : 'No personal question banks saved in this browser yet. Add a question bank in My Library.';
      } catch (error) { if (selected === request) status.textContent = error.message; }
    }

    select.addEventListener('change', function () { invalidate(); status.textContent = 'Preview this bank before applying questions.'; });
    replacement.addEventListener('change', function () { apply.disabled = !plan || (!replacementLabel.hidden && !replacement.checked); });
    preview.addEventListener('click', async function () {
      invalidate();
      var selected = request;
      status.textContent = 'Preparing a preview…';
      try {
        var loaded = await store.load();
        if (selected !== request) return;
        var bank = loaded.data.collections.find(function (collection) { return collection.id === select.value; });
        var selection = selectQuestions(bank);
        var draft = config.readCurrent();
        plan = { selection: selection, bankName: bank.name, libraryRaw: loaded.raw, draftRaw: JSON.stringify(draft) };
        var list = document.createElement('ol');
        selection.pairs.forEach(function (pair) {
          var row = document.createElement('li');
          row.textContent = pair.question + ' — ' + pair.answer;
          list.appendChild(row);
        });
        results.appendChild(list);
        replacementLabel.hidden = !draft.hasContent;
        apply.hidden = false;
        apply.disabled = draft.hasContent;
        status.textContent = '8 questions ready. ' + selection.skipped + ' entries excluded for missing, ambiguous, overlong, unsupported or duplicate answers. Nothing has been replaced.';
      } catch (error) { if (selected === request) status.textContent = error.message; }
    });
    apply.addEventListener('click', async function () {
      if (!plan || apply.disabled) return;
      var pending = plan;
      apply.disabled = true;
      try {
        var loaded = await store.load();
        if (plan !== pending) return;
        if (loaded.raw !== pending.libraryRaw || JSON.stringify(config.readCurrent()) !== pending.draftRaw) throw new Error('The library or maze changed. Preview the questions again before applying.');
        if (!replacementLabel.hidden && !replacement.checked) { apply.disabled = false; return; }
        var saved = config.apply(pending.selection, pending.bankName);
        invalidate();
        status.textContent = saved ? '8 questions applied and saved as your maze draft. You can edit them below.' : '8 questions applied, but the browser draft could not be saved. Keep this page open and download the PowerPoint.';
      } catch (error) { invalidate(); status.textContent = error.message; }
    });
    ['mazeTitle', 'mazePairInput'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', function () { if (plan) { invalidate(); status.textContent = 'Maze edited. Preview the bank again before importing.'; } });
    });
    root.addEventListener('storage', function (event) { if (event.key === null || event.key === root.ChenLibraryStore.key) refresh(); });
    refresh();
  }

  var api = { selectQuestions: selectQuestions, mount: mount };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChenMazeLibrary = api;
})(typeof window === 'object' ? window : globalThis);
