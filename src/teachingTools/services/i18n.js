var translations = require('../locales/translations');

var SUPPORTED_LANGS = ['en', 'zh'];

function normalizeLang(lang) {
  return SUPPORTED_LANGS.indexOf(lang) !== -1 ? lang : 'en';
}

// Chinese script for lang=zh pages: 'hans' (简体, default) or 'hant' (繁体).
// Kept apart from lang so every `lang === 'zh'` check keeps working; 繁体 is
// made by converting the finished page (services/zhHant.js, public/shared/zh-ui.js).
function normalizeScript(script) {
  return script === 'hant' ? 'hant' : 'hans';
}

function getByPath(obj, path) {
  return path.split('.').reduce(function (acc, part) {
    return acc && acc[part] !== undefined ? acc[part] : undefined;
  }, obj);
}

function t(lang, key) {
  var value = getByPath(translations[normalizeLang(lang)], key);
  if (value === undefined) value = getByPath(translations.en, key);
  return value !== undefined ? value : key;
}

module.exports = {
  SUPPORTED_LANGS: SUPPORTED_LANGS,
  normalizeLang: normalizeLang,
  normalizeScript: normalizeScript,
  t: t
};
