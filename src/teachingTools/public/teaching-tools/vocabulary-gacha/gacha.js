(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var zh = document.documentElement.lang === 'zh';
  var t = function (c,e) { return zh ? c : e; };
  var game, names, teams, busy = false, lists = [], selected = [];
  function count() { $('error').textContent = ''; $('count').textContent = GachaCore.parse($('words').value).length + t(' 个词（相同词语自动合并）',' words (duplicates merged)'); }
  $('words').addEventListener('input', count); count();
  $('mode').onchange = function () { $('team-names').hidden = $('mode').value !== 'teams'; };
  $('random').onchange = function () { $('fixed-label').hidden = $('random').checked; };
  $('fullscreen').onclick = async function () {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('gacha').requestFullscreen(); }
    catch (error) { $('fullscreen').textContent = t('请使用浏览器全屏','Use browser fullscreen'); }
  };
  function selection() {
    selected = Array.from($('lists').querySelectorAll('input:checked')).map(function (input) { return lists[Number(input.value)]; });
    var words = selected.flatMap(function (list) { return list.words; });
    $('preview').textContent = words.map(function (w) { return [w.term,w.py,w.en].join(' | '); }).join('\n');
    $('import').disabled = !words.length;
  }
  $('refresh').onclick = async function () {
    $('refresh').disabled = true; $('import').disabled = true; $('lists').replaceChildren(); $('preview').textContent = ''; lists = []; selected = [];
    $('library-status').textContent = t('正在加载…','Loading…');
    var errors = [];
    try {
      var saved = await ChenLibraryStore.create(localStorage, navigator.locks).load();
      saved.data.collections.filter(function (c) { return c.kind === 'vocabulary'; }).forEach(function (c) {
        lists.push({ name: t('我的资料 · ','My Library · ') + c.name, words: c.items.map(function (w) { return { term: w.term, py: w.pronunciation || '', en: w.definition || '' }; }) });
      });
    } catch (error) { errors.push(t('无法读取当前浏览器的个人词库。','Personal lists could not be read in this browser.')); }
    lists.forEach(function (list, i) {
      var label = document.createElement('label'); label.className = 'check';
      var input = document.createElement('input'); input.type = 'checkbox'; input.value = i; input.onchange = selection;
      label.append(input, document.createTextNode(list.name + ' (' + list.words.length + ')')); $('lists').append(label);
    });
    $('library-status').textContent = lists.length + t(' 个词表。',' lists. ') + errors.join(' '); $('refresh').disabled = false;
  };
  $('import').onclick = function () {
    var lines = selected.flatMap(function (list) { return list.words; }).map(function (w) { return [w.term,w.py,w.en].join('\t'); });
    var merged = GachaCore.parse($('words').value + '\n' + lines.join('\n'));
    $('words').value = merged.map(function (w) { return [w.term,w.py,w.en].join('\t'); }).join('\n'); count();
    $('library-status').textContent = t('已合并，可在上方编辑词汇。','Merged. Edit your words above.');
  };
  var picker = ChenLibraryPicker.create({
    root: $('gachaLibraryPicker'), source: 'wordlists', min: 1,
    title: t('从词汇 Library 添加词汇', 'Add terms from the library'),
    hint: t('选择一个或多个词汇主题，合并到上方词表；导入后可继续编辑。', 'Choose one or more vocabulary topics to merge into your list. Edit them above after importing.'),
    importLabel: t('添加所选主题的词汇', 'Add terms from selected topics'),
    libraryLinkText: t('浏览完整词汇库', 'Browse the full word list library'),
    onImport: function (topics) {
      var previous = GachaCore.parse($('words').value).length;
      var lines = topics.flatMap(function (topic) {
        return (topic.items || []).filter(function (item) { return item.zh; }).map(function (item) {
          return [item.zh, item.py || '', item.en || ''].join('\t');
        });
      });
      var merged = GachaCore.parse($('words').value + '\n' + lines.join('\n'));
      $('words').value = merged.map(function (word) { return [word.term, word.py, word.en].join('\t'); }).join('\n');
      count();
      $('import-status').textContent = t('已添加 ', 'Added ') + (merged.length - previous) + t(' 个词；重复词汇已跳过，可在上方编辑。', ' words; duplicates skipped. Edit your list above.');
      if (picker) picker.reset();
    }
  });
  function start() {
    var words = GachaCore.parse($('words').value), fixed = Number($('fixed').value);
    if (!words.length) { $('error').textContent = t('请先输入或导入词汇。','Enter or import some words first.'); return; }
    if (!$('random').checked && (!Number.isInteger(fixed) || fixed < 1 || fixed > 100)) { $('error').textContent = t('固定积分请输入 1–100 的整数。','Enter a whole number from 1 to 100.'); return; }
    $('error').textContent = ''; teams = $('mode').value === 'teams';
    names = teams ? [$('name-a').value.trim() || t('A 组','Team A'), $('name-b').value.trim() || t('B 组','Team B')] : [t('全班','Whole class')];
    game = GachaCore.create(words, teams, fixed, $('random').checked);
    $('gacha').classList.add('playing'); $('setup').hidden = true; $('play').hidden = false; render();
  }
  $('start').onclick = start; $('again').onclick = start;
  $('settings').onclick = function () { if (busy) return; $('gacha').classList.remove('playing'); $('play').hidden = true; $('setup').hidden = false; };
  function render() {
    $('remaining').textContent = t('剩余 ','Remaining: ') + game.pool.length + t(' 个词',' words');
    $('turn').textContent = game.phase === 'done' ? t('词汇全部抽完啦！','All words played!') : names[game.turn] + t(' · 轮到你啦',' · your turn');
    $('undo').disabled = busy || !game.history.length || !['ready','done'].includes(game.phase);
    $('machines').replaceChildren();
    names.forEach(function (name,i) {
      var card = document.createElement('article'); card.className = 'machine-card team-' + i + (i === game.turn ? ' active' : '');
      var heading = document.createElement('h2'); heading.textContent = name;
      var score = document.createElement('p'); score.className = 'score'; score.textContent = game.scores[i] + t(' 分',' pts');
      var machine = document.createElement('button'); machine.className = 'machine';
      machine.setAttribute('aria-label', name + t('：抽取扭蛋',' : draw a capsule'));
      var art = document.createElement('img');
      art.src = '/teaching-tools/vocabulary-gacha/assets/machine-' + (i === 0 ? 'blue' : 'orange') + '.png';
      art.alt = ''; art.draggable = false;
      machine.appendChild(art);
      machine.disabled = busy || i !== game.turn || game.phase !== 'ready'; machine.onclick = draw;
      var hint = document.createElement('p'); hint.textContent = i === game.turn && game.phase === 'ready' ? t('点击旋钮，抽一颗扭蛋','Tap the handle to draw') : '✦';
      card.append(heading,score,machine,hint); $('machines').append(card);
    });
    $('reveal').hidden = game.phase !== 'answer'; $('finish').hidden = game.phase !== 'done';
    if (game.phase === 'answer') {
      $('term').textContent = game.current.word.term;
      $('points').textContent = '✦ ' + game.current.points + t(' 分',' POINTS');
      support('pinyin',game.current.word.py,$('show-py').checked,t('显示拼音','Reveal pinyin'));
      support('english',game.current.word.en,$('show-en').checked,t('显示英文','Reveal English'));
    }
    if (game.phase === 'done') $('result').textContent = !teams ? names[0] + ' · ' + game.scores[0] + t(' 分！',' points!') : game.scores[0] === game.scores[1] ? t('平局！','It’s a tie!') : names[game.scores[0] > game.scores[1] ? 0 : 1] + t(' 获胜！',' wins!');
  }
  function support(id,value,visible,label) { $(id).hidden = !value; $(id).textContent = visible ? value : label; $(id).onclick = function () { $(id).textContent = value; }; }
  function draw() {
    if (busy || !game.draw()) return;
    busy = true; render();
    var machine = $('machines').children[game.turn].querySelector('.machine'); machine.classList.add('spinning');
    window.setTimeout(function () {
      var capsule = document.createElement('button'); capsule.className = 'capsule';
      var color = Math.floor(Math.random() * 9);
      var art = document.createElement('span'); art.className = 'capsule-art';
      art.style.backgroundPosition = (color % 3 * 50) + '% ' + (Math.floor(color / 3) * 50) + '%';
      art.setAttribute('aria-hidden', 'true');
      var label = document.createElement('span'); label.className = 'capsule-label'; label.textContent = t('点击打开','Tap to open');
      capsule.append(art, label);
      capsule.onclick = function () { if (game.phase !== 'closed') return; game.open(); capsule.remove(); busy = false; render(); };
      machine.parentNode.append(capsule);
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700);
  }
  $('correct').onclick = function () { if (game.answer(true)) render(); };
  $('miss').onclick = function () { if (game.answer(false)) render(); };
  $('undo').onclick = function () { if (game.undo()) render(); };
})();
