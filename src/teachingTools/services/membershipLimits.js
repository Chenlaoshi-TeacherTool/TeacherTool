'use strict';

var membership = require('../config/membership');

// Decides what a request may create on the server: how long a shared link
// lives and whether a book may carry narration or music. Members are signed-in
// teachers whose cloud access is active (trial or activation code).
function create(options) {
  options = options || {};
  var enabled = options.enabled || function () { return membership.limitsEnabled; };
  var lifetimes = options.lifetimes || membership.shareLifetimeMs;
  var isMember = options.isMember || async function (req) {
    var teacherLibrary = require('../routes/teacherLibrary');
    var user = teacherLibrary.trustedUser(req);
    if (!user) return false;
    try { return await require('./teacherLibraryRepository').hasActiveAccess(teacherLibrary.ownerKey(user)); }
    catch (error) { return false; }
  };

  return {
    shareLifetimeMs: async function (req) {
      if (!enabled()) return lifetimes.legacy;
      return (await isMember(req)) ? lifetimes.member : lifetimes.free;
    },
    canUseBookAudio: async function (req) {
      return !enabled() || isMember(req);
    }
  };
}

module.exports = create();
module.exports.create = create;
