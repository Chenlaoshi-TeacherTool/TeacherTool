'use strict';

function azureAuthEnabled() {
  return process.env.AZURE_AUTH_ENABLED === 'true';
}

var EMAIL_CLAIMS = ['email', 'emails', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', 'preferred_username', 'upn'];
var EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,255}$/;

// The signed-in email from Easy Auth's x-ms-client-principal claims, falling
// back to the principal name when that is an email. Null when none is given.
function emailFrom(req) {
  var encoded = req.get('x-ms-client-principal');
  if (encoded && encoded.length < 16384) {
    try {
      var claims = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')).claims || [];
      for (var i = 0; i < EMAIL_CLAIMS.length; i += 1) {
        var claim = claims.find(function (entry) { return entry && entry.typ === EMAIL_CLAIMS[i] && EMAIL.test(String(entry.val || '')); });
        if (claim) return String(claim.val).toLowerCase();
      }
    } catch (error) { /* malformed header: fall through */ }
  }
  var name = req.get('x-ms-client-principal-name') || '';
  return EMAIL.test(name) ? name.toLowerCase() : null;
}

function currentUser(req) {
  if (!azureAuthEnabled()) return null;
  var id = req.get('x-ms-client-principal-id');
  if (!id) return null;
  return {
    id: id,
    name: req.get('x-ms-client-principal-name') || 'Signed-in teacher',
    provider: req.get('x-ms-client-principal-idp') || 'azure',
    email: emailFrom(req)
  };
}

module.exports = {
  azureAuthEnabled: azureAuthEnabled,
  currentUser: currentUser,
  emailFrom: emailFrom
};
