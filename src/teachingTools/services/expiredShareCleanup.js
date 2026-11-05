'use strict';

// Deletes shared games and books whose links have expired. Owned games keep
// their My activities entry (with the saved content) so the teacher can make a
// new link; books are dropped from the list. Links are also removed when someone opens an
// expired one, but links nobody opens again would otherwise stay in storage forever.
// Book folders without a manifest are unpublished drafts; they go once untouched
// for DRAFT_MAX_AGE_MS.

var DAY_MS = 24 * 60 * 60 * 1000;
var DRAFT_MAX_AGE_MS = 30 * DAY_MS;
var FIRST_RUN_DELAY_MS = 5 * 60 * 1000;
var INTERVAL_MS = DAY_MS;

function isExpired(manifest, now) {
  return !manifest.expiresAt || new Date(manifest.expiresAt).getTime() < now;
}

function defaultKinds() {
  var games = require('./gameShareStorage');
  var books = require('./bookGeneratorStorage');
  return [
    { kind: 'game', list: games.listShares, getManifest: games.getManifest, remove: games.deleteShare, validId: games.validShareId },
    { kind: 'book', list: books.listBooks, getManifest: books.getManifest, remove: books.deleteBook, validId: function (id) { return /^[a-zA-Z0-9-]{1,64}$/.test(id); } }
  ];
}

async function run(options) {
  options = options || {};
  var kinds = options.kinds || defaultKinds();
  var activities = options.activities || require('./teacherActivities');
  var now = options.now || Date.now();
  var summary = { deleted: 0, drafts: 0, kept: 0, failed: 0 };

  for (var store of kinds) {
    var folders = await store.list();
    for (var folder of folders) {
      if (!store.validId(folder.id)) continue;
      try {
        if (!folder.hasManifest) {
          if (now - new Date(folder.lastModified).getTime() < DRAFT_MAX_AGE_MS) { summary.kept += 1; continue; }
          await store.remove(folder.id);
          summary.drafts += 1;
          continue;
        }
        var manifest = await store.getManifest(folder.id);
        if (!manifest || !isExpired(manifest, now)) { summary.kept += 1; continue; }
        await store.remove(folder.id);
        if (manifest.ownerKey) await activities.linkExpired(store.kind, folder.id);
        summary.deleted += 1;
      } catch (error) {
        summary.failed += 1;
        console.error('expired share cleanup error (' + store.kind + ' ' + folder.id + '):', error.message);
      }
    }
  }
  return summary;
}

// Runs a few minutes after start-up, then once a day. Every step is safe to
// repeat, so several app instances running it at once does no harm.
function schedule() {
  if (process.env.EXPIRED_SHARE_CLEANUP === 'off') return null;
  function tick() {
    run().then(function (summary) {
      console.log('expired share cleanup:', JSON.stringify(summary));
    }).catch(function (error) {
      console.error('expired share cleanup failed:', error.message);
    });
  }
  var first = setTimeout(tick, FIRST_RUN_DELAY_MS);
  var repeat = setInterval(tick, INTERVAL_MS);
  first.unref();
  repeat.unref();
  return { stop: function () { clearTimeout(first); clearInterval(repeat); } };
}

module.exports = { run: run, schedule: schedule, DRAFT_MAX_AGE_MS: DRAFT_MAX_AGE_MS };
