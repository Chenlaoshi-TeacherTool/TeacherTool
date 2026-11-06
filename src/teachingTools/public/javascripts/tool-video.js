(function () {
  'use strict';

  // "Watch how" button for a tool's tutorial video (links set at /admin/toolvideos,
  // served by /api/tool-videos). Loaded by milk-tea-footer.js on every page, and
  // directly by the few full-screen tools that skip the site menu.
  var LABELS = {
    en: { videoButton: 'Watch how', videoTitle: 'How to use this tool', videoClose: 'Close video' },
    zh: { videoButton: '看教程', videoTitle: '这个工具怎么用', videoClose: '关闭视频' }
  };

  function getLang() {
    var match = document.cookie.match(/(?:^|; )lang=([^;]+)/);
    return match && decodeURIComponent(match[1]) === 'zh' ? 'zh' : 'en';
  }

  // Tutorial video for this tool (set at /admin/toolvideos): a "Watch how" button
  // that plays the YouTube video in a pop-up without leaving the tool.
  function videoKey(pathname) {
    return String(pathname || '').replace(/\/index\.html$/i, '').replace(/\/+$/, '');
  }

  function addToolVideo() {
    if (/^\/(admin|play|api)(\/|$)/.test(window.location.pathname) || !window.fetch || document.getElementById('toolVideoButton')) return;
    fetch('/api/tool-videos').then(function (response) { return response.ok ? response.json() : null; }).then(function (data) {
      var entry = data && data.videos && data.videos[videoKey(window.location.pathname)];
      if (!entry) return;
      var lang = getLang();
      var t = LABELS[lang];
      var video = entry[lang] || entry.zh || entry.en;
      if (!video || !/^[A-Za-z0-9_-]{11}$/.test(video.id)) return;

      var style = document.createElement('style');
      style.textContent = [
        '.tool-video-button { position: fixed; z-index: 60; right: 18px; bottom: 18px; display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 10px 18px 10px 14px; border: 0; border-radius: 999px; background: #c9503f; box-shadow: 0 6px 18px rgba(25, 61, 56, .28); color: #fff; cursor: pointer; font: inherit; font-size: .95rem; font-weight: 900; transition: transform .18s ease; }',
        '.tool-video-button:hover { transform: translateY(-2px); }',
        '.tool-video-button:focus-visible, .tool-video-close:focus-visible { outline: 3px solid #f8c63f; outline-offset: 3px; }',
        '.tool-video-button span { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: rgba(255, 255, 255, .22); font-size: .75rem; }',
        '.tool-video-dialog { width: min(920px, calc(100vw - 24px)); max-height: calc(100vh - 24px); padding: 0; border: 0; border-radius: 18px; background: #103e37; color: #fffdf7; }',
        '.tool-video-dialog.is-vertical { width: min(420px, calc(100vw - 24px)); }',
        '.tool-video-dialog::backdrop { background: rgba(12, 30, 27, .72); }',
        '.tool-video-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px 10px 18px; }',
        '.tool-video-head h2 { margin: 0; color: inherit; font-size: 1rem; font-weight: 800; }',
        '.tool-video-close { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, .14); color: #fff; cursor: pointer; font-size: 1.3rem; line-height: 1; }',
        '.tool-video-frame { position: relative; aspect-ratio: 16 / 9; background: #000; }',
        '.is-vertical .tool-video-frame { aspect-ratio: 9 / 16; max-height: calc(100vh - 90px); margin: 0 auto; }',
        '.tool-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }',
        '@media (max-width: 640px) { .tool-video-button { right: 12px; bottom: 12px; } }',
        '@media print { .tool-video-button, .tool-video-dialog { display: none !important; } }'
      ].join('\n');
      document.head.appendChild(style);

      var button = document.createElement('button');
      button.type = 'button';
      button.id = 'toolVideoButton';
      button.className = 'tool-video-button';
      button.innerHTML = '<span aria-hidden="true">▶</span>' + t.videoButton;
      document.body.appendChild(button);

      var dialog = document.createElement('dialog');
      dialog.className = 'tool-video-dialog' + (video.vertical ? ' is-vertical' : '');
      dialog.setAttribute('aria-label', t.videoTitle);
      dialog.innerHTML = '<div class="tool-video-head"><h2>' + t.videoTitle + '</h2><button class="tool-video-close" type="button" aria-label="' + t.videoClose + '">×</button></div><div class="tool-video-frame"></div>';
      document.body.appendChild(dialog);
      var frame = dialog.querySelector('.tool-video-frame');

      function close() { if (dialog.open) dialog.close(); }
      dialog.addEventListener('close', function () { frame.innerHTML = ''; button.focus(); }); // stops playback
      dialog.querySelector('.tool-video-close').addEventListener('click', close);
      dialog.addEventListener('click', function (event) { if (event.target === dialog) close(); });
      button.addEventListener('click', function () {
        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube-nocookie.com/embed/' + video.id + '?autoplay=1&rel=0&modestbranding=1';
        iframe.title = t.videoTitle;
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.allowFullscreen = true;
        frame.appendChild(iframe);
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else window.open('https://www.youtube.com/watch?v=' + video.id, '_blank', 'noopener');
      });
    }).catch(function () { /* no video button */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addToolVideo);
  else addToolVideo();
}());
