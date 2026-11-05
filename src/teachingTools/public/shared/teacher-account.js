(function () {
  'use strict';
  if (document.getElementById('teacherAccountBar')) return;
  var zh = document.documentElement.lang.indexOf('zh') === 0 || /(?:^|;\s*)lang=zh(?:;|$)/.test(document.cookie);
  var labels = zh ? {login: '登录', register: '注册', materials: '我的资料', membership: '会员', logout: '退出', title: '老师账号', close: '关闭', email: '邮箱注册／登录', google: '使用 Google 登录', pending: '老师注册登录尚未开放，现有免费工具仍可使用。', help: '继续后进入统一安全登录页，可注册邮箱账号、找回密码。', googleHelp: '在安全登录页选择 Google 继续。第一次用 Google 请点「注册」。', sameEmail: '已经用邮箱和密码注册过的老师，请继续用「邮箱登录」。同一个邮箱不能再用 Google 注册。', error: '暂时无法读取登录状态，请稍后再试。'} : {login: 'Log in', register: 'Sign up', materials: 'My materials', membership: 'Membership', logout: 'Log out', title: 'Teacher account', close: 'Close', email: 'Continue with email', google: 'Continue with Google', pending: 'Teacher accounts are not open yet. Existing free tools remain available.', help: 'Continue to the secure sign-in page to create an email account, reset a password.', googleHelp: 'Choose Google on the secure sign-in page. First time with Google? Use Sign up.', sameEmail: 'Already signed up with an email and password? Keep using Continue with email. The same email cannot also sign up with Google.', error: 'Sign-in status is temporarily unavailable. Please try again.'};
  var session = null;
  var revision = 0;
  var bar;
  var dialog;
  function node(tag, text) { var result = document.createElement(tag); if (text) result.textContent = text; return result; }
  function link(text, href) { var result = node('a', text); result.href = href; return result; }
  // Send the teacher back to the tool they were using instead of the server's default page.
  function returnHere(url, param) {
    var here = location.pathname + location.search;
    if (here.indexOf('/') !== 0 || here.indexOf('//') === 0 || here.indexOf('/.auth/') === 0) return url;
    var target = new URL(url, location.origin);
    target.searchParams.set(param, here);
    return target.pathname + target.search;
  }

  function openDialog(mode) {
    dialog.replaceChildren();
    var title = node('h2', mode === 'register' ? labels.register + ' · ' + labels.title : labels.login + ' · ' + labels.title);
    title.id = 'teacherAccountTitle';
    var close = node('button', '×'); close.type = 'button'; close.className = 'teacher-account-close'; close.setAttribute('aria-label', labels.close); close.title = labels.close; close.addEventListener('click', function () { dialog.close(); });
    dialog.append(title, close, node('p', labels.help));
    if (!session || !session.available || !session.login.length) dialog.appendChild(node('p', labels.pending));
    else {
      var entry = session.login[0].url;
      if (entry.indexOf('/.auth/login/') !== 0) return;
      entry = returnHere(entry, 'post_login_redirect_uri');
      // Sign up opens the sign-up page directly. Log in always asks for the email, skipping Microsoft's
      // remembered-account picker, which loops forever on an account that was deleted; an email with no
      // account then gets Microsoft's "No account? Create one" link.
      var start = new URL(entry, location.origin); start.searchParams.set('prompt', mode === 'register' ? 'create' : 'login'); entry = start.pathname + start.search;
      dialog.appendChild(link(labels.email, entry));
      // Google sign-up is on hold (External ID fails to create Google accounts); shown only if re-enabled.
      if ((session.methods || []).includes('google')) dialog.append(link(labels.google, entry), node('p', labels.googleHelp), node('p', labels.sameEmail));
    }
    dialog.showModal();
  }

  function render() {
    bar.replaceChildren();
    // Show nothing until the server confirms teacher accounts are open.
    bar.hidden = !(session && session.available);
    if (bar.hidden) return;
    var materials = link(labels.materials, '/teaching-tools/word-list-library/word-list-library.html');
    materials.className = 'teacher-account-materials';
    // Membership prices sit with the account buttons so teachers can find them from any page.
    var membership = link(labels.membership, '/membership');
    membership.className = 'teacher-account-membership';
    if (session.signedIn) {
      bar.appendChild(node('span', session.user.name));
      bar.append(materials, membership, link(labels.logout, returnHere(session.logout, 'post_logout_redirect_uri')));
    } else {
      var login = node('button', labels.login); login.type = 'button'; login.addEventListener('click', function () { openDialog('login'); });
      var signup = node('button', labels.register); signup.type = 'button'; signup.addEventListener('click', function () { openDialog('register'); });
      bar.append(materials, login, signup, membership);
    }
  }

  async function refresh() {
    var selected = ++revision;
    try {
      var response = await fetch('/api/teacher-library/session', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Unavailable');
      var result = await response.json();
      if (selected !== revision) return;
      session = result;
      render();
    } catch (error) { if (selected === revision) { session = null; render(); } }
  }

  function setup() {
    if (document.getElementById('teacherAccountBar')) return;
    var style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/shared/teacher-account.css'; document.head.appendChild(style);
    bar = node('div'); bar.id = 'teacherAccountBar'; bar.setAttribute('aria-label', labels.title);
    var nav = document.querySelector('#siteMainNav .site-main-nav-inner');
    var langSwitch = nav && nav.querySelector('.site-lang-switch');
    if (langSwitch) {
      // Keep account buttons in the top-right corner next to the language switch.
      var tools = node('div'); tools.className = 'site-nav-tools';
      langSwitch.replaceWith(tools);
      tools.append(bar, langSwitch);
    } else if (nav) nav.appendChild(bar); else { var header = node('header'); header.className = 'teacher-account-header'; header.appendChild(bar); document.body.prepend(header); }
    dialog = document.createElement('dialog'); dialog.id = 'teacherAccountDialog'; dialog.setAttribute('aria-labelledby', 'teacherAccountTitle'); document.body.appendChild(dialog);
    render();
    refresh();
    window.addEventListener('focus', refresh);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
