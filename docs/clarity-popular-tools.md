# Homepage popularity ranking

The homepage keeps its existing eight-card layout. Eligible tools and existing
translation keys are in `src/teachingTools/config/popularTools.json` (the currently
available tools from the directory; no coming-soon cards).

## Credentials and storage

Set `CLARITY_API_TOKEN` in the existing Azure Web App's application settings.
The collector also uses its existing `AZURE_STORAGE_CONNECTION_STRING` setting.
Neither credential belongs in source control. The scheduled workflow reuses the
deployment workflow's Azure OIDC login and reads settings in memory, without
printing them. Its Azure identity must have permission to list app settings.

History is stored in the private Azure Blob container `tool-popularity`, blob
`history.json`. Only tool paths, session counts and collection timestamps are
stored; full URLs, query strings and visitor data are discarded.

## Collection and ranking

`.github/workflows/refresh-popular-tools.yml` checks hourly, independently of
whether the web app is awake. It fetches Clarity only when at least 24 hours have
passed since the previous successful export. A Blob lease serializes writers.
Retries and restarts cannot append overlapping windows. Each request uses
`numOfDays=1&dimension1=URL`; only `Traffic.totalSessionCount` is used.

URL variants across the canonical/www/Azure hosts, query parameters, trailing
slashes, legacy low-prep routes and known tool HTML entry points are merged.
Summing URL session counts measures tool visits approximately: one session that
visits multiple URL aliases can be counted more than once. This is not a count
of unique users or in-tool button clicks.

Only complete samples starting within the past 30 days contribute. Startup has
less than 30 days of history; there is no historical backfill. Scheduler delays
or missed runs cause gaps, which are not filled with overlapping 48/72h exports.
This is sampled recent popularity, not an exact calendar-month total.

The top eight tools are rendered in both languages using existing translations.
If fewer than eight tools have data, original homepage picks fill the remaining
cards. Ties use tool path order. The app refreshes history at most once per hour;
failed reads retain the last cached history and retry after five minutes. Old
samples expire even when collection fails. Missing history uses original picks.
Truncated Clarity exports (1000 URL rows) fail rather than silently replacing data.

## Validation and operation

Run `node --test test/popularTools.test.js` from `src/teachingTools`.
After Azure CLI login, manually collect with:

```
node scripts/collect-popular-tools.js --azure-settings
```

This prints only collection status and ranked tool paths. Rerun to verify the
24-hour deduplication gate. After publishing the workflow to the default branch,
use its Run workflow button to verify the GitHub Azure identity's access. Local
Azure login success does not prove the workflow identity has the same access.
Verify a completed scheduled collection and the production homepage after release.
