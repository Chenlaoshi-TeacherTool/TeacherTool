'use strict';

/*
 * Single source of truth for the tool catalog.
 *
 * Everything that lists tools reads from here:
 *   - the /teaching-tools directory (views/teaching-tools/index.ejs)
 *   - the home page's popular tools (services/popularTools.js)
 *   - the Chinese Teaching page (views/chinese-teaching.ejs)
 *   - the admin Tool Videos list (services/toolCatalog.js)
 *
 * To add a tool, add one entry to TOOLS. test/tools.test.js fails if a
 * /teaching-tools/<slug> page has no entry or a translation is missing.
 *
 * Tool fields:
 *   href        public URL; left out while the tool is coming soon
 *   icon        emoji shown before the title
 *   titleKey / scopeKey / descKey / actionKey
 *               i18n keys for the card title, the small scope line, the
 *               description, and the button label
 *   section     one of SECTIONS; its heading and description are the i18n keys
 *               teachingToolsIndex.groups.<section>.heading / .desc
 *   uses        filter tags: print, project, independent, manage
 *   subject     'chinese' for tools that only make sense in a Chinese class
 *               (shown with a badge and listed on /chinese-teaching); left out
 *               for tools that work in any subject
 *   limitedFree shows the "Free for a limited time" badge
 *   comingSoon  card with a disabled button and no page
 *   added       'YYYY-MM-DD' the tool went live (required for live tools).
 *               The home page's "New & updated" row and the directory's NEW
 *               badge (NEW_DAYS = 14 days) read it.
 *   updated     optional { date: 'YYYY-MM-DD', en: '...', zh: '...' } for a
 *               big update worth telling teachers about. Small fixes and
 *               site-wide changes (like the 繁体 switch) do not get one.
 */

// Directory groups, in display order. Each answers "what do I want to do?".
var SECTIONS = ['manage', 'review-games', 'warmup-games', 'printables', 'hanzi', 'reading', 'prep', 'coming-soon'];

// In display order within each section. The directory shows a section's first
// eight cards and folds the rest, so put the ones teachers reach for first.
var TOOLS = [
  { href: '/teaching-tools/lucky-wheel/', added: '2026-10-21', icon: '🎡', titleKey: 'home.luckyWheelTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'home.luckyWheelDesc', actionKey: 'teachingToolsIndex.openTool', section: 'manage', uses: ['project', 'manage'] },
  { href: '/teaching-tools/random-group-generator', added: '2026-04-02', icon: '🎲', titleKey: 'teachingToolsIndex.groupTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.groupDesc', actionKey: 'teachingToolsIndex.openTool', section: 'manage', uses: ['manage'] },
  { href: '/teaching-tools/classroom-noise-monitor', added: '2026-09-27', icon: '🔊', titleKey: 'teachingToolsIndex.noiseMonitorTitle', scopeKey: 'teachingToolsIndex.noiseMonitorScope', descKey: 'teachingToolsIndex.noiseMonitorDesc', actionKey: 'teachingToolsIndex.openTool', section: 'manage', uses: ['manage'] },
  { href: '/teaching-tools/class-pet-points', added: '2026-08-20', icon: '🐾', titleKey: 'teachingToolsIndex.petTitle', scopeKey: 'teachingToolsIndex.petScope', descKey: 'teachingToolsIndex.petDesc', actionKey: 'teachingToolsIndex.openTool', section: 'manage', uses: ['manage'] },
  { href: '/teaching-tools/name-tent-generator', added: '2026-08-23', icon: '🔺', titleKey: 'teachingToolsIndex.nameTentTitle', scopeKey: 'teachingToolsIndex.nameTentScope', descKey: 'teachingToolsIndex.nameTentDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'manage', uses: ['print', 'manage'] },
  { href: '/teaching-tools/qr-code-generator', added: '2026-04-02', icon: '📌', titleKey: 'teachingToolsIndex.qrTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.qrDesc', actionKey: 'teachingToolsIndex.openTool', section: 'manage', uses: ['print'] },
  { href: '/teaching-tools/vocab-games', added: '2026-11-23', icon: '🎮', titleKey: 'teachingToolsIndex.vocabGamesTitle', scopeKey: 'teachingToolsIndex.vocabGamesScope', descKey: 'teachingToolsIndex.vocabGamesDesc', actionKey: 'teachingToolsIndex.openTool', section: 'review-games', uses: ['project', 'print'] },
  { href: '/teaching-tools/quiz-city', added: '2026-10-25', titleKey: 'teachingToolsIndex.quizCityTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.quizCityDesc', actionKey: 'teachingToolsIndex.openTool', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/team-race', added: '2026-10-22', icon: '🏁', titleKey: 'teachingToolsIndex.teamRaceTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.teamRaceDesc', actionKey: 'teachingToolsIndex.openTool', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/jeopardy', added: '2026-08-12', icon: '🏆', titleKey: 'teachingToolsIndex.jeopardyTitle', scopeKey: 'teachingToolsIndex.jeopardyScope', descKey: 'teachingToolsIndex.jeopardyDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/reward-grid/', added: '2026-10-21', icon: '🎁', titleKey: 'teachingToolsIndex.rewardGridTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.rewardGridDesc', actionKey: 'teachingToolsIndex.openTool', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/witchs-poison', added: '2026-09-04', icon: '🧪', titleKey: 'teachingToolsIndex.poisonGameTitle', scopeKey: 'teachingToolsIndex.poisonGameScope', descKey: 'teachingToolsIndex.poisonGameDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/vocabulary-gacha', added: '2026-11-09', icon: '🫧', titleKey: 'teachingToolsIndex.gachaTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.gachaDesc', actionKey: 'teachingToolsIndex.openTool', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/word-match', added: '2026-11-17', icon: '🧩', titleKey: 'teachingToolsIndex.wordMatchTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.wordMatchDesc', actionKey: 'teachingToolsIndex.openTool', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/pixel-art', added: '2026-11-18', icon: '👾', titleKey: 'teachingToolsIndex.pixelArtTitle', scopeKey: 'teachingToolsIndex.pixelArtScope', descKey: 'teachingToolsIndex.pixelArtDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project', 'print', 'independent'], subject: 'chinese' },
  { href: '/teaching-tools/whats-missing', added: '2026-11-10', icon: '🙈', titleKey: 'teachingToolsIndex.whatsMissingTitle', scopeKey: 'teachingToolsIndex.whatsMissingScope', descKey: 'teachingToolsIndex.whatsMissingDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project'] },
  { href: '/teaching-tools/image-revealer', added: '2026-08-22', icon: '🖼️', titleKey: 'teachingToolsIndex.imageRevealerTitle', scopeKey: 'teachingToolsIndex.savesInBrowserScope', descKey: 'teachingToolsIndex.imageRevealerDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project'] },
  { href: '/teaching-tools/zoom-reveal', added: '2026-08-22', icon: '🔍', titleKey: 'teachingToolsIndex.zoomRevealTitle', scopeKey: 'teachingToolsIndex.savesInBrowserScope', descKey: 'teachingToolsIndex.zoomRevealDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project'] },
  { href: '/teaching-tools/character-race', added: '2026-08-12', icon: '🏁', titleKey: 'teachingToolsIndex.termRaceTitle', scopeKey: 'teachingToolsIndex.termRaceScope', descKey: 'teachingToolsIndex.termRaceDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project'] },
  { href: '/teaching-tools/sentence-reorder', added: '2026-08-23', icon: '🧩', titleKey: 'teachingToolsIndex.sentenceReorderTitle', scopeKey: 'teachingToolsIndex.sentenceReorderScope', descKey: 'teachingToolsIndex.sentenceReorderDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project', 'independent'] },
  { href: '/teaching-tools/hanzi-word-choice', added: '2026-11-17', icon: '🀄', titleKey: 'teachingToolsIndex.hanziWordChoiceTitle', scopeKey: 'teachingToolsIndex.hanziWordChoiceScope', descKey: 'teachingToolsIndex.hanziWordChoiceDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project', 'independent'], subject: 'chinese' },
  { href: '/teaching-tools/time-machine', added: '2026-10-04', icon: '⏳', titleKey: 'teachingToolsIndex.timeMachineTitle', scopeKey: 'teachingToolsIndex.timeMachineScope', descKey: 'teachingToolsIndex.timeMachineDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project'] },
  { href: '/teaching-tools/measure-words', added: '2026-11-02', icon: '🎯', titleKey: 'teachingToolsIndex.measureWordsTitle', scopeKey: 'teachingToolsIndex.measureWordsScope', descKey: 'teachingToolsIndex.measureWordsDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project', 'independent'], subject: 'chinese' },
  { href: '/low-prep/word-sudoku/word-sudoku-widget.html', added: '2026-08-11', icon: '🧩', titleKey: 'teachingToolsIndex.sudokuTitle', scopeKey: 'teachingToolsIndex.sudokuScope', descKey: 'teachingToolsIndex.sudokuDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'printables', uses: ['print'] },
  { href: '/low-prep/word-cloud/word-cloud-widget.html', added: '2026-08-11', icon: '☁️', titleKey: 'teachingToolsIndex.wordCloudTitle', scopeKey: 'teachingToolsIndex.wordCloudScope', descKey: 'teachingToolsIndex.wordCloudDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/bingo-generator', added: '2026-08-22', icon: '🎯', titleKey: 'teachingToolsIndex.bingoTitle', scopeKey: 'teachingToolsIndex.bingoScope', descKey: 'teachingToolsIndex.bingoDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/tear-paper-bingo', added: '2026-08-11', icon: '🟨', titleKey: 'teachingToolsIndex.tearPaperBingoTitle', scopeKey: 'teachingToolsIndex.tearPaperBingoScope', descKey: 'teachingToolsIndex.tearPaperBingoDesc', actionKey: 'teachingToolsIndex.previewAndDownload', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/maze-generator', added: '2026-08-14', icon: '🧭', titleKey: 'teachingToolsIndex.mazeTitle', scopeKey: 'teachingToolsIndex.tenToFifteenPrintable', descKey: 'teachingToolsIndex.mazeDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/tarsia-puzzle', added: '2026-08-12', icon: '🧩', titleKey: 'teachingToolsIndex.tarsiaTitle', scopeKey: 'teachingToolsIndex.tenToFifteenPrintable', descKey: 'teachingToolsIndex.tarsiaDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/secret-message', added: '2026-10-27', icon: '🔐', titleKey: 'teachingToolsIndex.secretMessageTitle', scopeKey: 'teachingToolsIndex.secretMessageScope', descKey: 'teachingToolsIndex.secretMessageDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/board-games', added: '2026-11-23', icon: '♟️', titleKey: 'teachingToolsIndex.boardGamesTitle', scopeKey: 'teachingToolsIndex.boardGamesScope', descKey: 'teachingToolsIndex.boardGamesDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print', 'project'] },
  { href: '/teaching-tools/spin-wheel', added: '2026-11-21', icon: '🎡', titleKey: 'teachingToolsIndex.spinWheelTitle', scopeKey: 'teachingToolsIndex.spinWheelScope', descKey: 'teachingToolsIndex.spinWheelDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print', 'project'] },
  { href: '/teaching-tools/dice-story', added: '2026-11-22', icon: '🎲', titleKey: 'teachingToolsIndex.diceStoryTitle', scopeKey: 'teachingToolsIndex.diceStoryScope', descKey: 'teachingToolsIndex.diceStoryDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print', 'independent'] },
  { href: '/teaching-tools/sentence-ladder', added: '2026-11-22', icon: '🪜', titleKey: 'teachingToolsIndex.sentenceLadderTitle', scopeKey: 'teachingToolsIndex.sentenceLadderScope', descKey: 'teachingToolsIndex.sentenceLadderDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print', 'project', 'independent'], subject: 'chinese' },
  { href: '/teaching-tools/vocab-puzzle', added: '2026-10-14', icon: '🧩', titleKey: 'teachingToolsIndex.vocabPuzzleTitle', scopeKey: 'teachingToolsIndex.vocabPuzzleScope', descKey: 'teachingToolsIndex.vocabPuzzleDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/decode-practice', added: '2026-09-01', icon: '🔡', titleKey: 'teachingToolsIndex.decodeTitle', scopeKey: 'teachingToolsIndex.decodeScope', descKey: 'teachingToolsIndex.decodeDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'], subject: 'chinese' },
  { href: '/teaching-tools/speaking-cards', added: '2026-11-23', icon: '💬', titleKey: 'teachingToolsIndex.speakingPromptsTitle', scopeKey: 'teachingToolsIndex.speakingPromptsScope', descKey: 'teachingToolsIndex.speakingPromptsDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print', 'project'], subject: 'chinese' },
  { href: '/teaching-tools/exit-ticket', added: '2026-11-23', icon: '🎟️', titleKey: 'teachingToolsIndex.exitTicketTitle', scopeKey: 'teachingToolsIndex.exitTicketScope', descKey: 'teachingToolsIndex.exitTicketDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'], subject: 'chinese' },
  { href: '/teaching-tools/worksheet-generator', added: '2026-10-19', icon: '📝', titleKey: 'teachingToolsIndex.worksheetTitle', scopeKey: 'teachingToolsIndex.worksheetScope', descKey: 'teachingToolsIndex.worksheetDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'], subject: 'chinese' },
  { href: '/teaching-tools/flash-card-generator', added: '2026-09-01', icon: '🗂️', titleKey: 'teachingToolsIndex.flashCardTitle', scopeKey: 'teachingToolsIndex.flashCardScope', descKey: 'teachingToolsIndex.flashCardDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'], subject: 'chinese' },
  { href: '/teaching-tools/vocabulary-booklet/vocabulary-booklet.html', added: '2026-08-12', icon: '📖', titleKey: 'teachingToolsIndex.vocabBookletTitle', scopeKey: 'teachingToolsIndex.tenToFifteenPrintable', descKey: 'teachingToolsIndex.vocabBookletDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/stroke-order-worksheet', added: '2026-10-14', icon: '✍️', titleKey: 'teachingToolsIndex.strokeOrderTitle', scopeKey: 'teachingToolsIndex.strokeOrderScope', descKey: 'teachingToolsIndex.strokeOrderDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'hanzi', uses: ['print'], subject: 'chinese' },
  { href: '/teaching-tools/hanzi-batch/index.html', added: '2026-10-17', icon: '🎨', titleKey: 'teachingToolsIndex.hanziBatchTitle', scopeKey: 'teachingToolsIndex.hanziBatchScope', descKey: 'teachingToolsIndex.hanziBatchDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'hanzi', uses: ['print'], subject: 'chinese' },
  { href: '/teaching-tools/missing-radicals', added: '2026-10-17', icon: '✍️', titleKey: 'teachingToolsIndex.missingPartsTitle', scopeKey: 'teachingToolsIndex.missingPartsScope', descKey: 'teachingToolsIndex.missingPartsDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'hanzi', uses: ['print', 'project'], subject: 'chinese' },
  { href: '/teaching-tools/spin-wheel?mode=hanzi', added: '2026-11-22', icon: '🀄', titleKey: 'teachingToolsIndex.hanziWheelTitle', scopeKey: 'teachingToolsIndex.hanziWheelScope', descKey: 'teachingToolsIndex.hanziWheelDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'hanzi', uses: ['print', 'project'], subject: 'chinese' },
  { href: '/teaching-tools/component-cards', added: '2026-11-23', icon: '🎨', titleKey: 'teachingToolsIndex.componentCardsTitle', scopeKey: 'teachingToolsIndex.componentCardsScope', descKey: 'teachingToolsIndex.componentCardsDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'hanzi', uses: ['print', 'project'], subject: 'chinese' },
  { href: '/teaching-tools/character-unscrambler', added: '2026-11-02', icon: '✂️', titleKey: 'teachingToolsIndex.charUnscramblerTitle', scopeKey: 'teachingToolsIndex.charUnscramblerScope', descKey: 'teachingToolsIndex.charUnscramblerDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'hanzi', uses: ['print'], subject: 'chinese' },
  { href: '/teaching-tools/yu-duoyinzi-font', added: '2026-08-21', icon: '🈶', titleKey: 'teachingToolsIndex.fontTitle', scopeKey: 'teachingToolsIndex.fontScope', descKey: 'teachingToolsIndex.fontDesc', actionKey: 'teachingToolsIndex.viewAndDownload', section: 'hanzi', uses: ['print'], subject: 'chinese' },
  { href: '/teaching-tools/independent-reading', added: '2026-08-11', icon: '📖', titleKey: 'teachingToolsIndex.independentReadingTitle', scopeKey: 'teachingToolsIndex.independentReadingScope', descKey: 'teachingToolsIndex.independentReadingDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'reading', uses: ['print'] },
  { href: '/teaching-tools/book-generator', added: '2026-08-25', icon: '🎧', titleKey: 'teachingToolsIndex.bookGenTitle', scopeKey: 'teachingToolsIndex.bookGenScope', descKey: 'teachingToolsIndex.bookGenDesc', actionKey: 'teachingToolsIndex.openTool', section: 'reading', uses: ['independent'], limitedFree: true },
  { href: '/teaching-tools/social-media-classroom-tools/', added: '2026-09-27', icon: '🗨️', titleKey: 'teachingToolsIndex.socialMediaHubTitle', scopeKey: 'teachingToolsIndex.socialMediaHubScope', descKey: 'teachingToolsIndex.socialMediaHubDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'reading', uses: ['print', 'independent'] },
  { href: '/teaching-tools/would-you-rather', added: '2026-08-12', icon: '🤔', titleKey: 'teachingToolsIndex.wouldYouRatherTitle', scopeKey: 'teachingToolsIndex.wouldYouRatherScope', descKey: 'teachingToolsIndex.wouldYouRatherDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'reading', uses: ['project'] },
  { href: '/teaching-tools/vocab-glossary', added: '2026-09-02', icon: '📖', titleKey: 'teachingToolsIndex.glossaryTitle', scopeKey: 'teachingToolsIndex.glossaryScope', descKey: 'teachingToolsIndex.glossaryDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'reading', uses: ['print'], subject: 'chinese' },
  { href: '/teaching-tools/word-list-library/word-list-library.html', added: '2026-08-12', icon: '🗂️', titleKey: 'teachingToolsIndex.libraryTitle', scopeKey: 'teachingToolsIndex.libraryScope', descKey: 'teachingToolsIndex.libraryDesc', actionKey: 'teachingToolsIndex.openTool', section: 'prep', uses: [] },
  { href: '/teaching-tools/question-bank-library/question-bank-library.html', added: '2026-08-13', icon: '🧠', titleKey: 'teachingToolsIndex.questionBankTitle', scopeKey: 'teachingToolsIndex.questionBankScope', descKey: 'teachingToolsIndex.questionBankDesc', actionKey: 'teachingToolsIndex.openTool', section: 'prep', uses: [] },
  { href: '/teaching-tools/emoji-search', added: '2026-08-26', icon: '🔎', titleKey: 'teachingToolsIndex.emojiSearchTitle', scopeKey: 'teachingToolsIndex.emojiSearchScope', descKey: 'teachingToolsIndex.emojiSearchDesc', actionKey: 'teachingToolsIndex.openTool', section: 'prep', uses: [] },
  { icon: '🌻', titleKey: 'teachingToolsIndex.unoTitle', scopeKey: 'teachingToolsIndex.unoScope', descKey: 'teachingToolsIndex.unoDesc', section: 'coming-soon', uses: [], comingSoon: true },
  { icon: '✍️', titleKey: 'teachingToolsIndex.quickWriteTitle', scopeKey: 'teachingToolsIndex.quickWriteScope', descKey: 'teachingToolsIndex.quickWriteDesc', section: 'coming-soon', uses: [], comingSoon: true },
  { icon: '🔄', titleKey: 'teachingToolsIndex.thinkPairShareTitle', scopeKey: 'teachingToolsIndex.thinkPairShareScope', descKey: 'teachingToolsIndex.thinkPairShareDesc', section: 'coming-soon', uses: [], comingSoon: true }
];

// /teaching-tools/<slug> pages that deliberately have no card of their own.
var UNLISTED = {
  'fakebook-profile': 'opened from the social media hub',
  'fake-wechat-moments': 'opened from the social media hub',
  'fake-wechat-single-post': 'opened from the social media hub',
  'uno-card-generator': 'page exists, but its card still says coming soon'
};

// Tools that have a page (everything except coming-soon cards).
var LIVE = TOOLS.filter(function(tool) { return tool.href; });

// Chinese-only tools for /chinese-teaching: characters and pinyin, then the rest.
function chineseGroups() {
  var chinese = LIVE.filter(function(tool) { return tool.subject === 'chinese'; });
  return [
    { key: 'characters', tools: chinese.filter(function(tool) { return tool.section === 'hanzi'; }) },
    { key: 'vocabulary', tools: chinese.filter(function(tool) { return tool.section !== 'hanzi'; }) }
  ];
}

// Shared tools keep the same catalog entry in every directory group.
var DIRECTORY = {
  manage: { main: 'home.luckyWheelTitle groupTitle noiseMonitorTitle petTitle nameTentTitle' },
  'classroom-games': {
    'review-games': 'vocabGamesTitle quizCityTitle teamRaceTitle jeopardyTitle rewardGridTitle poisonGameTitle gachaTitle',
    'warmup-games': 'home.luckyWheelTitle wordMatchTitle pixelArtTitle whatsMissingTitle imageRevealerTitle zoomRevealTitle termRaceTitle hanziWordChoiceTitle missingPartsTitle',
    'paper-games': 'tearPaperBingoTitle'
  },
  'online-practice': {
    practice: 'wordMatchTitle pixelArtTitle sentenceReorderTitle hanziWordChoiceTitle timeMachineTitle measureWordsTitle wouldYouRatherTitle sentenceLadderTitle',
    creation: 'bookGenTitle socialMediaHubTitle'
  },
  printables: {
    'classroom-supplies': 'nameTentTitle qrTitle',
    'printable-games': 'boardGamesTitle sudokuTitle wordCloudTitle bingoTitle mazeTitle tarsiaTitle secretMessageTitle spinWheelTitle diceStoryTitle vocabPuzzleTitle pixelArtTitle',
    'chinese-materials': 'exitTicketTitle speakingPromptsTitle decodeTitle worksheetTitle sentenceLadderTitle flashCardTitle vocabBookletTitle strokeOrderTitle hanziBatchTitle missingPartsTitle componentCardsTitle charUnscramblerTitle hanziWheelTitle independentReadingTitle glossaryTitle'
  },
  prep: { main: 'libraryTitle questionBankTitle emojiSearchTitle glossaryTitle fontTitle' }
};

var byTitle = new Map(TOOLS.map(function(tool) { return [tool.titleKey, tool]; }));

var socialTools = [
  { href: '/teaching-tools/fake-wechat-moments/', titleKey: 'teachingToolsIndex.fakeWechatTitle' },
  { href: '/teaching-tools/fake-wechat-single-post/', titleKey: 'teachingToolsIndex.fakeWechatSingleTitle' },
  { href: '/teaching-tools/fakebook-profile/fakebook-profile.html', titleKey: 'teachingToolsIndex.fakebookTitle' }
];

function sections() {
  var sections = Object.entries(DIRECTORY).map(function(entry) {
    var groups = Object.entries(entry[1]).map(function(group) {
      return { key: group[0], tools: group[1].split(' ').map(function(title) {
        return byTitle.get(title.startsWith('home.') ? title : 'teachingToolsIndex.' + title);
      }) };
    });
    return { key: entry[0], groups: groups, tools: groups.flatMap(function(group) { return group.tools; }) };
  });
  var upcoming = TOOLS.filter(function(tool) { return tool.comingSoon; });
  return sections.concat({ key: 'coming-soon', groups: [{ key: 'main', tools: upcoming }], tools: upcoming });
}

var NEW_DAYS = 14;

// The date that counts for "newest": a big update, else the launch date.
function freshDate(tool) { return tool.updated && tool.updated.date > tool.added ? tool.updated.date : tool.added; }

// Newest launches and big updates first, for the home page.
function newest(count, today) {
  return LIVE.filter(function(tool) { return tool.added; }).slice().sort(function(a, b) {
    return freshDate(b) < freshDate(a) ? -1 : freshDate(b) > freshDate(a) ? 1 : 0;
  }).slice(0, count || 4).map(function(tool) {
    return Object.assign({}, tool, { fresh: freshness(tool, today) || (tool.updated && tool.updated.date > tool.added ? 'updated' : 'new'), freshDate: freshDate(tool) });
  });
}

// 'new' or 'updated' while within NEW_DAYS of that date, else null.
function freshness(tool, today) {
  var now = today ? new Date(today) : new Date();
  function recent(date) { return date && (now - new Date(date + 'T00:00:00Z')) / 86400000 <= NEW_DAYS; }
  if (tool.updated && tool.updated.date > tool.added && recent(tool.updated.date)) return 'updated';
  return recent(tool.added) ? 'new' : null;
}

module.exports = {
  NEW_DAYS: NEW_DAYS,
  newest: newest,
  freshness: freshness,
  SECTIONS: SECTIONS,
  TOOLS: TOOLS,
  LIVE: LIVE,
  UNLISTED: UNLISTED,
  chineseGroups: chineseGroups,
  directoryKeys: Object.keys(DIRECTORY),
  socialTools: socialTools,
  sections: sections
};
