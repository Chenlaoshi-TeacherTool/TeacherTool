'use strict';

/*
 * Reads question banks from the Data API Builder instance described in
 * database/dab-config.json. See routes/api.js.
 */

var levelLabelsCache = null;
var typeLabelsCache = null;

function baseUrl() {
  return process.env.DAB_BASE_URL || 'http://localhost:5000/api';
}

async function dabGet(path) {
  var res = await fetch(baseUrl() + path);
  if (!res.ok) {
    throw new Error('DAB request failed: ' + path + ' -> ' + res.status);
  }
  var body = await res.json();
  return body.value;
}

function toLabelMap(rows) {
  var map = {};
  rows.forEach(function (row) { map[row.code] = row.label_en; });
  return map;
}

async function getLabelMaps() {
  if (!levelLabelsCache) levelLabelsCache = toLabelMap(await dabGet('/level_lookup'));
  if (!typeLabelsCache) typeLabelsCache = toLabelMap(await dabGet('/type_lookup'));
  return { levelLabels: levelLabelsCache, typeLabels: typeLabelsCache };
}

function toPublicQuestion(row, bankTheme, labels) {
  return {
    id: row.external_id,
    theme: bankTheme,
    level: labels.levelLabels[row.level_code] || row.level_code,
    prompt: row.prompt,
    answer: row.answer,
    tags: JSON.parse(row.tags || '[]'),
    type: labels.typeLabels[row.type_code] || row.type_code,
    options: JSON.parse(row.options || '[]'),
    note: row.note
  };
}

async function getAllPublicBankSummaries() {
  var banks = await dabGet('/questionbanks');
  var questions = await dabGet('/questions');
  var countByBankId = {};
  questions.forEach(function (q) {
    countByBankId[q.bank_id] = (countByBankId[q.bank_id] || 0) + 1;
  });
  return banks.map(function (bank) {
    return {
      id: bank.slug,
      name: bank.name,
      description: bank.description,
      theme: bank.theme,
      level: bank.level,
      curriculum: bank.curriculum,
      count: countByBankId[bank.id] || 0
    };
  });
}

async function getPublicBankBySlug(slug) {
  var banks = await dabGet("/questionbanks?$filter=slug eq '" + slug.replace(/'/g, "''") + "'");
  var bank = banks[0];
  if (!bank) return null;
  var labels = await getLabelMaps();
  var questionRows = await dabGet('/questions?$filter=bank_id eq ' + bank.id + '&$orderby=sort_order');
  return {
    id: bank.slug,
    name: bank.name,
    description: bank.description,
    theme: bank.theme,
    level: bank.level,
    curriculum: bank.curriculum,
    count: questionRows.length,
    questions: questionRows.map(function (row) { return toPublicQuestion(row, bank.theme, labels); })
  };
}

module.exports = {
  getAllPublicBankSummaries: getAllPublicBankSummaries,
  getPublicBankBySlug: getPublicBankBySlug
};
