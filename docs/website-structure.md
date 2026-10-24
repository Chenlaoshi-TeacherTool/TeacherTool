# Website structure update

Implemented locally; not published. The site uses Express routes and EJS (HTML templates), so individual URLs can reuse one template without duplicating HTML files.

## Where the structure lives

`src/teachingTools/config/siteMap.js` is the single source of truth. The main navigation and footer (`milk-tea-footer.js`, injected by `app.js`), the theme/textbook/shop routes (`routes/siteStructure.js`), `/sitemap.xml`, and the admin nav and dashboard all read from it. To add, rename, or remove a section, edit that file; `test/siteMap.test.js` fails if a page, sub-page link, sitemap entry, or admin editor is out of sync.

## Page hierarchy

```text
Home                                  /
Teaching Tools                        /teaching-tools
  Existing individual tools           /teaching-tools/… (and retained static tool URLs)
Theme Activities                      /theme-activities
  Halloween                           /theme-activities/halloween
  Chinese New Year                    /theme-activities/chinese-new-year
  Weather                             /theme-activities/weather
    Existing song notes               /theme-activities/weather/songs
  Animals                             /theme-activities/animals
  Existing festival and game guides   links retained
Textbook Companion                    /textbook-companion
  Level 1                             /textbook-companion/level-1
  Level 2                             /textbook-companion/level-2
  Level 3                             /textbook-companion/level-3
Classroom Finds                       /classroom-finds
  Each published product              /classroom-finds/:slug
Shop                                  /shop
  Printable packs                     /shop/printable-packs
  Physical products                   /shop/physical-products
Teaching Resources                    /resources
  Existing articles                   /resources/:slug
About                                 /about
Contact                               /contact
```

Level pages contain Homework packets, Projects, Vocabulary cards, and Lesson agendas. New theme pages contain an introductory header and Vocabulary, Games, and Printables sections. Missing resources are explicitly labeled; no new downloads, product listings, or textbook content were invented. Existing generators are linked as optional ways to create theme activities. Weather content and its song subpage remain intact, with a printable generator link added.

## Updated file tree (relevant files)

```text
src/teachingTools/
├── app.js                              modified: mount structure routes
├── routes/
│   ├── index.js                        modified: legacy redirects and sitemap
│   └── siteStructure.js                NEW: themes, textbook, shop, product pages
├── public/
│   ├── javascripts/milk-tea-footer.js   modified: nine-item bilingual navigation
│   └── stylesheets/site-theme.css      modified: spacing for the longer menu
├── views/
│   ├── index.ejs                       modified: new shop and finds links
│   ├── classroom-shop.ejs              modified: shop parent link; content retained
│   ├── recommendations.ejs             modified: individual product-page links
│   ├── site-structure/
│   │   └── page.ejs                    NEW: shared section and level template
│   ├── teaching-tools/                 existing tool hub and tool templates retained
│   ├── low-prep-activities/            existing tool templates retained
│   ├── theme-activities/
│   │   ├── index.ejs                   modified: additional theme cards
│   │   └── weather/
│   │       ├── index.ejs               modified: printable section
│   │       └── songs.ejs               retained
│   └── resources/                      existing blog templates retained
└── test/
    └── siteStructure.test.js           NEW: route/content regression coverage
```

## Content preservation

- Teaching Tools stays the primary feature, using its existing cards and individual pages.
- Existing theme cards and Weather content stay in place.
- Published Classroom Finds continue to come from the same content store and admin workflow. Product pages retain images, descriptions, reasons, teacher tips, printable labels, affiliate links, and disclosures. The existing rolling-cart fallback also has a detail page when the product feed is empty.
- Existing physical shop content, gallery, pricing, ordering information, and payment link are reused at `/shop/physical-products`.
- Existing articles and tool URLs stay in place.
- `/recommendations` redirects permanently to `/classroom-finds`; `/classroom-shop` redirects permanently to `/shop/physical-products`.
- All existing unrelated working changes were left untouched.

## Modified code

The complete source for all 12 changed/new implementation and test files is in `output/website-restructure/modified-code.md`. The scoped diff, including new files, is in `output/website-restructure/restructure.patch`.

## Verification

- `node --test src/teachingTools/test/siteStructure.test.js`: 3 tests pass. Covers English/Chinese rendering, required categories, existing theme/tool/blog routes, redirects, product content and fallback, 404s, and sitemap entries. Product data is a local fixture; production database content was not changed.
- Headless Edge: 39 page/viewport checks across desktop and mobile; correct navigation order, active section, no page overflow, theme search, level navigation, and language switching retaining the current URL. No browser JavaScript errors.
- Final header layout check after spacing adjustment: no overlap between brand, links, and language controls at 1920, 1440, 1280, and 390px. At narrower sizes the existing horizontally scrollable navigation occupies its own row.
- Screenshots: `output/website-restructure/textbook-{1920,1440,1280,390}.png`.

To preview with the normal development server, run `npm start` from `src/teachingTools` and open `/textbook-companion`, `/shop`, `/theme-activities`, or `/classroom-finds`. Existing database-dependent content still requires the project's usual backend configuration.
