# Architecture migration: Azure SQL + Blob Storage + Data API Builder + Admin CMS

## Status

Supersedes the storage decision in `docs/vocabulary-cloud-sync.md` (Azure Table Storage for
cloud word lists). All content — preset question banks, preset and teacher-owned word lists,
tool guide pages, and articles — moves to a single Azure SQL database instead of splitting
across Table Storage and hardcoded JS modules.

## Why one database instead of two storage systems

Teacher-owned word lists are small in volume and shape almost identically to the existing
preset word lists (`word_lists` / `word_list_items` with an `owner_user_id` column instead of a
separate store). Keeping everything in Azure SQL means:

- One data-access layer (Data API Builder) instead of the Storage Table SDK plus a second query
  path.
- The admin CMS only ever talks to one database.
- Teacher lists and preset lists can share the same table and API shape.

## Current state (as of this migration)

- No database exists today. All content in `src/teachingTools/data/*.js` is hardcoded and
  `require()`d directly into `routes/api.js` and `routes/index.js`.
- No file/media storage exists. Everything under `public/` is a static asset checked into the
  repo.
- No admin interface exists.
- `AZURE_AUTH_ENABLED` / `x-ms-client-principal-*` header handling in `routes/api.js` is the only
  piece of the target architecture already in place.

## Target architecture

- **Azure SQL** — canonical store for question banks, questions, word lists, word list items,
  tool guides, articles, and users. Schema: `database/schema.sql`.
- **Azure Blob Storage** — images and other media referenced by content rows (e.g.
  `word_list_items.img_blob_url`). Nothing references Blob Storage yet since no content has
  images today; the column is ready for when it does.
- **Data API Builder (DAB)** — generates the REST/GraphQL API directly from the SQL schema. This
  becomes the backend `routes/api.js` proxies to (or is replaced by, for read-only endpoints).
- **Admin CMS** — a form-based interface, protected by the existing Easy Auth setup, for editing
  rows in the tables above without redeploying code.

## Data model

See `database/schema.sql` for the full DDL. Key decisions:

- Small nested arrays (`options`, `tags` on questions; `steps`, `tips` on tool guides; `intro`,
  `sections` on articles) are stored as JSON columns rather than normalized into junction
  tables. DAB and the admin CMS treat these as structured sub-forms; this avoids deep joins for
  content that is fundamentally document-shaped.
- `questions.theme_zh` keeps the original Chinese theme value that `routes/api.js` currently
  discards (it overwrites each question's theme with the parent bank's English theme on output).
  Kept for provenance and to allow a future Chinese-language admin view.
- `level_lookup` and `type_lookup` replace the `levelLabels` / `typeLabels` dictionaries
  currently hardcoded in `routes/api.js`.
- `word_lists.owner_user_id` is nullable: `NULL` rows are public preset lists, non-null rows are
  a teacher's saved lists — this is what `GET /api/wordlists/mine` (currently a `501` stub) will
  read once implemented.

## Migration steps

1. ~~Design the schema~~ — done, see `database/schema.sql`.
2. ~~Provision an Azure SQL database, run `database/schema.sql`, and backfill it~~ — done. All of
   `word_lists`/`word_list_items`, `question_banks`/`questions`, `tool_guides`, and `articles` are
   backfilled from the `data/*.js` modules via the `database/generate-*-backfill.js` scripts.
3. ~~Stand up Data API Builder and confirm the generated API matches what `routes/api.js`'s
   consumers need~~ — done locally; verified byte-for-byte identical output against the hardcoded
   modules for all word lists, question banks, tool guides, and articles.
4. ~~Repoint `routes/api.js` / `routes/index.js` at the DAB-backed endpoints~~ — done, gated
   behind the `DAB_BASE_URL` environment variable so production keeps using the hardcoded
   `data/*.js` modules until that variable is set.
5. ~~Deploy DAB somewhere it runs continuously~~ — done. Running as the `teachingtools-dab`
   Azure Container App; see `database/README.md` for the deployed URL and redeploy steps.
6. ~~Set `DAB_BASE_URL` on the production App Service~~ — done. Production now reads from Azure
   SQL via DAB; verified `wordlists/presets`, `questionbanks/presets/:id`, `/resources`, and
   `/teaching-tools/*` pages live.
7. ~~Add an Azure Storage account + container for Blob Storage; wire up `img_blob_url`~~ — done.
   Admin CMS word list items can attach an image, stored in the `wordlist-images` container.
8. ~~Build the admin CMS~~ — done, covering word lists (with images), question banks (with an
   Excel bulk-import), tool guides, and articles. Protected by Easy Auth plus an `ADMIN_USER_IDS`
   allowlist (see `middleware/requireAdmin.js`); admin writes go directly to SQL rather than
   through DAB, which stays anonymous-read-only.
9. ~~Remove the `data/*.js` modules and their `require()`s~~ — done, after the DAB path ran
   stable in production. `routes/api.js` and `services/siteContentStore.js` no longer have a
   fallback: `DAB_BASE_URL` and a reachable DAB instance are required for the site to serve
   word lists, question banks, tool guides, or articles.

## Follow-up work not yet done

- `GET /api/wordlists/mine` is still a `501` stub — teacher-owned cloud word lists (as opposed
  to the admin-managed preset ones) aren't implemented yet.
- No teaching tool's front-end actually renders `word_list_items.img_blob_url` yet — the field is
  populated and returned by the API, but nothing displays the image.
- Question bank images aren't wired up (only word list items have `img_blob_url`).
