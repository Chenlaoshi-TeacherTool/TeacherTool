#!/usr/bin/env node
/*
 * Builds public/shared/zh-script-data.json, the 简 ⇄ 繁 table used by
 * public/shared/zh-script.js (browser + server).
 *
 * Source: OpenCC dictionaries (Apache-2.0), https://github.com/BYVoid/OpenCC
 *   data/dictionary/STCharacters.txt  STPhrases.txt  TSCharacters.txt  TSPhrases.txt
 * Download those four files into one folder, then:
 *   node scripts/build-zh-script.js <folder-with-opencc-txt> [opencc-commit]
 *
 * Target = 通用繁体: OpenCC's standard forms, then the forms Taiwan and Hong Kong
 * both use (爲→為, 衆→眾, 僞→偽 …, from OpenCC's TWVariants ∩ HKVariants) plus
 * 牀→床, 羣→群, 峯→峰, 麪→麵. Where the two regions differ (裏/裡, 着/著, 啓/啟)
 * the OpenCC standard form stays.
 *
 * Every entry keeps the length (one character in, one out), so pinyin and
 * highlights computed on the simplified text still line up after conversion.
 * Only phrases that change the result compared with character-by-character
 * conversion are kept; the script then checks the small table against the full
 * phrase list and adds back any phrase it needs.
 */
'use strict';

var fs = require('fs');
var path = require('path');

var COMMON_FORMS = {
  // TWVariants ∩ HKVariants (both regions agree)
  '僞': '偽', '喫': '吃', '嬀': '媯', '棱': '稜', '潙': '溈', '潨': '潀', '爲': '為', '癡': '痴', '皁': '皂',
  '竈': '灶', '糉': '粽', '纔': '才', '脣': '唇', '蔿': '蒍', '衆': '眾', '覈': '核', '踊': '踴', '鉢': '缽', '鍼': '針',
  // everyday forms in both regions' textbooks
  '牀': '床', '羣': '群', '峯': '峰', '麪': '麵'
};

// Classroom fixes on top of OpenCC (checked on teaching vocabulary). Same length only.
var SITE_S2T_CHARS = {
  '钟': '鐘' // clock / bell is far more common in class than the surname 鍾
};
var SITE_S2T_PHRASES = {
  '头发干': '頭髮乾', '衣服干': '衣服乾', '毛巾干': '毛巾乾', '干手': '乾手',
  // found in the site's own text (output of the review list)
  '面包含': '面包含', '面包括': '面包括', // 页面包含 ≠ 頁麵包含
  '列表': '列表', '表转换': '表轉換', '格里': '格裏', '天后': '天後', '并发布': '並發布',
  '了解': '了解' // both regions accept 了解; OpenCC gives 瞭解
};
// Teachers may type Taiwan forms; 著 as the particle zhe / zháo must come back as 着
// so pinyin and dictionary lookups work (著作 / 显著 stay 著).
var SITE_T2S_PHRASES = {};
('看聽穿拿坐站躺等笑說走跑唱寫想戴開關接跟順沿朝向為照隨找睡')
  .split('').forEach(function (ch) { SITE_T2S_PHRASES[ch + '著'] = null; });
['著急', '著涼', '著火', '意味著', '用不著', '睡不著', '摸不著', '找不著', '著迷'].forEach(function (word) { SITE_T2S_PHRASES[word] = null; });

function chars(value) { return Array.from(value); }

function readDict(dir, name) {
  var map = new Map();
  fs.readFileSync(path.join(dir, name), 'utf8').split(/\r?\n/).forEach(function (line) {
    if (!line || line.charAt(0) === '#') return;
    var parts = line.split('\t');
    if (parts.length < 2) return;
    var first = parts[1].trim().split(' ')[0];
    if (first) map.set(parts[0], first);
  });
  return map;
}

function commonForms(value) {
  return chars(value).map(function (ch) { return COMMON_FORMS[ch] || ch; }).join('');
}

// Maximum forward matching, same as OpenCC, restricted to equal-length entries.
function makeConverter(charMap, phraseMap) {
  var maxLen = 1;
  phraseMap.forEach(function (_, key) { maxLen = Math.max(maxLen, chars(key).length); });
  return function (text) {
    var list = chars(text);
    var out = [];
    for (var i = 0; i < list.length;) {
      var done = false;
      for (var len = Math.min(maxLen, list.length - i); len >= 2; len -= 1) {
        var hit = phraseMap.get(list.slice(i, i + len).join(''));
        if (hit !== undefined) { out.push(hit); i += len; done = true; break; }
      }
      if (!done) { out.push(charMap.get(list[i]) || list[i]); i += 1; }
    }
    return out.join('');
  };
}

function build(charFile, phraseFile, dir, transform, siteChars, sitePhrases) {
  var charMap = new Map();
  readDict(dir, charFile).forEach(function (value, key) {
    if (chars(key).length !== 1) return;
    var target = transform(value);
    if (chars(target).length === 1 && target !== key) charMap.set(key, target);
  });
  Object.keys(siteChars || {}).forEach(function (key) { charMap.set(key, siteChars[key]); });

  var allPhrases = new Map();
  readDict(dir, phraseFile).forEach(function (value, key) {
    var target = transform(value);
    if (chars(key).length >= 2 && chars(key).length === chars(target).length) allPhrases.set(key, target);
  });
  Object.keys(sitePhrases || {}).forEach(function (key) {
    // null = convert by character, with 著 read as the particle 着
    var target = sitePhrases[key] !== null ? sitePhrases[key]
      : chars(key).map(function (ch) { return ch === '著' ? '着' : (charMap.get(ch) || ch); }).join('');
    if (chars(key).length !== chars(target).length) throw new Error('Length differs: ' + key);
    allPhrases.set(key, target);
  });

  var byChar = makeConverter(charMap, new Map());
  var phrases = new Map();
  allPhrases.forEach(function (value, key) { if (byChar(key) !== value) phrases.set(key, value); });

  // Dropping a phrase can change how its neighbours match; add back whatever
  // the full list needs until both give the same result on every phrase.
  var full = makeConverter(charMap, allPhrases);
  for (var round = 0; round < 10; round += 1) {
    var small = makeConverter(charMap, phrases);
    var added = 0;
    allPhrases.forEach(function (value, key) {
      if (small(key) !== full(key) && !phrases.has(key)) { phrases.set(key, value); added += 1; }
    });
    if (!added) break;
  }
  var check = makeConverter(charMap, phrases);
  var mismatches = [];
  allPhrases.forEach(function (_, key) { if (check(key) !== full(key)) mismatches.push(key); });

  return { charMap: charMap, phrases: phrases, total: allPhrases.size, mismatches: mismatches };
}

function packChars(map) {
  var out = '';
  Array.from(map.keys()).sort().forEach(function (key) { out += key + map.get(key); });
  return out;
}

function packPhrases(map) {
  return Array.from(map.keys()).sort().map(function (key) { return key + map.get(key); }).join(' ');
}

function main() {
  var dir = process.argv[2];
  if (!dir) { console.error('usage: node scripts/build-zh-script.js <opencc-dictionary-folder> [commit]'); process.exit(1); }
  var commit = process.argv[3] || '';

  var s2t = build('STCharacters.txt', 'STPhrases.txt', dir, commonForms, SITE_S2T_CHARS, SITE_S2T_PHRASES);
  var t2s = build('TSCharacters.txt', 'TSPhrases.txt', dir, function (value) { return value; }, null, SITE_T2S_PHRASES);
  // The common forms must convert back too (為 → 为 …).
  Object.keys(COMMON_FORMS).forEach(function (oldForm) {
    var simplified = t2s.charMap.get(oldForm);
    var common = COMMON_FORMS[oldForm];
    if (simplified && !t2s.charMap.has(common) && simplified !== common) t2s.charMap.set(common, simplified);
  });

  var data = {
    version: 1,
    source: 'OpenCC ' + (commit ? commit.slice(0, 12) + ' ' : '') + '(Apache-2.0) · 通用繁体 forms · built by scripts/build-zh-script.js',
    s2tChars: packChars(s2t.charMap),
    s2tPhrases: packPhrases(s2t.phrases),
    t2sChars: packChars(t2s.charMap),
    t2sPhrases: packPhrases(t2s.phrases)
  };

  var outFile = path.join(__dirname, '..', 'public', 'shared', 'zh-script-data.json');
  fs.writeFileSync(outFile, JSON.stringify(data) + '\n');

  console.log('s2t: ' + s2t.charMap.size + ' chars, ' + s2t.phrases.size + ' of ' + s2t.total + ' phrases, mismatches ' + s2t.mismatches.length);
  console.log('t2s: ' + t2s.charMap.size + ' chars, ' + t2s.phrases.size + ' of ' + t2s.total + ' phrases, mismatches ' + t2s.mismatches.length);
  if (s2t.mismatches.length) console.log('s2t mismatches: ' + s2t.mismatches.slice(0, 30).join(' '));
  console.log('wrote ' + outFile + ' (' + Math.round(fs.statSync(outFile).size / 1024) + ' KB)');
}

if (require.main === module) main();
module.exports = { COMMON_FORMS: COMMON_FORMS, makeConverter: makeConverter };
