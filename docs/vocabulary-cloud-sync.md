# Vocabulary Library: cloud-sync rollout

> **Superseded:** the Azure Table Storage decision below has been replaced by a single Azure SQL
> database for all content, including teacher-owned word lists. See
> `docs/azure-architecture-migration.md`.

## What is complete locally

- Public preset word-list API: `GET /api/wordlists/presets`
- Shared word-list schema: Chinese, pinyin, English, theme, level, image, and note
- Browser-local save, export, and import-ready JSON data
- Azure App Service authentication detection endpoint: `GET /api/auth/me`

## Decisions

1. Keep public preset lists anonymous and free to use.
2. Require sign-in only to save or sync a teacher's custom lists to the cloud.
3. Use Azure App Service Authentication (Easy Auth) with Google and Microsoft sign-in. Do not collect or store passwords in this Express app.
4. Store each cloud word list with an `ownerId` taken from the authenticated Azure request headers. Every read/write must filter by this id on the server.
5. Use Azure Table Storage for the initial cloud store. Each list is a small JSON document, so it is a simple, economical starting point. Move to Cosmos DB only if richer queries, sharing, or high volume justify it.

## Azure configuration required before cloud saving can be enabled

1. In the Azure App Service, configure **Authentication** with Google and/or Microsoft Entra ID.
2. Set unauthenticated requests to **Allow anonymous requests** so the public tools remain public.
3. Create an Azure Storage account and a Table named `wordlists`.
4. Enable the web app's system-assigned managed identity and grant it **Storage Table Data Contributor** for that storage account.
5. Add these App Service settings:
   - `AZURE_AUTH_ENABLED=true`
   - `WORDLIST_STORAGE_ACCOUNT=<storage-account-name>`
6. Add the Azure storage SDK dependency and implement authenticated `GET`, `POST`, `PUT`, and `DELETE` endpoints under `/api/wordlists/mine`.

## Launch control

The public page already shows disabled Google and Microsoft buttons as a visual placeholder. They must remain disabled until the owner explicitly approves the launch. Do not configure an application-wide authentication requirement: public preset lists and teaching tools must stay accessible without an account.

## API contract for the next implementation step

- `GET /api/auth/me` → current sign-in state; already implemented.
- `GET /api/wordlists/presets` → public preset lists; already implemented.
- `GET /api/wordlists/mine` → current teacher's cloud lists; route reserved.
- `POST /api/wordlists/mine` → save a new list for the current teacher.
- `PUT /api/wordlists/mine/:id` → update one of the current teacher's lists.
- `DELETE /api/wordlists/mine/:id` → delete one of the current teacher's lists.

The server, not browser code, must read the authenticated identity and enforce ownership for every cloud request.
