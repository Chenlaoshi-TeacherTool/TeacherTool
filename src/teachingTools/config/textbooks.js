'use strict';

/*
 * Textbook series. Lessons, their words and files live in the
 * textbook_lessons / textbook_lesson_items / textbook_lesson_files tables
 * (edited at /admin/textbooks); this list names the series and their order.
 *
 * A series with `books` has public pages under /textbook-companion/<key>.
 * Its lessons must use those book slugs. `membersOnly`: everyone sees the
 * lesson list; only members open words, patterns, activities and files.
 */

var SERIES = [
  {
    key: 'jinan', zh: '暨南大学《中文》', en: 'Jinan University “中文”', membersOnly: true,
    books: [
      { slug: 'book-1', zh: '第一册', en: 'Book 1' },
      { slug: 'book-2', zh: '第二册', en: 'Book 2' }
    ]
  },
  { key: 'bubian', zh: '人教部编版', en: 'PEP Chinese (部编版)' },
  { key: 'nihao', zh: '你好华语', en: 'Hello Chinese (你好华语)' },
  { key: 'qingsong', zh: '轻松学中文', en: 'Easy Steps to Chinese for Kids' }
];

function findSeries(key) {
  return SERIES.find(function (series) { return series.key === key; });
}

function findBook(series, slug) {
  return (series && series.books || []).find(function (book) { return book.slug === slug; });
}

module.exports = { SERIES: SERIES, findSeries: findSeries, findBook: findBook };
