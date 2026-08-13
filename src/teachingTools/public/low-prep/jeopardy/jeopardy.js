var CW = window.ChenWordlist || null;
var DE = window.DeckExport || null;
var PRE = 'cljp:';
var presetQuestionBanks = [];
var selectedPresetBankIds = [];
var PRESET_BANK_ICONS = {
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

function blankGame(cats, rows, base, step) {
  cats = cats || 5; rows = rows || 5; base = base || 100; step = step || 100;
  var g = { id: null, name: '', rows: rows, base: base, step: step, seconds: 20, categories: [], teams: [] };
  for (var c = 0; c < cats; c++) {
    var cat = { name: '', clues: [] };
    for (var r = 0; r < rows; r++) cat.clues.push({ q: '', a: '', dd: false, used: false });
    g.categories.push(cat);
  }
  g.teams = [{ name: '第一组', score: 0 }, { name: '第二组', score: 0 }];
  return g;
}
var G = blankGame();
var edit = { c: 0, r: 0 };
var live = { c: 0, r: 0, dd: false, timer: null, left: 0 };

var $ = function (s) { return document.querySelector(s); };
function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 1900); }
function valueOf(r) { return G.base + r * G.step; }

/* ---------------- editor ---------------- */
function renderEditor() {
  $('#gname').value = G.name;
  $('#optCats').value = G.categories.length;
  $('#optRows').value = G.rows;
  $('#optBase').value = G.base;
  $('#optStep').value = G.step;
  $('#optSec').value = G.seconds;

  var box = $('#cats');
  box.style.gridTemplateColumns = 'repeat(' + G.categories.length + ', minmax(150px,1fr))';
  box.innerHTML = '';
  G.categories.forEach(function (cat, ci) {
    var d = el('div', 'cat');
    var name = el('input', 'cname');
    name.type = 'text'; name.value = cat.name; name.placeholder = '类别 ' + (ci + 1);
    name.addEventListener('input', function () { cat.name = name.value; });
    d.appendChild(name);
    cat.clues.forEach(function (cl, ri) {
      var s = el('div', 'slot');
      var v = el('span', 'val'); v.textContent = valueOf(ri); s.appendChild(v);
      var q = el('span', 'q' + (cl.q ? '' : ' empty'));
      q.textContent = cl.q || '（空）点一下填题';
      s.appendChild(q);
      if (cl.dd) { var dd = el('span', 'dd'); dd.textContent = 'DD'; s.appendChild(dd); }
      s.addEventListener('click', function () { openEdit(ci, ri); });
      d.appendChild(s);
    });
    box.appendChild(d);
  });
  renderTeams();
  var filled = 0, total = 0;
  G.categories.forEach(function (c) { c.clues.forEach(function (x) { total++; if (x.q && x.a) filled++; }); });
  $('#fillinfo').textContent = filled + ' / ' + total;
}
function renderTeams() {
  var box = $('#teams'); box.innerHTML = '';
  G.teams.forEach(function (t, i) {
    var d = el('div', 'team');
    var n = el('input'); n.type = 'text'; n.value = t.name; n.style.width = '110px'; n.style.borderWidth = '1.5px';
    n.addEventListener('input', function () { t.name = n.value; });
    d.appendChild(n);
    var b = el('b'); b.textContent = t.score; d.appendChild(b);
    var x = el('button', 'mini danger'); x.textContent = '✕';
    x.addEventListener('click', function () { G.teams.splice(i, 1); renderTeams(); });
    d.appendChild(x);
    box.appendChild(d);
  });
}
function openEdit(c, r) {
  edit.c = c; edit.r = r;
  var cl = G.categories[c].clues[r];
  $('#mTitle').textContent = (G.categories[c].name || ('类别 ' + (c + 1))) + ' · ' + valueOf(r) + ' 分';
  $('#mQ').value = cl.q; $('#mA').value = cl.a; $('#mDD').checked = !!cl.dd;
  $('#modal').classList.add('open');
  setTimeout(function () { $('#mQ').focus(); }, 40);
}
function saveEdit() {
  var cl = G.categories[edit.c].clues[edit.r];
  cl.q = $('#mQ').value.trim(); cl.a = $('#mA').value.trim(); cl.dd = $('#mDD').checked;
  if (cl.dd) { // 一场只留一个 Daily Double
    G.categories.forEach(function (cat, ci) {
      cat.clues.forEach(function (x, ri) { if (!(ci === edit.c && ri === edit.r)) x.dd = false; });
    });
  }
  $('#modal').classList.remove('open');
  renderEditor();
}

/* ---------------- from wordlist ---------------- */
function genFromList() {
  if (!CW) { toast('需要 wordlist-core.js'); return; }
  var all = CW.listAll();
  if (!all.length) { toast('词表核心模块里还没有词表'); return; }
  var names = all.map(function (r, i) { return (i + 1) + '. ' + r.name + '（' + r.count + '）'; }).join('\n');
  var k = parseInt(prompt('用哪个词表出题？输入编号：\n' + names, '1'), 10) - 1;
  if (isNaN(k) || !all[k]) return;
  var list = CW.load(all[k].id);
  if (!list || !list.items.length) { toast('这个词表是空的'); return; }
  var mode = $('#genMode').value;
  var items = CW.shuffle(list.items);
  var need = G.categories.length * G.rows;
  if (items.length < need) toast('词不够 ' + need + ' 个，能填多少填多少');
  var i = 0;
  G.categories.forEach(function (cat, ci) {
    if (!cat.name) cat.name = list.name.length > 8 ? list.name.slice(0, 8) : list.name;
    cat.clues.forEach(function (cl, ri) {
      var it = items[i++];
      if (!it) return;
      var itemMode = mode === 'mixed'
        ? ['py2zh', 'en2zh', 'zh2en', 'zh2py', 'sentence'][(i - 1) % 5]
        : mode;
      if (itemMode === 'py2zh') { cl.q = '这个拼音是什么字？\n' + (it.py || ''); cl.a = it.zh; }
      else if (itemMode === 'en2zh') { cl.q = '用中文怎么说？\n' + (it.en || it.zh); cl.a = it.zh; }
      else if (itemMode === 'zh2en') { cl.q = it.zh + '\n英文是什么？'; cl.a = it.en || ''; }
      else if (itemMode === 'zh2py') { cl.q = it.zh + '\n拼音怎么写？'; cl.a = it.py || ''; }
      else { cl.q = '用「' + it.zh + '」说一个完整的句子'; cl.a = '（老师判断：句子完整、用对词就算过）'; }
      cl.used = false;
    });
  });
  if (!G.name) G.name = list.name + ' · 抢答赛';
  renderEditor();
  toast('用「' + list.name + '」出好题了');
}

/* ---------------- from Chen Laoshi question banks ---------------- */
function questionBankIcon(id) {
  return String.fromCodePoint(PRESET_BANK_ICONS[id] || 0x1f4dd);
}
function shuffleQuestions(items) {
  var copy = (items || []).slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
  }
  return copy;
}
function questionToClue(question) {
  var prompt = String(question.prompt || '').trim();
  var options = Array.isArray(question.options) ? question.options : [];
  var visibleOptions = options.map(function (option, index) {
    var value = String(option || '').trim();
    return value ? String.fromCharCode(65 + index) + '. ' + value : '';
  }).filter(Boolean);
  if (visibleOptions.length) prompt += '\n\n' + visibleOptions.join('\n');

  var answer = String(question.answer || '').trim();
  if (/^[A-D]$/i.test(answer)) {
    var optionIndex = answer.toUpperCase().charCodeAt(0) - 65;
    if (options[optionIndex]) answer = answer.toUpperCase() + '. ' + options[optionIndex];
  }
  return { q: prompt, a: answer, dd: false, used: false };
}
function selectedPresetBanks() {
  return selectedPresetBankIds.map(function (id) {
    return presetQuestionBanks.find(function (bank) { return bank.id === id; });
  }).filter(Boolean);
}
function renderQuestionBankChoices() {
  var choices = $('#bankChoices');
  var status = $('#bankStatus');
  var note = $('#bankSelectionNote');
  var importButton = $('#btnImportBanks');
  choices.innerHTML = '';

  if (!presetQuestionBanks.length) {
    status.textContent = '公开题库暂时无法载入。请稍后再试。';
    note.textContent = '题库载入后即可选择主题';
    importButton.disabled = true;
    return;
  }

  presetQuestionBanks.forEach(function (bank) {
    var button = el('button', 'bank-choice');
    var chosen = selectedPresetBankIds.indexOf(bank.id) !== -1;
    button.type = 'button';
    button.dataset.bankId = bank.id;
    button.setAttribute('aria-pressed', chosen ? 'true' : 'false');
    button.setAttribute('aria-label', (chosen ? 'Remove ' : 'Select ') + bank.name);
    var icon = el('span', 'bank-choice-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = questionBankIcon(bank.id);
    var label = el('span');
    label.textContent = bank.theme || bank.name;
    button.appendChild(icon); button.appendChild(label);
    button.addEventListener('click', function () { togglePresetBank(bank.id); });
    choices.appendChild(button);
  });

  status.textContent = presetQuestionBanks.length + ' 个公开题库主题可选。';
  note.textContent = selectedPresetBankIds.length
    ? '已选 ' + selectedPresetBankIds.length + ' 个主题 · 每个主题会成为一栏'
    : '选择 2–6 个主题';
  importButton.disabled = selectedPresetBankIds.length < 2;
}
function togglePresetBank(id) {
  var selectedIndex = selectedPresetBankIds.indexOf(id);
  if (selectedIndex !== -1) {
    selectedPresetBankIds.splice(selectedIndex, 1);
  } else {
    if (selectedPresetBankIds.length >= 6) {
      toast('最多选择 6 个主题');
      return;
    }
    selectedPresetBankIds.push(id);
  }
  renderQuestionBankChoices();
}
function loadPresetQuestionBanks() {
  fetch('/api/questionbanks/presets')
    .then(function (response) {
      if (!response.ok) throw new Error('Question bank list unavailable');
      return response.json();
    })
    .then(function (payload) {
      presetQuestionBanks = payload.banks || [];
      renderQuestionBankChoices();
    })
    .catch(function () {
      presetQuestionBanks = [];
      renderQuestionBankChoices();
    });
}
function importPresetBanks() {
  var selected = selectedPresetBanks();
  if (selected.length < 2) {
    toast('请选择至少 2 个主题');
    return;
  }
  var importButton = $('#btnImportBanks');
  importButton.disabled = true;
  $('#bankStatus').textContent = '正在抽取所选主题的题目…';
  Promise.all(selected.map(function (bank) {
    return fetch('/api/questionbanks/presets/' + encodeURIComponent(bank.id)).then(function (response) {
      if (!response.ok) throw new Error('Question bank unavailable');
      return response.json();
    });
  })).then(function (banks) {
    var old = G;
    var rows = old.rows;
    var nextGame = blankGame(banks.length, rows, old.base, old.step);
    nextGame.id = old.id;
    nextGame.name = old.name || banks.map(function (bank) { return bank.theme; }).join(' · ') + ' · Jeopardy';
    nextGame.seconds = old.seconds;
    nextGame.teams = old.teams.map(function (team) { return { name: team.name, score: team.score }; });

    banks.forEach(function (bank, categoryIndex) {
      var category = nextGame.categories[categoryIndex];
      var questions = shuffleQuestions(bank.questions);
      category.name = bank.theme || bank.name;
      category.clues = category.clues.map(function (clue, rowIndex) {
        return questions[rowIndex] ? questionToClue(questions[rowIndex]) : clue;
      });
    });

    G = nextGame;
    renderEditor();
    renderQuestionBankChoices();
    $('#bankStatus').textContent = '已从 ' + banks.length + ' 个主题抽取题目。你仍可点任意格子编辑。';
    toast('公开题库已加入 Jeopardy 游戏板');
  }).catch(function () {
    $('#bankStatus').textContent = '题库载入失败，请稍后重试。';
    renderQuestionBankChoices();
    toast('题库载入失败');
  });
}

/* ---------------- storage ---------------- */
function index() { try { return JSON.parse(localStorage.getItem(PRE + 'index') || '[]'); } catch (e) { return []; } }
function saveGame() {
  var name = $('#gname').value.trim();
  if (!name) { toast('先给这套题起个名字'); $('#gname').focus(); return; }
  G.name = name;
  G.id = G.id || (PRE + Date.now());
  try {
    localStorage.setItem(G.id, JSON.stringify(G));
    var idx = index().filter(function (r) { return r.id !== G.id; });
    idx.unshift({ id: G.id, name: name, updated: Date.now(), cats: G.categories.length, rows: G.rows });
    localStorage.setItem(PRE + 'index', JSON.stringify(idx));
    renderSaved(); toast('已保存「' + name + '」');
  } catch (e) { toast('保存失败，浏览器存储可能被禁用'); }
}
function renderSaved() {
  var box = $('#saved'); box.innerHTML = '';
  var idx = index();
  if (!idx.length) { box.innerHTML = '<p class="hint" style="margin:0">还没有保存过题库。</p>'; return; }
  idx.forEach(function (r) {
    var g = el('span'); g.style.marginRight = '8px';
    var b = el('button', 'mini');
    b.textContent = r.name + '（' + r.cats + '×' + r.rows + '）';
    b.addEventListener('click', function () { loadGame(r.id); });
    var d = el('button', 'mini danger'); d.textContent = '✕';
    d.addEventListener('click', function () {
      if (!confirm('删除「' + r.name + '」？')) return;
      localStorage.removeItem(r.id);
      localStorage.setItem(PRE + 'index', JSON.stringify(index().filter(function (x) { return x.id !== r.id; })));
      renderSaved();
    });
    g.appendChild(b); g.appendChild(d); box.appendChild(g);
  });
}
function loadGame(id) {
  try {
    var g = JSON.parse(localStorage.getItem(id));
    if (!g) { toast('打不开'); return; }
    G = g; renderEditor(); toast('已打开「' + g.name + '」');
  } catch (e) { toast('打不开'); }
}
function resetSizes() {
  var cats = Math.max(2, Math.min(6, +$('#optCats').value || 5));
  var rows = Math.max(2, Math.min(6, +$('#optRows').value || 5));
  var base = +$('#optBase').value || 100, step = +$('#optStep').value || 100;
  var old = G;
  var ng = blankGame(cats, rows, base, step);
  ng.name = old.name; ng.id = old.id; ng.teams = old.teams; ng.seconds = old.seconds;
  for (var c = 0; c < Math.min(cats, old.categories.length); c++) {
    ng.categories[c].name = old.categories[c].name;
    for (var r = 0; r < Math.min(rows, old.categories[c].clues.length); r++) {
      ng.categories[c].clues[r] = old.categories[c].clues[r];
    }
  }
  G = ng; renderEditor();
}

/* ---------------- game ---------------- */
function startGame() {
  var ready = 0;
  G.categories.forEach(function (c) { c.clues.forEach(function (x) { if (x.q) ready++; }); });
  if (!ready) { toast('还没有题目'); return; }
  if (!G.teams.length) { toast('至少要有一个队伍'); return; }
  $('#game').classList.add('open');
  $('#gtitle').textContent = G.name || 'Jeopardy';
  renderBoard(); renderScores();
  if ($('#game').requestFullscreen) $('#game').requestFullscreen().catch(function () {});
}
function exitGame() {
  $('#game').classList.remove('open');
  closeClue();
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
  renderEditor();
}
function renderBoard() {
  var b = $('#gboard');
  b.style.gridTemplateColumns = 'repeat(' + G.categories.length + ',1fr)';
  b.style.gridTemplateRows = 'auto repeat(' + G.rows + ',1fr)';
  b.innerHTML = '';
  G.categories.forEach(function (cat) {
    var h = el('div', 'gcat'); h.textContent = cat.name || '　'; b.appendChild(h);
  });
  var makeCell = function (ci, ri) {
    var cl = G.categories[ci].clues[ri];
    var c = el('div', 'gcell' + (cl.used || !cl.q ? ' used' : ''));
    c.textContent = cl.q ? valueOf(ri) : '—';
    if (cl.q && !cl.used) c.addEventListener('click', function () { openClue(ci, ri); });
    return c;
  };
  for (var r = 0; r < G.rows; r++) {
    for (var ci = 0; ci < G.categories.length; ci++) b.appendChild(makeCell(ci, r));
  }
}
function renderScores() {
  var box = $('#scores'); box.innerHTML = '';
  var max = Math.max.apply(null, G.teams.map(function (t) { return t.score; }).concat([0]));
  G.teams.forEach(function (t) {
    var d = el('div', 'sc' + (t.score === max && max !== 0 ? ' lead' : ''));
    var n = el('span', 'n'); n.textContent = t.name; d.appendChild(n);
    var v = el('span', 'v'); v.textContent = t.score; d.appendChild(v);
    box.appendChild(d);
  });
  var b = el('button', 'mini'); b.textContent = '分数清零';
  b.addEventListener('click', function () {
    if (!confirm('所有队伍分数清零？')) return;
    G.teams.forEach(function (t) { t.score = 0; }); renderScores();
  });
  box.appendChild(b);
}
function openClue(c, r) {
  live.c = c; live.r = r;
  var cl = G.categories[c].clues[r];
  live.dd = !!cl.dd;
  $('#chead').innerHTML = '<b>' + esc(G.categories[c].name || '') + '</b><span>' + valueOf(r) + ' 分</span>' +
    (cl.dd ? '<span style="color:#F6C43C;font-weight:700">Daily Double · 双倍</span>' : '');
  $('#ca').textContent = cl.a || '';
  $('#ca').classList.remove('show');
  $('#clue').classList.add('open');
  stopTimer();
  $('#timerfill').style.width = '100%';
  $('#timerfill').classList.remove('low');
  $('#tleft').textContent = G.seconds;
  renderClueTeams();
  if (cl.dd) {
    $('#cq').innerHTML = '<div class="dd-splash">DAILY DOUBLE<br>双 倍 分 数</div>';
    setTimeout(function () { showQuestion(); }, 1400);
  } else {
    showQuestion();
  }
}
function showQuestion() {
  var cl = G.categories[live.c].clues[live.r];
  $('#cq').innerHTML = esc(cl.q).replace(/\n/g, '<br>');
}
function renderClueTeams() {
  var box = $('#cteams'); box.innerHTML = '';
  var v = valueOf(live.r) * (live.dd ? 2 : 1);
  G.teams.forEach(function (t) {
    var d = el('div', 'tscore');
    var n = el('span'); n.textContent = t.name + ' ' + t.score; d.appendChild(n);
    var plus = el('button', 'mini'); plus.textContent = '+' + v;
    plus.addEventListener('click', function () { t.score += v; renderClueTeams(); renderScores(); });
    var minus = el('button', 'mini danger'); minus.textContent = '−' + v;
    minus.addEventListener('click', function () { t.score -= v; renderClueTeams(); renderScores(); });
    d.appendChild(plus); d.appendChild(minus);
    box.appendChild(d);
  });
}
function revealAnswer() { $('#ca').classList.add('show'); }
function closeClue(markUsed) {
  stopTimer();
  if (markUsed) {
    G.categories[live.c].clues[live.r].used = true;
    renderBoard();
  }
  $('#clue').classList.remove('open');
}
function startTimer() {
  stopTimer();
  live.left = G.seconds;
  $('#tleft').textContent = live.left;
  $('#timerfill').style.width = '100%';
  $('#timerfill').classList.remove('low');
  live.timer = setInterval(function () {
    live.left--;
    $('#tleft').textContent = Math.max(0, live.left);
    var pct = Math.max(0, live.left / G.seconds * 100);
    $('#timerfill').style.width = pct + '%';
    if (pct <= 25) $('#timerfill').classList.add('low');
    if (live.left <= 0) { stopTimer(); beep(); }
  }, 1000);
}
function stopTimer() { clearInterval(live.timer); live.timer = null; }
function beep() {
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    var ctx = new Ctx(), o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'square'; o.frequency.value = 660; g.gain.value = 0.08;
    o.start(); setTimeout(function () { o.stop(); ctx.close(); }, 420);
  } catch (e) {}
}

/* ---------------- export ---------------- */
function wrapText(t, per) {
  var out = [], lines = String(t).split('\n');
  lines.forEach(function (ln) {
    if (!ln) { out.push(''); return; }
    for (var i = 0; i < ln.length; i += per) out.push(ln.substr(i, per));
  });
  return out;
}
function slideSVG(kind, cat, val, text, dd) {
  var W = 1600, H = 900;
  var g = '<rect width="' + W + '" height="' + H + '" fill="#2A4E3E"/>';
  g += '<rect x="26" y="26" width="' + (W - 52) + '" height="' + (H - 52) + '" rx="24" fill="none" stroke="#1B2A47" stroke-width="8"/>';
  g += '<rect x="70" y="62" width="' + (W - 140) + '" height="96" rx="18" fill="#35604C" stroke="#1B2A47" stroke-width="6"/>';
  g += '<text x="110" y="126" font-size="42" font-weight="700" fill="#F2F6EF">' + esc(cat || '') + '</text>';
  g += '<text x="' + (W - 110) + '" y="126" font-size="42" font-weight="700" fill="#F6C43C" text-anchor="end">' + val + ' 分' + (dd ? '　·　DD' : '') + '</text>';
  var lines = wrapText(text || '', 16);
  var fs = lines.length > 4 ? 56 : lines.length > 2 ? 70 : 84;
  var startY = H / 2 - (lines.length - 1) * fs * 0.62 + 20;
  lines.forEach(function (ln, i) {
    g += '<text x="' + (W / 2) + '" y="' + (startY + i * fs * 1.24) + '" font-size="' + fs + '" font-weight="700" fill="' +
      (kind === 'a' ? '#F6C43C' : '#F2F6EF') + '" text-anchor="middle">' + esc(ln) + '</text>';
  });
  g += '<text x="' + (W / 2) + '" y="' + (H - 60) + '" font-size="30" fill="#9FBDAD" text-anchor="middle">' +
    (kind === 'a' ? '答案' : '题目') + '</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif">' + g + '</svg>';
}
function bankPages() {
  var W = 794, H = 1123, perPage = 26;
  var rows = [];
  G.categories.forEach(function (cat, ci) {
    rows.push({ head: true, text: (cat.name || ('类别 ' + (ci + 1))) });
    cat.clues.forEach(function (cl, ri) {
      if (!cl.q) return;
      rows.push({ text: valueOf(ri) + '　' + cl.q.replace(/\n/g, ' ') + (cl.dd ? '　[DD]' : '') });
      rows.push({ ans: true, text: '答：' + (cl.a || '') });
    });
    rows.push({ text: '' });
  });
  var pages = [], i;
  for (i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  return pages.map(function (pg, pi) {
    var g = '<rect width="' + W + '" height="' + H + '" fill="#FBF6E9"/>';
    g += '<rect x="24" y="24" width="' + (W - 48) + '" height="54" rx="12" fill="#35604C" stroke="#1B2A47" stroke-width="4"/>';
    g += '<text x="' + (W / 2) + '" y="60" font-size="26" font-weight="700" fill="#F2F6EF" text-anchor="middle">' +
      esc(G.name || 'Jeopardy 题库') + '　（第 ' + (pi + 1) + ' 页）</text>';
    var y = 116;
    pg.forEach(function (row) {
      if (row.head) {
        g += '<rect x="24" y="' + (y - 20) + '" width="' + (W - 48) + '" height="30" rx="8" fill="#F6C43C" stroke="#1B2A47" stroke-width="2"/>';
        g += '<text x="34" y="' + (y + 2) + '" font-size="19" font-weight="700" fill="#1B2A47">' + esc(row.text) + '</text>';
      } else if (row.ans) {
        g += '<text x="52" y="' + y + '" font-size="15" fill="#3E6E58">' + esc(row.text.slice(0, 52)) + '</text>';
      } else if (row.text) {
        g += '<text x="34" y="' + y + '" font-size="16" fill="#1B2A47">' + esc(row.text.slice(0, 50)) + '</text>';
      }
      y += 36;
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif">' + g + '</svg>';
  });
}
function renderAll(svgs, w, h, cb) {
  if (!DE) { toast('缺少 deck-export.js'); return; }
  var out = [], i = 0;
  toast('正在生成，请稍等…');
  (function next() {
    if (i >= svgs.length) { cb(out); return; }
    var k = i++;
    DE.svgToJpeg(svgs[k], w, h, 1.4).then(function (im) { out.push(im); setTimeout(next, 8); })
      .catch(function () { cb(out); });
  })();
}
function exportPPTX() {
  var svgs = [];
  G.categories.forEach(function (cat, ci) {
    cat.clues.forEach(function (cl, ri) {
      if (!cl.q) return;
      svgs.push(slideSVG('q', cat.name, valueOf(ri), cl.q, cl.dd));
      svgs.push(slideSVG('a', cat.name, valueOf(ri), cl.a, cl.dd));
    });
  });
  if (!svgs.length) { toast('还没有题目'); return; }
  renderAll(svgs, 1600, 900, function (imgs) {
    DE.download((G.name || 'Jeopardy') + '.pptx', DE.buildPPTX(imgs),
      'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    toast('PPTX 好了（' + imgs.length + ' 页，题目和答案各一页）');
  });
}
function exportPDF() {
  var svgs = bankPages();
  if (!svgs.length) { toast('还没有题目'); return; }
  renderAll(svgs, 794, 1123, function (imgs) {
    DE.download((G.name || 'Jeopardy') + ' 题库.pdf', DE.buildPDF(imgs, { pageWidth: 595, pageHeight: 842 }), 'application/pdf');
    toast('PDF 题库好了（' + imgs.length + ' 页）');
  });
}
function exportJSON() {
  var blob = JSON.stringify(G, null, 2);
  if (DE) DE.download((G.name || 'jeopardy') + '.json', new TextEncoder().encode(blob), 'application/json');
}
function importJSON(text) {
  try {
    var g = JSON.parse(text);
    if (!g.categories) throw new Error('格式不对');
    g.id = null; G = g; renderEditor(); toast('导入好了');
  } catch (e) { alert('导入失败：' + e.message); }
}

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', function () {
  if (!CW) $('#coreWarn').style.display = '';

  $('#gname').addEventListener('input', function () { G.name = this.value; });
  ['optCats', 'optRows', 'optBase', 'optStep'].forEach(function (id) {
    $('#' + id).addEventListener('change', resetSizes);
  });
  $('#optSec').addEventListener('change', function () { G.seconds = Math.max(5, +this.value || 20); });
  $('#optCats').value = G.categories.length;

  $('#btnAddTeam').addEventListener('click', function () {
    var n = $('#teamName').value.trim() || ('第' + (G.teams.length + 1) + '组');
    G.teams.push({ name: n, score: 0 }); $('#teamName').value = ''; renderTeams();
  });
  $('#btnGen').addEventListener('click', genFromList);
  $('#btnImportBanks').addEventListener('click', importPresetBanks);
  $('#btnBlank').addEventListener('click', function () {
    if (!confirm('清空所有题目？')) return;
    var t = G.teams, n = G.name;
    G = blankGame(G.categories.length, G.rows, G.base, G.step);
    G.teams = t; G.name = n; renderEditor();
  });
  $('#btnSave').addEventListener('click', saveGame);
  $('#btnNew').addEventListener('click', function () {
    G = blankGame(+$('#optCats').value || 5, +$('#optRows').value || 5, +$('#optBase').value || 100, +$('#optStep').value || 100);
    renderEditor(); toast('新建了一套');
  });
  $('#btnStart').addEventListener('click', startGame);
  $('#btnPPTX').addEventListener('click', exportPPTX);
  $('#btnPDF').addEventListener('click', exportPDF);
  $('#btnJSON').addEventListener('click', exportJSON);
  $('#btnImport').addEventListener('click', function () { $('#file').click(); });
  $('#file').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () { importJSON(String(fr.result)); };
    fr.readAsText(f, 'utf-8'); this.value = '';
  });

  $('#mSave').addEventListener('click', saveEdit);
  $('#mClear').addEventListener('click', function () {
    $('#mQ').value = ''; $('#mA').value = ''; $('#mDD').checked = false;
  });
  $('#mCancel').addEventListener('click', function () { $('#modal').classList.remove('open'); });
  $('#modal').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('open'); });

  $('#gExit').addEventListener('click', exitGame);
  $('#cReveal').addEventListener('click', revealAnswer);
  $('#cTimer').addEventListener('click', startTimer);
  $('#cStop').addEventListener('click', stopTimer);
  $('#cDone').addEventListener('click', function () { closeClue(true); });
  $('#cBack').addEventListener('click', function () { closeClue(false); });

  document.addEventListener('keydown', function (e) {
    if ($('#clue').classList.contains('open')) {
      if (e.key === 'Escape') closeClue(false);
      else if (e.key === ' ') { e.preventDefault(); revealAnswer(); }
      else if (e.key === 't' || e.key === 'T') startTimer();
      else if (e.key === 'Enter') closeClue(true);
      return;
    }
    if ($('#game').classList.contains('open') && e.key === 'Escape') exitGame();
  });

  renderEditor(); renderSaved(); loadPresetQuestionBanks();
});
