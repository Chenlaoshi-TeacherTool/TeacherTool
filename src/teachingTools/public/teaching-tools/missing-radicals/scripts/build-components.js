const fs = require('node:fs');
const path = require('node:path');
// Usage: node scripts/build-components.js [UTF-8 character-list.txt]
// Default: HSK 1–6 (2012) vocabulary plus the shipped classroom sample.
async function main() {
  const root = path.join(__dirname, '..');
  let vocabulary = fs.readFileSync(path.join(root, 'data/characters.txt'), 'utf8');
  if (process.argv[2]) vocabulary += fs.readFileSync(process.argv[2], 'utf8');
  else {
    const response = await fetch('https://raw.githubusercontent.com/glxxyz/hskhsk.com/main/data/lists/HSK%20Official%202012%201-6%20Sorted.txt');
    if (!response.ok) throw Error('HSK list: ' + response.status);
    vocabulary += await response.text();
  }
  const wanted = new Set(vocabulary.match(/\p{Script=Han}/gu));
  const response = await fetch('https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt');
  if (!response.ok) throw Error('Dictionary: ' + response.status);
  const output = {};
  for (const line of (await response.text()).split('\n').filter(Boolean)) {
    const entry = JSON.parse(line);
    if (!wanted.has(entry.character)) continue;
    // Keep the entire component path: collapsing to only its first index loses nested components.
    const groups = new Map();
    output[entry.character] = entry.matches.map(match => {
      if (!match || !match.length) return -1;
      const key = match.join('.');
      if (!groups.has(key)) groups.set(key, groups.size);
      return groups.get(key);
    });
  }
  fs.writeFileSync(path.join(root, 'data/components.json'), JSON.stringify(output));
  console.log(Object.keys(output).length + ' characters; ' + Buffer.byteLength(JSON.stringify(output)) + ' bytes');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
