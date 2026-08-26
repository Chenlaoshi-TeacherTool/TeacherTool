(function () {
  'use strict';

  var PAIR_COUNT = 8;
  var TEMPLATE_URL = '/templates/maze-generator-chenlaoshi-template.pptx';
  var STORAGE_KEY = 'chen-laoshi-maze-generator-v1';
  var P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  var A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  var FINISH_NODE = -1;
  var $ = function (selector) { return document.querySelector(selector); };
  var toastTimer;
  var lastRouteIndex = -1;
  var routeQueue = [];

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

  // The question cards are numbered down each column in the supplied route
  // reference: Q1/Q2/Q3, Q4/Q5/Q6, Q7/Q8/FINISH. The indexes below match the
  // order of sourceQuestions and the eight pairs shown in the generated deck.
  var slotDefinitions = [
    { source: '发芽', nodes: [0, 3] },
    { source: '打雷', nodes: [0, 1] },
    { source: '结冰', nodes: [0, 4] },
    { source: '开花', nodes: [3, 6] },
    { source: '枯萎', nodes: [3, 4] },
    { source: '炎热', nodes: [6, 7] },
    { source: '凉爽', nodes: [6, 4] },
    { source: '丰收', nodes: [4, 1] },
    { source: '变黄', nodes: [1, 2] },
    { source: '游泳', nodes: [7, 4] },
    { source: '插秧', nodes: [4, 2] },
    { source: '播种', nodes: [4, 5] },
    { source: '滑雪', nodes: [7, FINISH_NODE] },
    { source: '寒冷', nodes: [2, 5] },
    { source: '堆雪人', nodes: [5, FINISH_NODE] },
    { source: '下雪', nodes: [4, FINISH_NODE] }
  ];

  // These are the 13 approved START-to-FINISH paths from the supplied deck.
  // Route 8's duplicated "4" label is represented here in its visual order.
  var validRoutes = [
    ['发芽', '开花', '炎热', '滑雪'],
    ['发芽', '枯萎', '播种', '堆雪人'],
    ['发芽', '开花', '凉爽', '播种', '堆雪人'],
    ['发芽', '开花', '凉爽', '游泳', '滑雪'],
    ['发芽', '开花', '凉爽', '插秧', '寒冷', '堆雪人'],
    ['结冰', '枯萎', '开花', '炎热', '滑雪'],
    ['打雷', '丰收', '凉爽', '炎热', '滑雪'],
    ['打雷', '变黄', '插秧', '凉爽', '炎热', '滑雪'],
    ['打雷', '丰收', '游泳', '滑雪'],
    ['打雷', '变黄', '寒冷', '堆雪人'],
    ['打雷', '变黄', '寒冷', '播种', '枯萎', '开花', '炎热', '滑雪'],
    ['打雷', '变黄', '插秧', '播种', '堆雪人'],
    ['发芽', '开花', '炎热', '游泳', '丰收', '变黄', '寒冷', '堆雪人']
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

  function setShapeFontSize(shape, points) {
    var size = String(Math.round(points * 100));
    ['rPr', 'defRPr', 'endParaRPr'].forEach(function (localName) {
      Array.prototype.slice.call(shape.getElementsByTagNameNS(A_NS, localName)).forEach(function (node) {
        node.setAttribute('sz', size);
      });
    });
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
    var existingFill = Array.prototype.slice.call(properties.childNodes).find(function (child) {
      return child.namespaceURI === A_NS && /Fill$/.test(child.localName || '');
    });
    var fill = documentNode.createElementNS(A_NS, 'a:solidFill');
    var color = documentNode.createElementNS(A_NS, 'a:srgbClr');
    color.setAttribute('val', hex);
    fill.appendChild(color);
    if (existingFill) {
      properties.replaceChild(fill, existingFill);
      return;
    }
    var insertBefore = Array.prototype.slice.call(properties.childNodes).find(function (child) {
      return child.namespaceURI === A_NS && /^(ln|effectLst|effectDag|scene3d|sp3d|extLst)$/.test(child.localName || '');
    });
    properties.insertBefore(fill, insertBefore || null);
  }

  function answerBackgroundShape(textShape) {
    var sibling = textShape.previousSibling;
    while (sibling) {
      if (sibling.namespaceURI === P_NS && sibling.localName === 'sp') {
        return getShapeText(sibling).trim() ? null : sibling;
      }
      sibling = sibling.previousSibling;
    }
    return null;
  }

  function setAnswerSlotFill(documentNode, textShape, hex) {
    // Each answer consists of a coloured freeform followed by a transparent
    // text box. Colour the freeform; filling the text box covers its text in
    // some PowerPoint renderers, which produced blank answer cells.
    var background = answerBackgroundShape(textShape);
    setShapeFill(documentNode, background || textShape, hex);
  }

  function nextRouteIndex() {
    if (!routeQueue.length) {
      routeQueue = shuffle(Array.from({ length: validRoutes.length }, function (_, index) { return index; }));
      if (routeQueue.length > 1 && routeQueue[0] === lastRouteIndex) {
        var replacement = routeQueue[0];
        routeQueue[0] = routeQueue[1];
        routeQueue[1] = replacement;
      }
    }
    lastRouteIndex = routeQueue.shift();
    return lastRouteIndex;
  }

  function routeSteps(route) {
    var currentNode = 0;
    var visited = new Set([currentNode]);
    var steps = route.map(function (source, index) {
      var slot = slotDefinitions.find(function (candidate) { return candidate.source === source; });
      if (!slot || slot.nodes.indexOf(currentNode) === -1) throw new Error('A maze route is disconnected.');
      var nextNode = slot.nodes[0] === currentNode ? slot.nodes[1] : slot.nodes[0];
      if (nextNode === FINISH_NODE && index !== route.length - 1) throw new Error('A maze route reaches the finish too early.');
      if (nextNode !== FINISH_NODE && visited.has(nextNode)) throw new Error('A maze route contains a loop.');
      var step = { source: source, pair: currentNode };
      currentNode = nextNode;
      if (currentNode !== FINISH_NODE) visited.add(currentNode);
      return step;
    });
    if (currentNode !== FINISH_NODE) throw new Error('A maze route does not reach the finish.');
    return steps;
  }

  function distractorAssignments(routeStepList) {
    var values = {};
    var correctSlots = new Set();
    var remaining = Array.from({ length: PAIR_COUNT }, function () { return 2; });
    routeStepList.forEach(function (step) {
      correctSlots.add(step.source);
      remaining[step.pair] -= 1;
    });
    var unusedSlots = shuffle(slotDefinitions.filter(function (slot) { return !correctSlots.has(slot.source); }));

    function assign(slotIndex) {
      if (slotIndex === unusedSlots.length) return true;
      var slot = unusedSlots[slotIndex];
      var candidates = shuffle(Array.from({ length: PAIR_COUNT }, function (_, pair) { return pair; }))
        .filter(function (pair) { return remaining[pair] > 0 && slot.nodes.indexOf(pair) === -1; })
        .sort(function (left, right) { return remaining[right] - remaining[left]; });
      for (var index = 0; index < candidates.length; index += 1) {
        var pair = candidates[index];
        remaining[pair] -= 1;
        values[slot.source] = pair;
        if (assign(slotIndex + 1)) return true;
        remaining[pair] += 1;
        delete values[slot.source];
      }
      return false;
    }

    if (!assign(0)) throw new Error('The maze distractors could not be arranged.');
    return values;
  }

  function buildSlotLayout(data) {
    var routeIndex = nextRouteIndex();
    var steps = routeSteps(validRoutes[routeIndex]);
    var pairBySlot = distractorAssignments(steps);
    var correctSlots = new Set();
    steps.forEach(function (step) {
      correctSlots.add(step.source);
      pairBySlot[step.source] = step.pair;
    });
    var values = {};
    slotDefinitions.forEach(function (slot) {
      values[slot.source] = data.pairs[pairBySlot[slot.source]].answer;
    });
    return { routeIndex: routeIndex, steps: steps, values: values, correctSlots: correctSlots };
  }

  function updateSlideXml(xmlString, data, slideNumber, layout) {
    var parser = new DOMParser();
    var documentNode = parser.parseFromString(xmlString, 'application/xml');
    if (documentNode.getElementsByTagName('parsererror').length) throw new Error('The PowerPoint template could not be read.');
    var answerValues = layout.values;
    var answerKey = slideNumber === 3;
    var questionMap = {};
    sourceQuestions.forEach(function (source, index) { questionMap[source] = data.pairs[index].question; });
    Array.prototype.slice.call(documentNode.getElementsByTagNameNS(P_NS, 'sp')).forEach(function (shape) {
      var original = getShapeText(shape).trim();
      if (!original) return;
      if (original === '四季词语迷宫') {
        setShapeText(shape, data.title);
        setShapeFontSize(shape, 28);
      } else if (original === '四季词语迷宫：参考答案') {
        setShapeText(shape, data.title + (document.documentElement.lang === 'zh' ? '：答案' : ' — Key'));
        setShapeFontSize(shape, 30);
      } else if (original.indexOf('从开始出发') === 0) {
        setShapeText(shape, 'Start at the beginning, choose each correct answer, and follow the path to the finish.');
      } else if (original.indexOf('开始') === 0 && original.indexOf(sourceQuestions[0]) !== -1) {
        setStartQuestionText(shape, data.pairs[0].question);
      } else if (Object.prototype.hasOwnProperty.call(questionMap, original)) {
        setShapeText(shape, questionMap[original]);
      } else if (Object.prototype.hasOwnProperty.call(answerValues, original)) {
        setShapeText(shape, answerValues[original]);
        if (answerKey) setAnswerSlotFill(documentNode, shape, layout.correctSlots.has(original) ? 'F8C63F' : 'FFFFFF');
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
      var layout = buildSlotLayout(data);
      for (var slideNumber = 1; slideNumber <= 3; slideNumber += 1) {
        var slidePath = 'ppt/slides/slide' + slideNumber + '.xml';
        var slideFile = zip.file(slidePath);
        if (!slideFile) throw new Error('A template slide is missing.');
        zip.file(slidePath, updateSlideXml(await slideFile.async('string'), data, slideNumber, layout));
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
