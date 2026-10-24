'use strict';

/*
 * Single source of truth for the public site structure.
 *
 * Everything that lists site sections reads from here:
 *   - the main navigation and footer links (served into milk-tea-footer.js by app.js)
 *   - routes/siteStructure.js (theme, textbook level, and shop pages)
 *   - /sitemap.xml (routes/index.js)
 *   - the admin nav and dashboard (views/admin/layout-head.ejs, dashboard.ejs)
 *
 * To add, rename, or remove a section, change it here. test/siteMap.test.js
 * fails if a page, nav link, sitemap entry, or admin editor falls out of sync.
 *
 * Section fields:
 *   key       stable id
 *   href      public URL
 *   en / zh   labels
 *   nav       shown in the main navigation (FOOTER lists the footer links)
 *   admin     keys of ADMIN_EDITORS that manage this section's content
 *   redirect  external URL the page forwards to (left out of the sitemap)
 *   children  sub-pages (same shape, may nest); `template: 'theme'` children
 *             are rendered by routes/siteStructure.js from this list
 */

var SECTIONS = [
  { key: 'home', href: '/', en: 'Home', zh: '首页', nav: true, admin: [] },
  {
    key: 'tools', href: '/teaching-tools', en: 'Teaching Tools', zh: '教学工具', nav: true,
    admin: ['toolguides', 'wordlists', 'questionbanks']
  },
  {
    key: 'activities', href: '/theme-activities', en: 'Theme Activities', zh: '主题活动', nav: true, admin: [],
    children: [
      {
        key: 'halloween', href: '/theme-activities/halloween', en: 'Halloween', zh: '万圣节', template: 'theme',
        children: [{ key: 'halloween-printables', href: '/theme-activities/halloween/printables', en: 'Halloween printables', zh: '万圣节可打印材料' }]
      },
      { key: 'chinese-new-year', href: '/theme-activities/chinese-new-year', en: 'Chinese New Year', zh: '春节', template: 'theme' },
      {
        key: 'weather', href: '/theme-activities/weather', en: 'Weather', zh: '天气',
        children: [{ key: 'weather-songs', href: '/theme-activities/weather/songs', en: 'Weather songs', zh: '天气儿歌' }]
      },
      { key: 'animals', href: '/theme-activities/animals', en: 'Animals', zh: '动物', template: 'theme' }
    ]
  },
  {
    key: 'textbook', href: '/textbook-companion', en: 'Textbook Companion', zh: '教材配套', nav: true, admin: [],
    children: [1, 2, 3].map(function(level) {
      return { key: 'level-' + level, href: '/textbook-companion/level-' + level, en: 'Level ' + level, zh: '第' + level + '册', level: level };
    })
  },
  { key: 'finds', href: '/classroom-finds', en: 'Classroom Finds', zh: '教室好物', nav: true, admin: ['recommendations'] },
  {
    key: 'shop', href: '/shop', en: 'Chen Laoshi’s Shop', zh: '陈老师的商店', navEn: 'Shop', navZh: '商店', nav: true, admin: [],
    children: [
      { key: 'printable-packs', href: '/shop/printable-packs', en: 'Printable packs', zh: '可打印材料包' },
      { key: 'physical-products', href: '/shop/physical-products', en: 'Physical products', zh: '实体产品', redirect: 'https://www.ebay.com/usr/clsteachingtools' }
    ]
  },
  { key: 'about', href: '/about', en: 'About', zh: '关于', nav: true, admin: [] },
  { key: 'contact', href: '/contact', en: 'Contact', zh: '联系', nav: true, admin: [] },
  { key: 'privacy', href: '/privacy', en: 'Privacy Policy', zh: '隐私政策', admin: [] }
];

// Legal footer links, in display order.
var FOOTER = ['about', 'finds', 'contact', 'privacy'];

// Content that still has public pages but no section in the navigation.
var UNLISTED = [
  {
    key: 'resources', en: 'Older articles', zh: '旧文章',
    note: 'Individual /resources/:slug pages stay online; the listing page was retired.',
    admin: ['articles']
  }
];

// Admin editors. `href` must match a GET route in routes/admin.js.
var ADMIN_EDITORS = {
  toolguides: { href: '/admin/toolguides', label: 'Tool Guides', description: 'How-to guides shown on individual tool pages' },
  wordlists: { href: '/admin/wordlists', label: 'Word Lists', description: 'Lists and terms used by the word list library and tools' },
  questionbanks: { href: '/admin/questionbanks', label: 'Question Banks', description: 'Banks and questions, plus Excel bulk import' },
  recommendations: { href: '/admin/recommendations', label: 'Classroom Finds', description: 'Product pages, affiliate links, and printable labels' },
  articles: { href: '/admin/articles', label: 'Articles', description: 'Existing /resources/:slug articles' }
};

function label(item, lang) {
  return lang === 'zh' ? item.zh : item.en;
}

function navLabel(item, lang) {
  return lang === 'zh' ? (item.navZh || item.zh) : (item.navEn || item.en);
}

function findSection(key) {
  return SECTIONS.find(function(section) { return section.key === key; });
}

function children(key) {
  var section = findSection(key);
  return (section && section.children) || [];
}

function flatten(items) {
  return items.reduce(function(all, item) {
    return all.concat([item], flatten(item.children || []));
  }, []);
}

// Every structural URL that serves its own page, for the sitemap and tests.
function allPaths() {
  return flatten(SECTIONS).filter(function(item) { return !item.redirect; }).map(function(item) { return item.href; });
}

// Compact data for the client-side nav/footer in milk-tea-footer.js.
function clientNav() {
  function link(section) {
    return { href: section.href, en: navLabel(section, 'en'), zh: navLabel(section, 'zh') };
  }
  return {
    nav: SECTIONS.filter(function(section) { return section.nav; }).map(link),
    footer: FOOTER.map(findSection).map(link)
  };
}

// Admin dashboard groups: each site section with the editors that manage it.
function adminGroups() {
  return SECTIONS.concat(UNLISTED).map(function(section) {
    return {
      key: section.key,
      label: section.en,
      href: section.href,
      note: section.note,
      editors: (section.admin || []).map(function(key) { return Object.assign({ key: key }, ADMIN_EDITORS[key]); })
    };
  });
}

function adminNav() {
  return Object.keys(ADMIN_EDITORS).map(function(key) { return ADMIN_EDITORS[key]; });
}

module.exports = {
  SECTIONS: SECTIONS,
  UNLISTED: UNLISTED,
  ADMIN_EDITORS: ADMIN_EDITORS,
  label: label,
  findSection: findSection,
  children: children,
  allPaths: allPaths,
  clientNav: clientNav,
  adminGroups: adminGroups,
  adminNav: adminNav
};
