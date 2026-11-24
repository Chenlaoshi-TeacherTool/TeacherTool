/*
 * 打印包 · Print Pack — one PDF with pages from several tools, all for the same word list.
 * Opened from the Vocab Game Switcher (?wordlist=handoff). Each chosen tool is loaded in a
 * hidden frame through ChenPrintPack.collect (shared/print-pack.js), which hands back the
 * tool's print pages and the CSS they need.
 */
(function () {
  'use strict';

  var ZH = window.PP_LANG === 'zh';
  function T(en, zh) { return ZH ? zh : en; }
  var $ = function (id) { return document.getElementById(id); };
  var PAPER = { A4: [210, 297], Letter: [215.9, 279.4] };
  var PICKS = 'print-pack-tools-v1';

  var TOOLS = [
    { id: 'flash', href: '/teaching-tools/flash-card-generator', icon: '🃏', name: ['Flash cards', '生词卡'], note: ['Fronts and backs alternate for double-sided printing.', '正面、背面交替排列，可以双面打印。'] },
    { id: 'bingo', href: '/teaching-tools/bingo-generator', icon: '🎱', name: ['Bingo', '宾果'], note: ['Needs at least 16 words (4×4).', '至少要 16 个词（4×4）。'] },
    { id: 'tarsia', href: '/teaching-tools/tarsia-puzzle', icon: '🔺', name: ['Tarsia puzzle', '三角拼图'], note: ['Cut page and answer page.', '剪切页和答案页。'] },
    { id: 'exit', href: '/teaching-tools/exit-ticket', icon: '🎟️', name: ['Exit tickets', '出门条'], note: ['', ''] },
    { id: 'roles', href: '/teaching-tools/speaking-cards', icon: '🎭', name: ['Role-play cards', '情景角色卡'], note: ['', ''] },
    { id: 'interview', href: '/teaching-tools/speaking-cards?mode=interview', icon: '🔍', name: ['Find-someone-who sheet', '“找一个……的同学”采访表'], note: ['', ''] },
    { id: 'components', href: '/teaching-tools/component-cards', icon: '🎨', name: ['Component cards', '部件卡片'], note: ['Prints what you ticked in its “Print several together” list (colour cards if none).', '印你在部件卡片“一起打印”里勾的内容（没勾过就印彩色字卡）。'] }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function readPicks() { try { return JSON.parse(localStorage.getItem(PICKS)) || ['flash', 'exit', 'components']; } catch (e) { return ['flash', 'exit', 'components']; } }
  function savePicks(p) { try { localStorage.setItem(PICKS, JSON.stringify(p)); } catch (e) { /* private mode */ } }

  var handoff = window.ChenWordlistHandoff;
  var list = handoff && handoff.active();

  function paintTools() {
    var picks = readPicks();
    $('ppTools').innerHTML = TOOLS.map(function (t) {
      return '<div class="pp-tool"><label><input type="checkbox" value="' + t.id + '"' + (picks.indexOf(t.id) !== -1 ? ' checked' : '') + '> <span>' + t.icon + ' <b>' + T(t.name[0], t.name[1]) + '</b>' +
        (t.note[0] ? '<small>' + esc(T(t.note[0], t.note[1])) + '</small>' : '') + '</span></label>' +
        '<a href="' + t.href + (t.href.indexOf('?') === -1 ? '?' : '&') + 'wordlist=handoff" target="_blank" rel="opener">' + T('Adjust', '调整') + ' ↗</a></div>';
    }).join('');
  }

  function chosen() {
    return Array.prototype.filter.call($('ppTools').querySelectorAll('input'), function (b) { return b.checked; }).map(function (b) { return b.value; });
  }

  function cover(tool, pages, size) {
    return '<div class="pp-sheet pp-cover" style="width:' + size[0] + 'mm;height:' + size[1] + 'mm"><p class="pp-cover-kicker">' + T('Next', '下面是') + '</p><h2>' + tool.icon + ' ' + T(tool.name[0], tool.name[1]) + '</h2>' +
      '<p>' + T(pages + (pages === 1 ? ' page' : ' pages'), '共 ' + pages + ' 页') + '</p>' + (list && list.name ? '<p class="pp-cover-list">' + esc(list.name) + '</p>' : '') + '</div>';
  }

  function blank(size) {
    return '<div class="pp-sheet pp-blank" style="width:' + size[0] + 'mm;height:' + size[1] + 'mm"><p>' + T('(left blank for double-sided printing)', '（为双面打印留空）') + '</p></div>';
  }

  var building = false;
  async function build() {
    if (building || !list) return;
    var picks = chosen();
    savePicks(picks);
    if (!picks.length) { $('ppStatus').textContent = T('Tick at least one tool.', '至少勾选一个工具。'); return; }
    building = true;
    $('ppBuild').disabled = true;
    $('ppPrint').disabled = true;
    var paper = $('ppPaper').value, size = PAPER[paper];
    $('ppPageSize').textContent = '@page { size: ' + paper + '; margin: 0; }';
    var opts = { paper: paper, pinyin: $('ppPinyin').checked };
    var covers = $('ppCovers').checked;
    var tools = TOOLS.filter(function (t) { return picks.indexOf(t.id) !== -1; });
    $('ppProgress').innerHTML = tools.map(function (t) { return '<li data-id="' + t.id + '">' + t.icon + ' ' + T(t.name[0], t.name[1]) + ' <span>…</span></li>'; }).join('');
    $('ppPages').innerHTML = '';
    var css = [], html = [], count = 0, total = 0;
    for (var i = 0; i < tools.length; i++) {
      var tool = tools[i];
      var row = $('ppProgress').querySelector('[data-id="' + tool.id + '"] span');
      row.textContent = T('preparing…', '准备中…');
      try {
        var result = await window.ChenPrintPack.collect(tool.href, opts);
        if (!result.pages.length) { row.textContent = T('nothing to print with these words', '这套词印不出内容'); row.parentNode.classList.add('is-skip'); continue; }
        if (css.indexOf(result.css) === -1) css.push(result.css);
        var part = covers ? cover(tool, result.pages.length, size) : '';
        if (covers) count++;
        // Double-sided pages must start on a front side.
        if (tool.id === 'flash' && count % 2 === 1) { part += blank(size); count++; }
        part += result.pages.map(function (p) { return '<div class="pp-sheet" style="width:' + size[0] + 'mm;height:' + size[1] + 'mm">' + p + '</div>'; }).join('');
        count += result.pages.length;
        total += result.pages.length;
        html.push(part);
        row.textContent = '✓ ' + T(result.pages.length + (result.pages.length === 1 ? ' page' : ' pages'), result.pages.length + ' 页');
        row.parentNode.classList.add('is-done');
      } catch (error) {
        row.textContent = '✗ ' + T('could not be added', '没有加进来');
        row.parentNode.classList.add('is-skip');
        console.error(tool.id, error);
      }
    }
    $('ppToolCss').textContent = css.join('\n');
    $('ppPages').innerHTML = html.join('');
    fitPages();
    building = false;
    $('ppBuild').disabled = false;
    $('ppPrint').disabled = !total;
    $('ppStatus').textContent = total ? T('Ready: ' + count + ' pages in one PDF.', '准备好了：一共 ' + count + ' 页，存成一个 PDF。') : T('Nothing to print.', '没有可以打印的内容。');
  }

  // Shrink any tool page that is bigger than the chosen paper (e.g. Letter pages on A4).
  function fitPages() {
    Array.prototype.forEach.call($('ppPages').querySelectorAll('.pp-sheet'), function (sheet) {
      var page = sheet.firstElementChild;
      if (!page || sheet.classList.contains('pp-cover') || sheet.classList.contains('pp-blank')) return;
      page.style.zoom = '';
      var zoom = Math.min(1, sheet.clientWidth / page.offsetWidth, sheet.clientHeight / page.offsetHeight);
      if (zoom < 0.999) page.style.zoom = zoom;
    });
    var stage = $('ppStage'), pages = $('ppPages');
    pages.style.zoom = 1;
    var first = pages.querySelector('.pp-sheet');
    if (first) pages.style.zoom = Math.min(1, (stage.clientWidth - 24) / first.offsetWidth);
  }

  if (!list) {
    $('ppList').textContent = T('Open the print pack from the Vocab Game Switcher after choosing a word list.', '请先在“一套词换着玩”里选好一套词，再打开打印包。');
    $('ppBuild').disabled = true;
  } else {
    $('ppList').textContent = T('Word list: ', '词表：') + list.name + ' · ' + list.items.length + T(' words', ' 个词');
  }
  paintTools();
  $('ppTools').addEventListener('change', function () { savePicks(chosen()); });
  $('ppBuild').addEventListener('click', build);
  $('ppPrint').addEventListener('click', function () { window.print(); });
  window.addEventListener('resize', fitPages);
})();
