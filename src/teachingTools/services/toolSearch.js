// Search text for tool cards, built on the server so the browser only does a
// plain substring match (public/shared/tool-search.js).
//
// A card's search text holds:
//   1. its title / scope / description in English and Chinese,
//   2. the tool's own `keywords` from config/tools.js,
//   3. every word of each SYNONYMS group that 1–2 already mention, so "字卡"
//      finds a tool whose text only says "flash card", and "game" finds a tool
//      whose text only says "游戏",
//   4. the 繁体 form of all Chinese in 1–3, so a teacher can type either script.
var Zh = require('../public/shared/zh-script');

// One group = words a teacher might type for the same thing, in either language.
// Latin words match whole words in the tool text (so "art" is not found inside
// "start"); Chinese words match anywhere. Avoid single characters such as 字 or
// 卡: they turn up inside unrelated words and would attach the group to most tools.
var SYNONYMS = [
  ['游戏', '小游戏', '课堂游戏', 'game', 'games'],
  ['卡片', '词卡', '字卡', '生词卡', '闪卡', '识字卡', '任务卡', 'card', 'cards', 'flashcard', 'flashcards', 'flash card'],
  ['练习纸', '练习单', '学习单', '作业纸', '工作纸', '作业', 'worksheet', 'worksheets', 'handout', 'homework'],
  ['打印', '可打印', '打印版', 'printable', 'print', 'pdf'],
  ['汉字', '生字', '识字', '认字', 'hanzi', 'chinese character', 'chinese characters'],
  ['词汇', '生词', '词语', '单词', 'vocabulary', 'vocab', 'word', 'words'],
  ['拼音', 'pinyin'],
  ['笔顺', '笔画', '写字', 'stroke', 'strokes', 'stroke order'],
  ['偏旁', '部首', '部件', 'radical', 'radicals', 'component', 'components'],
  ['口语', '说话', '会话', '对话', '角色扮演', 'speaking', 'oral', 'conversation', 'role-play', 'role play'],
  ['听力', '听写', 'listening', 'dictation'],
  ['阅读', '读书', '朗读', 'reading', 'read'],
  ['写作', '作文', '写话', 'composition', 'creative writing'],
  ['句子', '句型', '造句', '扩句', '语法', 'sentence', 'sentences', 'grammar'],
  ['量词', 'measure word', 'measure words', 'classifier', 'classifiers'],
  ['拼图', 'puzzle', 'puzzles', 'jigsaw'],
  ['宾果', 'bingo'],
  ['转盘', '轮盘', '抽奖', 'spinner', 'wheel', 'spin'],
  ['随机', '抽人', '点名', 'random', 'picker'],
  ['分组', '小组', '组队', '分队', 'group', 'groups', 'team', 'teams'],
  ['积分', '奖励', '加分', '奖品', 'points', 'reward', 'rewards', 'prize'],
  ['测验', '小测', '测试', '考试', '答题', '问答', 'quiz', 'quizzes', 'test', 'assessment'],
  ['复习', '巩固', 'review'],
  ['投影', '白板', '大屏幕', 'projector', 'whiteboard', 'smartboard'],
  ['手工', 'craft', 'crafts'],
  ['骰子', 'dice'],
  ['迷宫', 'maze'],
  ['数独', 'sudoku'],
  ['漫画', '连环画', 'comic', 'comics'],
  ['故事', '讲故事', 'story', 'stories', 'storytelling'],
  ['讨论', '辩论', 'discussion', 'discuss', 'debate'],
  ['二维码', 'qr', 'qr code'],
  ['字体', 'font', 'fonts'],
  ['电子书', '绘本', 'ebook', 'book', 'books', 'picture book'],
  ['表情', '表情符号', '图标', 'emoji', 'icon', 'icons'],
  ['图片', '照片', 'picture', 'pictures', 'image', 'images', 'photo'],
  ['姓名牌', '名牌', '桌牌', 'name tent', 'name tag', 'name card'],
  ['音量', '噪音', '安静', 'noise', 'volume', 'quiet'],
  ['桌游', '棋盘', 'board game', 'board games'],
  ['记忆', 'memory'],
  ['竞赛', '比赛', '竞速', '抢答', 'race', 'competition', 'contest'],
  ['出门条', 'exit ticket', 'exit slip'],
  ['词表', '词单', '生词表', 'word list', 'word lists', 'glossary'],
  ['课堂管理', '纪律', 'classroom management', 'behavior', 'behaviour']
];

var HAN = /[㐀-鿿豈-﫿]/;
var HAN_RUN = /[㐀-鿿豈-﫿]+/g;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Chinese: anywhere. Latin: whole word, optional plural "s".
function mentions(text, word) {
  if (HAN.test(word)) return text.indexOf(word) !== -1;
  return new RegExp('(^|[^a-z0-9])' + escapeRegExp(word) + 's?($|[^a-z0-9])').test(text);
}

function buildSearchText(texts, keywords) {
  var base = texts.concat(keywords || []).filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
  var extra = [];
  SYNONYMS.forEach(function (group) {
    if (group.some(function (word) { return mentions(base, word); })) {
      group.forEach(function (word) { if (base.indexOf(word) === -1) extra.push(word); });
    }
  });
  var text = extra.length ? base + ' ' + extra.join(' ') : base;
  // 繁体: append only the Chinese runs that change, not the whole text again.
  var seen = Object.create(null);
  var hant = [];
  (text.match(HAN_RUN) || []).forEach(function (run) {
    var trad = Zh.toTraditional(run);
    if (trad !== run && !seen[trad]) { seen[trad] = true; hant.push(trad); }
  });
  return hant.length ? text + ' ' + hant.join(' ') : text;
}

module.exports = { SYNONYMS: SYNONYMS, buildSearchText: buildSearchText, mentions: mentions };
