(function () {
  'use strict';

  var PAIR_COUNT = 8;
  var TEMPLATE_URL = '/templates/maze-generator-chenlaoshi-template.pptx';
  var STORAGE_KEY = 'chen-laoshi-maze-generator-v1';
  var P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  var A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  var $ = function (selector) { return document.querySelector(selector); };
  var toastTimer;

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
    title: 'Fraction Equivalence Maze',
    pairs: [
      { question: 'Which fraction is equivalent to one half?', answer: '2/4' },
      { question: 'Which fraction is equivalent to three fourths?', answer: '6/8' },
      { question: 'Which fraction is equivalent to two thirds?', answer: '4/6' },
      { question: 'Which fraction is equivalent to one third?', answer: '3/9' },
      { question: 'Which fraction is equivalent to four fifths?', answer: '8/10' },
      { question: 'Which fraction is equivalent to three tenths?', answer: '6/20' },
      { question: 'Which fraction is equivalent to five sixths?', answer: '10/12' },
      { question: 'Which fraction is equivalent to seven eighths?', answer: '14/16' }
    ]
  };

  function emptyPairs() {
    return Array.from({ length: PAIR_COUNT }, function () { return { question: '', answer: '' }; });
  }

  function showToast(message, isError) {
    var node = $('#mazeToast');
    node.textContent = message;
    node.classList.toggle('error', Boolean(isError));
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('show'); }, 2600);
  }

  function formatPairLine(pair, index) {
    return (index + 1) + '. ' + String(pair.question || '').trim() + ' | ' + String(pair.answer || '').trim();
  }

  function fillPairRows(pairs) {
    var data = Array.isArray(pairs) ? pairs.slice(0, PAIR_COUNT) : [];
    while (data.length < PAIR_COUNT) data.push({ question: '', answer: '' });
    $('#mazePairInput').value = data.map(formatPairLine).join('\n');
  }

  function parsePairText(value) {
    var pairs = emptyPairs();
    var nextIndex = 0;
    String(value || '').split(/\r?\n/).forEach(function (rawLine) {
      if (!rawLine.trim()) return;
      var line = rawLine.trim();
      var numbered = line.match(/^(\d+)\s*[.\)\]:：、-]\s*(.*)$/);
      var pairIndex = numbered ? Number(numbered[1]) - 1 : nextIndex;
      if (numbered) line = numbered[2];
      while (nextIndex < PAIR_COUNT && (pairs[nextIndex].question || pairs[nextIndex].answer)) nextIndex += 1;
      if (pairIndex < 0 || pairIndex >= PAIR_COUNT) pairIndex = nextIndex;
      if (pairIndex < 0 || pairIndex >= PAIR_COUNT) return;
      var pieces = line.split(/\s*(?:\||｜|→|=>|\t)\s*/);
      if (pieces.length < 2) pieces = line.split(/\s+(?:Answer|答案)\s*[:：]\s*/i);
      pairs[pairIndex] = {
        question: String(pieces.shift() || '').trim().slice(0, 120),
        answer: String(pieces.join(' | ') || '').trim().slice(0, 28)
      };
      if (!numbered) nextIndex = pairIndex + 1;
    });
    return pairs;
  }

  function readData() {
    return {
      title: $('#mazeTitle').value.trim(),
      pairs: parsePairText($('#mazePairInput').value)
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

  function answerForQuestion(question) {
    var answer = String(question.answer || '').trim();
    var options = Array.isArray(question.options) ? question.options : [];
    if (/^[A-D]$/i.test(answer)) {
      var optionIndex = answer.toUpperCase().charCodeAt(0) - 65;
      if (options[optionIndex]) answer = String(options[optionIndex]).trim();
    }
    return answer;
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

  function importPresetBanks(banks) {
    try {
      var pairs = pickBalancedPairs(banks);
      if (!$('#mazeTitle').value.trim()) {
        $('#mazeTitle').value = banks.map(function (bank) { return bank.theme || bank.name; }).join(' · ') + ' Maze';
      }
      fillPairRows(pairs);
      saveDraft();
      showToast('Library questions added to your maze.');
    } catch (error) {
      showToast('The selected topics do not have enough complete questions.', true);
    }
  }

  function initQuestionBankPicker() {
    if (!window.ChenLibraryPicker) return;
    var picker = ChenLibraryPicker.create({
      root: $('#mazeBankPicker'),
      source: 'questionbanks',
      min: 1,
      max: PAIR_COUNT,
      kicker: 'Chen Laoshi Library',
      title: 'Use preset question banks',
      hint: 'Choose up to eight topics, then bring in a balanced set of eight questions and answers. You can edit every pair afterward.',
      libraryLinkText: 'Browse Library',
      importLabel: 'Use 8 questions from selected topics',
      onImport: function (banks) {
        importPresetBanks(banks);
        picker.reset();
      }
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
        setShapeText(shape, data.title + ': Answer Key');
      } else if (original.indexOf('从开始出发') === 0) {
        setShapeText(shape, 'Start at the beginning, choose each correct answer, and follow the path to the finish.');
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
    $('#mazePairInput').addEventListener('input', saveDraft);
    $('#generateMaze').addEventListener('click', downloadEditablePptx);
    $('#loadMazeSample').addEventListener('click', loadSample);
    $('#clearMaze').addEventListener('click', clearAll);
    initQuestionBankPicker();
  }

  setup();
}());
