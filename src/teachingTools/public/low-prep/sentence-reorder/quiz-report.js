// Student quiz report as a downloadable PDF, made entirely in the browser.
// Each A4 page is drawn on a canvas (so Chinese text uses the device's own
// fonts) and placed into a PDF with the site's vendored jsPDF build.
(function () {
  'use strict';

  const JSPDF_SRC = '/teaching-tools/hanzi-batch/vendor/jspdf.umd.min.js';
  const PAGE_W = 1240; // A4 at 150 dpi
  const PAGE_H = 1754;
  const MARGIN = 110;
  const FONT = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif';
  const GREEN = '#245c39';
  const RED = '#943b2f';
  const INK = '#1f3b33';
  const MUTED = '#5d7168';

  let loading = null;
  function loadJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = JSPDF_SRC;
        script.onload = () => resolve(window.jspdf.jsPDF);
        script.onerror = () => { loading = null; reject(new Error('The PDF tool could not load. Check the connection and try again.')); };
        document.head.appendChild(script);
      });
    }
    return loading;
  }

  // Breaks text into lines that fit `width`, splitting on spaces where possible
  // and between characters for Chinese or very long words.
  function wrap(ctx, text, width) {
    const lines = [];
    let line = '';
    const tokens = String(text).match(/\S+\s*|\s+/g) || [''];
    tokens.forEach((token) => {
      if (ctx.measureText(line + token).width <= width) { line += token; return; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
      for (const char of token) {
        if (ctx.measureText(line + char).width > width && line) { lines.push(line.trimEnd()); line = ''; }
        line += char;
      }
    });
    if (line.trim() || !lines.length) lines.push(line.trimEnd());
    return lines;
  }

  function newPage() {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.textBaseline = 'top';
    return { canvas, ctx, y: MARGIN };
  }

  function text(page, value, size, color, weight) {
    page.ctx.font = `${weight || 400} ${size}px ${FONT}`;
    page.ctx.fillStyle = color || INK;
    const lineHeight = Math.round(size * 1.45);
    wrap(page.ctx, value, PAGE_W - MARGIN * 2).forEach((line) => {
      page.ctx.fillText(line, MARGIN, page.y);
      page.y += lineHeight;
    });
  }

  function measure(page, value, size, weight) {
    page.ctx.font = `${weight || 400} ${size}px ${FONT}`;
    return wrap(page.ctx, value, PAGE_W - MARGIN * 2).length * Math.round(size * 1.45);
  }

  function rule(page) {
    page.ctx.fillStyle = '#d8e5c7';
    page.ctx.fillRect(MARGIN, page.y, PAGE_W - MARGIN * 2, 3);
    page.y += 30;
  }

  function drawPages(report) {
    const pages = [];
    let page = newPage();
    pages.push(page);
    const total = report.items.length;
    const percent = total ? Math.round((report.score / total) * 100) : 0;

    text(page, 'Quiz report / 测验成绩单', 30, MUTED, 700);
    page.y += 6;
    text(page, report.title || 'Sentence Reorder', 46, INK, 800);
    page.y += 18;
    text(page, 'Student / 学生：' + report.studentName, 32, INK, 700);
    text(page, `Score / 得分：${report.score} / ${total}（${percent}%）`, 32, GREEN, 800);
    if (report.submittedAt) text(page, 'Submitted / 提交时间：' + new Date(report.submittedAt).toLocaleString(), 26, MUTED);
    page.y += 14;
    rule(page);

    report.items.forEach((item, index) => {
      const heading = `${index + 1}. ${item.correct ? '✓ Correct / 正确' : '✗ Incorrect / 错误'}`;
      const answer = 'Answer / 答案：' + item.answer;
      const needed = measure(page, heading, 30, 800) + measure(page, answer, 28) + 34;
      if (page.y + needed > PAGE_H - MARGIN - 40) {
        page = newPage();
        pages.push(page);
      }
      text(page, heading, 30, item.correct ? GREEN : RED, 800);
      text(page, answer, 28, INK);
      page.y += 34;
    });

    pages.forEach((entry, index) => {
      entry.ctx.font = `400 22px ${FONT}`;
      entry.ctx.fillStyle = MUTED;
      entry.ctx.fillText(`clsteachingtools.com · ${index + 1} / ${pages.length}`, MARGIN, PAGE_H - MARGIN + 20);
    });
    return pages.map((entry) => entry.canvas);
  }

  function fileName(report) {
    const clean = (value) => String(value || '').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 40);
    return `${clean(report.studentName) || 'student'} - ${clean(report.title) || 'quiz'} - report.pdf`;
  }

  async function download(report) {
    const JsPdf = await loadJsPdf();
    const pdf = new JsPdf({ unit: 'pt', format: 'a4' });
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    drawPages(report).forEach((canvas, index) => {
      if (index) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, width, height);
    });
    pdf.save(fileName(report));
  }

  window.QuizReport = { download, fileName };
})();
