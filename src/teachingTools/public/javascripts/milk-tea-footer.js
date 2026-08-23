(function () {
  'use strict';

  var LABELS = {
    en: {
      brand: "Chen Laoshi's Teaching Toolkit",
      tagline: 'Practical tools for every classroom',
      home: 'Home',
      activities: 'Theme Activities',
      tools: 'Teaching Tools',
      resources: 'Teaching Resources',
      finds: 'Classroom Finds',
      about: 'About',
      contact: 'Contact',
      privacy: 'Privacy Policy',
      legalFooter: '&copy; 2026 Chen Laoshi\'s Teaching Toolkit &middot; <a href="/about">About</a> &middot; <a href="/resources">Teaching Resources</a> &middot; <a href="/recommendations">Recommendations</a> &middot; <a href="/contact">Contact</a> &middot; <a href="/privacy">Privacy Policy</a>',
      milkTeaKicker: 'Optional support',
      milkTeaTitle: 'Enjoying the toolkit? Buy Chen Laoshi a milk tea.',
      milkTeaToggle: 'Buy me a milk tea 🧋',
      milkTeaHeading: 'Buy me a milk tea 🧋',
      milkTeaBody: 'A small, optional treat helps support new classroom resources. Thank you—there is never any pressure.',
      milkTeaClose: 'Close support options',
      milkTeaChoose: 'Choose an amount'
    },
    zh: {
      brand: '陈老师教学工具包',
      tagline: '为每一个教室提供实用支持',
      home: '首页',
      activities: '主题活动',
      tools: '教学工具',
      resources: '教学资源',
      finds: '教室好物',
      about: '关于',
      contact: '联系',
      privacy: '隐私政策',
      legalFooter: '&copy; 2026 陈老师教学工具包 &middot; <a href="/about">关于</a> &middot; <a href="/resources">教学资源</a> &middot; <a href="/recommendations">教室好物</a> &middot; <a href="/contact">联系</a> &middot; <a href="/privacy">隐私政策</a>',
      milkTeaKicker: '可选支持',
      milkTeaTitle: '喜欢这个工具包吗？请陈老师喝一杯奶茶。',
      milkTeaToggle: '请我喝奶茶 🧋',
      milkTeaHeading: '请我喝奶茶 🧋',
      milkTeaBody: '一点小小的、完全自愿的心意可以帮助支持新的教室资源。谢谢您——完全没有压力。',
      milkTeaClose: '关闭支持选项',
      milkTeaChoose: '自选金额'
    }
  };

  function getLang() {
    var match = document.cookie.match(/(?:^|; )lang=([^;]+)/);
    return match && decodeURIComponent(match[1]) === 'zh' ? 'zh' : 'en';
  }

  function buildLangSwitchHtml(lang) {
    var redirect = encodeURIComponent(window.location.pathname + window.location.search);
    return '<div class="site-lang-switch" role="group" aria-label="Language / 语言">' +
      '<a class="' + (lang === 'en' ? 'is-active' : '') + '" href="/set-language?lang=en&redirect=' + redirect + '" hreflang="en" lang="en">EN</a>' +
      '<a class="' + (lang === 'zh' ? 'is-active' : '') + '" href="/set-language?lang=zh&redirect=' + redirect + '" hreflang="zh" lang="zh">中文</a>' +
      '</div>';
  }

  function createFooter() {
    var lang = getLang();
    var t = LABELS[lang];
    if (document.getElementById('milkTeaFooter')) return;

    var style = document.createElement('style');
    style.textContent = [
      '.site-legal-footer { margin: 0; padding: 24px 20px; background: #0f4b43; color: #fffdf7; }',
      '.site-main-nav { position: relative; z-index: 100; padding: 12px 20px; border-bottom: 1px solid #d7e3c7; background: #fffdf7; color: #194f45; }',
      '.site-main-nav, .site-main-nav * { box-sizing: border-box; }',
      '.site-main-nav-inner { width: min(1160px, calc(100% - 16px)); margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 22px; }',
      '.site-main-nav-brand { display: inline-flex; align-items: center; gap: 10px; color: #194f45; font-weight: 900; line-height: 1.15; text-decoration: none; }',
      '.site-main-nav-brand img { width: 42px; height: 42px; border: 2px solid #f8c63f; border-radius: 50%; background: #edf5df; }',
      '.site-main-nav-brand small { display: block; margin-top: 2px; color: #6a7d74; font-size: .68rem; font-weight: 800; letter-spacing: .04em; }',
      '.site-main-nav-links { display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin: 0; padding: 0; list-style: none; }',
      '.site-main-nav-links a { display: block; padding: 8px 10px; border-radius: 999px; color: #29463d; font-size: .85rem; font-weight: 900; text-decoration: none; white-space: nowrap; }',
      '.site-main-nav-links a:hover, .site-main-nav-links a[aria-current="page"] { background: #edf5df; color: #194f45; }',
      '.site-lang-switch { display: flex; flex-shrink: 0; align-items: center; gap: 2px; padding: 3px; border: 1px solid #d7e3c7; border-radius: 999px; background: #fffdf7; }',
      '.site-lang-switch a { padding: 5px 11px !important; border-radius: 999px; color: #5d7168; font-size: .78rem; font-weight: 800; text-decoration: none; }',
      '.site-lang-switch a:hover { color: #194f45; background: transparent; }',
      '.site-lang-switch a.is-active { background: #194f45; color: #fffdf7; }',
      '.site-legal-footer, .site-legal-footer * { box-sizing: border-box; }',
      '.site-legal-footer-inner { width: min(1140px, calc(100% - 40px)); margin: 0 auto; }',
      '.site-legal-footer p { margin: 0; color: inherit; font-size: .92rem; line-height: 1.6; }',
      '.site-legal-footer a { color: #fff2c5; font-weight: 900; text-underline-offset: 3px; }',
      '.milk-tea-site-footer { margin: 0; padding: 30px 20px; background: #eef5df; border-top: 1px solid #d4e1c1; color: #194f45; }',
      '.milk-tea-site-footer * { box-sizing: border-box; }',
      '.milk-tea-footer-inner { width: min(1140px, calc(100% - 40px)); margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 22px; }',
      '.milk-tea-footer-copy { display: flex; align-items: center; gap: 13px; }',
      '.milk-tea-footer-icon { display: grid; place-items: center; flex: 0 0 auto; width: 43px; height: 43px; border-radius: 14px; background: #fff2c5; font-size: 1.5rem; }',
      '.milk-tea-footer-copy p { margin: 0; }',
      '.milk-tea-footer-kicker { color: #356e57; font-size: .72rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }',
      '.milk-tea-footer-title { margin-top: 3px !important; color: #194f45; font-size: .98rem; font-weight: 800; line-height: 1.45; }',
      '.milk-tea-footer-actions { position: relative; flex: 0 0 auto; }',
      '.milk-tea-footer-toggle { display: inline-flex; align-items: center; justify-content: center; min-height: 43px; padding: 10px 16px; border: 0; border-radius: 999px; background: #bf7f35; box-shadow: 0 4px 0 #8d5420; color: #fff; cursor: pointer; font: inherit; font-weight: 900; transition: transform .18s ease, box-shadow .18s ease; }',
      '.milk-tea-footer-toggle:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #8d5420; }',
      '.milk-tea-footer-toggle:focus-visible, .milk-tea-option:focus-visible, .milk-tea-close:focus-visible { outline: 3px solid #1d6ed8; outline-offset: 3px; }',
      '.milk-tea-menu { position: absolute; z-index: 30; right: 0; bottom: calc(100% + 14px); width: min(360px, calc(100vw - 32px)); padding: 19px; border: 1px solid #d3c079; border-radius: 18px; background: #fffdf7; box-shadow: 0 16px 36px rgba(33, 74, 55, .22); }',
      '.milk-tea-menu[hidden] { display: none; }',
      '.milk-tea-menu-header { display: flex; align-items: start; justify-content: space-between; gap: 12px; }',
      '.milk-tea-menu h2 { margin: 0; color: #194f45; font-family: Georgia, "Noto Serif SC", serif; font-size: 1.38rem; line-height: 1.1; }',
      '.milk-tea-menu p { margin: 7px 0 15px; color: #5d7168; font-size: .87rem; line-height: 1.48; }',
      '.milk-tea-close { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid #d7e3c7; border-radius: 50%; background: #fff; color: #194f45; cursor: pointer; font: inherit; font-size: 1.15rem; line-height: 1; }',
      '.milk-tea-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }',
      '.milk-tea-option { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 9px 10px; border: 1px solid #d1b459; border-radius: 10px; background: #fffdf7; color: #805512; font-size: .88rem; font-weight: 900; text-align: center; text-decoration: none; }',
      '.milk-tea-option:hover { background: #fff2c5; }',
      '.milk-tea-option.primary { border-color: transparent; background: #bf7f35; color: #fff; }',
      '.milk-tea-option.primary:hover { background: #a96828; }',
      '@media (max-width: 860px) { .site-main-nav-inner { align-items: flex-start; flex-direction: column; gap: 9px; } .site-main-nav-links { width: 100%; justify-content: flex-start; flex-wrap: wrap; overflow: visible; padding-bottom: 3px; } }',
      '@media (max-width: 640px) { .site-main-nav { padding: 10px 12px; } .site-main-nav-inner { width: 100%; } .site-main-nav-brand img { width: 36px; height: 36px; } .site-main-nav-links a { padding: 7px 9px; font-size: .78rem; } .site-legal-footer { padding: 22px 18px; } .site-legal-footer-inner { width: min(100%, 1140px); } .milk-tea-site-footer { padding: 24px 14px; } .milk-tea-footer-inner { width: min(100%, 1140px); align-items: stretch; flex-direction: column; gap: 15px; } .milk-tea-footer-actions, .milk-tea-footer-toggle { width: 100%; } .milk-tea-menu { right: 0; left: 0; width: 100%; } }',
      '@media print { .site-main-nav, .milk-tea-site-footer, .site-legal-footer { display: none !important; } }'
    ].join('\n');
    document.head.appendChild(style);

    if (!document.getElementById('siteMainNav')) {
      var nav = document.createElement('nav');
      nav.id = 'siteMainNav';
      nav.className = 'site-main-nav';
      nav.setAttribute('aria-label', 'Main navigation');
      nav.innerHTML = [
        '<div class="site-main-nav-inner">',
        '  <a class="site-main-nav-brand" href="/"><img src="/images/chen-laoshi-logo.svg" alt=""><span>' + t.brand + '<small>' + t.tagline + '</small></span></a>',
        '  <ul class="site-main-nav-links">',
        '    <li><a href="/">' + t.home + '</a></li>',
        '    <li><a href="/teaching-tools">' + t.tools + '</a></li>',
        '    <li><a href="/theme-activities">' + t.activities + '</a></li>',
        '    <li><a href="/resources">' + t.resources + '</a></li>',
        '    <li><a href="/recommendations">' + t.finds + '</a></li>',
        '    <li><a href="/about">' + t.about + '</a></li>',
        '    <li><a href="/contact">' + t.contact + '</a></li>',
        '  </ul>',
        '  ' + buildLangSwitchHtml(lang),
        '</div>'
      ].join('');
      var currentPath = window.location.pathname;
      Array.prototype.forEach.call(nav.querySelectorAll('.site-main-nav-links a'), function(link) {
        var path = link.getAttribute('href');
        var active = path === '/' ? currentPath === '/' : currentPath === path || currentPath.indexOf(path + '/') === 0;
        if (active) link.setAttribute('aria-current', 'page');
      });
      document.body.prepend(nav);
    }

    var legalFooters = document.querySelectorAll('footer');
    var legalFooter = legalFooters.length ? legalFooters[legalFooters.length - 1] : document.createElement('footer');
    legalFooter.id = 'siteLegalFooter';
    legalFooter.className = 'site-legal-footer';
    legalFooter.setAttribute('aria-label', 'Site information');
    legalFooter.innerHTML = [
      '<div class="site-legal-footer-inner">',
      '  <p>' + t.legalFooter + '</p>',
      '</div>'
    ].join('');
    if (legalFooter.parentElement !== document.body) document.body.appendChild(legalFooter);

    var footer = document.createElement('aside');
    footer.id = 'milkTeaFooter';
    footer.className = 'milk-tea-site-footer';
    footer.setAttribute('aria-label', 'Site footer');
    footer.innerHTML = [
      '<div class="milk-tea-footer-inner">',
      '  <div class="milk-tea-footer-copy">',
      '    <span class="milk-tea-footer-icon" aria-hidden="true">🧋</span>',
      '    <div><p class="milk-tea-footer-kicker">' + t.milkTeaKicker + '</p><p class="milk-tea-footer-title">' + t.milkTeaTitle + '</p></div>',
      '  </div>',
      '  <div class="milk-tea-footer-actions">',
      '    <div class="milk-tea-menu" id="milkTeaMenu" hidden>',
      '      <div class="milk-tea-menu-header"><div><h2>' + t.milkTeaHeading + '</h2><p>' + t.milkTeaBody + '</p></div><button class="milk-tea-close" type="button" aria-label="' + t.milkTeaClose + '">×</button></div>',
      '      <div class="milk-tea-options">',
      '        <a class="milk-tea-option primary" href="https://paypal.me/chenlaoshitoolkit/1.99USD" target="_blank" rel="noopener noreferrer">$1.99</a>',
      '        <a class="milk-tea-option" href="https://paypal.me/chenlaoshitoolkit/4.99USD" target="_blank" rel="noopener noreferrer">$4.99</a>',
      '        <a class="milk-tea-option" href="https://paypal.me/chenlaoshitoolkit/9.99USD" target="_blank" rel="noopener noreferrer">$9.99</a>',
      '        <a class="milk-tea-option" href="https://paypal.me/chenlaoshitoolkit" target="_blank" rel="noopener noreferrer">' + t.milkTeaChoose + '</a>',
      '      </div>',
      '    </div>',
      '    <button class="milk-tea-footer-toggle" type="button" aria-expanded="false" aria-controls="milkTeaMenu">' + t.milkTeaToggle + '</button>',
      '  </div>',
      '</div>'
    ].join('');

    legalFooter.before(footer);

    var toggle = footer.querySelector('.milk-tea-footer-toggle');
    var menu = footer.querySelector('.milk-tea-menu');
    var close = footer.querySelector('.milk-tea-close');

    function setOpen(open) {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) close.focus();
    }

    toggle.addEventListener('click', function () { setOpen(menu.hidden); });
    close.addEventListener('click', function () { setOpen(false); toggle.focus(); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !menu.hidden) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('click', function (event) {
      if (!menu.hidden && !footer.contains(event.target)) setOpen(false);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createFooter);
  else createFooter();
}());
