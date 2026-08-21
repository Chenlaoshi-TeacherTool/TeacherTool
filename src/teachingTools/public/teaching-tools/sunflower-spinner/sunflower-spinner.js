(function () {
  'use strict';

  var MIN_ITEMS = 2;
  var MAX_ITEMS = 16;
  var MAX_WHEELS = 4;
  var MAX_ITEM_LENGTH = 45;
  var DEFAULT_ITEMS = ['Explain', 'Compare', 'Sketch', 'Solve', 'Define', 'Predict', 'Question', 'Connect'];
  var PETAL_COLORS = ['#f8c63f', '#ffd86a', '#f4b942', '#ffe796', '#e7a81f', '#ffd259', '#f5ce52', '#fff0aa'];

  var state = {
    wheels: [createWheel(1)],
    isSpinning: false,
    decisionQueue: [],
    pendingDecision: null
  };
  var els = {};
  var toastTimer = null;

  document.addEventListener('DOMContentLoaded', init);

  function createWheel(number) {
    return {
      id: 'wheel-' + Date.now() + '-' + Math.random().toString(16).slice(2),
      name: 'Wheel ' + number,
      text: DEFAULT_ITEMS.join('\n'),
      rotation: 0,
      winner: '',
      issue: ''
    };
  }

  function init() {
    els.wheelEditors = document.getElementById('wheelEditors');
    els.wheelStage = document.getElementById('wheelStage');
    els.wheelCount = document.getElementById('wheelCount');
    els.addWheelButton = document.getElementById('addWheelButton');
    els.removeWheelButton = document.getElementById('removeWheelButton');
    els.wheelLimitMessage = document.getElementById('wheelLimitMessage');
    els.spinAllButton = document.getElementById('spinAllButton');
    els.toast = document.getElementById('toast');
    els.petalDecisionModal = document.getElementById('petalDecisionModal');
    els.petalDecisionMessage = document.getElementById('petalDecisionMessage');
    els.petalDecisionNote = document.getElementById('petalDecisionNote');
    els.keepPetalButton = document.getElementById('keepPetalButton');
    els.removePetalButton = document.getElementById('removePetalButton');

    els.addWheelButton.addEventListener('click', addWheel);
    els.removeWheelButton.addEventListener('click', removeWheel);
    els.spinAllButton.addEventListener('click', spinAllWheels);
    els.keepPetalButton.addEventListener('click', keepSelectedPetal);
    els.removePetalButton.addEventListener('click', removeSelectedPetal);
    render();
  }

  function parseItems(text) {
    var lines = text.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    var issue = '';
    var hasLongItem = lines.some(function (line) { return Array.from(line).length > MAX_ITEM_LENGTH; });
    if (hasLongItem) issue = 'Each line is limited to ' + MAX_ITEM_LENGTH + ' characters.';
    if (lines.length > MAX_ITEMS) issue = 'Only the first ' + MAX_ITEMS + ' lines appear on the sunflower.';

    return {
      items: lines.slice(0, MAX_ITEMS).map(function (line) { return Array.from(line).slice(0, MAX_ITEM_LENGTH).join(''); }),
      total: lines.length,
      issue: issue
    };
  }

  function wheelReady(wheel) {
    return parseItems(wheel.text).items.length >= MIN_ITEMS;
  }

  function render() {
    renderEditors();
    renderStage();
    updateControls();
  }

  function renderEditors() {
    els.wheelEditors.replaceChildren();
    state.wheels.forEach(function (wheel, index) {
      var parsed = parseItems(wheel.text);
      wheel.issue = parsed.issue;

      var panel = document.createElement('section');
      panel.className = 'wheel-editor';
      panel.setAttribute('aria-labelledby', wheel.id + '-label');

      var heading = document.createElement('div');
      heading.className = 'wheel-editor-heading';
      var label = document.createElement('label');
      label.id = wheel.id + '-label';
      label.htmlFor = wheel.id + '-input';
      label.textContent = wheel.name;
      var count = document.createElement('span');
      count.id = wheel.id + '-count';
      count.className = 'item-count' + (parsed.items.length < MIN_ITEMS || parsed.total > MAX_ITEMS || parsed.issue ? ' warning' : '');
      count.textContent = Math.min(parsed.total, MAX_ITEMS) + '/' + MAX_ITEMS + ' petals';
      heading.append(label, count);

      var textarea = document.createElement('textarea');
      textarea.id = wheel.id + '-input';
      textarea.rows = 8;
      textarea.className = 'wheel-input';
      textarea.value = wheel.text;
      textarea.placeholder = 'One word, sentence, or name per line';
      textarea.spellcheck = false;
      textarea.setAttribute('aria-describedby', wheel.id + '-help');
      textarea.addEventListener('input', function (event) {
        wheel.text = event.target.value;
        wheel.winner = '';
        // Do not redraw the editor here: rebuilding the textarea on every
        // keystroke removes its focus. Only refresh the changing preview and
        // the small count/help details alongside this existing textarea.
        updateEditorFeedback(wheel);
        renderStage();
        updateControls();
      });

      var help = document.createElement('p');
      help.id = wheel.id + '-help';
      help.className = 'input-help' + (parsed.items.length < MIN_ITEMS || parsed.issue ? ' warning' : '');
      if (parsed.items.length < MIN_ITEMS) {
        help.textContent = 'Add at least ' + MIN_ITEMS + ' lines to make a sunflower.';
      } else if (parsed.issue) {
        help.textContent = parsed.issue;
      } else {
        help.textContent = 'One line = one petal · up to ' + MAX_ITEM_LENGTH + ' characters per line';
      }

      panel.append(heading, textarea, help);
      els.wheelEditors.append(panel);
    });
  }

  function updateEditorFeedback(wheel) {
    var parsed = parseItems(wheel.text);
    wheel.issue = parsed.issue;

    var count = document.getElementById(wheel.id + '-count');
    if (count) {
      count.className = 'item-count' + (parsed.items.length < MIN_ITEMS || parsed.total > MAX_ITEMS || parsed.issue ? ' warning' : '');
      count.textContent = Math.min(parsed.total, MAX_ITEMS) + '/' + MAX_ITEMS + ' petals';
    }

    var help = document.getElementById(wheel.id + '-help');
    if (!help) return;
    help.className = 'input-help' + (parsed.items.length < MIN_ITEMS || parsed.issue ? ' warning' : '');
    if (parsed.items.length < MIN_ITEMS) {
      help.textContent = 'Add at least ' + MIN_ITEMS + ' lines to make a sunflower.';
    } else if (parsed.issue) {
      help.textContent = parsed.issue;
    } else {
      help.textContent = 'One line = one petal · up to ' + MAX_ITEM_LENGTH + ' characters per line';
    }
  }

  function renderStage() {
    els.wheelStage.replaceChildren();
    els.wheelStage.dataset.wheels = String(state.wheels.length);

    state.wheels.forEach(function (wheel, index) {
      var parsed = parseItems(wheel.text);
      var card = document.createElement('article');
      card.className = 'wheel-card';
      card.dataset.wheelId = wheel.id;

      var cardHeader = document.createElement('div');
      cardHeader.className = 'wheel-card-header';
      var title = document.createElement('h3');
      title.textContent = wheel.name;
      var spinButton = document.createElement('button');
      spinButton.className = 'spin-button';
      spinButton.type = 'button';
      spinButton.textContent = '↻ Spin';
      spinButton.disabled = !wheelReady(wheel) || state.isSpinning;
      spinButton.addEventListener('click', function () { spinWheel(index); });
      cardHeader.append(title, spinButton);

      var garden = document.createElement('div');
      garden.className = 'sunflower-garden';
      garden.append(createLeaves());

      if (wheelReady(wheel)) {
        garden.append(createSunflower(wheel, parsed.items));
      } else {
        var placeholder = document.createElement('div');
        placeholder.className = 'wheel-placeholder';
        placeholder.innerHTML = '<span aria-hidden="true">🌱</span><strong>Add ' + MIN_ITEMS + ' lines to grow this sunflower.</strong><small>Each line becomes one petal.</small>';
        garden.append(placeholder);
      }

      var result = document.createElement('div');
      result.className = 'result' + (wheel.winner ? ' has-winner' : '');
      result.setAttribute('aria-live', 'polite');
      if (wheel.winner) {
        var resultLabel = document.createElement('span');
        resultLabel.textContent = 'Selected';
        var resultText = document.createElement('strong');
        resultText.textContent = wheel.winner;
        result.append(resultLabel, resultText);
      } else {
        result.textContent = wheelReady(wheel) ? 'Spin to choose a petal.' : 'Waiting for enough petals.';
      }

      card.append(cardHeader, garden, result);
      els.wheelStage.append(card);
    });
  }

  function createLeaves() {
    var leaves = document.createElement('div');
    leaves.className = 'leaves';
    leaves.setAttribute('aria-hidden', 'true');
    return leaves;
  }

  function createSunflower(wheel, items) {
    var spinner = document.createElement('div');
    spinner.className = 'sunflower-spinner';

    var pointer = document.createElement('div');
    pointer.className = 'pointer';
    pointer.setAttribute('aria-hidden', 'true');

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 400 400');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', wheel.name + ' sunflower with ' + items.length + ' petals');
    svg.classList.add('sunflower-wheel');
    svg.style.setProperty('--rotation', wheel.rotation + 'deg');

    var flower = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    flower.setAttribute('transform', 'translate(200 200)');
    var step = 360 / items.length;

    items.forEach(function (item, index) {
      var angle = index * step;
      var petal = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      petal.setAttribute('transform', 'rotate(' + angle + ')');

      var shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shape.setAttribute('d', petalPath(items.length));
      shape.setAttribute('fill', PETAL_COLORS[index % PETAL_COLORS.length]);
      shape.setAttribute('stroke', '#e0a72e');
      shape.setAttribute('stroke-width', '2');
      petal.append(shape);

      var labelLayout = wrapPetalText(item, items.length);
      var labelFontSize = fontSizeFor(item, items.length, labelLayout.lines.length);
      var lineHeight = labelFontSize * 1.12;
      var labelOffset = -((labelLayout.lines.length - 1) * lineHeight) / 2;
      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '0');
      text.setAttribute('y', '-113');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      // Counter-rotate the glyphs around their own petal position. This
      // keeps every line in its matching petal while keeping text upright.
      text.setAttribute('transform', 'rotate(' + (-angle) + ' 0 -113)');
      text.setAttribute('font-size', labelFontSize);
      text.setAttribute('fill', '#193d38');
      text.setAttribute('font-weight', '800');
      text.setAttribute('class', 'petal-text');
      labelLayout.lines.forEach(function (line, lineIndex) {
        var tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', '0');
        tspan.setAttribute('dy', lineIndex === 0 ? labelOffset : lineHeight);
        tspan.textContent = line;
        text.append(tspan);
      });
      petal.append(text);
      flower.append(petal);
    });

    var innerRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    innerRing.setAttribute('r', '55');
    innerRing.setAttribute('fill', '#78451e');
    innerRing.setAttribute('stroke', '#5e3517');
    innerRing.setAttribute('stroke-width', '4');
    flower.append(innerRing);

    var seedRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    seedRing.setAttribute('r', '39');
    seedRing.setAttribute('fill', 'url(#seedPattern)');
    flower.append(seedRing);

    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    var pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', 'seedPattern');
    pattern.setAttribute('width', '9');
    pattern.setAttribute('height', '9');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    var seed = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    seed.setAttribute('cx', '4.5');
    seed.setAttribute('cy', '4.5');
    seed.setAttribute('r', '2.3');
    seed.setAttribute('fill', '#c7892d');
    pattern.append(seed);
    defs.append(pattern);
    svg.append(defs, flower);
    spinner.append(pointer, svg);
    return spinner;
  }

  function petalPath(count) {
    var width = count <= 2 ? 88 : count <= 3 ? 76 : count <= 5 ? 63 : count > 12 ? 34 : count > 9 ? 42 : 51;
    return 'M 0 -38 C ' + width + ' -70 ' + width + ' -146 0 -184 C ' + (-width) + ' -146 ' + (-width) + ' -70 0 -38 Z';
  }

  function fontSizeFor(item, count, lineCount) {
    var base = count > 12 ? 10 : count > 9 ? 12 : count > 7 ? 14 : count > 5 ? 16 : 18;
    return Math.max(6.5, base - Math.max(0, lineCount - 2) * 1.1);
  }

  function wrapPetalText(item, count) {
    var capacity = count > 12 ? 5.5 : count > 9 ? 6.5 : count > 7 ? 7.5 : count > 5 ? 9.5 : 12.5;
    var words = item.trim().split(/\s+/).filter(Boolean);
    var lines = [];
    var current = '';
    var currentUnits = 0;

    function characterUnits(character) {
      return /^[\x00-\xff]$/.test(character) ? (character === ' ' ? 0.28 : 0.58) : 1;
    }

    function units(text) {
      return Array.from(text).reduce(function (total, character) { return total + characterUnits(character); }, 0);
    }

    function pushCurrent() {
      if (current) lines.push(current);
      current = '';
      currentUnits = 0;
    }

    function addCharacters(text, includeLeadingSpace) {
      Array.from((includeLeadingSpace && current ? ' ' : '') + text).forEach(function (character) {
        var characterWidth = characterUnits(character);
        if (current && currentUnits + characterWidth > capacity) pushCurrent();
        if (character === ' ' && !current) return;
        current += character;
        currentUnits += characterWidth;
      });
    }

    if (words.length > 1) {
      words.forEach(function (word) {
        var wordWidth = units(word);
        var gap = current ? characterUnits(' ') : 0;
        if (current && currentUnits + gap + wordWidth > capacity) pushCurrent();
        addCharacters(word, Boolean(current));
      });
    } else {
      addCharacters(item.trim(), false);
    }
    pushCurrent();
    return { lines: lines.length ? lines : [''] };
  }

  function updateControls() {
    var count = state.wheels.length;
    els.wheelCount.textContent = count + ' wheel' + (count === 1 ? '' : 's');
    els.addWheelButton.disabled = count >= MAX_WHEELS || state.isSpinning;
    els.removeWheelButton.disabled = count <= 1 || state.isSpinning;
    els.spinAllButton.disabled = state.isSpinning || !state.wheels.some(wheelReady);
    els.wheelLimitMessage.textContent = count >= MAX_WHEELS
      ? 'You have reached the 4-wheel classroom limit.'
      : 'You can add up to ' + MAX_WHEELS + ' wheels.';
  }

  function addWheel() {
    if (state.wheels.length >= MAX_WHEELS) {
      showToast('A maximum of ' + MAX_WHEELS + ' wheels keeps the classroom view clear.');
      return;
    }
    state.wheels.push(createWheel(state.wheels.length + 1));
    render();
    var lastInput = els.wheelEditors.querySelectorAll('textarea');
    if (lastInput.length) lastInput[lastInput.length - 1].focus();
  }

  function removeWheel() {
    if (state.wheels.length <= 1) {
      showToast('Keep at least one sunflower wheel.');
      return;
    }
    state.wheels.pop();
    render();
  }

  function spinAllWheels() {
    if (state.isSpinning) return;
    var readyIndexes = state.wheels.map(function (wheel, index) { return wheelReady(wheel) ? index : -1; }).filter(function (index) { return index !== -1; });
    if (!readyIndexes.length) {
      showToast('Add at least ' + MIN_ITEMS + ' lines before spinning.');
      return;
    }
    startSpins(readyIndexes, true);
  }

  function spinWheel(index) {
    if (state.isSpinning) return;
    var wheel = state.wheels[index];
    var items = parseItems(wheel.text).items;
    if (items.length < MIN_ITEMS) {
      showToast('Add at least ' + MIN_ITEMS + ' lines before spinning.');
      return;
    }
    startSpins([index], false);
  }

  function startSpins(indexes, spinningAll) {
    state.isSpinning = true;
    var spins = indexes.map(function (index) {
      var wheel = state.wheels[index];
      var items = parseItems(wheel.text).items;
      var winnerIndex = Math.floor(Math.random() * items.length);
      var step = 360 / items.length;
      var pointerOffset = (Math.random() - 0.5) * step * 0.34;
      var target = Math.ceil((wheel.rotation + 1080) / 360) * 360 - winnerIndex * step + pointerOffset;
      while (target <= wheel.rotation + 960) target += 360;
      wheel.rotation = target;
      wheel.winner = '';
      return { index: index, target: target, winner: items[winnerIndex], winnerIndex: winnerIndex };
    });

    setStageSpinning(true);
    updateControls();

    window.requestAnimationFrame(function () {
      spins.forEach(function (spin) {
        var wheelElement = els.wheelStage.querySelector('[data-wheel-id="' + state.wheels[spin.index].id + '"] .sunflower-wheel');
        if (wheelElement) wheelElement.style.setProperty('--rotation', spin.target + 'deg');
      });
    });

    window.setTimeout(function () {
      spins.forEach(function (spin) {
        state.wheels[spin.index].winner = spin.winner;
      });
      state.isSpinning = false;
      renderStage();
      updateControls();
      queuePetalDecisions(spins);
    }, 4550);
  }

  function setStageSpinning(isSpinning) {
    els.wheelStage.querySelectorAll('.spin-button').forEach(function (button) {
      button.disabled = isSpinning || button.disabled;
    });
    if (isSpinning) {
      els.wheelStage.querySelectorAll('.result').forEach(function (result) {
        result.classList.remove('has-winner');
        result.textContent = 'The sunflower is spinning…';
      });
    }
  }

  function queuePetalDecisions(spins) {
    state.decisionQueue = spins.map(function (spin) {
      return { wheelId: state.wheels[spin.index].id, item: spin.winner, itemIndex: spin.winnerIndex };
    });
    showNextPetalDecision();
  }

  function showNextPetalDecision() {
    state.pendingDecision = state.decisionQueue.shift() || null;
    if (!state.pendingDecision) {
      closePetalDecision();
      return;
    }

    var wheel = state.wheels.find(function (candidate) { return candidate.id === state.pendingDecision.wheelId; });
    if (!wheel) {
      showNextPetalDecision();
      return;
    }

    var remainingCount = parseItems(wheel.text).items.length;
    els.petalDecisionMessage.textContent = '“' + state.pendingDecision.item + '” was selected from ' + wheel.name + '.';
    els.removePetalButton.disabled = remainingCount <= MIN_ITEMS;
    els.petalDecisionNote.textContent = remainingCount <= MIN_ITEMS
      ? 'Keep this petal: each sunflower needs at least ' + MIN_ITEMS + ' petals.'
      : 'Keep it for another spin, or remove it before the next round.';
    els.petalDecisionModal.hidden = false;
    document.body.classList.add('decision-open');
    window.setTimeout(function () { els.keepPetalButton.focus(); }, 0);
  }

  function closePetalDecision() {
    els.petalDecisionModal.hidden = true;
    document.body.classList.remove('decision-open');
  }

  function keepSelectedPetal() {
    if (state.pendingDecision) showToast('Petal kept for the next spin.');
    showNextPetalDecision();
  }

  function removeSelectedPetal() {
    var pending = state.pendingDecision;
    if (!pending) return;
    var wheel = state.wheels.find(function (candidate) { return candidate.id === pending.wheelId; });
    if (!wheel || parseItems(wheel.text).items.length <= MIN_ITEMS) {
      showToast('Each sunflower needs at least ' + MIN_ITEMS + ' petals.');
      return;
    }

    var itemPosition = -1;
    var updatedLines = wheel.text.split(/\r?\n/).filter(function (line) {
      if (!line.trim()) return true;
      itemPosition += 1;
      return itemPosition !== pending.itemIndex;
    });
    wheel.text = updatedLines.join('\n');
    wheel.winner = '';
    render();
    showToast('The selected petal has been removed.');
    showNextPetalDecision();
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { els.toast.classList.remove('show'); }, 3000);
  }
})();
