# Database migration files

Part of the Azure SQL migration described in `docs/azure-architecture-migration.md`.

- `schema.sql` — full table definitions for the target Azure SQL database.
- `generate-word-lists-backfill.js` — reads `src/teachingTools/data/preset-wordlists.js` and
  prints INSERT statements. Re-run and redirect to `backfill-word-lists.sql` if the source data
  changes before the migration is complete: `node database/generate-word-lists-backfill.js > database/backfill-word-lists.sql`.
- `backfill-word-lists.sql` — generated output of the above, ready to run.
- `dab-config.json` — Data API Builder configuration exposing `word_lists` and `word_list_items`
  as a read-only REST API, as a first proof of concept before wiring up the rest of the schema.

## What's needed to try this end-to-end

1. An Azure SQL database (a Basic/serverless tier is enough for this proof of concept).
2. `schema.sql` run against it, then `backfill-word-lists.sql`.
3. The Data API Builder CLI (`dab`) or its container image, pointed at `dab-config.json`, with
   `DATABASE_CONNECTION_STRING` set to that database's connection string.
4. A request to the DAB REST endpoint (e.g. `GET /api/wordlists`) to confirm it returns the
   backfilled rows.

Note: DAB is a separate runtime (a .NET-based CLI/container), not something the existing Express
app runs in-process.

## Deployed instance

DAB is now running as an Azure Container App:

- Resource group: `rg-xchen` (West US 2)
- Container Registry: `chenlaoshiacr.azurecr.io` (image `dab:latest`, built from `Dockerfile` via
  `az acr build`)
- Container Apps environment: `teachingtools-dab-env`
- Container App: `teachingtools-dab`, connected to the `TeacherToolDb` Azure SQL database via the
  `DATABASE_CONNECTION_STRING` secret
- Public URL: `https://teachingtools-dab.agreeablecliff-18528c5a.westus2.azurecontainerapps.io/api`
- Image pulls use the Container App's system-assigned managed identity (granted `AcrPull` on
  `chenlaoshiacr`) rather than the registry's admin username/password — the ACR admin user is
  disabled.

To point `routes/api.js` / `routes/index.js` at it, set `DAB_BASE_URL` to that URL (with `/api`)
in the environment where the Express app runs.

### Redeploying after a schema or config change

```
az acr build --registry chenlaoshiacr --image dab:latest database
az containerapp update --name teachingtools-dab --resource-group rg-xchen --image chenlaoshiacr.azurecr.io/dab:latest
```
