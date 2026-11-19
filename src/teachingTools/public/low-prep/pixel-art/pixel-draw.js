/* 像素画猜猜看 · student drawing page. Used by
 *   /teaching-tools/pixel-art/draw#c=…   (free: the student downloads a PNG)
 *   /play/:id                            (members' link: the student submits)
 * PixelArtDraw.mount(root, config, { shareId }) builds the whole page. */
(function (global) {
  'use strict';

  var Core = global.PixelArtCore;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function hash(text) {
    var h = 0;
    for (var i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function mount(root, config, options) {
    options = options || {};
    config = Core.cleanConfig(config);
    var grid = config.grid;
    var shareId = options.shareId || '';
    var draftKey = 'pixel-art-draft:' + (shareId || hash(JSON.stringify(config)));
    var state = { name: '', word: '', pixels: Core.emptyPixels(grid), sentences: [], color: 1, tool: 'pen', submitted: false };
    var undo = [];

    try {
      var draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (draft && Core.validPixels(draft.pixels, grid)) {
        state.name = String(draft.name || '');
        state.word = config.words.some(function (w) { return w.zh === draft.word; }) ? draft.word : '';
        state.pixels = draft.pixels;
        state.sentences = Array.isArray(draft.sentences) ? draft.sentences : [];
        state.submitted = Boolean(draft.submitted);
      }
    } catch (error) { /* no saved draft */ }

    function saveDraft() {
      try { localStorage.setItem(draftKey, JSON.stringify({ name: state.name, word: state.word, pixels: state.pixels, sentences: state.sentences, submitted: state.submitted })); }
      catch (error) { /* private window: drafts just aren't kept */ }
    }

    root.replaceChildren();
    root.classList.add('pxd');

    var header = el('header', 'pxd-header');
    header.appendChild(el('p', 'pxd-eyebrow', '像素画 · Pixel Art'));
    header.appendChild(el('h1', '', config.title));
    header.appendChild(el('p', 'pxd-lead', '选一个词，把它画成像素画，再写几句话。同学们会来猜你画的是什么！ Pick a word, draw it, and write about it. Your classmates will guess what you drew!'));
    root.appendChild(header);

    // 1 — name
    var nameStep = step('1', '写名字', 'Your name');
    var nameInput = el('input', 'pxd-input');
    nameInput.maxLength = 40;
    nameInput.autocomplete = 'off';
    nameInput.placeholder = '名字 Name';
    nameInput.value = state.name;
    nameInput.addEventListener('input', function () { state.name = nameInput.value; saveDraft(); });
    nameStep.body.appendChild(nameInput);

    // 2 — word
    var wordStep = step('2', '选一个词', 'Pick ONE word to draw — keep it a secret!');
    var picked = el('p', 'pxd-picked');
    var chips = [];
    var groups = [];
    config.words.forEach(function (word) {
      var group = groups[groups.length - 1];
      if (!group || group.name !== word.group) { group = { name: word.group, words: [] }; groups.push(group); }
      group.words.push(word);
    });
    groups.forEach(function (group) {
      if (group.name) wordStep.body.appendChild(el('h3', 'pxd-group', group.name));
      var row = el('div', 'pxd-chips');
      group.words.forEach(function (word) {
        var chip = el('button', 'pxd-chip');
        chip.type = 'button';
        chip.appendChild(el('strong', 'px-kai', word.zh));
        if (word.py && config.show.py) chip.appendChild(el('span', 'pxd-py', word.py));
        if (word.en && config.show.en) chip.appendChild(el('span', 'pxd-en', word.en));
        chip.addEventListener('click', function () { state.word = word.zh; saveDraft(); renderWord(); });
        chip.dataset.word = word.zh;
        chips.push(chip);
        row.appendChild(chip);
      });
      wordStep.body.appendChild(row);
    });
    wordStep.body.appendChild(picked);
    function renderWord() {
      chips.forEach(function (chip) { chip.classList.toggle('is-picked', chip.dataset.word === state.word); chip.setAttribute('aria-pressed', String(chip.dataset.word === state.word)); });
      picked.textContent = state.word ? '我画的是：' + state.word : '还没选词 · No word picked yet';
    }

    // 3 — draw
    var drawStep = step('3', '画一画', 'Color the squares. Use 3 or more colors!');
    var tools = el('div', 'pxd-tools');
    var toolButtons = {};
    [['pen', '✏️ 画笔', 'Pen'], ['eraser', '🧽 橡皮', 'Eraser'], ['fill', '🪣 填充', 'Fill']].forEach(function (entry) {
      var button = el('button', 'pxd-tool', entry[1]);
      button.type = 'button';
      button.title = entry[2];
      button.addEventListener('click', function () { state.tool = entry[0]; renderTools(); });
      toolButtons[entry[0]] = button;
      tools.appendChild(button);
    });
    var undoButton = el('button', 'pxd-tool', '↶ 撤销');
    undoButton.type = 'button';
    undoButton.title = 'Undo';
    undoButton.addEventListener('click', function () {
      if (!undo.length) return;
      state.pixels = undo.pop();
      paint(); saveDraft();
    });
    var clearButton = el('button', 'pxd-tool', '🗑️ 清空');
    clearButton.type = 'button';
    clearButton.title = 'Clear';
    clearButton.addEventListener('click', function () {
      if (!/[1-9a-f]/.test(state.pixels) || !global.confirm('清空整幅画？ Clear the whole picture?')) return;
      undo.push(state.pixels);
      state.pixels = Core.emptyPixels(grid);
      paint(); saveDraft();
    });
    tools.append(undoButton, clearButton);
    drawStep.body.appendChild(tools);

    var palette = el('div', 'pxd-palette');
    var swatches = [];
    Core.PALETTE.forEach(function (color, index) {
      if (!color) return;
      var swatch = el('button', 'pxd-swatch');
      swatch.type = 'button';
      swatch.style.background = color.hex;
      swatch.title = color.zh + ' ' + color.en;
      swatch.setAttribute('aria-label', color.zh + ' ' + color.en);
      swatch.addEventListener('click', function () { state.color = index; if (state.tool === 'eraser') state.tool = 'pen'; renderTools(); });
      swatch.dataset.index = String(index);
      swatches.push(swatch);
      palette.appendChild(swatch);
    });
    drawStep.body.appendChild(palette);

    var colorName = el('p', 'pxd-color-name');
    drawStep.body.appendChild(colorName);

    var canvasWrap = el('div', 'pxd-canvas-wrap');
    var canvas = el('canvas', 'pxd-canvas');
    canvas.setAttribute('aria-label', 'Drawing grid ' + grid + ' × ' + grid);
    canvasWrap.appendChild(canvas);
    drawStep.body.appendChild(canvasWrap);

    function renderTools() {
      Object.keys(toolButtons).forEach(function (key) { toolButtons[key].classList.toggle('is-active', key === state.tool); });
      swatches.forEach(function (swatch) { swatch.classList.toggle('is-active', state.tool !== 'eraser' && Number(swatch.dataset.index) === state.color); });
      var color = Core.PALETTE[state.color];
      colorName.textContent = state.tool === 'eraser' ? '橡皮 Eraser' : (state.tool === 'fill' ? '填充 Fill: ' : '颜色 Color: ') + color.zh + ' ' + color.en;
    }

    function paint() {
      var cell = Math.floor(528 / grid);
      Core.drawArt(canvas, state.pixels, grid, cell * grid, { gridLines: true });
    }

    function setPixel(index, value) {
      if (state.pixels.charAt(index) === value) return false;
      state.pixels = state.pixels.slice(0, index) + value + state.pixels.slice(index + 1);
      return true;
    }

    function fill(index, value) {
      var target = state.pixels.charAt(index);
      if (target === value) return;
      var cells = state.pixels.split('');
      var stack = [index];
      while (stack.length) {
        var at = stack.pop();
        if (cells[at] !== target) continue;
        cells[at] = value;
        var x = at % grid; var y = Math.floor(at / grid);
        if (x > 0) stack.push(at - 1);
        if (x < grid - 1) stack.push(at + 1);
        if (y > 0) stack.push(at - grid);
        if (y < grid - 1) stack.push(at + grid);
      }
      state.pixels = cells.join('');
    }

    function cellFromEvent(event) {
      var rect = canvas.getBoundingClientRect();
      var x = Math.floor((event.clientX - rect.left) / rect.width * grid);
      var y = Math.floor((event.clientY - rect.top) / rect.height * grid);
      if (x < 0 || y < 0 || x >= grid || y >= grid) return -1;
      return y * grid + x;
    }

    var drawing = false;
    var lastCell = -1;
    // Fast strokes skip squares between pointer events, so join them with a line.
    function lineCells(from, to) {
      var x0 = from % grid; var y0 = Math.floor(from / grid);
      var x1 = to % grid; var y1 = Math.floor(to / grid);
      var steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      var cells = [];
      for (var s = 1; s <= steps; s += 1) {
        cells.push(Math.round(y0 + (y1 - y0) * s / steps) * grid + Math.round(x0 + (x1 - x0) * s / steps));
      }
      return cells;
    }
    function apply(event) {
      var index = cellFromEvent(event);
      if (index < 0) return;
      var value = state.tool === 'eraser' ? '0' : state.color.toString(16);
      if (state.tool === 'fill') { fill(index, value); paint(); return; }
      var cells = lastCell >= 0 ? lineCells(lastCell, index) : [index];
      lastCell = index;
      var changed = false;
      cells.forEach(function (cell) { if (setPixel(cell, value)) changed = true; });
      if (changed) paint();
    }
    canvas.addEventListener('pointerdown', function (event) {
      if (state.submitted) return;
      event.preventDefault();
      undo.push(state.pixels);
      if (undo.length > 60) undo.shift();
      drawing = state.tool !== 'fill';
      lastCell = -1;
      if (drawing) canvas.setPointerCapture(event.pointerId);
      apply(event);
      if (!drawing) saveDraft();
    });
    canvas.addEventListener('pointermove', function (event) { if (drawing) apply(event); });
    function stop() { lastCell = -1; if (drawing) { drawing = false; saveDraft(); } }
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);

    // 4 — sentences
    var sentenceInputs = [];
    if (config.prompts.length) {
      var writeStep = step('4', '写一写', 'Finish the sentences.');
      config.prompts.forEach(function (prompt, promptIndex) {
        var line = el('p', 'pxd-sentence');
        line.appendChild(el('span', 'pxd-sentence-no', (promptIndex + 1) + '.'));
        var parts = Core.promptParts(prompt);
        var inputs = [];
        var saved = String(state.sentences[promptIndex] || '');
        var savedBlanks = savedBlanksFor(parts, saved);
        parts.forEach(function (part, partIndex) {
          if (part) line.appendChild(el('span', '', part));
          if (partIndex < parts.length - 1) {
            var input = el('input', 'pxd-blank');
            input.maxLength = 40;
            input.autocomplete = 'off';
            input.value = savedBlanks[partIndex] || '';
            input.addEventListener('input', function () { state.sentences = readSentences(); saveDraft(); });
            inputs.push(input);
            line.appendChild(input);
          }
        });
        sentenceInputs.push({ parts: parts, inputs: inputs });
        writeStep.body.appendChild(line);
      });
    }

    // Recover the blanks of a saved sentence so a reload keeps them.
    function savedBlanksFor(parts, sentence) {
      var blanks = [];
      var rest = sentence;
      if (!rest || rest.indexOf(parts[0]) !== 0) return blanks;
      rest = rest.slice(parts[0].length);
      for (var i = 1; i < parts.length; i += 1) {
        var at = parts[i] ? rest.indexOf(parts[i]) : rest.length;
        if (at < 0) return blanks;
        blanks.push(rest.slice(0, at));
        rest = rest.slice(at + parts[i].length);
      }
      return blanks;
    }

    function readSentences() {
      return sentenceInputs.map(function (entry) {
        if (!entry.inputs.some(function (input) { return input.value.trim(); })) return '';
        return entry.parts.map(function (part, index) { return part + (entry.inputs[index] ? entry.inputs[index].value.trim() : ''); }).join('');
      });
    }

    // Finish
    var finish = el('section', 'pxd-finish');
    var status = el('p', 'pxd-status');
    status.setAttribute('role', 'status');
    var actions = el('div', 'pxd-actions');
    var submitButton = null;
    if (shareId) {
      submitButton = el('button', 'pxd-btn pxd-btn-primary', '📤 交给老师 Submit');
      submitButton.type = 'button';
      submitButton.addEventListener('click', submit);
      actions.appendChild(submitButton);
    }
    var downloadButton = el('button', 'pxd-btn' + (shareId ? '' : ' pxd-btn-primary'), shareId ? '💾 下载图片 Save picture' : '💾 下载图片 Download picture');
    downloadButton.type = 'button';
    downloadButton.addEventListener('click', download);
    actions.appendChild(downloadButton);
    finish.appendChild(actions);
    if (!shareId) finish.appendChild(el('p', 'pxd-note', '下载以后，把这个图片文件直接发给老师（不要截图）。 After downloading, send this picture file to your teacher — please don\'t take a screenshot.'));
    finish.appendChild(status);
    root.appendChild(finish);

    function check() {
      state.name = nameInput.value.trim();
      state.sentences = readSentences();
      if (!state.name) { nameInput.focus(); return '请先写名字。 Please write your name.'; }
      if (!state.word) return '请先选一个词。 Please pick a word.';
      if (!/[1-9a-f]/.test(state.pixels)) return '请先画一画。 Please draw your picture first.';
      return '';
    }

    function show(message, kind) {
      status.textContent = message;
      status.className = 'pxd-status' + (kind ? ' is-' + kind : '');
    }

    function download() {
      var problem = check();
      if (problem) return show(problem, 'error');
      Core.workPngBlob({ studentName: state.name, word: state.word, pixels: state.pixels, sentences: state.sentences }, config).then(function (blob) {
        Core.downloadBlob(blob, Core.safeFilename(state.name) + '-像素画.png');
        if (!shareId) show('✓ 下载好了！把图片发给老师吧。 Downloaded! Now send the picture to your teacher.', 'ok');
      }).catch(function () { show('下载失败，请再试一次。 Could not download. Please try again.', 'error'); });
    }

    function submit() {
      var problem = check();
      if (problem) return show(problem, 'error');
      submitButton.disabled = true;
      show('正在提交… Submitting…');
      fetch('/play/' + encodeURIComponent(shareId) + '/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName: state.name, work: { word: state.word, pixels: state.pixels, sentences: state.sentences } })
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) { return { response: response, body: body }; });
      }).then(function (result) {
        if (result.response.status === 201) {
          state.submitted = true;
          saveDraft();
          return lock();
        }
        submitButton.disabled = false;
        if (result.response.status === 401) return show('请重新打开链接并输入密码。 Please reopen the link and enter the password.', 'error');
        if (result.response.status === 409) return show('这个名字已经交过了。如果要改，请告诉老师。 This name has already submitted. Ask your teacher if you need to change it.', 'error');
        show((result.body && result.body.error) || '提交失败，请再试一次。 Could not submit. Please try again.', 'error');
      }).catch(function () {
        submitButton.disabled = false;
        show('网络有问题，请再试一次。 Network problem. Please try again.', 'error');
      });
    }

    function lock() {
      root.classList.add('is-submitted');
      nameInput.disabled = true;
      chips.forEach(function (chip) { chip.disabled = true; });
      sentenceInputs.forEach(function (entry) { entry.inputs.forEach(function (input) { input.disabled = true; }); });
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = '✓ 已交给老师 Submitted'; }
      show('✓ 交好了！等老师投屏，看看同学们能不能猜出来。 Submitted! Wait for your teacher to show the pictures.', 'ok');
    }

    function step(number, zh, en) {
      var section = el('section', 'pxd-step');
      var heading = el('h2', 'pxd-step-title');
      heading.appendChild(el('span', 'pxd-step-no', number));
      heading.appendChild(document.createTextNode(zh + ' '));
      heading.appendChild(el('small', '', en));
      section.appendChild(heading);
      var body = el('div', 'pxd-step-body');
      section.appendChild(body);
      root.appendChild(section);
      return { section: section, body: body };
    }

    renderWord();
    renderTools();
    paint();
    if (state.submitted && shareId) lock();
  }

  global.PixelArtDraw = { mount: mount };
})(window);
