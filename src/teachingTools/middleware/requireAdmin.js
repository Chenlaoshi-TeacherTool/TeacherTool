'use strict';

var authUser = require('../services/authUser');

function adminIds() {
  return (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map(function (id) { return id.trim(); })
    .filter(Boolean);
}

module.exports = function requireAdmin(req, res, next) {
  if (!authUser.azureAuthEnabled()) {
    return res.status(503).send('Admin sign-in is not configured on this environment.');
  }
  var user = authUser.currentUser(req);
  if (!user) {
    var redirectTo = '/.auth/login/aad?post_login_redirect_uri=' + encodeURIComponent(req.originalUrl);
    return res.redirect(redirectTo);
  }
  if (adminIds().indexOf(user.id) === -1) {
    return res.status(403).send('Signed in as ' + user.name + ', but this account is not an admin.');
  }
  req.adminUser = user;
  next();
};
