/*
 * Vocab Game Switcher (一套词换着玩)
 * Pick one word list, then open any game with it already filled in.
 * The list travels to the game through ChenWordlistHandoff (sessionStorage + ?wordlist=handoff).
 * The list can come from: ?wordlist=handoff (sent by the library / community),
 * ?preset=<slug> (a Chen Laoshi topic list), a list saved in this browser, or pasted words.
 */
(function () {
  'use strict';

  var zh = /^zh/i.test(document.documentElement.lang || '');
  function L(en, cn) { return zh ? cn : en; }
  function $(id) { return document.getElementById(id); }

  // group: 'play' (on screen in class) or 'print'. min: fewest words the game can use.
  // needsEn: the game needs an English meaning for each word it uses.
  var GAMES = [
    { id: 'character-race', group: 'play', icon: '🌻', href: '/teaching-tools/character-race', min: 4,
      name: ['Term Race', '词汇竞速'],
      desc: ['Words fill a sunflower wheel. Partners give clues and race to find them.', '词语排成向日葵转盘，同桌互相给提示，比赛找词。'] },
    { id: 'quiz-city', group: 'play', icon: '🏙️', href: '/teaching-tools/quiz-city', min: 4, needsEn: true,
      name: ['Quiz City', '问答城市'],
      desc: ['Team board game. Each word becomes a "what does it mean?" question with 4 choices.', '小组棋盘游戏。每个词变成一道“是什么意思？”四选一题目。'] },
    { id: 'would-you-rather', group: 'play', icon: '🤔', href: '/teaching-tools/would-you-rather', min: 2,
      name: ['Would You Rather', '二选一讨论'],
      desc: ['Words are paired at random into either-or speaking slides.', '词语随机两两配对，变成二选一口语讨论幻灯片。'] },
    { id: 'whats-missing', group: 'play', icon: '🙈', href: '/teaching-tools/whats-missing', min: 4,
      name: ['What\'s Missing?', '什么不见了'],
      desc: ['Students study the word cards, close their eyes, then say which word disappeared.', '学生先记住词卡，闭上眼睛，再说出哪个词不见了。'] },
    { id: 'sentence-reorder', group: 'play', icon: '🔀', href: '/teaching-tools/sentence-reorder', min: 1,
      name: ['Sentence Reorder', '句子重组'],
      desc: ['Each word goes into a simple sentence. Students drag the words back into order.', '每个词放进一个简单句子，学生把打乱的词语拖回正确顺序。'] },
    { id: 'flash-card-generator', group: 'print', icon: '🃏', href: '/teaching-tools/flash-card-generator', min: 1,
      name: ['Flash Cards', '生词卡'],
      desc: ['Double-sided 2×4 flash cards with pinyin and English.', '每页 2×4 的双面生词卡，带拼音和英文。'] },
    { id: 'bingo-generator', group: 'print', icon: '🎱', href: '/teaching-tools/bingo-generator', min: 16,
      name: ['Bingo', '宾果'],
      desc: ['A set of different bingo sheets in Chinese, pinyin, English or all three.', '一套各不相同的宾果卡，可显示中文、拼音、英文或三者。'] },
    { id: 'tarsia-puzzle', group: 'print', icon: '🔺', href: '/teaching-tools/tarsia-puzzle', min: 9,
      name: ['Tarsia Puzzle', '三角拼图'],
      desc: ['Match each word to its English, pinyin or emoji in a triangle puzzle.', '把词语和英文、拼音或表情配对，拼成三角拼图。'] }
  ];

  var currentList = null;

  function setStatus(message) { $('vgsStatus').textContent = message || ''; }

  // Fill in missing pinyin and English so every game gets complete words.
  function enrich(list) {
    var core = window.ChenWordlist;
    if (!core) return list;
    list.items.forEach(function (item) {
      if (!item.py) item.py = core.toPinyin(item.zh);
      if (!item.en) item.en = core.toEnglish(item.zh) || '';
    });
    return list;
  }

  function enrichWithCedict(list) {
    var core = window.ChenWordlist;
    var missing = list.items.some(function (item) { return !item.en; });
    if (!core || !missing || !core.loadCedict) return Promise.resolve(list);
    return core.loadCedict().then(function () { return enrich(list); }, function () { return list; });
  }

  function useList(rawList) {
    var handoff = window.ChenWordlistHandoff;
    var list = enrich(handoff.normalize(rawList));
    if (!list.items.length) { setStatus(L('This list has no words yet.', '这个词表还没有词语。')); return; }
    if (!list.name) list.name = L('My word list', '我的词表');
    currentList = list;
    render();
    enrichWithCedict(list).then(function (enriched) {
      if (currentList !== list) return;
      currentList = enriched;
      remember();
      render();
    });
    remember();
  }

  // Keep the list for reloads and for the "Switch game" link on game pages.
  function remember() {
    try {
      window.ChenWordlistHandoff.store(currentList);
      var url = new URL(window.location.href);
      url.searchParams.delete('preset');
      url.searchParams.set('wordlist', 'handoff');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (error) { /* the page still works for this visit */ }
  }

  function wordCountText(count) { return count + L(count === 1 ? ' word' : ' words', ' 个词'); }

  function blocker(game, list) {
    var usable = game.needsEn ? list.items.filter(function (item) { return item.en; }).length : list.items.length;
    if (usable >= game.min) return '';
    if (game.needsEn) return L('Needs ' + game.min + ' words with English meanings (this list has ' + usable + ').', '需要至少 ' + game.min + ' 个带英文释义的词（现在有 ' + usable + ' 个）。');
    return L('Needs at least ' + game.min + ' words.', '需要至少 ' + game.min + ' 个词。');
  }

  function renderWords(list) {
    var box = $('vgsWords');
    box.replaceChildren();
    list.items.forEach(function (item) {
      var li = document.createElement('li');
      var word = document.createElement('span');
      word.className = 'vgs-zh';
      word.textContent = item.zh;
      li.appendChild(word);
      if (item.py) {
        var py = document.createElement('span');
        py.className = 'vgs-py';
        py.textContent = item.py;
        li.appendChild(py);
      }
      if (item.en) li.title = item.en;
      box.appendChild(li);
    });
  }

  function renderGames(list) {
    $('vgsGamesHint').textContent = list
      ? L('Click a game to open it with these words.', '点一个游戏，用这套词打开。')
      : L('Choose a word list first.', '请先选择一套词。');
    ['play', 'print'].forEach(function (group) {
      var grid = $(group === 'play' ? 'vgsPlay' : 'vgsPrint');
      grid.replaceChildren();
      GAMES.filter(function (game) { return game.group === group; }).forEach(function (game) {
        var reason = list ? blocker(game, list) : '';
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'vgs-game';
        card.disabled = !list || Boolean(reason);
        card.dataset.game = game.id;
        var icon = document.createElement('span');
        icon.className = 'vgs-game-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = game.icon;
        var body = document.createElement('span');
        body.className = 'vgs-game-body';
        var name = document.createElement('strong');
        name.textContent = L(game.name[0], game.name[1]);
        var desc = document.createElement('span');
        desc.className = 'vgs-game-desc';
        desc.textContent = L(game.desc[0], game.desc[1]);
        body.append(name, desc);
        if (reason) {
          var note = document.createElement('span');
          note.className = 'vgs-game-note';
          note.textContent = reason;
          body.appendChild(note);
        }
        card.append(icon, body);
        grid.appendChild(card);
      });
    });
  }

  function render() {
    var list = currentList;
    $('vgsCurrent').hidden = !list;
    $('vgsChooser').hidden = Boolean(list);
    if (list) {
      $('vgsListHeading').textContent = list.name;
      var withEn = list.items.filter(function (item) { return item.en; }).length;
      $('vgsListMeta').textContent = wordCountText(list.items.length) +
        (withEn < list.items.length ? L(' · ' + withEn + ' with English', ' · ' + withEn + ' 个有英文') : '');
      renderWords(list);
    }
    renderGames(list);
  }

  function openGame(id) {
    var game = GAMES.filter(function (entry) { return entry.id === id; })[0];
    if (!game || !currentList) return;
    try {
      window.ChenWordlistHandoff.openGame(game.href, currentList);
    } catch (error) {
      setStatus(L('This browser could not pass the list to the game. Check that cookies and site data are allowed.', '这个浏览器无法把词表传给游戏，请检查是否允许网站存储数据。'));
    }
  }

  function choiceButton(label, meta, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'vgs-choice';
    var title = document.createElement('strong');
    title.textContent = label;
    var small = document.createElement('span');
    small.textContent = meta;
    button.append(title, small);
    button.addEventListener('click', onClick);
    return button;
  }

  function renderSaved() {
    var box = $('vgsSaved');
    box.replaceChildren();
    var core = window.ChenWordlist;
    var saved = core && core.hasStorage ? core.listAll() : [];
    if (!saved.length) {
      var empty = document.createElement('p');
      empty.className = 'vgs-empty';
      empty.append(L('No saved lists yet. Make one in the ', '还没有保存的词表。可以先在'));
      var link = document.createElement('a');
      link.href = '/teaching-tools/word-list-library/word-list-library.html';
      link.textContent = L('word list library', '词表库');
      empty.append(link, L('.', '里建一个。'));
      box.appendChild(empty);
      return;
    }
    saved.forEach(function (entry) {
      box.appendChild(choiceButton(entry.name, wordCountText(entry.count || 0), function () {
        var list = core.load(entry.id);
        if (list) useList(list);
        else setStatus(L('That list could not be opened.', '无法打开这个词表。'));
      }));
    });
  }

  function loadPreset(slug) {
    setStatus(L('Loading the topic list…', '正在加载主题词表…'));
    return fetch('/api/wordlists/presets/' + encodeURIComponent(slug))
      .then(function (response) {
        if (!response.ok) throw new Error('preset unavailable');
        return response.json();
      })
      .then(function (list) { setStatus(''); useList(list); })
      .catch(function () { setStatus(L('That topic list could not be loaded. Please try again later.', '无法加载这个主题词表，请稍后再试。')); });
  }

  function renderPresets() {
    var box = $('vgsPresets');
    fetch('/api/wordlists/presets')
      .then(function (response) {
        if (!response.ok) throw new Error('presets unavailable');
        return response.json();
      })
      .then(function (payload) {
        var lists = payload.lists || [];
        box.replaceChildren();
        if (!lists.length) throw new Error('no presets');
        lists.forEach(function (list) {
          var count = list.count != null ? list.count : (list.items || []).length;
          box.appendChild(choiceButton(list.name, wordCountText(count), function () {
            if (list.items && list.items.length) useList(list);
            else loadPreset(list.id || list.slug);
          }));
        });
      })
      .catch(function () {
        box.innerHTML = '';
        var empty = document.createElement('p');
        empty.className = 'vgs-empty';
        empty.textContent = L('Topic lists are unavailable right now. You can still paste your own words.', '主题词表暂时无法加载，仍然可以粘贴自己的词语。');
        box.appendChild(empty);
      });
  }

  function usePasted() {
    var core = window.ChenWordlist;
    var items = core ? core.parseText($('vgsPaste').value) : [];
    if (!items.length) { setStatus(L('Paste at least one word first.', '请先粘贴至少一个词。')); return; }
    setStatus('');
    useList({ name: $('vgsPasteName').value.trim() || L('My word list', '我的词表'), items: items });
  }

  function init() {
    $('vgsPlay').addEventListener('click', function (event) {
      var card = event.target.closest('button[data-game]');
      if (card && !card.disabled) openGame(card.dataset.game);
    });
    $('vgsPrint').addEventListener('click', function (event) {
      var card = event.target.closest('button[data-game]');
      if (card && !card.disabled) openGame(card.dataset.game);
    });
    $('vgsChange').addEventListener('click', function () {
      currentList = null;
      render();
      $('vgsChooser').scrollIntoView({ block: 'start' });
    });
    $('vgsUsePaste').addEventListener('click', usePasted);

    renderSaved();
    renderPresets();

    var params = new URLSearchParams(window.location.search);
    var handed = window.ChenWordlistHandoff.active();
    if (handed) useList(handed);
    else if (params.get('preset')) loadPreset(params.get('preset'));
    render();
  }

  if (!window.ChenWordlistHandoff) return;
  init();
})();
