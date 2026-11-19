/* 像素画猜猜看 · shared core used by the teacher page and both student pages.
 * A drawing is a string of grid×grid hex characters: '0' is an empty square,
 * '1'–'f' index into PALETTE. Keep PALETTE order stable — saved drawings and
 * submissions depend on it. */
(function (global) {
  'use strict';

  var PALETTE = [
    null,
    { hex: '#212121', zh: '黑色', en: 'black' },
    { hex: '#ffffff', zh: '白色', en: 'white' },
    { hex: '#9e9e9e', zh: '灰色', en: 'gray' },
    { hex: '#e53935', zh: '红色', en: 'red' },
    { hex: '#fb8c00', zh: '橙色', en: 'orange' },
    { hex: '#fdd835', zh: '黄色', en: 'yellow' },
    { hex: '#8bc34a', zh: '浅绿色', en: 'light green' },
    { hex: '#2e7d32', zh: '深绿色', en: 'dark green' },
    { hex: '#4fc3f7', zh: '浅蓝色', en: 'light blue' },
    { hex: '#1e5bc6', zh: '蓝色', en: 'blue' },
    { hex: '#8e44ad', zh: '紫色', en: 'purple' },
    { hex: '#f48fb1', zh: '粉红色', en: 'pink' },
    { hex: '#8d5524', zh: '咖啡色', en: 'brown' },
    { hex: '#f6c7a1', zh: '肤色', en: 'peach' },
    { hex: '#d7a86e', zh: '浅棕色', en: 'tan' }
  ];
  var GRID_SIZES = [12, 16, 20, 24];
  var PNG_KEY = 'chen-pixel-art';
  var KAI = 'KaiTi, STKaiti, "Kaiti SC", "楷体", "BiauKai", serif';

  var DEFAULT_TITLE = '我的爱好像素画';
  var DEFAULT_WORDS = [
    '# 在家 · 室内 At home & indoors',
    '看书',
    '上网',
    '听音乐',
    '看电影',
    '看电视',
    '玩电脑',
    '唱歌',
    '跳舞',
    '# 运动 · 户外 Sports & outdoors',
    '锻炼',
    '体育',
    '游泳',
    '跑步',
    '爬山',
    '骑自行车',
    '钓鱼',
    '太极',
    '功夫',
    '# 球类运动 Ball games',
    '打球',
    '打乒乓球',
    '打羽毛球',
    '打棒球',
    '打篮球',
    '打排球',
    '打橄榄球',
    '踢足球'
  ].join('\n');
  // The worksheet's own pinyin and English for the default words (better than the dictionary's).
  var KNOWN = {
    '看书': ['kàn shū', 'read books'],
    '上网': ['shàng wǎng', 'go online'],
    '听音乐': ['tīng yīnyuè', 'listen to music'],
    '看电影': ['kàn diànyǐng', 'watch movies'],
    '看电视': ['kàn diànshì', 'watch TV'],
    '玩电脑': ['wán diànnǎo', 'play on the computer'],
    '唱歌': ['chàng gē', 'sing'],
    '跳舞': ['tiào wǔ', 'dance'],
    '锻炼': ['duànliàn', 'exercise, work out'],
    '体育': ['tǐyù', 'sports, P.E.'],
    '游泳': ['yóu yǒng', 'swim'],
    '跑步': ['pǎo bù', 'run, jog'],
    '爬山': ['pá shān', 'hike, climb mountains'],
    '骑自行车': ['qí zìxíngchē', 'ride a bike'],
    '钓鱼': ['diào yú', 'go fishing'],
    '太极': ['tàijí', 'tai chi'],
    '功夫': ['gōngfu', 'kung fu'],
    '打球': ['dǎ qiú', 'play ball'],
    '打乒乓球': ['dǎ pīngpāngqiú', 'play ping-pong'],
    '打羽毛球': ['dǎ yǔmáoqiú', 'play badminton'],
    '打棒球': ['dǎ bàngqiú', 'play baseball'],
    '打篮球': ['dǎ lánqiú', 'play basketball'],
    '打排球': ['dǎ páiqiú', 'play volleyball'],
    '打橄榄球': ['dǎ gǎnlǎnqiú', 'play (American) football'],
    '踢足球': ['tī zúqiú', 'play soccer']
  };
  var DEFAULT_PROMPTS = [
    '我的爱好是____。',
    '我常常跟____一起____。',
    '我喜欢____，因为____。',
    '我不喜欢____，因为____。'
  ].join('\n');

  // ---------- word list text ⇄ words ----------
  function parseWords(text) {
    var group = '';
    var words = [];
    var seen = {};
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.replace(/　/g, ' ').trim();
      if (!line) return;
      if (line.charAt(0) === '#') { group = line.slice(1).trim().slice(0, 30); return; }
      var item = global.ChenWordlist ? global.ChenWordlist.parseLine(line) : { zh: line.split('|')[0].trim(), py: '', en: '' };
      if (!item || !item.zh) return;
      var zh = item.zh.slice(0, 20);
      // A bare word from the default list keeps the worksheet's pinyin and English.
      if (!/[|｜,，\t]/.test(line) && !/\s/.test(line) && KNOWN[zh]) item = { zh: zh, py: KNOWN[zh][0], en: KNOWN[zh][1] };
      if (seen[zh]) return;
      seen[zh] = true;
      words.push({ zh: zh, py: String(item.py || '').slice(0, 60), en: String(item.en || '').slice(0, 60), group: group });
    });
    return words;
  }

  function parsePrompts(text) {
    return String(text || '').split(/\r?\n/).map(function (line) { return line.trim().slice(0, 80); }).filter(Boolean).slice(0, 6);
  }

  // A prompt like "我常常跟____一起____。" → ['我常常跟', '一起', '。'] (inputs go between parts).
  var BLANK = /_{2,}|＿+|（\s*）|\(\s*\)/;
  function promptParts(prompt) {
    var parts = String(prompt).split(BLANK);
    if (parts.length === 1) parts.push('');
    return parts;
  }

  function cleanConfig(config) {
    config = config || {};
    var grid = Number(config.grid);
    return {
      title: String(config.title || '').trim().slice(0, 120) || DEFAULT_TITLE,
      grid: GRID_SIZES.indexOf(grid) === -1 ? 16 : grid,
      words: Array.isArray(config.words) ? config.words.slice(0, 80) : [],
      prompts: Array.isArray(config.prompts) ? config.prompts.slice(0, 6) : [],
      show: { py: !config.show || config.show.py !== false, en: !config.show || config.show.en !== false }
    };
  }

  // ---------- config in a URL hash (free student link, nothing stored) ----------
  function toBase64Url(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(value) {
    var binary = atob(String(value).replace(/-/g, '+').replace(/_/g, '/'));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encodeConfig(config) {
    var c = cleanConfig(config);
    return toBase64Url(JSON.stringify({ t: c.title, g: c.grid, w: c.words.map(function (w) { return [w.zh, w.py || '', w.en || '', w.group || '']; }), p: c.prompts, s: [c.show.py ? 1 : 0, c.show.en ? 1 : 0] }));
  }

  function decodeConfig(value) {
    try {
      var raw = JSON.parse(fromBase64Url(value));
      return cleanConfig({
        title: raw.t, grid: raw.g, show: Array.isArray(raw.s) ? { py: raw.s[0] !== 0, en: raw.s[1] !== 0 } : null, prompts: Array.isArray(raw.p) ? raw.p.map(String) : [],
        words: (Array.isArray(raw.w) ? raw.w : []).filter(Array.isArray).map(function (w) {
          return { zh: String(w[0] || '').slice(0, 20), py: String(w[1] || '').slice(0, 60), en: String(w[2] || '').slice(0, 60), group: String(w[3] || '').slice(0, 30) };
        }).filter(function (w) { return w.zh; })
      });
    } catch (error) {
      return null;
    }
  }

  // ---------- drawing ----------
  function emptyPixels(grid) { return new Array(grid * grid + 1).join('0'); }

  function validPixels(pixels, grid) {
    return typeof pixels === 'string' && pixels.length === grid * grid && /^[0-9a-f]*$/.test(pixels);
  }

  function colorAt(pixels, index) {
    var entry = PALETTE[parseInt(pixels.charAt(index), 16)];
    return entry ? entry.hex : null;
  }

  // Draws a finished picture: white background, no grid lines unless asked.
  function drawArt(canvas, pixels, grid, size, options) {
    options = options || {};
    var cell = Math.max(1, Math.floor(size / grid));
    canvas.width = cell * grid;
    canvas.height = cell * grid;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < grid * grid; i += 1) {
      var color = colorAt(pixels, i);
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect((i % grid) * cell, Math.floor(i / grid) * cell, cell, cell);
    }
    if (options.gridLines) {
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      for (var line = 1; line < grid; line += 1) {
        ctx.beginPath(); ctx.moveTo(line * cell + 0.5, 0); ctx.lineTo(line * cell + 0.5, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, line * cell + 0.5); ctx.lineTo(canvas.width, line * cell + 0.5); ctx.stroke();
      }
    }
    return canvas;
  }

  function artDataUrl(pixels, grid, size, options) {
    return drawArt(document.createElement('canvas'), pixels, grid, size || 240, options).toDataURL('image/png');
  }

  // ---------- PNG with the drawing embedded (free path: students send the file) ----------
  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n += 1) {
      var c = n;
      for (var k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  // tEXt is Latin-1 only, so non-ASCII characters are written as JSON \u escapes.
  function asciiJson(value) {
    return JSON.stringify(value).replace(/[\u007f-￿]/g, function (ch) { return '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4); });
  }

  function textChunk(keyword, text) {
    var data = new Uint8Array(keyword.length + 1 + text.length);
    for (var i = 0; i < keyword.length; i += 1) data[i] = keyword.charCodeAt(i);
    for (var j = 0; j < text.length; j += 1) data[keyword.length + 1 + j] = text.charCodeAt(j);
    var chunk = new Uint8Array(12 + data.length);
    var view = new DataView(chunk.buffer);
    view.setUint32(0, data.length);
    chunk.set([116, 69, 88, 116], 4); // "tEXt"
    chunk.set(data, 8);
    view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
    return chunk;
  }

  function withTextChunk(pngBytes, keyword, text) {
    var ihdrEnd = 8 + 12 + new DataView(pngBytes.buffer, pngBytes.byteOffset).getUint32(8);
    var chunk = textChunk(keyword, text);
    var out = new Uint8Array(pngBytes.length + chunk.length);
    out.set(pngBytes.subarray(0, ihdrEnd), 0);
    out.set(chunk, ihdrEnd);
    out.set(pngBytes.subarray(ihdrEnd), ihdrEnd + chunk.length);
    return out;
  }

  function readTextChunk(buffer, keyword) {
    var bytes = new Uint8Array(buffer);
    var signature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (var s = 0; s < 8; s += 1) if (bytes[s] !== signature[s]) return null;
    var view = new DataView(buffer);
    var offset = 8;
    while (offset + 12 <= bytes.length) {
      var length = view.getUint32(offset);
      var type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
      if (type === 'tEXt') {
        var data = bytes.subarray(offset + 8, offset + 8 + length);
        var zero = data.indexOf(0);
        var key = '';
        for (var k = 0; k < zero; k += 1) key += String.fromCharCode(data[k]);
        if (key === keyword) {
          var text = '';
          for (var t = zero + 1; t < data.length; t += 1) text += String.fromCharCode(data[t]);
          return text;
        }
      }
      if (type === 'IEND') break;
      offset += 12 + length;
    }
    return null;
  }

  function wrapText(ctx, text, maxWidth) {
    var lines = [];
    var line = '';
    Array.from(String(text)).forEach(function (ch) {
      if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ch.trim() ? ch : ''; }
      else line += ch;
    });
    if (line) lines.push(line);
    return lines;
  }

  // The card students download: picture + name + title. The answer is NOT drawn
  // on the card (so printed copies still work for guessing); it rides along in
  // the PNG's text chunk for the teacher's gallery import.
  function workCanvas(work, config) {
    var grid = config.grid;
    var cell = Math.max(12, Math.floor(480 / grid));
    var art = drawArt(document.createElement('canvas'), work.pixels, grid, cell * grid);
    var pad = 32;
    var canvas = document.createElement('canvas');
    canvas.width = art.width + pad * 2;
    canvas.height = art.height + pad * 2 + 70;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1f2937';
    ctx.font = '26px ' + KAI;
    ctx.textAlign = 'center';
    ctx.fillText(wrapText(ctx, config.title, canvas.width - pad * 2)[0] || '', canvas.width / 2, pad);
    ctx.drawImage(art, pad, pad + 14);
    ctx.strokeStyle = '#d1d5db';
    ctx.strokeRect(pad - 0.5, pad + 13.5, art.width + 1, art.height + 1);
    ctx.font = '24px ' + KAI;
    ctx.fillText((work.studentName ? work.studentName + ' · ' : '') + '我画的是什么？', canvas.width / 2, pad + 14 + art.height + 40);
    return canvas;
  }

  function workPngBlob(work, config) {
    return new Promise(function (resolve, reject) {
      workCanvas(work, config).toBlob(function (blob) {
        if (!blob) return reject(new Error('Could not make the picture.'));
        blob.arrayBuffer().then(function (buffer) {
          var info = {
            v: 1, title: config.title, grid: config.grid, studentName: work.studentName || '', word: work.word,
            pixels: work.pixels, sentences: work.sentences || [],
            entry: config.words.filter(function (w) { return w.zh === work.word; })[0] || null
          };
          resolve(new Blob([withTextChunk(new Uint8Array(buffer), PNG_KEY, asciiJson(info))], { type: 'image/png' }));
        }, reject);
      }, 'image/png');
    });
  }

  function readWorkFromPng(buffer) {
    var text = readTextChunk(buffer, PNG_KEY);
    if (!text) return null;
    try {
      var info = JSON.parse(text);
      var grid = Number(info.grid);
      if (GRID_SIZES.indexOf(grid) === -1 || !validPixels(info.pixels, grid)) return null;
      return {
        studentName: String(info.studentName || '').slice(0, 80), word: String(info.word || '').slice(0, 20), grid: grid, pixels: info.pixels,
        sentences: Array.isArray(info.sentences) ? info.sentences.map(String).slice(0, 6) : [],
        entry: info.entry && info.entry.zh ? { zh: String(info.entry.zh), py: String(info.entry.py || ''), en: String(info.entry.en || '') } : null,
        title: String(info.title || '')
      };
    } catch (error) {
      return null;
    }
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function safeFilename(text) {
    return String(text || 'pixel-art').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 40) || 'pixel-art';
  }

  global.PixelArtCore = {
    PALETTE: PALETTE, KAI: KAI, GRID_SIZES: GRID_SIZES, DEFAULT_TITLE: DEFAULT_TITLE, DEFAULT_WORDS: DEFAULT_WORDS, DEFAULT_PROMPTS: DEFAULT_PROMPTS,
    parseWords: parseWords, parsePrompts: parsePrompts, promptParts: promptParts, cleanConfig: cleanConfig,
    encodeConfig: encodeConfig, decodeConfig: decodeConfig,
    emptyPixels: emptyPixels, validPixels: validPixels, drawArt: drawArt, artDataUrl: artDataUrl,
    workPngBlob: workPngBlob, readWorkFromPng: readWorkFromPng, downloadBlob: downloadBlob, safeFilename: safeFilename
  };
})(window);
