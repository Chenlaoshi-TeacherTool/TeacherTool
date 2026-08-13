(function () {
  'use strict';

  var REQUIRED_HEADERS = ['编号', '主题', '难度', '题目', '答案', '标签', '题型'];
  var OPTION_HEADERS = ['选项A', '选项B', '选项C', '选项D'];
  var els = {};
  var currentBank = null;
  var pendingBank = null;
  var importSummary = null;
  var presetBanks = [];
  var PRESET_ICONS = {
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

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    els.file = document.getElementById('importFile');
    els.importStatus = document.getElementById('importStatus');
    els.saveImportButton = document.getElementById('saveImportButton');
    els.clearImportButton = document.getElementById('clearImportButton');
    els.status = document.getElementById('status');
    els.bankSelect = document.getElementById('bankSelect');
    els.downloadButton = document.getElementById('downloadButton');
    els.filters = document.getElementById('filters');
    els.questionSearch = document.getElementById('questionSearch');
    els.themeFilter = document.getElementById('themeFilter');
    els.levelFilter = document.getElementById('levelFilter');
    els.typeFilter = document.getElementById('typeFilter');
    els.questionTotal = document.getElementById('questionTotal');
    els.resultsNote = document.getElementById('resultsNote');
    els.questionList = document.getElementById('questionList');
    els.savedBanks = document.getElementById('savedBanks');
    els.storageNote = document.getElementById('storageNote');
    els.presetBanks = document.getElementById('presetBanks');
    els.presetSearch = document.getElementById('presetSearch');
    els.presetSearchStatus = document.getElementById('presetSearchStatus');

    if (!window.ChenQuestionBank || !window.JSZip) {
      setStatus('The question-bank importer could not load. Please refresh this page.');
      return;
    }

    els.file.addEventListener('change', handleFileSelection);
    els.saveImportButton.addEventListener('click', saveImportedBank);
    els.clearImportButton.addEventListener('click', clearImportPreview);
    els.bankSelect.addEventListener('change', handleBankSelection);
    els.downloadButton.addEventListener('click', downloadCurrentBank);
    els.questionSearch.addEventListener('input', renderQuestions);
    [els.themeFilter, els.levelFilter, els.typeFilter].forEach(function (filter) {
      filter.addEventListener('change', renderQuestions);
    });
    els.savedBanks.addEventListener('click', handleSavedBankAction);
    els.presetBanks.addEventListener('click', handlePresetAction);
    els.presetSearch.addEventListener('input', renderPresetBanks);
    els.presetSearch.addEventListener('search', renderPresetBanks);

    els.storageNote.textContent = window.ChenQuestionBank.hasStorage
      ? 'Question banks stay in this browser until you remove them.'
      : 'Browser saving is unavailable in this session.';

    renderSavedBanks();
    renderBankSelect();
    renderCurrentBank();
    loadPresetBanks();
  }

  async function handleFileSelection() {
    var file = els.file.files && els.file.files[0];
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      setImportStatus('Please choose an .xlsx Excel file.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImportStatus('This file is larger than 5 MB. Please use a smaller question-bank file.', 'error');
      return;
    }

    setImportStatus('Checking “' + file.name + '”…', 'loading');
    setStatus('');
    try {
      var result = await importWorkbook(file);
      pendingBank = result.bank;
      importSummary = result.summary;
      currentBank = pendingBank;
      els.saveImportButton.disabled = !pendingBank.questions.length || result.summary.issues.length > 0;
      els.clearImportButton.disabled = false;
      els.downloadButton.disabled = true;
      renderFilters();
      renderCurrentBank();
      setImportStatus(makeImportStatus(result.summary), result.summary.issues.length ? 'error' : 'ready');
      setStatus(result.summary.issues.length
        ? 'Fix the issues in your Excel file, then import it again.'
        : 'Preview ready. Review the questions, then save this bank to your browser.');
    } catch (error) {
      pendingBank = null;
      importSummary = null;
      currentBank = null;
      els.saveImportButton.disabled = true;
      els.clearImportButton.disabled = false;
      renderCurrentBank();
      setImportStatus(error.message || 'This Excel file could not be read.', 'error');
    }
  }

  function saveImportedBank() {
    if (!pendingBank || !pendingBank.questions.length || (importSummary && importSummary.issues.length)) return;
    try {
      currentBank = window.ChenQuestionBank.save(pendingBank);
      pendingBank = null;
      importSummary = null;
      els.saveImportButton.disabled = true;
      els.downloadButton.disabled = false;
      renderSavedBanks();
      renderBankSelect(currentBank.id);
      renderFilters();
      renderCurrentBank();
      setImportStatus('Saved “' + currentBank.name + '” to this browser.', 'ready');
      setStatus('Your question bank is ready to use and download as a backup.');
    } catch (error) {
      setStatus(error.message || 'This question bank could not be saved.');
    }
  }

  function clearImportPreview() {
    pendingBank = null;
    importSummary = null;
    els.file.value = '';
    els.saveImportButton.disabled = true;
    els.clearImportButton.disabled = true;
    setImportStatus('No file selected yet. Select the spreadsheet you shared to preview its questions here.', '');
    var selectedId = els.bankSelect.value;
    currentBank = selectedId ? window.ChenQuestionBank.load(selectedId) : null;
    els.downloadButton.disabled = !currentBank;
    renderFilters();
    renderCurrentBank();
    setStatus('');
  }

  function handleBankSelection() {
    pendingBank = null;
    importSummary = null;
    if (!els.bankSelect.value) {
      currentBank = null;
      els.downloadButton.disabled = true;
      renderFilters();
      renderCurrentBank();
      return;
    }
    loadPresetBank(els.bankSelect.value);
  }

  function renderBankSelect(selectedId) {
    var desired = selectedId || (currentBank && currentBank.id) || els.bankSelect.value;
    els.bankSelect.replaceChildren();
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = presetBanks.length ? 'Choose a Chen Laoshi preset bank' : 'Loading preset banks…';
    els.bankSelect.append(placeholder);
    presetBanks.forEach(function (bank) {
      var option = document.createElement('option');
      option.value = bank.id;
      option.textContent = bank.name + ' · ' + bank.count + ' questions';
      els.bankSelect.append(option);
    });
    els.bankSelect.disabled = !presetBanks.length;
    if (desired && presetBanks.some(function (bank) { return bank.id === desired; })) {
      els.bankSelect.value = desired;
    }
  }

  function loadPresetBanks() {
    fetch('/api/questionbanks/presets')
      .then(function (response) {
        if (!response.ok) throw new Error('Preset question banks could not be loaded.');
        return response.json();
      })
      .then(function (payload) {
        presetBanks = payload.banks || [];
        renderPresetBanks();
        renderBankSelect();
        if (presetBanks.length) loadPresetBank(presetBanks[0].id);
      })
      .catch(function () {
        els.presetBanks.innerHTML = '<p class="saved-empty">Preset question banks are unavailable right now. Please try again shortly.</p>';
        els.resultsNote.textContent = 'Preset question banks are unavailable right now.';
      });
  }

  function renderPresetBanks() {
    els.presetBanks.replaceChildren();
    var query = (els.presetSearch.value || '').trim().toLocaleLowerCase();
    var matches = presetBanks.filter(function (bank) {
      if (!query) return true;
      return [bank.name, bank.theme, bank.description].join(' ').toLocaleLowerCase().indexOf(query) !== -1;
    });
    els.presetSearchStatus.textContent = query
      ? 'Showing ' + matches.length + ' topic ' + (matches.length === 1 ? 'bank' : 'banks') + ' for “' + query + '”.'
      : presetBanks.length + ' topic banks ready to explore.';
    if (!matches.length) {
      els.presetBanks.innerHTML = '<p class="saved-empty">No topic matches that search. Try another word or theme.</p>';
      return;
    }
    matches.forEach(function (bank) {
      var card = document.createElement('button');
      card.className = 'preset-bank';
      card.type = 'button';
      card.dataset.presetId = bank.id;
      card.setAttribute('aria-label', 'Explore ' + bank.name);
      var icon = document.createElement('span');
      icon.className = 'preset-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = String.fromCodePoint(PRESET_ICONS[bank.id] || 0x1f4dd);
      var title = document.createElement('h3');
      title.textContent = bank.name;
      card.append(icon, title);
      els.presetBanks.append(card);
    });
  }

  function handlePresetAction(event) {
    var button = event.target.closest('button[data-preset-id]');
    if (!button) return;
    loadPresetBank(button.dataset.presetId);
  }

  function loadPresetBank(id) {
    fetch('/api/questionbanks/presets/' + encodeURIComponent(id))
      .then(function (response) {
        if (!response.ok) throw new Error('That preset question bank could not be loaded.');
        return response.json();
      })
      .then(function (bank) {
        pendingBank = null;
        importSummary = null;
        currentBank = bank;
        els.downloadButton.disabled = false;
        renderBankSelect(bank.id);
        renderFilters();
        renderCurrentBank();
        setStatus('Loaded “' + bank.name + '”.');
      })
      .catch(function (error) {
        setStatus(error.message || 'That preset question bank could not be loaded.');
      });
  }

  function renderSavedBanks() {
    els.savedBanks.replaceChildren();
    var banks = window.ChenQuestionBank.listAll();
    if (!banks.length) {
      var empty = document.createElement('p');
      empty.className = 'saved-empty';
      empty.textContent = 'No question banks have been saved in this browser yet.';
      els.savedBanks.append(empty);
      return;
    }
    banks.forEach(function (bank) {
      var card = document.createElement('article');
      card.className = 'saved-bank';
      var title = document.createElement('h3');
      title.textContent = bank.name;
      var detail = document.createElement('p');
      detail.textContent = bank.questionCount + ' questions · ' + bank.themeCount + ' themes';
      var actions = document.createElement('div');
      actions.className = 'saved-actions';
      actions.append(
        createActionButton('Open', 'load', bank.id),
        createActionButton('Remove', 'remove', bank.id, true)
      );
      card.append(title, detail, actions);
      els.savedBanks.append(card);
    });
  }

  function handleSavedBankAction(event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var id = button.dataset.id;
    if (button.dataset.action === 'remove') {
      window.ChenQuestionBank.remove(id);
      if (currentBank && currentBank.id === id) currentBank = null;
      renderSavedBanks();
      renderBankSelect();
      renderFilters();
      renderCurrentBank();
      setStatus('Removed that question bank from this browser.');
      return;
    }
    pendingBank = null;
    importSummary = null;
    currentBank = window.ChenQuestionBank.load(id);
    renderBankSelect(id);
    renderFilters();
    renderCurrentBank();
    els.downloadButton.disabled = !currentBank;
    setStatus(currentBank ? 'Loaded “' + currentBank.name + '”.' : 'That question bank could not be found.');
  }

  function renderFilters() {
    if (!currentBank || !currentBank.questions.length) {
      els.filters.hidden = true;
      return;
    }
    els.filters.hidden = false;
    populateFilter(els.themeFilter, currentBank.questions.map(function (question) { return question.theme; }), 'All themes');
    populateFilter(els.levelFilter, currentBank.questions.map(function (question) { return question.level; }), 'All levels');
    populateFilter(els.typeFilter, currentBank.questions.map(function (question) { return question.type; }), 'All types');
  }

  function populateFilter(select, values, label) {
    var previous = select.value;
    var unique = Array.from(new Set(values.filter(Boolean))).sort(function (a, b) {
      return a.localeCompare(b, 'zh-Hans-CN');
    });
    select.replaceChildren();
    var all = document.createElement('option');
    all.value = '';
    all.textContent = label;
    select.append(all);
    unique.forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
    if (previous && unique.indexOf(previous) >= 0) select.value = previous;
  }

  function renderCurrentBank() {
    var count = currentBank && currentBank.questions ? currentBank.questions.length : 0;
    els.questionTotal.textContent = count + ' question' + (count === 1 ? '' : 's');
    els.questionList.replaceChildren();
    if (!currentBank || !count) {
      els.resultsNote.textContent = 'Choose a Chen Laoshi preset bank to see its questions here.';
      return;
    }
    renderQuestions();
  }

  function renderQuestions() {
    els.questionList.replaceChildren();
    if (!currentBank || !currentBank.questions.length) return;
    var query = els.questionSearch.value.trim().toLocaleLowerCase();
    var theme = els.themeFilter.value;
    var level = els.levelFilter.value;
    var type = els.typeFilter.value;
    var questions = currentBank.questions.filter(function (question) {
      var searchable = [
        question.id, question.theme, question.level, question.prompt,
        question.answer, question.type, question.note
      ].concat(question.tags || [], question.options || []).join(' ').toLocaleLowerCase();
      return (!query || searchable.indexOf(query) >= 0) &&
        (!theme || question.theme === theme) &&
        (!level || question.level === level) &&
        (!type || question.type === type);
    });
    els.resultsNote.textContent = questions.length + ' of ' + currentBank.questions.length + ' questions shown in “' + currentBank.name + '”.';
    if (!questions.length) {
      var empty = document.createElement('p');
      empty.className = 'saved-empty';
      empty.textContent = 'No questions match these filters.';
      els.questionList.append(empty);
      return;
    }
    questions.forEach(function (question) {
      els.questionList.append(createQuestionCard(question));
    });
  }

  function createQuestionCard(question) {
    var card = document.createElement('article');
    card.className = 'question-card';
    var head = document.createElement('div');
    head.className = 'question-card-head';
    var id = document.createElement('span');
    id.className = 'question-id';
    id.textContent = question.id || 'QUESTION';
    var type = document.createElement('span');
    type.className = 'question-chip type';
    type.textContent = question.type;
    head.append(id, type);

    var prompt = document.createElement('p');
    prompt.className = 'question-prompt';
    prompt.textContent = question.prompt;
    card.append(head, prompt);

    var meta = document.createElement('div');
    meta.className = 'question-meta';
    [question.theme, question.level].concat(question.tags || []).filter(Boolean).forEach(function (value) {
      var chip = document.createElement('span');
      chip.className = 'question-chip';
      chip.textContent = value;
      meta.append(chip);
    });
    if (meta.children.length) card.append(meta);

    if ((question.options || []).some(Boolean)) {
      var list = document.createElement('ol');
      list.className = 'option-list';
      question.options.forEach(function (option, index) {
        if (!option) return;
        var item = document.createElement('li');
        var label = String.fromCharCode(65 + index);
        item.textContent = label + '. ' + option;
        if (label === question.answer.toUpperCase()) item.classList.add('correct-option');
        list.append(item);
      });
      card.append(list);
    }

    var answer = document.createElement('p');
    answer.className = 'question-answer';
    var displayAnswer = getDisplayAnswer(question);
    answer.innerHTML = '<strong>Answer:</strong> ';
    answer.append(document.createTextNode(displayAnswer));
    card.append(answer);
    if (question.note) {
      var note = document.createElement('p');
      note.className = 'question-answer';
      note.innerHTML = '<strong>Teacher note:</strong> ';
      note.append(document.createTextNode(question.note));
      card.append(note);
    }
    return card;
  }

  function getDisplayAnswer(question) {
    var index = ['A', 'B', 'C', 'D'].indexOf(question.answer.toUpperCase());
    return index >= 0 && question.options[index]
      ? question.answer.toUpperCase() + ' · ' + question.options[index]
      : question.answer;
  }

  function downloadCurrentBank() {
    if (!currentBank) return;
    var blob = new Blob([JSON.stringify(currentBank, null, 2)], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = safeFilename(currentBank.name) + '.json';
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus('Downloaded a JSON backup of “' + currentBank.name + '”.');
  }

  async function importWorkbook(file) {
    var zip = await window.JSZip.loadAsync(file);
    var sharedStrings = await readSharedStrings(zip);
    var sheetPath = await findQuestionSheetPath(zip);
    var worksheetFile = zip.file(sheetPath);
    if (!worksheetFile) throw new Error('The question sheet could not be found in this workbook.');
    var worksheet = parseXml(await worksheetFile.async('text'));
    var grid = readWorksheetGrid(worksheet, sharedStrings);
    if (!grid.length) throw new Error('The question sheet is empty.');

    var headerRowIndex = grid.findIndex(function (row) {
      return REQUIRED_HEADERS.every(function (header) { return row.indexOf(header) >= 0; });
    });
    if (headerRowIndex < 0) throw new Error('We could not find the expected question-bank column headers.');
    var headers = grid[headerRowIndex];
    var headerMap = Object.fromEntries(headers.map(function (header, index) { return [String(header).trim(), index]; }));
    var missingHeaders = REQUIRED_HEADERS.filter(function (header) { return headerMap[header] == null; });
    if (missingHeaders.length) throw new Error('Missing columns: ' + missingHeaders.join(', ') + '.');

    var issues = [];
    var ids = new Set();
    var questions = grid.slice(headerRowIndex + 1).map(function (row, rowIndex) {
      function value(header) { return String(row[headerMap[header]] || '').trim(); }
      if (!value('编号') && !value('题目')) return null;
      var question = {
        id: value('编号'),
        theme: value('主题'),
        level: value('难度'),
        prompt: value('题目'),
        answer: value('答案'),
        tags: value('标签'),
        type: value('题型'),
        optionA: value('选项A'),
        optionB: value('选项B'),
        optionC: value('选项C'),
        optionD: value('选项D'),
        note: value('备注')
      };
      var excelRow = headerRowIndex + rowIndex + 2;
      if (!question.id || !question.prompt || !question.answer) {
        issues.push('Row ' + excelRow + ' is missing an ID, question, or answer.');
      }
      if (ids.has(question.id)) issues.push('Question ID “' + question.id + '” appears more than once.');
      ids.add(question.id);
      if (question.type === '单选题' && ![question.optionA, question.optionB, question.optionC, question.optionD].every(Boolean)) {
        issues.push('Multiple-choice question “' + question.id + '” is missing an option.');
      }
      return window.ChenQuestionBank.normalizeQuestion(question);
    }).filter(Boolean);

    if (!questions.length) throw new Error('No questions were found below the header row.');
    var bankName = grid.slice(headerRowIndex + 1).map(function (row) {
      return String(row[headerMap['题库名称']] || '').trim();
    }).find(Boolean) || file.name.replace(/\.xlsx$/i, '');
    var bank = window.ChenQuestionBank.normalizeBank({
      name: bankName,
      source: file.name,
      questions: questions
    });
    return {
      bank: bank,
      summary: {
        questions: questions.length,
        themes: new Set(questions.map(function (question) { return question.theme; }).filter(Boolean)).size,
        types: new Set(questions.map(function (question) { return question.type; }).filter(Boolean)).size,
        issues: issues
      }
    };
  }

  async function readSharedStrings(zip) {
    var shared = zip.file('xl/sharedStrings.xml');
    if (!shared) return [];
    return Array.from(parseXml(await shared.async('text')).getElementsByTagName('si')).map(function (item) {
      return Array.from(item.getElementsByTagName('t')).map(function (node) { return node.textContent; }).join('');
    });
  }

  async function findQuestionSheetPath(zip) {
    var workbookFile = zip.file('xl/workbook.xml');
    if (!workbookFile) return 'xl/worksheets/sheet1.xml';
    var workbook = parseXml(await workbookFile.async('text'));
    var sheets = Array.from(workbook.getElementsByTagName('sheet'));
    var preferred = sheets.find(function (sheet) { return sheet.getAttribute('name') === '题库'; }) || sheets[0];
    if (!preferred) throw new Error('This workbook does not include a worksheet.');
    var relationId = getAttributeBySuffix(preferred, 'id');
    var relationsFile = zip.file('xl/_rels/workbook.xml.rels');
    if (!relationsFile || !relationId) return 'xl/worksheets/sheet1.xml';
    var relations = parseXml(await relationsFile.async('text'));
    var relationship = Array.from(relations.getElementsByTagName('Relationship')).find(function (item) {
      return item.getAttribute('Id') === relationId;
    });
    return relationship ? normaliseZipPath('xl', relationship.getAttribute('Target')) : 'xl/worksheets/sheet1.xml';
  }

  function readWorksheetGrid(worksheet, sharedStrings) {
    return Array.from(worksheet.getElementsByTagName('row')).map(function (row) {
      var values = [];
      Array.from(row.getElementsByTagName('c')).forEach(function (cell) {
        var reference = cell.getAttribute('r') || '';
        var column = columnIndex(reference.replace(/\d+/g, ''));
        values[column] = readCellValue(cell, sharedStrings);
      });
      return values.map(function (value) { return value == null ? '' : String(value).trim(); });
    });
  }

  function readCellValue(cell, sharedStrings) {
    var type = cell.getAttribute('t');
    if (type === 'inlineStr') {
      return Array.from(cell.getElementsByTagName('t')).map(function (node) { return node.textContent; }).join('');
    }
    var valueNode = cell.getElementsByTagName('v')[0];
    var value = valueNode ? valueNode.textContent : '';
    return type === 's' ? (sharedStrings[Number(value)] || '') : value;
  }

  function columnIndex(reference) {
    return reference.split('').reduce(function (total, character) {
      return total * 26 + character.charCodeAt(0) - 64;
    }, 0) - 1;
  }

  function getAttributeBySuffix(element, suffix) {
    var direct = element.getAttribute('r:' + suffix) || element.getAttribute(suffix);
    if (direct) return direct;
    return Array.from(element.attributes).map(function (attribute) {
      return attribute.name.slice(-suffix.length - 1) === ':' + suffix ? attribute.value : '';
    }).find(Boolean) || '';
  }

  function normaliseZipPath(base, target) {
    if (String(target || '').charAt(0) === '/') return String(target).replace(/^\/+/, '');
    var parts = base.split('/').concat(String(target || '').split('/'));
    return parts.reduce(function (path, part) {
      if (!part || part === '.') return path;
      if (part === '..') { path.pop(); return path; }
      path.push(part);
      return path;
    }, []).join('/');
  }

  function parseXml(text) {
    var document = new DOMParser().parseFromString(text, 'application/xml');
    if (document.getElementsByTagName('parsererror').length) throw new Error('This Excel file contains unreadable worksheet data.');
    return document;
  }

  function makeImportStatus(summary) {
    var firstLine = summary.questions + ' questions · ' + summary.themes + ' themes · ' + summary.types + ' question types.';
    if (!summary.issues.length) return firstLine + ' Your file is ready to save.';
    return firstLine + ' ' + summary.issues.length + ' issue' + (summary.issues.length === 1 ? '' : 's') + ' found: ' + summary.issues.slice(0, 2).join(' ');
  }

  function setImportStatus(message, state) {
    els.importStatus.className = 'import-status' + (state ? ' is-' + state : '');
    els.importStatus.replaceChildren();
    var title = document.createElement('p');
    title.className = 'status-title';
    title.textContent = state === 'ready' ? 'Import preview ready' : state === 'error' ? 'Import needs attention' : state === 'loading' ? 'Reading your workbook' : 'No file selected yet.';
    var detail = document.createElement('p');
    detail.textContent = message;
    els.importStatus.append(title, detail);
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

  function safeFilename(name) {
    return String(name || 'question-bank').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'question-bank';
  }

  function setStatus(message) {
    els.status.textContent = message;
  }
})();
