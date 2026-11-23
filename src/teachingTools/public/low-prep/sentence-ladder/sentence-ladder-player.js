/*
 * 扩句阶梯 · student link (/play/:id). Students fill each row's new blanks;
 * their answers carry into the following rows, then they hand the work in.
 */
(function () {
  'use strict';

  var Core = window.SentenceLadder;
  var View = window.SentenceLadderView;
  var esc = View.esc;
  var game = window.__SHARED_GAME__;
  var m = Core.normalize(game.data);
  var count = Core.rowCount(m);
  var slots = Core.answerSlots(m);
  var choices = Core.LEVELS[m.level].bank === 'choices';
  var draftKey = 'sentence-ladder:student:' + game.shareId;
  var state = { name: '', answers: {}, submitted: false, result: null };
  var app = document.getElementById('slsApp');
  var py = [];

  try {
    var draft = JSON.parse(localStorage.getItem(draftKey));
    if (draft) {
      state.name = typeof draft.name === 'string' ? draft.name : '';
      state.answers = draft.answers && typeof draft.answers === 'object' ? draft.answers : {};
      state.submitted = Boolean(draft.submitted);
      state.result = draft.result || null;
    }
  } catch (error) { /* no saved work */ }

  function saveDraft() {
    try { localStorage.setItem(draftKey, JSON.stringify(state)); } catch (error) { /* private window */ }
  }

  function answerOf(index) {
    return typeof state.answers[index] === 'string' ? state.answers[index] : '';
  }

  // One live blank in its own row: a text box, or a slot filled from the word box.
  function liveBlank(part) {
    var seg = part.seg;
    var width = View.blankWidth(seg, part.seg.row === count - 1);
    var value = answerOf(part.index);
    if (choices) {
      var mark = '';
      if (state.result && state.result.correct) mark = state.result.correct[part.index] ? ' is-right' : ' is-wrong';
      return '<span class="sls-slot' + mark + '" data-slot="' + part.index + '" style="min-width:' + width + 'em">' + esc(View.display(m, value)) + '</span>';
    }
    return '<input class="sls-input" data-index="' + part.index + '" value="' + esc(value) + '" maxlength="80" style="width:' + width + 'em"' +
      (state.submitted ? ' disabled' : '') + ' autocomplete="off" spellcheck="false" aria-label="第 ' + (part.seg.row + 1) + ' 行的空">';
  }

  function rowLine(k) {
    var answers = {};
    slots.forEach(function (index) { if (answerOf(index)) answers[index] = answerOf(index); });
    return View.rowHtml(m, k, { mode: 'student', answers: answers, py: py, input: liveBlank });
  }

  function rowDone(k) {
    var own = Core.rowParts(m, k).filter(function (part) { return part.isNew && part.seg.blank > 0; });
    return own.length > 0 && own.every(function (part) { return answerOf(part.index).trim(); });
  }

  function choicesHtml(k) {
    var groups = Core.wordBox(m, k);
    if (!groups.length) return '';
    var marks = ['①', '②', '③', '④', '⑤', '⑥'];
    return '<div class="sls-choices">' + groups.map(function (group, n) {
      return (groups.length > 1 ? '<b>' + marks[n % marks.length] + '</b>' : '') + group.words.map(function (word) {
        var picked = answerOf(group.index) === word;
        return '<button type="button" class="sls-choice' + (picked ? ' is-picked' : '') + '" data-pick="' + group.index + '" data-word="' + esc(word) + '"' +
          (state.submitted ? ' disabled' : '') + '>' + esc(View.display(m, word)) + '</button>';
      }).join('');
    }).join('<span></span>') + '</div>';
  }

  function rowHtml(k) {
    var extra = '';
    if (choices) extra = choicesHtml(k);
    else if (Core.LEVELS[m.level].bank === 'answers') extra = '<div class="sls-wordbox">' + View.wordBoxHtml(m, k) + '</div>';
    if (state.submitted) extra += '<div class="sls-model sl-line"><b>示范</b>' + View.rowHtml(m, k, { mode: 'key', py: py, showPy: false }) + '</div>';
    return '<div class="sl-label">' + View.ruby(View.display(m, m.rows[k].label), View.syllables(m.rows[k].label), m.showPy) + '</div>' +
      '<div class="sl-text"><div class="sl-line">' + rowLine(k) + '</div>' + extra + '</div>';
  }

  function renderRow(k) {
    var row = app.querySelector('[data-row="' + k + '"]');
    if (!row) return;
    row.innerHTML = rowHtml(k);
    row.classList.toggle('is-done', rowDone(k));
  }

  function renderLaterRows(k) {
    for (var r = k + 1; r < count; r += 1) renderRow(r);
    var row = app.querySelector('[data-row="' + k + '"]');
    if (row) row.classList.toggle('is-done', rowDone(k));
  }

  function render() {
    py = View.segmentPinyin(m);
    var help = choices
      ? '每一行点一点词语框里的词，把句子补完整。上面填好的词，下面一行会接着用。'
      : '每一行填上新的内容，把句子越写越长。上面写好的，下面一行会接着用。';
    var rows = '';
    for (var k = 0; k < count; k += 1) {
      rows += '<div class="sls-row' + (rowDone(k) ? ' is-done' : '') + '" data-row="' + k + '" style="--sl-row:' + Core.COLORS[k % Core.COLORS.length] + '">' + rowHtml(k) + '</div>';
    }
    app.innerHTML =
      '<div class="sls-card"><div class="sls-head">' +
        '<div class="sl-title-card"><span class="sl-kind">' + esc(View.kindLabel(m)) + '</span>' + View.topicHtml(m) + '</div>' +
        View.sceneHtml(m) + '</div>' +
        '<label class="sls-name">名字 Name <input id="slsName" class="sl-input" maxlength="80" value="' + esc(state.name) + '"' + (state.submitted ? ' disabled' : '') + '></label>' +
      '</div>' +
      '<div class="sls-card"><p class="sls-help">' + esc(View.display(m, help)) + '</p>' +
        '<div class="sls-rows' + (m.showPy ? '' : ' no-py') + '">' + rows + '</div>' +
        '<div class="sls-submit">' +
          (state.submitted ? '' : '<button id="slsSubmit" type="button" class="sl-btn sl-btn-primary">📤 交给老师 Submit</button>') +
          '<span id="slsMessage" class="sls-message" role="status"></span>' +
        '</div>' +
      '</div>' +
      (state.submitted ? finalCard() : '');
    wire();
    if (state.submitted) {
      var score = state.result && typeof state.result.score === 'number' ? '　答对 ' + state.result.score + ' / ' + state.result.total : '';
      message('✓ 已经交给老师了。 Handed in.' + score, 'ok');
    }
  }

  function finalCard() {
    var answers = {};
    slots.forEach(function (index) { answers[index] = answerOf(index); });
    return '<div class="sls-card"><p class="sls-help">我的句子 · My sentence</p><div class="sls-final">' +
      esc(View.display(m, withStop(Core.fullText({ segs: m.segs.filter(function (seg) { return seg.row < count; }) }, remap(answers))))) + '</div></div>';
  }

  function withStop(text) {
    return /[。！？!?…”」』]$/.test(text.trim()) ? text : text.replace(/[，,、\s]+$/, '') + '。';
  }

  // fullText indexes answers by position in the list it gets; keep the original indexes.
  function remap(answers) {
    var out = {};
    var n = 0;
    m.segs.forEach(function (seg, index) {
      if (seg.row >= count) return;
      if (seg.blank > 0) out[n] = answers[index] || '＿＿';
      n += 1;
    });
    return out;
  }

  function message(text, kind) {
    var node = document.getElementById('slsMessage');
    if (!node) return;
    node.textContent = text || '';
    node.className = 'sls-message' + (kind ? ' is-' + kind : '');
  }

  function wire() {
    var name = document.getElementById('slsName');
    if (name) name.addEventListener('input', function () { state.name = name.value; saveDraft(); });
    app.addEventListener('input', onInput);
    app.addEventListener('click', onClick);
    var submit = document.getElementById('slsSubmit');
    if (submit) submit.addEventListener('click', send);
  }

  function onInput(event) {
    var input = event.target.closest('.sls-input');
    if (!input || state.submitted) return;
    var index = Number(input.dataset.index);
    state.answers[index] = input.value;
    saveDraft();
    renderLaterRows(m.segs[index].row);
  }

  function onClick(event) {
    var choice = event.target.closest('.sls-choice');
    if (!choice || state.submitted) return;
    var index = Number(choice.dataset.pick);
    state.answers[index] = choice.dataset.word;
    saveDraft();
    var k = m.segs[index].row;
    renderRow(k);
    renderLaterRows(k);
  }

  function send() {
    var button = document.getElementById('slsSubmit');
    state.name = (document.getElementById('slsName').value || '').trim();
    if (!state.name) { message('请先写上名字。 Please type your name.', 'error'); document.getElementById('slsName').focus(); return; }
    var missing = slots.filter(function (index) { return !answerOf(index).trim(); }).length;
    if (missing && !window.confirm('还有 ' + missing + ' 个空没有填。确定交给老师吗？\n' + missing + ' blank(s) are empty. Hand in anyway?')) return;
    button.disabled = true;
    message('正在提交…… Sending…');
    var answers = {};
    slots.forEach(function (index) { answers[index] = answerOf(index).trim(); });
    fetch('/play/' + encodeURIComponent(game.shareId) + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: state.name, work: { answers: answers } })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (response.status === 409 && body.submission) {
          state.answers = body.submission.answers || state.answers;
          finish(body.submission);
          message('这个名字已经交过了，下面是交过的作业。 This name has already handed in.', 'error');
          return;
        }
        if (!response.ok) throw new Error(body.error || '提交失败，请再试一次。 Could not send. Please try again.');
        finish(body.submission);
      });
    }).catch(function (error) {
      button.disabled = false;
      message(error.message, 'error');
    });
  }

  function finish(submission) {
    state.submitted = true;
    state.result = submission && submission.correct ? { correct: submission.correct, score: submission.score, total: submission.total } : null;
    saveDraft();
    app.removeEventListener('input', onInput);
    app.removeEventListener('click', onClick);
    render();
  }

  render();
  var ready = [];
  if (m.script === 't') ready.push(View.loadTable().catch(function () {}));
  if (document.fonts && document.fonts.ready) ready.push(document.fonts.ready);
  if (ready.length) Promise.all(ready).then(function () {
    app.removeEventListener('input', onInput);
    app.removeEventListener('click', onClick);
    render();
  });
})();
