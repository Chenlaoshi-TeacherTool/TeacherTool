(function () {
  'use strict';

  var SHARES_KEY = 'teacher-game-shares:v1';
  var t = function (value) { return window.LibraryI18n ? window.LibraryI18n.t(value) : value; };
  var chinese = Boolean(window.LibraryI18n && window.LibraryI18n.chinese);
  var find = function (id) { return document.getElementById(id); };
  var shareId = new URLSearchParams(location.search).get('id') || '';
  var share = null;
  var results = null;
  var open = Object.create(null);

  try {
    share = (JSON.parse(localStorage.getItem(SHARES_KEY) || '[]') || []).find(function (item) { return item && item.shareId === shareId && item.deleteToken; }) || null;
  } catch (error) { share = null; }

  function element(tag, text, className) { var node = document.createElement(tag); if (text !== undefined && text !== null) node.textContent = text; if (className) node.className = className; return node; }
  function when(value) { return value ? new Date(value).toLocaleString(chinese ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; }
  function percent(part, whole) { return whole ? Math.round(part / whole * 100) : 0; }

  async function request(path) {
    return fetch('/api/game-shares/' + encodeURIComponent(shareId) + path, {
      // Without this browser's delete token the server falls back to the signed-in owner.
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Library-Request': 'activities' }, body: JSON.stringify({ deleteToken: share ? share.deleteToken : undefined }), cache: 'no-store'
    });
  }

  function renderSummary() {
    var count = results.sentences.length;
    var submitted = results.submissions.length;
    find('resultsTitle').textContent = results.title || t('Quiz results');
    document.title = (results.title || t('Quiz results')) + ' · ' + t('Quiz results');
    find('resultsExpiry').textContent = results.expiresAt ? t('Link open until ') + new Date(results.expiresAt).toLocaleDateString(chinese ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    find('statSubmitted').textContent = submitted;
    find('statAverage').textContent = submitted ? (results.submissions.reduce(function (sum, item) { return sum + item.score; }, 0) / submitted).toFixed(1) + ' / ' + count : '–';
    find('sentenceRates').replaceChildren.apply(find('sentenceRates'), results.sentences.map(function (words, index) {
      var rate = percent(results.submissions.filter(function (item) { return item.correct[index]; }).length, submitted);
      var li = element('li', '', 'sentence-rate' + (submitted && rate < 50 ? ' is-low' : ''));
      var label = element('span', words.join(' '), 'sentence-rate-text');
      var bar = element('span', '', 'sentence-rate-bar');
      var fill = element('span'); fill.style.width = rate + '%';
      bar.appendChild(fill);
      li.append(label, bar, element('strong', submitted ? rate + '%' : '–'));
      return li;
    }));
  }

  function renderTable() {
    var count = results.sentences.length;
    var head = [t('Student'), t('Score'), t('Submitted')].concat(results.sentences.map(function (_words, index) { return 'S' + (index + 1); }));
    find('resultsHead').replaceChildren.apply(find('resultsHead'), head.map(function (label, index) {
      var th = element('th', label); th.scope = 'col'; if (index > 2) th.className = 'is-mark'; return th;
    }));
    var rows = [];
    results.submissions.slice().sort(function (left, right) { return left.studentName.localeCompare(right.studentName, chinese ? 'zh' : 'en'); }).forEach(function (submission) {
      var key = submission.studentName;
      var row = element('tr', '', 'student-row' + (open[key] ? ' is-open' : ''));
      var nameCell = element('th'); nameCell.scope = 'row';
      var toggle = element('button', submission.studentName, 'student-toggle'); toggle.type = 'button';
      toggle.setAttribute('aria-expanded', open[key] ? 'true' : 'false');
      toggle.addEventListener('click', function () { open[key] = !open[key]; renderTable(); });
      nameCell.appendChild(toggle);
      row.append(nameCell, element('td', submission.score + ' / ' + count + ' (' + percent(submission.score, count) + '%)'), element('td', when(submission.submittedAt)));
      results.sentences.forEach(function (_words, index) {
        var right = submission.correct[index];
        var cell = element('td', right ? '✓' : '✗', 'is-mark ' + (right ? 'is-right' : 'is-wrong'));
        cell.setAttribute('aria-label', right ? t('Correct') : t('Incorrect'));
        row.appendChild(cell);
      });
      rows.push(row);
      if (open[key]) {
        var detail = element('tr', '', 'student-detail');
        var cell = element('td'); cell.colSpan = head.length;
        var list = element('ol');
        results.sentences.forEach(function (words, index) {
          var right = submission.correct[index];
          var item = element('li', '', right ? 'is-right' : 'is-wrong');
          item.appendChild(element('strong', (right ? '✓ ' : '✗ ') + (submission.answers[index] || []).join(' ')));
          if (!right) item.appendChild(element('span', t('Correct order: ') + words.join(' ')));
          list.appendChild(item);
        });
        cell.appendChild(list);
        detail.appendChild(cell);
        rows.push(detail);
      }
    });
    find('resultsBody').replaceChildren.apply(find('resultsBody'), rows);
    find('noSubmissions').hidden = results.submissions.length > 0;
  }

  async function load() {
    find('refreshResults').disabled = true;
    try {
      var response = await request('/results');
      var body = await response.json().catch(function () { return {}; });
      if (response.status === 404 && !share) throw new Error('These results are not available here. Sign in to the teacher account that created this quiz, or open My activities on the computer you used to create it.');
      if (!response.ok) throw new Error(body.error || 'Results could not be loaded. Please try again.');
      results = body;
      renderSummary();
      renderTable();
      find('resultsContent').hidden = false;
      find('studentsSection').hidden = false;
      find('resultsStatus').textContent = t('Updated ') + when(new Date().toISOString()) + (chinese ? '。' : '.');
    } catch (error) {
      find('resultsStatus').textContent = t(error.message);
    } finally { find('refreshResults').disabled = false; }
  }

  async function download() {
    var button = find('downloadResults');
    button.disabled = true;
    try {
      var response = await request('/results.xlsx');
      if (!response.ok) throw new Error((await response.json().catch(function () { return {}; })).error || 'The spreadsheet could not be created. Please try again.');
      var url = URL.createObjectURL(await response.blob());
      var link = document.createElement('a');
      link.href = url;
      link.download = String(results && results.title || 'quiz').replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) + ' - results.xlsx';
      link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    } catch (error) { find('resultsStatus').textContent = t(error.message); }
    finally { button.disabled = false; }
  }

  find('refreshResults').addEventListener('click', load);
  find('downloadResults').addEventListener('click', download);
  load();
})();
