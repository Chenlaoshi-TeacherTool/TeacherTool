'use strict';

function azureAuthEnabled() {
  return process.env.AZURE_AUTH_ENABLED === 'true';
}

function currentUser(req) {
  if (!azureAuthEnabled()) return null;
  var id = req.get('x-ms-client-principal-id');
  if (!id) return null;
  return {
    id: id,
    name: req.get('x-ms-client-principal-name') || 'Signed-in teacher',
    provider: req.get('x-ms-client-principal-idp') || 'azure'
  };
}

module.exports = {
  azureAuthEnabled: azureAuthEnabled,
  currentUser: currentUser
};
