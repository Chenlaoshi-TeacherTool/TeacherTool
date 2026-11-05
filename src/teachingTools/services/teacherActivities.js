'use strict';

// Links shared games and books to the signed-in teacher account. A share made
// while signed in stores the account's owner key in its manifest and gets a row
// in dbo.teacher_activities; the owner can then manage it from any device.
// Recording is best effort: a database problem never blocks sharing itself.

var api = {
  repository: require('./teacherActivitiesRepository'),

  // Owner key of the signed-in teacher, or null when accounts are off or nobody is signed in.
  ownerKeyFor: function (req) {
    if (process.env.TEACHER_ACCOUNTS_ENABLED !== 'true') return null;
    var teacherLibrary = require('../routes/teacherLibrary');
    var user = teacherLibrary.trustedUser(req);
    return user ? teacherLibrary.ownerKey(user) : null;
  },

  // Account-based access needs the signed-in owner plus proof the request came
  // from this site's own pages (sign-in cookies are sent automatically).
  isOwnerRequest: function (req, manifest) {
    if (!manifest || !manifest.ownerKey) return false;
    var origin = new URL(process.env.SITE_URL || 'https://clsteachingtools.com').origin;
    var sameSite = req.get('x-library-request') === 'activities' && req.get('origin') === origin &&
      (!req.get('sec-fetch-site') || req.get('sec-fetch-site') === 'same-origin');
    return sameSite && api.ownerKeyFor(req) === manifest.ownerKey;
  },

  record: async function (owner, item) {
    if (!owner) return;
    try { await api.repository.add(owner, item); }
    catch (error) { console.error('teacher activity record error:', error.message); }
  },

  // The link was deleted on purpose: the activity goes too.
  forget: async function (kind, id) {
    try { await api.repository.removeItem(kind, id); }
    catch (error) { console.error('teacher activity forget error:', error.message); }
  },

  // The link expired: games with saved content stay so a new link can be made.
  linkExpired: async function (kind, id) {
    try { await api.repository.linkExpired(kind, id); }
    catch (error) { console.error('teacher activity expiry error:', error.message); }
  }
};

module.exports = api;
