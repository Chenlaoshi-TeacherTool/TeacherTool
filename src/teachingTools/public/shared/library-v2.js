(function (root) {
  'use strict';

  var MAX_BYTES = 5 * 1024 * 1024;

  function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function text(value) {
    if (value !== null && typeof value === 'object') throw new Error('A text field contains an unexpected object.');
    return value == null ? '' : String(value);
  }

  function date(value) {
    if (value == null || value === '') return null;
    var parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }

  function checkSize(value, depth, budget) {
    budget.count += 1;
    if (depth > 20 || budget.count > 100000) throw new Error('The backup contains too much nested data.');
    if (typeof value === 'string' && value.length > MAX_BYTES) throw new Error('A backup field is too long.');
    if (value && typeof value === 'object') Object.keys(value).forEach(function (key) {
      checkSize(value[key], depth + 1, budget);
    });
  }

  function tags(value) {
    return Array.isArray(value) ? value.map(text) : text(value).split(/[,，、]/).filter(Boolean);
  }

  async function checksum(value) {
    var bytes = new TextEncoder().encode(value);
    var hash = await root.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
  }

  function validate(data) {
    if (data.schemaVersion !== 2) throw new Error('This backup version is not supported.');
    if (!Array.isArray(data.collections) || data.collections.length > 100 || !Array.isArray(data.activities) || !Array.isArray(data.legacyRecords)) {
      throw new Error('The library backup is missing its collections, activities, or original records.');
    }
    if (data.activities.length) throw new Error('Activity projects are not supported by this library preview yet. Keep the original file.');
    var ids = new Set();
    var total = 0;
    function identity(record) {
      if (!object(record) || typeof record.id !== 'string' || !record.id || ids.has(record.id)) throw new Error('The backup contains a missing or duplicate internal ID.');
      ids.add(record.id);
    }
    function strings(record, fields) {
      fields.forEach(function (field) {
        if (typeof record[field] !== 'string') throw new Error('Invalid text field: ' + field + '.');
      });
    }
    data.collections.forEach(function (collection) {
      identity(collection);
      strings(collection, ['name']);
      if (!['vocabulary', 'question-bank'].includes(collection.kind) || !Array.isArray(collection.items)) throw new Error('Invalid collection type or items.');
      total += collection.items.length;
      if (total > 5000) throw new Error('Please split this backup into fewer than 5,001 items.');
      collection.items.forEach(function (item) {
        identity(item);
        if (collection.kind === 'vocabulary') {
          if (item.kind !== 'vocabulary') throw new Error('Invalid vocabulary item type.');
          strings(item, ['term', 'pronunciation', 'definition']);
        } else {
          if (item.kind !== 'question') throw new Error('Invalid question item type.');
          strings(item, ['prompt', 'answer', 'type']);
          if (!Array.isArray(item.options)) throw new Error('Invalid question options.');
          var optionIds = new Set();
          item.options.forEach(function (option) {
            strings(option, ['id', 'label', 'text']);
            if (!option.id || optionIds.has(option.id)) throw new Error('Duplicate or missing option ID.');
            optionIds.add(option.id);
          });
          if (item.correctOptionId != null && !optionIds.has(item.correctOptionId)) throw new Error('The answer refers to a missing option.');
        }
      });
    });
  }

  async function preview(rawValue) {
    if (typeof rawValue !== 'string' || new TextEncoder().encode(rawValue).length > MAX_BYTES) throw new Error('Choose a JSON backup smaller than 5 MB.');
    var input;
    try { input = JSON.parse(rawValue); } catch (error) { throw new Error('This file is not valid JSON. Keep the original file and check its contents.'); }
    checkSize(input, 0, { count: 0 });
    if (!object(input)) throw new Error('This file is not a supported library backup.');
    var warnings = [];
    var data;
    if (input.format === 'cls-teaching-library') {
      data = input;
    } else {
      var lists;
      if (input.format === 'chenlaoshi-wordlist' && input.version === 1 && Array.isArray(input.lists)) lists = input.lists;
      else if (input.format || input.schemaVersion != null || input.version != null) throw new Error('This backup format or version is not supported.');
      else if (Array.isArray(input.questions) || Array.isArray(input.items)) lists = [input];
      else throw new Error('Choose a vocabulary-list or question-bank JSON backup. Activity projects and raw browser backups need a separate adapter.');
      var hash = await checksum(rawValue);
      data = {
        format: 'cls-teaching-library', schemaVersion: 2, exportedAt: new Date().toISOString(),
        collections: [], activities: [],
        legacyRecords: [{ sourceKey: 'json-file', rawValue: rawValue, checksum: hash }],
        migration: { adapterVersion: 1, sources: [hash] }
      };
      if (lists.length > 100) throw new Error('Please split this backup into no more than 100 collections.');
      lists.forEach(function (list, collectionIndex) {
        if (!object(list) || (Array.isArray(list.items) === Array.isArray(list.questions))) throw new Error('Each collection must contain either vocabulary items or questions.');
        var questions = Array.isArray(list.questions);
        var collectionId = 'import_' + hash + '_' + collectionIndex;
        var collectionName = text(list.name) || 'Untitled collection';
        var collection = {
          id: collectionId, kind: questions ? 'question-bank' : 'vocabulary', name: collectionName,
          description: text(list.description), theme: text(list.theme), level: text(list.level), curriculum: text(list.curriculum), tags: tags(list.tags),
          createdAt: date(list.importedAt), updatedAt: date(list.updatedAt == null ? list.updated : list.updatedAt), revision: 1,
          source: { kind: 'import', legacyId: text(list.id), sourceLabel: text(list.source), sourceRevision: hash },
          items: (questions ? list.questions : list.items).map(function (record, itemIndex) {
            if (!object(record)) throw new Error('A collection contains an invalid item.');
            var id = collectionId + '_item_' + itemIndex;
            var common = { id: id, theme: text(record.theme || list.theme), level: text(record.level || list.level), note: text(record.note), legacy: record };
            if (!questions) {
              common.kind = 'vocabulary';
              common.term = text(record.zh);
              common.pronunciation = text(record.py);
              common.definition = text(record.en);
              common.translations = object(record.translations) ? record.translations : {};
              common.emoji = text(record.emoji);
              common.imageUrl = text(record.img);
            } else {
              common.kind = 'question';
              common.prompt = text(record.prompt == null ? record.question : record.prompt);
              common.answer = text(record.answer);
              common.type = text(record.type) || 'Question';
              common.tags = tags(record.tags);
              var options = Array.isArray(record.options) ? record.options : [record.optionA, record.optionB, record.optionC, record.optionD];
              common.options = options.map(function (option, optionIndex) { return { id: id + '_option_' + optionIndex, label: String.fromCharCode(65 + optionIndex), text: text(option) }; });
              common.correctOptionId = null;
              if (/^[A-D]$/i.test(common.answer.trim())) {
                var option = common.options[common.answer.trim().toUpperCase().charCodeAt(0) - 65];
                if (option && option.text.trim()) common.correctOptionId = option.id;
              }
            }
            return common;
          }), legacy: list
        };
        data.collections.push(collection);
      });
    }
    validate(data);
    data.collections.forEach(function (collection) {
      var seen = new Set();
      collection.items.forEach(function (item, itemIndex) {
        var legacyId = object(item.legacy) ? text(item.legacy.id || item.legacy.questionId) : '';
        if (legacyId && seen.has(legacyId)) warnings.push(collection.name + ': duplicate original ID ' + legacyId + '; both entries were kept.');
        seen.add(legacyId);
        if (item.kind === 'vocabulary') {
          if (!item.term.trim()) warnings.push(collection.name + ': item ' + (itemIndex + 1) + ' has no term; it was kept.');
        } else {
          if (!item.prompt.trim() || !item.answer.trim()) warnings.push(collection.name + ': question ' + (itemIndex + 1) + ' is missing a prompt or answer; it was kept.');
          if (/^[A-D]$/i.test(item.answer.trim())) {
            var option = item.options[item.answer.trim().toUpperCase().charCodeAt(0) - 65];
            if (!option || !option.text.trim()) warnings.push(collection.name + ': question ' + (itemIndex + 1) + ' has a letter answer without a matching option.');
          }
        }
      });
    });
    checkSize(data, 0, { count: 0 });
    if (new TextEncoder().encode(JSON.stringify(data, null, 2)).length > MAX_BYTES) throw new Error('The converted backup exceeds 5 MB. Please split the original into smaller collections.');
    return { data: data, warnings: warnings, summary: {
      collections: data.collections.length,
      vocabulary: data.collections.filter(function (collection) { return collection.kind === 'vocabulary'; }).reduce(function (total, collection) { return total + collection.items.length; }, 0),
      questions: data.collections.filter(function (collection) { return collection.kind === 'question-bank'; }).reduce(function (total, collection) { return total + collection.items.length; }, 0)
    } };
  }

  var api = { preview: preview, maxBytes: MAX_BYTES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChenLibraryV2 = api;
})(typeof window === 'object' ? window : globalThis);
