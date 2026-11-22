/*
 * Dice Story (骰子故事) — shared data model.
 * Used in the browser (window.DiceStoryCore) and on the server (template sanitizer
 * for account saving, services/games/diceStoryGame.js).
 *
 * A worksheet is a list of categories, each with 6 options (die faces 1–6).
 *   layout 'table': dice across the top, one category per row (sentence-pattern table)
 *   layout 'story': dice down the left, one category per column (story grid with pictures)
 */
(function (global) {
  'use strict';

  var FACES = 6;
  var MAX_CATEGORIES = { table: 8, story: 6 };
  var LIMITS = { title: 60, prompt: 240, category: 24, cell: 40, pics: 80, pic: 40 };
  var PIC_MODES = ['both', 'pic', 'text'];
  var PIC_STYLES = ['color', 'line'];
  var WRITING = ['lines', 'grid', 'none'];
  var PAPERS = ['a4', 'letter'];
  var ORIENTS = ['landscape', 'portrait'];
  var HEX = /^[0-9A-F]{2,8}(-[0-9A-F]{2,8}){0,7}$/;

  var DEFAULT_OPTIONS = {
    pinyin: true,
    color: true,
    picMode: 'both',
    picStyle: 'color',
    paper: 'a4',
    orient: 'landscape',
    writing: 'lines',
    english: true,
    pages: { vocab: false, organizer: false, writing: false }
  };

  function opts(layout, extra) {
    var o = JSON.parse(JSON.stringify(DEFAULT_OPTIONS));
    o.orient = layout === 'story' ? 'portrait' : 'landscape';
    Object.keys(extra || {}).forEach(function (key) { o[key] = extra[key]; });
    return o;
  }

  // Built-in starting points. Teachers pick one, then change anything.
  var PRESETS = [
    {
      id: 'daily-times', layout: 'table',
      name: { zh: '几点做什么（句型表）', en: 'Daily routine times (table)' },
      data: {
        title: '掷骰子说句子', layout: 'table',
        prompt: '你几点起床？\n我（ ）起床。',
        categories: ['起床', '吃早饭', '去学校', '吃午饭', '回家'],
        cells: [
          ['6:00', '6:15', '6:30', '6:45', '7:00', '7:15'],
          ['6:30', '6:45', '7:00', '7:15', '7:30', '7:45'],
          ['7:30', '7:40', '7:50', '8:00', '8:10', '8:20'],
          ['11:30', '11:45', '12:00', '12:15', '12:30', '12:45'],
          ['3:00', '3:15', '3:30', '3:45', '4:00', '4:30']
        ],
        options: opts('table', { picMode: 'text' })
      }
    },
    {
      id: 'colour-animal', layout: 'table',
      name: { zh: '颜色 + 动物（句型表）', en: 'Colour + animal (table)' },
      data: {
        title: '我看见了什么？', layout: 'table',
        prompt: '你看见了什么？\n我看见一只（ ）的（ ）。',
        categories: ['颜色', '动物'],
        cells: [
          ['红色', '黄色', '蓝色', '绿色', '白色', '黑色'],
          ['猫', '狗', '兔子', '熊猫', '小鸟', '鱼']
        ],
        options: opts('table')
      }
    },
    {
      id: 'weather-clothes', layout: 'table',
      name: { zh: '天气 + 衣服（句型表）', en: 'Weather + clothes (table)' },
      data: {
        title: '今天穿什么？', layout: 'table',
        prompt: '今天天气怎么样？\n今天（ ），我穿（ ）。',
        categories: ['天气', '衣服'],
        cells: [
          ['晴天', '下雨', '下雪', '刮风', '多云', '很热'],
          ['T恤', '毛衣', '外套', '裙子', '短裤', '帽子']
        ],
        options: opts('table')
      }
    },
    {
      id: 'story-want', layout: 'story',
      name: { zh: '某人 / 想要 / 但是 / 最后（故事格）', en: 'Somebody / wanted / but / finally (story)' },
      data: {
        title: '掷骰子编故事', layout: 'story',
        prompt: '（ ）想要（ ），但是（ ）。\n最后（ ）。',
        categories: ['某人', '想要', '但是', '最后'],
        cells: [
          ['一只小猫', '一个机器人', '一只熊猫', '一个公主', '一只恐龙', '一个男孩'],
          ['一个蛋糕', '一本书', '一个足球', '一顶帽子', '一个气球', '一个朋友'],
          ['下雨了', '迷路了', '生病了', '钱不够', '东西丢了', '睡着了'],
          ['很开心', '交了朋友', '回家了', '吃饱了', '哭了', '笑了']
        ],
        options: opts('story')
      }
    },
    {
      id: 'story-where', layout: 'story',
      name: { zh: '谁 / 在哪儿 / 做什么 / 心情（故事格）', en: 'Who / where / doing what / feeling (story)' },
      data: {
        title: '掷骰子说一说', layout: 'story',
        prompt: '（ ）（ ）（ ），\n他觉得（ ）。',
        categories: ['谁', '在哪儿', '做什么', '心情'],
        cells: [
          ['妈妈', '爸爸', '老师', '小狗', '哥哥', '妹妹'],
          ['在学校', '在公园', '在家', '在海边', '在超市', '在图书馆'],
          ['看书', '踢足球', '吃冰淇淋', '画画', '唱歌', '游泳'],
          ['很开心', '很累', '很生气', '很害怕', '很惊讶', '很难过']
        ],
        options: opts('story')
      }
    },
    {
      id: 'spring-festival', layout: 'story',
      name: { zh: '春节（故事格）', en: 'Chinese New Year (story)' },
      data: {
        title: '春节掷骰子编故事', layout: 'story',
        prompt: '春节的时候，（ ）在（ ），\n还吃了（ ）。大家说：“（ ）！”',
        categories: ['谁', '做什么', '吃什么', '说什么'],
        cells: [
          ['奶奶', '爷爷', '我', '弟弟', '小狗', '邻居'],
          ['贴春联', '放鞭炮', '包饺子', '看烟花', '拿红包', '舞龙'],
          ['饺子', '年糕', '鱼', '汤圆', '橘子', '春卷'],
          ['新年快乐', '恭喜发财', '身体健康', '万事如意', '年年有余', '心想事成']
        ],
        options: opts('story')
      }
    },
    {
      id: 'valentine', layout: 'story',
      name: { zh: '情人节 / 友谊（故事格）', en: 'Valentine\'s / friendship (story)' },
      data: {
        title: '情人节掷骰子编故事', layout: 'story',
        prompt: '（ ）想送（ ）给好朋友，\n但是（ ）。最后（ ）。',
        categories: ['某人', '想送', '但是', '最后'],
        cells: [
          ['一只兔子', '一只小鸟', '一只企鹅', '一只狗', '一只猫', '一只熊'],
          ['一张卡片', '一束花', '一盒巧克力', '一个气球', '一封信', '一块蛋糕'],
          ['下大雨了', '找不到路', '花掉了', '巧克力化了', '忘带了', '朋友不在家'],
          ['很开心', '一起吃蛋糕', '笑了', '说谢谢', '拥抱了', '成了好朋友']
        ],
        options: opts('story')
      }
    }
  ];

  function blankData(layout) {
    layout = layout === 'story' ? 'story' : 'table';
    var n = layout === 'story' ? 4 : 3;
    var categories = [];
    var cells = [];
    for (var i = 0; i < n; i++) {
      categories.push('');
      cells.push(['', '', '', '', '', '']);
    }
    return { title: '', layout: layout, prompt: '', categories: categories, cells: cells, pics: {}, options: opts(layout) };
  }

  function clean(value, limit) {
    // Strip control characters; keep it on one line.
    return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
  }

  function pick(value, allowed, fallback) {
    return allowed.indexOf(value) >= 0 ? value : fallback;
  }

  // Makes any input safe and complete. Never throws (used when loading drafts).
  function normalize(input) {
    var data = input && typeof input === 'object' ? input : {};
    var layout = data.layout === 'story' ? 'story' : 'table';
    var max = MAX_CATEGORIES[layout];
    var rawCats = Array.isArray(data.categories) ? data.categories.slice(0, max) : [];
    var rawCells = Array.isArray(data.cells) ? data.cells.slice(0, max) : [];
    var count = Math.max(1, Math.min(max, Math.max(rawCats.length, rawCells.length)));
    var categories = [];
    var cells = [];
    for (var i = 0; i < count; i++) {
      categories.push(clean(rawCats[i], LIMITS.category));
      var row = Array.isArray(rawCells[i]) ? rawCells[i] : [];
      var out = [];
      for (var j = 0; j < FACES; j++) out.push(clean(row[j], LIMITS.cell));
      cells.push(out);
    }
    var prompt = String(data.prompt == null ? '' : data.prompt).replace(/\r/g, '').split('\n')
      .slice(0, 3).map(function (line) { return clean(line, 80); }).join('\n').slice(0, LIMITS.prompt);
    var pics = {};
    var picKeys = data.pics && typeof data.pics === 'object' ? Object.keys(data.pics).slice(0, LIMITS.pics) : [];
    picKeys.forEach(function (key) {
      var word = clean(key, LIMITS.cell);
      var value = data.pics[key];
      if (!word) return;
      if (value === '' || value === 'upload') pics[word] = value;
      else if (typeof value === 'string' && HEX.test(value.toUpperCase())) pics[word] = value.toUpperCase();
    });
    var o = data.options && typeof data.options === 'object' ? data.options : {};
    var pages = o.pages && typeof o.pages === 'object' ? o.pages : {};
    var options = {
      pinyin: o.pinyin !== false,
      color: o.color !== false,
      picMode: pick(o.picMode, PIC_MODES, 'both'),
      picStyle: pick(o.picStyle, PIC_STYLES, 'color'),
      paper: pick(o.paper, PAPERS, 'a4'),
      orient: pick(o.orient, ORIENTS, layout === 'story' ? 'portrait' : 'landscape'),
      writing: pick(o.writing, WRITING, 'lines'),
      english: o.english !== false,
      pages: { vocab: pages.vocab === true, organizer: pages.organizer === true, writing: pages.writing === true }
    };
    return { title: clean(data.title, LIMITS.title), layout: layout, prompt: prompt, categories: categories, cells: cells, pics: pics, options: options };
  }

  // Server-side check for account templates: rejects empty or oversized input.
  function template(input) {
    function fail(message) {
      var error = new Error(message);
      error.status = 400;
      throw error;
    }
    if (!input || typeof input !== 'object') fail('This Dice Story template is empty.');
    var data = normalize(input);
    // Uploaded pictures stay in the browser; the account copy keeps emoji choices only.
    Object.keys(data.pics).forEach(function (key) { if (data.pics[key] === 'upload') delete data.pics[key]; });
    var filled = data.cells.some(function (row) { return row.some(Boolean); }) || data.categories.some(Boolean);
    if (!filled) fail('Add at least one category or option before saving.');
    if (new TextEncoder().encode(JSON.stringify(data)).length > 48 * 1024) fail('This Dice Story template is too large.');
    return data;
  }

  // "长大|zhǎng dà" -> { text: '长大', py: 'zhǎng dà' }
  function splitCell(value) {
    var text = String(value || '');
    var bar = text.indexOf('|');
    if (bar < 0) return { text: text.trim(), py: '' };
    return { text: text.slice(0, bar).trim(), py: text.slice(bar + 1).trim() };
  }

  var api = {
    FACES: FACES, MAX_CATEGORIES: MAX_CATEGORIES, LIMITS: LIMITS, PRESETS: PRESETS,
    blankData: blankData, normalize: normalize, template: template, splitCell: splitCell
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.DiceStoryCore = api;
})(typeof window !== 'undefined' ? window : this);
