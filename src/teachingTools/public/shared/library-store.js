(function (root) {
  'use strict';

  var core = typeof module === 'object' && module.exports ? require('./library-v2') : root.ChenLibraryV2;
  var KEY = 'cls-library-v2:active';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

  function empty() {
    return { format: 'cls-teaching-library', schemaVersion: 2, exportedAt: null, collections: [], activities: [], legacyRecords: [], migration: { adapterVersion: 1, sources: [] } };
  }

  function reidentify(collection, id) {
    var copy = clone(collection);
    copy.id = id;
    copy.items.forEach(function (item, index) {
      item.id = id + '_item_' + index;
      var answerIndex = item.kind === 'question' ? item.options.findIndex(function (option) { return option.id === item.correctOptionId; }) : -1;
      if (item.kind === 'question') item.options.forEach(function (option, optionIndex) {
        option.id = item.id + '_option_' + optionIndex;
      });
      if (answerIndex >= 0) item.correctOptionId = item.options[answerIndex].id;
    });
    return copy;
  }

  async function fingerprint(collection) {
    var bytes = new TextEncoder().encode(JSON.stringify(collection));
    var hash = await root.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
  }

  function create(storage, locks) {
    async function load() {
      var raw;
      try { raw = storage.getItem(KEY); } catch (error) { throw new Error('Browser storage is unavailable. Download a backup instead.'); }
      if (raw === null) return { data: empty(), raw: null };
      try {
        var parsed = JSON.parse(raw);
        if (!parsed || parsed.format !== 'cls-teaching-library' || parsed.schemaVersion !== 2) throw new Error('The saved library format is not supported.');
        return { data: (await core.preview(raw)).data, raw: raw };
      }
      catch (error) { throw new Error('Your saved library could not be read. Its original data has been kept. ' + error.message); }
    }

    async function prepare(input) {
      var incoming = (await core.preview(JSON.stringify(input))).data;
      var saved = await load();
      var data = clone(saved.data);
      var entries = [];
      for (var collection of incoming.collections) {
        var copyId = collection.id + '_copy_' + await fingerprint(collection);
        var candidate = reidentify(collection, copyId);
        var duplicate = data.collections.find(function (existing) { return equal(existing, collection) || equal(existing, candidate); });
        if (duplicate) { entries.push({ name: collection.name, status: 'duplicate' }); continue; }
        var usedIds = new Set();
        data.collections.forEach(function (existing) {
          usedIds.add(existing.id);
          existing.items.forEach(function (item) { usedIds.add(item.id); });
        });
        var collision = usedIds.has(collection.id) || collection.items.some(function (item) { return usedIds.has(item.id); });
        var related = saved.data.collections.some(function (existing) {
          if (existing.kind !== collection.kind) return false;
          var existingId = existing.source && existing.source.legacyId;
          var incomingId = collection.source && collection.source.legacyId;
          return (incomingId && existingId === incomingId) || existing.name === collection.name;
        });
        entries.push({ name: collection.name, status: collision || related ? 'conflict' : 'new' });
        data.collections.push(collision ? candidate : clone(collection));
      }
      if (entries.some(function (entry) { return entry.status !== 'duplicate'; })) {
        incoming.legacyRecords.forEach(function (record) {
          if (!data.legacyRecords.some(function (existing) { return equal(existing, record); })) data.legacyRecords.push(clone(record));
        });
        var metadata = Object.create(null);
        Object.keys(incoming).filter(function (key) { return !['format', 'schemaVersion', 'exportedAt', 'collections', 'activities', 'legacyRecords'].includes(key); }).forEach(function (key) { metadata[key] = incoming[key]; });
        var record = { sourceKey: 'import-metadata', rawValue: JSON.stringify(metadata) };
        if (!data.legacyRecords.some(function (existing) { return equal(existing, record); })) data.legacyRecords.push(record);
      }
      await core.preview(JSON.stringify(data));
      return { incoming: incoming, baseRaw: saved.raw, entries: entries, data: data };
    }

    async function save(plan, keepBoth) {
      if (!locks || typeof locks.request !== 'function') throw new Error('Safe browser saving is unavailable here. Use a current browser on HTTPS or download a backup.');
      return locks.request(KEY, async function () {
        var checked = await prepare(plan.incoming);
        if (checked.baseRaw !== plan.baseRaw) throw new Error('Your library changed in another tab. Check the import again before saving.');
        if (checked.entries.some(function (entry) { return entry.status === 'conflict'; }) && !keepBoth) throw new Error('Confirm “Keep both copies” before saving conflicting collections.');
        if (checked.entries.every(function (entry) { return entry.status === 'duplicate'; })) return checked.data;
        checked.data.exportedAt = new Date().toISOString();
        await core.preview(JSON.stringify(checked.data));
        var raw = JSON.stringify(checked.data);
        if (storage.getItem(KEY) !== plan.baseRaw) throw new Error('Your library changed in another tab. Check the import again before saving.');
        try { storage.setItem(KEY, raw); }
        catch (error) { throw new Error('Your library could not be saved. Existing data has been kept. Download a backup or free browser storage.'); }
        if (storage.getItem(KEY) !== raw) throw new Error('The saved library could not be verified. Keep a downloaded backup and check the library again.');
        return checked.data;
      });
    }

    return { load: load, prepare: prepare, save: save };
  }

  var api = { create: create, key: KEY };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChenLibraryStore = api;
})(typeof window === 'object' ? window : globalThis);
