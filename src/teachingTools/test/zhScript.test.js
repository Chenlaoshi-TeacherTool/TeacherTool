const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const Zh = require('../public/shared/zh-script.js');
const data = require('../public/shared/zh-script-data.json');

const CLASSROOM = {
  我的头发和面条: '我的頭髮和麵條',
  两只喜鹊在树上以后再说: '兩隻喜鵲在樹上以後再說',
  里面很干净: '裏面很乾淨',
  为什么大家都在床上: '為什麼大家都在床上',
  饼干和面包: '餅乾和麵包',
  准备好了吗: '準備好了嗎',
  他看着我: '他看着我',
  我只有一只猫: '我只有一隻貓',
  几点钟: '幾點鐘',
  闹钟: '鬧鐘',
  手表: '手錶',
  松树和放松: '松樹和放鬆',
  系鞋带和关系: '繫鞋帶和關係',
  复习历史和日历: '複習歷史和日曆',
  秋千: '鞦韆',
  胡子和胡须: '鬍子和鬍鬚',
  衣服干了: '衣服乾了',
  头发干了: '頭髮乾了',
  干活: '幹活',
  了解: '了解',
  一群羊在山峰上: '一群羊在山峰上',
  // from the site's own text
  本页面包含: '本頁面包含',
  吃面包: '吃麵包',
  词库列表转换: '詞庫列表轉換',
  表格里: '表格裏',
  三天后过期: '三天後過期',
  已批准并发布: '已批准並發布'
};

test('classroom words convert to 通用繁体', () => {
  Object.keys(CLASSROOM).forEach((simplified) => {
    assert.equal(Zh.toTraditional(simplified), CLASSROOM[simplified], simplified);
  });
});

test('traditional converts back to simplified', () => {
  Object.keys(CLASSROOM).forEach((simplified) => {
    assert.equal(Zh.toSimplified(CLASSROOM[simplified]), simplified, CLASSROOM[simplified]);
  });
  assert.equal(Zh.toSimplified('裡面著急'), '里面着急');
});

test('old orthography forms never appear in the output', () => {
  const traditional = Array.from(data.s2tChars).filter((_, i) => i % 2 === 1).join('');
  ['爲', '衆', '僞', '牀', '羣', '峯', '麪', '纔', '脣'].forEach((ch) => {
    assert.equal(traditional.includes(ch), false, ch);
    assert.equal(data.s2tPhrases.includes(ch), false, ch);
  });
});

test('punctuation, latin text, pinyin and emoji pass through unchanged', () => {
  const mixed = 'Hello，nǐ hǎo！😀 123 ABC：“”';
  assert.equal(Zh.toTraditional(mixed), mixed);
  assert.equal(Zh.toSimplified(mixed), mixed);
  assert.equal(Zh.toTraditional(null), '');
  assert.equal(Zh.toTraditional(undefined), '');
});

test('convert follows the script flag', () => {
  assert.equal(Zh.convert('头发', 't'), '頭髮');
  assert.equal(Zh.convert('头发', 'zh-Hant'), '頭髮');
  assert.equal(Zh.convert('头发', 's'), '头发');
  assert.equal(Zh.convert('头发'), '头发');
});

// Every Chinese string on the site keeps its length, so pinyin stays aligned.
test('site text keeps its length after conversion', () => {
  const root = path.join(__dirname, '..');
  const files = [path.join(root, 'locales', 'translations.js')];
  const walk = (dir, ext) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!/vendor|pdfjs|node_modules/.test(entry.name)) walk(full, ext); }
    else if (entry.name.endsWith(ext) && !/\.min\.|umd|iife|zh-script-data/.test(entry.name)) files.push(full);
  });
  walk(path.join(root, 'views'), '.ejs');
  walk(path.join(root, 'public'), '.js');
  let runs = 0;
  files.forEach((file) => {
    (fs.readFileSync(file, 'utf8').match(/[㐀-鿿豈-﫿]+/g) || []).forEach((run) => {
      runs += 1;
      assert.equal(Array.from(Zh.toTraditional(run)).length, Array.from(run).length, run);
    });
  });
  assert.ok(runs > 1000);
});

test('a browser-style table load works the same as the node load', () => {
  const fresh = require('../public/shared/zh-script.js');
  fresh.useTable(data);
  assert.equal(fresh.hasTable(), true);
  assert.equal(fresh.toTraditional('头发'), '頭髮');
  assert.throws(() => fresh.useTable({}), /Not a zh-script table/);
});
