(function () {
  "use strict";

  var CW = window.ChenWordlist;
  var CE = window.ChenEmoji;
  var OPENMOJI_CREDIT = (CE && CE.CREDIT) || "Emoji artwork by OpenMoji · CC BY-SA 4.0 · openmoji.org";

  var form = document.querySelector("#bingo-form");
  var titleInput = document.querySelector("#title");
  var sheetsInput = document.querySelector("#sheets");
  var gridSizeSelect = document.querySelector("#gridSize");
  var freeSpaceCheckbox = document.querySelector("#freeSpace");
  var termsInput = document.querySelector("#terms");
  var termCountEl = document.querySelector("#term-count");
  var status = document.querySelector("#generation-status");
  var previewArea = document.querySelector("#preview-area");
  var downloadWordBtn = document.querySelector("#download-word");
  var printBtn = document.querySelector("#print-pdf");
  var loadExampleBtn = document.querySelector("#load-example");
  var generateBtn = form && form.querySelector('.generate-button');

  if (!form || !termsInput || !previewArea) {
    return;
  }

  var state = { cards: null, meta: null };

  function shuffle(items) {
    if (CW && CW.shuffle) {
      return CW.shuffle(items);
    }
    var a = items.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function parseTerms(text) {
    return String(text)
      .split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(Boolean)
      .map(function (line) {
        var pipeParts = line.split(/\s*[|｜]\s*/);
        var parsed = CW && CW.parseLine ? CW.parseLine(line) : null;
        if (parsed) {
          return {
            zh: parsed.zh || "",
            py: parsed.py || "",
            en: parsed.en || "",
            emoji: pipeParts.length >= 4 ? pipeParts.slice(3).join(" ").trim() : "",
          };
        }
        var parts = line.split(/\s*[|｜,，]\s*/);
        return {
          zh: parts[0] || "",
          py: parts[1] || "",
          en: parts[2] || parts[1] || "",
          emoji: parts[3] || "",
        };
      })
      .filter(function (item) { return item.zh; });
  }

  function updateTermCount() {
    var count = parseTerms(termsInput.value).length;
    termCountEl.textContent = count
      ? count + " term" + (count === 1 ? "" : "s") + " detected."
      : "No terms detected yet.";
  }

  function selectedFields() {
    return Array.prototype.slice.call(form.querySelectorAll('input[name="displayField"]:checked'))
      .map(function (input) { return input.value; });
  }

  function hasField(fields, field) {
    return fields.indexOf(field) >= 0;
  }

  function cellLines(item, fields) {
    var values = {
      zh: item.zh,
      py: item.py || item.zh,
      en: item.en || item.zh,
    };
    var seen = Object.create(null);
    return ["zh", "py", "en"].filter(function (field) {
      var value = values[field];
      if (!hasField(fields, field) || !value || seen[value]) return false;
      seen[value] = true;
      return true;
    }).map(function (field) {
      return { field: field, text: values[field] };
    });
  }

  function prepareOpenMoji(items) {
    if (!CE) {
      items.forEach(function (item) { item.openmoji = null; });
      return Promise.resolve({ matched: 0, unmatched: items.length });
    }
    // 复用共享的 ChenEmoji 模块（/shared/emoji-core.js）做匹配。
    // translate: 只填中文、没填英文的词也会先经 ChenWordlist 翻成英文再配 emoji。
    return CE.matchAll(items, { translate: true });
  }

  function termLineWithEmoji(item) {
    var fields = [item.zh || "", item.py || "", item.en || ""];
    var emoji = item.emoji || (item.openmoji && item.openmoji.emoji) || "";
    if (emoji) fields.push(emoji);
    return fields.join(" | ");
  }

  function emojiMatchText(stats) {
    if (!stats) return "";
    var text = " OpenMoji matched " + stats.matched + " of " + (stats.matched + stats.unmatched) + " terms.";
    if (stats.unmatched) text += " Lines without a fourth field need a manual emoji.";
    return text;
  }

  function openMojiSvgUrl(hexcode) {
    return CE ? CE.svgUrl(hexcode) : "";
  }

  function requiredTermCount(gridSize, includeFree) {
    var cells = gridSize * gridSize;
    return includeFree ? cells - 1 : cells;
  }

  function buildCards(items, count, gridSize, includeFree) {
    var cells = gridSize * gridSize;
    var need = requiredTermCount(gridSize, includeFree);
    var centerIndex = includeFree ? Math.floor(cells / 2) : -1;
    var cards = [];

    for (var i = 0; i < count; i++) {
      var pool = shuffle(items).slice(0, need);
      var grid = [];
      var idx = 0;
      for (var c = 0; c < cells; c++) {
        if (c === centerIndex) {
          grid.push({ free: true });
        } else {
          grid.push({ free: false, item: pool[idx++] });
        }
      }
      cards.push(grid);
    }
    return cards;
  }

  // ---- Auto-fit text -------------------------------------------------------
  // Cell text is sized in container-query units (% of the cell width), so one
  // fitted value (--fit) holds for the on-screen preview and the printed page.
  var FIT_DEFAULT = 14;
  var FIT_MIN = 4;
  var FIT_MAX = 40;
  var NOWRAP_MAX_CHARS = 5; // short words stay on one line instead of splitting

  function fitCell(cellEl) {
    var inner = cellEl.querySelector(".cell-inner");
    if (!inner) return FIT_DEFAULT;
    var style = window.getComputedStyle(cellEl);
    var availH = cellEl.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (!(availH > 0)) return FIT_DEFAULT; // not laid out (hidden) — keep the default
    var lines = inner.querySelectorAll(".cell-line");

    function fits(value) {
      cellEl.style.setProperty("--fit", value);
      if (inner.scrollHeight > availH + 0.5) return false;
      if (inner.scrollWidth > inner.clientWidth + 1) return false;
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].scrollWidth > lines[i].clientWidth + 1) return false;
      }
      return true;
    }

    var lo = FIT_MIN;
    var hi = FIT_MAX;
    if (fits(hi)) {
      lo = hi;
    } else {
      for (var step = 0; step < 7; step++) {
        var mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid; else hi = mid;
      }
    }
    lo = Math.round(lo * 10) / 10;
    cellEl.style.setProperty("--fit", lo);
    return lo;
  }

  // Printing uses a clean copy of the sheets placed directly under <body>, so the
  // print layout never depends on the page's scroll panels or sticky columns.
  var printRoot = null;
  function syncPrintRoot() {
    if (!printRoot) {
      printRoot = document.createElement("div");
      printRoot.id = "bingo-print-root";
      printRoot.setAttribute("aria-hidden", "true");
      document.body.appendChild(printRoot);
    }
    printRoot.innerHTML = previewArea.innerHTML;
  }

  function renderPreview(cards, gridSize, fields, title) {
    previewArea.innerHTML = "";
    var pendingFits = [];
    cards.forEach(function (grid, i) {
      var sheet = document.createElement("div");
      sheet.className = "bingo-sheet";

      var h = document.createElement("h3");
      h.textContent = (title || "Bingo") + " · Card " + (i + 1);
      sheet.appendChild(h);

      var gridEl = document.createElement("div");
      gridEl.className = "bingo-card-grid";
      gridEl.style.gridTemplateColumns = "repeat(" + gridSize + ", minmax(0, 1fr))";
      gridEl.style.gridTemplateRows = "repeat(" + gridSize + ", minmax(0, 1fr))";

      grid.forEach(function (cell) {
        var outerEl = document.createElement("div");
        outerEl.className = "bingo-cell";
        var cellEl = outerEl;
        if (cell.free) {
          cellEl.classList.add("is-free");
          var freeEl = document.createElement("span");
          freeEl.className = "cell-free";
          freeEl.textContent = "FREE";
          cellEl.appendChild(freeEl);
        } else {
          cellEl = document.createElement("div");
          cellEl.className = "cell-inner";
          outerEl.appendChild(cellEl);
          pendingFits.push({ el: outerEl, item: cell.item });
          var showEmoji = hasField(fields, "emoji");
          if (showEmoji) {
            outerEl.classList.add("has-emoji");
            if (fields.length === 1) outerEl.classList.add("emoji-only");
            if (cell.item.openmoji) {
              var img = document.createElement("img");
              img.className = "cell-emoji";
              img.src = openMojiSvgUrl(cell.item.openmoji.hexcode);
              img.alt = cell.item.openmoji.annotation || cell.item.en || cell.item.zh;
              img.title = cell.item.openmoji.annotation || "OpenMoji emoji";
              img.draggable = false;
              cellEl.appendChild(img);
            } else {
              var missing = document.createElement("span");
              missing.className = "cell-emoji-missing";
              missing.textContent = "?";
              missing.setAttribute("aria-label", "No automatic emoji match");
              cellEl.appendChild(missing);
            }
          }
          cellLines(cell.item, fields).forEach(function (line, lineIndex) {
            var span = document.createElement("span");
            span.className = "cell-line cell-line-" + line.field;
            if (lineIndex === 0) span.classList.add("is-primary");
            if (Array.from(line.text).length <= NOWRAP_MAX_CHARS) span.classList.add("is-nowrap");
            span.textContent = line.text;
            cellEl.appendChild(span);
          });
        }
        gridEl.appendChild(outerEl);
      });

      sheet.appendChild(gridEl);
      if (hasField(fields, "emoji")) {
        var credit = document.createElement("p");
        credit.className = "openmoji-sheet-credit";
        credit.textContent = OPENMOJI_CREDIT;
        sheet.appendChild(credit);
      }
      previewArea.appendChild(sheet);
    });

    // Every cell is the same size, so each term only needs to be measured once.
    pendingFits.forEach(function (entry) {
      if (entry.item.fit) entry.el.style.setProperty("--fit", entry.item.fit);
      else entry.item.fit = fitCell(entry.el);
    });
    syncPrintRoot();
  }

  function fileName(title) {
    var safe = String(title || "").trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 70);
    return (safe || "bingo") + "-sheets.docx";
  }

  function fetchOpenMojiPng(hexcode) {
    return CE ? CE.fetchPng(hexcode) : Promise.resolve(null);
  }

  async function preloadOpenMojiPngs(cards, fields) {
    var images = Object.create(null);
    if (!hasField(fields, "emoji")) return images;
    var uniqueHexcodes = [];
    cards.forEach(function (grid) {
      grid.forEach(function (cell) {
        var hexcode = !cell.free && cell.item.openmoji && cell.item.openmoji.hexcode;
        if (hexcode && uniqueHexcodes.indexOf(hexcode) < 0) uniqueHexcodes.push(hexcode);
      });
    });
    await Promise.all(uniqueHexcodes.map(async function (hexcode) {
      images[hexcode] = await fetchOpenMojiPng(hexcode);
    }));
    return images;
  }

  async function buildDocx(cards, gridSize, fields, title) {
    var D = window.docx;
    var emojiImages = await preloadOpenMojiPngs(cards, fields);
    var border = { style: D.BorderStyle.SINGLE, size: 6, color: "315F4F" };
    var borders = {
      top: border, bottom: border, left: border, right: border,
      insideHorizontal: border, insideVertical: border,
    };
    var contentWidth = 10800;
    var cellWidth = Math.floor(contentWidth / gridSize);
    var cellPt = cellWidth / 20;
    // Same fitted size as the preview (% of cell width), with a margin for Word's font metrics.
    function halfPoints(fit, ratio) {
      return Math.max(12, Math.round((fit || FIT_DEFAULT) / 100 * cellPt * 2 * 0.85 * (ratio || 1)));
    }
    var emojiPx = Math.round(cellPt * 96 / 72 * (fields.length === 1 ? 0.55 : 0.34));
    var children = [];

    cards.forEach(function (grid, i) {
      if (i > 0) {
        children.push(new D.Paragraph({ children: [new D.PageBreak()] }));
      }
      children.push(new D.Paragraph({
        alignment: D.AlignmentType.CENTER,
        spacing: { after: 220 },
        children: [new D.TextRun({ text: (title || "Bingo") + " · Card " + (i + 1), bold: true, size: 30 })],
      }));

      var rows = [];
      for (var r = 0; r < gridSize; r++) {
        var rowCells = [];
        for (var c = 0; c < gridSize; c++) {
          var cell = grid[r * gridSize + c];
          var paragraphs;
          if (cell.free) {
            paragraphs = [new D.Paragraph({
              alignment: D.AlignmentType.CENTER,
              children: [new D.TextRun({ text: "FREE", bold: true, size: halfPoints(20) })],
            })];
          } else {
            paragraphs = [];
            if (hasField(fields, "emoji")) {
              var openmoji = cell.item.openmoji;
              var emojiRun;
              if (openmoji && emojiImages[openmoji.hexcode]) {
                emojiRun = new D.ImageRun({
                  type: "png",
                  data: emojiImages[openmoji.hexcode],
                  transformation: { width: emojiPx, height: emojiPx },
                });
              } else {
                emojiRun = new D.TextRun({
                  text: openmoji ? openmoji.emoji : "?",
                  font: "Segoe UI Emoji",
                  size: fields.length === 1 ? 34 : 24,
                });
              }
              paragraphs.push(new D.Paragraph({
                alignment: D.AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [emojiRun],
              }));
            }
            var itemFit = cell.item.fit;
            paragraphs = paragraphs.concat(cellLines(cell.item, fields).map(function (line, lineIndex) {
              return new D.Paragraph({
                alignment: D.AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [new D.TextRun({
                  // Word can't use the page's Andika web font. SimSun draws ā á ǎ à
                  // single-storey; its plain "a" is swapped for ɑ (U+0251) to match.
                  text: line.field === "py" ? line.text.replace(/a/g, "ɑ") : line.text,
                  font: line.field === "zh" ? "KaiTi" : (line.field === "py" ? "SimSun" : "Arial"),
                  size: halfPoints(itemFit, lineIndex === 0 ? 1 : 0.62),
                  bold: line.field !== "zh" && lineIndex === 0,
                })],
              });
            }));
          }
          rowCells.push(new D.TableCell({
            width: { size: cellWidth, type: D.WidthType.DXA },
            verticalAlign: D.VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 60, right: 60 },
            children: paragraphs,
          }));
        }
        rows.push(new D.TableRow({
          children: rowCells,
          height: { value: cellWidth, rule: D.HeightRule.ATLEAST },
        }));
      }

      children.push(new D.Table({
        alignment: D.AlignmentType.CENTER,
        borders: borders,
        columnWidths: new Array(gridSize).fill(cellWidth),
        layout: D.TableLayoutType.FIXED,
        rows: rows,
        width: { size: contentWidth, type: D.WidthType.DXA },
      }));
      if (hasField(fields, "emoji")) {
        children.push(new D.Paragraph({
          alignment: D.AlignmentType.RIGHT,
          spacing: { before: 90, after: 0 },
          children: [new D.TextRun({ text: OPENMOJI_CREDIT, color: "65766F", size: 12 })],
        }));
      }
    });

    return new D.Document({
      creator: "Teacher Toolkit",
      description: "Bingo sheets",
      sections: [{
        properties: {
          page: {
            margin: { top: 900, right: 720, bottom: 900, left: 720 },
          },
        },
        children: children,
      }],
      title: (title || "Bingo") + " - Bingo Sheets",
    });
  }

  function initLibraryPicker() {
    if (!window.ChenLibraryPicker) return;
    var picker = ChenLibraryPicker.create({
      root: document.querySelector("#bingoLibraryPicker"),
      source: "wordlists",
      min: 1,
      // From the Vocab Game Switcher: use the 4×4 grid when the list can't fill 5×5.
      onHandoff: function (lists, importLists) {
        if ((lists[0].items || []).length < requiredTermCount(5, true) && gridSizeSelect.value !== "4") {
          gridSizeSelect.value = "4";
          gridSizeSelect.dispatchEvent(new Event("change"));
        }
        return importLists(lists);
      },
      title: "Add terms from the library",
      hint: "Choose one or more vocabulary topics to add their terms to your bingo list.",
      importLabel: "Add terms from selected topics",
      onImport: async function (lists) {
        var existing = String(termsInput.value || "").split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
        var seen = {};
        existing.forEach(function (line) { seen[line.split(/\s*[|｜,，]\s*/)[0]] = true; });
        var addedItems = [];
        lists.forEach(function (list) {
          (list.items || []).forEach(function (item) {
            if (!item.zh || seen[item.zh]) return;
            addedItems.push({ zh: item.zh, py: item.py || "", en: item.en || "", emoji: "" });
            seen[item.zh] = true;
          });
        });
        picker.reset();

        if (addedItems.length) {
          status.dataset.state = "";
          status.textContent = "Matching imported terms with OpenMoji…";
          var emojiStats = null;
          try {
            emojiStats = await prepareOpenMoji(addedItems);
          } catch (error) {
            console.error(error);
          }
          addedItems.forEach(function (item) { existing.push(termLineWithEmoji(item)); });
          termsInput.value = existing.join("\n");
          updateTermCount();
          status.dataset.state = emojiStats ? "success" : "error";
          status.textContent = "Added " + addedItems.length + " term" + (addedItems.length === 1 ? "" : "s") + " from the library.";
          if (emojiStats) status.textContent += emojiMatchText(emojiStats);
          else status.textContent += " Emoji matching is unavailable right now; the terms were still imported.";
        }
      }
    });
  }

  async function loadExample() {
    titleInput.value = "Animals Bingo";
    var exampleText = [
      "猫 | māo | cat",
      "狗 | gǒu | dog",
      "鸟 | niǎo | bird",
      "鱼 | yú | fish",
      "马 | mǎ | horse",
      "羊 | yáng | sheep",
      "牛 | niú | cow",
      "猪 | zhū | pig",
      "兔子 | tùzi | rabbit",
      "老虎 | lǎohǔ | tiger",
      "狮子 | shīzi | lion",
      "大象 | dàxiàng | elephant",
      "熊猫 | xióngmāo | panda",
      "猴子 | hóuzi | monkey",
      "蛇 | shé | snake",
      "青蛙 | qīngwā | frog",
      "老鼠 | lǎoshǔ | mouse",
      "鸭子 | yāzi | duck",
      "鸡 | jī | chicken",
      "熊 | xióng | bear",
      "狐狸 | húli | fox",
      "海豚 | hǎitún | dolphin",
      "鲨鱼 | shāyú | shark",
      "蜜蜂 | mìfēng | bee",
      "蝴蝶 | húdié | butterfly",
    ].join("\n");
    var exampleItems = parseTerms(exampleText);
    loadExampleBtn.disabled = true;
    status.dataset.state = "";
    status.textContent = "Matching the example terms with OpenMoji…";
    var emojiStats = null;
    try {
      emojiStats = await prepareOpenMoji(exampleItems);
      termsInput.value = exampleItems.map(termLineWithEmoji).join("\n");
    } catch (error) {
      console.error(error);
      termsInput.value = exampleText;
    }
    loadExampleBtn.disabled = false;
    updateTermCount();
    status.dataset.state = emojiStats ? "success" : "error";
    status.textContent = "Example loaded. Adjust anything before generating.";
    if (emojiStats) status.textContent += emojiMatchText(emojiStats);
    else status.textContent += " Emoji matching is unavailable right now.";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    var items = parseTerms(termsInput.value);
    var gridSize = parseInt(gridSizeSelect.value, 10);
    var includeFree = freeSpaceCheckbox.checked && gridSize % 2 === 1;
    var need = requiredTermCount(gridSize, includeFree);
    var fields = selectedFields();

    if (!fields.length) {
      status.dataset.state = "error";
      status.textContent = "Select at least one field to display in each space.";
      return;
    }

    if (items.length < need) {
      status.dataset.state = "error";
      status.textContent = "You need at least " + need + " terms for a " + gridSize + "×" + gridSize +
        (includeFree ? " grid with a free space" : " grid") + " — you have " + items.length + ".";
      return;
    }

    var count = Math.min(60, Math.max(1, parseInt(sheetsInput.value, 10) || 1));
    var title = titleInput.value.trim();
    var emojiStats = null;

    if (hasField(fields, "emoji")) {
      generateBtn.disabled = true;
      status.dataset.state = "";
      status.textContent = "Matching your terms with OpenMoji…";
      try {
        emojiStats = await prepareOpenMoji(items);
      } catch (error) {
        console.error(error);
        status.dataset.state = "error";
        status.textContent = "OpenMoji could not be loaded. Check your connection and try again.";
        generateBtn.disabled = false;
        return;
      }
    }

    // Text is fitted by measuring it, so the pinyin web font must be loaded first.
    if (hasField(fields, "py") && document.fonts && document.fonts.load) {
      try {
        await Promise.all([document.fonts.load("400 16px Andika", "āa"), document.fonts.load("700 16px Andika", "āa")]);
      } catch (error) {
        console.error(error);
      }
    }

    state.cards = buildCards(items, count, gridSize, includeFree);
    state.meta = { gridSize: gridSize, fields: fields, title: title, includeFree: includeFree };

    renderPreview(state.cards, gridSize, fields, title);

    downloadWordBtn.disabled = false;
    printBtn.disabled = false;
    generateBtn.disabled = false;
    status.dataset.state = "success";
    status.textContent = count + " bingo sheet" + (count === 1 ? "" : "s") + " generated below.";
    if (emojiStats) {
      status.textContent += emojiMatchText(emojiStats);
    }
  }

  async function handleDownloadWord() {
    if (!state.cards || !window.docx) {
      status.dataset.state = "error";
      status.textContent = "Generate sheets first, and make sure the page has fully loaded.";
      return;
    }
    downloadWordBtn.disabled = true;
    try {
      status.dataset.state = "";
      status.textContent = hasField(state.meta.fields, "emoji")
        ? "Adding OpenMoji artwork to the Word document…"
        : "Building the Word document…";
      var doc = await buildDocx(state.cards, state.meta.gridSize, state.meta.fields, state.meta.title);
      var blob = await window.docx.Packer.toBlob(doc);
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = fileName(state.meta.title);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      status.dataset.state = "success";
      status.textContent = "Your Word document is ready.";
    } catch (error) {
      console.error(error);
      status.dataset.state = "error";
      status.textContent = "We could not build the Word document. Please try again.";
    } finally {
      downloadWordBtn.disabled = false;
    }
  }

  function handlePrint() {
    if (!state.cards) return;
    window.print();
  }

  termsInput.addEventListener("input", updateTermCount);
  if (loadExampleBtn) loadExampleBtn.addEventListener("click", loadExample);
  form.addEventListener("submit", handleSubmit);
  downloadWordBtn.addEventListener("click", handleDownloadWord);
  printBtn.addEventListener("click", handlePrint);
  gridSizeSelect.addEventListener("change", function () {
    var isOdd = parseInt(gridSizeSelect.value, 10) % 2 === 1;
    freeSpaceCheckbox.disabled = !isOdd;
    if (!isOdd) freeSpaceCheckbox.checked = false;
    else freeSpaceCheckbox.checked = true;
  });

  updateTermCount();
  initLibraryPicker();
})();
