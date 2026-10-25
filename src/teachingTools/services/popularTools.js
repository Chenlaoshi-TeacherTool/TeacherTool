'use strict';

var catalog = require('../config/popularTools.json');
var BlobServiceClient = require('@azure/storage-blob').BlobServiceClient;
var DAY = 24 * 60 * 60 * 1000;
var fallbackSlugs = ['lucky-wheel', 'random-group-generator', 'qr-code-generator', 'class-pet-points', 'jeopardy', 'bingo-generator', 'maze-generator', 'word-cloud'];
var hosts = ['clsteachingtools.com', 'www.clsteachingtools.com', 'chenlaoshi-teachingtools.azurewebsites.net'];

function slugForPath(pathname) {
  var match = pathname.match(/^\/(?:teaching-tools|low-prep|low-prep-activities)\/([^/]+)(?:\/(?:index\.html|\1(?:-widget)?\.html))?\/?$/);
  return match ? match[1] : null;
}

function toolForUrl(value) {
  try {
    var url = new URL(value);
    if (hosts.indexOf(url.hostname) === -1) return null;
    var slug = slugForPath(url.pathname);
    return catalog.find(function(tool) { return slugForPath(tool.href) === slug; }) || null;
  } catch (err) { return null; }
}

function countsFromResponse(data) {
  var traffic = Array.isArray(data) && data.find(function(metric) { return metric.metricName === 'Traffic'; });
  if (!traffic || !Array.isArray(traffic.information)) throw new Error('Clarity Traffic data is missing.');
  // The API cannot paginate. Keep the previous ranking if an export may be truncated.
  if (traffic.information.length >= 1000) throw new Error('Clarity URL export reached the 1000-row limit.');
  var counts = {};
  traffic.information.forEach(function(row) {
    var tool = toolForUrl(row.Url);
    var sessions = Number(row.totalSessionCount);
    if (tool && Number.isFinite(sessions) && sessions > 0) {
      counts[tool.href] = (counts[tool.href] || 0) + sessions;
    }
  });
  return counts;
}

function rank(history, now) {
  var totals = {};
  history.filter(function(sample) { return Date.parse(sample.start) >= now - 30 * DAY && Date.parse(sample.end) <= now; })
    .forEach(function(sample) {
      Object.keys(sample.counts).forEach(function(href) { totals[href] = (totals[href] || 0) + sample.counts[href]; });
    });
  var measured = catalog.filter(function(tool) { return totals[tool.href] > 0; });
  measured.sort(function(a, b) { return totals[b.href] - totals[a.href] || a.href.localeCompare(b.href); });
  var fallback = fallbackSlugs.map(function(slug) { return catalog.find(function(tool) { return slugForPath(tool.href) === slug; }); });
  return measured.concat(fallback.filter(function(tool) { return measured.indexOf(tool) === -1; })).slice(0, 8);
}

function getContainer() {
  return BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING, {
    retryOptions: { maxTries: 1, tryTimeoutInMs: 10000 }
  }).getContainerClient('tool-popularity');
}

var cachedHistory = [];
var nextRefresh = 0;
var pending;
async function getCards() {
  var now = Date.now();
  if (process.env.AZURE_STORAGE_CONNECTION_STRING && now >= nextRefresh) {
    if (!pending) {
      pending = getContainer().getBlockBlobClient('history.json').downloadToBuffer().then(function(buffer) {
        var state = JSON.parse(buffer.toString('utf8'));
        if (!Array.isArray(state.history)) throw new Error('Invalid popularity history.');
        cachedHistory = state.history;
        nextRefresh = Date.now() + 60 * 60 * 1000;
      }).catch(function(err) {
        console.error('Popular tools refresh failed:', err.statusCode || err.code || 'invalid data');
        nextRefresh = Date.now() + 5 * 60 * 1000;
      }).finally(function() { pending = null; });
    }
    await pending;
  }
  return rank(cachedHistory, now);
}

async function collect() {
  if (!process.env.CLARITY_API_TOKEN || !process.env.AZURE_STORAGE_CONNECTION_STRING) throw new Error('Clarity token and Azure storage must be configured.');
  var container = getContainer();
  await container.createIfNotExists();
  var blob = container.getBlockBlobClient('history.json');
  try { await blob.uploadData(Buffer.from('{"history":[]}'), { conditions: { ifNoneMatch: '*' } }); }
  catch (err) { if (err.statusCode !== 409 && err.statusCode !== 412) throw err; }
  var lease = blob.getBlobLeaseClient();
  try { await lease.acquireLease(60); }
  catch (err) { if (err.statusCode === 409) return { skipped: 'Another collection is running.' }; throw err; }
  try {
    var state = JSON.parse((await blob.downloadToBuffer()).toString('utf8'));
    var start = Date.now() - DAY;
    // Full, non-overlapping 24h samples; retries/restarts never add the same period twice.
    if (state.history.some(function(sample) { return Date.parse(sample.end) > start; })) return { skipped: 'The next full 24-hour window is not due.' };
    var response = await fetch('https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1&dimension1=URL', {
      headers: { Authorization: 'Bearer ' + process.env.CLARITY_API_TOKEN }, signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error('Clarity returned HTTP ' + response.status);
    var counts = countsFromResponse(await response.json());
    var end = Date.now();
    // Include network time in the recorded window so a later request cannot overlap it.
    state.history = state.history.filter(function(sample) { return Date.parse(sample.start) >= end - 30 * DAY; });
    state.history.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString(), counts: counts });
    await blob.uploadData(Buffer.from(JSON.stringify(state)), {
      conditions: { leaseId: lease.leaseId }, blobHTTPHeaders: { blobContentType: 'application/json' }
    });
    return { samples: state.history.length, tools: Object.keys(counts).length, ranking: rank(state.history, end).map(function(tool) { return tool.href; }) };
  } finally { await lease.releaseLease(); }
}

module.exports = { catalog: catalog, slugForPath: slugForPath, toolForUrl: toolForUrl, countsFromResponse: countsFromResponse, rank: rank, getCards: getCards, collect: collect };
