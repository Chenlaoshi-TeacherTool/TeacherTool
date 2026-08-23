# Database migration files

Part of the Azure SQL migration described in `docs/azure-architecture-migration.md`.

- `schema.sql` — full table definitions for the Azure SQL database.
- `backfill-word-lists.sql`, `backfill-question-banks.sql`, `backfill-site-content.sql` — the
  INSERT statements used to migrate the original hardcoded `data/*.js` modules into SQL. Kept as
  a historical record; the generator scripts that produced them (and the `data/*.js` modules
  themselves) have been deleted now that the DAB-backed path has run stable in production —
  `routes/api.js`, `services/siteContentStore.js`, and the admin CMS have no fallback to
  hardcoded data anymore, so `DAB_BASE_URL` and a reachable DAB instance are required for the
  site to serve word lists, question banks, tool guides, or articles.
- `dab-config.json` — Data API Builder configuration exposing all of the above tables as a
  read-only REST API for the public site, alongside direct-SQL writes from the admin CMS.

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
