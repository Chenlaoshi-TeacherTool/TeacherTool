# Database

Part of the Azure SQL migration described in `docs/azure-architecture-migration.md`.

## Changing the database: numbered migrations

Every change to tables after the original `schema.sql` is a file in `migrations/`, named
`NNNN_short-name.sql` and run in number order, once per database. `dbo.schema_migrations` records
which ones have run.

**Adding a change**

1. Create the next file, e.g. `migrations/0009_add-something.sql`. Make it safe to run twice
   (`IF OBJECT_ID(...) IS NULL`, `IF COL_LENGTH(...) IS NULL`), and wrap it in a transaction.
2. End it with the line that records it (copy from any other migration, with its own id):
   ```sql
   IF NOT EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE id = N'0009_add-something')
       INSERT INTO dbo.schema_migrations (id) VALUES (N'0009_add-something');
   ```
3. Set `requiredMigration` in `src/teachingTools/config/database.js` to the new id. The tests fail
   until the numbering, the record line and this setting all agree.
4. Run it on the database **before** pushing the code that needs it.

**Running migrations** (from `src/teachingTools`)

```
npm run db:status                      # applied and pending migrations
npm run db:migrate                     # runs the pending ones in order
npm run db:migrate -- --azure-settings # uses the web app's SQL_CONNECTION_STRING via the Azure CLI
```

The scripts use `DB_MIGRATION_CONNECTION_STRING` (or `SQL_CONNECTION_STRING`). The login needs
permission to change tables, and the database firewall must allow your computer. Running a file by
hand in the Azure Portal query editor works too: each file records itself.

If the database is missing a migration the deployed code needs, every `/admin` page shows a red
warning and the app logs one at start-up.

**Migrations so far**

- `0000_schema-migrations.sql` — creates `schema_migrations`. On a database that had the earlier
  files run by hand, it also records 0001–0008 for each change it finds already in place.
- `0001_add-textbook-lessons.sql` — textbook companion tables (`textbook_lessons`,
  `textbook_lesson_items`). Redeploy DAB afterwards. Lesson data is loaded from Excel at
  `/admin/textbooks/import`.
- `0002_add-teacher-private-library.sql` — private cloud library per teacher account
  (`teacher_private_libraries`, `teacher_library_access`). Not exposed through DAB.
- `0003_add-teacher-membership.sql` — the 3-day trial marker and `teacher_activation_codes` (hashes
  only). Codes are created at `/admin/memberships`.
- `0004_add-teacher-activities.sql` — `teacher_activities`: which shared games and books belong to
  which teacher account, so My activities works on any device. Content stays in Blob storage.
- `0005_add-activation-code-revocation.sql` — `revoked_at` / `revoked_by` on activation codes, so an
  admin can deactivate a code (refunds).
- `0006_add-teacher-activity-payload.sql` — `payload`, `game_version` and `expires_at` on
  `teacher_activities`, so a game stays in the account after its link expires and My activities can
  make a new link.
- `0007_add-teacher-accounts.sql` — `teacher_accounts`: email, name, sign-up and last-seen dates per
  teacher account, filled in on sign-in. Used by "Find a teacher" at `/admin/memberships`.
- `0008_add-membership-events.sql` — `membership_events`: an add-only history of every change to a
  teacher's cloud-saving end date (trial, activation code, refund), with the end date before and
  after. Sign-in, code redemption and refunds write to it inside their transactions.
- `0009_add-community-posts.sql` — `community_posts` and `community_reports`: word lists and games
  teachers publish at `/community`, plus the reports other teachers send. Hidden or deleted at
  `/admin/community`.
- `0010_add-textbook-lesson-files.sql` — `textbook_lesson_files`: PDF/Word/PowerPoint files attached to a
  textbook lesson. The files are in the private `textbook-materials` blob container; members download
  them through `/textbook-companion/files/:id`. Also adds `textbook_lessons.games` ("name | link" per
  line) and the 12 lessons of Jinan “中文” Book 1 (第一课–第十二课), to be renamed at `/admin/textbooks`.

## Other files

- `schema.sql` — the original table definitions. For a new, empty database run it first, then every
  file in `migrations/` in order.
- `backfill-word-lists.sql`, `backfill-question-banks.sql`, `backfill-site-content.sql`,
  `backfill-recommendation-products.sql` — the INSERT statements used to move the original
  hardcoded `data/*.js` content into SQL. Kept as a historical record; the generator scripts and
  `data/*.js` modules are deleted, so `DAB_BASE_URL` and a reachable DAB instance are required for
  the site to serve word lists, question banks, tool guides, or articles.
- `dab-config.json` — Data API Builder configuration exposing the content tables as a read-only
  REST API for the public site, alongside direct-SQL writes from the admin CMS. Teacher and
  membership tables are not exposed.

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
