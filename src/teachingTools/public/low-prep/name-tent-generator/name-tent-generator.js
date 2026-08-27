(function () {
  "use strict";

  var COLORS = [
    { key: "red", label: "Red 红", css: "var(--tent-red)", aliases: ["red", "红", "红色"] },
    { key: "orange", label: "Orange 橙", css: "var(--tent-orange)", aliases: ["orange", "橙", "橙色"] },
    { key: "yellow", label: "Yellow 黄", css: "var(--tent-yellow)", aliases: ["yellow", "黄", "黄色"] },
    { key: "green", label: "Green 绿", css: "var(--tent-tgreen)", aliases: ["green", "绿", "绿色"] },
    { key: "blue", label: "Blue 蓝", css: "var(--tent-blue)", aliases: ["blue", "蓝", "蓝色"] },
    { key: "purple", label: "Purple 紫", css: "var(--tent-purple)", aliases: ["purple", "紫", "紫色"] }
  ];

  var form = document.querySelector("#tent-form");
  var namesInput = document.querySelector("#names");
  var nameCountEl = document.querySelector("#name-count");
  var status = document.querySelector("#generation-status");
  var previewCards = document.querySelector("#preview-cards");
  var previewArea = document.querySelector("#preview-panel-body");
  var printArea = document.querySelector("#print-area");
  var printBtn = document.querySelector("#print-pdf");
  var loadExampleBtn = document.querySelector("#load-example");
  var colorSwatchesEl = document.querySelector("#color-swatches");

  if (!form || !namesInput || !previewCards || !printArea) {
    return;
  }

  function colorByKeyword(word) {
    if (!word) return null;
    var w = String(word).trim().toLowerCase();
    for (var i = 0; i < COLORS.length; i++) {
      if (COLORS[i].aliases.indexOf(w) !== -1) return COLORS[i];
    }
    return null;
  }

  function colorByKey(key) {
    for (var i = 0; i < COLORS.length; i++) {
      if (COLORS[i].key === key) return COLORS[i];
    }
    return COLORS[3];
  }

  function checkedPalette() {
    var boxes = colorSwatchesEl.querySelectorAll('input[type="checkbox"]:checked');
    var picked = [];
    boxes.forEach(function (box) { picked.push(colorByKey(box.value)); });
    return picked.length ? picked : COLORS.slice();
  }

  var CJK_RE = /[㐀-鿿]/;

  function parseLines(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(Boolean)
      .map(function (line) {
        var parts = line.split(/\s*\|\s*/);
        if (parts.length === 1 && CJK_RE.test(parts[0])) {
          return { name: "", chinese: parts[0], colorHint: "" };
        }
        return {
          name: parts[0] || "",
          chinese: parts[1] || "",
          colorHint: parts[2] || ""
        };
      });
  }

  function pinyinOf(chinese) {
    if (!chinese) return "";
    if (window.pinyinPro && typeof window.pinyinPro.pinyin === "function") {
      try {
        return window.pinyinPro.pinyin(chinese, { toneType: "symbol", type: "string" }) || "";
      } catch (e) { /* ignore and fall through */ }
    }
    return "";
  }

  function updateNameCount() {
    var count = parseLines(namesInput.value).length;
    nameCountEl.textContent = count
      ? count + " name" + (count === 1 ? "" : "s") + " detected."
      : "No names detected yet.";
  }

  function buildData(entries, colorMode, singleColor, palette) {
    var autoIndex = 0;
    return entries.map(function (entry) {
      var color = colorByKeyword(entry.colorHint);
      if (!color) {
        color = colorMode === "single" ? singleColor : palette[autoIndex % palette.length];
        if (colorMode !== "single") autoIndex++;
      }
      return {
        name: entry.name,
        chinese: entry.chinese,
        pinyin: pinyinOf(entry.chinese),
        color: color
      };
    });
  }

  function selectedDisplayModes() {
    return Array.prototype.map.call(
      form.querySelectorAll('input[name="displayMode"]:checked'),
      function (input) { return input.value; }
    );
  }

  function nameBoxLines(item, modes) {
    var lines = [];
    if (modes.indexOf("zh") !== -1 && item.chinese) {
      lines.push({ cls: "chinese", text: item.chinese });
    }
    if (modes.indexOf("py") !== -1 && item.pinyin) {
      lines.push({ cls: "pinyin", text: item.pinyin });
    }
    if (modes.indexOf("en") !== -1 && item.name && item.name !== item.chinese) {
      lines.push({ cls: "name", text: item.name });
    }

    if (!lines.length) {
      if (modes.indexOf("zh") !== -1) {
        lines.push({ cls: "chinese", text: item.chinese || item.name });
      } else if (modes.indexOf("py") !== -1) {
        lines.push({ cls: "pinyin", text: item.pinyin || item.name || item.chinese });
      } else if (modes.indexOf("en") !== -1) {
        lines.push({ cls: "name", text: item.name || item.chinese });
      }
    }
    return lines.filter(function (l) { return l.text; });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function buildNameBox(item, modes, boxClass, lineWrapClass) {
    var box = el("div", boxClass);
    box.style.setProperty("--swatch-color", item.color.css);
    var lines = nameBoxLines(item, modes);
    box.dataset.lines = String(lines.length);
    lines.forEach(function (line) {
      var lineClass = lineWrapClass + " " + lineWrapClass + "-" + line.cls;
      box.appendChild(el("span", lineClass, line.text));
    });
    return box;
  }

  function buildMiniCard(item, modes) {
    var wrap = el("div", "mini-tent");
    var strip = el("div", "mini-tent-strip");

    [1, 2].forEach(function () {
      var panel = el("div", "mini-panel");
      panel.appendChild(buildNameBox(item, modes, "mini-name-box", "mini-line"));
      strip.appendChild(panel);
      strip.appendChild(el("div", "mini-fold-spacer"));
    });
    var base = el("div", "mini-panel is-base");
    strip.appendChild(base);
    var tab = el("div", "mini-panel is-tab");
    strip.appendChild(tab);

    wrap.appendChild(strip);
    wrap.appendChild(el("p", "mini-tent-label", item.name || item.chinese));
    return wrap;
  }

  function buildPrintPage(item, modes) {
    var page = el("section", "tent-page");
    var strip = el("div", "tent-strip");

    function panel(withBox) {
      var p = el("div", "tent-panel");
      if (withBox) p.appendChild(buildNameBox(item, modes, "tent-name-box", "tent-line"));
      return p;
    }
    function fold() { return el("div", "tent-fold"); }

    strip.appendChild(panel(true));
    strip.appendChild(fold());
    strip.appendChild(panel(true));
    strip.appendChild(fold());

    var base = el("div", "tent-panel is-base");
    base.appendChild(el("span", "tent-base-label", "桌面 Base — this panel rests flat on the desk"));
    strip.appendChild(base);
    strip.appendChild(fold());

    var tab = el("div", "tent-panel is-tab");
    tab.appendChild(el("span", "", "粘贴 Tape behind Panel 1"));
    strip.appendChild(tab);

    page.appendChild(strip);
    return page;
  }

  function render() {
    var entries = parseLines(namesInput.value);
    updateNameCount();

    if (!entries.length) {
      previewCards.innerHTML = '<p class="preview-empty">Add student names on the left, then click "Generate name tents" to see cards here.</p>';
      printArea.innerHTML = "";
      printBtn.disabled = true;
      status.textContent = "";
      status.removeAttribute("data-state");
      return;
    }

    var displayModes = selectedDisplayModes();
    if (!displayModes.length) {
      previewCards.innerHTML = '<p class="preview-empty">Select at least one display language to generate name tents.</p>';
      printArea.innerHTML = "";
      printBtn.disabled = true;
      status.textContent = "Select at least one display language.";
      status.setAttribute("data-state", "error");
      return;
    }
    var colorMode = (form.querySelector('input[name="colorMode"]:checked') || {}).value || "auto";
    var singleColorKey = (form.querySelector("#single-color-select") || {}).value || "green";
    var palette = checkedPalette();
    var data = buildData(entries, colorMode, colorByKey(singleColorKey), palette);

    previewCards.innerHTML = "";
    printArea.innerHTML = "";
    var frag = document.createDocumentFragment();
    var printFrag = document.createDocumentFragment();
    data.forEach(function (item) {
      frag.appendChild(buildMiniCard(item, displayModes));
      printFrag.appendChild(buildPrintPage(item, displayModes));
    });
    previewCards.appendChild(frag);
    printArea.appendChild(printFrag);

    printBtn.disabled = false;
    status.textContent = data.length + " name tent" + (data.length === 1 ? "" : "s") + " ready. Each one prints on its own full letter page.";
    status.setAttribute("data-state", "success");
  }

  function toggleSingleColorVisibility() {
    var isSingle = (form.querySelector('input[name="colorMode"]:checked') || {}).value === "single";
    var row = document.querySelector("#single-color-row");
    if (row) row.style.display = isSingle ? "block" : "none";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    render();
  });

  namesInput.addEventListener("input", updateNameCount);

  form.addEventListener("change", function (e) {
    if (e.target && e.target.name === "colorMode") toggleSingleColorVisibility();
  });

  if (printBtn) {
    printBtn.addEventListener("click", function () {
      window.print();
    });
  }

  if (loadExampleBtn) {
    loadExampleBtn.addEventListener("click", function () {
      namesInput.value = [
        "Lily | 丽丽",
        "Max | 马克斯",
        "Emma | 艾玛 | orange",
        "Leo | 列奥",
        "Zoe | 苏雪"
      ].join("\n");
      updateNameCount();
      render();
    });
  }

  toggleSingleColorVisibility();
  updateNameCount();
})();
