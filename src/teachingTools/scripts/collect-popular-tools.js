'use strict';

// Read credentials in memory; never print Azure settings or Clarity URL data.
var execFileSync = require('node:child_process').execFileSync;
async function main() {
  if (process.argv.includes('--azure-settings')) {
    var settings;
    try {
      var args = ['webapp', 'config', 'appsettings', 'list', '-g', 'rg-xchen', '-n', 'chenlaoshi-teachingtools', '-o', 'json'];
      var windows = process.platform === 'win32';
      settings = JSON.parse(execFileSync(windows ? 'cmd.exe' : 'az', windows ? ['/d', '/s', '/c', 'az ' + args.join(' ')] : args,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch (err) { throw new Error('Could not read Azure app settings.'); }
    ['CLARITY_API_TOKEN', 'AZURE_STORAGE_CONNECTION_STRING'].forEach(function(name) {
      var setting = settings.find(function(item) { return item.name === name; });
      if (!process.env[name] && setting) process.env[name] = setting.value;
    });
  }
  console.log(JSON.stringify(await require('../services/popularTools').collect()));
}
main().catch(function(err) {
  // SDK error bodies may contain request details; print only our known messages/status.
  console.error(/^Clarity |^Could not read |^Clarity token/.test(err.message) ? err.message : 'Popularity collection failed (' + (err.statusCode || err.code || 'unexpected response') + ').');
  process.exitCode = 1;
});
