var translations = require('../locales/translations');

var SUPPORTED_LANGS = ['en', 'zh'];

function normalizeLang(lang) {
  return SUPPORTED_LANGS.indexOf(lang) !== -1 ? lang : 'en';
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
  t: t
};
