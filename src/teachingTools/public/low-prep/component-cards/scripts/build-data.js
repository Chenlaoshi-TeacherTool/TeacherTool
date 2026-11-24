'use strict';
// Builds data/components.json.gz for 部件卡片 · Component Cards.
//
// Usage: node scripts/build-data.js [dictionary.txt] [folder with HSK L1.txt … L6.txt]
// Without a path it downloads dictionary.txt from GitHub.
//
// Each entry:  "好": ["女子", "000111"]
//   [0] the top-level parts, one character each ("？" when the part has no
//       single-character name, e.g. the left half of 那)
//   [1] the part index of every stroke, in stroke order ("x" = unknown)
// Characters that do not split (水, 人) get ["", "xxxx"] and are drawn in one colour.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OPS = { '⿰': 2, '⿱': 2, '⿲': 3, '⿳': 3, '⿴': 2, '⿵': 2, '⿶': 2, '⿷': 2, '⿸': 2, '⿹': 2, '⿺': 2, '⿻': 2 };

// Top-level children of an IDS string, as strings.
function topParts(ids) {
  const chars = Array.from(ids || '');
  if (!chars.length || !OPS[chars[0]]) return null;
  let i = 1;
  function skip() {
    const c = chars[i++];
    if (OPS[c]) for (let k = 0; k < OPS[c]; k++) skip();
  }
  const parts = [];
  for (let k = 0; k < OPS[chars[0]]; k++) {
    const start = i;
    skip();
    parts.push(chars.slice(start, i).join(''));
  }
  return i === chars.length ? parts : null;
}

// data/common-order.txt: HSK 1–6 (2012) characters, easiest first: by the level
// of the first word they appear in, then by that word's frequency. The
// component family view lists its suggestions in this order.
async function writeOrder(hskDir) {
  const seen = new Set();
  let order = '';
  for (let level = 1; level <= 6; level++) {
    const name = 'HSK Official With Definitions 2012 L' + level + ' freqorder.txt';
    const text = hskDir
      ? fs.readFileSync(path.join(hskDir, 'L' + level + '.txt'), 'utf8')
      : await (await fetch('https://raw.githubusercontent.com/glxxyz/hskhsk.com/main/data/lists/' + encodeURIComponent(name))).text();
    for (const line of text.replace(/^﻿/, '').split('\n')) {
      for (const ch of (line.split('\t')[0] || '').match(/\p{Script=Han}/gu) || []) {
        if (!seen.has(ch)) { seen.add(ch); order += ch; }
      }
    }
  }
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'common-order.txt'), order);
  console.log(seen.size + ' characters in common-order.txt');
}

// Usage: node scripts/build-data.js [dictionary.txt] [folder with L1.txt … L6.txt]
async function main() {
  await writeOrder(process.argv[3]);
  const text = process.argv[2]
    ? fs.readFileSync(process.argv[2], 'utf8')
    : await (await fetch('https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt')).text();
  const out = {};
  let split = 0;
  for (const line of text.split('\n').filter(Boolean)) {
    const entry = JSON.parse(line);
    const matches = entry.matches || [];
    const parts = topParts(entry.decomposition);
    const strokes = matches.map(m => (parts && m && m.length && m[0] < parts.length ? String(m[0]) : 'x')).join('');
    const used = new Set(strokes.replace(/x/g, ''));
    if (!parts || used.size < 2) {
      out[entry.character] = ['', 'x'.repeat(matches.length)];
      continue;
    }
    split++;
    out[entry.character] = [parts.map(p => (Array.from(p).length === 1 && p !== '？' ? p : '？')).join(''), strokes];
  }
  const json = JSON.stringify(out);
  const target = path.join(__dirname, '..', 'data', 'components.json.gz');
  fs.writeFileSync(target, zlib.gzipSync(json, { level: 9 }));
  console.log(Object.keys(out).length + ' characters (' + split + ' split); ' + json.length + ' bytes raw, ' + fs.statSync(target).size + ' gzipped');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
