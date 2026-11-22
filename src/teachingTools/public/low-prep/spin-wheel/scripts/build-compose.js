'use strict';
// Builds data/compose.json.gz for the Hanzi Wheel mode of the Spin Wheel Craft.
// Usage: node scripts/build-compose.js
//
// Each key is "<position><part><fixed>" and lists characters made of those two parts,
// most common first, e.g. "l钅十": ["针"], "t艹早": ["草"].
//   l = the part is on the left   (⿰ part fixed)
//   r = the part is on the right  (⿰ fixed part)
//   t = the part is on top        (⿱ part fixed)
//   b = the part is at the bottom (⿱ fixed part)
// Source: Make Me a Hanzi dictionary.txt (LGPL, see data/COPYING-makemeahanzi.txt),
// all characters, with those in the HSK 2012 levels 1–6 list first so the common one is suggested.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

async function text(url) {
  const response = await fetch(url);
  if (!response.ok) throw Error(url + ': ' + response.status);
  return response.text();
}

async function main() {
  const hsk = await text('https://raw.githubusercontent.com/glxxyz/hskhsk.com/main/data/lists/HSK%20Official%202012%201-6%20Sorted.txt');
  // Rank: the order in which a character first appears in the list (it is sorted by level).
  const rank = new Map();
  for (const ch of hsk.match(/\p{Script=Han}/gu)) if (!rank.has(ch)) rank.set(ch, rank.size);

  const dictionary = await text('https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt');
  const output = {};
  for (const line of dictionary.split('\n').filter(Boolean)) {
    const entry = JSON.parse(line);
    const parts = Array.from(entry.decomposition || '');
    if (parts.length !== 3 || /[？?]/.test(entry.decomposition)) continue;
    const [shape, first, second] = parts;
    const keys = shape === '⿰' ? ['l' + first + second, 'r' + second + first]
      : shape === '⿱' ? ['t' + first + second, 'b' + second + first] : [];
    for (const key of keys) (output[key] = output[key] || []).push(entry.character);
  }
  for (const key of Object.keys(output)) output[key].sort((a, b) => (rank.has(a) ? rank.get(a) : 1e6) - (rank.has(b) ? rank.get(b) : 1e6));
  const json = JSON.stringify(output);
  // Gzipped like vocab-glossary's cedict.json.gz; the page unpacks it with DecompressionStream.
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'compose.json.gz'), zlib.gzipSync(json, { level: 9 }));
  console.log(Object.keys(output).length + ' keys; ' + Buffer.byteLength(json) + ' bytes');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
