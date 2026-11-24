'use strict';
// Builds data/component-guide.json (部件图解卡) from Chen Laoshi's component table.
//
// Usage: node scripts/build-guide.js "<path to 常用部件表_草稿.xlsx>"
//
// Sheet 部件表, one row per component:
//   位置 · 部件 · 叫法 · 意思 · English · 来自哪个字 · Emoji · 例字1–4 ("河 hé") · 更多例字 · … · 保留？(✔/✘)
// Rows marked ✘ are left out. Edit the cells directly; the "你的修改" notes column is not read.

const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');

const SIDES = { '左边（偏旁）': 'left', '右边（偏旁）': 'right', '上边（字头）': 'top', '下边（字底）': 'bottom', '外框': 'frame', '常见独立部件': 'any' };
// Extra written forms the stroke data uses for some components.
const EXTRA_FORMS = { '月|left': ['⺼'] };

function text(cell) {
  const v = cell && cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map((r) => r.text).join('').trim();
  return String(v).trim();
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Pass the path to the component table (.xlsx).');
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  const sheet = book.getWorksheet('部件表');
  const head = {};
  sheet.getRow(1).eachCell((cell, col) => { head[text(cell)] = col; });
  const col = (row, name) => text(row.getCell(head[name]));
  const out = [];
  const ids = {};
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const comp = col(row, '部件');
    if (!comp || /[✘✗xX×]/.test(col(row, '保留？（✔/✘）'))) return;
    const side = SIDES[col(row, '位置')] || 'any';
    let id = comp + '-' + side;
    while (ids[id]) id += '+';
    ids[id] = true;
    const examples = ['例字1', '例字2', '例字3', '例字4'].map((k) => col(row, k)).filter(Boolean).map((v) => {
      const [zh, ...py] = v.split(/\s+/);
      return { zh, py: py.join(' ') };
    });
    out.push({
      id, comp, side,
      forms: [comp].concat(EXTRA_FORMS[comp + '|' + side] || []),
      name: col(row, '叫法'), meaning: col(row, '意思'), en: col(row, 'English'),
      origin: col(row, '来自哪个字'), emoji: col(row, 'Emoji'), note: col(row, '备注'),
      examples, more: Array.from(col(row, '更多例字'))
    });
  });
  const target = path.join(__dirname, '..', 'data', 'component-guide.json');
  fs.writeFileSync(target, JSON.stringify(out));
  console.log(out.length + ' components → ' + target);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
