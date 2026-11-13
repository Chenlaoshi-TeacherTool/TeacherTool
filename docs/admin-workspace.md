# Admin workspace

The admin home groups existing editors by task, with direct links for material uploads,
textbook vocabulary, new word lists and new question banks. Shared navigation uses
`config/adminWorkspace.js`; public navigation remains in `config/siteMap.js`.

## Website page editor

`/admin/pages` edits selected Chinese and English text on Home and About/Contact.
Save draft persists work without changing the public page; Publish saves and publishes
the entered text. Public pages keep built-in copy before the first publication.
The editor does not change layouts, images, contact addresses or automatic popular-tool rankings.

Production storage is Azure SQL. Apply `0021_add-site-pages` before deployment through
the existing migration workflow. Local development without SQL uses
`src/teachingTools/tmp/site-pages.json`, which is not a deployment artifact.

## Existing content

Existing articles now appear in Chinese Teaching; `/resources/:slug` URLs are preserved.
Article saves still publish immediately, as stated in the editor. This change does not
add article drafts or a rich text editor.

Search on article, word list, question bank and tool guide indexes filters the loaded
list. Shared POST forms show an unsaved-change reminder. Existing material and textbook
validation and storage are retained. My materials remains the personal library. Shop
continues its existing redirect to Classroom Finds; Privacy remains maintained in code.

## Validation

Run `npm test` from `src/teachingTools`. Page tests cover persistence, draft/publish
separation, both languages, escaping, origin checks, SQL parameters and migration fallback.
Browser verification covers 1280px and 390px layouts, real form submissions and article links.

## Manual membership adjustment

The teacher directory links to `/admin/memberships/:owner/adjust`. Admins can add
1–3660 days from the later of now or the current expiry, set an inclusive UTC end
date (2000–2099), or stop access now. A reason is required. The page displays the
account and an estimated before/after preview and asks for confirmation on save.

Apply `0022_add-membership-adjustments` before deploying. It adds audit reasons
and event types. Updates lock the access row, check the page's expected expiry,
and write the new expiry and audit record in one transaction. Stale submissions
return 409 for review. Original trial history is retained; manual activation is
classified as active membership. Stopping access does not delete library data or
issue a payment refund. Existing activation-code and refund workflows remain.

Validation includes fixture-only browser submissions, unit/route tests, and SQL
execution against session-local temporary tables, including rollback on audit
failure. No real teacher account was altered during validation.
