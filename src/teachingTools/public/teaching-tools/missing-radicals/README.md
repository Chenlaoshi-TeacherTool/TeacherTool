# Missing Parts · 汉字补一补

A standalone HTML/CSS/JavaScript classroom tool. Open `index.html` through any static web host; no npm install or build is required. TeacherTool serves it at `/teaching-tools/missing-radicals/index.html`. The teaching-tools directory includes a bilingual card. The hosted page shares the site theme, navigation, and footer.

## Use

Enter words separated by whitespace/commas, or one entry per line with `word | English meaning`. Generate creates A and B together. The displayed seed reproduces word order and automatic choices with the same list and settings. New seed shuffles both versions; in radical mode the radical itself remains fixed, so the A-version change is word order. Printed pages always carry CLS Teaching Tools · clsteachingtools.com; there is no editable footer; manual stroke/pinyin edits apply to the current generated version only. Click a stroke to toggle it, a pinyin strip to edit, or the pencil/warning badge to choose a character-specific mode. Regenerating replaces manual edits. Save/Load stores the input list locally in this browser.

Use the preview tabs to inspect both versions and red answer keys. Choose Letter/A4 and the desired print selection, then **Print / Save PDF**. In the browser dialog use 100% scale, disable browser headers/footers, and choose Save as PDF. The sample uses four pages (A, B, A key, B key). Long lists paginate with repeated headings and word banks. Very long titles, instructions, meanings, or a word taller than a printable page may require shortening or printing a smaller list. Words are never intentionally split across pages. Unsupported characters cause their whole word to be skipped with a warning, so the word bank matches the grids.

Whiteboard uses independent Pointer Events pads and ordered checks against only the missing stroke medians. Choose a character on each side. Correct strokes snap into place in team color; reverse-order/direction and badly placed paths are rejected. Three errors animate a median hint. Teachers can adjust either team’s score with the −1 / ＋1 buttons next to its score, including in take-turns mode. Manual adjustments are undoable with that team’s Undo control, and Reset clears scores. Reveal does not award points. Undo restores that team's most recent drawing/reveal state. Reset resets the round; the timer starts explicitly with Start. Take turns disables the inactive team. Fullscreen is optional; Exit also works without fullscreen. Check simultaneous touch on the actual classroom board—hardware may restrict contact counts or pen/touch combinations.

## Data and updates

Pinned versions verified against npm metadata on 2026-10-17: Hanzi Writer **3.7.3**, hanzi-writer-data **2.0.1**, pinyin-pro **3.29.5**. Libraries and per-character stroke JSON load from jsDelivr, so an internet connection is required. Lists stay in browser storage; character requests go to the CDN. No backend is involved.

`data/components.json` contains 2,663 characters from HSK 1–6 (2012) plus `data/characters.txt`, not an exhaustive edition-specific 《中文》 textbook index. Add textbook words to that UTF-8 file, then run with Node 18+:

```
node scripts/build-components.js
```

Or provide your own UTF-8 vocabulary file:

```
node scripts/build-components.js path/to/words.txt
```

The script downloads Make Me a Hanzi dictionary JSONL and keeps only selected characters. Each output array has one component-group ID per stroke, with `-1` for unmapped strokes. IDs group full decomposition-tree paths from `matches`; they are not radical IDs. At runtime arrays must match the stroke count; other-component choices exclude groups overlapping `radStrokes`. Unknown, simple, or unsuitable characters remain complete with warning badges. B alternatives can be unavailable; the badge invites manual editing. Single-component protection applies outside explicit stroke mode.

SVG uses `translate(0 900) scale(1 -1)` for the 1024-unit data coordinates. `radStrokes` is optional. Hanzi Writer documents `quizStartStrokeNum`, but no arbitrary subset quiz API. The tool therefore uses directed, resampled median matching for subsets, including nonconsecutive strokes; this is classroom practice checking rather than handwriting recognition or assessment. Thresholds live in `matchesStroke` in app.js. Pinyin is contextual through pinyin-pro and remains teacher-editable.

Run the small deterministic logic check with `node scripts/check.js`. Browser QA should additionally cover CDN loading, print preview/PDF, pinyin edits, manual blanks, and pen/touch on target hardware.

## Deploy

Copy this entire folder (including `data/`) to a static host, or deploy TeacherTool through its normal release process. The explicit `index.html` URL works on a static host. TeacherTool also provides `/teaching-tools/missing-radicals` as a clean entry URL. Keep the data and license notices with distributions. If relocating, change the optional website-directory backlink in the header.

## Sources and licenses

- [Hanzi Writer](https://github.com/chanind/hanzi-writer) (MIT), [API documentation](https://hanziwriter.org/docs.html).
- [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data), derived from Make Me a Hanzi and Arphic fonts; retain its Arphic Public License notice when redistributing stroke data.
- [Make Me a Hanzi](https://github.com/skishore/makemeahanzi), dictionary derived from Unihan/CJKlib; upstream COPYING is included under data/. Component annotations retain upstream LGPL v3-or-later terms (see COPYING-makemeahanzi.txt, LGPL.txt, and GPL.txt).
- [HSK vocabulary](https://github.com/glxxyz/hskhsk.com/tree/main/data/lists), used only to select character coverage.
- [pinyin-pro](https://github.com/zh-lx/pinyin-pro) (MIT).
