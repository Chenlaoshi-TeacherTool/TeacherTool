'use strict';

/*
 * Reads word lists from the Data API Builder instance described in
 * database/dab-config.json. See routes/api.js.
 */

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

function toPublicList(row, items) {
  return {
    id: row.slug,
    name: row.name,
    description: row.description,
    theme: row.theme,
    level: row.level,
    curriculum: row.curriculum,
    count: items.length,
    items: items.map(function (item) {
      return {
        zh: item.zh,
        py: item.py,
        en: item.en,
        theme: row.theme,
        level: row.level,
        img: item.img_blob_url || '',
        note: item.note || ''
      };
    })
  };
}

async function getAllPublicLists() {
  var lists = await dabGet('/wordlists');
  var items = await dabGet('/wordlistitems');
  var itemsByListId = {};
  items.forEach(function (item) {
    (itemsByListId[item.list_id] = itemsByListId[item.list_id] || []).push(item);
  });
  return lists.map(function (list) {
    return toPublicList(list, itemsByListId[list.id] || []);
  });
}

async function getPublicListBySlug(slug) {
  var lists = await dabGet("/wordlists?$filter=slug eq '" + slug.replace(/'/g, "''") + "'");
  var list = lists[0];
  if (!list) return null;
  var items = await dabGet('/wordlistitems?$filter=list_id eq ' + list.id);
  return toPublicList(list, items);
}

module.exports = {
  getAllPublicLists: getAllPublicLists,
  getPublicListBySlug: getPublicListBySlug
};
