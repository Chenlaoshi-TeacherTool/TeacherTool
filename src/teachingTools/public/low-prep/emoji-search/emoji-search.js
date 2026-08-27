(function () {
  "use strict";

  var CE = window.ChenEmoji;

  var input = document.querySelector("#emoji-search-input");
  var clearBtn = document.querySelector("#emoji-clear");
  var resultsEl = document.querySelector("#emoji-results");
  var statusEl = document.querySelector("#emoji-status");
  var toastEl = document.querySelector("#emoji-toast");
  var countEl = document.querySelector("#emoji-count");

  if (!input || !resultsEl) return;

  // 文案：中英两套，跟随 <html lang>
  var isZh = (document.documentElement.getAttribute("lang") || "").indexOf("zh") === 0;
  var TXT = isZh ? {
    loading: "正在加载 emoji 库…",
    ready: "输入关键词开始搜索（中英文都行）。",
    loadError: "emoji 库加载失败，请检查网络后刷新重试。",
    noResults: "没找到匹配的 emoji，换个词试试？",
    count: function (n) { return "显示 " + n + " 个 emoji"; },
    copiedEmoji: "已复制 ",
    copiedLink: "已复制图片链接",
    copyFail: "复制失败，请长按手动复制",
    copyEmoji: "复制 emoji",
    copyLink: "复制图片链接",
  } : {
    loading: "Loading emoji library…",
    ready: "Type a keyword to search (English or Chinese).",
    loadError: "Failed to load the emoji library. Check your connection and refresh.",
    noResults: "No matching emoji. Try another word?",
    count: function (n) { return "Showing " + n + " emoji"; },
    copiedEmoji: "Copied ",
    copiedLink: "Copied image link",
    copyFail: "Copy failed — long-press to copy manually",
    copyEmoji: "Copy emoji",
    copyLink: "Copy image link",
  };

  var index = null;
  var toastTimer = null;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || "";
  }

  function showToast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 1600);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject();
      } catch (err) {
        reject(err);
      }
    });
  }

  function copyEmoji(entry) {
    copyText(entry.emoji).then(function () {
      showToast(TXT.copiedEmoji + entry.emoji);
    }).catch(function () {
      showToast(TXT.copyFail);
    });
  }

  function copyLink(entry) {
    copyText(CE.svgUrl(entry.hexcode)).then(function () {
      showToast(TXT.copiedLink);
    }).catch(function () {
      showToast(TXT.copyFail);
    });
  }

  function buildCard(entry) {
    var card = document.createElement("div");
    card.className = "emoji-card";

    // 点图 / 点名字 = 复制 emoji 字符
    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "emoji-copy-main";
    copyBtn.title = TXT.copyEmoji + " · " + entry.annotation;
    copyBtn.setAttribute("aria-label", TXT.copyEmoji + " " + entry.annotation);

    var img = document.createElement("img");
    img.className = "emoji-art";
    img.src = CE.svgUrl(entry.hexcode);
    img.alt = entry.annotation;
    img.draggable = false;
    copyBtn.appendChild(img);

    var name = document.createElement("span");
    name.className = "emoji-name";
    name.textContent = entry.annotation;
    copyBtn.appendChild(name);

    copyBtn.addEventListener("click", function () { copyEmoji(entry); });
    card.appendChild(copyBtn);

    // 复制图片链接
    var linkBtn = document.createElement("button");
    linkBtn.type = "button";
    linkBtn.className = "emoji-copy-link";
    linkBtn.textContent = TXT.copyLink;
    linkBtn.addEventListener("click", function () { copyLink(entry); });
    card.appendChild(linkBtn);

    return card;
  }

  function render(entries) {
    resultsEl.innerHTML = "";
    if (!entries.length) {
      setStatus(TXT.noResults);
      if (countEl) countEl.textContent = "";
      return;
    }
    setStatus("");
    var frag = document.createDocumentFragment();
    entries.forEach(function (entry) { frag.appendChild(buildCard(entry)); });
    resultsEl.appendChild(frag);
    if (countEl) countEl.textContent = TXT.count(entries.length);
  }

  function runSearch() {
    if (!index) return;
    var q = input.value.trim();
    clearBtn.classList.toggle("is-visible", !!q);
    if (!q) {
      // 空查询：展示前若干个作为浏览起点
      render(index.entries.slice(0, 80));
      return;
    }
    render(CE.search(q, index, { limit: 120 }));
  }

  var debounceTimer = null;
  function onInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 140);
  }

  function init() {
    if (!CE) {
      setStatus(TXT.loadError);
      return;
    }
    setStatus(TXT.loading);
    input.disabled = true;
    CE.load().then(function (idx) {
      index = idx;
      input.disabled = false;
      setStatus("");
      input.addEventListener("input", onInput);
      clearBtn.addEventListener("click", function () {
        input.value = "";
        input.focus();
        runSearch();
      });
      runSearch();
    }).catch(function () {
      input.disabled = false;
      setStatus(TXT.loadError);
    });
  }

  init();
})();
