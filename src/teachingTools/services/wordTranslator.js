'use strict';

// Translates short Chinese vocabulary items with Azure AI Translator (v3 REST).
// Configure with AZURE_TRANSLATOR_KEY and AZURE_TRANSLATOR_REGION; the endpoint
// can be overridden with AZURE_TRANSLATOR_ENDPOINT.

var LANGUAGES = {
  th: 'Thai',
  vi: 'Vietnamese',
  ru: 'Russian',
  es: 'Spanish',
  fr: 'French'
};

var MAX_WORDS = 60;
var MAX_WORD_LENGTH = 40;
var MAX_LANGUAGES = 4;
var CACHE_LIMIT = 5000;

var cache = new Map(); // "lang|word" -> translation

function isConfigured() {
  return Boolean(process.env.AZURE_TRANSLATOR_KEY);
}

function cleanRequest(body) {
  var words = Array.isArray(body && body.words) ? body.words : [];
  var to = Array.isArray(body && body.to) ? body.to : [];
  var seen = {};
  words = words
    .map(function (w) { return typeof w === 'string' ? w.trim() : ''; })
    .filter(function (w) {
      if (!w || w.length > MAX_WORD_LENGTH || seen[w]) return false;
      seen[w] = true;
      return true;
    });
  to = to.filter(function (lang, i) { return LANGUAGES[lang] && to.indexOf(lang) === i; });
  if (!words.length) return { error: 'Send at least one word.' };
  if (words.length > MAX_WORDS) return { error: 'Send at most ' + MAX_WORDS + ' words at a time.' };
  if (!to.length) return { error: 'Choose at least one supported language.' };
  if (to.length > MAX_LANGUAGES) return { error: 'Choose at most ' + MAX_LANGUAGES + ' languages.' };
  return { words: words, to: to };
}

function remember(key, value) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

// Returns { translations: { word: { lang: text } } }.
async function translateWords(words, to, fetchImpl) {
  fetchImpl = fetchImpl || fetch;
  var result = {};
  words.forEach(function (w) { result[w] = {}; });

  // Only ask Azure for the words/languages we haven't cached yet.
  var missingWords = words.filter(function (w) {
    return to.some(function (lang) {
      var hit = cache.get(lang + '|' + w);
      if (hit !== undefined) result[w][lang] = hit;
      return hit === undefined;
    });
  });

  if (missingWords.length) {
    var endpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com').replace(/\/$/, '');
    var url = endpoint + '/translate?api-version=3.0&from=zh-Hans' +
      to.map(function (lang) { return '&to=' + lang; }).join('');
    var headers = {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': process.env.AZURE_TRANSLATOR_KEY
    };
    if (process.env.AZURE_TRANSLATOR_REGION) headers['Ocp-Apim-Subscription-Region'] = process.env.AZURE_TRANSLATOR_REGION;

    var res = await fetchImpl(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(missingWords.map(function (w) { return { Text: w }; }))
    });
    if (!res.ok) {
      var err = new Error('Translator returned HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }
    var data = await res.json();
    missingWords.forEach(function (w, i) {
      var entry = data[i] && data[i].translations;
      (entry || []).forEach(function (t) {
        if (!LANGUAGES[t.to]) return;
        result[w][t.to] = t.text;
        remember(t.to + '|' + w, t.text);
      });
    });
  }

  return { translations: result };
}

function clearCache() {
  cache.clear();
}

module.exports = {
  LANGUAGES: LANGUAGES,
  isConfigured: isConfigured,
  cleanRequest: cleanRequest,
  translateWords: translateWords,
  clearCache: clearCache
};
