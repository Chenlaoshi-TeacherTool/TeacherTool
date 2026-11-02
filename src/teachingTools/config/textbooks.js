'use strict';

/*
 * Textbook series shown under /textbook-companion. Lessons and their words
 * live in the textbook_lessons / textbook_lesson_items tables (edited at
 * /admin/textbooks); this list only names the series and their order.
 */

var SERIES = [
  { key: 'bubian', zh: '人教部编版', en: 'PEP Chinese (部编版)' },
  { key: 'nihao', zh: '你好华语', en: 'Hello Chinese (你好华语)' },
  { key: 'qingsong', zh: '轻松学中文', en: 'Easy Steps to Chinese for Kids' }
];

function findSeries(key) {
  return SERIES.find(function (series) { return series.key === key; });
}

module.exports = { SERIES: SERIES, findSeries: findSeries };
