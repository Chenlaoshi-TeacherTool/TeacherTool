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
 *   limitedFree shows the "Free for a limited time" badge
 *   comingSoon  card with a disabled button and no page
 */

// Directory groups, in display order. Each answers "what do I want to do?".
var SECTIONS = ['manage', 'review-games', 'warmup-games', 'printables', 'hanzi', 'reading', 'prep', 'coming-soon'];

// In display order within each section. The directory shows a section's first
// eight cards and folds the rest, so put the ones teachers reach for first.
var TOOLS = [
  { href: '/teaching-tools/lucky-wheel/', icon: '🎡', titleKey: 'home.luckyWheelTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'home.luckyWheelDesc', actionKey: 'teachingToolsIndex.openTool', section: 'manage', uses: ['project', 'manage'] },
  { href: '/teaching-tools/random-group-generator', icon: '🎲', titleKey: 'teachingToolsIndex.groupTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.groupDesc', actionKey: 'teachingToolsIndex.openTool', section: 'manage', uses: ['manage'] },
  { href: '/teaching-tools/classroom-noise-monitor', icon: '🔊', titleKey: 'teachingToolsIndex.noiseMonitorTitle', scopeKey: 'teachingToolsIndex.noiseMonitorScope', descKey: 'teachingToolsIndex.noiseMonitorDesc', actionKey: 'teachingToolsIndex.openTool', section: 'manage', uses: ['manage'] },
  { href: '/teaching-tools/class-pet-points', icon: '🐾', titleKey: 'teachingToolsIndex.petTitle', scopeKey: 'teachingToolsIndex.petScope', descKey: 'teachingToolsIndex.petDesc', actionKey: 'teachingToolsIndex.openTool', section: 'manage', uses: ['manage'] },
  { href: '/teaching-tools/name-tent-generator', icon: '🔺', titleKey: 'teachingToolsIndex.nameTentTitle', scopeKey: 'teachingToolsIndex.nameTentScope', descKey: 'teachingToolsIndex.nameTentDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'manage', uses: ['print', 'manage'] },
  { href: '/teaching-tools/qr-code-generator', icon: '📌', titleKey: 'teachingToolsIndex.qrTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.qrDesc', actionKey: 'teachingToolsIndex.openTool', section: 'manage', uses: ['print'] },
  { href: '/teaching-tools/quiz-city', titleKey: 'teachingToolsIndex.quizCityTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.quizCityDesc', actionKey: 'teachingToolsIndex.openTool', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/team-race', icon: '🏁', titleKey: 'teachingToolsIndex.teamRaceTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.teamRaceDesc', actionKey: 'teachingToolsIndex.openTool', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/jeopardy', icon: '🏆', titleKey: 'teachingToolsIndex.jeopardyTitle', scopeKey: 'teachingToolsIndex.jeopardyScope', descKey: 'teachingToolsIndex.jeopardyDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/reward-grid/', icon: '🎁', titleKey: 'teachingToolsIndex.rewardGridTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.rewardGridDesc', actionKey: 'teachingToolsIndex.openTool', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/witchs-poison', icon: '🧪', titleKey: 'teachingToolsIndex.poisonGameTitle', scopeKey: 'teachingToolsIndex.poisonGameScope', descKey: 'teachingToolsIndex.poisonGameDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/vocabulary-gacha', icon: '🫧', titleKey: 'teachingToolsIndex.gachaTitle', scopeKey: 'teachingToolsIndex.worksAcrossSubjects', descKey: 'teachingToolsIndex.gachaDesc', actionKey: 'teachingToolsIndex.openTool', section: 'review-games', uses: ['project'] },
  { href: '/teaching-tools/whats-missing', icon: '🙈', titleKey: 'teachingToolsIndex.whatsMissingTitle', scopeKey: 'teachingToolsIndex.whatsMissingScope', descKey: 'teachingToolsIndex.whatsMissingDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project'] },
  { href: '/teaching-tools/image-revealer', icon: '🖼️', titleKey: 'teachingToolsIndex.imageRevealerTitle', scopeKey: 'teachingToolsIndex.savesInBrowserScope', descKey: 'teachingToolsIndex.imageRevealerDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project'] },
  { href: '/teaching-tools/zoom-reveal', icon: '🔍', titleKey: 'teachingToolsIndex.zoomRevealTitle', scopeKey: 'teachingToolsIndex.savesInBrowserScope', descKey: 'teachingToolsIndex.zoomRevealDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project'] },
  { href: '/teaching-tools/character-race', icon: '🏁', titleKey: 'teachingToolsIndex.termRaceTitle', scopeKey: 'teachingToolsIndex.termRaceScope', descKey: 'teachingToolsIndex.termRaceDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project'] },
  { href: '/teaching-tools/sentence-reorder', icon: '🧩', titleKey: 'teachingToolsIndex.sentenceReorderTitle', scopeKey: 'teachingToolsIndex.sentenceReorderScope', descKey: 'teachingToolsIndex.sentenceReorderDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project', 'independent'] },
  { href: '/teaching-tools/time-machine', icon: '⏳', titleKey: 'teachingToolsIndex.timeMachineTitle', scopeKey: 'teachingToolsIndex.timeMachineScope', descKey: 'teachingToolsIndex.timeMachineDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project'] },
  { href: '/teaching-tools/measure-words', icon: '🎯', titleKey: 'teachingToolsIndex.measureWordsTitle', scopeKey: 'teachingToolsIndex.measureWordsScope', descKey: 'teachingToolsIndex.measureWordsDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'warmup-games', uses: ['project', 'independent'] },
  { href: '/low-prep/word-sudoku/word-sudoku-widget.html', icon: '🧩', titleKey: 'teachingToolsIndex.sudokuTitle', scopeKey: 'teachingToolsIndex.sudokuScope', descKey: 'teachingToolsIndex.sudokuDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'printables', uses: ['print'] },
  { href: '/low-prep/word-cloud/word-cloud-widget.html', icon: '☁️', titleKey: 'teachingToolsIndex.wordCloudTitle', scopeKey: 'teachingToolsIndex.wordCloudScope', descKey: 'teachingToolsIndex.wordCloudDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/bingo-generator', icon: '🎯', titleKey: 'teachingToolsIndex.bingoTitle', scopeKey: 'teachingToolsIndex.bingoScope', descKey: 'teachingToolsIndex.bingoDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/tear-paper-bingo', icon: '🟨', titleKey: 'teachingToolsIndex.tearPaperBingoTitle', scopeKey: 'teachingToolsIndex.tearPaperBingoScope', descKey: 'teachingToolsIndex.tearPaperBingoDesc', actionKey: 'teachingToolsIndex.previewAndDownload', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/maze-generator', icon: '🧭', titleKey: 'teachingToolsIndex.mazeTitle', scopeKey: 'teachingToolsIndex.tenToFifteenPrintable', descKey: 'teachingToolsIndex.mazeDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/tarsia-puzzle', icon: '🧩', titleKey: 'teachingToolsIndex.tarsiaTitle', scopeKey: 'teachingToolsIndex.tenToFifteenPrintable', descKey: 'teachingToolsIndex.tarsiaDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/secret-message', icon: '🔐', titleKey: 'teachingToolsIndex.secretMessageTitle', scopeKey: 'teachingToolsIndex.secretMessageScope', descKey: 'teachingToolsIndex.secretMessageDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/vocab-puzzle', icon: '🧩', titleKey: 'teachingToolsIndex.vocabPuzzleTitle', scopeKey: 'teachingToolsIndex.vocabPuzzleScope', descKey: 'teachingToolsIndex.vocabPuzzleDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/decode-practice', icon: '🔡', titleKey: 'teachingToolsIndex.decodeTitle', scopeKey: 'teachingToolsIndex.decodeScope', descKey: 'teachingToolsIndex.decodeDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/worksheet-generator', icon: '📝', titleKey: 'teachingToolsIndex.worksheetTitle', scopeKey: 'teachingToolsIndex.worksheetScope', descKey: 'teachingToolsIndex.worksheetDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/flash-card-generator', icon: '🗂️', titleKey: 'teachingToolsIndex.flashCardTitle', scopeKey: 'teachingToolsIndex.flashCardScope', descKey: 'teachingToolsIndex.flashCardDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/vocabulary-booklet/vocabulary-booklet.html', icon: '📖', titleKey: 'teachingToolsIndex.vocabBookletTitle', scopeKey: 'teachingToolsIndex.tenToFifteenPrintable', descKey: 'teachingToolsIndex.vocabBookletDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'printables', uses: ['print'] },
  { href: '/teaching-tools/stroke-order-worksheet', icon: '✍️', titleKey: 'teachingToolsIndex.strokeOrderTitle', scopeKey: 'teachingToolsIndex.strokeOrderScope', descKey: 'teachingToolsIndex.strokeOrderDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'hanzi', uses: ['print'] },
  { href: '/teaching-tools/hanzi-batch/index.html', icon: '🎨', titleKey: 'teachingToolsIndex.hanziBatchTitle', scopeKey: 'teachingToolsIndex.hanziBatchScope', descKey: 'teachingToolsIndex.hanziBatchDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'hanzi', uses: ['print'] },
  { href: '/teaching-tools/missing-radicals', icon: '✍️', titleKey: 'teachingToolsIndex.missingPartsTitle', scopeKey: 'teachingToolsIndex.missingPartsScope', descKey: 'teachingToolsIndex.missingPartsDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'hanzi', uses: ['print', 'project'] },
  { href: '/teaching-tools/character-unscrambler', icon: '✂️', titleKey: 'teachingToolsIndex.charUnscramblerTitle', scopeKey: 'teachingToolsIndex.charUnscramblerScope', descKey: 'teachingToolsIndex.charUnscramblerDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'hanzi', uses: ['print'] },
  { href: '/teaching-tools/yu-duoyinzi-font', icon: '🈶', titleKey: 'teachingToolsIndex.fontTitle', scopeKey: 'teachingToolsIndex.fontScope', descKey: 'teachingToolsIndex.fontDesc', actionKey: 'teachingToolsIndex.viewAndDownload', section: 'hanzi', uses: ['print'] },
  { href: '/teaching-tools/independent-reading', icon: '📖', titleKey: 'teachingToolsIndex.independentReadingTitle', scopeKey: 'teachingToolsIndex.independentReadingScope', descKey: 'teachingToolsIndex.independentReadingDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'reading', uses: ['print'] },
  { href: '/teaching-tools/book-generator', icon: '🎧', titleKey: 'teachingToolsIndex.bookGenTitle', scopeKey: 'teachingToolsIndex.bookGenScope', descKey: 'teachingToolsIndex.bookGenDesc', actionKey: 'teachingToolsIndex.openTool', section: 'reading', uses: ['independent'], limitedFree: true },
  { href: '/teaching-tools/social-media-classroom-tools/', icon: '🗨️', titleKey: 'teachingToolsIndex.socialMediaHubTitle', scopeKey: 'teachingToolsIndex.socialMediaHubScope', descKey: 'teachingToolsIndex.socialMediaHubDesc', actionKey: 'teachingToolsIndex.openActivity', section: 'reading', uses: ['print', 'independent'] },
  { href: '/teaching-tools/would-you-rather', icon: '🤔', titleKey: 'teachingToolsIndex.wouldYouRatherTitle', scopeKey: 'teachingToolsIndex.wouldYouRatherScope', descKey: 'teachingToolsIndex.wouldYouRatherDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'reading', uses: ['project'] },
  { href: '/teaching-tools/vocab-glossary', icon: '📖', titleKey: 'teachingToolsIndex.glossaryTitle', scopeKey: 'teachingToolsIndex.glossaryScope', descKey: 'teachingToolsIndex.glossaryDesc', actionKey: 'teachingToolsIndex.openGenerator', section: 'reading', uses: ['print'] },
  { href: '/teaching-tools/word-list-library/word-list-library.html', icon: '🗂️', titleKey: 'teachingToolsIndex.libraryTitle', scopeKey: 'teachingToolsIndex.libraryScope', descKey: 'teachingToolsIndex.libraryDesc', actionKey: 'teachingToolsIndex.openTool', section: 'prep', uses: [] },
  { href: '/teaching-tools/question-bank-library/question-bank-library.html', icon: '🧠', titleKey: 'teachingToolsIndex.questionBankTitle', scopeKey: 'teachingToolsIndex.questionBankScope', descKey: 'teachingToolsIndex.questionBankDesc', actionKey: 'teachingToolsIndex.openTool', section: 'prep', uses: [] },
  { href: '/teaching-tools/emoji-search', icon: '🔎', titleKey: 'teachingToolsIndex.emojiSearchTitle', scopeKey: 'teachingToolsIndex.emojiSearchScope', descKey: 'teachingToolsIndex.emojiSearchDesc', actionKey: 'teachingToolsIndex.openTool', section: 'prep', uses: [] },
  { icon: '🌻', titleKey: 'teachingToolsIndex.unoTitle', scopeKey: 'teachingToolsIndex.unoScope', descKey: 'teachingToolsIndex.unoDesc', section: 'coming-soon', uses: [], comingSoon: true },
  { icon: '💬', titleKey: 'teachingToolsIndex.speakingPromptsTitle', scopeKey: 'teachingToolsIndex.speakingPromptsScope', descKey: 'teachingToolsIndex.speakingPromptsDesc', section: 'coming-soon', uses: [], comingSoon: true },
  { icon: '✍️', titleKey: 'teachingToolsIndex.quickWriteTitle', scopeKey: 'teachingToolsIndex.quickWriteScope', descKey: 'teachingToolsIndex.quickWriteDesc', section: 'coming-soon', uses: [], comingSoon: true },
  { icon: '🎟️', titleKey: 'teachingToolsIndex.exitTicketTitle', scopeKey: 'teachingToolsIndex.exitTicketScope', descKey: 'teachingToolsIndex.exitTicketDesc', section: 'coming-soon', uses: [], comingSoon: true },
  { icon: '🔄', titleKey: 'teachingToolsIndex.thinkPairShareTitle', scopeKey: 'teachingToolsIndex.thinkPairShareScope', descKey: 'teachingToolsIndex.thinkPairShareDesc', section: 'coming-soon', uses: [], comingSoon: true }
];

// /teaching-tools/<slug> pages that deliberately have no card of their own.
var UNLISTED = {
  'fakebook-profile': 'opened from the social media hub',
  'fake-wechat-moments': 'opened from the social media hub',
  'fake-wechat-single-post': 'opened from the social media hub',
  'uno-card-generator': 'page exists, but its card still says coming soon',
  'vocab-games': 'no directory card yet'
};

// Tools that have a page (everything except coming-soon cards).
var LIVE = TOOLS.filter(function(tool) { return tool.href; });

function byHref(href) {
  return TOOLS.find(function(tool) { return tool.href === href; });
}

// Sections with their tools, for the directory page.
function sections() {
  return SECTIONS.map(function(key) {
    return { key: key, tools: TOOLS.filter(function(tool) { return tool.section === key; }) };
  });
}

module.exports = {
  SECTIONS: SECTIONS,
  TOOLS: TOOLS,
  LIVE: LIVE,
  UNLISTED: UNLISTED,
  byHref: byHref,
  sections: sections
};
