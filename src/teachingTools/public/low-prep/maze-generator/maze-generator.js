(function () {
  'use strict';

  var PAIR_COUNT = 8;
  var TEMPLATE_URL = '/templates/maze-generator-chenlaoshi-template.pptx';
  var STORAGE_KEY = 'chen-laoshi-maze-generator-v1';
  var P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  var A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  var $ = function (selector) { return document.querySelector(selector); };
  var toastTimer;
  var presetQuestionBanks = [];
  var selectedPresetBankIds = [];

  var sourceQuestions = [
    '春天到了，小草和小树在做什么？',
    '秋天到了，树叶的颜色会有什么变化？',
    '冬天到了，天气变得怎么样？',
    '春雨过后，花园里的花儿都怎么样了？',
    '秋天到了，农民伯伯在田地里忙着做什么？',
    '下雪天，小朋友们喜欢在雪地里做什么好玩的事？',
    '夏天到了，天气变得怎么样？',
    '天气太热了，小朋友们喜欢做什么运动来消暑？'
  ];

  var slotDefinitions = [
    { source: '发芽', pair: 0, correct: true },
    { source: '变黄', pair: 1, correct: true },
    { source: '寒冷', pair: 2, correct: true },
    { source: '开花', pair: 3, correct: true },
    { source: '丰收', pair: 4, correct: true },
    { source: '堆雪人', pair: 5, correct: true },
    { source: '炎热', pair: 6, correct: true },
    { source: '游泳', pair: 7, correct: true },
    { source: '打雷', pair: 0, correct: false },
    { source: '结冰', pair: 1, correct: false },
    { source: '凉爽', pair: 2, correct: false },
    { source: '枯萎', pair: 3, correct: false },
    { source: '插秧', pair: 4, correct: false },
    { source: '下雪', pair: 5, correct: false },
    { source: '播种', pair: 6, correct: false },
    { source: '滑雪', pair: 7, correct: false }
  ];

  var sample = {
    title: '四季词语迷宫',
    pairs: [
      { question: '春天到了，小草和小树在做什么？', answer: '发芽' },
      { question: '秋天到了，树叶的颜色会有什么变化？', answer: '变黄' },
      { question: '冬天到了，天气变得怎么样？', answer: '寒冷' },
      { question: '春雨过后，花园里的花儿都怎么样了？', answer: '开花' },
      { question: '秋天到了，农民伯伯在田地里忙着做什么？', answer: '丰收' },
      { question: '下雪天，小朋友们喜欢在雪地里做什么好玩的事？', answer: '堆雪人' },
      { question: '夏天到了，天气变得怎么样？', answer: '炎热' },
      { question: '天气太热了，小朋友们喜欢做什么运动来消暑？', answer: '游泳' }
    ]
  };

  function emptyPairs() {
    return Array.from({ length: PAIR_COUNT }, function () { return { question: '', answer: '' }; });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showToast(message, isError) {
    var node = $('#mazeToast');
    node.textContent = message;
    node.classList.toggle('error', Boolean(isError));
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('show'); }, 2600);
  }

  function pairMarkup(index, data) {
    var number = index + 1;
    return '<article class="maze-pair">' +
      '<div class="maze-pair-number">' + number + '</div>' +
      '<label>Question or sentence<textarea data-question="' + index + '" maxlength="120" placeholder="e.g. The puppy is sitting ___ the table.">' + escapeHtml(data.question) + '</textarea></label>' +
      '<label>Short answer<input data-answer="' + index + '" maxlength="28" value="' + escapeHtml(data.answer) + '" placeholder="e.g. under"></label>' +
      '</article>';
  }

  function fillPairRows(pairs) {
    var data = Array.isArray(pairs) ? pairs.slice(0, PAIR_COUNT) : [];
    while (data.length < PAIR_COUNT) data.push({ question: '', answer: '' });
    $('#mazePairs').innerHTML = data.map(function (pair, index) {
      return pairMarkup(index, pair);
    }).join('');
  }

  function readData() {
    var pairs = [];
    for (var index = 0; index < PAIR_COUNT; index += 1) {
      pairs.push({
        question: $('[data-question="' + index + '"]').value.trim(),
        answer: $('[data-answer="' + index + '"]').value.trim()
      });
    }
    return {
      title: $('#mazeTitle').value.trim(),
      pairs: pairs
    };
  }

  function saveDraft() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(readData())); } catch (error) { /* Browser storage is optional. */ }
  }

  function loadDraft() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && Array.isArray(saved.pairs)) return saved;
    } catch (error) { /* A broken browser draft should not interrupt the builder. */ }
    return { title: '', pairs: emptyPairs() };
  }

  function shuffle(items) {
    var copy = (items || []).slice();
    for (var index = copy.length - 1; index > 0; index -= 1) {
      var target = Math.floor(Math.random() * (index + 1));
      var temporary = copy[index];
      copy[index] = copy[target];
      copy[target] = temporary;
    }
    return copy;
  }

  function presetBankIcon(id) {
    var icons = {
      'chenlaoshi-seasons-weather': '🌦️',
      'chenlaoshi-animals': '🐾',
      'chenlaoshi-numbers': '🔢',
      'chenlaoshi-body-parts': '🧍',
      'chenlaoshi-colors': '🎨',
      'chenlaoshi-family': '👪',
      'chenlaoshi-rooms': '🏠',
      'chenlaoshi-clothing': '👕',
      'chenlaoshi-jobs': '💼',
      'chenlaoshi-countries': '🗺️',
      'chenlaoshi-hobbies': '⚽',
      'chenlaoshi-school': '🏫',
      'chenlaoshi-back-to-school': '🎒',
      'chenlaoshi-festivals': '🎉',
      'chenlaoshi-self-introduction': '💬',
      'chenlaoshi-pinyin': '🔤',
      'chenlaoshi-core-high-frequency': '⭐'
    };
    return icons[id] || '📝';
  }

  function renderPresetBankChoices() {
    var choices = $('#mazeBankChoices');
    var status = $('#mazeBankStatus');
    var importButton = $('#importMazeBank');
    var note = $('#mazeBankSelectionNote');
    choices.innerHTML = '';
    if (!presetQuestionBanks.length) {
      status.textContent = 'Question-bank topics are unavailable right now. Please try again later.';
      note.textContent = 'Topics will appear here when the Library is available.';
      importButton.disabled = true;
      return;
    }
    presetQuestionBanks.forEach(function (bank) {
      var button = document.createElement('button');
      var chosen = selectedPresetBankIds.indexOf(bank.id) !== -1;
      button.type = 'button';
      button.className = 'maze-bank-choice';
      button.dataset.bankId = bank.id;
      button.setAttribute('aria-pressed', String(chosen));
      button.textContent = presetBankIcon(bank.id) + ' ' + (bank.theme || bank.name);
      button.addEventListener('click', function () {
        var selectedIndex = selectedPresetBankIds.indexOf(bank.id);
        if (selectedIndex !== -1) {
          selectedPresetBankIds.splice(selectedIndex, 1);
        } else if (selectedPresetBankIds.length < PAIR_COUNT) {
          selectedPresetBankIds.push(bank.id);
        } else {
          showToast('Choose up to 8 topics for one maze.', true);
        }
        renderPresetBankChoices();
      });
      choices.appendChild(button);
    });
    status.textContent = presetQuestionBanks.length + ' preset topics are ready to use.';
    note.textContent = selectedPresetBankIds.length
      ? selectedPresetBankIds.length + ' topic' + (selectedPresetBankIds.length === 1 ? '' : 's') + ' selected · eight questions will be balanced across them.'
      : 'Choose up to eight topics to begin.';
    importButton.disabled = !selectedPresetBankIds.length;
  }

  function loadPresetQuestionBanks() {
    fetch('/api/questionbanks/presets')
      .then(function (response) {
        if (!response.ok) throw new Error('Question bank list unavailable');
        return response.json();
      })
      .then(function (payload) {
        presetQuestionBanks = payload.banks || [];
        renderPresetBankChoices();
      })
      .catch(function () {
        presetQuestionBanks = [];
        renderPresetBankChoices();
      });
  }

  function answerForQuestion(question) {
    var answer = String(question.answer || '').trim();
    var options = Array.isArray(question.options) ? question.options : [];
    if (/^[A-D]$/i.test(answer)) {
      var optionIndex = answer.toUpperCase().charCodeAt(0) - 65;
      if (options[optionIndex]) answer = String(options[optionIndex]).trim();
    }
    return answer;
  }

  function selectedPresetBanks() {
    return selectedPresetBankIds.map(function (id) {
      return presetQuestionBanks.find(function (bank) { return bank.id === id; });
    }).filter(Boolean);
  }

  function completePairs(questions) {
    return shuffle(questions).map(function (question) {
      return { question: String(question.prompt || '').trim(), answer: answerForQuestion(question) };
    }).filter(function (pair) { return pair.question && pair.answer; });
  }

  function pickBalancedPairs(banks) {
    var selected = banks.map(function (bank) { return completePairs(bank.questions); });
    if (selected.some(function (questions) { return !questions.length; })) throw new Error('Not enough complete questions');
    var chosen = selected.map(function (questions) { return questions.shift(); });
    var remaining = shuffle([].concat.apply([], selected));
    while (chosen.length < PAIR_COUNT && remaining.length) chosen.push(remaining.shift());
    if (chosen.length < PAIR_COUNT) throw new Error('Not enough complete questions');
    return shuffle(chosen).slice(0, PAIR_COUNT);
  }

  function importPresetBank() {
    var selectedBanks = selectedPresetBanks();
    if (!selectedBanks.length) return;
    var importButton = $('#importMazeBank');
    importButton.disabled = true;
    importButton.textContent = 'Loading questions…';
    $('#mazeBankStatus').textContent = 'Choosing eight questions from the Library…';
    Promise.all(selectedBanks.map(function (bank) {
      return fetch('/api/questionbanks/presets/' + encodeURIComponent(bank.id)).then(function (response) {
        if (!response.ok) throw new Error('Question bank unavailable');
        return response.json();
      });
    }))
      .then(function (banks) {
        var pairs = pickBalancedPairs(banks);
        if (!$('#mazeTitle').value.trim()) {
          $('#mazeTitle').value = selectedBanks.map(function (bank) { return bank.theme || bank.name; }).join(' · ') + ' Maze';
        }
        fillPairRows(pairs);
        saveDraft();
        $('#mazeBankStatus').textContent = 'Eight questions from ' + selectedBanks.length + ' selected topic' + (selectedBanks.length === 1 ? '' : 's') + ' are ready to edit.';
        showToast('Library questions added to your maze.');
      })
      .catch(function () {
        $('#mazeBankStatus').textContent = 'The selected topics could not be loaded. Please try again.';
        showToast('The Library questions could not be loaded.', true);
      })
      .finally(function () {
        importButton.textContent = 'Use 8 questions from selected topics';
        renderPresetBankChoices();
      });
  }

  function getShapeText(shape) {
    return Array.prototype.slice.call(shape.getElementsByTagNameNS(A_NS, 't')).map(function (node) {
      return node.textContent || '';
    }).join('');
  }

  function setShapeText(shape, value) {
    var textNodes = Array.prototype.slice.call(shape.getElementsByTagNameNS(A_NS, 't'));
    if (!textNodes.length) return;
    textNodes[0].textContent = value;
    for (var index = 1; index < textNodes.length; index += 1) textNodes[index].textContent = '';
  }

  function setStartQuestionText(shape, value) {
    var textNodes = Array.prototype.slice.call(shape.getElementsByTagNameNS(A_NS, 't'));
    if (textNodes.length < 2) {
      setShapeText(shape, 'START ' + value);
      return;
    }
    textNodes[textNodes.length - 1].textContent = value;
    for (var index = 1; index < textNodes.length - 1; index += 1) textNodes[index].textContent = '';
  }

  function directChildByName(node, namespace, localName) {
    return Array.prototype.slice.call(node.childNodes).find(function (child) {
      return child.namespaceURI === namespace && child.localName === localName;
    });
  }

  function setShapeFill(documentNode, shape, hex) {
    var properties = directChildByName(shape, P_NS, 'spPr');
    if (!properties) return;
    Array.prototype.slice.call(properties.childNodes).forEach(function (child) {
      if (child.namespaceURI === A_NS && /Fill$/.test(child.localName || '')) properties.removeChild(child);
    });
    var fill = documentNode.createElementNS(A_NS, 'a:solidFill');
    var color = documentNode.createElementNS(A_NS, 'a:srgbClr');
    color.setAttribute('val', hex);
    fill.appendChild(color);
    properties.insertBefore(fill, properties.firstChild);
  }

  function slotValues(data) {
    var values = {};
    slotDefinitions.forEach(function (slot) { values[slot.source] = data.pairs[slot.pair].answer; });
    return values;
  }

  function updateSlideXml(xmlString, data, slideNumber) {
    var parser = new DOMParser();
    var documentNode = parser.parseFromString(xmlString, 'application/xml');
    if (documentNode.getElementsByTagName('parsererror').length) throw new Error('The PowerPoint template could not be read.');
    var answerValues = slotValues(data);
    var answerKey = slideNumber === 3;
    var correctSlots = new Set(slotDefinitions.filter(function (slot) { return slot.correct; }).map(function (slot) { return slot.source; }));
    var questionMap = {};
    sourceQuestions.forEach(function (source, index) { questionMap[source] = data.pairs[index].question; });
    Array.prototype.slice.call(documentNode.getElementsByTagNameNS(P_NS, 'sp')).forEach(function (shape) {
      var original = getShapeText(shape).trim();
      if (!original) return;
      if (original === '四季词语迷宫') {
        setShapeText(shape, data.title);
      } else if (original === '四季词语迷宫：参考答案') {
        setShapeText(shape, data.title + '：参考答案');
      } else if (original.indexOf('从开始出发') === 0) {
        setShapeText(shape, '从开始出发，选出每道题的正确答案，一路连到终点吧！');
      } else if (original.indexOf('开始') === 0 && original.indexOf(sourceQuestions[0]) !== -1) {
        setStartQuestionText(shape, data.pairs[0].question);
      } else if (Object.prototype.hasOwnProperty.call(questionMap, original)) {
        setShapeText(shape, questionMap[original]);
      } else if (Object.prototype.hasOwnProperty.call(answerValues, original)) {
        setShapeText(shape, answerValues[original]);
        if (answerKey) setShapeFill(documentNode, shape, correctSlots.has(original) ? 'F8C63F' : 'FFFFFF');
      }
    });
    return new XMLSerializer().serializeToString(documentNode);
  }

  function validate(data) {
    var incomplete = data.pairs.findIndex(function (pair) { return !pair.question || !pair.answer; });
    if (incomplete !== -1) {
      showToast('Please finish question and answer ' + (incomplete + 1) + ' before downloading.', true);
      return false;
    }
    return true;
  }

  function downloadBlob(name, blob) {
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function filenameFor(title) {
    return String(title || 'maze-challenge').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'maze-challenge';
  }

  async function downloadEditablePptx() {
    var data = readData();
    if (!validate(data)) return;
    data.title = data.title || 'Maze Challenge';
    if (!window.JSZip) {
      showToast('The PowerPoint exporter is not available yet. Please refresh and try again.', true);
      return;
    }
    var button = $('#generateMaze');
    button.disabled = true;
    button.textContent = 'Preparing PowerPoint…';
    try {
      var response = await fetch(TEMPLATE_URL);
      if (!response.ok) throw new Error('Template download failed.');
      var zip = await window.JSZip.loadAsync(await response.arrayBuffer());
      for (var slideNumber = 1; slideNumber <= 3; slideNumber += 1) {
        var slidePath = 'ppt/slides/slide' + slideNumber + '.xml';
        var slideFile = zip.file(slidePath);
        if (!slideFile) throw new Error('A template slide is missing.');
        zip.file(slidePath, updateSlideXml(await slideFile.async('string'), data, slideNumber));
      }
      var output = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      downloadBlob(filenameFor(data.title) + '.pptx', output);
      showToast('Editable PowerPoint downloaded.');
    } catch (error) {
      showToast('The PowerPoint could not be created. Please try again.', true);
    } finally {
      button.disabled = false;
      button.textContent = 'Generate & download PowerPoint';
    }
  }

  function loadSample() {
    $('#mazeTitle').value = sample.title;
    fillPairRows(sample.pairs);
    saveDraft();
    showToast('Sample maze loaded.');
  }

  function clearAll() {
    $('#mazeTitle').value = '';
    fillPairRows(emptyPairs());
    saveDraft();
    showToast('The maze is ready for a new set of questions.');
  }

  function setup() {
    var saved = loadDraft();
    $('#mazeTitle').value = saved.title || '';
    fillPairRows(saved.pairs);
    $('#mazeTitle').addEventListener('input', saveDraft);
    $('#mazePairs').addEventListener('input', saveDraft);
    $('#generateMaze').addEventListener('click', downloadEditablePptx);
    $('#loadMazeSample').addEventListener('click', loadSample);
    $('#clearMaze').addEventListener('click', clearAll);
    $('#importMazeBank').addEventListener('click', importPresetBank);
    loadPresetQuestionBanks();
  }

  setup();
}());
