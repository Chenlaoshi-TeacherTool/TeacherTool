/* 量词大挑战 · 老师页：选量词、自定义题库、设置，然后挂载游戏引擎。 */
(function () {
  'use strict';

  var D = window.MWData;
  var G = window.MWGame;
  var STORAGE_KEY = 'measure-words:v1';
  var $ = function (id) { return document.getElementById(id); };

  var els = {
    setup: $('mw-setup'), header: $('mw-header'), host: $('mw-stage-host'),
    grid: $('mw-mw-grid'), challenge: $('mw-challenge'), bankList: $('mw-bank-list'),
    customWords: $('mw-custom-words'), onlyCustom: $('mw-only-custom'),
    customSentences: $('mw-custom-sentences'), randomNumbers: $('mw-random-numbers'), customStatus: $('mw-custom-status'),
    duration: $('mw-duration'), rounds: $('mw-rounds'), target: $('mw-target'), battleType: $('mw-battle-type'),
    pinyin: $('mw-pinyin'), speak: $('mw-speak'), poolStatus: $('mw-pool-status'),
    share: $('mw-share'), links: $('mw-links'), linkCount: $('mw-link-count')
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  // ---------- 保存 / 读取（只是本机方便，读不到也能正常用） ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}; } catch (_e) { return {}; }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        mws: selectedMws(), challenge: els.challenge.checked,
        customWords: els.customWords.value, onlyCustom: els.onlyCustom.checked,
        customSentences: els.customSentences.value, randomNumbers: els.randomNumbers.checked,
        duration: els.duration.value, rounds: els.rounds.value, target: els.target.value, battleType: els.battleType.value,
        pinyin: els.pinyin.checked, speak: els.speak.checked
      }));
    } catch (_e) { /* 无痕模式等：不保存 */ }
  }

  // ---------- 量词选择 ----------
  var builtInMws = [];
  D.BANK.forEach(function (it) { if (builtInMws.indexOf(it.mw) === -1) builtInMws.push(it.mw); });

  function renderGrid(selected) {
    els.grid.innerHTML = builtInMws.map(function (mw) {
      var m = G.metaFor(mw);
      var count = D.BANK.filter(function (it) { return it.mw === mw; }).length;
      return '<label class="mw-mw-option" style="--mw-color:' + m.color + '">' +
        '<input type="checkbox" value="' + mw + '"' + (selected.indexOf(mw) !== -1 ? ' checked' : '') + '>' +
        '<span class="mw-mw-char">' + mw + '<small>' + m.py + '</small></span>' +
        '<span class="mw-mw-rule">' + esc(m.rule) + '<small>' + esc(m.ruleEn) + ' · ' + count + ' words</small></span></label>';
    }).join('');
  }

  function selectedMws() {
    return Array.prototype.map.call(els.grid.querySelectorAll('input:checked'), function (input) { return input.value; });
  }

  function renderBankList() {
    els.bankList.innerHTML = builtInMws.map(function (mw) {
      var m = G.metaFor(mw);
      var words = D.BANK.filter(function (it) { return it.mw === mw; }).map(function (it) {
        return '<span class="mw-bank-word' + (it.challenge ? ' is-challenge' : '') + '">' + (it.emoji ? it.emoji + ' ' : '') + esc(it.noun) + (it.challenge ? ' ⭐' : '') + '</span>';
      }).join('');
      return '<div class="mw-bank-row"><span class="mw-chip" style="--mw-color:' + m.color + '">' + mw + '</span><div>' + words + '</div></div>';
    }).join('') + '<p class="mw-note">⭐ = 挑战词 challenge word (only used when Challenge words is on)</p>';
  }

  // ---------- 自定义词：没写 emoji 的自动配一个 ----------
  var emojiCache = {};
  var emojiLoading = null;
  function ensureEmojiTools() {
    if (emojiLoading) return emojiLoading;
    var CW = window.ChenWordlist;
    var dict = CW && typeof CW.loadCedict === 'function' ? CW.loadCedict().catch(function () {}) : Promise.resolve();
    emojiLoading = dict.then(function () { return window.ChenEmoji ? window.ChenEmoji.load() : null; }).catch(function () { return null; });
    return emojiLoading;
  }

  function matchCustomEmoji(items) {
    var missing = items.filter(function (it) { return !it.emoji && !(it.noun in emojiCache); });
    if (!missing.length || !window.ChenEmoji) return;
    ensureEmojiTools().then(function (index) {
      if (!index) return;
      missing.forEach(function (it) {
        var hit = window.ChenEmoji.match({ zh: it.noun }, index, { translate: true });
        emojiCache[it.noun] = hit ? hit.emoji : '';
      });
      refresh();
    });
  }

  function customItems() {
    var items = G.parseWords(els.customWords.value);
    items.forEach(function (it) { if (!it.emoji && emojiCache[it.noun]) it.emoji = emojiCache[it.noun]; });
    return items;
  }

  // ---------- 汇总成游戏配置 ----------
  function buildConfig() {
    var mws = selectedMws();
    var custom = customItems();
    var sentences = G.parseSentences(els.customSentences.value);
    var items = els.onlyCustom.checked ? [] : D.BANK.filter(function (it) { return mws.indexOf(it.mw) !== -1; });
    // 自定义词放在前面，同名名词以老师写的为准
    var seen = {};
    custom.forEach(function (it) { seen[it.noun] = true; });
    items = custom.concat(items.filter(function (it) { return !seen[it.noun]; }));
    // 自定义词 / 句子里的量词自动加进按钮
    var allMws = els.onlyCustom.checked ? [] : mws.slice();
    custom.forEach(function (it) { if (allMws.indexOf(it.mw) === -1) allMws.push(it.mw); });
    sentences.forEach(function (s) { if (allMws.indexOf(s.answer) === -1) allMws.push(s.answer); });
    return {
      mws: allMws, items: items, sentences: sentences,
      options: {
        pinyin: els.pinyin.checked, speak: els.speak.checked, challenge: els.challenge.checked,
        randomNumbers: els.randomNumbers.checked,
        duration: Number(els.duration.value), rounds: Number(els.rounds.value),
        battleTarget: Number(els.target.value), battleType: els.battleType.value
      }
    };
  }

  function playableCounts(config) {
    var core = config.items.filter(function (it) { return !it.challenge; }).length;
    var challenge = config.items.filter(function (it) { return it.challenge; }).length;
    return { nouns: config.options.challenge ? core + challenge : (core || challenge), sentences: config.sentences.length };
  }

  function refresh() {
    var config = buildConfig();
    var counts = playableCounts(config);
    var custom = customItems();
    var badLines = els.customWords.value.split(/\r?\n/).filter(function (l) { return l.trim(); }).length - custom.length;
    var status = [];
    if (custom.length) status.push('✓ ' + custom.length + ' 个自己的词 custom words');
    if (badLines > 0) status.push('⚠ ' + badLines + ' 行看不懂，格式是「名词 量词」 · ' + badLines + ' line(s) skipped — use "noun measure-word"');
    if (config.sentences.length) status.push('✓ ' + config.sentences.length + ' 个句子 sentences');
    els.customStatus.textContent = status.join(' · ');

    var ready = config.mws.length >= 2 && (counts.nouns > 0 || counts.sentences > 0);
    els.poolStatus.textContent = ready
      ? config.mws.length + ' 个量词 measure words · ' + counts.nouns + ' 个名词 nouns' + (counts.sentences ? ' · ' + counts.sentences + ' 个句子 sentences' : '')
      : '请至少选两个量词，并且要有词 · Pick at least 2 measure words with some words to practise.';
    els.poolStatus.classList.toggle('is-warning', !ready);
    document.querySelectorAll('.mw-mode').forEach(function (b) {
      var mode = b.getAttribute('data-mode');
      b.disabled = !ready || (mode === 'catch' && counts.nouns === 0);
    });
    els.share.disabled = !ready;
    matchCustomEmoji(custom);
    save();
    return config;
  }

  // ---------- 开始 / 结束游戏 ----------
  var game = null;
  function startGame(mode) {
    var config = refresh();
    els.setup.hidden = true;
    els.header.hidden = true;
    els.host.hidden = false;
    game = G.mount(els.host, config, {
      onExit: function () {
        game = null;
        els.host.hidden = true;
        els.host.innerHTML = '';
        els.setup.hidden = false;
        els.header.hidden = false;
      },
      onOption: function (name, value) {
        if (name === 'pinyin') { els.pinyin.checked = value; save(); }
      }
    });
    game.start(mode);
    els.host.scrollIntoView({ block: 'start' });
  }

  document.querySelectorAll('.mw-mode').forEach(function (b) {
    b.addEventListener('click', function () { startGame(b.getAttribute('data-mode')); });
  });

  // ---------- 学生链接 ----------
  function updateLinkCount() {
    if (!window.TeacherGameShare) return;
    var n = window.TeacherGameShare.listShares().filter(function (s) { return s.gameType === 'measure-words'; }).length;
    els.linkCount.textContent = n ? '(' + n + ')' : '';
  }

  els.share.addEventListener('click', function () {
    if (!window.TeacherGameShare) return;
    window.TeacherGameShare.openPublisher({
      gameType: 'measure-words',
      version: 1,
      title: '量词大挑战 Measure Word Challenge',
      getData: function () {
        var config = buildConfig();
        return {
          title: '量词大挑战',
          mws: config.mws,
          items: config.items.slice(0, 300).map(function (it) {
            return { noun: it.noun, mw: it.mw, alt: it.alt || [], emoji: it.emoji || '', kind: it.kind || 'thing', challenge: !!it.challenge };
          }),
          sentences: config.sentences.slice(0, 100),
          options: config.options
        };
      },
      onPublished: updateLinkCount
    });
  });

  els.links.addEventListener('click', function () {
    if (window.TeacherGameShare) window.TeacherGameShare.openManager({ onChanged: updateLinkCount });
  });

  // ---------- 初始化 ----------
  var saved = load();
  renderGrid(Array.isArray(saved.mws) && saved.mws.length ? saved.mws : D.DEFAULT_MWS);
  renderBankList();
  if ('challenge' in saved) els.challenge.checked = !!saved.challenge;
  if (saved.customWords) els.customWords.value = saved.customWords;
  if ('onlyCustom' in saved) els.onlyCustom.checked = !!saved.onlyCustom;
  if (saved.customSentences) els.customSentences.value = saved.customSentences;
  if ('randomNumbers' in saved) els.randomNumbers.checked = !!saved.randomNumbers;
  ['duration', 'rounds', 'target', 'battleType'].forEach(function (key) {
    if (saved[key] && els[key].querySelector('option[value="' + saved[key] + '"]')) els[key].value = saved[key];
  });
  if ('pinyin' in saved) els.pinyin.checked = !!saved.pinyin;
  if ('speak' in saved) els.speak.checked = !!saved.speak;
  if (!window.speechSynthesis) { els.speak.checked = false; els.speak.disabled = true; }

  els.setup.addEventListener('change', refresh);
  var typing = null;
  [els.customWords, els.customSentences].forEach(function (area) {
    area.addEventListener('input', function () { clearTimeout(typing); typing = setTimeout(refresh, 350); });
  });
  refresh();
  updateLinkCount();
})();
