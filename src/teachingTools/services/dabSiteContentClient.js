'use strict';

/*
 * Reads tool guides and articles from the Data API Builder instance
 * described in database/dab-config.json. See services/siteContentStore.js,
 * which loads this at startup and after every admin edit.
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

function toToolGuide(row) {
  return {
    title: row.title,
    eyebrow: row.eyebrow,
    grades: row.grades,
    duration: row.duration,
    summary: row.summary,
    whatItIs: row.what_it_is,
    steps: JSON.parse(row.steps || '[]'),
    exampleTitle: row.example_title,
    example: row.example,
    tips: JSON.parse(row.tips || '[]'),
    appUrl: row.app_url || undefined
  };
}

function toArticle(row) {
  return {
    slug: row.slug,
    category: row.category,
    title: row.title,
    description: row.description,
    readTime: row.read_time,
    intro: JSON.parse(row.intro || '[]'),
    sections: JSON.parse(row.sections || '[]'),
    relatedTool: row.related_tool_label
      ? { label: row.related_tool_label, href: row.related_tool_href }
      : undefined
  };
}

async function loadAll() {
  var toolGuideRows = await dabGet('/toolguides');
  var articleRows = await dabGet('/articles?$orderby=id');

  var toolGuides = {};
  toolGuideRows.forEach(function (row) { toolGuides[row.slug] = toToolGuide(row); });

  return {
    toolGuides: toolGuides,
    articles: articleRows.map(toArticle)
  };
}

module.exports = { loadAll: loadAll };
