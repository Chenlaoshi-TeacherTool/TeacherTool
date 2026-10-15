/* 汉字笔顺练习纸生成器 · Stroke Order Worksheet. Needs stroke-dict.js (DICT) loaded first. */
/* Stroke data: hanzi-writer-data (derived from Make Me a Hanzi) */
const SOURCES = [
  c => `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(c)}.json`,
  c => `https://unpkg.com/hanzi-writer-data@2.0.1/${encodeURIComponent(c)}.json`
];
const PALETTE = ['#E63946','#F08A24','#2A9D8F','#3A6EA5','#9B5DE5','#D63A8A','#1B9AAA','#6A994E','#C8553D','#5A4FCF'];
const GRAY = '#C3CAD3', INK = '#1E2635', TRACE = '#D6DBE2', GRID = '#E6A3A3';

const $ = s => document.querySelector(s);
const cache = {};
const state = { chars: [], info: {} };
const esc = s => String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

function opts(){
  const n = (id, lo, hi) => Math.min(hi, Math.max(lo, parseInt($(id).value, 10) || lo));
  return { grid: $('#grid').value, cols: n('#cols',5,12), rows: n('#rows',1,10),
           trace: n('#trace',0,11), rowTrace: $('#rowTrace').checked, nameLine: $('#nameLine').checked };
}

async function loadChar(c){
  if (cache[c]) return cache[c];
  for (const src of SOURCES){
    try { const r = await fetch(src(c)); if (r.ok){ cache[c] = await r.json(); return cache[c]; } } catch(e){}
  }
  throw new Error(c);
}

/* ---------- SVG building blocks (1024 × 1024 coordinate space) ---------- */
function gridLines(style){
  const d = 'stroke="'+GRID+'" stroke-width="6" stroke-dasharray="28 22" fill="none"';
  let s = '';
  if (style === 'tian' || style === 'mi') s += `<path d="M512 0V1024M0 512H1024" ${d}/>`;
  if (style === 'mi') s += `<path d="M0 0L1024 1024M1024 0L0 1024" ${d}/>`;
  return s;
}
// Make Me a Hanzi data is y-up with baseline at 900; flip into SVG space and pad slightly.
const FLIP = 'transform="translate(61 61) scale(0.88) translate(0 900) scale(1 -1)"';
const toScreen = ([x,y]) => [61 + 0.88*x, 61 + 0.88*(900 - y)];

function charPaths(data, mode, step){
  const paths = data.strokes.map((p, i) => {
    let fill = INK;
    if (mode === 'color') fill = PALETTE[i % PALETTE.length];
    else if (mode === 'trace') fill = TRACE;
    else if (mode === 'step') fill = i < step ? GRAY : PALETTE[i % PALETTE.length];
    if (mode === 'step' && i > step) return '';
    return `<path d="${p}" fill="${fill}"/>`;
  }).join('');
  return `<g ${FLIP}>${paths}</g>`;
}
function startDot(data, i){
  const pts = data.medians[i].map(toScreen);
  const c = PALETTE[i % PALETTE.length];
  // arrowhead at the end of the stroke's centre line
  const [x1,y1] = pts[pts.length-2] || pts[0], [x2,y2] = pts[pts.length-1];
  const a = Math.atan2(y2-y1, x2-x1), L = 70;
  const p1 = [x2 - L*Math.cos(a-0.5), y2 - L*Math.sin(a-0.5)], p2 = [x2 - L*Math.cos(a+0.5), y2 - L*Math.sin(a+0.5)];
  return `<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 34" opacity=".9"/>`
       + `<polygon points="${x2},${y2} ${p1.join(',')} ${p2.join(',')}" fill="#fff" stroke="${c}" stroke-width="8" stroke-linejoin="round"/>`
       + `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="42" fill="#fff" stroke="${c}" stroke-width="16"/>`;
}
function numbers(data){
  return data.medians.map((m, i) => {
    const [x,y] = toScreen(m[0]); const c = PALETTE[i % PALETTE.length];
    return `<circle cx="${x}" cy="${y}" r="44" fill="#fff" stroke="${c}" stroke-width="9"/>`
         + `<text x="${x}" y="${y+22}" font-size="62" font-weight="700" text-anchor="middle" fill="${c}" font-family="Arial,sans-serif">${i+1}</text>`;
  }).join('');
}
function cell(inner, grid, attrs = '', border = true){
  const frame = border ? `<rect x="3" y="3" width="1018" height="1018" fill="none" stroke="#7E9F7A" stroke-width="10"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" ${attrs}><rect width="1024" height="1024" fill="#fff"/>${gridLines(grid)}${inner}${frame}</svg>`;
}
const bigChar  = (d, g, a) => cell(charPaths(d,'color') + numbers(d), g, a);
const stepCell = (d, i, g, a) => cell(charPaths(d,'step',i) + startDot(d,i), g, a);

function practiceKinds(o){
  const kinds = [];
  for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.cols; c++){
    if (r === 0) kinds.push(c === 0 ? 'model' : (c <= o.trace ? 'trace' : 'blank'));
    else kinds.push(c === 0 && o.rowTrace ? 'trace' : 'blank');
  }
  return kinds;
}
function practiceInner(d, k){ return k === 'model' ? charPaths(d,'ink') : k === 'trace' ? charPaths(d,'trace') : ''; }

/* ---------- HTML / CSS worksheet ---------- */
function render(){
  const o = opts(), ws = $('#worksheet');
  if (!state.chars.length){ ws.innerHTML = '<p style="color:#5F6B7A;margin:0">在上方输入汉字，然后点“生成练习纸”。</p>'; return; }
  let h = `<div class="ws-top"><h2 class="ws-title">汉字笔顺练习<small>Stroke Order Practice</small></h2>`
        + (o.nameLine ? `<div class="ws-name">姓名 Name<span></span>日期 Date<span></span></div>` : '') + `</div>`;
  for (const ch of state.chars){
    const d = cache[ch], info = state.info[ch];
    h += `<section class="ws-char"><div class="ws-head">`
      +  `<div class="ws-big">${bigChar(d, o.grid, `role="img" aria-label="${ch}"`)}</div><div>`
      +  `<div class="ws-pinyin" contenteditable="true" data-ch="${ch}" data-k="pinyin">${esc(info.pinyin)}</div>`
      +  `<div class="ws-meaning" contenteditable="true" data-ch="${ch}" data-k="meaning">${esc(info.meaning)}</div>`
      +  `<div class="ws-facts"><span>笔画 Strokes <b>${d.strokes.length}</b></span>`
      +  (info.radical ? `<span>部首 Radical <b>${esc(info.radical)}</b></span>` : '') + `</div></div></div>`
      +  `<div class="ws-label">笔顺 Stroke order</div><div class="ws-steps">`
      +  d.strokes.map((_, i) => `<div class="ws-step">${stepCell(d, i, o.grid)}<b>${i+1}</b></div>`).join('')
      +  `</div><div class="ws-label">练习 Practice</div><div class="ws-practice" style="--cols:${o.cols}">`
      +  practiceKinds(o).map(k => cell(practiceInner(d,k), o.grid, '', false)).join('')
      +  `</div></section>`;
  }
  h += `<div class="ws-foot">clsteachingtools.com · 笔顺数据 Make Me a Hanzi</div>`;
  ws.innerHTML = h;
}
$('#worksheet').addEventListener('input', e => {
  const t = e.target.closest('[data-ch]'); if (t) state.info[t.dataset.ch][t.dataset.k] = t.textContent.trim();
});

async function generate(){
  const chars = [...new Set([...$('#chars').value].filter(c => /\p{Script=Han}/u.test(c)))].slice(0, 12);
  const st = $('#status'); st.className = 'status no-print';
  if (!chars.length){ st.textContent = '请输入至少一个汉字。'; st.classList.add('err'); return; }
  st.textContent = '正在获取笔顺数据…';
  const res = await Promise.allSettled(chars.map(loadChar));
  const bad = chars.filter((_, i) => res[i].status === 'rejected');
  state.chars = chars.filter((_, i) => res[i].status === 'fulfilled');
  for (const c of state.chars) if (!state.info[c]){
    const e = DICT[c] || ['', '', ''];
    state.info[c] = { pinyin: e[0].replace(/\//g,' / '), meaning: e[1], radical: e[2] };
  }
  render();
  if (bad.length){ st.textContent = `找不到这些字的笔顺数据：${bad.join(' ')}（请检查网络，或换用常见字形）`; st.classList.add('err'); }
  else st.textContent = `已生成 ${state.chars.length} 个字。`;
}

/* ---------- Standalone SVG (for SVG / PNG export) ---------- */
function wrap(text, max){
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words){ if ((cur + ' ' + w).trim().length > max && cur){ lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur); return lines.slice(0, 2);
}
function buildSVG(){
  const o = opts(), W = 816, M = 40, CW = W - 2*M, F = 'PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif';
  const t = (x,y,s,txt,ex='') => `<text x="${x}" y="${y}" font-size="${s}" font-family="${F}" ${ex}>${esc(txt)}</text>`;
  let y = M, p = [];
  p.push(t(M, y+24, 22, '汉字笔顺练习', 'font-weight="700" fill="#1F3A5F"') + t(M+140, y+24, 14, 'Stroke Order Practice', 'fill="#5F6B7A"'));
  if (o.nameLine) p.push(t(W-M-200, y+24, 13, '姓名 Name ______________', 'fill="#5F6B7A" text-anchor="end"') + t(W-M, y+24, 13, '日期 Date ______________', 'fill="#5F6B7A" text-anchor="end"'));
  y += 38; p.push(`<rect x="${M}" y="${y}" width="${CW}" height="2" fill="#1F3A5F"/>`); y += 6;
  for (const ch of state.chars){
    const d = cache[ch], info = state.info[ch]; y += 18;
    p.push(bigChar(d, o.grid, `x="${M}" y="${y}" width="146" height="146"`));
    p.push(t(M+170, y+46, 34, info.pinyin, 'font-weight="600" fill="#1F3A5F"'));
    wrap(info.meaning || '', 62).forEach((ln, i) => p.push(t(M+170, y+80+i*20, 16, ln, 'fill="#1E2635"')));
    p.push(t(M+170, y+128, 13, `笔画 Strokes ${d.strokes.length}`, 'fill="#5F6B7A"'));
    if (info.radical) p.push(t(M+290, y+128, 13, `部首 Radical ${info.radical}`, 'fill="#5F6B7A"'));
    y += 146 + 26; p.push(t(M, y, 12.5, '笔顺 Stroke order', 'fill="#5F6B7A"')); y += 8;
    const S = 66, G = 8, per = Math.floor((CW + G) / (S + G));
    d.strokes.forEach((_, i) => {
      const x = M + (i % per) * (S + G), yy = y + Math.floor(i / per) * (S + G);
      p.push(stepCell(d, i, o.grid, `x="${x}" y="${yy}" width="${S}" height="${S}"`) + t(x+4, yy+12, 10, i+1, 'fill="#5F6B7A" font-weight="600"'));
    });
    y += Math.ceil(d.strokes.length / per) * (S + G) + 14;
    p.push(t(M, y, 12.5, '练习 Practice', 'fill="#5F6B7A"')); y += 8;
    const cs = CW / o.cols;
    practiceKinds(o).forEach((k, i) => p.push(cell(practiceInner(d,k), o.grid,
      `x="${M + (i % o.cols)*cs}" y="${y + Math.floor(i / o.cols)*cs}" width="${cs}" height="${cs}"`)));
    y += o.rows * cs + 20;
    p.push(`<line x1="${M}" y1="${y}" x2="${W-M}" y2="${y}" stroke="#D7DDE4" stroke-dasharray="4 4"/>`);
  }
  y += 18; p.push(t(W-M, y, 11, 'clsteachingtools.com · 笔顺数据 Make Me a Hanzi', 'fill="#8A94A1" text-anchor="end"'));
  const H = Math.ceil(y + M/2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${p.join('')}</svg>`;
}

/* ---------- Export ---------- */
const fname = ext => `stroke-order-${state.chars.join('')}.${ext}`;
function download(blob, name){
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const ready = () => { if (!state.chars.length){ $('#status').textContent = '请先生成练习纸。'; return false; } return true; };
$('#dlSvg').onclick = () => { if (ready()) download(new Blob([buildSVG()], {type:'image/svg+xml'}), fname('svg')); };
$('#dlPng').onclick = () => {
  if (!ready()) return;
  const svg = buildSVG(), img = new Image(), scale = 2.5;
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.width*scale; c.height = img.height*scale;
    const ctx = c.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0);
    c.toBlob(b => download(b, fname('png')), 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};
function embedCode(){
  const body = $('#worksheet').innerHTML.replace(/ contenteditable="true"| data-ch="[^"]*"| data-k="[^"]*"/g, '');
  return `<style>\n${$('#ws-css').textContent.trim()}\n</style>\n<div class="cls-ws">\n${body}\n</div>`;
}
$('#embed').onclick = () => { if (!ready()) return; $('#code').value = embedCode(); $('#modal').classList.add('open'); $('#copyCode').focus(); };
$('#copyCode').onclick = async () => {
  try { await navigator.clipboard.writeText($('#code').value); } catch(e){ $('#code').select(); document.execCommand('copy'); }
  $('#copyCode').textContent = '已复制'; setTimeout(() => $('#copyCode').textContent = '复制代码', 1500);
};
$('#dlHtml').onclick = () => download(new Blob([`<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>汉字笔顺练习 ${state.chars.join('')}</title></head><body style="margin:0;padding:16px;background:#F4F6F1">\n${embedCode()}\n</body></html>`], {type:'text/html'}), fname('html'));
$('#closeModal').onclick = () => $('#modal').classList.remove('open');
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') e.target.classList.remove('open'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#modal').classList.remove('open'); });
$('#print').onclick = () => window.print();
$('#share').onclick = async () => {
  const o = opts(), u = new URL(location.href);
  u.search = new URLSearchParams({ chars: state.chars.join('') || $('#chars').value, grid:o.grid, cols:o.cols, rows:o.rows, trace:o.trace }).toString();
  try { await navigator.clipboard.writeText(u.toString()); $('#status').textContent = '分享链接已复制。'; }
  catch(e){ prompt('复制这个链接：', u.toString()); }
};

/* ---------- Wire up ---------- */
$('#go').onclick = generate;
$('#chars').addEventListener('keydown', e => { if (e.key === 'Enter') generate(); });
['#grid','#cols','#rows','#trace','#rowTrace','#nameLine'].forEach(id => $(id).addEventListener('change', () => state.chars.length && render()));

// URL params: ?chars=大小&grid=mi&cols=8&rows=3&trace=4  (handy for linking from the Word List Library)
const q = new URLSearchParams(location.search);
for (const k of ['chars','grid','cols','rows','trace']) if (q.get(k)) $('#' + k).value = q.get(k);
generate();
